import { useState } from "react";

export default function SetupScreen({ onStart }) {
  const [numPlayers, setNumPlayers] = useState(2);

  return (
    <div className="setup-screen">
      <h1>🐱 Crazy Cat Lady</h1>
      <p>Wake, steal, and collect cats — become the Crazy Cat Lady by scoring the most points!</p>

      <label className="setup-field">
        Number of players
        <select value={numPlayers} onChange={e => setNumPlayers(Number(e.target.value))}>
          {[2, 3, 4, 5].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <button type="button" className="primary-button" onClick={() => onStart(numPlayers)}>
        Start Game
      </button>

      <p className="setup-hint">
        Local hotseat: pass the device around, playing one card per turn.
      </p>
    </div>
  );
}
