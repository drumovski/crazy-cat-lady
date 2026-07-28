// How long a Fish/Catnip target has to respond with a Seagull/Snail before
// it auto-resolves unblocked (GameBoard's countdown). Chosen once by the
// game creator (SetupScreen for local hotseat, OnlineSetup for online) and
// shared here so both pickers — and the server's validation of the online
// one — stay in sync. `null` means no timer: the target can block whenever
// they're ready.
export const BLOCK_TIMER_MIN = 4;
export const BLOCK_TIMER_MAX = 20;
export const DEFAULT_BLOCK_TIMER_SECONDS = 10;

export function isValidBlockTimerSeconds(value) {
  return value === null || (Number.isInteger(value) && value >= BLOCK_TIMER_MIN && value <= BLOCK_TIMER_MAX);
}
