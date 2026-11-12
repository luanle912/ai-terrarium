// The Christmas landmark as logic (web/event-landmark.js): where the cathedral stands on the back lawn, which cells it
// takes from people and dogs while the event is on, and how the lawn comes back when the event ends.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb, readWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
const { EventLandmark: L } = loadWeb('event-landmark')
const S = loadWeb('office-scene')
const { EventCritters: E } = loadWeb('event-critters')
const { DogLogic } = loadWeb('dog-logic')
const { DogSprites } = loadWeb('dog-sprites')
const { EventLogic } = loadWeb('event-logic')
const A = loadWeb('island-art-cathedral')
const Y = loadWeb('island-art-cathedral-yard')
const { SeasonIsland } = loadWeb('season-island')
const { SnowLogic } = loadWeb('snow-logic')
const { bfs } = loadWeb('office-util')
const { ISLAND: I, W, H } = S

const key = (x, y) => x + ',' + y
const cellsOf = keys => [...keys].map(k => k.split(',').map(Number))
const seeded = (a = 7) => () => {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
// the design's cells, written out here so the module's tables are checked against them
const FOOT = []
for (let x = 19; x <= 22; x++) for (let y = -11; y <= -8; y++) FOOT.push(key(x, y))
const BED = ['20,-6', '21,-6'], BEFORE_BED = ['20,-5', '21,-5', '22,-5']
const SHADE = ['16,-11', '17,-11', '18,-11', '17,-10', '18,-10', '18,-9', '18,-12', '19,-12', '20,-12']
// how many pieces a set of cells falls into: dogs step 8 ways without cutting a corner, people 4 ways
const pieces = (set, diagonal) => {
  const seen = new Set()
  let n = 0
  for (const k of set) {
    if (seen.has(k)) continue
    n++
    seen.add(k)
    const q = [k.split(',').map(Number)]
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i]
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const c = key(x + dx, y + dy)
        if ((!dx && !dy) || seen.has(c) || !set.has(c)) continue
        if (dx && dy && (!diagonal || !set.has(key(x + dx, y)) || !set.has(key(x, y + dy)))) continue
        seen.add(c)
        q.push([x + dx, y + dy])
      }
    }
  }
  return n
}
// everything the event and the dogs work out from the lawn, from fresh worlds so nothing kept is read back
const facts = () => {
  const pl = E.places({
    roam: S.DOG_ROAM, roamList: S.DOG_PLACES.roamList, clear: S.DOG_CLEAR, houses: S.DOG_HOUSES, stairs: S.STAIRS,
    water: I.pond.cells, skip: [],
  })
  const w = { ...pl, level: 3, eve: false, day: true, frozen: true, calm: false, now: 0, rand: seeded(), dogs: [] }
  const list = E.create(w), deer = list.filter(c => c.kind === 'reindeer')
  return {
    drop: pl.drop, edge: pl.edge, route: E.elfRoute(w),
    homes: deer.map(c => c.home), stroll: deer.map(c => c.cells),
    seat: list.filter(c => c.kind === 'santa').map(c => c.home),
    den: DogLogic.denCells(S.DOG_ROAM, [33, 8], S.DOG_CLEAR),
    rest: DogLogic.besideCell(S.DOG_ROAM, [I.rest.bench.x, I.rest.bench.y], S.DOG_CLEAR, []),
  }
}
const snapshot = () => ({ walk: [...S.LAWN_WALK], roam: [...S.DOG_ROAM], list: [...S.DOG_PLACES.roamList] })
// A dog's pixels on the scene as the page draws it (drawDog), its feet at (x, y) in tiles.
const BREEDS = Object.keys(DogSprites.BREEDS), FACING = [false, true], STILL = ['stand', 'wag', 'sit', 'lie', 'drink']
const dogPixels = (breed, pose, flip, x, y) => {
  const f = DogSprites.frame(breed, pose), [px, py] = S.PG(x, y), sx = Math.round(px), sy = Math.round(py), out = []
  f.rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.' && ch !== ' ') out.push([flip ? sx + f.ax - c : sx - f.ax + c, sy - f.h + r])
  }))
  return out
}
// A baked sprite as the bake places it: its layer at every event level and snow depth, and its corner on the scene.
const baked = (layer, ext, tile) => {
  const [x, y] = S.PG(tile[0] + 0.5, tile[1] + 0.5, 0), layers = []
  for (const level of [1, 2, 3]) for (const depth of [0, 1, 2, 3]) layers.push(layer(level, depth))
  return { layers, ox: Math.round(x) - ext[0], oy: Math.round(y) - ext[1], w: layers[0].w, h: layers[0].h }
}
// how many of those pixels one of its layers paints over
const under = (Lr, { ox, oy }, px) =>
  px.reduce((n, [x, y]) => n + (x >= ox && y >= oy && x < ox + Lr.w && y < oy + Lr.h && Lr.idx[(y - oy) * Lr.w + x - ox] ? 1 : 0), 0)

test('the cathedral stands on open lawn: sixteen cells and a flower bed, nothing else there', () => {
  assert.deepEqual(L.SITE, { x: 19, y: -11, w: 4, h: 4, at: [22, -8], z: 12, lady: [20.5, -6], ladyZ: 15.5 })
  assert.deepEqual([...L.WALK_OFF].sort(), [...FOOT, ...BED].sort())
  assert.equal(L.WALK_OFF.size, 18)
  const decor = new Map(I.decor.map(d => [key(d.x, d.y), d.kind])), lamps = new Set(I.lamps.map(l => key(l.x, l.y)))
  for (const [x, y] of cellsOf(L.WALK_OFF)) {
    const k = key(x, y)
    assert.ok(I.cells.has(k), `${k} is off the island`)
    assert.ok(!(x >= 0 && y >= 0 && x < W && y < H), `${k} is in the office`)
    assert.ok(S.LAWN_WALK.has(k) && S.DOG_ROAM.has(k), `${k} is not open lawn`)
    assert.ok(!I.paths.cells.has(k) && !S.DOG_CLEAR.has(k), `${k} is a path`)
    assert.ok(!I.pond.cells.has(k) && !I.mountain.pool.cells.has(k), `${k} is water`)
    assert.ok(!I.mountain.cells.has(k), `${k} is the mountain`)
    assert.ok(!lamps.has(k), `${k} has a lamp`)
    assert.ok(k !== key(I.rest.bench.x, I.rest.bench.y) && k !== key(I.rest.fish.x, I.rest.fish.y), `${k} is the rest corner`)
    assert.ok(!I.spots.some(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h), `${k} is an outdoor spot`)
    assert.equal(decor.get(k), undefined, `${k} has decor`)
    assert.ok(!S.behindWalls(x, y, S.DRAW_REACH), `${k} is drawn before the walls`)
  }
  assert.equal(L.site(I, { W, H }), L.SITE)
  assert.equal(L.site(I, null), null, 'an island with no office has no site')
  assert.equal(L.site({ ...I, decor: [...I.decor, { kind: 'rock', x: 20, y: -9 }] }, { W, H }), null, 'a rock in the way')
  assert.equal(L.site({ ...I, lamps: [...I.lamps, { x: 21, y: -6 }] }, { W, H }), null, 'a lamp on the bed')
  assert.equal(L.site({ ...I, spots: [...I.spots, { id: 'yard', x: 21, y: -8, w: 2, h: 2 }] }, { W, H }), null, 'a spot')
  assert.equal(L.site({ ...I, pond: { ...I.pond, cells: new Set([...I.pond.cells, '20,-6']) } }, { W, H }), null, 'water')
  assert.equal(L.site({ ...I, paths: { ...I.paths, cells: new Set([...I.paths.cells, '21,-10']) } }, { W, H }), null, 'a path')
  const stone = { ...I.mountain, cells: new Set([...I.mountain.cells, '22,-11']) }
  assert.equal(L.site({ ...I, mountain: stone }, { W, H }), null, 'the mountain')
  const pool = { ...I.mountain, pool: { ...I.mountain.pool, cells: new Set([...I.mountain.pool.cells, '19,-8']) } }
  assert.equal(L.site({ ...I, mountain: pool }, { W, H }), null, "the mountain's pool")
  assert.equal(L.site({ ...I, rest: { ...I.rest, bench: { ...I.rest.bench, x: 22, y: -9 } } }, { W, H }), null, 'the bench')
  assert.equal(L.site({ ...I, rest: { ...I.rest, fish: { ...I.rest.fish, x: 20, y: -6 } } }, { W, H }), null, 'the fishing spot')
  assert.equal(L.site(null, { W, H }), null)
  const cut = new Set(I.cells)
  cut.delete('19,-11')
  assert.equal(L.site({ ...I, cells: cut }, { W, H }), null, 'a corner past the cliff')
})

test('it is clear of everything the event uses, and of where the dogs settle', () => {
  const f = facts(), [dx, dy] = f.drop
  assert.equal(f.homes.length, 3)
  assert.equal(f.seat.length, 1)
  const near = []
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) near.push([dx + a, dy + b])
  const taken = {
    'the presents': near,
    "the elves' way": f.route,
    'a reindeer home': f.homes,
    'where a reindeer strolls': f.stroll.flat(),
    "Santa's seat": f.seat.map(c => [Math.floor(c[0]), Math.floor(c[1])]),
    'an event idle spot': S.EVENT_IDLE.spots.map(s => s.tile),
    "a leaving person's lawn": S.FATE_PLACES.lawn,
    'a snowman': SeasonIsland.snowmanTiles(I, W, H).map(m => [m.x, m.y]),
    'a snow drift': SnowLogic.drifts(I, W, H).map(d => [d.x, d.y]),
    'the den': S.DOG_PLACES.den,
    'a drinking spot': S.DOG_PLACES.drink.map(s => [s.x, s.y]),
    'the cell by the bench': [S.DOG_PLACES.rest],
    'a kennel door': S.DOG_HOUSES.map(h => h.door),
  }
  for (const [what, cells] of Object.entries(taken)) {
    assert.ok(cells.length > 0, what)
    for (const [x, y] of cells) assert.ok(!L.ROAM_OFF.has(key(x, y)), `${x},${y} is ${what}`)
  }
})

test('one depth sorts it: whoever is behind the building is drawn before it, whoever is in front after', () => {
  const { x, y, w, h, z, at, lady, ladyZ } = L.SITE
  const left = S.DOG_PLACES.roamList.filter(c => !L.ROAM_OFF.has(key(...c)))
  // behind: a cell with part of the thing in front of it on both axes; in front: the other way round
  const sorted = (x0, y0, x1, y1, back, front) => {
    let behind = 0, before = 0
    for (const [cx, cy] of left) {
      const d = cx + cy + 1
      if (cx <= x1 && cy <= y1) assert.ok(d <= back, `${cx},${cy} behind at depth ${d}`), behind++
      if (cx >= x0 && cy >= y0) assert.ok(d >= front, `${cx},${cy} in front at depth ${d}`), before++
    }
    assert.ok(behind > 0 && before > 0)
  }
  sorted(x, y, x + w - 1, y + h - 1, 11, 13)
  assert.equal(z, 12)
  assert.deepEqual(at, [x + w - 1, y + h - 1], 'hung on its front corner cell')
  sorted(20, -6, 21, -6, 15, 16)
  assert.equal(ladyZ, 15.5)
  assert.deepEqual([Math.floor(lady[0]), lady[1]], [20, -6])
})

test('the shade cells are the ones a dog would vanish in: 6 px of it or fewer left showing behind the building', () => {
  const cathedral = baked(A.cathedralLayer, A.CATHEDRAL_EXT, L.SITE.at)
  // the least a dog standing still on the middle of a cell shows, whatever its breed, pose and facing
  const least = (x, y) => {
    let min = Infinity
    for (const breed of BREEDS) for (const pose of STILL) for (const flip of FACING) {
      const px = dogPixels(breed, pose, flip, x + 0.5, y + 0.5)
      for (const Lr of cathedral.layers) min = Math.min(min, px.length - under(Lr, cathedral, px))
    }
    return min
  }
  const base = new Set([...FOOT, ...BED, ...BEFORE_BED])
  // only a dog drawn before the building can be hidden by it
  const behind = S.DOG_PLACES.roamList.filter(([x, y]) => !base.has(key(x, y)) && x + y + 1 < L.SITE.z)
  const shows = new Map(behind.map(c => [key(...c), least(...c)]))
  assert.deepEqual([...shows].filter(([, n]) => n <= 6).map(([k]) => k).sort(), [...SHADE].sort())
  for (const [k, n] of shows) assert.ok(SHADE.includes(k) || n >= 10, `${k}: a dog there shows only ${n} px`)
  assert.equal(shows.get('20,-12'), 0, 'right behind the nave a dog is gone whole')
  assert.deepEqual([...L.ROAM_OFF].sort(), [...base, ...SHADE].sort())
  assert.equal(L.ROAM_OFF.size, 30)
  for (const k of L.WALK_OFF) assert.ok(L.ROAM_OFF.has(k), k)
})

test('the cells before the bed are the ones where it would be painted over a dog drawn before the walls', () => {
  const bed = baked(Y.yardLayer, Y.LADY_EXT, L.SITE.lady)
  const before = (x, y) => S.behindWalls(Math.floor(x), Math.floor(y), S.DRAW_REACH)
  // the most of a dog at (x, y) the bed paints over, in any of the poses
  const worst = (x, y, poses) => {
    const [px, py] = S.PG(x, y)
    if (px < bed.ox - 24 || px > bed.ox + bed.w + 24 || py < bed.oy || py > bed.oy + bed.h + 24) return 0
    let max = 0
    for (const breed of BREEDS) for (const pose of poses) for (const flip of FACING) {
      const dog = dogPixels(breed, pose, flip, x, y)
      for (const Lr of bed.layers) max = Math.max(max, under(Lr, bed, dog))
    }
    return max
  }
  // a dog standing on a cell, and on its way from it to every cell it may step to, wherever it is drawn before the walls
  const over = (cx, cy, open) => {
    let n = before(cx, cy) ? worst(cx + 0.5, cy + 0.5, STILL) : 0
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if ((!dx && !dy) || !open(cx + dx, cy + dy) || (dx && dy && (!open(cx + dx, cy) || !open(cx, cy + dy)))) continue
      for (let s = 0.05; s < 1; s += 0.05) {
        const x = cx + 0.5 + dx * s, y = cy + 0.5 + dy * s
        if (before(x, y)) n = Math.max(n, worst(x, y, ['stand', 'run1', 'run2']))
      }
    }
    return n
  }
  const roams = (x, y) => S.DOG_ROAM.has(key(x, y))
  try {
    L.reserve(S.EVENT_LAND, true)
    let strip = 0
    for (const [x, y] of S.DOG_PLACES.roamList) {
      if (before(x, y)) strip++
      assert.equal(over(x, y, roams), 0, `the bed is painted over a dog on or leaving ${x},${y}`)
    }
    assert.ok(strip > 0, 'dogs do roam the strip drawn before the walls')
    // and none of the three is closed for nothing
    for (const [x, y] of cellsOf(BEFORE_BED)) {
      assert.ok(before(x, y), `${x},${y} is drawn with the sorted sprites`)
      assert.ok(over(x, y, (a, b) => (a === x && b === y) || roams(a, b)) > 0, `${x},${y}: the bed never touches a dog there`)
    }
  } finally {
    L.reserve(S.EVENT_LAND, false)
  }
})

test('the massing the art is drawn from: the nave, two towers a tile square and 48 px tall, the bay between them', () => {
  assert.equal(L.MASS.length, 4)
  assert.deepEqual(L.MASS[0], [0.375, 3.625, 0.375, 3, 22])
  assert.deepEqual([L.MASS[1], L.MASS[2]], [[0.25, 1.25, 3, 4, 48], [2.75, 3.75, 3, 4, 48]])
  assert.deepEqual(L.MASS[3], [1.25, 2.75, 3, 3.875, 33])
  for (const [i0, i1, j0, j1, ht] of L.MASS) {
    assert.ok(i0 >= 0 && i1 <= L.SITE.w && j0 >= 0 && j1 <= L.SITE.h && i0 < i1 && j0 < j1 && ht > 0, 'inside the footprint')
    for (const v of [i0, i1, j0, j1]) assert.equal((v * 8) % 1, 0, 'whole pixels')
  }
  assert.throws(() => { L.SITE.z = 0 }, TypeError)
  assert.throws(() => { L.MASS[0][4] = 0 }, TypeError)
})

test('nobody walks through it while the event is on, and everything else is where it was', () => {
  const today = facts(), was = snapshot()
  assert.equal(pieces(S.DOG_ROAM, true), 1)
  assert.equal(pieces(S.LAWN_WALK, false), 1)
  try {
    L.reserve(S.EVENT_LAND, true)
    for (const k of L.WALK_OFF) assert.ok(!S.LAWN_WALK.has(k), `${k} still walkable`)
    for (const k of L.ROAM_OFF) assert.ok(!S.DOG_ROAM.has(k), `${k} still roamed`)
    assert.ok(S.DOG_PLACES.roamList.every(c => !L.ROAM_OFF.has(key(...c))))
    assert.equal(S.LAWN_WALK.size, was.walk.length - 18)
    assert.equal(S.DOG_ROAM.size, was.roam.length - 30)
    assert.deepEqual(S.DOG_PLACES.roamList.map(c => key(...c)), [...S.DOG_ROAM], 'the list and the set still agree')
    assert.ok(S.EVENT_LAND.walk === S.LAWN_WALK && S.EVENT_LAND.roam === S.DOG_ROAM)
    assert.ok(S.DOG_ROAM === S.CRITTER_PLACES.roam && S.DOG_ROAM === S.DOG_PLACES.roam, 'one set, shared')
    assert.ok(S.EVENT_LAND.roamList === S.DOG_PLACES.roamList && S.CRITTER_PLACES.roamList === S.DOG_PLACES.roamList)
    assert.equal(pieces(S.DOG_ROAM, true), 1, 'the dogs get everywhere')
    assert.equal(pieces(S.LAWN_WALK, false), 1, 'and so do people')
    assert.deepEqual(facts(), today)
    for (const s of S.EVENT_IDLE.spots) {
      const way = bfs(S.DOOR.tile, s.tile)
      assert.ok(way.length > 0, s.act)
      for (const c of way) assert.ok(!L.WALK_OFF.has(key(...c)), `${s.act}: by way of ${c}`)
    }
  } finally {
    L.reserve(S.EVENT_LAND, false)
  }
})

test('the lawn is exactly as before once it ends, in the same order', () => {
  const was = snapshot()
  const same = () => {
    assert.deepEqual([...S.LAWN_WALK], was.walk)
    assert.deepEqual([...S.DOG_ROAM], was.roam)
    assert.equal(S.DOG_PLACES.roamList.length, was.list.length)
    assert.ok(S.DOG_PLACES.roamList.every((c, i) => c === was.list[i]), 'the very same cells, in order')
  }
  L.reserve(S.EVENT_LAND, false)
  same()
  try {
    L.reserve(S.EVENT_LAND, true)
    const on = snapshot()
    assert.notDeepEqual(on.roam, was.roam)
    assert.deepEqual(on.roam, was.roam.filter(k => !L.ROAM_OFF.has(k)), 'what is left keeps its order')
    assert.deepEqual(on.walk, was.walk.filter(k => !L.WALK_OFF.has(k)))
    L.reserve(S.EVENT_LAND, true)
    assert.deepEqual(snapshot(), on, 'asked twice, nothing more is taken')
    L.reserve(S.EVENT_LAND, false)
    same()
    L.reserve(S.EVENT_LAND, true)
    assert.deepEqual(snapshot(), on, 'and it comes back the same a second time')
  } finally {
    L.reserve(S.EVENT_LAND, false)
  }
  same()
  L.reserve(S.EVENT_LAND, false)
  same()
  // another lawn keeps its own state, and one never reserved is never touched
  const other = { walk: new Set(['19,-11', '0,30']), roam: new Set(['19,-12', '0,30']), roamList: [[19, -12], [0, 30]] }
  L.reserve(other, false)
  assert.deepEqual([[...other.walk], [...other.roam], other.roamList], [['19,-11', '0,30'], ['19,-12', '0,30'], [[19, -12], [0, 30]]])
  L.reserve(other, true)
  assert.deepEqual([[...other.walk], [...other.roam], other.roamList], [['0,30'], ['0,30'], [[0, 30]]])
  same()
  L.reserve(other, false)
  assert.deepEqual([[...other.walk], [...other.roam], other.roamList], [['19,-11', '0,30'], ['19,-12', '0,30'], [[19, -12], [0, 30]]])
})

test('dogs are shooed out and never go back', () => {
  const w = { ...S.DOG_PLACES, agents: [], hour: 12, snow: 0, calm: false, now: 0, rand: seeded(11) }
  const dogs = DogLogic.create(w), [inside, crossing, away] = dogs
  const cell = d => key(Math.floor(d.x), Math.floor(d.y))
  Object.assign(inside, { x: 20.5, y: -9.5, act: 'rest', path: [], until: Infinity, wag: true })
  Object.assign(crossing, { x: 17.5, y: -7.5, act: 'wander', speed: 1.1, path: [[18.5, -8.5], [19.5, -8.5], [20.5, -8.5], [23.5, -8.5]] })
  Object.assign(away, { x: 33.5, y: 8.5, act: 'wander', speed: 1.1, path: [[34.5, 8.5]] })
  for (const k of ['17,-8', '18,-8', '23,-9', '33,8', '34,8']) assert.ok(S.DOG_ROAM.has(k), k)
  try {
    L.reserve(S.EVENT_LAND, true, dogs)
    assert.ok(S.DOG_ROAM.has(cell(inside)), `${cell(inside)}: put down on the lawn`)
    const far = c => Math.hypot(c[0] + 0.5 - 20.5, c[1] + 0.5 + 9.5)
    assert.equal(far([inside.x - 0.5, inside.y - 0.5]), Math.min(...S.DOG_PLACES.roamList.map(far)), 'on the nearest cell')
    assert.deepEqual([inside.x % 1, Math.abs(inside.y % 1)], [0.5, 0.5], 'in the middle of it')
    for (const d of [inside, crossing]) {
      assert.deepEqual([d.act, d.path, d.until, d.wag, d.partner, d.lead], ['idle', [], 0, false, null, false])
    }
    assert.notEqual(inside.path, crossing.path, 'each its own path')
    assert.deepEqual([crossing.x, crossing.y], [17.5, -7.5], 'stopped where it stood')
    assert.deepEqual([away.act, away.path, away.x, away.y], ['wander', [[34.5, 8.5]], 33.5, 8.5], 'the third is left alone')
    // five minutes of the page's own loop: it asks again every second
    const at = dogs.map(d => [d.x, d.y]), moved = [0, 0, 0], dt = 1 / 30
    for (let i = 0; i < 300 * 30; i++) {
      w.now += dt
      if (i % 30 === 0) L.reserve(S.EVENT_LAND, true, dogs)
      DogLogic.step(dogs, w, dt)
      dogs.forEach((d, n) => {
        assert.ok(!L.ROAM_OFF.has(cell(d)), `${d.breed} at ${cell(d)} after ${w.now.toFixed(1)}s`)
        assert.ok(S.DOG_ROAM.has(cell(d)), `${d.breed} off the lawn at ${cell(d)}`)
        moved[n] += Math.hypot(d.x - at[n][0], d.y - at[n][1])
        at[n] = [d.x, d.y]
      })
    }
    for (const m of moved) assert.ok(m > 5, `a dog went ${m.toFixed(1)} tiles in five minutes`)
  } finally {
    L.reserve(S.EVENT_LAND, false)
  }
  assert.doesNotThrow(() => L.reserve(S.EVENT_LAND, false, undefined))
  assert.doesNotThrow(() => L.reserve(S.EVENT_LAND, false, null))
})

test('a game that crosses the site is called off for both dogs', () => {
  const w = { ...S.DOG_PLACES, agents: [], hour: 12, snow: 0, calm: false, now: 0, rand: seeded(3) }
  const dogs = DogLogic.create(w), [chaser, runner, third] = dogs
  Object.assign(chaser, { x: 17.5, y: -7.5, path: [] })
  Object.assign(runner, { x: 24.5, y: -8.5, path: [] })
  Object.assign(third, { x: 33.5, y: 8.5, path: [], until: Infinity })
  DogLogic.startChase(chaser, runner, w)
  chaser.path = [[18.5, -8.5], [19.5, -8.5]]
  runner.path = []
  try {
    L.reserve(S.EVENT_LAND, true, dogs)
    for (const d of [chaser, runner]) assert.deepEqual([d.act, d.path, d.partner, d.lead], ['idle', [], null, false], d.breed)
    assert.deepEqual([runner.x, runner.y], [24.5, -8.5])
    const acts = new Set()
    for (let i = 0; i < 60 * 30; i++) {
      w.now += 1 / 30
      DogLogic.step(dogs, w, 1 / 30)
      acts.add(runner.act)
    }
    assert.ok(acts.size > 1, 'the one left standing goes on with its day')
  } finally {
    L.reserve(S.EVENT_LAND, false)
  }
})

test('a game of bows and hops broken up on the site leaves nothing of it on either dog', () => {
  const w = { ...S.DOG_PLACES, agents: [], hour: 12, snow: 0, calm: false, now: 0, rand: seeded(5) }
  const dogs = DogLogic.create(w), [a, b, c] = dogs
  Object.assign(a, { x: 18.5, y: -6.5, path: [], act: 'idle', until: Infinity })
  Object.assign(b, { x: 19.5, y: -7.5, path: [], act: 'idle', until: Infinity })
  Object.assign(c, { x: 33.5, y: 8.5, path: [], act: 'idle', until: Infinity })
  DogLogic.startPlay(a, b, w)
  for (let i = 0; i < 90 && !a.playing; i++) {
    w.now += 1 / 30
    DogLogic.step(dogs, w, 1 / 30)
  }
  assert.deepEqual([a.act, a.playing, b.act, b.playing], ['play', true, 'play', true], 'the game is in full swing')
  try {
    L.reserve(S.EVENT_LAND, true, dogs)
    for (const d of [a, b]) assert.deepEqual([d.act, d.playing, d.partner, d.lead], ['idle', false, null, false], d.breed)
    // the next game: the dog waited for stands until its playmate is there, as it always did
    DogLogic.startPlay(c, b, w)
    assert.ok(c.path.length > 0, 'the playmate is still on its way')
    for (const t of [0, 0.2, 0.4, 0.7, 1.1]) assert.deepEqual([DogLogic.pose(b, t).frame.replace('wag', 'stand'), DogLogic.pose(b, t).dy], ['stand', 0])
  } finally {
    L.reserve(S.EVENT_LAND, false)
  }
})

test('a dog sent off takes only its own playmate with it', () => {
  const w = { ...S.DOG_PLACES, agents: [], hour: 12, snow: 0, calm: false, now: 0, rand: seeded(9) }
  const [inside, other, third] = DogLogic.create(w)
  // a stale pointer: `other` has long been in a game with the third dog
  Object.assign(inside, { x: 20.5, y: -9.5, act: 'idle', path: [], partner: other })
  Object.assign(other, { x: 30.5, y: 8.5, act: 'flee', path: [[31.5, 8.5]], partner: third, lead: false, wag: true })
  try {
    L.reserve(S.EVENT_LAND, true, [inside, other, third])
    assert.deepEqual([inside.act, inside.partner], ['idle', null])
    assert.deepEqual([other.act, other.path, other.partner, other.wag], ['flee', [[31.5, 8.5]], third, true], 'left to its game')
  } finally {
    L.reserve(S.EVENT_LAND, false)
  }
})

test("every island's dogs are sent off, not only those of the first to ask", () => {
  const world = seed => ({ ...S.DOG_PLACES, agents: [], hour: 12, snow: 0, calm: false, now: 0, rand: seeded(seed) })
  const first = DogLogic.create(world(1)), second = DogLogic.create(world(2))
  Object.assign(second[0], { x: 21.5, y: -8.5, act: 'rest', path: [], until: Infinity })
  try {
    L.reserve(S.EVENT_LAND, true, first)
    L.reserve(S.EVENT_LAND, true, second)
    const cell = key(Math.floor(second[0].x), Math.floor(second[0].y))
    assert.ok(S.DOG_ROAM.has(cell), `the second island's dog is still at ${cell}`)
    assert.equal(second[0].act, 'idle')
  } finally {
    L.reserve(S.EVENT_LAND, false)
  }
})

test('the page reserves the lawn whenever it works out the event, and sends its own dogs off', () => {
  const { ClaudeOffice } = loadWeb('office')
  const was = snapshot()
  const [dog] = DogLogic.create({ ...S.DOG_PLACES, agents: [], hour: 12, snow: 0, calm: false, now: 0, rand: seeded(4) })
  Object.assign(dog, { x: 20.5, y: -9.5, act: 'rest', path: [], until: Infinity })
  const page = { eventChoice: 'on', eventPreview: null, dogs: [dog] }
  try {
    assert.equal(ClaudeOffice.prototype.eventNow.call(page).level, 3)
    for (const k of L.WALK_OFF) assert.ok(!S.LAWN_WALK.has(k), `${k} still walkable`)
    for (const k of L.ROAM_OFF) assert.ok(!S.DOG_ROAM.has(k), `${k} still roamed`)
    assert.ok(S.DOG_ROAM.has(key(Math.floor(dog.x), Math.floor(dog.y))), 'its dog is put down on the lawn')
    assert.equal(dog.act, 'idle')
    page.eventChoice = 'off'
    assert.equal(ClaudeOffice.prototype.eventNow.call(page), null)
    assert.deepEqual(snapshot(), was, 'the lawn is back when the event ends')
  } finally {
    L.reserve(S.EVENT_LAND, false)
    EventLogic.block(S.BLOCK, false)
  }
  // the world view's islands work the event out with the same method, each with its own dogs
  assert.match(readWeb('island-scene'), /SCENE_METHODS = \[[^\]]*'eventNow'/)
})
