// The viewer's link to the hub and who walked out of an island, DOM-free so tests/world-logic.test.mjs can run it.
// WorldLogic (world-logic.js) re-exports all of it.
export const WorldLink = (() => {
  // Stream watchdog: the hub sends a named `ping` every 25 s. Only once one has arrived (old hubs send a bare comment,
  // which a page cannot see) does silence for PING_STALE_MS mean the stream froze.
  const PING_STALE_MS = 40000;
  const streamStale = ({ pingSeen, lastEventAt, now }) => !!pingSeen && now - lastEventAt >= PING_STALE_MS;
  // Agents that walked out: 'done' (a finished sub-agent) is skipped while still listed and forgotten once it leaves
  // the list; 'missing' (it left because it was no longer listed) is never skipped, so it comes back when listed again.
  function goneStep(gone, listed) {
    const skip = new Set(),
      next = new Map();
    for (const [sid, why] of gone)
      if (why === 'done' && listed.has(sid)) {
        skip.add(sid);
        next.set(sid, why);
      }
    return { skip, gone: next };
  }

  // The viewer's link to the hub. A lost stream is reopened by the page itself (the browser's own retry is not used):
  // after 1, 2, 4, 8, 16, then every 30 s (±20 %), or after exactly the hub's retryMs when it said `restarting`
  // before closing. Each loss asks /api/config why ('probe'): signed out or no longer world mode reloads the page; the
  // hub answering while the stream keeps closing (a proxy's 502 during a restart) just connects again, and only after
  // REFUSED_AFTER closes in a row shows "refused", still retrying every DOWN_CAP_MS; no answer is 'down'; 429 is 'busy'
  // until its Retry-After. Waking up, going online or the tab becoming visible connects at once. The islands stay on
  // screen (dimmed) while the link is not live, and are wiped only after KEEP_STALE_MS without a connection.
  // dueAt: when the planned connect fires; stale: reopens in a row that saw no named event (a hub that accepts the
  // stream and then says nothing), which pushes the next reopen further out until something is heard ('heard').
  const RECONNECT_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
  const DOWN_CAP_MS = 60000,
    REFUSED_AFTER = 5,
    WAKE_JUMP_MS = 15000,
    WAKE_QUIET_MS = 30000,
    KEEP_STALE_MS = 300000;
  const reconnectDelay = (attempt, rand) =>
    RECONNECT_STEPS_MS[Math.min(Math.max(0, attempt | 0), RECONNECT_STEPS_MS.length - 1)] * (0.8 + 0.4 * rand);
  const linkStart = () => ({ phase: 'live', attempt: 0, closes: 0, staleSince: null, dueAt: null, stale: 0 });
  function linkStep(link, ev, now, rand) {
    const l = { ...link },
      act = { connectIn: null, probe: false, reload: false, wipe: false, close: false };
    const plan = ms => {
      act.connectIn = Math.max(0, ms);
      l.dueAt = now + act.connectIn;
    };
    const live = l.phase === 'live';
    switch (ev && ev.type) {
      case 'open':
        Object.assign(l, { phase: 'live', attempt: 0, closes: 0, staleSince: null, dueAt: null });
        break;
      case 'heard':
        l.stale = 0;
        break;
      case 'error':
      case 'closed':
        if (live) l.phase = 'reconnecting';
        if (l.staleSince == null) l.staleSince = now;
        if (ev.type === 'closed') l.closes++;
        if (ev.stale) l.stale++;
        act.probe = true;
        plan(reconnectDelay(l.attempt + l.stale, rand));
        l.attempt++;
        break;
      case 'restarting': {
        const ms = Number(ev.retryMs);
        l.phase = 'reconnecting';
        if (l.staleSince == null) l.staleSince = now;
        plan(Number.isFinite(ms) ? Math.min(DOWN_CAP_MS, Math.max(1000, ms)) : 1000);
        break;
      }
      case 'probe':
        if (live) break; // the stream came back before the answer
        if (ev.kind === 'signedout' || ev.kind === 'other') act.reload = true;
        else if (ev.kind === 'world') {
          if (l.closes >= REFUSED_AFTER) {
            l.phase = 'refused';
            plan(DOWN_CAP_MS);
          } else {
            l.phase = 'reconnecting';
            plan(l.dueAt == null ? 0 : l.dueAt - now);
          }
        } else if (ev.kind === 'busy') {
          l.phase = 'busy';
          plan(ev.retryS > 0 ? ev.retryS * 1000 : reconnectDelay(l.attempt, rand));
        } else {
          l.phase = 'down';
          plan(Math.min(DOWN_CAP_MS, reconnectDelay(l.attempt, rand)));
        }
        break;
      case 'wake':
      case 'online':
      case 'visible':
        if (!live) {
          l.attempt = 0;
          plan(0);
        }
        // A stream that died while the machine slept can still look open; only a visible tab acts on it, since a
        // background tab throttled to one tick a minute looks like a wake on every tick, and only when nothing has
        // arrived for WAKE_QUIET_MS on the wall clock (quietMs): a tab shown after a long hide has a healthy stream.
        else if (ev.type === 'wake' && ev.visible && !(ev.quietMs <= WAKE_QUIET_MS)) {
          l.phase = 'reconnecting';
          if (l.staleSince == null) l.staleSince = now;
          act.close = true;
          plan(0);
        }
        break;
    }
    act.wipe = l.phase !== 'live' && l.staleSince != null && now - l.staleSince >= KEEP_STALE_MS;
    return { link: l, act };
  }

  // A finished sub-agent leaves once it has been 'done' for more than DONE_LEAVE_MS.
  const DONE_LEAVE_MS = 3000;
  const doneDue = (a, now) => !!(a && a.parent && a.status === 'done' && a.doneAt && now - a.doneAt > DONE_LEAVE_MS);
  // A hidden tab runs no walking animation, so whoever leaves is gone at once: their desk is free for the next
  // session.
  const leaveGone = visibility => visibility === 'hidden';
  return {
    PING_STALE_MS,
    streamStale,
    goneStep,
    RECONNECT_STEPS_MS,
    DOWN_CAP_MS,
    REFUSED_AFTER,
    WAKE_JUMP_MS,
    WAKE_QUIET_MS,
    KEEP_STALE_MS,
    reconnectDelay,
    linkStart,
    linkStep,
    DONE_LEAVE_MS,
    doneDue,
    leaveGone,
  };
})();
