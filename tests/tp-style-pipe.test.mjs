// The pipe teleport style (web/tp-style-pipe.js): the baked pipe at every height and the beats on the core clock.
// The drawing contract itself (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { pipePixels, soilPixels, capPixels, PIPE } = loadWeb('tp-style-pipe')
const { height, sunk, pipeAlpha, soilAlpha, HM, SINK } = PIPE
const CW = 25, CX = 12, CY = 29, CH = 36
const rows = h => {
  const px = pipePixels(h), ys = []
  for (let i = 0; i < px.length; i++) if (px[i]) ys.push(Math.floor(i / CW) - CY)
  return { px, top: Math.min(...ys), bottom: Math.max(...ys) }
}
// The lowest painted row of column x (from the feet), or null.
const foot = (px, x) => {
  for (let y = CH - CY - 1; y >= -CY; y--) if (px[(y + CY) * CW + x + CX]) return y
  return null
}

test('the pipe raster: flush with the floor at 0, its top rising one px per height, a curved ground line', () => {
  const flat = rows(0)
  assert.ok(flat.top >= -6 && flat.bottom <= 6, 'a flat mouth on the floor')
  for (let h = 1; h < 24; h++) assert.equal(rows(h).top, rows(0).top - h, `top at height ${h}`)
  const { px } = rows(HM)
  // the near side meets the floor lower in the middle than at the edges, as a cylinder in this projection does
  assert.ok(foot(px, 0) > foot(px, -9) && foot(px, 0) > foot(px, 9))
  assert.ok(foot(px, 0) <= 6)
  // an opening (hole and inner wall) and an outline
  assert.ok(px.includes(7) && px.includes(8) && px.includes(1))
  assert.ok(soilPixels().some(c => c === 1) && soilPixels().some(c => c === 2))
})

test('the beats: the origin pipe pops up and sinks away, the landing pipe rises, then sinks to the floor by release', () => {
  assert.ok(Math.abs(height(0, 0)) < 1e-9)
  assert.ok(height(0.1, 0) > HM, 'overshoot')
  assert.ok(Math.abs(height(0.12, 0) - HM) < 1e-9 && height(0.3, 0) === HM)
  assert.equal(height(0.56, 0), 0)
  assert.equal(pipeAlpha(0.7, 0), 0)
  assert.ok(Math.abs(height(0.3, 1)) < 1e-9)
  assert.ok(Math.abs(height(0.43, 1) - HM) < 1e-9)
  assert.ok(height(0.9, 1) === 0 && height(TL.T.RELEASE, 1) === 0, 'level with the floor when they walk on')
  assert.equal(pipeAlpha(1.05, 1), 0)
  assert.equal(soilAlpha(TL.T.END, 1), 0)
  // never past the baked heights, no jumps between frames
  for (const end of [0, 1]) {
    let last = height(0, end)
    for (let v = 0; v <= TL.T.END; v += 0.002) {
      const h = height(v, end)
      assert.ok(h >= 0 && Math.round(h) <= 23, `height ${h} at ${v}`)
      assert.ok(Math.abs(h - last) < 2, `jump at core ${v.toFixed(3)} end ${end}`)
      last = h
    }
  }
})

test('the person: out of sight from the drop to the pop-up, standing on the rim again before the ride down', () => {
  assert.equal(sunk(0, 0).s, 0)
  assert.ok(sunk(0.06, 0).up, 'arms up riding the pipe')
  assert.ok(sunk(0.15, 0).sy < 1, 'crouch')
  assert.ok(sunk(0.22, 0).s < 0, 'the hop above the rim')
  assert.ok(sunk(0.399, 0).s >= 26)
  assert.equal(sunk(0.4, 0).show, false)
  // the switch to the landing (core 0.48 for a style with no travel) happens while nobody is seen
  assert.ok(TL.T.SWITCH > 0.4 && TL.T.SWITCH < 0.56)
  assert.equal(sunk(0.5, 1).show, false)
  assert.ok(sunk(0.56, 1).s >= SINK)
  assert.ok(sunk(0.7, 1).s < 0 && sunk(0.7, 1).up, 'pops out above the rim, arms up')
  assert.ok(sunk(0.78, 1).sy < 1, 'lands on the rim')
  assert.ok(sunk(0.8, 1).s === 0, 'standing on the rim')
})

test('a hidden starter (from a stall) sees the landing pipe rise from its first frame', () => {
  const c0 = TL.T.L_IN
  assert.ok(pipeAlpha(c0, 1) < 0.05, 'not popped in')
  assert.ok(pipeAlpha(0.4, 1) > 0.99 && height(0.4, 1) > 2, 'up before the departure would have ended')
})

test('the snow cap lies on the rim and drips over its front lip, never over the opening', () => {
  const cap = capPixels(), KY = 6, KH = cap.length / CW, h = HM, pipe = pipePixels(h)
  let n = 0
  for (let y = 0; y < KH; y++)
    for (let x = 0; x < CW; x++) {
      if (!cap[y * CW + x]) continue
      n++
      const py = y - KY - h + CY
      const under = py >= 0 && py < CH ? pipe[py * CW + x] : 0
      assert.ok(under !== 7 && under !== 8, `snow over the opening at ${x - CX},${y - KY}`)
    }
  assert.ok(n > 60, 'a cap that reads')
  // lumps rise above the rim's back edge, drips hang below its front edge
  assert.ok(cap.slice(0, CW).some(Boolean) && cap.slice((KY + 6) * CW, (KY + 7) * CW).some(Boolean))
})
