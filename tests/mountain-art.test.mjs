import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'

import { loadWeb } from './web.mjs'

// A canvas that only records what is painted on it: every fillStyle set and every fillRect.
const painted = []
const fakeCanvas = () => {
  const ctx = {
    _fill: '',
    set fillStyle(v) { this._fill = v; painted.push(v) },
    get fillStyle() { return this._fill },
    imageSmoothingEnabled: true,
    rects: 0,
    fillRect() { this.rects++ },
  }
  return { width: 0, height: 0, getContext: () => ctx }
}
globalThis.document ??= { createElement: () => fakeCanvas() }

const { MountainArt } = loadWeb('mountain-art')
const { night } = loadWeb('island-art')

// The brief's palette (section 4), and the island's own lawn where the mountain's foot meets it (spec 11.10).
const BRIEF = ['#3B2F4A', '#F7F2EA', '#FFFFFF', '#CADCF2', '#D6E4F4', '#A9BEDB', '#E6DED2', '#C8BCAE', '#968B9E',
  '#73698A', '#575070', '#8FD762', '#62B545', '#4F9A3A', '#7CCAF5', '#D4F2FF', '#5FB8F0', '#9FE0FF', '#D9D2C4',
  '#A89F94', '#468F3A', '#5FB447', '#FFD36B', '#F59A3C', '#D9673A', '#8A5A3C']
const LAWN = ['#5eae4a', '#5aa847']
const allowed = (df) => new Set([...BRIEF, ...LAWN].map((c) => night(c, df).toLowerCase()))

const paint = (env) => {
  painted.length = 0
  const m = MountainArt.sprite(env, { x: 2, y: -7 })
  const l = MountainArt.lake(env)
  const f = MountainArt.falls(env)
  const pine = fakeCanvas().getContext()
  for (const size of [0, 1, 2]) MountainArt.drawPine(pine, 10, 20, size, (c) => night(c, env.df))
  return { m, l, f, colours: new Set(painted.map((c) => String(c).toLowerCase())) }
}

test('the mountain sprite uses only the brief\'s palette', () => {
  let day
  for (const df of [1, 0.4]) {
    const { m, l, f, colours } = paint({ df, snow: 0 })
    if (df === 1) day = colours
    const ok = allowed(df)
    assert.ok(colours.size >= 15, `only ${colours.size} colours painted`)
    for (const c of colours) assert.ok(ok.has(c), `${c} is not in the brief's palette (light ${df})`)
    // the anchor is the front corner F, inside the canvas
    for (const s of [m, l, ...f.frames, ...f.foam]) {
      assert.ok(Number.isInteger(s.ax) && Number.isInteger(s.ay) && s.canvas.width > 0 && s.canvas.height > 0)
    }
    assert.ok(m.ax > 70 && m.ax < m.canvas.width - 70, 'F is not in the middle of the sprite')
    assert.ok(m.ay >= 130 && m.ay <= m.canvas.height, `F is ${m.ay} px down a ${m.canvas.height} px sprite`)
  }
  // the brief's colours themselves, by day
  for (const c of ['#3b2f4a', '#ffffff', '#e6ded2', '#968b9e', '#7ccaf5', '#5fb8f0', '#8fd762']) assert.ok(day.has(c), `${c} is never painted`)
})

test('the mountain is baked once per light and snow step', () => {
  const a = MountainArt.sprite({ df: 1, snow: 0 }, { x: 2, y: -7 })
  assert.equal(MountainArt.sprite({ df: 1, snow: 0 }, { x: 2, y: -7 }), a)
  assert.notEqual(MountainArt.sprite({ df: 0.5, snow: 0 }, { x: 2, y: -7 }), a)
  assert.notEqual(MountainArt.sprite({ df: 1, snow: 1 }, { x: 2, y: -7 }), a)
})

test('the falls step a pixel every 120 ms and the foam swaps every 300 ms', () => {
  const f = MountainArt.falls({ df: 1, snow: 0 })
  assert.equal(f.frames.length, 4)
  assert.equal(f.foam.length, 2)
  assert.equal(MountainArt.fallFrame(0), 0)
  assert.equal(MountainArt.fallFrame(0.119), 0)
  assert.equal(MountainArt.fallFrame(0.121), 1)
  assert.equal(MountainArt.fallFrame(0.48), 0)
  assert.equal(MountainArt.foamFrame(0.29), 0)
  assert.equal(MountainArt.foamFrame(0.31), 1)
  assert.equal(MountainArt.foamFrame(0.61), 0)
})

test('no #2b2350 is left in web/', () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = dir + '/' + n
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
  const web = new URL('../web', import.meta.url).pathname
  for (const p of walk(web)) assert.ok(!/2b2350/i.test(readFileSync(p, 'utf8')), `${p} still uses #2b2350`)
})
