// App-wide audio preferences: independent volume levels (0-1) for music and
// game sound effects, read by music.js/sfx.js before playing and by
// SoundSettings.jsx for its on-screen sliders. Plain module-level state with
// a pub-sub subscribe, not React context — this mirrors sfx.js's own
// module-level state (audioCache, clockAudio) rather than introducing a
// different state-management pattern just for these settings, and lets
// non-React code (music.js, sfx.js) read the current value synchronously
// without needing to be inside the component tree.
function makeVolumeChannel(storageKey, defaultVolume) {
  function readStored() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return defaultVolume;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : defaultVolume;
    } catch {
      // localStorage can throw (private browsing limits, disabled storage) —
      // fall back to the default rather than crash on startup.
      return defaultVolume;
    }
  }

  let volume = readStored();
  const listeners = new Set();

  return {
    get: () => volume,
    set(next) {
      const clamped = Math.min(1, Math.max(0, next));
      if (clamped === volume) return;
      volume = clamped;
      try {
        localStorage.setItem(storageKey, String(volume));
      } catch {
        // Persistence is a nicety, not required for the slider to work this session.
      }
      listeners.forEach(listener => listener(volume));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// Music defaults quieter than sound effects — full-volume background music
// was overpowering the game sounds it's meant to sit behind.
const musicChannel = makeVolumeChannel("crazyCatLady.musicVolume", 0.3);
const sfxChannel = makeVolumeChannel("crazyCatLady.sfxVolume", 1);

export const getMusicVolume = musicChannel.get;
export const setMusicVolume = musicChannel.set;
export const subscribeMusicVolume = musicChannel.subscribe;

export const getSfxVolume = sfxChannel.get;
export const setSfxVolume = sfxChannel.set;
export const subscribeSfxVolume = sfxChannel.subscribe;
