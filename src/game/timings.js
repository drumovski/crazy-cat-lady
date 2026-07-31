// Fixed timing constants shared by local hotseat (App.jsx, driving its own
// setTimeouts) and online play (server/rooms.js, authoritative for timing
// since the server drives the real game state). Unlike blockTimer.js's
// value, these aren't player-configurable — they're pacing/drama beats the
// game always uses, so both sides just need to agree on the same numbers
// rather than validate an incoming one. Centralized here (instead of two
// copies with a "keep these in sync" comment) so a future change only
// happens in one place — including any card-fly-animation duration this
// grows to cover once Framer Motion is wired in.
export const AI_THINK_DELAY_MS = 700;
export const LASER_REVEAL_DELAY_MS = 2000;
