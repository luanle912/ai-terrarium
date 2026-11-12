import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

// The animal-view mixins on ClaudeOffice, run against stub globals (no DOM, no React). React is stubbed before the
// modules load because office.js extends React.Component and office-scene.js takes React.createElement.
globalThis.React ??= { Component: class {}, createElement: (type, props, ...kids) => ({ type, props: props || {}, kids }) }
const { ClaudeOffice } = loadWeb('office')
for (const m of ['animal-view-feed', 'animal-view-walkers', 'animal-view-draw', 'animal-view-hit', 'animal-view-chip',
  'animal-view-panels']) loadWeb(m)
const { AnimalUI: U } = loadWeb('animal-ui')
const { AnimalWalk: AW } = loadWeb('animal-walk')
const { AnimalSprites } = loadWeb('animal-sprites')
const { LH, LW, PA, PG, ISLAND } = loadWeb('office-scene')
const { ANIMAL_PLACES } = loadWeb('animal-view-util')

const SPECIES = [
  { id: 'hen', tier: 'common', cond: null }, { id: 'frog', tier: 'rare', cond: 'rain' },
  { id: 'deer', tier: 'epic', cond: null }, { id: 'dragon', tier: 'legendary', cond: null },
]
const TIERS = { common: { deadlineMs: 20 * 60e3 }, rare: { deadlineMs: 40 * 60e3 }, epic: { deadlineMs: 75 * 60e3 },
  legendary: { deadlineMs: 150 * 60e3 } }
const view = (o = {}) => ({ caught: [], out: [], speciesCaught: [], total: 0, count: 0, full: false,
  limits: { collection: 50, out: 5 }, wild: null, attempt: null, species: SPECIES, tiers: TIERS, notice: null, ...o })

// A tiny lawn: a 6x3 block of roam cells, no clear cells.
const roam = new Set(); for (let x = 30; x < 36; x++) for (let y = 2; y < 5; y++) roam.add(x + ',' + y)
const PLACES = AW.places({ W: 27, H: 14, roam, roamList: [...roam].map(k => k.split(',').map(Number)), clear: new Set(), den: [], drink: [] })
const rand = () => 0.5

const BODY = { tagName: 'BODY' }
const DOC = { visibilityState: 'visible', body: BODY, documentElement: { tagName: 'HTML' }, activeElement: BODY,
  addEventListener() {}, removeEventListener() {} }
const POSTS = []
let GET_STATUS = 200
// Set after the modules load: they read these at call time, and i18n.js would touch document while loading.
Object.assign(globalThis, {
  document: DOC,
  window: { addEventListener() {}, removeEventListener() {} },
  fetch: async (url, opts = {}) => {
    if (opts.method === 'POST') POSTS.push({ url, body: JSON.parse(opts.body) })
    return { status: opts.method === 'POST' ? 200 : GET_STATUS, json: async () => ({}) }
  },
})

function office(state = {}, extra = {}) {
  const o = Object.create(ClaudeOffice.prototype)
  Object.assign(o, { state: { animalView: view(), asOthers: false, dataSource: 'live', ...state },
    animalsOn: true, animalApiOk: true, animals: [], animalFx: [], noticeQ: [], wx: { to: 'clear' }, preview: null }, extra)
  o.setState = p => { o.state = { ...o.state, ...(typeof p === 'function' ? p(o.state) : p) } }
  return o
}
const el = (name, o = {}) => ({ name, isConnected: true, contains: t => t === o.child || t === o.self, focus() { DOC.activeElement = this }, ...o })
const pendingView = () => view({ wild: { id: 'abc123', species: 'frog', stayLeftMs: 1 }, full: true,
  attempt: { wildId: 'abc123', needMs: 1, workMs: 1, deadlineLeftMs: 1, phase: 'pending', pendingLeftMs: 1000, counting: false } })

test('reportEnv reports not visible under "view as others" and reports again when it is turned off', () => {
  const o = office({ asOthers: true })
  try {
    o.reportEnv()
    assert.equal(POSTS.at(-1).body.visible, false, 'the user cannot see the animals')
    o.setState({ asOthers: false })
    o.envSent = { visible: false, at: performance.now() - 5000 }
    const n = POSTS.length
    o.startAnimals() // componentDidUpdate -> startSource -> startAnimals on an asOthers change
    assert.equal(POSTS.length, n + 1)
    assert.equal(POSTS.at(-1).body.visible, true)
  } finally { o.animalsOn = false; clearTimeout(o.envTimer) }
})

test('Escape cancels the full-collection picker only from the picker or the body', () => {
  const o = office({ animalView: pendingView() })
  const calls = []; o.animalPost = (a, b) => { calls.push([a, b]) }
  const btn = {}; o.animalPanelNode = { contains: t => t === btn }
  const key = (target, more = {}) => ({ key: 'Escape', target, defaultPrevented: false, isComposing: false, preventDefault() {}, ...more })
  o.animalKey(key({ tagName: 'INPUT' }))
  o.animalKey(key({ tagName: 'SELECT' }))
  o.animalKey(key(btn, { isComposing: true }))
  o.animalKey(key(btn, { defaultPrevented: true }))
  assert.deepEqual(calls, [], 'other fields, IME composition and handled keys never cancel')
  o.animalKey(key(btn))
  o.animalKey(key(BODY))
  assert.deepEqual(calls, [['resolve', { cancel: true }], ['resolve', { cancel: true }]])
})

test('tapAt on a phone gives the agent under the finger, not the animal whose wide target covers it', () => {
  const o = office({ animalView: view({ wild: { id: 'abc123', species: 'hen', stayLeftMs: 1 } }) })
  o.animals = U.reconcile([], o.state.animalView, { places: PLACES, rand, known: () => true })
  const an = o.animals[0], f = AnimalSprites.frame('hen', 'stand'), [ax, ay] = PG(an.x, an.y)
  // An agent standing 30 scene px right of the animal: inside its ~53 px phone target.
  const agent = { id: 7, x: an.x + 30 / 32, y: an.y - 30 / 32, sleeping: false, seated: false }
  const [sx, sy] = PA(agent.x, agent.y)
  o.hit = () => agent
  const k = 350 / LW, ev = (lx, ly) => ({ clientX: lx * k, clientY: ly * k,
    currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 350, height: LH * k }) } })
  assert.ok(Math.hypot(sx - ax, sy - 10 - (ay - f.h / 2)) < 22 / k, 'the agent stands inside the animal target')
  const onAgent = o.tapAt(ev(sx, sy - 10))
  assert.equal(onAgent.animal, null)
  assert.equal(onAgent.agent, agent)
  const onAnimal = o.tapAt(ev(ax, ay - f.h / 2))
  assert.equal(onAnimal.animal, an)
})

test('a GET that hides the feature stops the env reports and the stream', async () => {
  const o = office({}, { animalGen: 0 })
  let closed = false
  o.animalEs = { readyState: 1, close() { closed = true } }
  o.envTimer = setTimeout(() => {}, 1e6).unref()
  GET_STATUS = 404
  try { await o.loadAnimals() } finally { GET_STATUS = 200; clearTimeout(o.envTimer) }
  assert.equal(o.animalApiOk, false)
  assert.equal(o.animalEs, null)
  assert.equal(closed, true)
  assert.equal(o.state.animalView, null)
  const n = POSTS.length
  o.reportEnv()
  assert.equal(POSTS.length, n, 'no env report after the feature is gone')
  clearTimeout(o.envTimer)
})

test('a hidden tab holds no animal stream and opens it again when shown', async () => {
  const opened = []
  globalThis.EventSource = class { constructor(url) { this.url = url; this.closed = false; opened.push(this) } close() { this.closed = true } }
  const o = office({}, { animalGen: 0 })
  o.applyAnimalView = () => {}
  try {
    DOC.visibilityState = 'hidden'
    await o.loadAnimals()
    assert.equal(opened.length, 0, 'a hidden tab does not open the stream (browsers allow 6 connections per host)')
    DOC.visibilityState = 'visible'
    await o.animalVisibility()
    assert.equal(opened.length, 1, 'shown again: fetch the view and open the stream')
    DOC.visibilityState = 'hidden'
    await o.animalVisibility()
    assert.equal(opened[0].closed, true, 'hidden: the stream is closed')
    assert.equal(o.animalEs, null)
  } finally {
    DOC.visibilityState = 'visible'
    delete globalThis.EventSource
    o.animalsOn = false
    clearTimeout(o.envTimer)
    clearTimeout(o.animalRetry)
  }
})

test('the rarity aura is drawn in the depth-sorted pass right after the body, not after it', () => {
  const o = office({ animalView: view({ wild: { id: 'abc123', species: 'dragon', stayLeftMs: 1 } }) }, { env: { reduced: false } })
  o.animals = U.reconcile([], o.state.animalView, { places: PLACES, rand, known: () => true })
  const order = []
  const ctx = new Proxy({}, { get: (t, p) => p in t ? t[p] : p === 'drawImage' ? () => order.push('body') : () => {}, set: (t, p, v) => { t[p] = v; return true } })
  o.animalSprite = () => ({})
  o.drawAnimalAura = () => order.push('aura')
  o.drawAnimal({ ctx, th: { shadow: '#000' } }, o.animals[0], 0, 0, 0)
  assert.deepEqual(order, ['body', 'aura'])
  order.length = 0
  o.drawAnimalFx({ ctx }, 0, 0, 0)
  assert.deepEqual(order, [], 'the post-storm pass keeps only screen effects')
})

test('a panel takes focus when it opens and gives it back to the opener when it closes', async () => {
  const o = office()
  const chip = el('chip'), first = el('first')
  const panel = el('panel', { child: first, querySelector: () => first })
  o.animalChipEl = chip
  DOC.activeElement = chip
  o.animalPanelRef(panel)
  assert.equal(DOC.activeElement, first, 'focus moves to the first control')
  o.animalPanelRef(null) // React detaches the ref, then removes the node
  DOC.activeElement = BODY
  await new Promise(r => setTimeout(r, 5))
  assert.equal(DOC.activeElement, chip, 'focus returns to the chip')

  const input = el('input')
  DOC.activeElement = input
  o.animalPanelRef(panel)
  DOC.activeElement = input // the user went back to typing
  o.animalPanelRef(null)
  await new Promise(r => setTimeout(r, 5))
  assert.equal(DOC.activeElement, input, 'focus outside the panel is left alone')
  DOC.activeElement = BODY
})

// ---- wiring into the page and the world view ----

test('the page walks animals on the real island: they arrive and leave on its coast, the back lawn included', () => {
  const land = ISLAND.cells, k = ([x, y]) => x + ',' + y
  const coast = ([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !land.has(k([x + dx, y + dy])))
  assert.ok(ANIMAL_PLACES.edge.length > 10)
  for (const c of ANIMAL_PLACES.edge) assert.ok(coast(c), `edge cell ${c} is inland`)
  assert.ok(ANIMAL_PLACES.edge.some(([x, y]) => x < 0 || y < 0), 'the lawn behind the office has a coast')
  for (const c of ANIMAL_PLACES.settleList) assert.ok(land.has(k(c)), `settle cell ${c} is off the island`)
})


test('world islands borrow the animal draw helpers and carry no animals', () => {
  const { IslandScene, SCENE_METHODS } = loadWeb('island-scene')
  for (const m of ['drawAnimal', 'drawAnimalFx', 'animalItems', 'animalShown', 'animalSprite', 'animalOutline', 'animalAlpha', 'animalTier', 'animalLive'])
    assert.ok(SCENE_METHODS.includes(m), m + ' is borrowed')
  for (const m of SCENE_METHODS) assert.equal(typeof IslandScene.prototype[m], 'function', m + ' exists when copied')
  const scene = Object.create(IslandScene.prototype)
  Object.assign(scene, { state: { sel: null }, animals: [], animalFx: [] })
  assert.equal(scene.animalLive(), null)
  assert.equal(scene.animalTier('hen'), 'common')
})

test('the chip and the panels stay hidden while there is no animal view or under "view as others"', () => {
  const o = office({ animalView: null })
  assert.equal(o.animalChip(false), null)
  assert.equal(o.animalSlot(), null)
  const others = office({ asOthers: true })
  assert.equal(others.animalChip(true), null)
  assert.equal(others.animalArrow(), null)
  assert.equal(office({ animalView: pendingView() }).animalSlot(), 'picker')
})
