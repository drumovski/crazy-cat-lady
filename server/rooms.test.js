import { createRoom, joinRoom, getRoom, removeSocket, removeAbandonedRooms } from "./rooms.js";

// Console.log-assertion style, matching src/game/engine.test.js/ai.test.js —
// no framework, run directly with `node`. Exercises removeAbandonedRooms
// (and the seatToSocket/emptySince bookkeeping it depends on) purely through
// rooms.js's own exported functions, the same way a real socket disconnect
// would drive it.

// Simulates time passing for a single removeAbandonedRooms() call, without
// a real setTimeout wait — the room-abandon timeout is 30 minutes, far too
// long to actually sleep for in a test.
function sweepAfter(ms, fn) {
  const realNow = Date.now;
  Date.now = () => realNow() + ms;
  try {
    fn();
  } finally {
    Date.now = realNow;
  }
}

function testAbandonedWaitingRoomGetsSwept() {
  const roomName = "AbandonTest1";
  createRoom({ numPlayers: 2, numAiOpponents: 0, socketId: "socketA", name: "Alice", roomName, blockTimerSeconds: 10 });
  console.log("Room exists right after creation:", Boolean(getRoom(roomName)));

  removeSocket("socketA"); // the only connected human disconnects before anyone else joins
  console.log("Room still exists immediately after its only socket disconnects (grace period):", Boolean(getRoom(roomName)));

  sweepAfter(31 * 60 * 1000, removeAbandonedRooms); // pretend 31 minutes have passed
  console.log("Room swept away after exceeding the abandon timeout:", getRoom(roomName) === undefined);
}

testAbandonedWaitingRoomGetsSwept();

function testReconnectCancelsAbandonClock() {
  const roomName = "AbandonTest2";
  createRoom({ numPlayers: 2, numAiOpponents: 0, socketId: "socketB", name: "Bob", roomName, blockTimerSeconds: 10 });
  removeSocket("socketB");

  // Someone joins before the timeout elapses (room's still "waiting", so
  // this is an ordinary join, not a rejoin) — should cancel the clock.
  joinRoom(roomName, "socketC", "Carol");

  sweepAfter(60 * 60 * 1000, removeAbandonedRooms); // pretend a full hour has passed
  console.log("Room survives because someone joined before the sweep:", Boolean(getRoom(roomName)));
}

testReconnectCancelsAbandonClock();

function testDisconnectedSeatBecomesAvailableAgain() {
  const roomName = "AbandonTest3";
  const created = createRoom({ numPlayers: 2, numAiOpponents: 0, socketId: "socketD", name: "Dave", roomName, blockTimerSeconds: 10 });
  console.log("Dave got seat 0:", created.playerId === 0);

  removeSocket("socketD");

  const rejoined = joinRoom(roomName, "socketE", "Erin");
  console.log("A new socket can claim the freed seat 0 (previously stuck occupied forever):", rejoined.playerId === 0);
}

testDisconnectedSeatBecomesAvailableAgain();

function testActiveRoomNeverSwept() {
  const roomName = "AbandonTest4";
  createRoom({ numPlayers: 2, numAiOpponents: 0, socketId: "socketF", name: "Frank", roomName, blockTimerSeconds: 10 });
  // socketF never disconnects.

  sweepAfter(24 * 60 * 60 * 1000, removeAbandonedRooms); // pretend a full day has passed
  console.log("An actively-connected room is never swept, no matter how long:", Boolean(getRoom(roomName)));
}

testActiveRoomNeverSwept();

function testFinishedGameRoomIsUnaffectedByEmptySinceLogic() {
  // Sanity check: removeAbandonedRooms only concerns rooms still tracked by
  // name — a room already removed via the normal win-condition path (see
  // server/index.js's broadcastRoom) simply isn't in the Map anymore, so a
  // later sweep has nothing to do regardless of emptySince.
  const roomName = "AbandonTest5";
  createRoom({ numPlayers: 2, numAiOpponents: 0, socketId: "socketG", name: "Gina", roomName, blockTimerSeconds: 10 });
  removeSocket("socketG");
  sweepAfter(31 * 60 * 1000, removeAbandonedRooms);
  console.log("Already-swept room stays gone on a later sweep too:", getRoom(roomName) === undefined);
}

testFinishedGameRoomIsUnaffectedByEmptySinceLogic();
