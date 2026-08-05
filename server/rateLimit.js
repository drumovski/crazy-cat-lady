// Minimal in-memory, fixed-window rate limiter — no dependency, same
// hand-rolled-Map-plus-periodic-sweep pattern rooms.js already uses for its
// own room store/abandoned-room cleanup. Fixed-window (not sliding/token
// bucket) is a deliberate simplicity trade-off: it can allow up to 2x `max`
// requests across a window boundary in the worst case, which is fine here —
// the goal is capping obvious abuse (a scripted flood loop), not precise
// fairness against a determined attacker.
const buckets = new Map(); // key -> { count, windowStart }

export function isRateLimited(key, { max, windowMs }) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }

  bucket.count++;
  return bucket.count > max;
}

// Without this, `buckets` would grow forever — every distinct key ever seen
// (one per IP/socket-id combination that ever called a limited action)
// stays in memory otherwise. Swept independently of any particular window
// length used by a caller, same "good enough, not exact" trade-off as above.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const STALE_AFTER_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > STALE_AFTER_MS) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();
