// Speech bubbles: an agent "says" a line when its activity changes, then the bubble fades, so a crowded office is
// not buried under labels. Kept DOM-free so tests/bubble-logic.test.mjs can run it.
const SHOW_MS = 6000,
  FADE_MS = 600,
  COOL_MS = 15000,
  MAX_TALKING = 4;
// What counts as a new line: the status, plus the tool for work and the activity for a break. A tool change while
// still working is a minor change and waits out COOL_MS; any status change speaks at once.
function topic(a) {
  if (a.status === 'working') return 'working:' + ((a.tool && a.tool[0]) || '');
  if (a.status === 'idle') return 'idle:' + (a.actNow || '');
  if (a.status === 'talking' || a.status === 'waiting') return a.status + ':' + (a.target || '');
  return a.status;
}
// mem: Map kept between calls. agents: [{id, status, tool, actNow, target, pinned}], pinned = always shown
// (needs approval, error, selected, hovered). Returns Map id -> 'show' | 'fade'; agents not in it have no bubble.
function step(mem, agents, now) {
  const ids = new Set();
  for (const a of agents) {
    ids.add(a.id);
    const key = topic(a);
    let m = mem.get(a.id);
    // On first sight only a session that is just clocking in speaks; the rest of an already busy office stays quiet.
    if (!m) {
      m = { key, status: a.status, until: -Infinity, cool: -Infinity, at: -Infinity };
      mem.set(a.id, m);
      if (a.status === 'entering') {
        m.until = now + SHOW_MS;
        m.cool = now + COOL_MS;
        m.at = now;
      }
      continue;
    }
    if (key !== m.key) {
      if (a.status !== m.status || now >= m.cool) {
        m.until = now + SHOW_MS;
        m.cool = now + COOL_MS;
        m.at = now;
      }
      m.key = key;
      m.status = a.status;
    }
  }
  for (const id of [...mem.keys()]) if (!ids.has(id)) mem.delete(id);
  const talking = agents
    .filter(a => !a.pinned && now < mem.get(a.id).until)
    .sort((x, y) => mem.get(y.id).at - mem.get(x.id).at);
  for (const a of talking.slice(MAX_TALKING)) mem.get(a.id).until = now;
  const out = new Map();
  for (const a of agents) {
    if (a.pinned) {
      out.set(a.id, 'show');
      continue;
    }
    const left = mem.get(a.id).until - now;
    if (left > 0) out.set(a.id, 'show');
    else if (left > -FADE_MS) out.set(a.id, 'fade');
  }
  return out;
}
// Settings choice, remembered under STORAGE_KEY: 'speech' (compact: agents at work keep their bubble, a break speaks
// a line and fades), 'always', 'off' (only approvals, errors, the selected and the hovered agent).
const MODES = ['speech', 'always', 'off'],
  STORAGE_KEY = 'terrarium-bubbles';
const BUSY = new Set(['working', 'thinking', 'talking', 'waiting']);
export const BubbleLogic = { SHOW_MS, FADE_MS, COOL_MS, MAX_TALKING, MODES, STORAGE_KEY, BUSY, topic, step };
