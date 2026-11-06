// How old what an island shows is, and which row of the connection legend the link is in. DOM-free so
// tests/world-logic.test.mjs can run it; WorldLogic (world-logic.js) re-exports all of it.
export const WorldFresh = (() => {
  // Under FRESH_MS since the island's machine last sent, the island is live; from there it fades until
  // OFFLINE_AFTER_MS (the hub's own offline limit) to OFFLINE_ALPHA, the look of an offline island.
  const FRESH_MS = 45000,
    OFFLINE_AFTER_MS = 90000,
    OFFLINE_ALPHA = 0.65;
  const num = v => typeof v === 'number' && Number.isFinite(v);
  // lastAt and hubNow are hub-clock ms from the world frame; recvAt and nowMs are the viewer's clock (when the frame
  // arrived, and now), so only their difference counts and a wrong viewer clock changes nothing. Without lastAt or
  // hubNow (an older hub) the age is unknown and the island looks as its online flag says.
  function freshness(lastAt, hubNow, recvAt, nowMs, online) {
    if (!num(lastAt) || !num(hubNow))
      return { ageMs: null, alpha: online === false ? OFFLINE_ALPHA : 1, bucket: 'unknown' };
    const ageMs = Math.max(0, hubNow - lastAt + (num(nowMs) && num(recvAt) ? Math.max(0, nowMs - recvAt) : 0));
    if (ageMs < FRESH_MS) return { ageMs, alpha: 1, bucket: 'live' };
    if (ageMs <= OFFLINE_AFTER_MS) {
      const k = (ageMs - FRESH_MS) / (OFFLINE_AFTER_MS - FRESH_MS);
      return { ageMs, alpha: 1 - k * (1 - OFFLINE_ALPHA), bucket: 'aging' };
    }
    return { ageMs, alpha: OFFLINE_ALPHA, bucket: 'offline' };
  }
  // The legend row the link is in: yellow while reconnecting, red while the hub does not answer, refuses the stream or
  // is busy; none while live.
  const legendRow = phase =>
    phase === 'reconnecting'
      ? 'reconnecting'
      : phase === 'down' || phase === 'refused' || phase === 'busy'
        ? 'down'
        : null;
  // The connection chip's dot: the same colour as the legend row that is lit (yellow reconnecting, red down), green
  // when live, yellow while the first connect is on the way.
  const chipTone = (conn, phase) => {
    const row = phase ? legendRow(phase) : null;
    if (row) return row === 'reconnecting' ? 'warn' : 'bad';
    return conn === 'ok' ? 'ok' : conn === 'connecting' ? 'warn' : 'bad';
  };
  return { FRESH_MS, OFFLINE_AFTER_MS, OFFLINE_ALPHA, freshness, legendRow, chipTone };
})();
