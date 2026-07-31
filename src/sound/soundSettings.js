// App-wide audio preference (currently just mute), read by sfx.js before
// playing anything and by SoundToggle.jsx for its on-screen state. Plain
// module-level state with a pub-sub subscribe, not React context — this
// mirrors sfx.js's own module-level state (audioCache, clockAudio) rather
// than introducing a different state-management pattern just for one
// setting, and lets non-React code (sfx.js) read the current value
// synchronously without needing to be inside the component tree.
const STORAGE_KEY = "crazyCatLady.muted";

function readStoredMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // localStorage can throw (private browsing limits, disabled storage) —
    // fall back to "not muted" rather than crash on startup.
    return false;
  }
}

let muted = readStoredMuted();
const listeners = new Set();

export function getMuted() {
  return muted;
}

export function setMuted(next) {
  if (next === muted) return;
  muted = next;
  try {
    localStorage.setItem(STORAGE_KEY, String(muted));
  } catch {
    // Persistence is a nicety, not required for the toggle to work this session.
  }
  listeners.forEach(listener => listener(muted));
}

export function subscribeMuted(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
