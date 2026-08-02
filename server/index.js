import { createServer } from "http";
import { Server } from "socket.io";
import { createRoom, joinRoom, getRoom, removeRoom, removeSocket, handleAction, scheduleNextStep } from "./rooms.js";

const PORT = process.env.PORT || 3001;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || "*" }
});

function roomState(room) {
  return {
    roomName: room.roomName,
    status: room.status,
    numPlayers: room.numPlayers,
    aiPlayerIds: room.aiPlayerIds,
    playerNames: room.playerNames,
    blockTimerSeconds: room.blockTimerSeconds,
    joinedSeats: [...room.seatToSocket.keys()],
    game: room.game
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
  const emitter = excludeSocket ? excludeSocket.to(room.roomName) : io.to(room.roomName);
  emitter.emit("roomState", roomState(room));

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
    callback({ roomName: room.roomName, playerId, ...roomState(room) });
    broadcastRoom(room, socket);
    scheduleNextStep(room, () => broadcastRoom(room));
  });

  socket.on("joinRoom", ({ roomName, name }, callback) => {
    const result = joinRoom(roomName, socket.id, name);
    if (result.error) {
      callback({ error: result.error });
      return;
    }

    socket.join(result.room.roomName);
    callback({ roomName: result.room.roomName, playerId: result.playerId, ...roomState(result.room) });
    broadcastRoom(result.room, socket);
    scheduleNextStep(result.room, () => broadcastRoom(result.room));
  });

  socket.on("gameAction", ({ roomName, type, args }) => {
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
