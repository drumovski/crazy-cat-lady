import {
  createGame,
  playDog,
  playFish,
  playCatnip,
  playLaserPointer,
  discardCard,
  discardMathSet,
  respondToPendingAction,
  respondToWakeChoice,
  respondAsAi,
  respondToWakeChoiceAsAi
} from "../src/game/engine.js";
import { takeAiTurn, pickRandomAiName } from "../src/game/ai.js";
import { isValidBlockTimerSeconds, DEFAULT_BLOCK_TIMER_SECONDS } from "../src/game/blockTimer.js";

const AI_THINK_DELAY_MS = 700;
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

export function joinRoom(roomName, socketId, name) {
  const room = rooms.get(typeof roomName === "string" ? roomName.trim().toLowerCase() : "");
  if (!room) {
    return { error: "Room not found" };
  }
  if (room.status === "playing") {
    return { error: "That game has already started" };
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

// After any state change, checks whether an AI player owes the next move
// (turn or reaction) and — if so — resolves it after a short delay, calling
// onUpdate so the caller can broadcast the new state. Chains automatically
// if the following decision-maker is also AI.
export function scheduleAiIfNeeded(room, onUpdate) {
  if (!room.game || room.game.winner !== undefined) {
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
    scheduleAiIfNeeded(room, onUpdate);
  }, AI_THINK_DELAY_MS);
}
