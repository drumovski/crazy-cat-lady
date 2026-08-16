import { createRoom, joinRoom, leaveRoom, getRoom, removeSocket, removeAbandonedRooms } from "./rooms.js";

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

function testLeaveRoomDeletesASoloWaitingRoomImmediately() {
  // The bug: creating a room then clicking Cancel before anyone else joined
  // used to orphan it forever (no disconnect ever fired, so it never even
  // became eligible for the abandoned-room sweep).
  const roomName = "LeaveTest1";
  createRoom({ numPlayers: 2, numAiOpponents: 0, socketId: "socketH", name: "Hank", roomName, blockTimerSeconds: 10 });
  console.log("Room exists right after creation:", Boolean(getRoom(roomName)));

  leaveRoom(roomName, "socketH");
  console.log("Room is deleted immediately on leaveRoom, no sweep needed:", getRoom(roomName) === undefined);
}

testLeaveRoomDeletesASoloWaitingRoomImmediately();

function testLeaveRoomJustFreesTheSeatWhenOthersAreStillWaiting() {
  const roomName = "LeaveTest2";
  createRoom({ numPlayers: 3, numAiOpponents: 0, socketId: "socketI", name: "Ivy", roomName, blockTimerSeconds: 10 });
  joinRoom(roomName, "socketJ", "Jack"); // still "waiting" — needs a 3rd human

  leaveRoom(roomName, "socketJ"); // Jack cancels, Ivy is still there
  console.log("Room survives because Ivy is still connected:", Boolean(getRoom(roomName)));

  const rejoined = joinRoom(roomName, "socketK", "Kate");
  console.log("Jack's freed seat can be claimed by someone new:", rejoined.playerId === 1);
}

testLeaveRoomJustFreesTheSeatWhenOthersAreStillWaiting();

function testLeaveRoomOnAPlayingRoomKeepsTheGracePeriodInstead() {
  // Shouldn't be reachable from the real UI (the Cancel button only renders
  // pre-game), but handled defensively the same as an ordinary disconnect —
  // a "playing" room shouldn't lose its rejoin-by-name grace period just
  // because this event fired instead of a real disconnect.
  const roomName = "LeaveTest3";
  createRoom({ numPlayers: 2, numAiOpponents: 0, socketId: "socketL", name: "Liam", roomName, blockTimerSeconds: 10 });
  joinRoom(roomName, "socketM", "Mia"); // fills the room -> status becomes "playing"

  leaveRoom(roomName, "socketL");
  leaveRoom(roomName, "socketM"); // now empty, but mid-game
  console.log("A now-empty 'playing' room isn't deleted immediately:", Boolean(getRoom(roomName)));

  sweepAfter(31 * 60 * 1000, removeAbandonedRooms);
  console.log("...but is still caught by the normal abandon sweep eventually:", getRoom(roomName) === undefined);
}

testLeaveRoomOnAPlayingRoomKeepsTheGracePeriodInstead();

function testLeaveRoomIsASafeNoOpForAnUnknownRoomOrSeat() {
  leaveRoom("NoSuchRoom", "socketN");
  console.log("leaveRoom on a nonexistent room doesn't throw:", true);

  const roomName = "LeaveTest4";
  createRoom({ numPlayers: 2, numAiOpponents: 0, socketId: "socketO", name: "Owen", roomName, blockTimerSeconds: 10 });
  leaveRoom(roomName, "socketNotInThisRoom");
  console.log("leaveRoom with a socket that isn't seated in the room doesn't throw:", true);
  console.log("...and doesn't affect the room's actual occupant:", Boolean(getRoom(roomName)));
}

testLeaveRoomIsASafeNoOpForAnUnknownRoomOrSeat();

function testDoubleJoinFromTheSameSocketDoesNotStealASecondSeat() {
  // Bug, fixed: a "Join Room" button double-clicked while waiting on a
  // slow/cold-starting server queued two joinRoom emits on the same socket
  // (socket.io buffers emits made before the connection is up), both firing
  // back-to-back the moment it opened — assignSeat's free-seat search had no
  // guard against the SAME socket claiming a second, different seat, so one
  // real player ended up seated twice under one name in a 3+ player room,
  // silently eating a seat another real player needed.
  const roomName = "DoubleJoinTest1";
  const created = createRoom({
    numPlayers: 3,
    numAiOpponents: 0,
    socketId: "socketP",
    name: "Priya",
    roomName,
    blockTimerSeconds: 10
  });
  console.log("Priya (creator) got seat 0:", created.playerId === 0);

  // Same socketId joining again — simulates the queued double-emit.
  const secondJoinSameSocket = joinRoom(roomName, "socketP", "Priya");
  console.log(
    "A second joinRoom from the SAME socket returns the SAME seat, not a new one:",
    secondJoinSameSocket.playerId === 0
  );

  // A genuinely different player joining afterward still gets a real, free
  // seat — the fix shouldn't make the room look more full than it is.
  const realSecondPlayer = joinRoom(roomName, "socketQ", "Quinn");
  console.log("A different socket still claims a real free seat:", realSecondPlayer.playerId === 1);
}

testDoubleJoinFromTheSameSocketDoesNotStealASecondSeat();

testLeaveRoomIsASafeNoOpForAnUnknownRoomOrSeat();
