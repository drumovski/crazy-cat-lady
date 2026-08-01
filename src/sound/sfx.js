import { getSfxVolume, subscribeSfxVolume } from "./soundSettings.js";

// One sound file per card/event, served statically from public/sounds/. Maps
// the engine's sfxEvents keys (see engine.js) to filenames. mp3 (not the
// original wav exports) to keep the deployed bundle small.
const SOUND_FILES = {
  shuffle: "Shuffle.mp3",
  dealCard: "Deal Card.mp3",
  wakeCat: "Wake Cat.mp3",
  gingerTomBackToSleep: "Ginger Tom Back to Sleep.mp3",
  fish: "Fish.mp3",
  seagull: "Seagull.mp3",
  catnip: "Catnip.mp3",
  snail: "Snail.mp3",
  laser: "Laser Pointer2.mp3",
  win: "Applause.mp3"
};

// Cache one base <audio> per sound; cloneNode() on every play so the same
// sound can overlap with itself (e.g. a burst of "dealCard" plays).
const audioCache = new Map();

function getBaseAudio(key) {
  if (!audioCache.has(key)) {
    audioCache.set(key, new Audio(encodeURI(`/sounds/${SOUND_FILES[key]}`)));
  }
  return audioCache.get(key);
}

export function playSfx(key) {
  const volume = getSfxVolume();
  if (!SOUND_FILES[key] || volume === 0) return;
  const instance = getBaseAudio(key).cloneNode();
  instance.volume = volume;
  // Autoplay can be blocked before the user has interacted with the page at
  // all — that's expected on first load, not an error worth surfacing.
  instance.play().catch(() => {});
}

// Plays a whole batch of events in order, staggered slightly so repeats
// (e.g. three "dealCard" events from one math discard) read as distinct
// dings instead of one overlapping blob, and a "shuffle" followed by several
// "dealCard"s sounds like an actual shuffle-then-deal instead of firing at
// once.
export function playSfxBatch(events, staggerMs = 150) {
  events.forEach((key, i) => {
    setTimeout(() => playSfx(key), i * staggerMs);
  });
}

// The block-timer countdown's ticking clock — a single persistent looping
// instance (not a one-shot like the events above) that GameBoard starts and
// stops to bracket exactly the countdown window: it loops if the clip is
// shorter than the remaining count, and gets cut off immediately (even
// mid-clip) the moment the countdown ends, whichever comes first.
let clockAudio = null;

function getClockAudio() {
  if (!clockAudio) {
    clockAudio = new Audio(encodeURI("/sounds/Clock.mp3"));
    clockAudio.loop = true;
  }
  return clockAudio;
}

export function startClockTick() {
  const volume = getSfxVolume();
  if (volume === 0) return;
  const audio = getClockAudio();
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function stopClockTick() {
  if (!clockAudio) return;
  clockAudio.pause();
  clockAudio.currentTime = 0;
}

// The clock tick is the one looping (not one-shot) sound, so a live volume
// change needs to actively apply mid-countdown rather than just affecting
// future plays — otherwise a drag to 0 would keep looping until the
// countdown itself ends.
subscribeSfxVolume(volume => {
  if (!clockAudio) return;
  if (volume === 0) {
    stopClockTick();
  } else {
    clockAudio.volume = volume;
  }
});

// Warms the browser's cache for every sound effect (and the clock tick) as
// soon as the app loads, so the first real play of each doesn't have to wait
// on a fresh network fetch + decode. "dealCard" plays constantly, so it's
// always warm by the time it matters regardless — but most other sounds
// (Fish, Seagull, Laser Pointer2, the very first "shuffle" of a session,
// etc.) only play occasionally, each considerably bigger than the tiny
// Deal Card clip, so a cold first play noticeably lags behind the action
// that triggered it without this.
export function preloadSfx() {
  Object.keys(SOUND_FILES).forEach(getBaseAudio);
  getClockAudio();
}
