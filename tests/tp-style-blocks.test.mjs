// The falling-blocks teleport style (web/tp-style-blocks.js): the five four-square pieces and how they stack, the body
// colours sampled into the cells, the hops and the train, and the hand-overs between the beats. The drawing contract
// itself (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
// Paint and path ops counted on a stub context; rects logged with the fill colour they end up in.
const PAINT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage'])
const PATH = new Set(['rect', 'moveTo', 'lineTo', 'arc', 'ellipse'])
function counter() {
  const c = { paint: 0, path: 0, rects: [], open: [] }
  const s = { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '#000' }
  c.ctx = new Proxy({}, {
    get: (_, k) => k in s ? s[k] : (...a) => {
      if (k === 'beginPath') c.open = []
      if (k === 'rect') c.open.push(a)
      if (k === 'fill') (c.rects.push(...c.open.map(r => [...r, s.fillStyle])), (c.open = []))
      if (PAINT.has(k)) c.paint++
      else if (PATH.has(k)) c.path++
      return a
    },
    set: (_, k, v) => ((s[k] = v), true),
  })
  return c
}
globalThis.document ??= { createElement: () => ({ getContext: () => counter().ctx }) }
loadWeb('office')
const { Kit } = loadWeb('tp-kit')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { STYLE, BLOCKS } = loadWeb('tp-style-blocks')
const { PIECES, TURNS, BASE, C, GX, NP, sample, hop, trainAt, tumble, CELL } = BLOCKS
const { DEP, ARR, T } = TL

// A standing body as tp-person captures it, from the feet, in drawing order: shirt, sleeves, head, hair (long on the
// left side), trousers, shoes.
const BODY = [
  [-4, -11, 8, 7, 0], [-5, -11, 1, 5, 1], [4, -11, 1, 5, 1], [-3, -18, 6, 6, 2], [-3, -19, 6, 2, 3],
  [-4, -18, 1, 9, 3], [-3, -4, 2, 4, 4], [1, -4, 2, 4, 4], [-3, -1, 2, 1, 5], [1, -1, 2, 1, 5],
]
// From behind the hair covers the face rows.
const BACK = BODY.concat([[-3, -18, 6, 6, 3]])
const COLS = ['#shirt', '#sleeve', '#skin', '#hair', '#pants', '#shoes']
const ROUTE = [[2, 2], [2, 10], [12, 10], [12, 16]]
function capInto(out, rects, px, py) {
  out.cols.length = 0
  out.cols.push(...COLS)
  out.n = rects.length
  rects.forEach(([x, y, w, h, ci], k) => {
    out.x[k] = px + x
    out.y[k] = py + y
    out.w[k] = w
    out.h[k] = h
    out.c[k] = ci
  })
  return out
}
const newCap = () => ({ n: 0, cols: [], x: new Int16Array(96), y: new Int16Array(96), w: new Int16Array(96),
  h: new Int16Array(96), c: new Uint8Array(96) })
// A stand-in for the dispatcher's X: real route sampling, a stub body that a capture fills with BODY (or 66 rects).
function fakeX(v, { lite = false, hide = false, d = [0.75, 1.8, 0.8, 0.4], full = false, front = true } = {}) {
  const c = counter(), L = TL.newPhase()
  TL.phase({ u: TL.real(v, d), d, cut: null, swAt: DEP, hide }, false, L)
  const f0 = Kit.feet(...ROUTE[0]), f1 = Kit.feet(...ROUTE.at(-1))
  const X = {
    c, ctx: c.ctx, L, lite, night: false, df: 1, snow: 0, t: 2.4, start: 0, kind: 'ground',
    a: { dirFront: front, id: 3 }, G: { th: { shadow: 'rgba(0,0,0,0.45)' } },
    tp: { route: ROUTE, stool: false, desk: null }, x0: f0[0], y0: f0[1], x1: f1[0], y1: f1[1],
    tx0: ROUTE[0][0], ty0: ROUTE[0][1], tx1: ROUTE.at(-1)[0], ty1: ROUTE.at(-1)[1],
    dir0: [0.9, 0.45], dir1: [-0.9, 0.45],
    route: (p, out = [0, 0, 0, 0, false]) => Kit.along(ROUTE, 0, p, out),
    hash: (k, s) => Kit.hash(3, k, s),
    passes: 0,
    bodyAt() { X.passes++ },
    body() { X.passes++ },
    capture(o, out) {
      X.passes++
      const rects = full
        ? Array.from({ length: 66 }, (_, k) => [(k % 8) - 4, -(k % 21) - 1, 1, 1, k % 6])
        : o.front === false ? BACK : BODY
      return capInto(out, rects, ...o.at)
    },
  }
  return X
}
// Every item the style would draw this frame, as the dispatcher would call them.
function frame(X) {
  const n = STYLE.need(X)
  for (const end of [0, 1]) {
    if (n & (end ? 2 : 1)) STYLE.back(X, end)
    if (n & (end ? 32 : 16)) STYLE.stand(X, end)
  }
  if (n & 64) STYLE.trip(X)
  STYLE.person(X)
  return X
}
const key = (col, row) => `${col},${row}`
const coloured = X => X.c.rects.filter(r => COLS.includes(r[4])).map(r => r.join()).sort()

test('five connected four-square pieces fill the stack once, and each drops straight into its slot', () => {
  const seen = new Set()
  for (const cells of PIECES) {
    assert.equal(cells.length, 4)
    for (const [c, r] of cells) {
      assert.ok(!seen.has(key(c, r)), `cell ${c},${r} once`)
      seen.add(key(c, r))
    }
    // 4-connected
    const reach = new Set([key(...cells[0])])
    for (let k = 0; k < 4; k++)
      for (const [c, r] of cells)
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(key(c + dx, r + dy)))) reach.add(key(c, r))
    assert.equal(reach.size, 4, 'connected')
  }
  assert.equal(seen.size, 20)
  // dropped from high above in lock order, each piece stops exactly at its slot
  const filled = new Set()
  PIECES.forEach((cells, k) => {
    let off = 12
    while (cells.every(([c, r]) => r + off - 1 >= 0 && !filled.has(key(c, r + off - 1)))) off--
    assert.equal(off, 0, `piece ${k} rests in its slot`)
    for (const [c, r] of cells) filled.add(key(c, r))
  })
  // turns are quarter turns: the box swaps, the cells stay four
  TURNS.forEach((turns, k) => {
    assert.equal(turns.length, 4)
    for (let q = 0; q < 4; q++) {
      assert.equal(turns[q].length, 12)
      const box = q & 1 ? [turns[0].h, turns[0].w] : [turns[0].w, turns[0].h]
      assert.deepEqual([turns[q].w, turns[q].h], box, `piece ${k} turn ${q}`)
    }
  })
  assert.deepEqual(BASE[0], [1, 0], 'the legs stand on the feet')
})

test('each cell takes the body colour of the band it stands for', () => {
  sample(capInto(newCap(), BODY, 0, 0))
  const colOf = (p, c, r) => COLS[CELL[4 * p + PIECES[p].findIndex(x => x[0] === c && x[1] === r)]]
  for (const [c, r] of PIECES[0]) assert.equal(colOf(0, c, r), '#pants', `legs ${c},${r}`)
  for (const p of [1, 2, 3]) for (const [c, r] of PIECES[p]) assert.equal(colOf(p, c, r), '#shirt', `torso ${c},${r}`)
  assert.equal(colOf(4, 1, 5), '#skin')
  assert.equal(colOf(4, 2, 5), '#skin')
  assert.equal(colOf(4, 1, 6), '#hair')
  assert.equal(colOf(4, 2, 6), '#hair')
  // the stack is as wide as the body and its arms (12 px), centred on the feet
  assert.equal(GX, -6)
  assert.equal(C, 3)
})

test('hops end on their slot, on 3 px steps, never below the lower end', () => {
  for (const [l0, b0, l1, b1] of [[100, 200, 130, 170], [130, 170, 100, 200], [50, 50, 50, 41]]) {
    const start = [l1 + Math.round((l0 - l1) / C) * C, b1 - Math.round((b1 - b0) / C) * C]
    assert.deepEqual([...hop(0, l0, b0, l1, b1)].slice(0, 2), start)
    assert.deepEqual([...hop(1, l0, b0, l1, b1)].slice(0, 2), [l1, b1])
    for (let t = 0; t <= 1; t += 0.05) {
      const [x, y] = hop(t, l0, b0, l1, b1)
      assert.equal(Math.abs((x - l1) % C), 0)
      assert.equal(Math.abs((y - b1) % C), 0)
      assert.ok(y <= Math.max(b0, b1) + 1)
    }
  }
})

test('the train: off where the hops land, the legs end on the landing, the rest tumble to lie on their side', () => {
  for (const len of [8, 24.5, 58])
    for (let k = 0; k < NP; k++) {
      assert.equal(trainAt(k, 0, len), 0.5 + (NP - 1 - k) * 0.375)
      assert.equal(trainAt(k, 1, len), len - k * 0.375)
      let last = -1
      for (let t = 0; t <= 1; t += 0.02) {
        assert.ok(trainAt(k, t, len) >= last, 'never backwards')
        last = trainAt(k, t, len)
      }
    }
  for (const T1 of [0.8, 1.5, 2]) {
    for (let k = 0; k < NP; k++) {
      assert.equal(tumble(k, 0, T1), 1, `piece ${k} sets off on its side`)
      assert.equal(tumble(k, 1, T1), k ? 1 : 0, `piece ${k} arrives`)
    }
    let turns = 0
    const rot = t => tumble(2, Math.max(0, t), T1) & 3
    for (let t = 0; t <= 1; t += 0.001) if (rot(t) !== rot(t - 0.001)) turns++
    assert.ok(turns >= 4, `tumbles (T1 ${T1})`)
  }
})

test('one body pass a frame, nothing at the walker in the trip, the usual person from the release', () => {
  for (const v of [0.06, 0.1, 0.2, 0.3, 0.4, 0.45, 0.6, 0.8, 0.88, 0.91])
    assert.ok(frame(fakeX(v)).passes <= 1, `core ${v}`)
  assert.equal(STYLE.person(fakeX(0.02)), false, 'standing as usual before the flicker')
  for (const v of [0.45, 0.5]) {
    const X = fakeX(v)
    assert.equal(STYLE.person(X), true)
    assert.equal(X.passes + X.c.paint, 0, 'nothing at the landing walker in the trip')
  }
  assert.equal(STYLE.person(fakeX(T.RELEASE)), false)
  const hid = fakeX(0.35, { hide: true })
  assert.equal(STYLE.person(hid), true)
  assert.equal(hid.passes + hid.c.paint, 0, 'a stall user is not seen before the trip')
  assert.equal(STYLE.need(Object.assign(fakeX(0.5), { L: { ...fakeX(0.5).L, q: 1 } })), 0, 'queued: nothing')
})

test('the beats hand over without a jump: departure to train, train to the landing queue', () => {
  for (const front of [true, false]) handover(front)
})
// The pieces keep their colours across the beats whichever way the person faces at either end.
function handover(front) {
  const d = [0.75, 1.8, 0.8, 0.4],
    at = v => fakeX(v, { front })
  // the last hop has landed (its lock flash aside) where the train sets off
  const dep = at(TL.core(TL.real(DEP, d) - 1e-4, d)), trip = at(DEP + 1e-9)
  STYLE.person(dep)
  STYLE.trip(trip)
  assert.deepEqual(coloured(dep), coloured(trip))
  const end = at(TL.core(TL.real(ARR, d) - 1e-4, d)), arr = at(ARR + 1e-9)
  STYLE.trip(end)
  STYLE.person(arr)
  assert.deepEqual(coloured(end), coloured(arr))
}

test('the stack: the person comes out of it where the pieces were, its face to the viewer either way', () => {
  const X = fakeX(TL.core(TL.real(ARR, [0.75, 1.8, 0.8, 0.4]) + 0.6, [0.75, 1.8, 0.8, 0.4]))
  STYLE.person(X)
  const cells = X.c.rects.filter(r => COLS.includes(r[4]))
  assert.equal(cells.length, 20, 'all twenty cells stacked')
  for (const r of cells) {
    assert.equal((r[0] - X.x1 - GX) % C, 0)
    assert.equal((X.y1 - r[1]) % C, 0)
    assert.ok(r[0] >= X.x1 - 6 && r[0] + 3 <= X.x1 + 6 && r[1] >= X.y1 - 21 && r[1] + 3 <= X.y1)
  }
  assert.equal(X.c.rects.filter(r => r[4] === '#1d1b26').length, 2, 'two eyes')
  const back = fakeX(X.L.u, { front: false })
  STYLE.person(back)
  assert.equal(back.c.rects.filter(r => r[4] === '#1d1b26').length, 2, 'the same face for someone seen from behind')
  assert.deepEqual(coloured(back), coloured(X))
})

test('within the budget with a full 66-rect body, in a crowd too', () => {
  for (let v = -0.1; v < T.END; v += 0.01)
    for (const lite of [false, true]) {
      const X = frame(fakeX(v, { lite, full: true }))
      assert.ok(X.c.paint <= (lite ? 30 : 60), `core ${v.toFixed(2)} paint ${X.c.paint}`)
      assert.ok(X.c.path <= 400, `core ${v.toFixed(2)} path ${X.c.path}`)
    }
})

test('a piece casts its 1 px shadow only near the ground, never as a dash far under a hop', () => {
  const d = [0.75, 1.8, 0.8, 0.4]
  // shadow rects: black, 1 px tall, at least a two-cell piece wide (the bevel's dark corners are at most 2 px)
  const shadows = X => X.c.rects.filter(r => r[4] === '#000000' && r[3] === 1 && r[2] >= 6).length
  // the head near the top of its hop, the rest still in the stack
  const hopping = frame(fakeX(TL.core(TL.real(0, d) + 0.49 * d[0], d), { d }))
  assert.equal(shadows(hopping), 0)
  const sliding = frame(fakeX(TL.core(TL.real(DEP, d) + 0.5 * d[1], d), { d }))
  assert.equal(shadows(sliding), NP)
})

test('a cut fades the stack back into the person once, without replaying the flicker', () => {
  const d = [0.75, 1.8, 0.8, 0.4]
  for (const c of [0.3 * DEP, 0.6 * DEP, DEP - 0.01]) {
    const cut = TL.real(c, d), seen = []
    for (let s = 0; s <= T.CUT + 1e-9; s += 1 / 120) {
      const X = fakeX(0, { d })
      TL.phase({ u: cut + s, d, cut, swAt: DEP, hide: false }, false, X.L)
      let a = 0
      X.body = o => (a = o.alpha ?? 1)
      if (STYLE.person(X) === false) a = 1
      seen.push(a)
    }
    for (let k = 1; k < seen.length; k++)
      assert.ok(seen[k] >= seen[k - 1] - 1e-9, `cut ${c.toFixed(3)}: person alpha ${seen.map(x => x.toFixed(2))}`)
    assert.equal(seen.at(-1), 1)
  }
})
