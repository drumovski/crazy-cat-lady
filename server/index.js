import { createServer } from "http";
import { Server } from "socket.io";
import { createRoom, joinRoom, getRoom, removeSocket, handleAction, scheduleAiIfNeeded } from "./rooms.js";

const PORT = process.env.PORT || 3001;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || "*" }
});

function broadcastRoom(room) {
  io.to(room.roomCode).emit("roomState", {
    roomCode: room.roomCode,
    status: room.status,
    numPlayers: room.numPlayers,
    aiPlayerIds: room.aiPlayerIds,
    joinedSeats: [...room.seatToSocket.keys()],
    game: room.game
  });
}

io.on("connection", socket => {
  socket.on("createRoom", ({ numPlayers, numAiOpponents }, callback) => {
    const { room, playerId, error } = createRoom({ numPlayers, numAiOpponents, socketId: socket.id });
    if (error) {
      callback({ error });
      return;
    }

    socket.join(room.roomCode);
    callback({ roomCode: room.roomCode, playerId });
    broadcastRoom(room);
    scheduleAiIfNeeded(room, () => broadcastRoom(room));
  });

  socket.on("joinRoom", ({ roomCode }, callback) => {
    const result = joinRoom(roomCode, socket.id);
    if (result.error) {
      callback({ error: result.error });
      return;
    }

    socket.join(roomCode);
    callback({ roomCode, playerId: result.playerId });
    broadcastRoom(result.room);
    scheduleAiIfNeeded(result.room, () => broadcastRoom(result.room));
  });

  socket.on("gameAction", ({ roomCode, type, args }) => {
    const room = getRoom(roomCode);
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
