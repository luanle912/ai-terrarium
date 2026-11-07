import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'
import { loadSkyLogic } from './load-sky-logic.mjs'

const SkyLogic = loadSkyLogic()
const { IslandLand } = loadWeb('island-land')
const W = 27, H = 14, TW = 16
const island = IslandLand.buildIsland({ W, H })
const has = (x, y) => island.cells.has(x + ',' + y)
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const neighbours = (x, y) => N4.filter(([a, b]) => has(x + a, y + b)).length
const K = (x, y) => x + ',' + y
const at = (k) => k.split(',').map(Number)
const tiles = [...island.cells].map(at)
// The first island's lake, before the reshape to version 2: the new one is about twice as big.
const V1_LAKE = 60

test('the page sees the same island builder through SkyLogic', () => {
  assert.equal(SkyLogic.buildIsland, IslandLand.buildIsland)
  assert.equal(IslandLand.SQUARE_MARGIN, 4)
  assert.equal(IslandLand.HEX_CUT, 4)
  assert.deepEqual(IslandLand.centre(W, H), { cx: (W + 10) / 2, cy: H / 2, R: (W + 11) / 2 + 4, K: (W + 11) / 2 + (H + 1) / 2 + 4 })
  assert.deepEqual(island.shape, IslandLand.centre(W, H))
})

test('island is deterministic', () => {
  const again = IslandLand.buildIsland({ W, H })
  assert.deepEqual(again.list, island.list)
  assert.deepEqual(again.decor, island.decor)
  for (const f of ['pavilion', 'lotus', 'duckweed', 'ducks', 'rest', 'lamps', 'waterfall']) assert.deepEqual(again[f], island[f], f)
})

test('the island is a hexagon pointing up and down', () => {
  // rows across the screen are x + y; columns down it are x - y
  const byRow = new Map(), byCol = new Map()
  for (const [x, y] of tiles) {
    byRow.set(x + y, (byRow.get(x + y) || 0) + 1)
    byCol.set(x - y, (byCol.get(x - y) || 0) + 1)
  }
  const rows = [...byRow.keys()], cols = [...byCol.keys()]
  for (const r of [Math.min(...rows), Math.max(...rows)]) {
    const n = byRow.get(r)
    assert.ok(n >= 1 && n <= 3, `the point at row x + y = ${r} is ${n} tiles wide`)
  }
  // the left and right sides run up and down the screen, wavy but long: plenty of tiles within 3 columns of the edge
  // (Kiet: a hexagon, but not ruler-straight — "nhiễu nhiễu chút")
  for (const c of [Math.min(...cols), Math.max(...cols)]) {
    let n = 0
    for (const [col, k] of byCol) if (Math.abs(col - c) <= 3) n += k
    assert.ok(n >= 20, `the upright edge at x - y = ${c} has only ${n} tiles near it`)
  }
  // ... and they are not ruler-straight: the outermost column holds only part of the edge (a straight edge of v2's
  // first build put 16 tiles in it)
  for (const c of [Math.min(...cols), Math.max(...cols)])
    assert.ok(byCol.get(c) <= 10, `the upright edge at x - y = ${c} runs ruler-straight for ${byCol.get(c)} tiles`)
  // ... and they are about as far from the middle on either side
  const { cx, cy } = island.shape
  const mid = cx - cy
  assert.ok(Math.abs(Math.max(...cols) - mid - (mid - Math.min(...cols))) <= 2, 'the upright edges are lopsided')
  // a hexagon, not a diamond: the cut takes the left and right points well inside the square's
  const { R } = island.shape
  assert.ok(Math.max(...cols) - Math.min(...cols) < 4 * R - 20, 'the left and right points are not cut off')
})

test('the island contains the whole office block', () => {
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W + 10; x++) assert.ok(has(x, y), `office block cell ${x},${y}`)
})

test('the narrowest lawn around the office block is about four tiles', () => {
  // steps from off the island to each tile (1 on the shore), so a block tile at d has d - 1 lawn tiles outside it
  const { minX, maxX, minY, maxY } = island.bounds
  const dist = new Map(), q = []
  for (let y = minY - 1; y <= maxY; y++) for (let x = minX - 1; x <= maxX; x++) if (!has(x, y)) { dist.set(K(x, y), 0); q.push([x, y]) }
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i]
    for (const [a, b] of N4) {
      const k = K(x + a, y + b)
      if (has(x + a, y + b) && !dist.has(k)) { dist.set(k, dist.get(K(x, y)) + 1); q.push([x + a, y + b]) }
    }
  }
  let least = Infinity
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W + 10; x++) least = Math.min(least, dist.get(K(x, y)) - 1)
  assert.ok(least >= 3 && least <= 5, `the narrowest lawn is ${least} tiles`)
})

test('shore has no one-tile spikes or notches', () => {
  for (const key of island.cells) {
    const [x, y] = key.split(',').map(Number)
    assert.ok(neighbours(x, y) >= 2, `spike at ${key}`)
  }
  const { minX, maxX, minY, maxY } = island.bounds
  for (let y = minY - 1; y <= maxY; y++) for (let x = minX - 1; x <= maxX; x++) {
    if (!has(x, y)) assert.ok(neighbours(x, y) <= 2, `notch at ${x},${y}`)
  }
})

test('the underside is one cone with its tip near the middle', () => {
  const { cx, cy } = island.shape
  const tip = island.list.reduce((a, b) => (b.d > a.d ? b : a))
  assert.ok(Math.hypot(tip.x + 0.5 - cx, tip.y + 0.5 - cy) <= 3, `the tip hangs under ${tip.x},${tip.y}`)
  const { minX, maxX, minY, maxY } = island.bounds
  const width = (maxX - minY - (minX - maxY)) * TW
  const r = tip.d / width
  assert.ok(r >= 0.28 && r <= 0.38, `the tip is ${(r * 100).toFixed(1)}% of the island's screen width deep`)
})

test('the cone falls off outward without steps', () => {
  const { cx, cy } = island.shape
  const far = (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
  for (const c of island.list)
    for (const [a, b] of N4) {
      const d = island.depth.get(c.x + a + ',' + (c.y + b))
      if (d === undefined || far(c.x + a, c.y + b) <= far(c.x, c.y)) continue
      assert.ok(d <= c.d + 2, `${c.x + a},${c.y + b} hangs ${d} under ${c.x},${c.y} at ${c.d}`)
    }
})

// ---- mountain, its foot lake, lake, pavilion, rest corner, lamps, decor ----

const walk = SkyLogic.lawnWalk(island, W, H)
const southFoot = [22, H]
const lake = island.pond.cells
const pool = island.mountain.lake.cells
const hidden = island.mountain.hidden
// Every cell reachable from `from` stepping (4 ways) only on `cells`.
const reach = (cells, from) => {
  const seen = new Set([K(...from)]), q = [from]
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i]
    for (const [a, b] of N4) {
      const k = K(x + a, y + b)
      if (cells.has(k) && !seen.has(k)) { seen.add(k); q.push([x + a, y + b]) }
    }
  }
  return seen
}
const connected = (cells) => cells.size > 0 && reach(cells, at(cells.values().next().value)).size === cells.size
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))

test('there is no river or bridge', () => {
  assert.equal(island.river, undefined)
  assert.equal(island.bridge, undefined)
  // the only water: the lake and the lake at the mountain's foot, apart (the foot lake runs nowhere)
  for (const k of pool) {
    assert.ok(!lake.has(k), `${k} is in both lakes`)
    const [x, y] = at(k)
    for (const [a, b] of N4) assert.ok(!lake.has(K(x + a, y + b)), `the foot lake at ${k} runs into the lake`)
  }
  // the left strip beside the office is plain lawn again
  for (let y = 0; y < H; y++) for (let x = -3; x < -1; x++) if (has(x, y)) assert.ok(walk.has(K(x, y)) || island.decor.some((d) => d.x === x && d.y === y), `${x},${y} is not lawn`)
  // nothing lifts anyone now: the bridge height the drawing code used to ask for is gone
  assert.equal(loadWeb('island-land').bridgeZ, undefined)
})

test('the lake sits at the bottom point and feeds the main fall there', () => {
  assert.ok(lake.size >= 2 * V1_LAKE, `the lake is ${lake.size} tiles, the first island's was ${V1_LAKE}`)
  assert.ok(connected(lake), 'the lake is one body of water')
  const low = Math.max(...tiles.map(([x, y]) => x + y))
  const points = tiles.filter(([x, y]) => x + y === low)
  for (const p of points) assert.ok([...lake].some((k) => cheb(at(k), p) <= 2), `the bottom point ${p} is far from the lake`)
  const { x, y } = island.waterfall
  assert.equal(x + y, low, `the waterfall at ${x},${y} is not on the bottom point`)
  assert.ok(lake.has(K(x, y)) && !has(x, y + 1), `the waterfall at ${x},${y} is not lake on the front shore`)
  // the lake keeps a bank of lawn all round, except at the lip by the fall
  for (const k of lake) {
    const [lx, ly] = at(k)
    assert.ok(!(lx >= -1 && lx <= W && ly >= -1 && ly <= H), `lake tile ${k} touches the office`)
    assert.ok(!island.spots.some((s) => lx >= s.x && lx < s.x + s.w && ly >= s.y && ly < s.y + s.h), `lake tile ${k} is on a reserved spot`)
    if (N4.some(([a, b]) => !has(lx + a, ly + b))) assert.ok(cheb([lx, ly], [x, y]) <= 3, `lake tile ${k} opens onto the shore away from the fall`)
  }
  assert.equal(island.pond.spots.length, 2)
  for (const s of island.pond.spots) assert.ok(lake.has(K(s.x, s.y)) && walk.has(K(s.x, s.y)), `bathing spot ${s.x},${s.y}`)
})

test('the lake is rounded: no one-tile spurs or notches', () => {
  const wet = (x, y) => N4.filter(([a, b]) => lake.has(K(x + a, y + b))).length
  for (const k of lake) {
    const [x, y] = at(k)
    assert.ok(wet(x, y) >= 2, `lake tile ${k} is a spur`)
    for (const [a, b] of N4) if (has(x + a, y + b) && !lake.has(K(x + a, y + b))) assert.ok(wet(x + a, y + b) <= 2, `lawn tile ${x + a},${y + b} is a notch in the lake`)
  }
})

test('the pavilion stands on one pillar inside the lake', () => {
  const { pillar, path, x, y } = island.pavilion
  assert.deepEqual([x, y], [pillar.x + 0.5, pillar.y + 0.5], 'the hall is not over its pillar')
  for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) assert.ok(lake.has(K(pillar.x + a, pillar.y + b)), `the pillar is within 2 tiles of the bank (${pillar.x + a},${pillar.y + b})`)
  assert.ok(path.length >= 1)
  const land = (p) => has(p.x, p.y) && !lake.has(K(p.x, p.y))
  assert.ok(N4.some(([a, b]) => land({ x: path[0].x + a, y: path[0].y + b })), 'the stones do not start at the bank')
  const last = path[path.length - 1]
  assert.equal(Math.abs(last.x - pillar.x) + Math.abs(last.y - pillar.y), 1, 'the stones do not reach the pillar')
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    assert.ok(lake.has(K(p.x, p.y)), `stone ${p.x},${p.y} is not in the lake`)
    assert.ok(!(p.x === pillar.x && p.y === pillar.y), 'a stone on the pillar')
    assert.ok(!walk.has(K(p.x, p.y)), `stone ${p.x},${p.y} is walkable: the pavilion is scenery`)
    if (i) assert.equal(Math.abs(p.x - path[i - 1].x) + Math.abs(p.y - path[i - 1].y), 1, `the stones break at ${p.x},${p.y}`)
  }
  assert.ok(!walk.has(K(pillar.x, pillar.y)))
})

test('lotus, duckweed and duck lanes stay on open water', () => {
  const { pillar, path } = island.pavilion
  const stones = new Set(path.map((p) => K(p.x, p.y)))
  const off = (x, y, what) => {
    const k = K(x, y)
    assert.ok(lake.has(k), `${what} at ${k} is not on the lake`)
    assert.ok(!(x === pillar.x && y === pillar.y) && !stones.has(k), `${what} at ${k} is on the pavilion or its stones`)
  }
  const leaves = new Set()
  assert.ok(island.lotus.length >= 6, `only ${island.lotus.length} lotus leaves`)
  for (const l of island.lotus) {
    off(l.x, l.y, 'lotus')
    assert.ok(['pink', 'white', null].includes(l.flower), `lotus flower ${l.flower}`)
    assert.ok(!leaves.has(K(l.x, l.y)), `two lotus leaves on ${l.x},${l.y}`)
    leaves.add(K(l.x, l.y))
  }
  for (const c of ['pink', 'white']) assert.ok(island.lotus.some((l) => l.flower === c), `no ${c} lotus flower`)
  assert.ok(island.lotus.some((l) => cheb([l.x, l.y], [pillar.x, pillar.y]) <= 3), 'no lotus round the pillar')
  assert.ok(island.duckweed.length >= 4, `only ${island.duckweed.length} tiles of duckweed`)
  for (const d of island.duckweed) {
    off(d.x, d.y, 'duckweed')
    assert.ok(!leaves.has(K(d.x, d.y)), `duckweed on the lotus at ${d.x},${d.y}`)
  }
  const { lanes } = island.ducks
  assert.ok(lanes.length >= 2 && lanes.length <= 3, `${lanes.length} duck lanes`)
  for (const lane of lanes) {
    assert.ok(lane.length >= 4, 'a lane of fewer than four points')
    // the whole loop, last point back to the first: on water a tile clear of the bank, off the hall and the lotus
    for (let i = 0; i < lane.length; i++) {
      const [ax, ay] = lane[i], [bx, by] = lane[(i + 1) % lane.length]
      for (let s = 0; s <= 8; s++) {
        const x = Math.floor(ax + ((bx - ax) * s) / 8), y = Math.floor(ay + ((by - ay) * s) / 8)
        off(x, y, 'a duck lane')
        assert.ok(!leaves.has(K(x, y)), `a duck lane runs through the lotus at ${x},${y}`)
        assert.ok(cheb([x, y], [pillar.x, pillar.y]) >= 2, `a duck lane runs under the pavilion at ${x},${y}`)
        for (const [a, b] of N4) assert.ok(lake.has(K(x + a, y + b)), `a duck lane runs along the bank at ${x},${y}`)
      }
    }
  }
  for (let i = 0; i < lanes.length; i++)
    for (let j = i + 1; j < lanes.length; j++)
      for (const p of lanes[i]) for (const q of lanes[j]) assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) >= 1, 'two duck lanes cross')
})

test('the mountain is one peak on the back lawn with a lake at its foot', () => {
  const m = island.mountain
  assert.deepEqual(Object.keys(m).sort(), ['cells', 'foot', 'hidden', 'lake', 'scale'])
  assert.equal(m.scale, 1.4)
  const { cells, foot } = m
  // the foot: a 5 x 5 square of tiles (a diamond on screen) whose front corner is foot
  assert.equal(cells.size, 25)
  for (let y = foot.y - 5; y < foot.y; y++)
    for (let x = foot.x - 5; x < foot.x; x++) assert.ok(cells.has(K(x, y)), `${x},${y} is not under the mountain`)
  for (const k of cells) {
    assert.ok(island.cells.has(k), `mountain tile ${k} is off the island`)
    assert.ok(at(k)[1] <= -3, `mountain tile ${k} is less than 3 tiles behind the back wall`)
    assert.ok(!walk.has(k), `mountain tile ${k} is walkable`)
  }
  // on the back lawn toward small x (the top point on screen), as the two peaks were
  const mx = [...cells].reduce((s, k) => s + at(k)[0], 0) / cells.size
  assert.ok(mx < (W + 10) / 2 - 5, `the mountain's middle is at x ${mx.toFixed(1)}`)
  // the tiles it hides (their middle inside its outline on screen) are nobody's to walk on
  for (const k of hidden) assert.ok(!walk.has(k) && !cells.has(k), `hidden tile ${k}`)
  // the lake at its foot: in front of the left face, every tile's middle inside the brief's stone rim (ellipse round
  // (-20, 24), 15 x 7.5, x 1.4 from F at (0, 27)), none of it walkable, not under the mountain
  assert.ok(pool.size >= 1 && pool.size <= 4, `the foot lake is ${pool.size} tiles`)
  const s = m.scale, c = [-20 * s, (24 - 27) * s]
  for (const k of pool) {
    const [x, y] = at(k)
    const u = (x - y - (foot.x - foot.y)) * TW, v = (x + y + 1 - (foot.x + foot.y)) * 8
    assert.ok(((u - c[0]) / (15 * s)) ** 2 + ((v - c[1]) / (7.5 * s)) ** 2 <= 1, `foot lake tile ${k} is outside the rim`)
    assert.ok(!cells.has(k) && !walk.has(k) && !hidden.has(k), `foot lake tile ${k}`)
    assert.ok(u < 0, `foot lake tile ${k} is not in front of the left face`)
  }
  // its rim: the tiles round it; someone can walk up to it
  const rim = new Set(m.lake.rim.map((r) => K(r.x, r.y)))
  for (const r of m.lake.rim) assert.ok(!pool.has(K(r.x, r.y)) && [...pool].some((p) => cheb(at(p), [r.x, r.y]) === 1), `rim ${r.x},${r.y}`)
  assert.ok([...rim].some((k) => reach(walk, southFoot).has(k)), 'nobody can reach the foot lake')
})

test('pines stand in two clumps on the mountain\'s grassy foot, with mushrooms and flowers by its lake', () => {
  const pines = island.decor.filter((d) => d.kind === 'pine')
  const { foot } = island.mountain
  // left of the foot's front corner on screen, and right of it
  const side = (d) => Math.sign(d.at[0] - d.at[1] - (foot.x - foot.y))
  const left = pines.filter((d) => side(d) < 0), right = pines.filter((d) => side(d) > 0)
  assert.ok(left.length >= 4 && left.length <= 6, `${left.length} pines in the left clump`)
  assert.ok(right.length >= 5 && right.length <= 7, `${right.length} pines in the right clump`)
  assert.deepEqual([...new Set(pines.map((d) => d.size))].sort(), [0, 1, 2], 'three sizes of pine')
  for (const d of pines) {
    assert.deepEqual([d.x, d.y], [Math.floor(d.at[0]), Math.floor(d.at[1])])
    assert.ok(has(d.x, d.y) && !pool.has(K(d.x, d.y)) && !hidden.has(K(d.x, d.y)), `pine at ${d.x},${d.y}`)
    assert.ok(d.z >= d.at[0] + d.at[1], `pine at ${d.x},${d.y} sorts behind its own foot`)
  }
  const near = (d) => [...pool].some((k) => cheb(at(k), [d.x, d.y]) <= 3)
  const red = island.decor.filter((d) => d.kind === 'mushroom' && d.red && near(d))
  assert.ok(red.length >= 2 && red.length <= 3, `${red.length} red mushrooms by the foot lake`)
  const flowers = island.decor.filter((d) => d.kind === 'flower' && d.colour && near(d))
  assert.ok(flowers.length >= 3, 'no flowers by the foot lake')
  for (const f of flowers) assert.ok(['#FF7AA8', '#FFD84A', '#FFFFFF'].includes(f.colour), `flower ${f.colour}`)
  assert.ok(island.decor.some((d) => d.kind === 'bush' && near(d)), 'no bush by the foot lake')
  assert.ok(island.decor.some((d) => d.kind === 'rock' && near(d)), 'no rock by the foot lake')
})

test('everything outdoors is reachable and nobody walks into water or the mountain', () => {
  const seen = reach(walk, southFoot)
  const lost = [...walk].filter((k) => !seen.has(k))
  assert.deepEqual(lost, [], 'lawn tiles nobody can reach')
  const bath = new Set(island.pond.spots.map((s) => K(s.x, s.y)))
  for (const k of walk) {
    assert.ok(!island.mountain.cells.has(k) && !pool.has(k) && !hidden.has(k), `${k} is on the mountain, behind it or in its lake`)
    assert.ok(!lake.has(k) || bath.has(k), `${k} is in the lake`)
  }
  const back = [...seen].filter((k) => at(k)[1] <= -3)
  assert.ok(back.length > 50, `only ${back.length} back-lawn tiles reachable`)
  const { bench, fish } = island.rest
  for (const p of [bench, fish, ...island.pond.spots]) assert.ok(seen.has(K(p.x, p.y)), `${p.x},${p.y} cannot be reached`)
  for (const s of island.spots) assert.ok([...seen].some((k) => { const [x, y] = at(k); return x >= s.x - 1 && x <= s.x + s.w && y >= s.y - 1 && y <= s.y + s.h }), `nobody reaches ${s.id}`)
  // the dogs too: office-scene.js builds their places from the page's island at load; it only needs React for h()
  globalThis.React ??= { createElement: () => null }
  const { DOG_PLACES, ISLAND } = loadWeb('office-scene')
  const { roam, den, drink, clear } = DOG_PLACES
  for (const k of roam) {
    assert.ok(!ISLAND.pond.cells.has(k) && !ISLAND.mountain.lake.cells.has(k), `dogs roam the water at ${k}`)
    assert.ok(!ISLAND.mountain.cells.has(k), `dogs roam the mountain at ${k}`)
  }
  assert.ok(drink.filter((d) => ISLAND.pond.cells.has(K(d.tx, d.ty))).length >= 2, 'nowhere to drink at the lake')
  for (const d of drink) {
    const water = ISLAND.pond.cells.has(K(d.tx, d.ty)) || ISLAND.mountain.lake.cells.has(K(d.tx, d.ty))
    assert.ok(water && roam.has(K(d.x, d.y)), `drink spot ${d.x},${d.y}`)
  }
  assert.equal(den.length, 3)
  for (const [x, y] of den) assert.ok(roam.has(K(x, y)) && !clear.has(K(x, y)), `den cell ${x},${y} is not a quiet roam cell`)
})

test('the rest corner sits on the lake\'s inner bank', () => {
  const { bench, fish } = island.rest
  for (const p of [bench, fish]) assert.ok(walk.has(K(p.x, p.y)), `rest spot ${p.x},${p.y} is not walkable`)
  assert.ok(lake.has(K(fish.x + 1, fish.y)), 'the angler does not face the lake (+x)')
  assert.ok(Math.hypot(bench.x - fish.x, bench.y - fish.y) <= 3, 'the bench is far from the fishing spot')
  // inner: nearer the office than the pavilion is, up the screen from it
  const { pillar } = island.pavilion
  assert.ok(fish.x + fish.y < pillar.x + pillar.y && bench.x + bench.y < pillar.x + pillar.y, 'the rest corner is not on the inner bank')
})

test('lamps stand beside the stone path, none by a bridge', () => {
  const { lamps, paths } = island
  assert.ok(lamps.length >= 3)
  for (const l of lamps) {
    const k = K(l.x, l.y)
    assert.ok(has(l.x, l.y), `lamp ${k} is off the island`)
    assert.ok(!paths.cells.has(k) && !walk.has(k), `lamp ${k} stands in the way`)
    assert.ok(!lake.has(k) && !pool.has(k), `lamp ${k} is in the water`)
    let near = false
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) near ||= paths.cells.has(K(l.x + a, l.y + b))
    assert.ok(near, `lamp ${k} is not beside the path`)
  }
})

test('trees grow in clumps', () => {
  const trees = island.decor.filter((d) => d.kind === 'tree')
  assert.ok(trees.length >= 12)
  for (const t of trees) {
    const near = trees.filter((o) => o !== t && Math.max(Math.abs(o.x - t.x), Math.abs(o.y - t.y)) <= 2).length
    assert.ok(near >= 2, `tree at ${t.x},${t.y} stands alone (${near} others within 2 tiles)`)
  }
  for (const kind of ['tree', 'rock', 'flower', 'bush', 'mushroom', 'pine']) assert.ok(island.decor.some((d) => d.kind === kind), `no ${kind}`)
  // a garden, not a carpet
  assert.ok(island.decor.length <= 180, `${island.decor.length} pieces of decor`)
})

test('decor keeps off paths, water, the mountain, its lake, the rest corner and the lamps', () => {
  const { rest } = island
  const off = new Set([...island.paths.cells, ...lake, ...pool, ...hidden,
    K(rest.bench.x, rest.bench.y), K(rest.fish.x, rest.fish.y), ...island.lamps.map((l) => K(l.x, l.y))])
  const seen = new Set(island.decor.filter((d) => d.kind === 'pine').map((d) => K(d.x, d.y)))
  for (const d of island.decor) {
    const k = K(d.x, d.y)
    assert.ok(!off.has(k), `${d.kind} at ${k} is in the way`)
    // pines stand several to a tile, some on the mountain's grassy foot; nothing else is on it
    if (d.kind === 'pine') continue
    assert.ok(!island.mountain.cells.has(k), `${d.kind} at ${k} is on the mountain`)
    assert.ok(!seen.has(k), `two pieces of decor on ${k}`)
    seen.add(k)
  }
})
