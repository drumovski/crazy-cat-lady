import { useEffect, useRef, useState } from "react";
import {
  getMusicVolume,
  setMusicVolume,
  subscribeMusicVolume,
  getSfxVolume,
  setSfxVolume,
  subscribeSfxVolume
} from "../sound/soundSettings.js";

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
// write the same persisted settings in src/sound/soundSettings.js, so a
// volume changed on one screen carries over to the other without needing
// shared React state.
export default function SoundSettings() {
  const [open, setOpen] = useState(false);
  const [musicVolume, setMusicVolumeState] = useState(getMusicVolume());
  const [sfxVolume, setSfxVolumeState] = useState(getSfxVolume());
  const rootRef = useRef(null);

  useEffect(() => subscribeMusicVolume(setMusicVolumeState), []);
  useEffect(() => subscribeSfxVolume(setSfxVolumeState), []);

  // Close on any click outside the button/popover, so it doesn't stay open
  // once the player moves on to actually clicking something else.
  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const muted = musicVolume === 0 && sfxVolume === 0;

  return (
    <div className="sound-settings" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        onClick={() => setOpen(v => !v)}
        title="Sound settings"
      >
        <SpeakerIcon muted={muted} />
      </button>

      {open && (
        <div className="sound-settings-popover">
          <label className="sound-settings-row">
            <span>Music</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(musicVolume * 100)}
              onChange={e => setMusicVolume(Number(e.target.value) / 100)}
            />
          </label>
          <label className="sound-settings-row">
            <span>Sound Effects</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(sfxVolume * 100)}
              onChange={e => setSfxVolume(Number(e.target.value) / 100)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
