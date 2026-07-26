import { io } from "socket.io-client";

// The server URL is configurable via VITE_SERVER_URL for deployment (e.g.
// pointing a static build at a separately-hosted server); defaults to the
// local dev server started with `npm run server`.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

let socket = null;

function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, { transports: ["websocket"], autoConnect: true });
  }
  return socket;
}

export function createRoom(numPlayers, numAiOpponents, name) {
  return new Promise(resolve => {
    getSocket().emit("createRoom", { numPlayers, numAiOpponents, name }, resolve);
  });
}

export function joinRoom(roomCode, name) {
  return new Promise(resolve => {
    getSocket().emit("joinRoom", { roomCode, name }, resolve);
  });
}

export function sendGameAction(roomCode, type, args) {
  getSocket().emit("gameAction", { roomCode, type, args });
}

export function onRoomState(handler) {
  getSocket().on("roomState", handler);
  return () => getSocket().off("roomState", handler);
}
