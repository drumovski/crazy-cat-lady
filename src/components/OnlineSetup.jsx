import { useEffect, useState } from "react";
import { createRoom, joinRoom, onRoomState } from "../multiplayer/socketClient.js";
import { BLOCK_TIMER_MIN, BLOCK_TIMER_MAX, DEFAULT_BLOCK_TIMER_SECONDS } from "../game/blockTimer.js";
import MenuFrame from "./MenuFrame.jsx";

const ROOM_NAME_MIN_LENGTH = 4;
const ROOM_NAME_MAX_LENGTH = 16;
const BLOCK_TIMER_CHOICES = Array.from(
  { length: BLOCK_TIMER_MAX - BLOCK_TIMER_MIN + 1 },
  (_, i) => BLOCK_TIMER_MIN + i
);

export default function OnlineSetup({
  onReady,
  onBack,
  initialName = "",
  onNameChange,
  initialRoomName = "",
  onRoomNameChange,
  // Pre-seeds the "waiting for other players" screen below instead of
  // starting at the create/join chooser — used by App.jsx's "Play Again"
  // flow, which has already created-or-joined a room by the time this
  // component (re)mounts and just needs to show the same waiting state a
  // normal create/join would have landed on.
  initialRoom = null
}) {
  const [mode, setMode] = useState("choose"); // 'choose' | 'create' | 'join'
  const [numPlayers, setNumPlayers] = useState(2);
  const [numAiOpponents, setNumAiOpponents] = useState(0);
  const [blockTimerSeconds, setBlockTimerSeconds] = useState(DEFAULT_BLOCK_TIMER_SECONDS);
  const [playerName, setPlayerNameState] = useState(initialName);
  // Wraps the state setter to also report the change up to App.jsx, which
  // persists it across backToMenu — so "Your name" pre-fills again next time
  // instead of coming back blank.
  function setPlayerName(value) {
    setPlayerNameState(value);
    onNameChange?.(value);
  }
  const [roomNameInput, setRoomNameInputState] = useState(initialRoomName);
  // Wraps the state setter to also report the change up to App.jsx, which
  // persists it across backToMenu — so a room name (typed, or left over from
  // finishing a game) pre-fills again next time instead of coming back blank.
  function setRoomNameInput(value) {
    setRoomNameInputState(value);
    onRoomNameChange?.(value);
  }
  const [joinRoomName, setJoinRoomName] = useState("");
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(initialRoom); // { roomName, playerId } once created/joined

  useEffect(() => {
    if (!room) return undefined;

    return onRoomState(state => {
      if (state.roomName !== room.roomName) return;
      if (state.status === "playing") {
        // Pass the state we already received along with the session — if we
        // only passed {roomName, playerId} and made the parent start a fresh
        // subscription, it would miss this same one-time "playing" broadcast
        // (it fires as part of this same event, before the parent's own
        // subscription effect has a chance to run).
        onReady({ roomName: room.roomName, playerId: room.playerId, initialState: state });
      }
    });
  }, [room, onReady]);

  const trimmedRoomNameInput = roomNameInput.trim();
  const isRoomNameValid =
    trimmedRoomNameInput.length >= ROOM_NAME_MIN_LENGTH && trimmedRoomNameInput.length <= ROOM_NAME_MAX_LENGTH;

  // The ack itself carries the room's current state — if this join/create
  // happened to fill the last seat, the game is already "playing" by the
  // time we see this response, and we can jump straight into it. Waiting
  // instead for a subsequent "roomState" broadcast would race the effect
  // below (which only starts listening once `room` is set and this
  // component re-renders) against the server's near-simultaneous broadcast,
  // and could miss it — leaving the joining player stuck on this screen
  // forever even though the game already started for everyone else.
  function handleJoined(result) {
    if (result.status === "playing") {
      onReady({ roomName: result.roomName, playerId: result.playerId, initialState: result });
    } else {
      setRoom({ roomName: result.roomName, playerId: result.playerId });
    }
  }

  async function handleCreate() {
    setError(null);
    const result = await createRoom(numPlayers, numAiOpponents, playerName, roomNameInput, blockTimerSeconds);
    if (result.error) {
      setError(result.error);
      return;
    }
    handleJoined(result);
  }

  async function handleJoin() {
    setError(null);
    const result = await joinRoom(joinRoomName, playerName);
    if (result.error) {
      setError(result.error);
      return;
    }
    handleJoined(result);
  }

  if (room) {
    return (
      <MenuFrame>
        <p>Waiting for other players to join…</p>
        <div className="room-name-display">{room.roomName}</div>
        <p className="setup-hint">Share this room name with the other players.</p>
        <button type="button" className="secondary-button" onClick={onBack}>
          Cancel
        </button>
      </MenuFrame>
    );
  }

  if (mode === "create") {
    return (
      <MenuFrame>
        <label className="setup-field">
          Your name
          <input
            className="name-input"
            value={playerName}
            maxLength={20}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Player 1"
          />
        </label>
        <label className="setup-field">
          Room name
          <input
            className="room-name-input"
            value={roomNameInput}
            maxLength={ROOM_NAME_MAX_LENGTH}
            onChange={e => setRoomNameInput(e.target.value)}
            placeholder="e.g. Kittens"
          />
        </label>
        {trimmedRoomNameInput.length > 0 && !isRoomNameValid ? (
          <p className="setup-error">
            Room name must be {ROOM_NAME_MIN_LENGTH}-{ROOM_NAME_MAX_LENGTH} characters.
          </p>
        ) : (
          <p className="setup-hint">
            {ROOM_NAME_MIN_LENGTH}-{ROOM_NAME_MAX_LENGTH} characters.
          </p>
        )}
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
        <label className="setup-field">
          Block response time
          <select
            value={blockTimerSeconds === null ? "never" : blockTimerSeconds}
            onChange={e => setBlockTimerSeconds(e.target.value === "never" ? null : Number(e.target.value))}
          >
            {BLOCK_TIMER_CHOICES.map(n => (
              <option key={n} value={n}>{n} seconds</option>
            ))}
            <option value="never">Never (no limit)</option>
          </select>
        </label>
        {error && <p className="setup-error">{error}</p>}
        <button type="button" className="primary-button" disabled={!isRoomNameValid} onClick={handleCreate}>
          Create Room
        </button>
        <button type="button" className="secondary-button" onClick={() => setMode("choose")}>
          Back
        </button>
      </MenuFrame>
    );
  }

  if (mode === "join") {
    return (
      <MenuFrame>
        <label className="setup-field">
          Your name
          <input
            className="name-input"
            value={playerName}
            maxLength={20}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Player 2"
          />
        </label>
        <label className="setup-field">
          Room name
          <input
            className="room-name-input"
            value={joinRoomName}
            maxLength={ROOM_NAME_MAX_LENGTH}
            onChange={e => setJoinRoomName(e.target.value)}
            placeholder="e.g. Kittens"
          />
        </label>
        {error && <p className="setup-error">{error}</p>}
        <button
          type="button"
          className="primary-button"
          disabled={joinRoomName.trim().length < ROOM_NAME_MIN_LENGTH}
          onClick={handleJoin}
        >
          Join Room
        </button>
        <button type="button" className="secondary-button" onClick={() => setMode("choose")}>
          Back
        </button>
      </MenuFrame>
    );
  }

  return (
    <MenuFrame>
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
    </MenuFrame>
  );
}
