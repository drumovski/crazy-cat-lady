import { getMusicVolume, subscribeMusicVolume } from "./soundSettings.js";

// Background music: four tracks played back-to-back, then looping the
// playlist forever. A single persistent <audio> element (not one per track,
// and not tied to any component) so playback survives menu -> setup -> game
// -> New Game transitions without restarting — startMusic() is called
// exactly once, at App.jsx's module scope, and everything else here is just
// bookkeeping to keep that one element playing.
const TRACKS = [
  "/music/Crazy Cat Lady 1.mp3",
  "/music/Crazy Cat Lady 2.mp3",
  "/music/Crazy Cat Lady 3.mp3",
  "/music/Crazy Cat Lady 4.mp3"
];

let audio = null;
let trackIndex = 0;
// True once playback has actually begun (not just attempted) — distinct from
// "have we tried yet", since the first attempt (at module load, before any
// user gesture) is expected to be blocked by the browser's autoplay policy.
let playing = false;

function getAudio() {
  if (!audio) {
    audio = new Audio();
    audio.volume = getMusicVolume();
    audio.addEventListener("ended", playNextTrack);
    subscribeMusicVolume(volume => {
      audio.volume = volume;
    });
  }
  return audio;
}

function playNextTrack() {
  trackIndex = (trackIndex + 1) % TRACKS.length;
  const el = getAudio();
  el.src = encodeURI(TRACKS[trackIndex]);
  el.play().catch(() => {});
}

// Safe to call repeatedly (e.g. once eagerly at load, again on the first
// user interaction) — a no-op once music is genuinely playing.
export function startMusic() {
  if (playing) return;
  const el = getAudio();
  el.src = encodeURI(TRACKS[trackIndex]);
  el.play()
    .then(() => {
      playing = true;
    })
    .catch(() => {
      // Blocked by the browser's autoplay policy (expected before the user
      // has interacted with the page at all) — `playing` stays false, so the
      // first-interaction listener below gets another shot.
    });
}

// Browsers block audio-with-sound until the user has interacted with the
// page at all, so the module-load attempt above will typically fail
// silently — this retries on the first real user gesture anywhere, which
// browsers do allow to start playback. Removed after the first attempt
// regardless of outcome, since a gesture-triggered play() call reliably
// succeeds barring genuinely unusual environments not worth guarding for.
function resumeOnInteraction() {
  startMusic();
  window.removeEventListener("pointerdown", resumeOnInteraction);
  window.removeEventListener("keydown", resumeOnInteraction);
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", resumeOnInteraction);
  window.addEventListener("keydown", resumeOnInteraction);
}
