import { useState } from "react";
import { pickRandomAiName } from "../game/ai.js";
import { BLOCK_TIMER_MIN, BLOCK_TIMER_MAX, DEFAULT_BLOCK_TIMER_SECONDS } from "../game/blockTimer.js";

const BLOCK_TIMER_CHOICES = Array.from(
  { length: BLOCK_TIMER_MAX - BLOCK_TIMER_MIN + 1 },
  (_, i) => BLOCK_TIMER_MIN + i
);

export default function SetupScreen({ onStart, initialNames = ["", "", "", "", ""] }) {
  const [numPlayers, setNumPlayers] = useState(2);
  const [aiPlayerIds, setAiPlayerIds] = useState([]);
  const [playerNames, setPlayerNames] = useState(initialNames);
  const [blockTimerSeconds, setBlockTimerSeconds] = useState(DEFAULT_BLOCK_TIMER_SECONDS);

  function changeNumPlayers(n) {
    setNumPlayers(n);
    setAiPlayerIds(prev => prev.filter(id => id < n));
  }

  function toggleAi(playerId) {
    setAiPlayerIds(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  }

  function setName(playerId, value) {
    setPlayerNames(prev => {
      const next = [...prev];
      next[playerId] = value;
      return next;
    });
  }

  function handleStart() {
    const usedAiNames = [];
    const finalNames = Array.from({ length: numPlayers }, (_, playerId) => {
      if (aiPlayerIds.includes(playerId)) {
        const name = pickRandomAiName(usedAiNames);
        usedAiNames.push(name);
        return name;
      }
      return playerNames[playerId].trim() || `Player ${playerId + 1}`;
    });
    // Pass the raw (pre-fallback) typed names too, separate from finalNames
    // (which has "Player N" substituted for blanks and AI names filled in)
    // — the caller persists these verbatim so a player's name survives into
    // their next game instead of being forced to retype it, without also
    // "remembering" an auto-generated placeholder as if it were typed.
    onStart(numPlayers, aiPlayerIds, finalNames, blockTimerSeconds, playerNames);
  }

  return (
    <div className="setup-screen">
      <h1>🐱 Crazy Cat Lady</h1>
      <p>Wake, steal, and collect cats — become the Crazy Cat Lady!</p>

      <label className="setup-field">
        Number of players
        <select value={numPlayers} onChange={e => changeNumPlayers(Number(e.target.value))}>
          {[2, 3, 4, 5].map(n => (
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

      <div className="setup-player-list">
        {Array.from({ length: numPlayers }, (_, playerId) => {
          const isAi = aiPlayerIds.includes(playerId);
          return (
            <div key={playerId} className="setup-player-row">
              <input
                className="setup-name-input"
                type="text"
                maxLength={20}
                placeholder={`Player ${playerId + 1}`}
                value={isAi ? "" : playerNames[playerId]}
                disabled={isAi}
                onChange={e => setName(playerId, e.target.value)}
              />
              <label className="setup-ai-toggle">
                <input type="checkbox" checked={isAi} onChange={() => toggleAi(playerId)} />
                AI-controlled
              </label>
            </div>
          );
        })}
      </div>

      <button type="button" className="primary-button" onClick={handleStart}>
        Start Game
      </button>

      <p className="setup-hint">
        Local hotseat: pass the device around, playing one card per turn — any AI players take their
        turns automatically.
      </p>
    </div>
  );
}
