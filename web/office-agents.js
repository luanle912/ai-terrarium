import { tr } from './i18n.js';
import { WorldLogic } from './world-logic.js';
import { DogLogic } from './dog-logic.js';
import { PeopleLogic } from './people-logic.js';
import { RestroomLogic } from './restroom-logic.js';
import { SeasonLogic } from './season-logic.js';
import { PropUse } from './prop-use.js';
import { DEPT_PAL, DESKS, DOOR, H, IDLE_SPOTS, LAWN_WALK, SIM_DEPTS, W, colOf } from './office-scene.js';
import { ERRS, PERM, ST, TALK, TOOLS, bfs, clock, cwdKey, pick, rnd, shortOf, startCell } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';
// Agents: the simulated office and the live feed, desks and departments, where each agent goes next.
mixin(
  ClaudeOffice,
  class {
    startSource() {
      this.es && this.es.close();
      this.es = null;
      this.agents = [];
      this.goneSids = new Map();
      this.depts = new Map();
      this.firstSnap = true;
      this.stopOthers();
      if (this.isLive) {
        const url = this.state.endpoint || 'http://localhost:4317/events';
        this.setState({ live: 'connecting', sel: null });
        try {
          const es = new EventSource(url);
          this.es = es;
          es.onopen = () => this.setState({ live: 'ok' });
          es.onerror = () => this.setState({ live: 'error' });
          es.onmessage = e => {
            if (this.state.asOthers) return;
            try {
              this.syncLive(JSON.parse(e.data));
              this.state.live !== 'ok' && this.setState({ live: 'ok' });
            } catch (err) {}
          };
        } catch (e) {
          this.setState({ live: 'error' });
        }
        if (this.state.asOthers) this.pollOthers();
      } else {
        this.setState({ live: 'off', sel: null });
        const n = this.state.agentCount;
        for (let i = 0; i < n; i++) this.addAgent({ seated: true });
      }
    }

    // "Xem như người khác": the island is fed from the same public view the hub would get (Kín or Cơ bản) instead of
    // the full local stream, so the owner sees exactly what others see. Polled once a second; stale answers are
    // dropped.
    stopOthers() {
      clearInterval(this.othersTimer);
      this.othersTimer = null;
      this.othersGen = (this.othersGen || 0) + 1;
      this.raw = new Map();
      this.noUsage = false;
    }
    pollOthers() {
      const gen = this.othersGen;
      this.noUsage = true; // the hub view carries no 5H / 7D usage, so the wall bars go off like in the world
      const tick = () =>
        fetch('/api/public-preview', { cache: 'no-store' })
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null)
          .then(d => {
            if (gen !== this.othersGen || !d || !d.view || !Array.isArray(d.view.sessions)) return;
            const ss = WorldLogic.clientSessions(d.view.sessions);
            this.raw = new Map(ss.map(x => [x.id, x]));
            this.syncLive({ sessions: ss });
            const sh = d.share === 'co-ban' ? 'co-ban' : 'kin';
            if (this.state.othersShare !== sh) this.setState({ othersShare: sh });
          });
      tick();
      this.othersTimer = setInterval(tick, 1000);
    }

    dept(key, label) {
      if (!this.depts.has(key))
        this.depts.set(key, {
          key,
          label: label || shortOf(key),
          color: DEPT_PAL[this.depts.size % DEPT_PAL.length],
          n: 0,
        });
      return this.depts.get(key);
    }
    colOwners() {
      // Keys are project names, possibly other people's ("__proto__"), so the maps have no prototype.
      const cnt = [0, 1, 2, 3].map(() => Object.create(null));
      this.agents.forEach(a => {
        if (a.gone || a.leaving) return;
        const c = colOf(a.desk);
        if (c < 4) cnt[c][a.dept] = (cnt[c][a.dept] || 0) + 1;
      });
      return cnt.map(o => {
        let best = null,
          b = 0;
        for (const k in o)
          if (o[k] > b) {
            b = o[k];
            best = k;
          }
        return best;
      });
    }
    freeDeskFor(dk) {
      const used = new Set(this.agents.filter(a => !a.gone).map(a => a.desk)),
        own = this.colOwners();
      const free = DESKS.map((_, i) => i).filter(i => !used.has(i));
      return free.find(i => own[colOf(i)] === dk) ?? free.find(i => own[colOf(i)] == null) ?? free[0] ?? -1;
    }
    freeDesk() {
      const used = new Set(this.agents.filter(a => !a.gone).map(a => a.desk));
      for (let i = 0; i < DESKS.length; i++) if (!used.has(i)) return i;
      return -1;
    }

    addAgent({ seated, parent, live, deptKey }) {
      let dk;
      if (parent) dk = parent.dept;
      else if (live) {
        const p = live.parentId && this.agents.find(x => x.sid === live.parentId);
        const own = live.project || cwdKey(live.cwd) || live.name;
        dk = p ? p.dept : (own ? this.dept(own) : this.dept(tr('office.dept.other'), tr('office.dept.otherShort'))).key;
      } else {
        dk = deptKey;
        if (!dk) {
          const c = SIM_DEPTS.map(([k, l]) => [
            this.dept(k, l),
            this.agents.filter(a => a.dept === k && !a.leaving && !a.parent).length,
          ]);
          const min = Math.min(...c.map(x => x[1]));
          const pool = c.filter(x => x[1] <= min + 1);
          dk = pick(pool)[0].key;
        }
      }
      const Dp = this.dept(dk);
      const desk = parent ? parent.desk : this.freeDeskFor(dk);
      if (desk < 0) return null;
      const num = parent ? 0 : ++Dp.n;
      const d = DESKS[desk],
        id = ++this.seq,
        now = Date.now();
      // Man or woman and the whole look come from the session id (PeopleLogic), so a reload never changes anyone.
      const sid = live ? live.id : 'sess_' + Math.random().toString(36).slice(2, 10),
        look = PeopleLogic.look(sid);
      const a = {
        id,
        desk,
        parent: parent ? parent.id : null,
        dept: dk,
        name: live
          ? (live.name || dk) + (parent || live.parentId ? ' · sub-agent' : '')
          : parent
            ? parent.short.toLowerCase() + '-subagent'
            : dk + ' #' + num,
        short: parent ? parent.short.slice(0, 3) + '·' : Dp.label + (num || ''),
        gender: look.gender,
        look,
        skin: look.skin,
        hair: look.hair,
        acc: look.acc,
        pants: look.legs,
        shirt: Dp.color,
        sid,
        model: live ? live.model || '—' : Math.random() < 0.6 ? 'claude-sonnet' : 'claude-opus',
        cwd: live ? live.cwd || '—' : '~/code/' + dk,
        status: seated && !parent ? 'working' : 'entering',
        tool: pick(TOOLS),
        msg: '',
        target: null,
        tokens: Math.floor(rnd(2000, 40000)),
        hist: [],
        until: now + rnd(500, 4000),
        jobs: parent ? Math.floor(rnd(2, 5)) : 0,
        leaving: false,
        sleeping: false,
        x: seated && !parent ? d.gx + 1 : DOOR.pt[0],
        y: seated && !parent ? d.gy + 1.45 : DOOR.pt[1],
        path: [],
        goalKey: seated && !parent ? 'seat' : null,
        moving: false,
        dirFront: true,
        seated: !parent && !!seated,
        idleSpot: null,
        stool: false,
        actNow: null,
      };
      this.agents.push(a);
      this.log(
        a,
        parent
          ? tr('office.log.spawnedBy', { parent: parent.short })
          : seated
            ? tr('office.log.running')
            : tr('office.log.sessionStarted'),
      );
      return a;
    }
    log(a, text) {
      a.hist.unshift({ t: clock(), text });
      if (a.hist.length > 7) a.hist.pop();
    }
    byId(id) {
      return this.agents.find(a => a.id === id);
    }
    leave(a, why = 'missing') {
      if (a.leaving) return;
      a.leaving = true;
      a.leftWhy = why;
      a.status = 'leaving';
      this.log(a, tr('office.log.sessionEnded'));
      if (WorldLogic.leaveGone(document.visibilityState)) a.gone = true;
    }
    // Finished sub-agents walk out 3 s after their 'done' (called from frame and from the hidden-tab timer).
    doneSweep(now) {
      for (const a of this.agents) if (WorldLogic.doneDue(a, now)) this.leave(a, 'done');
    }
    setWork(a) {
      a.status = 'working';
      a.target = null;
      a.tool = pick(TOOLS);
      a.until = Date.now() + rnd(2500, 6500) / this.speed;
      this.log(a, a.tool[0] + ' · ' + a.tool[1]);
    }

    simTick() {
      if (this.state.paused || this.isLive) return;
      const now = Date.now(),
        sp = this.speed;
      for (const a of [...this.agents]) {
        if (a.leaving) continue;
        if (a.status === 'working') a.tokens += Math.floor(rnd(20, 120));
        if (a.status === 'entering') {
          if (a.seated) this.setWork(a);
          continue;
        }
        if (a.waitSub) {
          const s = this.byId(a.waitSub);
          if (!s || s.leaving) {
            a.waitSub = null;
            this.log(a, tr('office.log.subagentReturned'));
            this.setWork(a);
          }
          continue;
        }
        if (now < a.until) continue;
        const s = a.status;
        if (s === 'talking' || s === 'waiting') {
          this.log(a, tr('office.log.backToDesk'));
          this.setWork(a);
          continue;
        }
        if (s === 'permission') {
          this.log(a, this.state.autoApprove ? tr('office.log.autoApproved') : tr('office.log.approvalTimedOut'));
          this.setWork(a);
          continue;
        }
        if (s === 'error') {
          this.log(a, tr('office.log.fixAndRetry'));
          this.setWork(a);
          continue;
        }
        if (a.parent) {
          if (s === 'done') {
            this.leave(a);
            continue;
          }
          if (--a.jobs <= 0) {
            a.status = 'done';
            a.until = now + 2200 / sp;
            this.log(a, tr('office.log.doneReportTo', { parent: (this.byId(a.parent) || {}).short }));
            continue;
          }
        }
        const all = this.agents.filter(o => o !== a && !o.leaving && o.status !== 'entering'),
          mates = all.filter(o => o.dept === a.dept);
        const others = mates.length && Math.random() < 0.55 ? mates : all;
        const r = Math.random();
        if (r < 0.36) this.setWork(a);
        else if (r < 0.48) {
          a.status = 'thinking';
          a.until = now + rnd(2000, 4000) / sp;
        } else if (r < 0.61 && others.length && !a.parent) {
          const t = pick(others);
          a.status = 'talking';
          a.target = t.id;
          a.msg = pick(TALK);
          a.until = now + rnd(7000, 10000) / sp;
          this.log(a, tr('office.log.visitDesk', { name: t.short, topic: a.msg }));
        } else if (r < 0.68 && others.length && !a.parent) {
          const t = pick(others);
          a.status = 'waiting';
          a.target = t.id;
          a.msg = tr('office.sim.waitOutput', { name: t.short });
          a.until = now + rnd(8000, 12000) / sp;
          this.log(a, tr('office.log.goWait', { name: t.short }));
        } else if (r < 0.75) {
          a.status = 'permission';
          a.msg = pick(PERM);
          a.until = now + (this.state.autoApprove ? 2500 : 14000) / sp;
          this.log(a, tr('office.log.askPermission', { request: a.msg }));
        } else if (r < 0.81) {
          a.status = 'error';
          a.msg = pick(ERRS);
          a.until = now + 2600 / sp;
          this.log(a, tr('office.log.error', { error: a.msg }));
        } else if (r < 0.87) {
          a.status = 'idle';
          a.until = now + rnd(9000, 15000) / sp;
        } else if (r < 0.92) {
          a.status = 'done';
          a.until = now + 2500 / sp;
          this.log(a, tr('office.log.taskDone'));
        } else if (!a.parent && this.agents.filter(o => o.parent && !o.leaving).length < 3 && this.freeDesk() >= 0)
          this.spawnSub(a);
        else this.setWork(a);
      }
    }
    spawnSub(a) {
      const sub = this.addAgent({ parent: a });
      if (!sub) return this.setWork(a);
      a.status = 'waiting';
      a.target = sub.id;
      a.waitSub = sub.id;
      a.msg = tr('office.sim.waitSubagent', { name: sub.short });
      a.tool = ['Task', 'spawn sub-agent'];
      this.log(a, 'Task → spawn sub-agent');
    }

    syncLive(snap) {
      if (snap.usage) this.usage = snap.usage;
      // The 5H / 7D limits exist only with a claude.ai plan: the server says whether one is known (lib/usage.js).
      // An older server sends no usagePlan, and the board shows as before.
      if ('usagePlan' in snap) this.usagePlan = snap.usagePlan;
      if (snap.version) this.serverVersion = snap.version;
      const list = ((snap && snap.sessions) || [])
        .slice()
        .sort((a, b) => (!a.parentId ? 0 : 1) - (!b.parentId ? 0 : 1));
      // Who walked out and why (WorldLogic.goneStep): a finished sub-agent stays out while still listed; one that left
      // because its session vanished (island offline or private) comes back when listed again.
      // A hidden tab never runs frame, so agents marked gone there are dropped here, remembering why they left.
      if (this.agents.some(a => a.gone)) {
        for (const a of this.agents) if (a.gone) this.goneSids.set(a.sid, a.leftWhy || 'missing');
        this.agents = this.agents.filter(a => !a.gone);
      }
      const listed = new Set(list.map(s => s.id));
      const { skip, gone } = WorldLogic.goneStep(this.goneSids, listed);
      // Unlisted agents leave first, so in a hidden tab (where leaving frees the desk at once) a snapshot that swaps
      // every session still finds desks for the new ones.
      this.agents.forEach(a => {
        if (!listed.has(a.sid)) this.leave(a);
      });
      for (const s of list) {
        if (skip.has(s.id)) continue;
        let a = this.agents.find(x => x.sid === s.id && !x.leaving);
        const back = !a && this.agents.find(x => x.sid === s.id && x.leaving && !x.gone);
        if (back) {
          // still on the way out: back to the desk
          if (back.leftWhy !== 'missing') continue;
          back.leaving = false;
          back.goalKey = null;
          a = back;
        }
        if (!a) {
          let par = null;
          if (s.parentId) {
            par = this.agents.find(x => x.sid === s.parentId && !x.leaving && !x.gone);
          }
          a = this.addAgent({ seated: this.firstSnap && !par, parent: par, live: s });
          if (!a) continue;
          if (this.firstSnap && par) {
            const d = DESKS[par.desk];
            a.x = d.gx + 2.45;
            a.y = d.gy + 0.55;
            a.moving = false;
            a.path = [];
            a.goalKey = 'sub' + a.parent + '-0';
          }
        }
        if (s.parentId) {
          const p = this.agents.find(x => x.sid === s.parentId && !x.gone);
          if (p) {
            a.parent = p.id;
            if (a.desk !== p.desk) {
              a.desk = p.desk;
              a.goalKey = null;
            }
          }
        }
        a.status = ST[s.status] ? s.status : 'working';
        a.tool = [s.tool || '', s.detail || ''];
        a.msg = s.detail || '';
        a.tokens = s.tokens || 0;
        a.model = s.model || a.model;
        a.cwd = s.cwd || a.cwd;
        a.name = s.name || a.name;
        a.liveHist = s.recent || null;
        const t = s.waitingOn && this.agents.find(x => x.sid === s.waitingOn && !x.gone);
        a.target = t ? t.id : null;
        if (a.status === 'talking' && s.talkingTo) {
          const tgt = this.agents.find(
            x => !x.leaving && (x.name === s.talkingTo || x.short === s.talkingTo || x.sid === s.talkingTo),
          );
          if (tgt) a.target = tgt.id;
        }
        if (a.status === 'waiting' && !a.target) a.status = 'working';
        if (a.parent && s.status === 'done') {
          if (!a.doneAt) a.doneAt = Date.now();
        } else a.doneAt = 0;
      }
      this.goneSids = gone;
      this.firstSnap = false;
    }

    goalFor(a) {
      if (a.leaving) return { key: 'exit', tile: DOOR.tile, pt: DOOR.pt };
      if (a.parent) {
        const p = this.byId(a.parent),
          d = DESKS[p ? p.desk : a.desk];
        const subs = this.agents.filter(o => !o.leaving && o.parent === a.parent);
        const slot = Math.max(0, subs.indexOf(a));
        const baseSpots = [
          [
            [d.gx + 2, d.gy],
            [d.gx + 2.45, d.gy + 0.55],
          ],
          [
            [d.gx + 2, d.gy + 1.2],
            [d.gx + 2.45, d.gy + 1.7],
          ],
          [
            [d.gx + 0.8, d.gy + 2.2],
            [d.gx + 1.3, d.gy + 2.6],
          ],
          [
            [d.gx + 2, d.gy + 2.2],
            [d.gx + 2.45, d.gy + 2.7],
          ],
          [
            [d.gx - 0.2, d.gy + 2.2],
            [d.gx + 0.3, d.gy + 2.6],
          ],
        ];
        const si = slot % baseSpots.length,
          row = Math.floor(slot / baseSpots.length);
        const s = baseSpots[si];
        return {
          key: 'sub' + a.parent + '-' + slot,
          tile: [s[0][0], s[0][1] + row * 1.2],
          pt: [s[1][0], s[1][1] + row * 1.2],
        };
      }
      const t = (a.status === 'talking' || a.status === 'waiting') && a.target && this.byId(a.target);
      if (t && !t.leaving && t.parent !== a.id) {
        const d = DESKS[t.desk];
        const visitors = this.agents.filter(
          o =>
            !o.leaving && o.target === t.id && (o.status === 'talking' || o.status === 'waiting') && o.parent !== t.id,
        );
        const slot = Math.max(0, visitors.indexOf(a)) % 3;
        const spots = [
          [
            [d.gx + 2, d.gy],
            [d.gx + 2.45, d.gy + 0.55],
          ],
          [
            [d.gx + 2, d.gy + 1],
            [d.gx + 2.45, d.gy + 1.5],
          ],
          [
            [d.gx + 2, d.gy + 2],
            [d.gx + 2.4, d.gy + 2.3],
          ],
        ];
        return { key: 'visit' + t.id + '-' + slot, tile: spots[slot][0], pt: spots[slot][1] };
      }
      const d = DESKS[a.desk];
      if (a.status !== 'idle') {
        a.idleSpot = null;
        a.wcDone = false;
      } else if (!a.leaving) {
        const taken = new Set(
          this.agents
            .filter(o => o !== a && !o.leaving && o.status === 'idle' && o.idleSpot != null)
            .map(o => o.idleSpot),
        );
        // A restroom visit is short: once it is over the person moves on, and does not go back while still idle.
        if (a.idleSpot != null && IDLE_SPOTS[a.idleSpot].act === 'wc' && RestroomLogic.visit(a.wcT || 0) === 'done') {
          a.idleSpot = null;
          a.wcDone = true;
        }
        // Men use WC NAM and women WC NỮ (RestroomLogic.roomOf); about one idle choice in four is a free stall there.
        // On the frozen lakes nobody fishes or bathes: whoever is there leaves (SeasonLogic.idleStays).
        const frozen = SeasonLogic.look(this.seasonNow()).frozen;
        if (!SeasonLogic.idleStays(IDLE_SPOTS, a.idleSpot, frozen)) a.idleSpot = null;
        if (a.idleSpot == null || taken.has(a.idleSpot)) {
          const free = SeasonLogic.idleOpen(
            IDLE_SPOTS,
            IDLE_SPOTS.map((_, i) => i).filter(i => !taken.has(i)),
            frozen,
          );
          a.idleSpot = RestroomLogic.pickIdle(IDLE_SPOTS, free, a.wcDone ? null : RestroomLogic.roomOf(a), Math.random);
        }
        if (a.idleSpot != null) {
          const sp = IDLE_SPOTS[a.idleSpot];
          // After the stall comes the vanity: same visit, so the visit clock keeps running (keepWc).
          if (sp.act === 'wc' && RestroomLogic.visit(a.wcT || 0) === 'wash')
            return { key: 'wash' + a.idleSpot, tile: sp.wash.tile, pt: sp.wash.pt, spot: sp, keepWc: true };
          return { key: 'idle' + a.idleSpot, tile: sp.tile, pt: sp.pt, stool: sp.stool || 0, spot: sp };
        }
      }
      if (a.status === 'idle') return { key: 'sleep', tile: [d.gx, d.gy + 1], pt: [d.gx + 0.75, d.gy + 0.62] };
      return { key: 'seat', tile: [d.gx, d.gy + 1], pt: [d.gx + 1, d.gy + 1.45] };
    }
    updateAgent(a, dt) {
      if (a.status !== 'idle' && a.sleeping) {
        const d = DESKS[a.desk];
        a.sleeping = false;
        a.x = d.gx + 1;
        a.y = d.gy + 1.45;
        a.seated = true;
        a.moving = false;
        a.path = [];
        a.goalKey = 'seat';
      }
      if (a.sleeping) return;
      const g = this.goalFor(a);
      if (g.key !== a.goalKey) {
        a.goalKey = g.key;
        a.seated = false;
        a.sleeping = false;
        a.stool = false;
        a.actNow = null;
        a.wcIn = false;
        if (!g.keepWc) a.wcT = 0;
        // Out on the lawn (the rest corner too) or in the restroom block an agent paths from where it stands;
        // anywhere else (e.g. just in through the door) it starts inside.
        a.path = bfs(startCell(a.x, a.y), g.tile)
          .map(p => [p[0] + 0.5, p[1] + 0.5])
          .concat([g.pt]);
        if (g.key === 'seat' && a.path.length > 1) a.path.splice(a.path.length - 2, 1);
      }
      if (a.path.length) {
        a.moving = true;
        let step = 2.6 * this.speed * dt;
        while (step > 0 && a.path.length) {
          const [tx, ty] = a.path[0],
            dx = tx - a.x,
            dy = ty - a.y,
            dist = Math.hypot(dx, dy);
          if (dist > 0.001) a.dirFront = dx + dy > 0.0001 ? true : dx + dy < -0.0001 ? false : a.dirFront;
          if (dist <= step) {
            a.x = tx;
            a.y = ty;
            a.path.shift();
            step -= dist;
          } else {
            a.x += (dx / dist) * step;
            a.y += (dy / dist) * step;
            step = 0;
          }
        }
        if (!a.path.length) {
          a.moving = false;
          if (g.key === 'seat') a.seated = true;
          if (g.key === 'sleep') a.sleeping = true;
          if (g.stool) a.stool = g.stool;
          if (g.key === 'exit') a.gone = true;
          a.dirFront = g.spot ? g.spot.front : false;
          if (g.spot) a.actNow = g.spot.act;
        }
      }
      // At a stall or the vanity: count the visit along (RestroomLogic.visit); while inside the stall, the person is
      // not drawn.
      else if (a.actNow === 'wc') {
        a.wcT = (a.wcT || 0) + dt * this.speed;
        a.wcIn = RestroomLogic.visit(a.wcT) === 'inside';
      }
    }

    // Which props are in use (web/prop-use.js) and how lit each one is, stepped with the simulation: two arrays per
    // scene, made once, so the draw reads this.propLit[PropUse.ID.x] with nothing allocated per frame.
    stepProps(dt) {
      if (!this.propLit) {
        this.propOn = new Uint8Array(PropUse.N);
        this.propLit = new Float32Array(PropUse.N);
      }
      PropUse.mark(this.propOn, this.agents, IDLE_SPOTS);
      PropUse.ease(this.propLit, this.propOn, dt);
    }

    stepDogs(dt) {
      const w = this.dogWorld,
        now = new Date();
      w.now += dt;
      w.hour = now.getHours() + now.getMinutes() / 60;
      w.snow = this.snowShown || 0;
      w.calm = !!(this.env && this.env.reduced);
      w.frozen = SeasonLogic.look(this.seasonNow()).frozen;
      // People out on the lawn (down the stairs, bathing in the pond) are who the dogs run over to greet.
      // `act` is what they are doing, or the idle spot they are walking to, so a smoker is left alone on the way too.
      // People going to or at the restroom are left out altogether: the dogs leave them be.
      w.agents = this.agents
        .filter(a => (a.x >= W || a.y >= H) && !a.wcIn && LAWN_WALK.has(Math.floor(a.x) + ',' + Math.floor(a.y)))
        .map(a => ({
          id: a.id,
          x: a.x,
          y: a.y,
          act:
            a.actNow ||
            (a.status === 'idle' && a.idleSpot != null && IDLE_SPOTS[a.idleSpot] ? IDLE_SPOTS[a.idleSpot].act : null),
          // arrived and doing it (the bench sitter gets a dog lying beside the bench, DogLogic 'company')
          at: !!a.actNow,
        }))
        .filter(a => a.act !== 'wc');
      DogLogic.step(this.dogs, w, dt);
    }
  },
);
