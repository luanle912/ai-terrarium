'use strict';
// The world, in RAM only: islands -> devices -> last filtered snapshot. Never written to disk or logs.
// createWorld({now, onChange}); onChange gets {type:'world'} | {type:'island', id} | {type:'remove', id}.
//   publish(island{id,name,color,slot}, deviceId, share, value, {instance = null} = {})
//     -> {accepted: true} | {accepted: false, reason: 'stale_seq', seq} | {accepted: false, reason: 'other_instance'}
//     One publishing instance holds each device (`instance || 'legacy'`). Another instance takes over only with seq 0
//     (a process that just started: the newest one wins) or once the holder has been silent OFFLINE_MS.
//   removeDevice(deviceId), removeIsland(id) (always emits remove + world, even when the island is not in RAM), snapshotFor(id) -> ClientSession[], islands() -> IslandMeta[], tick()
//   devicesOf(islandId) -> [{deviceId, online, share, private, lastAt}]   setIslandMeta(id, {name, color})

const OFFLINE_MS = 90 * 1000;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Room label for the n-th (machine, letter) pair: A..Z, then A2..Z2, A3.. (never wraps back to A).
const roomLabel = (n) => LETTERS[n % 26] + (n >= 26 ? String(Math.floor(n / 26) + 1) : '');
const LETTER_RE = /^[A-P]$/;

const LAST_AT_STEP_MS = 15000;

function createWorld({ now = Date.now, onChange = () => {} } = {}) {
  const islands = new Map(); // id -> {id, name, color, slot, devices: Map(deviceId -> dev), labels, nextLabel, last}
  const deviceIsland = new Map(); // deviceId -> island id
  const emit = (e) => { try { onChange(e); } catch { /* a listener must not break the world */ } };
  const online = (d) => now() - d.lastAt <= OFFLINE_MS;

  function metaOf(isl) {
    const on = [...isl.devices.values()].filter(online);
    const anyKin = on.some((d) => d.share === 'kin');
    return {
      id: isl.id, name: isl.name, color: isl.color, slot: isl.slot, online: on.length > 0,
      private: on.length > 0 && on.every((d) => d.private),
      share: anyKin || !on.length ? 'kin' : 'co-ban', // strictest of the online machines
      // When a machine of this island was last heard (ms), online or not; null with no machine in RAM.
      lastAt: isl.devices.size ? Math.max(...[...isl.devices.values()].map((d) => d.lastAt)) : null,
    };
  }

  // B5: rooms are per machine. Letter labels (kin, or co-ban without a project name) are given per island to each
  // (machine, letter) pair the first time it is seen, in machine then letter order; project names stay as they are.
  // H5: a label is never given again or renumbered, so a machine going offline (or coming back) does not move the
  // other machine's rooms. The labels live as long as the island stays in RAM.
  function sessionsOf(isl) {
    const devs = [...isl.devices.entries()].filter(([, d]) => online(d));
    for (const [id, d] of devs) {
      const used = [...new Set(d.sessions.filter((s) => LETTER_RE.test(s.dept)).map((s) => s.dept))].sort();
      for (const l of used) if (!isl.labels.has(id + '|' + l)) isl.labels.set(id + '|' + l, isl.nextLabel++);
    }
    const seen = new Set();
    const out = [];
    for (const [id, d] of devs) {
      for (const s of d.sessions) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        const c = {
          id: s.id, parentId: s.parent, status: s.status, waitingOn: s.waitingOn, talkingTo: s.talkingTo,
          project: LETTER_RE.test(s.dept) ? roomLabel(isl.labels.get(id + '|' + s.dept)) : s.dept, kind: s.kind,
        };
        if (s.tool !== undefined) c.tool = s.tool;
        if (s.model !== undefined) c.model = s.model;
        out.push(c);
      }
    }
    return out;
  }

  // Compares with what viewers last heard and emits only what changed. lastAt is compared in LAST_AT_STEP_MS steps:
  // a publish that only moves it is not a world change (no world event, so no slot read from the database), yet a
  // live island's lastAt still reaches viewers every step; the payload itself always reads the exact value from RAM.
  function refresh(isl) {
    const m = metaOf(isl);
    const meta = JSON.stringify({ ...m, lastAt: m.lastAt == null ? null : Math.floor(m.lastAt / LAST_AT_STEP_MS) });
    const snap = JSON.stringify(sessionsOf(isl));
    const prev = isl.last;
    isl.last = { meta, snap };
    if (!prev || prev.meta !== meta) emit({ type: 'world' });
    if (!prev || prev.snap !== snap) emit({ type: 'island', id: isl.id });
  }

  return {
    publish(island, deviceId, share, value, { instance = null } = {}) {
      const key = instance || 'legacy';
      let isl = islands.get(island.id);
      const dev = isl && isl.devices.get(deviceId);
      if (dev && dev.instance !== key) {
        if (value.seq !== 0 && now() - dev.lastAt < OFFLINE_MS) return { accepted: false, reason: 'other_instance' };
      } else if (dev && value.seq < dev.seq && value.seq !== 0) {
        return { accepted: false, reason: 'stale_seq', seq: dev.seq };
      }
      const moved = deviceIsland.get(deviceId);
      if (moved && moved !== island.id) this.removeDevice(deviceId);
      isl = islands.get(island.id);
      if (!isl) { isl = { id: island.id, name: island.name, color: island.color, slot: island.slot, devices: new Map(), labels: new Map(), nextLabel: 0, last: null }; islands.set(isl.id, isl); }
      isl.name = island.name; isl.color = island.color; isl.slot = island.slot;
      isl.devices.set(deviceId, {
        share: share === 'co-ban' ? 'co-ban' : 'kin', private: !!value.private, seq: value.seq, lastAt: now(), instance: key,
        sessions: value.private ? [] : value.sessions,
      });
      deviceIsland.set(deviceId, isl.id);
      refresh(isl);
      return { accepted: true };
    },
    removeDevice(deviceId) {
      const id = deviceIsland.get(deviceId);
      deviceIsland.delete(deviceId);
      const isl = id && islands.get(id);
      if (!isl) return;
      isl.devices.delete(deviceId);
      if (isl.devices.size === 0) { islands.delete(id); emit({ type: 'remove', id }); emit({ type: 'world' }); } else refresh(isl);
    },
    removeIsland(id) {
      const isl = islands.get(id);
      if (isl) { for (const d of isl.devices.keys()) deviceIsland.delete(d); islands.delete(id); }
      emit({ type: 'remove', id });
      emit({ type: 'world' });
    },
    devicesOf(id) {
      const isl = islands.get(id);
      return isl ? [...isl.devices.entries()].map(([deviceId, d]) => ({ deviceId, online: online(d), share: d.share, private: d.private, lastAt: d.lastAt })) : [];
    },
    setIslandMeta(id, { name, color }) {
      const isl = islands.get(id);
      if (!isl) return;
      isl.name = name; isl.color = color;
      refresh(isl); // emits `world` only when the meta really changed
    },
    snapshotFor(id) { const isl = islands.get(id); return isl ? sessionsOf(isl) : []; },
    islands() { return [...islands.values()].map(metaOf); },
    tick() { for (const isl of islands.values()) refresh(isl); },
  };
}

module.exports = { createWorld, OFFLINE_MS, roomLabel };
