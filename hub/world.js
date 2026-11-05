'use strict';
// The world, in RAM only: islands -> devices -> last filtered snapshot. Never written to disk or logs.
// createWorld({now, onChange}); onChange gets {type:'world'} | {type:'island', id} | {type:'remove', id}.
//   publish(island{id,name,color}, deviceId, share, value) -> {accepted}
//   removeDevice(deviceId), removeIsland(id), snapshotFor(id) -> ClientSession[], islands() -> IslandMeta[], tick()
//   devicesOf(islandId) -> [{deviceId, online, share, private}]   setIslandMeta(id, {name, color})

const OFFLINE_MS = 90 * 1000;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Room label for the n-th (machine, letter) pair: A..Z, then A2..Z2, A3.. (never wraps back to A).
const roomLabel = (n) => LETTERS[n % 26] + (n >= 26 ? String(Math.floor(n / 26) + 1) : '');
const LETTER_RE = /^[A-P]$/;

function createWorld({ now = Date.now, onChange = () => {} } = {}) {
  const islands = new Map(); // id -> {id, name, color, devices: Map(deviceId -> dev), last}
  const deviceIsland = new Map(); // deviceId -> island id
  const emit = (e) => { try { onChange(e); } catch { /* a listener must not break the world */ } };
  const online = (d) => now() - d.lastAt <= OFFLINE_MS;

  function metaOf(isl) {
    const on = [...isl.devices.values()].filter(online);
    const anyKin = on.some((d) => d.share === 'kin');
    return {
      id: isl.id, name: isl.name, color: isl.color, online: on.length > 0,
      private: on.length > 0 && on.every((d) => d.private),
      share: anyKin || !on.length ? 'kin' : 'co-ban', // strictest of the online machines
    };
  }

  // B5: rooms are per machine. Letter labels (kin, or co-ban without a project name) are re-assigned over the
  // whole island by (machine, letter) in a fixed order; project names stay as they are.
  function sessionsOf(isl) {
    const devs = [...isl.devices.entries()].filter(([, d]) => online(d));
    const label = new Map();
    let n = 0;
    for (const [id, d] of devs) {
      const used = [...new Set(d.sessions.filter((s) => LETTER_RE.test(s.dept)).map((s) => s.dept))].sort();
      for (const l of used) label.set(id + '|' + l, roomLabel(n++));
    }
    const seen = new Set();
    const out = [];
    for (const [id, d] of devs) {
      for (const s of d.sessions) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        const c = {
          id: s.id, parentId: s.parent, status: s.status, waitingOn: s.waitingOn, talkingTo: s.talkingTo,
          project: LETTER_RE.test(s.dept) ? label.get(id + '|' + s.dept) : s.dept, kind: s.kind,
        };
        if (s.tool !== undefined) c.tool = s.tool;
        if (s.model !== undefined) c.model = s.model;
        out.push(c);
      }
    }
    return out;
  }

  // Compares with what viewers last heard and emits only what changed.
  function refresh(isl) {
    const meta = JSON.stringify(metaOf(isl));
    const snap = JSON.stringify(sessionsOf(isl));
    const prev = isl.last;
    isl.last = { meta, snap };
    if (!prev || prev.meta !== meta) emit({ type: 'world' });
    if (!prev || prev.snap !== snap) emit({ type: 'island', id: isl.id });
  }

  return {
    publish(island, deviceId, share, value) {
      let isl = islands.get(island.id);
      const known = isl && isl.devices.get(deviceId);
      if (known && value.seq < known.seq && value.seq !== 0) return { accepted: false };
      const moved = deviceIsland.get(deviceId);
      if (moved && moved !== island.id) this.removeDevice(deviceId);
      isl = islands.get(island.id);
      if (!isl) { isl = { id: island.id, name: island.name, color: island.color, devices: new Map(), last: null }; islands.set(isl.id, isl); }
      isl.name = island.name; isl.color = island.color;
      isl.devices.set(deviceId, {
        share: share === 'co-ban' ? 'co-ban' : 'kin', private: !!value.private, seq: value.seq, lastAt: now(),
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
      if (!isl) return;
      for (const d of isl.devices.keys()) deviceIsland.delete(d);
      islands.delete(id);
      emit({ type: 'remove', id });
      emit({ type: 'world' });
    },
    devicesOf(id) {
      const isl = islands.get(id);
      return isl ? [...isl.devices.entries()].map(([deviceId, d]) => ({ deviceId, online: online(d), share: d.share, private: d.private })) : [];
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
