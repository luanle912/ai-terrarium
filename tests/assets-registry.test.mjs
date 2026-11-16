// The /assets catalogue (web/assets-registry.js and the web/assets-cat-*.js modules) and the stage it draws on
// (web/assets-stage.js): every entry is well formed, every item the game knows has an entry, and every entry draws
// in every variant, against a canvas that only counts what it is told.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

const I18n = loadI18n('vi')
// The office's wall clock and the pantry's show the time of day (web/decor-wall.js clockDraw, web/pantry-kitchen.js):
// the tests that compare draws pin "now" while they draw, so a draw is the same every time it is made.
const RealDate = Date
class PinnedDate extends RealDate {
  constructor(...a) {
    super(...(a.length ? a : [2026, 5, 1, 10, 8, 30]))
  }
  static now() {
    return new RealDate(2026, 5, 1, 10, 8, 30).getTime()
  }
}
const atPinnedClock = fn => {
  globalThis.Date = PinnedDate
  try {
    return fn()
  } finally {
    globalThis.Date = RealDate
  }
}
globalThis.React ??= { createElement: () => null, Component: class {} }
// Sprites and glows are painted on canvases of their own: give them counting contexts too.
let Stage = null
globalThis.document ??= {
  documentElement: {},
  addEventListener() {},
  createElement: () => {
    const cv = { width: 0, height: 0 }, ctx = Stage.recordingCtx(cv)
    cv.getContext = () => ctx
    return cv
  },
}
const { AssetsStage } = loadWeb('assets-stage')
const { ClaudeOffice } = loadWeb('office')
Stage = AssetsStage
const { AssetsRegistry: R } = loadWeb('assets-registry')
const { AssetsLogic: L } = loadWeb('assets-logic')
const { OfficeDecor } = loadWeb('office-decor')
const { PantryItems } = loadWeb('pantry-items')
const { BOARDS } = loadWeb('decor-boards')
// Task 4: animals and the Christmas event
const { DogSprites } = loadWeb('dog-sprites')
const { CritterSprites } = loadWeb('critter-sprites')
const { DOG_HOUSES } = loadWeb('office-scene')
const { DogLogic } = loadWeb('dog-logic')
// people and rooms (Task 5)
const { PeopleLogic } = loadWeb('people-logic')
const { OutfitLogic } = loadWeb('outfit-logic')
const { FateLogic } = loadWeb('fate-logic')
const { ST, ICON } = loadWeb('office-util')
const { ACT_TXT } = loadWeb('office-scene')
// Task 3: plants, outdoor props, the island and sky, the world view
const { SeasonTree } = loadWeb('season-tree')
const { SeasonLogic } = loadWeb('season-logic')
const { SkyLogic } = loadWeb('sky-logic')
const { SeasonIsland } = loadWeb('season-island')
const { ISLAND, W, H } = loadWeb('office-scene')
const DECOR_ENTRY = { tree: 'plants.island-tree', bush: 'plants.bush', mushroom: 'plants.mushroom',
  flower: 'plants.flowers', rock: 'outdoor.rock' }
const HUB_COLORS = JSON.parse(/const ISLAND_COLORS = (\[[^\]]*\])/.exec(
  readFileSync(new URL('../hub/pages.js', import.meta.url), 'utf8'))[1].replace(/'/g, '"'))

const ENTRIES = R.entries()
const kebab = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase())

// ---- the stage ----

test('envOf has the shape of the game env, plus snow and the theme', () => {
  const env = AssetsStage.envOf({ light: 'night', season: 'spring', snow: true, event: 0 })
  assert.deepEqual(Object.keys(env).sort(),
    ['col', 'df', 'event', 'flash', 'frozen', 'fx', 'hour', 'key', 'light', 'reduced', 'season', 'snow', 'theme']
      .sort())
  assert.equal(env.light, 'night')
  assert.notEqual(env.key, AssetsStage.envOf({ light: 'day', season: 'spring', snow: true, event: 0 }).key)
  assert.equal(env.df, 0)
  assert.equal(env.snow, 1)
  assert.equal(env.season, 'spring')
  assert.equal(env.theme._day, 0)
  assert.equal(AssetsStage.envOf({ light: 'day', season: 'spring', snow: false, event: 0 }).df, 1)
  const dusk = AssetsStage.envOf({ light: 'dusk', season: 'summer', snow: false, event: 0 })
  assert.ok(dusk.df > 0 && dusk.df < 1 && dusk.theme._day === dusk.df)
  const xmas = AssetsStage.envOf({ light: 'day', season: 'summer', snow: false, event: 2 })
  assert.equal(xmas.event, 2)
  assert.equal(xmas.season, 'winter', 'the event brings winter, as in the game')
  assert.equal(xmas.frozen, true)
  assert.equal(AssetsStage.envOf({ light: 'day', season: 'summer', snow: false, event: 2 }), xmas, 'one env per scene')
})

test('stage projects round (ox, oy) and hands out the game kits, colours and a host', () => {
  const ctx = AssetsStage.recordingCtx(), env = AssetsStage.envOf({ light: 'day', season: 'summer', snow: false, event: 0 })
  const view = { ox: 40, oy: 30, env, pick: {} }
  const s = AssetsStage.stage(ctx, view)
  assert.deepEqual(s.PG(0, 0, 0), [40, 30])
  assert.deepEqual(s.PG(1, 0, 2), [56, 36])
  assert.deepEqual(s.P(0, 0, 0), [40, 22], 'P stands on the office floor, as in the game')
  for (const k of ['poly', 'box', 'rows']) assert.equal(typeof s.pt[k], 'function')
  for (const k of ['box', 'poly', 'faceL', 'cyl']) assert.equal(typeof s.kit[k], 'function')
  for (const k of ['box', 'fL', 'shadow', 'wallText']) assert.equal(typeof s.pantryKit[k], 'function')
  assert.equal(s.C('#123456'), '#123456', 'a plain colour by day without snow stays itself')
  assert.equal(AssetsStage.stage(ctx, view), s, 'the same canvas and view give back the same stage')
  const night = AssetsStage.stage(ctx, { ...view, env: AssetsStage.envOf({ ...L.DEFAULTS, light: 'night' }) })
  assert.notEqual(night.C('#ffffff'), '#ffffff', 'night darkens')
  const snowy = AssetsStage.stage(ctx, { ...view, env: AssetsStage.envOf({ ...L.DEFAULTS, snow: true }) })
  assert.equal(snowy.C('#000000', 1), '#eef3f7', 'snow whitens what it covers')
  assert.deepEqual(Object.keys(s.G).sort(), ['box', 'cold', 'ctx', 'df', 'ev', 'poly', 'rect', 't', 'th'].sort())
  assert.equal(AssetsStage.stage(ctx, view).G.th, env.theme, 'the stage follows the view it was last given')
  assert.equal(AssetsStage.stage(ctx, view, 2.5).G.t, 2.5)
})

test('the host borrows the office methods and answers from the view env', () => {
  const ctx = AssetsStage.recordingCtx()
  const env = AssetsStage.envOf({ light: 'night', season: 'autumn', snow: false, event: 3 })
  const { host, G } = AssetsStage.stage(ctx, { ox: 0, oy: 0, env, pick: {} })
  for (const m of ['drawSeg', 'drawDesk', 'drawDog', 'drawPerson', 'cathedralItems', 'smokingItems', 'critterSprite'])
    assert.equal(typeof host[m], 'function', m)
  assert.equal(host.env, env)
  assert.equal(host.theme, env.theme)
  assert.equal(host.seasonNow(), 'winter')
  assert.deepEqual(host.eventNow(), { key: 'christmas', level: 3, eve: true, day: true })
  assert.deepEqual(G.ev, host.eventNow())
  assert.equal(host.season, 'default', 'no event tree unless an entry picks one (host.holiday)')
  assert.deepEqual(host.agents, [])
})

test('every ClaudeOffice method is reachable on the host, whenever its mixin was loaded', () => {
  const { host } = AssetsStage.stage(AssetsStage.recordingCtx(), { ox: 0, oy: 0, env: AssetsStage.envOf({}), pick: {} })
  const own = new Set(Object.getOwnPropertyNames(AssetsStage.StageHost.prototype)), missing = []
  for (const name of Object.getOwnPropertyNames(ClaudeOffice.prototype)) {
    if (name === 'constructor' || own.has(name)) continue
    const d = Object.getOwnPropertyDescriptor(ClaudeOffice.prototype, name)
    if (!(name in host) || ('value' in d && host[name] !== d.value)) missing.push(name)
  }
  assert.deepEqual(missing, [])
  // the mixins the catalogue draws with that load after web/assets-stage.js would once have been missed
  const late = ['stepBears', 'dogOut', 'bearItems', 'drawBear', 'drawIgloo', 'startFall', 'drawFallers', 'drawFaller']
  for (const m of late)
    assert.equal(typeof host[m], 'function', m)
  // and one added to the class from now on
  ClaudeOffice.prototype.assetsTestLate = function () {
    return this.env
  }
  try {
    assert.equal(host.assetsTestLate(), host.env)
  } finally {
    delete ClaudeOffice.prototype.assetsTestLate
  }
})

test('scene() puts a point of the office scene at (ox, oy) for the office methods', () => {
  const ctx = AssetsStage.recordingCtx(), env = AssetsStage.envOf(L.DEFAULTS)
  const s = AssetsStage.stage(ctx, { ox: 50, oy: 60, env, pick: {} })
  const { P } = loadWeb('office-scene')
  s.scene(3, 4, 0, () => s.G.rect(...P(3, 4, 0), 1, 1, '#ff0000'))
  assert.deepEqual(ctx.bounds(), { x0: 50, y0: 60, x1: 51, y1: 61 })
  s.scene(3, 4, 0, () => s.G.rect(...loadWeb('office-scene').PG(3, 4, 0), 1, 1, '#ff0000'), true)
  assert.deepEqual(ctx.bounds(), { x0: 50, y0: 60, x1: 51, y1: 61 }, 'lawn level when asked')
})

test('the recording canvas counts drawing, keeps bounds through transforms and clips, and tallies colours', () => {
  const c = AssetsStage.recordingCtx()
  assert.equal(c.drawn, 0)
  assert.equal(c.bounds(), null)
  c.fillStyle = '#ff0000'
  c.fillRect(2, 3, 4, 5)
  c.save()
  c.translate(10, 10)
  c.scale(2, 2)
  c.fillStyle = '#00f'
  c.beginPath()
  c.moveTo(0, 0)
  c.lineTo(5, 0)
  c.lineTo(5, 5)
  c.fill()
  c.restore()
  c.fillRect(-1, 0, 1, 1)
  c.someNewMethod(1, 2)
  assert.equal(c.drawn, 3)
  assert.deepEqual(c.bounds(), { x0: -1, y0: 0, x1: 20, y1: 20 })
  assert.deepEqual(c.palette(2), ['#0000ff', '#ff0000'], 'by area drawn')
  c.reset()
  c.beginPath()
  c.rect(0, 0, 4, 4)
  c.clip()
  c.fillRect(-10, -10, 100, 100)
  assert.deepEqual(c.bounds(), { x0: 0, y0: 0, x1: 4, y1: 4 })
  assert.equal(c.drawn, 1)
})

// ---- the registry ----

test('every entry is well formed: id, category, name in every language, where, when, source, axes and uses', () => {
  assert.deepEqual(R.problems, [], 'nothing was refused at registration')
  const cats = R.CATS.map(c => c.id)
  assert.deepEqual(cats, ['plants', 'outdoor', 'island', 'animals', 'people', 'office', 'pantry', 'rooms', 'event',
    'world'])
  assert.ok(ENTRIES.length > 40)
  const seen = new Set()
  for (const e of ENTRIES) {
    assert.match(e.id, /^[a-z]+\.[a-z0-9-]+$/, e.id)
    assert.ok(!seen.has(e.id), 'unique ' + e.id)
    seen.add(e.id)
    assert.equal(e.id.split('.')[0], e.cat, e.id + ' lives in its own category')
    assert.ok(cats.includes(e.cat))
    assert.equal(R.byId(e.id), e)
    for (const l of ['vi', 'en']) {
      I18n.setLang(l, { persist: false })
      const n = e.name()
      assert.ok(typeof n === 'string' && n && !n.startsWith('assets.'), `${e.id} has a ${l} name`)
    }
    I18n.setLang('vi', { persist: false })
    assert.ok(R.WHERE[e.where], e.id + ' where')
    assert.ok(e.when && (e.when.always || e.when.seasons || e.when.event || e.when.holiday), e.id + ' when')
    assert.ok(e.source.length > 0)
    for (const s of e.source) {
      const code = readFileSync(new URL('../' + s.file, import.meta.url), 'utf8'),
        name = s.fn.replace(/^[A-Za-z]+\./, '').replace(/\(.*$/, '')
      // the identifier itself, not a longer one that contains it (drawBear in drawBears)
      assert.match(code, new RegExp('(?<![\\w$])' + name.replace(/[$]/g, '\\$') + '(?![\\w$])'),
        `${e.id}: ${s.fn} in ${s.file}`)
    }
    assert.ok(e.uses.every(u => L.SCENE.includes(u)), e.id + ' uses known controls')
    const axisIds = e.axes.map(a => a.id)
    assert.equal(new Set(axisIds).size, axisIds.length)
    for (const a of e.axes) {
      assert.ok(a.values.length > 1, `${e.id}.${a.id} has a choice`)
      assert.ok(typeof a.label() === 'string' && !a.label().startsWith('assets.'), `${e.id}.${a.id} label`)
      for (const v of a.values) assert.ok(typeof v.label() === 'string' && v.label(), `${e.id}.${a.id}.${v.id}`)
    }
    assert.ok(e.tags.every(t => R.TAGS.includes(t)), e.id + ' tags')
    assert.equal(e.tags.includes('catalogue-only'), !!e.catalogueOnly, e.id + ' catalogue-only tag')
  }
})

// Every key of the game's own catalogues needs an entry (an id) or a value of an entry's axis ([id, axis, value]).
// Add a source here when a category comes in: one line each.
const SOURCES = [
  ['OfficeDecor.ITEMS', OfficeDecor.ITEMS.map(i => i.key), k => 'office.' + kebab(k)],
  // every screen a status shows (OfficeDecor.SCREEN_MAP), 'term' for a Bash tool and 'off' for an empty desk
  ['desk screens', [...new Set([...Object.values(OfficeDecor.SCREEN_MAP), 'term', 'off'])],
    k => ['office.desk', 'screen', k]],
  ['usage boards', Object.keys(BOARDS), k => ['office.usage-board', 'variant', k]],
  ['PantryItems.I', Object.keys(PantryItems.I), k => 'pantry.' + k],
  ['PantryItems.ORDER', PantryItems.ORDER, k => 'pantry.' + k],
  // Task 4: animals and the Christmas event
  ['DogSprites.BREEDS', Object.keys(DogSprites.BREEDS), k => ['animals.dog', 'breed', k]],
  ['dog frames', [...new Set(Object.keys(DogSprites.BREEDS).flatMap(DogSprites.frameNames))],
    k => ['animals.dog', 'frame', k]],
  ['dog acts', ['walk', 'run', 'stand', 'sit', 'rest', 'sleep', 'drink', 'bow', 'play'],
    k => ['animals.dog-life', 'act', k]],
  ['DOG_HOUSES', DOG_HOUSES.map((h, i) => DogLogic.BREEDS[i]), k => ['animals.kennel', 'kennel', k]],
  ['CritterSprites.KINDS', Object.keys(CritterSprites.KINDS).flatMap(k =>
    CritterSprites.frameNames(k).map(f => k + '/' + f)), k => {
    const [kind, f] = k.split('/')
    return { reindeer: ['animals.reindeer', 'act', f], penguin: ['animals.penguin', 'act', f],
      bear: ['animals.polar-bear', 'act', f], cub: ['animals.polar-bear', 'act', f],
      elf: ['event.elf', 'act', f], santa: ['event.santa', 'act', f], parcel: ['event.parcel', 'frame', f],
      sleigh: 'event.sleigh' }[kind] || 'unknown kind ' + kind
  }],
  ['painters of the lake, the sky and the Christmas event', ['drawDucks', 'drawFish', 'drawBirds', 'drawFlies',
    'drawIgloo', 'doghouseLantern', 'drawPile', 'drawString', 'drawCandyCane', 'drawCathedral', 'drawOurLady'],
  k => ({ drawDucks: 'animals.duck', drawFish: 'animals.fish', drawBirds: 'animals.bird', drawFlies: 'animals.firefly',
    drawIgloo: 'animals.igloo', doghouseLantern: 'animals.kennel-lantern', drawPile: 'event.gift-pile',
    drawString: 'event.string-lights', drawCandyCane: 'outdoor.candy-cane', drawCathedral: 'event.cathedral',
    drawOurLady: 'event.our-lady' })[k]],
  // people and rooms (Task 5): the looks (PeopleLogic.STYLE, SKIN), the statuses, the acts, the Christmas outfits
  // and hats, the ways out of the island, the marks over a head, and the two rooms
  ...['hair', 'top', 'beard', 'acc'].map(k => [`PeopleLogic.STYLE ${k}`,
    [...new Set([...PeopleLogic.STYLE.m[k], ...PeopleLogic.STYLE.f[k]].filter(Boolean))], v => ['people.person', k, v]]),
  ['PeopleLogic.SKIN', PeopleLogic.SKIN.map((c, i) => 'skin-' + (i + 1)), k => ['people.person', 'skin', k]],
  ['ST', Object.keys(ST), k => ['people.person', 'status', k]],
  ['ACT_TXT', Object.keys(ACT_TXT), k => ['people.person', 'act', k]],
  ['OutfitLogic.KINDS', OutfitLogic.KINDS, k => ['people.person', 'outfit', k]],
  ['OutfitLogic.HATS', OutfitLogic.HATS, k => ['people.person', 'hat', k]],
  ['FateLogic.FATES', Object.keys(FateLogic.FATES), k => ['people.fate', 'fate', k]],
  ['ICON', Object.keys(ICON), k => ['people.status-bubble', 'status', k]],
  ['rooms', ['restroom', 'smoking'], k => 'rooms.' + k],
  // Task 3: plants, outdoor props, the island and sky, the world view
  ['SeasonTree.SEASONS', Object.keys(SeasonTree.SEASONS), k => 'plants.holiday-' + k],
  ['island decor kinds', [...new Set(ISLAND.decor.map(d => d.kind))], k => DECOR_ENTRY[k] || 'missing.' + k],
  ['island tree kinds', [...new Set(L.CHOICES.season.map(s => SeasonLogic.look(s).trees)), 'fir'],
    k => ['plants.island-tree', 'kind', k]],
  ['world tree kinds', [...new Set(L.CHOICES.season.map(s => SeasonLogic.look(s).trees))],
    k => ['plants.world-tree', 'kind', k]],
  ['season falls', [...new Set(L.CHOICES.season.map(s => SeasonLogic.look(s).fall).filter(Boolean))],
    k => ['island.fall', 'kind', k]],
  ['SkyLogic.WEATHERS', SkyLogic.WEATHERS, k => ['island.weather', 'weather', k]],
  ['snowman looks', SeasonIsland.snowmanTiles(ISLAND, W, H).map(m => m.look % 3),
    k => ['outdoor.snowman', 'look', ['tall', 'stout', 'small'][k]]],
  ['hub ISLAND_COLORS', HUB_COLORS, k => ['world.island', 'colour', k.slice(1)]],
]

test('every item the game knows has an entry in the catalogue', () => {
  const missing = []
  for (const [what, keys, need] of SOURCES) {
    assert.ok(keys.length > 0, what + ' is not empty')
    for (const k of keys) {
      const n = need(k), [id, axis, value] = Array.isArray(n) ? n : [n]
      const e = R.byId(id)
      if (!e || (axis && !e.axes.some(a => a.id === axis && a.values.some(v => v.id === value))))
        missing.push(`${what}: ${k} → ${[id, axis, value].filter(Boolean).join(' / ')}`)
    }
  }
  assert.deepEqual(missing, [])
})

// Every choice of every axis (the others at their first value) under every combination of the controls it uses.
function* variants(e) {
  const picks = [L.defaultPick(e)]
  for (const a of e.axes) for (const v of a.values.slice(1)) picks.push({ ...L.defaultPick(e), [a.id]: v.id })
  const dims = L.SCENE.filter(u => e.uses.includes(u)).map(u => L.CHOICES[u].map(v => [u, v]))
  const scenes = dims.reduce((acc, d) => acc.flatMap(s => d.map(([u, v]) => ({ ...s, [u]: v }))), [{ ...L.DEFAULTS }])
  for (const pick of picks) for (const sc of scenes) yield { pick, scene: L.sceneOf(e, sc) }
}
// What one variant draws at time t: {drawn, sig}. A draw is the same every time (the counting canvas sees only what
// is on a sprite now), so the tests below share one look per variant instead of drawing it again.
const LOOKS = new Map()
const drawLog = (e, pick, scene, t = 1.25) => {
  const key = e.id + '|' + JSON.stringify(pick) + '|' + JSON.stringify(scene) + '|' + t
  let look = LOOKS.get(key)
  if (!look) {
    const ctx = AssetsStage.recordingCtx()
    atPinnedClock(() => e.draw(ctx, { ox: 64, oy: 64, env: AssetsStage.envOf(scene), pick }, t))
    LOOKS.set(key, (look = { drawn: ctx.drawn, sig: ctx.signature(), signature: () => look.sig }))
  }
  return look
}
const envKey = scene => AssetsStage.envOf(scene).key

test('every entry draws in every variant under every scene it reacts to, without throwing', () => {
  const blank = [], threw = []
  // scene by scene, so the island is baked once per scene for all the cards cut from it
  const jobs = ENTRIES.flatMap(e => [...variants(e)].map(v => ({ e, ...v, env: envKey(v.scene) })))
  jobs.sort((a, b) => (a.env < b.env ? -1 : a.env > b.env ? 1 : 0))
  for (const { e, pick, scene } of jobs) {
    const at = `${e.id} ${JSON.stringify(pick)} ${JSON.stringify(scene)}`
    try {
      if (drawLog(e, pick, scene).drawn < 1) blank.push(at)
    } catch (err) {
      threw.push(at + ': ' + err.message)
    }
  }
  assert.deepEqual(threw, [])
  assert.deepEqual(blank, [])
  assert.ok(jobs.length > ENTRIES.length)
})

test('a control an entry says it uses changes how it looks, for some variant', () => {
  const sig = c => c.signature()
  const dead = []
  for (const e of ENTRIES)
    for (const u of e.uses) {
      const differs = L.combos({ ...e, uses: [] }, L.DEFAULTS).some(({ pick }) => {
        const looks = new Set(L.CHOICES[u].map(v => sig(drawLog(e, pick, L.sceneOf(e, { ...L.DEFAULTS, [u]: v })))))
        return looks.size > 1
      })
      if (!differs) dead.push(`${e.id} ${u}`)
    }
  assert.deepEqual(dead, [])
})

test('an entry declares every control that would change it (so no variant is hidden from the page)', () => {
  const undeclared = new Set()
  for (const e of ENTRIES) {
    // every choice of every axis, the others at their first value
    const picks = [L.defaultPick(e)]
    for (const a of e.axes) for (const v of a.values.slice(1)) picks.push({ ...picks[0], [a.id]: v.id })
    for (const u of L.SCENE.filter(c => !e.uses.includes(c)))
      for (const pick of picks) {
        const looks = new Set(L.CHOICES[u].map(v => drawLog(e, pick, { ...L.sceneOf(e, L.DEFAULTS), [u]: v }).sig))
        if (looks.size > 1) undeclared.add(`${e.id} ${u}`)
      }
  }
  assert.deepEqual([...undeclared], [])
})

test('the variants grid of every entry draws every cell', () => {
  for (const e of ENTRIES) {
    const cells = L.combos(e, L.DEFAULTS)
    assert.ok(cells.length >= 1 && cells.length <= 48, e.id)
    for (const c of cells) assert.ok(drawLog(e, c.pick, L.sceneOf(e, c.controls)).drawn > 0, e.id)
  }
})

test('"Everything" lists the entries category by category, in the rail order', () => {
  const order = R.entries().map(e => L.CAT_IDS.indexOf(e.cat))
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
})

test('a scene card that declares its frame draws nothing outside it (the page does not measure it)', () => {
  const framed = ENTRIES.filter(e => e.frame)
  assert.ok(framed.length >= 12, 'the island, lake, lawn and sky scene cards declare their frames')
  const out = []
  for (const e of framed)
    for (const c of L.combos(e, L.DEFAULTS))
      for (const t of [0.4, 2.6]) {
        const ctx = AssetsStage.recordingCtx()
        e.draw(ctx, { ox: 0, oy: 0, env: AssetsStage.envOf(L.sceneOf(e, c.controls)), pick: L.fixPick(e, c.pick) }, t)
        const b = ctx.bounds()
        if (!b || b.x0 < 0 || b.y0 < 0 || b.x1 > e.frame.w || b.y1 > e.frame.h) out.push(`${e.id} ${JSON.stringify(b)}`)
      }
  assert.deepEqual([...new Set(out)], [])
})

test('the animated tag says whether an entry moves with the clock, in some variant', () => {
  const wrong = []
  for (const e of ENTRIES) {
    const moves = [...variants(e)].some(({ pick, scene }) =>
      [0.4, 2.6, 7.9].map(t => drawLog(e, pick, scene, t).signature()).some((s, i, all) => s !== all[0]))
    if (moves !== e.tags.includes('animated')) wrong.push(`${e.id}: ${moves ? 'moves' : 'still'}`)
  }
  assert.deepEqual(wrong, [])
})

test('every draw gets a clean host: an entry drawn after another on the same canvas looks as it does alone', () => {
  // entries that set the host's people, departments, dogs or lit props, or G's theme, for their draw
  const ids = ['office.glass-wall', 'office.old-desk', 'rooms.restroom', 'animals.kennel', 'people.person',
    'rooms.smoking', 'office.desk']
  const varied = e => {
    const p = L.defaultPick(e)
    for (const a of e.axes) p[a.id] = a.values[a.values.length - 1].id
    return p
  }
  const scene = { ...L.DEFAULTS, light: 'night', snow: true, season: 'winter' }
  const sigOf = (ctx, e, pick) => {
    ctx.reset()
    atPinnedClock(() => e.draw(ctx, { ox: 64, oy: 64, env: AssetsStage.envOf(L.sceneOf(e, scene)), pick }, 1.25))
    return ctx.signature()
  }
  // and a draw that leaves everything set: someone at the first desk, every prop lit, a department, the blueprint
  const { THEMES } = loadWeb('office-scene'), { PropUse } = loadWeb('prop-use')
  const LIT = new Float32Array(PropUse.DARK.length).fill(1)
  const polluter = { id: 'test.polluter', axes: [], uses: [], draw(ctx, view) {
    const s = AssetsStage.stage(ctx, view)
    s.host.agents = [{ desk: 0, seated: true, status: 'working', leaving: false, parent: null }]
    s.host.propLit = LIT
    s.host.depts = new Map([['team', { color: '#ff00ff' }]])
    s.G.th = THEMES.blueprint
  } }
  // and one that sets nothing and reads it all: the first desk as the office's people and theme leave it
  const { DESKS } = loadWeb('office-scene')
  const reader = { id: 'test.reader', axes: [], uses: [], draw(ctx, view, t) {
    const s = AssetsStage.stage(ctx, view, t)
    s.scene(DESKS[0].gx + 1, DESKS[0].gy + 1, 0, () => s.host.drawDesk(s.G, DESKS[0], 0))
  } }
  const own = { [polluter.id]: polluter, [reader.id]: reader }
  for (const a of [polluter.id, ...ids])
    for (const b of [reader.id, ...ids]) {
      if (a === b) continue
      const A = own[a] || R.byId(a), B = own[b] || R.byId(b), shared = AssetsStage.recordingCtx()
      sigOf(shared, A, varied(A))
      assert.equal(sigOf(shared, B, L.defaultPick(B)), sigOf(AssetsStage.recordingCtx(), B, L.defaultPick(B)),
        `${b} after ${a}`)
    }
})

test('a draw that throws turns its slot into the error tile, tells the page once, and the loop skips it', () => {
  const { AssetsPaint } = loadWeb('assets-ui-paint')
  let frame = null, calls = 0
  const errors = []
  globalThis.requestAnimationFrame = f => ((frame = f), 1)
  const boom = { id: 'test.boom', tags: ['animated'], axes: [], uses: [], draw() {
    calls++
    throw new Error('boom')
  } }
  const canvas = { width: 0, height: 0, style: { setProperty() {} } }, ctx = AssetsStage.recordingCtx(canvas)
  canvas.getContext = () => ctx
  try {
    const slot = AssetsPaint.attach(canvas, { fps: 15, onError: err => errors.push(err.message) })
    AssetsPaint.setSlot(slot, boom, {}, L.DEFAULTS, 2)
    calls = 0
    assert.equal(typeof frame, 'function', 'the loop is woken')
    frame()
    assert.equal(calls, 1)
    assert.equal(slot.broken.message, 'boom')
    assert.deepEqual(errors, ['boom'])
    slot.dirty = true
    frame()
    assert.equal(calls, 1, 'a broken slot is not drawn again')
    assert.deepEqual(errors, ['boom'])
    AssetsPaint.detach(slot)
  } finally {
    delete globalThis.requestAnimationFrame
  }
})

test('the registry refuses an entry whose `when` names what the game does not have', () => {
  const ok = { id: 'plants.test-when', cat: 'plants', name: () => 'x', draw() {}, where: 'lawn',
    source: [{ file: 'web/island-art.js', fn: 'drawBush' }] }
  assert.equal(R.check(ok), null)
  assert.equal(R.check({ ...ok, when: { seasons: ['winter'] } }), null)
  assert.match(R.check({ ...ok, when: { seasons: ['monsoon'] } }), /season/)
  assert.match(R.check({ ...ok, when: { event: { key: 'christmas', level: 9 } } }), /event/)
  assert.match(R.check({ ...ok, when: { holiday: 'nope' } }), /holiday/)
  assert.match(R.check({ ...ok, when: 'always' }), /when/)
})
