'use strict';
// Token-bucket rate limiter. rate = tokens per second, burst = bucket size.
// take(key, now = Date.now()) returns true when the request may proceed.

function createLimiter({ rate, burst }) {
  const buckets = new Map();
  const MAX_KEYS = 50000;
  return {
    take(key, now = Date.now()) {
      let b = buckets.get(key);
      if (!b) {
        if (buckets.size >= MAX_KEYS) { // bound memory: drop buckets that have refilled to full
          for (const [k, v] of buckets) if (v.tokens + (now - v.at) / 1000 * rate >= burst) buckets.delete(k);
          if (buckets.size >= MAX_KEYS) buckets.clear();
        }
        b = { tokens: burst, at: now };
        buckets.set(key, b);
      }
      b.tokens = Math.min(burst, b.tokens + Math.max(0, now - b.at) / 1000 * rate);
      b.at = now;
      if (b.tokens >= 1) { b.tokens -= 1; return true; }
      return false;
    },
    size: () => buckets.size,
  };
}

module.exports = { createLimiter };
