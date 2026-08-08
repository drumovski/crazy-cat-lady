import { io } from "socket.io-client";

// The server URL is configurable via VITE_SERVER_URL for deployment (e.g.
// pointing a static build at a separately-hosted server); defaults to the
// local dev server started with `npm run server`.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

let socket = null;

function getSocket() {
  if (!socket) {
    // Allow the long-polling fallback (Socket.IO's default behavior) rather
    // than forcing WebSocket-only — some hosting proxies (e.g. shared-hosting
    // Node.js apps behind a reverse proxy) don't pass WebSocket upgrades
    // through cleanly, and without polling as a fallback the connection
    // would just fail outright instead of degrading gracefully.
    socket = io(SERVER_URL, { transports: ["websocket", "polling"], autoConnect: true });
  }
  return socket;
}

export function createRoom(numPlayers, numAiOpponents, name, roomName, blockTimerSeconds) {
  return new Promise(resolve => {
    getSocket().emit("createRoom", { numPlayers, numAiOpponents, name, roomName, blockTimerSeconds }, resolve);
  });
}

export function joinRoom(roomName, name) {
  return new Promise(resolve => {
    getSocket().emit("joinRoom", { roomName, name }, resolve);
  });
}

export function sendGameAction(roomName, type, args) {
  getSocket().emit("gameAction", { roomName, type, args });
}

// Fire-and-forget, like sendGameAction — the caller (OnlineSetup's "Cancel"
// button) is navigating away regardless of whether this reaches the server,
// so there's nothing worth waiting on an ack for.
export function leaveRoom(roomName) {
  getSocket().emit("leaveRoom", { roomName });
}

export function onRoomState(handler) {
  getSocket().on("roomState", handler);
  return () => getSocket().off("roomState", handler);
}

// Fires only on a successful *automatic* reconnection (socket.io's Manager
// event), never on the initial connect — distinct from onRoomState above.
// A reconnection always gets a fresh socket.id, so the server's seat binding
// for the old one (cleared by its own disconnect handling once the dead
// connection's ping times out) is gone; the caller needs this to know when
// to re-run joinRoom and claim the seat back under the new id.
export function onReconnect(handler) {
  getSocket().io.on("reconnect", handler);
  return () => getSocket().io.off("reconnect", handler);
}
