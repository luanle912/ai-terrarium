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

test('the page sees the same island builder through SkyLogic', () => {
  assert.equal(SkyLogic.buildIsland, IslandLand.buildIsland)
  assert.equal(IslandLand.SQUARE_MARGIN, 5)
  assert.equal(IslandLand.SQUIRCLE_P, 5)
  assert.deepEqual(IslandLand.centre(W, H), { cx: (W + 10) / 2, cy: H / 2, R: (W + 10) / 2 + 5 })
  assert.deepEqual(island.shape, IslandLand.centre(W, H))
})

test('island is deterministic', () => {
  const again = IslandLand.buildIsland({ W, H })
  assert.deepEqual(again.list, island.list)
  assert.deepEqual(again.decor, island.decor)
})

test('the island is a square centred on the office block', () => {
  const { minX, maxX, minY, maxY } = island.bounds
  assert.ok(Math.abs(maxX - minX - (maxY - minY)) <= 2, `bounds are ${maxX - minX} × ${maxY - minY}`)
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2
  assert.ok(Math.hypot(mx - (W + 10) / 2, my - H / 2) <= 1, `bounds centre ${mx},${my}`)
  // The left strip carries the river (2 tiles) and a bank either side, so it is wider than the mockup's 2-3 tiles.
  const left = island.list.filter((c) => c.y === 7 && c.x < -1).length
  assert.ok(left >= 3 && left <= 5, `${left} grass tiles left of the office on row 7`)
  for (let y = 0; y < H; y++) {
    const strip = island.list.filter((c) => c.y === y && c.x < 0).length
    assert.ok(strip >= 3, `row ${y} has only ${strip} tiles beside the left wall: no room for the river and a bank`)
  }
})

test('the island contains the whole office block', () => {
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W + 10; x++) assert.ok(has(x, y), `office block cell ${x},${y}`)
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

// ---- mountain, river, lake, bridge, rest corner, lamps, decor ----

const K = (x, y) => x + ',' + y
const at = (k) => k.split(',').map(Number)
const walk = SkyLogic.lawnWalk(island, W, H)
const southFoot = [22, H]
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
// Breadth-first route from `from` to `to` over `cells`, or null.
const route = (cells, from, to) => {
  const prev = new Map([[K(...from), null]]), q = [from]
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i]
    if (x === to[0] && y === to[1]) break
    for (const [a, b] of N4) {
      const k = K(x + a, y + b)
      if (cells.has(k) && !prev.has(k)) { prev.set(k, K(x, y)); q.push([x + a, y + b]) }
    }
  }
  if (!prev.has(K(...to))) return null
  const out = []
  for (let k = K(...to); k; k = prev.get(k)) out.unshift(k)
  return out
}
const connected = (cells) => cells.size > 0 && reach(cells, at(cells.values().next().value)).size === cells.size

test('the mountain stands on the back lawn with two peaks', () => {
  const { cells, peaks, gap } = island.mountain
  assert.ok(cells.size >= 40, `only ${cells.size} mountain tiles`)
  for (const k of cells) {
    assert.ok(island.cells.has(k), `mountain tile ${k} is off the island`)
    assert.ok(at(k)[1] <= -3, `mountain tile ${k} is less than 3 tiles behind the back wall`)
  }
  assert.equal(peaks.length, 2)
  const main = peaks.filter((p) => p.main)
  assert.equal(main.length, 1, 'exactly one main peak')
  const side = peaks.find((p) => !p.main)
  assert.ok(main[0].h > side.h, 'the main peak is the taller')
  for (const p of peaks) assert.ok(cells.has(K(p.x, p.y)), `peak ${p.x},${p.y} is not on the mountain`)
  // Between: along the ridge from one peak to the other, the gap lies strictly inside and close to it.
  const [a, b] = peaks, vx = b.x - a.x, vy = b.y - a.y
  const t = ((gap.x - a.x) * vx + (gap.y - a.y) * vy) / (vx * vx + vy * vy)
  const off = Math.abs((gap.x - a.x) * vy - (gap.y - a.y) * vx) / Math.hypot(vx, vy)
  assert.ok(t > 0 && t < 1 && off <= 2, `gap ${gap.x},${gap.y} is not between the peaks (t ${t.toFixed(2)}, ${off.toFixed(2)} off)`)
  // toward small x: the top corner on screen
  const mx = [...cells].reduce((s, k) => s + at(k)[0], 0) / cells.size
  assert.ok(mx < (W + 10) / 2 - 5, `the mountain's middle is at x ${mx.toFixed(1)}`)
})

test('the river runs from the mountain gap down the left strip into the lake', () => {
  const { cells, line } = island.river
  assert.ok(connected(cells), 'the river is one stream')
  for (const k of cells) {
    const [x, y] = at(k)
    assert.ok(has(x, y), `river tile ${k} is off the island`)
    assert.ok(x < 0 || y > H, `river tile ${k} is neither in the left strip nor on the front lawn`)
    assert.ok(!island.pond.cells.has(k) && !island.mountain.cells.has(k), `river tile ${k} is also lake or mountain`)
  }
  const { gap } = island.mountain
  const [hx, hy] = line[0].map(Math.floor)
  const head = [...cells].map(at).filter(([, y]) => y === hy)
  assert.ok(head.length && head.every(([x]) => Math.abs(x - hx) <= 1), `the line starts at ${line[0]}, off the river head`)
  assert.ok(head.some(([x, y]) => Math.max(Math.abs(x - gap.x), Math.abs(y - gap.y)) <= 2), 'the river head is not under the gap')
  const [ex, ey] = line[line.length - 1]
  assert.ok(island.pond.cells.has(K(Math.floor(ex), Math.floor(ey))) || island.pond.cells.has(K(Math.floor(ex) - 1, Math.floor(ey))),
    `the line ends at ${ex},${ey}, not at the lake`)
  const last = Math.max(...[...cells].map((k) => at(k)[1]))
  const mouth = [...cells].map(at).filter(([, y]) => y === last)
  assert.ok(mouth.some(([x, y]) => island.pond.cells.has(K(x, y + 1))), 'the river does not flow into the lake')
  // two tiles wide on every row, with a bank on each side
  const rows = new Map()
  for (const k of cells) { const [x, y] = at(k); rows.set(y, [...(rows.get(y) || []), x]) }
  for (const [y, xs] of rows) {
    assert.equal(xs.length, 2, `row ${y} of the river is ${xs.length} tiles wide`)
    if (y < 0 || y > H) continue
    assert.ok(has(Math.min(...xs) - 1, y) && has(Math.max(...xs) + 1, y), `row ${y} of the river has no bank`)
  }
})

test('the lake is on the front lawn and feeds the main waterfall on the front shore', () => {
  const { cells, spots } = island.pond
  assert.ok(cells.size >= 20, `the lake is only ${cells.size} tiles`)
  assert.ok(connected(cells), 'the lake is one body of water')
  for (const k of cells) assert.ok(at(k)[1] > H, `lake tile ${k} is not on the front lawn`)
  const mx = [...cells].reduce((s, k) => s + at(k)[0], 0) / cells.size
  assert.ok(mx < W / 3, `the lake is not on the left of the front lawn (middle x ${mx.toFixed(1)})`)
  const { x, y } = island.waterfall
  assert.ok(has(x, y) && (!has(x, y + 1) || !has(x + 1, y)), `the waterfall at ${x},${y} is not on the shore`)
  assert.ok(cells.has(K(x, y)) || N4.some(([a, b]) => cells.has(K(x + a, y + b))), 'the waterfall is not by the lake')
  assert.equal(spots.length, 2)
  for (const s of spots) assert.ok(cells.has(K(s.x, s.y)) && walk.has(K(s.x, s.y)), `bathing spot ${s.x},${s.y}`)
})

test('the only way across the river is the bridge', () => {
  const { bridge, rest } = island
  assert.equal(bridge.cells.size, bridge.len)
  for (const k of bridge.cells) assert.ok(island.river.cells.has(k) && walk.has(k), `bridge deck ${k} does not span the river`)
  assert.ok(['x', 'y'].includes(bridge.dir))
  assert.ok(bridge.cells.has(K(bridge.x, bridge.y)))
  const path = route(walk, southFoot, [rest.bench.x, rest.bench.y])
  assert.ok(path, 'no way from the south stairs to the rest bench')
  assert.ok(path.some((k) => bridge.cells.has(k)), 'the way to the rest bench skips the bridge')
  const noBridge = new Set([...walk].filter((k) => !bridge.cells.has(k)))
  assert.ok(!reach(noBridge, southFoot).has(K(rest.bench.x, rest.bench.y)), 'the rest corner is reachable without the bridge')
  assert.ok(!reach(noBridge, southFoot).has(K(rest.fish.x, rest.fish.y)), 'the fishing spot is reachable without the bridge')
  // near the river mouth: no more than 4 rows of river below the bridge
  const last = Math.max(...[...island.river.cells].map((k) => at(k)[1]))
  assert.ok(last - bridge.y <= 4, `the bridge is ${last - bridge.y} rows above the river mouth`)
})

test('the rest corner sits on the far bank by the lake', () => {
  const { bench, fish } = island.rest
  for (const p of [bench, fish]) assert.ok(walk.has(K(p.x, p.y)), `rest spot ${p.x},${p.y} is not walkable`)
  assert.ok(N4.some(([a, b]) => island.pond.cells.has(K(fish.x + a, fish.y + b))), 'the fishing spot is not at the water')
  assert.ok(Math.hypot(bench.x - fish.x, bench.y - fish.y) <= 3, 'the bench is far from the fishing spot')
  const riverX = Math.min(...[...island.river.cells].map((k) => at(k)[0]))
  assert.ok(bench.x < riverX && fish.x < riverX, 'the rest corner is not across the river')
})

test('the back lawn is reachable on foot', () => {
  const seen = reach(walk, southFoot)
  const back = [...seen].filter((k) => at(k)[1] <= -3 && !island.mountain.cells.has(k))
  assert.ok(back.length > 50, `only ${back.length} back-lawn tiles reachable`)
  // the far bank's lane runs on up to the foot of the mountain
  const far = [...seen].filter((k) => at(k)[1] <= -3 && at(k)[0] < Math.min(...[...island.river.cells].map((c) => at(c)[0])))
  assert.ok(far.length > 0, 'the far bank does not reach the back lawn')
  for (const k of [...island.mountain.cells, ...island.river.cells]) if (!island.bridge.cells.has(k)) assert.ok(!walk.has(k), `${k} is walkable`)
})

test('lamps stand at each end of the bridge and beside the stone path', () => {
  const { lamps, bridge, paths } = island
  assert.ok(lamps.length >= 3)
  const ends = bridge.dir === 'x'
    ? [[bridge.x - 1, bridge.y], [bridge.x + bridge.len, bridge.y]]
    : [[bridge.x, bridge.y - 1], [bridge.x, bridge.y + bridge.len]]
  for (const [x, y] of ends) assert.ok(lamps.some((l) => Math.max(Math.abs(l.x - x), Math.abs(l.y - y)) === 1), `no lamp at the bridge end ${x},${y}`)
  for (const l of lamps) {
    const k = K(l.x, l.y)
    assert.ok(has(l.x, l.y), `lamp ${k} is off the island`)
    assert.ok(!paths.cells.has(k) && !walk.has(k), `lamp ${k} stands in the way`)
    assert.ok(!island.pond.cells.has(k) && !island.river.cells.has(k), `lamp ${k} is in the water`)
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
  for (const kind of ['tree', 'rock', 'flower', 'bush', 'mushroom']) assert.ok(island.decor.some((d) => d.kind === kind), `no ${kind}`)
  // a garden, not a carpet: the island is about 2.5 times the old one, which had 64 pieces
  assert.ok(island.decor.length <= 180, `${island.decor.length} pieces of decor`)
})

test('decor keeps off paths, the bridge, water, the mountain, the rest corner and the lamps', () => {
  const { rest } = island
  const off = new Set([...island.paths.cells, ...island.bridge.cells, ...island.river.cells, ...island.pond.cells,
    ...island.mountain.cells, K(rest.bench.x, rest.bench.y), K(rest.fish.x, rest.fish.y), ...island.lamps.map((l) => K(l.x, l.y))])
  const seen = new Set()
  for (const d of island.decor) {
    const k = K(d.x, d.y)
    assert.ok(!off.has(k), `${d.kind} at ${k} is in the way`)
    assert.ok(!seen.has(k), `two pieces of decor on ${k}`)
    seen.add(k)
  }
})

test('the office dogs keep off the water and the mountain, drink at the lake and sleep on their lawn', () => {
  // office-scene.js builds the dogs' places from the page's island at load; it only needs React for h().
  globalThis.React ??= { createElement: () => null }
  const { DOG_PLACES, ISLAND } = loadWeb('office-scene')
  const { roam, den, drink, clear } = DOG_PLACES
  for (const k of roam) {
    assert.ok(!ISLAND.pond.cells.has(k) && !(ISLAND.river.cells.has(k) && !ISLAND.bridge.cells.has(k)), `dogs roam the water at ${k}`)
    assert.ok(!ISLAND.mountain.cells.has(k), `dogs roam the mountain at ${k}`)
  }
  assert.ok(drink.length >= 2, 'nowhere to drink')
  for (const d of drink) assert.ok(ISLAND.pond.cells.has(K(d.tx, d.ty)) && roam.has(K(d.x, d.y)), `drink spot ${d.x},${d.y}`)
  assert.equal(den.length, 3)
  for (const [x, y] of den) assert.ok(roam.has(K(x, y)) && !clear.has(K(x, y)), `den cell ${x},${y} is not a quiet roam cell`)
})
