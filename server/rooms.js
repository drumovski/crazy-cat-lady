import {
  createGame,
  playDog,
  playFish,
  playCatnip,
  playLaserPointer,
  resolveLaserReveal,
  discardCard,
  discardMathSet,
  respondToPendingAction,
  respondToWakeChoice,
  respondAsAi,
  respondToWakeChoiceAsAi
} from "../src/game/engine.js";
import { takeAiTurn, pickRandomAiName } from "../src/game/ai.js";
import { isValidBlockTimerSeconds, DEFAULT_BLOCK_TIMER_SECONDS } from "../src/game/blockTimer.js";
import { AI_THINK_DELAY_MS, LASER_REVEAL_DELAY_MS } from "../src/game/timings.js";

const ROOM_NAME_MIN_LENGTH = 4;
const ROOM_NAME_MAX_LENGTH = 16;

// Keyed by the room name lowercased, so lookups/uniqueness are
// case-insensitive; each room still remembers the creator's original casing
// (room.roomName) for display.
const rooms = new Map();

function validateRoomName(roomName) {
  const trimmed = typeof roomName === "string" ? roomName.trim() : "";

  if (trimmed.length < ROOM_NAME_MIN_LENGTH || trimmed.length > ROOM_NAME_MAX_LENGTH) {
    return { error: `Room name must be ${ROOM_NAME_MIN_LENGTH}-${ROOM_NAME_MAX_LENGTH} characters.` };
  }
  if (rooms.has(trimmed.toLowerCase())) {
    return { error: "That room name is already in use." };
  }

  return { roomName: trimmed };
}

// Maps a client-facing action type to the engine function it calls. playerId
// always comes from the room's socketToSeat lookup (server-verified), never
// from the client message, so a client can't act as another seat.
const ACTIONS = {
  playDog: (game, playerId, [cardIndex, slotIndex]) => playDog(game, playerId, cardIndex, slotIndex),
  playFish: (game, playerId, [cardIndex, targetPlayerId, targetCatIndex]) =>
    playFish(game, playerId, cardIndex, targetPlayerId, targetCatIndex),
  playCatnip: (game, playerId, [cardIndex, targetPlayerId, targetCatIndex]) =>
    playCatnip(game, playerId, cardIndex, targetPlayerId, targetCatIndex),
  playLaserPointer: (game, playerId, [cardIndex]) => playLaserPointer(game, playerId, cardIndex),
  discardCard: (game, playerId, [cardIndex]) => discardCard(game, playerId, cardIndex),
  discardMathSet: (game, playerId, [cardIndices]) => discardMathSet(game, playerId, cardIndices),
  respondToPendingAction: (game, playerId, [blockCardIndex]) =>
    respondToPendingAction(game, playerId, blockCardIndex),
  respondToWakeChoice: (game, playerId, [slotIndex]) => respondToWakeChoice(game, playerId, slotIndex)
};

function sanitizeName(name, fallback) {
  const trimmed = typeof name === "string" ? name.trim().slice(0, 20) : "";
  return trimmed || fallback;
}

function assignSeat(room, socketId, name) {
  const freeSeat = room.humanSeats.find(seatId => !room.seatToSocket.has(seatId));
  if (freeSeat === undefined) {
    return { error: "Room is full" };
  }

  room.seatToSocket.set(freeSeat, socketId);
  room.socketToSeat.set(socketId, freeSeat);
  room.playerNames[freeSeat] = sanitizeName(name, `Player ${freeSeat + 1}`);

  if (room.humanSeats.every(seatId => room.seatToSocket.has(seatId))) {
    room.game = createGame(room.numPlayers);
    room.status = "playing";
  }

  return { playerId: freeSeat };
}

// numAiOpponents seats are always the LAST numAiOpponents seats (e.g. 4
// players / 2 AI -> seats 2,3 are AI). The creator always gets seat 0.
export function createRoom({ numPlayers, numAiOpponents, socketId, name, roomName, blockTimerSeconds }) {
  if (numAiOpponents >= numPlayers) {
    return { error: "Need at least one human seat" };
  }

  const nameResult = validateRoomName(roomName);
  if (nameResult.error) {
    return { error: nameResult.error };
  }

  // A malicious/buggy client could send anything here — fall back to the
  // default rather than trusting an out-of-range or malformed value.
  const validBlockTimerSeconds = isValidBlockTimerSeconds(blockTimerSeconds)
    ? blockTimerSeconds
    : DEFAULT_BLOCK_TIMER_SECONDS;

  const aiPlayerIds = [];
  for (let i = numPlayers - numAiOpponents; i < numPlayers; i++) {
    aiPlayerIds.push(i);
  }
  const humanSeats = [];
  for (let i = 0; i < numPlayers; i++) {
    if (!aiPlayerIds.includes(i)) humanSeats.push(i);
  }

  const room = {
    roomName: nameResult.roomName,
    numPlayers,
    aiPlayerIds,
    humanSeats,
    blockTimerSeconds: validBlockTimerSeconds,
    seatToSocket: new Map(),
    socketToSeat: new Map(),
    playerNames: new Array(numPlayers).fill(null),
    game: null,
    status: "waiting"
  };

  const usedAiNames = [];
  for (const aiSeat of aiPlayerIds) {
    const aiName = pickRandomAiName(usedAiNames);
    usedAiNames.push(aiName);
    room.playerNames[aiSeat] = aiName;
  }

  rooms.set(room.roomName.toLowerCase(), room);

  const seatResult = assignSeat(room, socketId, name);
  return { room, playerId: seatResult.playerId };
}

// Finds a human seat to rejoin by exact name match — the only "identity" a
// player has, since rooms are name-based with no accounts (see "Online
// multiplayer" in CLAUDE.md). Deliberately doesn't check whether that seat's
// existing socket is actually dead: there's no reliable way to tell "the
// original tab is gone" from "a second device is joining in" without real
// auth, so a matching name always wins the seat, same trust level as
// everything else here (anyone who knows the room name and a player's name
// could already do a lot). Uses the same trim+truncate as sanitizeName so a
// name that got truncated to 20 chars on original join still matches.
function findRejoinSeat(room, name) {
  const trimmed = sanitizeName(name, null);
  if (!trimmed) return undefined;
  return room.humanSeats.find(seatId => room.playerNames[seatId] === trimmed);
}

export function joinRoom(roomName, socketId, name) {
  const room = rooms.get(typeof roomName === "string" ? roomName.trim().toLowerCase() : "");
  if (!room) {
    return { error: "Room not found" };
  }
  if (room.status === "playing") {
    // Bug, fixed: a dropped connection (e.g. a mobile browser discarding a
    // backgrounded tab, which comes back as a full reload with no session to
    // resume) used to have no way back in at all — joinRoom rejected outright
    // once the game had started. Now a rejoin attempt whose name matches an
    // existing seat reclaims it (rebinding seatToSocket/socketToSeat to the
    // new socket) instead of being turned away.
    const rejoinSeat = findRejoinSeat(room, name);
    if (rejoinSeat === undefined) {
      return { error: "That game has already started" };
    }
    room.seatToSocket.set(rejoinSeat, socketId);
    room.socketToSeat.set(socketId, rejoinSeat);
    return { room, playerId: rejoinSeat };
  }

  const seatResult = assignSeat(room, socketId, name);
  if (seatResult.error) {
    return { error: seatResult.error };
  }

  return { room, playerId: seatResult.playerId };
}

export function getRoom(roomName) {
  return rooms.get(typeof roomName === "string" ? roomName.trim().toLowerCase() : "");
}

// Frees a room's name for reuse — called once a game finishes (see the
// "winner" check in server/index.js's broadcastRoom), since otherwise a
// finished room lingers forever (no other cleanup/expiry exists) and its
// name can never be created again, even by the same player wanting to
// immediately start a new game with the same name.
export function removeRoom(roomName) {
  rooms.delete(typeof roomName === "string" ? roomName.trim().toLowerCase() : "");
}

export function removeSocket(socketId) {
  for (const room of rooms.values()) {
    room.socketToSeat.delete(socketId);
  }
}

export function handleAction(room, playerId, type, args) {
  const actionFn = ACTIONS[type];
  if (!actionFn || !room.game) {
    return;
  }
  actionFn(room.game, playerId, args);
}

function getDecisionMakerId(game) {
  return game.pendingAction
    ? game.pendingAction.targetId
    : game.pendingWakeChoice
    ? game.pendingWakeChoice.playerId
    : game.currentPlayerIndex;
}

// After any state change, checks whether the game is mid-Laser-Pointer-reveal
// or an AI player owes the next move (turn or reaction) and — if so —
// resolves it after a short delay, calling onUpdate so the caller can
// broadcast the new state. Chains automatically as long as the following
// step is also automatic (reveal resolution, or another AI decision).
export function scheduleNextStep(room, onUpdate) {
  if (!room.game || room.game.winner !== undefined) {
    return;
  }

  // A pending reveal isn't anyone's decision — human or AI — so it always
  // resolves on its own timer regardless of whose turn it is.
  if (room.game.pendingLaserReveal) {
    setTimeout(() => {
      resolveLaserReveal(room.game);
      onUpdate();
      scheduleNextStep(room, onUpdate);
    }, LASER_REVEAL_DELAY_MS);
    return;
  }

  const decisionMakerId = getDecisionMakerId(room.game);
  if (!room.aiPlayerIds.includes(decisionMakerId)) {
    return;
  }

  setTimeout(() => {
    if (room.game.pendingAction) {
      respondAsAi(room.game, decisionMakerId);
    } else if (room.game.pendingWakeChoice) {
      respondToWakeChoiceAsAi(room.game, decisionMakerId);
    } else {
      takeAiTurn(room.game, decisionMakerId);
    }
    onUpdate();
    scheduleNextStep(room, onUpdate);
  }, AI_THINK_DELAY_MS);
}
