import { useState } from "react";

export default function SetupScreen({ onStart }) {
  const [numPlayers, setNumPlayers] = useState(2);
  const [aiPlayerIds, setAiPlayerIds] = useState([]);

  function changeNumPlayers(n) {
    setNumPlayers(n);
    setAiPlayerIds(prev => prev.filter(id => id < n));
  }

  function toggleAi(playerId) {
    setAiPlayerIds(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  }

  return (
    <div className="setup-screen">
      <h1>🐱 Crazy Cat Lady</h1>
      <p>Wake, steal, and collect cats — become the Crazy Cat Lady by scoring the most points!</p>

      <label className="setup-field">
        Number of players
        <select value={numPlayers} onChange={e => changeNumPlayers(Number(e.target.value))}>
          {[2, 3, 4, 5].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <div className="setup-ai-list">
        {Array.from({ length: numPlayers }, (_, playerId) => (
          <label key={playerId} className="setup-ai-toggle">
            <input
              type="checkbox"
              checked={aiPlayerIds.includes(playerId)}
              onChange={() => toggleAi(playerId)}
            />
            Player {playerId + 1} is AI-controlled
          </label>
        ))}
      </div>

      <button type="button" className="primary-button" onClick={() => onStart(numPlayers, aiPlayerIds)}>
        Start Game
      </button>

      <p className="setup-hint">
        Local hotseat: pass the device around, playing one card per turn — any AI players take their
        turns automatically.
      </p>
    </div>
  );
}
