import { useEffect, useState } from "react";
import { getMuted, setMuted, subscribeMuted } from "../sound/soundSettings.js";

function SpeakerIcon({ muted }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7" />}
    </svg>
  );
}

// Rendered independently on the menu screen (ModeSelect) and in-game
// (GameBoard) — only one of those is ever mounted at once, but both read and
// write the same persisted setting in src/sound/soundSettings.js, so muting
// on one screen carries over to the other without needing shared React state.
export default function SoundToggle() {
  const [muted, setMutedState] = useState(getMuted());

  useEffect(() => subscribeMuted(setMutedState), []);

  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => setMuted(!muted)}
      title={muted ? "Unmute sound" : "Mute sound"}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}
