import { getMuted, subscribeMuted } from "./soundSettings.js";

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
  laser: "Laser Pointer2.mp3"
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
  if (!SOUND_FILES[key] || getMuted()) return;
  const instance = getBaseAudio(key).cloneNode();
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
  if (getMuted()) return;
  const audio = getClockAudio();
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function stopClockTick() {
  if (!clockAudio) return;
  clockAudio.pause();
  clockAudio.currentTime = 0;
}

// The clock tick is the one looping (not one-shot) sound, so muting mid-
// countdown needs to actively cut it off rather than just suppressing future
// plays — otherwise it would keep looping until the countdown itself ends.
subscribeMuted(muted => {
  if (muted) stopClockTick();
});
