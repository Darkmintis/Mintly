/**
 * In-memory sliding-window rate limiting, per Worker isolate.
 *
 * Same trade-off as any isolate-local limiter: counters reset when an isolate
 * is recycled, which allows a short burst but not sustained abuse. For Mintly's
 * threat model (spam counts, not security) that is the right trade: no KV/D1
 * writes on the ingest hot path.
 */

const store = new Map();
let requestsSinceCleanup = 0;
const CLEANUP_EVERY = 200;

function cleanup(now) {
  for (const [key, entry] of store) {
    if (now - entry.windowStart > entry.windowMs) store.delete(key);
  }
}

/**
 * @param {string} key - limiter bucket, e.g. "ingest:app:ip"
 * @param {number} limit - max requests per window
 * @param {number} windowMs - window length in milliseconds
 * @returns {{allowed:boolean,remaining:number,retryAfter:number}}
 */
export function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  requestsSinceCleanup += 1;
  if (requestsSinceCleanup >= CLEANUP_EVERY) {
    requestsSinceCleanup = 0;
    cleanup(now);
  }

  const entry = store.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now, windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, retryAfter: 0 };
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}
