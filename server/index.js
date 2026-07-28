import { createServer } from "http";
import { Server } from "socket.io";
import { createRoom, joinRoom, getRoom, removeSocket, handleAction, scheduleAiIfNeeded } from "./rooms.js";

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

function broadcastRoom(room) {
  io.to(room.roomName).emit("roomState", roomState(room));
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
    callback({ roomName: room.roomName, playerId, ...roomState(room) });
    broadcastRoom(room);
    scheduleAiIfNeeded(room, () => broadcastRoom(room));
  });

  socket.on("joinRoom", ({ roomName, name }, callback) => {
    const result = joinRoom(roomName, socket.id, name);
    if (result.error) {
      callback({ error: result.error });
      return;
    }

    socket.join(result.room.roomName);
    callback({ roomName: result.room.roomName, playerId: result.playerId, ...roomState(result.room) });
    broadcastRoom(result.room);
    scheduleAiIfNeeded(result.room, () => broadcastRoom(result.room));
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
    scheduleAiIfNeeded(room, () => broadcastRoom(room));
  });

  socket.on("disconnect", () => {
    removeSocket(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Crazy Cat Lady multiplayer server listening on port ${PORT}`);
});
