import { createServer } from "http";
import { Server } from "socket.io";
import { createRoom, joinRoom, getRoom, removeRoom, removeSocket, handleAction, scheduleNextStep } from "./rooms.js";
import { isRateLimited } from "./rateLimit.js";

// createRoom/joinRoom are keyed by IP (handshake.address) rather than
// socket.id — a fresh socket is free (just reconnect), a fresh IP isn't.
// gameAction is keyed by socket.id instead: it's about capping how fast one
// already-seated connection can flood actions, not about spam room creation,
// and legitimate players sharing a household IP shouldn't throttle each
// other's actual gameplay.
//
// Bumped up from an original 20/30 after real-world use hit the cap: this
// game's actual common case is several people on one shared WiFi (one IP)
// each creating/joining/rejoining their own way, not one request per group —
// the original numbers assumed the latter. Confirmed in production, not
// just theorized: the "SiteGround reverse proxy could collapse everyone
// onto one shared bucket" caveat this comment used to carry turned out
// moot (the actual deploy uses Render for the backend, not SiteGround —
// see CLAUDE.md's Deployment section), but a shared-WiFi household hits the
// exact same symptom regardless of hosting, since they always really do
// share one real IP. Still high enough to cap an obvious scripted flood.
const CREATE_ROOM_LIMIT = { max: 40, windowMs: 10 * 60 * 1000 };
const JOIN_ROOM_LIMIT = { max: 60, windowMs: 10 * 60 * 1000 };
const GAME_ACTION_LIMIT = { max: 15, windowMs: 5 * 1000 };

const PORT = process.env.PORT || 3001;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || "*" }
});

// Strips information a given viewer shouldn't be able to see over the wire —
// every OTHER player's hand contents, the deck's exact remaining order, and
// the identity of any cat still asleep — before a game state is sent to
// them. This is a hidden-information card game, but `room.game` (the
// server's own authoritative copy, used unredacted by every engine/AI call
// in rooms.js) has no concept of "who's allowed to see what" — without this,
// every socket in the room received the identical, fully-visible object, and
// any player could read every opponent's hand and every unwoken cat's
// identity straight out of the WebSocket frames via their browser's own
// devtools, no exploit needed. Only ever applied to the outgoing copy; never
// mutates `room.game` itself.
function redactGameForPlayer(game, viewerPlayerId) {
  if (!game) return game;
  return {
    ...game,
    players: game.players.map(p =>
      p.id === viewerPlayerId ? p : { ...p, hand: p.hand.map(() => ({ hidden: true })) }
    ),
    // Contents never matter to any client even for its own true owner — the
    // draw pile is always rendered as a single face-down CardBack, never
    // per-card (see CardBack's "deck" variant) — kept as an array of the
    // same length rather than dropped outright, in case anything ever comes
    // to rely on `deck.length`.
    deck: game.deck.map(() => null),
    // `id` is kept (unlike name/points/pairKey/wakesBonus) — SleepingCatsGrid
    // uses it for `layoutId={`card-${cat.id}`}`, the mechanism that flies+
    // flips a cat from its face-down slot into the waker's face-up Card (see
    // CLAUDE.md's "Card animations" section). It's a safe opaque id to
    // expose: ids are assigned to cats *before* the 12-cat shuffle, so a
    // slot's id reveals nothing about which cat is actually there ahead of
    // it being woken (at which point it's public anyway, id and all).
    sleepingCats: game.sleepingCats.map(cat => (cat ? { id: cat.id, slot: cat.slot, awake: false } : null))
  };
}

function roomState(room, viewerPlayerId) {
  return {
    roomName: room.roomName,
    status: room.status,
    numPlayers: room.numPlayers,
    aiPlayerIds: room.aiPlayerIds,
    playerNames: room.playerNames,
    blockTimerSeconds: room.blockTimerSeconds,
    joinedSeats: [...room.seatToSocket.keys()],
    game: redactGameForPlayer(room.game, viewerPlayerId)
  };
}

// excludeSocket lets the create/join handlers below skip re-delivering the
// same state to the socket that just got it via their ack callback —
// without this, that socket would receive the freshly-created game (whose
// sfxEvents, e.g. ["shuffle", ...N x "dealCard"], is what actually plays
// sound) via two independently-serialized copies. Since online broadcasts
// re-serialize into fresh object/array references every time (see the
// blockTimerSeconds comment in GameBoard.jsx), the client's sfx-batch dedupe
// — which compares game.sfxEvents by reference — can't tell those two
// copies apart, so it played the same "shuffle" (and every deal-card ding)
// twice, audibly overlapping.
function broadcastRoom(room, excludeSocket) {
  // Can't use a single Socket.IO room-wide emit here (as before) since each
  // recipient now needs their *own* redacted view (see roomState/
  // redactGameForPlayer above) — one shared payload would mean either
  // nobody's hand is hidden, or everyone's is, including the recipient's own.
  for (const [seatId, socketId] of room.seatToSocket) {
    if (excludeSocket && socketId === excludeSocket.id) continue;
    io.sockets.sockets.get(socketId)?.emit("roomState", roomState(room, seatId));
  }

  // Once the game is over, free the room name for reuse — e.g. so a player
  // can immediately create a new room with the same name (OnlineSetup.jsx
  // defaults the "Room name" field to whatever was last used). Every
  // still-connected socket is also made to .leave() this Socket.IO room —
  // without that, a client lingering on the win screen (nothing forces it
  // to navigate away) would stay subscribed to this room *name*, and start
  // receiving broadcasts meant for an unrelated new room that later reuses
  // it, since Socket.IO rooms are just channels keyed by name.
  if (room.game && room.game.winner !== undefined) {
    for (const socketId of room.seatToSocket.values()) {
      io.sockets.sockets.get(socketId)?.leave(room.roomName);
    }
    removeRoom(room.roomName);
  }
}

io.on("connection", socket => {
  socket.on("createRoom", ({ numPlayers, numAiOpponents, name, roomName, blockTimerSeconds }, callback) => {
    if (isRateLimited(`createRoom:${socket.handshake.address}`, CREATE_ROOM_LIMIT)) {
      callback({ error: "Too many rooms created — please wait a bit and try again." });
      return;
    }

    const { room, playerId, error } = createRoom({
      numPlayers,
      numAiOpponents,
      socketId: socket.id,
      name,
      roomName,
      blockTimerSeconds
    });
    if (error) {
      callback({ error });
      return;
    }

    // Join using the room's own canonical casing, not whatever the client
    // sent — otherwise a client typing different casing than the room's
    // stored name would end up in a different Socket.IO room entirely.
    socket.join(room.roomName);
    // The ack carries the full room state (not just roomName/playerId) so
    // the client can tell right away whether the game already started —
    // e.g. when this join fills the last seat, `broadcastRoom` below fires
    // near-simultaneously with this ack, and a client that only starts
    // listening for "roomState" after processing the ack (a render/effect
    // later) would otherwise miss that broadcast and be stuck waiting
    // forever. Handing over the state directly in the ack closes that race.
    // broadcastRoom excludes this socket (see its comment) since this ack
    // already delivered the same state to it.
    callback({ roomName: room.roomName, playerId, ...roomState(room, playerId) });
    broadcastRoom(room, socket);
    scheduleNextStep(room, () => broadcastRoom(room));
  });

  socket.on("joinRoom", ({ roomName, name }, callback) => {
    if (isRateLimited(`joinRoom:${socket.handshake.address}`, JOIN_ROOM_LIMIT)) {
      callback({ error: "Too many join attempts — please wait a bit and try again." });
      return;
    }

    const result = joinRoom(roomName, socket.id, name);
    if (result.error) {
      callback({ error: result.error });
      return;
    }

    socket.join(result.room.roomName);
    callback({ roomName: result.room.roomName, playerId: result.playerId, ...roomState(result.room, result.playerId) });
    broadcastRoom(result.room, socket);
    scheduleNextStep(result.room, () => broadcastRoom(result.room));
  });

  socket.on("gameAction", ({ roomName, type, args }) => {
    // No callback on this event (fire-and-forget, see the comment on
    // ACTIONS in rooms.js), so — same as the existing invalid-room/
    // invalid-seat checks right below — a rate-limited action is just
    // silently dropped rather than erroring back.
    if (isRateLimited(`gameAction:${socket.id}`, GAME_ACTION_LIMIT)) {
      return;
    }

    const room = getRoom(roomName);
    if (!room || !room.game) {
      return;
    }

    const playerId = room.socketToSeat.get(socket.id);
    if (playerId === undefined) {
      return;
    }

    handleAction(room, playerId, type, args);
    broadcastRoom(room);
    scheduleNextStep(room, () => broadcastRoom(room));
  });

  socket.on("disconnect", () => {
    removeSocket(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Crazy Cat Lady multiplayer server listening on port ${PORT}`);
});
