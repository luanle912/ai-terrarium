// "Máy này" on the local page: what this machine's publisher is doing, read from /api/public-preview. DOM-free so
// tests/world-logic.test.mjs can run it; WorldLogic (world-logic.js) re-exports all of it.
export const WorldPill = (() => {
  // Tone of each publisher state (the dot colour and whether the error line shows):
  //   sending                      ok     green, the island is on the hub
  //   connecting, paused           warn   amber, on the way or waiting for the owner (sign in to the hub again)
  //   standby, private, off        muted  grey, nothing is wrong (another copy sends, or nothing is shared)
  //   offline, rejected, revoked   bad    red, sends fail or the hub said no
  // An unknown state (a newer server) is muted.
  const TONES = {
    sending: 'ok',
    connecting: 'warn',
    paused: 'warn',
    standby: 'muted',
    private: 'muted',
    off: 'muted',
    offline: 'bad',
    rejected: 'bad',
    revoked: 'bad',
  };
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  // A field an older local server does not send reads as null (failures as 0); never throws.
  function pillView(p, nowMs) {
    if (!p || typeof p !== 'object' || typeof p.state !== 'string' || !p.state) return null;
    const lastOk = num(p.lastOkAt),
      next = num(p.nextRetryAt);
    const e = p.lastErr;
    const err =
      e && typeof e === 'object' && typeof e.code === 'string' && e.code
        ? { code: e.code, reason: typeof e.reason === 'string' && e.reason ? e.reason : null }
        : null;
    const f = num(p.failures);
    return {
      state: p.state,
      tone: TONES[p.state] || 'muted',
      ageMs: lastOk == null ? null : Math.max(0, nowMs - lastOk),
      retryInMs: next == null ? null : Math.max(0, next - nowMs),
      err,
      failures: f != null && f > 0 ? Math.floor(f) : 0,
    };
  }
  // "4 s", "3 min", "2 h" ago: the unit picks the world.ago.* string.
  function agoParts(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return { unit: 's', n: s };
    if (s < 3600) return { unit: 'm', n: Math.floor(s / 60) };
    return { unit: 'h', n: Math.floor(s / 3600) };
  }
  // The chip opens the hub on this machine's island when the server names it (a 16-hex device id).
  const deviceLink = (hub, deviceId) =>
    typeof deviceId === 'string' && /^[0-9a-f]{16}$/.test(deviceId) ? hub + '#this-device=' + deviceId : hub;
  // The error line as parts (world.pill.<part> keys), joined with ' · ': the code; the wait only when a retry is
  // planned (none while paused for a sign-in), "retrying" once it is due; the failure count when there is one.
  function failParts(v) {
    if (!v || !v.err) return [];
    const out = [['error', { code: v.err.code }]];
    if (typeof v.retryInMs === 'number')
      out.push(v.retryInMs > 0 ? ['retryIn', { s: String(Math.ceil(v.retryInMs / 1000)) }] : ['retrying', {}]);
    if (v.failures > 0) out.push(['times', { n: String(v.failures) }]);
    return out;
  }
  return { pillView, agoParts, deviceLink, failParts };
})();
