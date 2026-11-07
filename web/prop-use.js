// Which office props are in use (docs/specs/2026-11-08-props-idle-off-design.md): a device lights up or moves only
// while someone has arrived at it and is using it. Each prop has a fixed index (ID) into two arrays a scene keeps:
// `on` (1 while used this tick) and `lit` (0..1, eased toward `on`), so nothing is allocated per frame.
// The desks come first, by desk index.
const DESKS = 16;
const NAMES = [
  ...Array.from({ length: DESKS }, (_, i) => 'desk' + i),
  'fridge',
  'espresso',
  'grinder',
  'sink',
  'microwave',
  'drinkfridge',
  'island',
  'cafe0',
  'cafe1',
  'cafe2',
  'arcade0',
  'arcade1',
  'foosball',
  'basin-m0',
  'basin-m1',
  'basin-f0',
  'basin-f1',
];
const ID = Object.create(null);
NAMES.forEach((n, i) => (ID[n] = i));
// Seconds to light up fully, and to go fully dark (a little slower, so it eases off).
const UP = 0.3,
  DOWN = 0.6;
// A desk is in use while its owner sits at it (not asleep, not leaving; sub-agents only stand by). An idle spot's prop
// is in use once the agent has arrived there and is doing that spot's act (actNow is set only on arrival and cleared
// when the goal changes); someone still walking there does not count. A restroom visitor uses the basin of the spot's
// `wash` place while washing there.
function mark(on, agents, spots) {
  on.fill(0);
  for (const a of agents) {
    if (a.leaving || a.gone) continue;
    if (!a.parent && a.seated && !a.sleeping && a.desk >= 0 && a.desk < DESKS) on[a.desk] = 1;
    const s = a.idleSpot != null && a.status === 'idle' && !a.moving && a.actNow ? spots[a.idleSpot] : null;
    if (!s || a.actNow !== s.act || !a.goalKey) continue;
    if (s.prop != null && a.goalKey.startsWith('idle') && ID[s.prop] != null) on[ID[s.prop]] = 1;
    else if (s.wash && s.wash.prop != null && a.goalKey.startsWith('wash') && ID[s.wash.prop] != null)
      on[ID[s.wash.prop]] = 1;
  }
  return on;
}
function ease(lit, on, dt) {
  for (let i = 0; i < lit.length; i++) {
    const v = on[i] ? lit[i] + dt / UP : lit[i] - dt / DOWN;
    lit[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return lit;
}
// For a scene drawn before its first step: nothing lit.
const DARK = new Float32Array(NAMES.length);
// Pantry LAYOUT entry -> prop index (-1 for furniture that is not a device): arcades and cafe tables take their
// numbered props in LAYOUT order.
function layoutProps(layout) {
  const seen = Object.create(null);
  return layout.map(([name]) => {
    const n = (seen[name] = (seen[name] || 0) + 1) - 1,
      key = name === 'arcade' ? 'arcade' + n : name === 'cafetable' ? 'cafe' + n : name;
    return ID[key] != null && ID[key] >= DESKS ? ID[key] : -1;
  });
}
export const PropUse = { NAMES, ID, N: NAMES.length, DESKS, UP, DOWN, DARK, mark, ease, layoutProps };
