import { useEffect, useState } from "react";
import { createRoom, joinRoom, onRoomState } from "../multiplayer/socketClient.js";

export default function OnlineSetup({ onReady, onBack }) {
  const [mode, setMode] = useState("choose"); // 'choose' | 'create' | 'join'
  const [numPlayers, setNumPlayers] = useState(2);
  const [numAiOpponents, setNumAiOpponents] = useState(0);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null); // { roomCode, playerId } once created/joined

  useEffect(() => {
    if (!room) return undefined;

    return onRoomState(state => {
      if (state.roomCode !== room.roomCode) return;
      if (state.status === "playing") {
        // Pass the state we already received along with the session — if we
        // only passed {roomCode, playerId} and made the parent start a fresh
        // subscription, it would miss this same one-time "playing" broadcast
        // (it fires as part of this same event, before the parent's own
        // subscription effect has a chance to run).
        onReady({ roomCode: room.roomCode, playerId: room.playerId, initialState: state });
      }
    });
  }, [room, onReady]);

  async function handleCreate() {
    setError(null);
    const result = await createRoom(numPlayers, numAiOpponents);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRoom({ roomCode: result.roomCode, playerId: result.playerId });
  }

  async function handleJoin() {
    setError(null);
    const result = await joinRoom(joinCode.trim().toUpperCase());
    if (result.error) {
      setError(result.error);
      return;
    }
    setRoom({ roomCode: result.roomCode, playerId: result.playerId });
  }

  if (room) {
    return (
      <div className="setup-screen">
        <h1>🐱 Crazy Cat Lady</h1>
        <p>Waiting for other players to join…</p>
        <div className="room-code">{room.roomCode}</div>
        <p className="setup-hint">Share this code with the other players.</p>
        <button type="button" className="secondary-button" onClick={onBack}>
          Cancel
        </button>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="setup-screen">
        <h1>🐱 Crazy Cat Lady</h1>
        <label className="setup-field">
          Total players
          <select value={numPlayers} onChange={e => {
            const n = Number(e.target.value);
            setNumPlayers(n);
            setNumAiOpponents(prev => Math.min(prev, n - 1));
          }}>
            {[2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="setup-field">
          AI opponents
          <select value={numAiOpponents} onChange={e => setNumAiOpponents(Number(e.target.value))}>
            {Array.from({ length: numPlayers }, (_, n) => n).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        {error && <p className="setup-error">{error}</p>}
        <button type="button" className="primary-button" onClick={handleCreate}>
          Create Room
        </button>
        <button type="button" className="secondary-button" onClick={() => setMode("choose")}>
          Back
        </button>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="setup-screen">
        <h1>🐱 Crazy Cat Lady</h1>
        <label className="setup-field">
          Room code
          <input
            className="room-code-input"
            value={joinCode}
            maxLength={4}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="ABCD"
          />
        </label>
        {error && <p className="setup-error">{error}</p>}
        <button type="button" className="primary-button" disabled={joinCode.trim().length !== 4} onClick={handleJoin}>
          Join Room
        </button>
        <button type="button" className="secondary-button" onClick={() => setMode("choose")}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="setup-screen">
      <h1>🐱 Crazy Cat Lady</h1>
      <p>Play online with friends over the network.</p>
      <button type="button" className="primary-button" onClick={() => setMode("create")}>
        Create Room
      </button>
      <button type="button" className="primary-button" onClick={() => setMode("join")}>
        Join Room
      </button>
      <button type="button" className="secondary-button" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
