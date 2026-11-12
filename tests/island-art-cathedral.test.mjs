// The Christmas landmark's still art (web/island-art-cathedral.js, web/island-art-cathedral-yard.js): Notre-Dame of
// Saigon and the statue before it, painted once as palette layers, so every pixel can be read here without a canvas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb, readWeb } from './web.mjs'

const A = loadWeb('island-art-cathedral')
const Y = loadWeb('island-art-cathedral-yard')
const { OUTLINE, STONE } = loadWeb('island-art')
const { SnowLogic } = loadWeb('snow-logic')
const { EventLandmark } = loadWeb('event-landmark')
const { CATHEDRAL_EXT: EXT, CATHEDRAL_PAL: PAL, cathedralQ: Q, cathedralLayer, cathedralLights } = A
const { LADY_EXT, LADY_PAL, yardLayer, yardLights } = Y

const LEVELS = [1, 2, 3], DEPTHS = [0, 1, 2, 3]
const every = fn => { for (const level of LEVELS) for (const depth of DEPTHS) fn(level, depth, `level ${level}, depth ${depth}`) }
const SNOW = new Set([SnowLogic.PAL.lit, SnowLogic.PAL.base, SnowLogic.PAL.shade])
// the colour at a pixel of a palette layer, or null where it is clear
const at = (L, x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h || !L.idx[y * L.w + x] ? null : L.keys[L.idx[y * L.w + x] - 1][0])
const count = (L, ...colours) => { let n = 0; for (const k of L.idx) if (k && colours.includes(L.keys[k - 1][0])) n++; return n }
const countIf = (L, has) => { let n = 0; for (const k of L.idx) if (k && has(L.keys[k - 1][0])) n++; return n }
// the colours down one column from its first painted pixel, runs of one colour folded into one
const column = (L, x) => { const out = []; for (let y = 0; y < L.h; y++) { const c = at(L, x, y); if (c && out[out.length - 1] !== c) out.push(c) } return out }
const topRow = (L, x, colours) => { for (let y = 0; y < L.h; y++) { const c = at(L, x, y); if (c && (!colours || colours.includes(c))) return y } return -1 }
const fits = (L, what) => {
  for (let x = 0; x < L.w; x++) assert.ok(!at(L, x, 0) && !at(L, x, L.h - 1), `${what}: column ${x} touches the top or bottom edge`)
  for (let y = 0; y < L.h; y++) assert.ok(!at(L, 0, y) && !at(L, L.w - 1, y), `${what}: row ${y} touches the left or right edge`)
}
const BRICKS = [PAL.BRICK.left, PAL.BRICK.right, PAL.BRICK.joint, PAL.BRICK.jointR]
const ZINCS = [PAL.ZINC.left, PAL.ZINC.mid, PAL.ZINC.right, PAL.ZINC.seam]
const GLASSES = [PAL.GLASS.dark, PAL.GLASS.glint, ...PAL.GLASS.specks]
const FIRS = [PAL.FIR.dark, PAL.FIR.lit]
const TOWERS = [EventLandmark.MASS[1], EventLandmark.MASS[2]].map(([i0, i1, j0, j1]) => [(i0 + i1) / 2, (j0 + j1) / 2])

test('it fits its sprite', () => {
  assert.deepEqual(EXT, [64, 110, 60, 10])
  every((level, depth, what) => {
    const L = cathedralLayer(level, depth)
    assert.equal(L.w, EXT[0] + EXT[2])
    assert.equal(L.h, EXT[1] + EXT[3])
    fits(L, what)
  })
  // and hangs on the middle of its tile: the local frame's (3.5, 3.5) is the anchor
  assert.deepEqual(Q(3.5, 3.5, 0), [EXT[0], EXT[1]])
  assert.deepEqual(EventLandmark.SITE.at, [EventLandmark.SITE.x + 3, EventLandmark.SITE.y + 3])
})

// clear pixels the sprite's edge cannot reach through clear pixels: a hole the lawn behind would show through
const holes = L => {
  const seen = new Uint8Array(L.w * L.h), q = []
  const visit = (x, y) => { const i = y * L.w + x; if (x >= 0 && y >= 0 && x < L.w && y < L.h && !L.idx[i] && !seen[i]) { seen[i] = 1; q.push(x, y) } }
  for (let x = 0; x < L.w; x++) { visit(x, 0); visit(x, L.h - 1) }
  for (let y = 0; y < L.h; y++) { visit(0, y); visit(L.w - 1, y) }
  for (let n = 0; n < q.length; n += 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) visit(q[n] + dx, q[n + 1] + dy)
  let n = 0
  for (let i = 0; i < seen.length; i++) if (!L.idx[i] && !seen[i]) n++
  return n
}

test('nothing shows through it', () => {
  // (the statue's sprite is left out: the lawn is meant to show between the crib and the pedestal)
  every((level, depth, what) => assert.equal(holes(cathedralLayer(level, depth)), 0, `${what}: the cathedral has a hole`))
})

test('two towers, each with a pale spire and a cross, taller than the nave', () => {
  assert.deepEqual(TOWERS, [[0.75, 3.5], [3.25, 3.5]])
  every((level, depth, what) => {
    const L = cathedralLayer(level, depth)
    // the nave's ridge, read at its far end where nothing stands before it: how high it is over its own foot
    const [rx, ry] = Q(2, 0.25, 0)
    const roofTop = topRow(L, rx - 1, [PAL.ROOF.left, PAL.ROOF.right, PAL.ROOF.course, ...SNOW])
    assert.ok(roofTop > 0, `${what}: no roof at the ridge's far end`)
    const ridge = ry - roofTop
    assert.ok(ridge >= 30 && ridge <= 36, `${what}: the ridge is ${ridge} px up`)
    for (const [ci, cj] of TOWERS) {
      const [x, foot] = Q(ci, cj, 0), col = column(L, x)
      assert.deepEqual(col.slice(0, 2), [OUTLINE, PAL.CROSS], `${what}: the tower at ${ci} is topped by ${col.slice(0, 2)}`)
      const zinc = col.findIndex(c => ZINCS.includes(c)), brick = col.findIndex(c => BRICKS.includes(c))
      assert.ok(zinc > 1 && brick > zinc, `${what}: no spire over the brick of the tower at ${ci}`)
      assert.ok(topRow(L, x, ZINCS) < topRow(L, x, BRICKS), `${what}: zinc above the highest brick at ${ci}`)
      const tall = foot - topRow(L, x, [PAL.CROSS])
      assert.equal(tall, 85, `${what}: the cross tip of the tower at ${ci}`)
      assert.ok(tall - ridge >= 30, `${what}: the tower at ${ci} is ${tall} px, the ridge ${ridge}`)
    }
  })
})

test('red brick, one outline colour, three doors, a rose window and a clock', () => {
  const { roseAt } = cathedralLights()
  every((level, depth, what) => {
    const L = cathedralLayer(level, depth)
    assert.ok(count(L, ...BRICKS) > 1500, `${what}: ${count(L, ...BRICKS)} brick pixels`)
    assert.ok(count(L, OUTLINE) > 300, `${what}: no outline`)
    for (const [c] of L.keys) assert.match(c, /^#[0-9a-fA-F]{6}$/, `${what}: ${c}`)
    // door wood (its dark leaves too) along the foot of the facade: three runs of columns, the middle one the widest
    const runs = []
    for (let x = 0, open = false; x < L.w; x++) {
      let wood = false
      for (let y = 0; y < L.h; y++) if ([PAL.DOOR.wood, PAL.DOOR.dark].includes(at(L, x, y))) wood = true
      if (wood && !open) runs.push([x, x])
      if (wood) runs[runs.length - 1][1] = x
      open = wood
    }
    assert.equal(runs.length, 3, `${what}: doors at ${JSON.stringify(runs)}`)
    const wide = runs.map(([a, b]) => b - a + 1)
    assert.ok(wide[1] > wide[0] && wide[1] > wide[2], `${what}: door widths ${wide}`)
    // the rose window: stone tracery through its middle, glass all round it
    assert.equal(at(L, roseAt[0], roseAt[1]), PAL.TRIM.left, `${what}: the rose's middle`)
    let glass = 0
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (GLASSES.includes(at(L, roseAt[0] + dx, roseAt[1] + dy))) glass++
    assert.ok(glass >= 30, `${what}: ${glass} glass pixels in the rose`)
    assert.equal(count(L, ...PAL.GLASS.specks), 4, `${what}: the rose's coloured specks`)
    assert.ok(count(L, PAL.CLOCK) >= 6, `${what}: no clock face`)
  })
})

test('snow follows the depth', () => {
  for (const level of LEVELS) {
    const n = DEPTHS.map(d => countIf(cathedralLayer(level, d), c => SNOW.has(c)))
    assert.equal(n[0], 0, `level ${level}: snow on a bare day`)
    assert.ok(n[1] > 300 && n[2] > n[1] && n[3] > n[2], `level ${level}: snow pixels by depth ${n}`)
  }
})

test('each level adds, never removes', () => {
  for (const depth of DEPTHS) {
    const [l1, l2, l3] = LEVELS.map(level => cathedralLayer(level, depth))
    const fir = [l1, l2, l3].map(L => count(L, ...FIRS))
    assert.ok(fir[0] >= 20, `depth ${depth}: no wreath at level 1`)
    assert.ok(fir[1] > fir[0] + 40, `depth ${depth}: garlands and firs at level 2 (${fir})`)
    assert.ok(fir[2] >= fir[1], `depth ${depth}: level 3 keeps them (${fir})`)
    assert.ok(count(l1, PAL.BOW) > 0 && count(l2, PAL.BOW) > count(l1, PAL.BOW), `depth ${depth}: bows`)
    assert.deepEqual([l1, l2, l3].map(L => count(L, PAL.STAR) > 0), [false, false, true], `depth ${depth}: the star`)
    // nothing painted at one level is clear at the next
    for (const [a, b] of [[l1, l2], [l2, l3]]) for (let i = 0; i < a.idx.length; i++) assert.ok(!a.idx[i] || b.idx[i], `depth ${depth}: pixel ${i} lost`)
  }
})

test('bulbs lie on the building and stay small', () => {
  const { facade, eave, rose, star, panes } = cathedralLights()
  assert.deepEqual([facade.length, eave.length, rose.length], [20, 16, 12])
  every((level, depth, what) => {
    const L = cathedralLayer(level, depth)
    for (const [name, list] of [['facade', facade], ['eave', eave], ['rose', rose]]) {
      assert.ok(list instanceof Float32Array, name)
      for (let i = 0; i < list.length; i += 2) {
        assert.ok(Number.isInteger(list[i]) && Number.isInteger(list[i + 1]), `${name} bulb ${i / 2} is off the pixel grid`)
        assert.ok(at(L, list[i], list[i + 1]), `${what}: ${name} bulb ${i / 2} hangs in the air at ${list[i]},${list[i + 1]}`)
      }
    }
    // the windows that glow after dark: whole rectangles inside the sprite, every pixel glass or the clock's face
    assert.ok(panes.length >= 40 * 4 && panes.length % 4 === 0, `${panes.length / 4} panes`)
    for (let n = 0; n < panes.length; n += 4) {
      const [x, y, w, h] = panes.slice(n, n + 4)
      assert.ok(x > 0 && y > 0 && w > 0 && h > 0 && x + w < L.w && y + h < L.h, `pane ${n / 4} at ${x},${y} ${w}x${h}`)
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        const c = at(L, x + dx, y + dy)
        assert.ok(GLASSES.includes(c) || c === PAL.CLOCK, `${what}: pane ${n / 4} lights ${c} at ${x + dx},${y + dy}`)
      }
    }
  })
  // the star's lit pixels are the baked star's
  const L3 = cathedralLayer(3, 0)
  for (const [dx, dy] of [[-1, 0], [1, 4], [-3, 2], [3, 2]]) assert.equal(at(L3, star[0] + dx, star[1] + dy), PAL.STAR, `star at ${dx},${dy}`)
  // the same tables every time: they are read every frame
  assert.equal(cathedralLights(), cathedralLights())
})

test('painted once', () => {
  assert.equal(cathedralLayer(3, 2), cathedralLayer(3, 2))
  assert.notEqual(cathedralLayer(3, 2), cathedralLayer(3, 1))
  assert.notEqual(cathedralLayer(3, 2), cathedralLayer(2, 2))
  const fresh = A.paintCathedral(3, 2).L
  assert.notEqual(fresh, cathedralLayer(3, 2))
  assert.deepEqual(fresh.idx, cathedralLayer(3, 2).idx)
  assert.deepEqual(fresh.keys, cathedralLayer(3, 2).keys)
  // a level or depth outside the event's own falls back on the nearest
  assert.equal(cathedralLayer(9, 7), cathedralLayer(3, 3))
  assert.equal(cathedralLayer(0, -1), cathedralLayer(1, 0))
})

test('the statue', () => {
  assert.deepEqual(LADY_EXT, [18, 30, 18, 8])
  const CRIB = [LADY_PAL.CRIB.wall, LADY_PAL.CRIB.thatch, LADY_PAL.CRIB.light]
  const { halo, manger } = yardLights()
  every((level, depth, what) => {
    const L = yardLayer(level, depth)
    assert.equal(L.w, LADY_EXT[0] + LADY_EXT[2])
    assert.equal(L.h, LADY_EXT[1] + LADY_EXT[3])
    fits(L, what)
    assert.equal(yardLayer(level, depth), L)
    // down the middle: outline, the white figure, then the stone pedestal under her
    const col = column(L, LADY_EXT[0] - 1)
    assert.deepEqual(col.slice(0, 2), [OUTLINE, LADY_PAL.lit], `${what}: ${col}`)
    const stone = col.findIndex(c => c === STONE.light || c === STONE.mid)
    assert.ok(stone > 1, `${what}: no pedestal under the figure (${col})`)
    assert.ok(count(L, LADY_PAL.lit, LADY_PAL.shade) >= 40, `${what}: the figure`)
    assert.ok(topRow(L, LADY_EXT[0] - 1, [LADY_PAL.lit]) < topRow(L, LADY_EXT[0] - 1, [STONE.light, STONE.mid]), what)
    assert.equal(count(L, ...CRIB) > 0, level >= 2, `${what}: the crib`)
    assert.equal(countIf(L, c => SNOW.has(c)) > 0, depth > 0, `${what}: snow on the bed`)
    assert.ok([LADY_PAL.lit, LADY_PAL.shade].includes(at(L, halo[0], halo[1])), `${what}: the halo is off the figure`)
    if (level >= 2)
      for (let dy = 0; dy < manger[3]; dy++) for (let dx = 0; dx < manger[2]; dx++)
        assert.equal(at(L, manger[0] + dx, manger[1] + dy), LADY_PAL.CRIB.light, `${what}: the manger's light`)
  })
})

// A document that hands out bare canvases: enough for paletteLayer.paint, which a bake recolours the layer with.
function withCanvas(fn) {
  const had = Object.hasOwn(globalThis, 'document'), old = globalThis.document
  const made = []
  globalThis.document = {
    createElement: () => {
      const cv = { width: 0, height: 0, put: [] }
      cv.getContext = () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (img, ...where) => cv.put.push([img, ...where]),
      })
      made.push(cv)
      return cv
    },
  }
  try { return fn(made) } finally { if (had) globalThis.document = old; else delete globalThis.document }
}

test('the bake stamps each whole sprite, outline included, at its anchor', () => {
  const P = (x, y, z = 0) => [500 + (x - y) * 16, 300 + (x + y) * 8 - z]
  for (const [draw, layer, ext, tile] of [
    [A.drawCathedral, cathedralLayer, EXT, EventLandmark.SITE.at],
    [Y.drawOurLady, yardLayer, LADY_EXT, EventLandmark.SITE.lady],
  ]) withCanvas(made => {
    const stamps = [], shadows = [], tones = new Set()
    const ctx = { imageSmoothingEnabled: true, drawImage: (cv, x, y) => stamps.push([cv, x, y, ctx.imageSmoothingEnabled]) }
    const pt = { ctx, poly: (pts, c) => shadows.push([pts, c, stamps.length]) }
    const T = c => (tones.add('T' + c), '#102030'), S = c => (tones.add('S' + c), '#f0f0f0')
    draw(pt, P, T, S, 2, 3, tile)
    const L = layer(3, 2), [ax, ay] = P(tile[0] + 0.5, tile[1] + 0.5, 0)
    assert.equal(stamps.length, 1)
    const [cv, x, y, smooth] = stamps[0]
    assert.deepEqual([x, y, smooth], [ax - ext[0], ay - ext[1], false])
    assert.equal(ctx.imageSmoothingEnabled, true, 'smoothing is put back')
    assert.deepEqual([cv.width, cv.height], [L.w, L.h])
    // every painted pixel reaches the canvas, the outline's top row too
    assert.equal(cv.put.length, 1)
    const [img, , , , dy, w, h] = cv.put[0], data = img.data
    assert.equal(w, L.w)
    for (let i = 0; i < L.idx.length; i++) {
      const row = Math.floor(i / L.w)
      assert.equal(data[i * 4 + 3], L.idx[i] ? 255 : 0, `pixel ${i}`)
      if (L.idx[i]) assert.ok(row >= dy && row < dy + h, `row ${row} is painted but not put`)
      if (L.idx[i]) assert.equal(data[i * 4], SNOW.has(L.keys[L.idx[i] - 1][0]) ? 0xf0 : 0x10, `pixel ${i}: snow takes the snow's light`)
    }
    assert.ok(tones.has('T' + OUTLINE) && tones.has('S' + SnowLogic.PAL.lit) && !tones.has('T' + SnowLogic.PAL.lit))
    // the cathedral's shadow lies on the ground, drawn before the stamp
    if (draw === A.drawCathedral) {
      assert.equal(shadows.length, 1)
      assert.match(shadows[0][1], /^rgba\(/)
      assert.equal(shadows[0][2], 0, 'the shadow goes down first')
      for (const [sx, sy] of shadows[0][0]) assert.ok(sx >= ax - ext[0] && sx <= ax + ext[2] && sy >= ay - ext[1] && sy <= ay + ext[3], `shadow point ${sx},${sy}`)
    }
  })
})

test('the landmark is baked only inside the event block, and lit only from the event\'s own items', () => {
  const sky = readWeb('sky-island')
  const block = sky.indexOf('if (env.event && env.block) {')
  assert.ok(block > 0)
  for (const name of ['EventLandmark.site(', 'drawCathedral(', 'drawOurLady(']) {
    const uses = [...sky.matchAll(new RegExp(name.replace(/[.(]/g, '\\$&'), 'g'))].map(m => m.index)
    assert.equal(uses.length, 1, `${name} is called once`)
    assert.ok(uses[0] > block, `${name} is outside the event block`)
  }
  // nothing after the block but the return, so the calls are inside it
  assert.match(sky.slice(block), /^if \(env\.event && env\.block\) \{[\s\S]*drawOurLady\([\s\S]*?\n {2}\}\n {2}return out;\n\}\n$/)
  const xmas = readWeb('office-draw-xmas')
  const items = /\n {4}xmasItems\(G, items, ev\) \{\n([\s\S]*?)\n {4}\}\n/.exec(xmas)
  assert.ok(items, 'xmasItems')
  assert.match(items[1], /this\.cathedralItems\(G, items, ev\);/)
  // the mixin reads nothing of the scene but the reduced-motion flag, and adds its items after the baked props'
  const mix = readWeb('office-draw-cathedral')
  assert.deepEqual([...new Set([...mix.matchAll(/\bthis\.(\w+)/g)].map(m => m[1]))], ['env'])
  assert.match(mix, /^import '\.\/office-draw-xmas\.js';$|^import \{[^}]*\} from '\.\/office-draw-xmas\.js';$/m)
  assert.doesNotMatch(xmas, /office-draw-cathedral/)
})

test('the strings of bulbs keep off the windows, the doors and each other', () => {
  const { facade, eave, rose } = cathedralLights()
  const dark = [...GLASSES, PAL.CLOCK, PAL.LOUVRE, PAL.DOOR.wood, PAL.DOOR.dark]
  // a bulb is a 2 px square from its point
  const square = (list, i) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [list[i] + dx, list[i + 1] + dy])
  every((level, depth, what) => {
    const L = cathedralLayer(level, depth)
    for (const [name, list] of [['facade', facade], ['eave', eave], ['rose', rose]])
      for (let i = 0; i < list.length; i += 2) for (const [x, y] of square(list, i))
        assert.ok(!dark.includes(at(L, x, y)), `${what}: ${name} bulb ${i / 2} covers ${at(L, x, y)} at ${x},${y}`)
  })
  const taken = new Map()
  for (const [name, list] of [['facade', facade], ['eave', eave], ['rose', rose]])
    for (let i = 0; i < list.length; i += 2) for (const [x, y] of square(list, i)) {
      assert.equal(taken.get(x + ',' + y), undefined, `${name} bulb ${i / 2} lies over another at ${x},${y}`)
      taken.set(x + ',' + y, name + i)
    }
})

test("the rose's specks and the star are where the frame lights them", () => {
  const { specks, star, roseAt } = cathedralLights()
  assert.equal(specks.length, 8)
  every((level, depth, what) => {
    const L = cathedralLayer(level, depth)
    for (let n = 0; n < specks.length; n += 2)
      assert.ok(PAL.GLASS.specks.includes(at(L, specks[n], specks[n + 1])), `${what}: speck ${n / 2} lights ${at(L, specks[n], specks[n + 1])}`)
  })
  // the star's point is its top middle: over the gable's apex, in the middle of the bay, above the rose window
  const [i0, i1, , j] = EventLandmark.MASS[3]
  assert.equal(star[0], Q((i0 + i1) / 2, j, 0)[0])
  assert.equal(star[0], roseAt[0])
  for (const depth of DEPTHS) {
    const L = cathedralLayer(3, depth), down = []
    for (let dy = 0; dy < 7; dy++) down.push(at(L, star[0], star[1] + dy))
    assert.deepEqual(down, [...Array(5).fill(PAL.STAR), PAL.TRIM.dark, PAL.TRIM.dark], `depth ${depth}: the star on its pole`)
    assert.ok([PAL.TRIM.left, SnowLogic.PAL.lit].includes(at(L, star[0], star[1] + 7)), `depth ${depth}: the pole stands on the coping`)
    assert.deepEqual([-4, -3, 3, 4].map(dx => at(L, star[0] + dx, star[1] + 2) === PAL.STAR), [false, true, true, false], 'its arms')
  }
})

test("snow lies against the nave's foot and, from the second depth, on the towers' ledges", () => {
  const [nave, tower] = EventLandmark.MASS
  // a px across and b px up a wall: the nave's shaded side from its near end, the left tower's lit front
  const [sx, sy] = Q(nave[1], nave[3], 0), [fx, fy] = Q(tower[0], tower[3], 0)
  const side = (L, a, b) => at(L, sx + a, sy - Math.ceil(a / 2) - b - 1)
  const front = (L, a, b) => at(L, fx + a, fy + Math.ceil(a / 2) - b - 1)
  every((level, depth, what) => {
    const L = cathedralLayer(level, depth)
    for (const a of [8, 20, 30]) assert.equal(SNOW.has(side(L, a, 0)), depth > 0, `${what}: the nave's foot at ${a}`)
    assert.ok(BRICKS.includes(side(L, 8, 3)) && BRICKS.includes(front(L, 2, 22)), `${what}: brick above the snow`)
    for (const b of [19, 33]) assert.equal(SNOW.has(front(L, 2, b)), depth > 1, `${what}: the tower's ledge ${b} px up`)
  })
})
