import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadSkyLogic } from './load-sky-logic.mjs'

const SkyLogic = loadSkyLogic()
const W = 27, H = 14
const island = SkyLogic.buildIsland({ W, H })
const has = (x, y) => island.cells.has(x + ',' + y)
const inOffice = (x, y) => x >= 0 && x < W && y >= 0 && y < H

// ---- island ----

test('island contains the whole office', () => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) assert.ok(has(x, y), `office cell ${x},${y}`)
})

test('outdoor spots fit on the lawn', () => {
  assert.equal(island.spots.length, 3)
  for (const s of island.spots) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
    assert.ok(has(x, y), `spot ${s.id} cell ${x},${y} is off the island`)
    assert.ok(!inOffice(x, y), `spot ${s.id} cell ${x},${y} is inside the office`)
  }
})

test('decor avoids office, spots and the office margin', () => {
  assert.ok(island.decor.length > 0)
  const inSpot = (x, y) => island.spots.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)
  for (const d of island.decor) {
    assert.ok(has(d.x, d.y), `decor ${d.x},${d.y} is off the island`)
    assert.ok(!(d.x >= -1 && d.x <= W && d.y >= -1 && d.y <= H), `decor ${d.x},${d.y} touches the office`)
    assert.ok(!inSpot(d.x, d.y), `decor ${d.x},${d.y} sits on a reserved spot`)
    assert.ok(['tree', 'rock', 'flower'].includes(d.kind))
  }
})

test('waterfall sits on an east shore cell', () => {
  const { x, y } = island.waterfall
  assert.ok(has(x, y) && !has(x + 1, y))
})

// ---- weather ----

// Small seeded generator so the statistics below are repeatable.
const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

test('random weather never repeats except clear', () => {
  const rand = seeded(7)
  let clearAgain = false
  for (let i = 0; i < 1000; i++) {
    assert.notEqual(SkyLogic.pickNextWeather('rain', 5, rand), 'rain')
    if (SkyLogic.pickNextWeather('clear', 5, rand) === 'clear') clearAgain = true
  }
  assert.ok(clearAgain, 'clear can follow clear')
})

test('snow only from December to February', () => {
  const rand = seeded(11)
  const seen = { 0: false, 5: false, 11: false }
  for (let i = 0; i < 3000; i++) for (const m of [0, 5, 11]) if (SkyLogic.pickNextWeather('fog', m, rand) === 'snow') seen[m] = true
  assert.deepEqual(seen, { 0: true, 5: false, 11: true })
})

test('weights roughly match the spec', () => {
  const rand = seeded(3)
  const counts = {}
  const n = 20000
  for (let i = 0; i < n; i++) {
    const w = SkyLogic.pickNextWeather('fog', 5, rand)
    counts[w] = (counts[w] ?? 0) + 1
  }
  // fog is excluded (no repeat) and snow folds into clear outside winter: clear 50/92, cloudy 25/92, rain 12/92, storm 5/92
  assert.ok(Math.abs(counts.clear / n - 50 / 92) < 0.03, `clear ${counts.clear / n}`)
  assert.ok(Math.abs(counts.cloudy / n - 25 / 92) < 0.03, `cloudy ${counts.cloudy / n}`)
  assert.ok(Math.abs(counts.rain / n - 12 / 92) < 0.02, `rain ${counts.rain / n}`)
  assert.equal(counts.fog, undefined)
})

test('change and transition delays are in range', () => {
  assert.equal(SkyLogic.changeDelayMs(0), 1_200_000)
  assert.ok(SkyLogic.changeDelayMs(0.999) < 2_400_000 && SkyLogic.changeDelayMs(0.999) > 2_390_000)
  assert.equal(SkyLogic.transitionMs(0), 30_000)
  assert.ok(SkyLogic.transitionMs(0.999) < 60_000)
})

test('wmo codes map per spec', () => {
  const cases = { 0: 'clear', 1: 'clear', 2: 'cloudy', 3: 'cloudy', 45: 'fog', 48: 'fog', 51: 'rain', 61: 'rain', 66: 'rain', 67: 'rain', 80: 'rain', 82: 'rain', 71: 'snow', 77: 'snow', 85: 'snow', 86: 'snow', 95: 'storm', 99: 'storm', 4: null, '-1': null, 100: null }
  for (const [code, type] of Object.entries(cases)) assert.equal(SkyLogic.wmoToWeather(Number(code)), type, `code ${code}`)
})

test('transition blends from the current mix without a jump', () => {
  const s0 = SkyLogic.initialWeather('clear', 0)
  assert.deepEqual(SkyLogic.weatherFx(s0, 0), SkyLogic.FX.clear)
  const s1 = SkyLogic.startTransition(s0, 'rain', 1000, 30000)
  assert.deepEqual(SkyLogic.weatherFx(s1, 1000), SkyLogic.FX.clear)
  assert.deepEqual(SkyLogic.weatherFx(s1, 31000), SkyLogic.FX.rain)
  const mid = SkyLogic.weatherFx(s1, 16000)
  assert.ok(mid.rain > 0.2 && mid.rain < 0.8, `rain halfway ${mid.rain}`)
  const s2 = SkyLogic.startTransition(s1, 'snow', 16000, 30000)
  assert.deepEqual(SkyLogic.weatherFx(s2, 16000), mid)
  assert.equal(s2.to, 'snow')
})

test('an overdue schedule changes only once', () => {
  const rand = seeded(5)
  const s0 = { ...SkyLogic.initialWeather('clear', 0), nextAt: 0 }
  const now = 10 * 3_600_000
  const s1 = SkyLogic.stepRandom(s0, now, 5, rand)
  assert.notEqual(s1, s0)
  assert.equal(s1.t0, now)
  assert.ok(s1.nextAt >= now + 1_200_000 && s1.nextAt <= now + 2_400_000)
  assert.equal(SkyLogic.stepRandom(s1, now, 5, rand), s1)
  assert.equal(SkyLogic.stepRandom(s1, now + 1000, 5, rand), s1)
})

test('snow covers the lawn in ~10 min and melts in ~20 min', () => {
  assert.equal(SkyLogic.snowCover(0, 1, 600_000), 1)
  assert.ok(Math.abs(SkyLogic.snowCover(0, 1, 300_000) - 0.5) < 1e-9)
  assert.ok(Math.abs(SkyLogic.snowCover(1, 0, 600_000) - 0.5) < 1e-9)
  assert.equal(SkyLogic.snowCover(0.5, 0, 1e9), 0)
  assert.equal(SkyLogic.snowCover(0.9, 1, 1e9), 1)
})

test('lightning timings are in range', () => {
  assert.equal(SkyLogic.lightningDelayMs(0), 8000)
  assert.ok(SkyLogic.lightningDelayMs(0.999) < 20000)
  assert.equal(SkyLogic.lightningFlashMs(0), 120)
  assert.ok(SkyLogic.lightningFlashMs(0.999) < 200)
})

// ---- settings and real weather ----

const memoryStorage = (initial = {}) => {
  const data = { ...initial }
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v) }, data }
}
const DEFAULTS = { mode: 'random', city: '' }

test('weather settings fall back to defaults when storage is empty or broken', () => {
  assert.deepEqual(SkyLogic.loadWeatherSettings({ getItem: () => null }), DEFAULTS)
  assert.deepEqual(SkyLogic.loadWeatherSettings({ getItem: () => { throw new Error('blocked') } }), DEFAULTS)
  assert.deepEqual(SkyLogic.loadWeatherSettings(memoryStorage({ [SkyLogic.WEATHER_KEY]: '{not json' })), DEFAULTS)
  assert.deepEqual(SkyLogic.loadWeatherSettings(memoryStorage({ [SkyLogic.WEATHER_KEY]: '{"mode":"storm","city":"Huế"}' })), { mode: 'random', city: 'Huế' })
  assert.deepEqual(SkyLogic.loadWeatherSettings(null), DEFAULTS)
})

test('weather settings round-trip', () => {
  const storage = memoryStorage()
  assert.equal(SkyLogic.saveWeatherSettings(storage, { mode: 'real', city: 'Đà Lạt' }), true)
  assert.equal(SkyLogic.WEATHER_KEY, 'ai-terrarium.weather')
  assert.deepEqual(SkyLogic.loadWeatherSettings(storage), { mode: 'real', city: 'Đà Lạt' })
  assert.equal(SkyLogic.saveWeatherSettings({ setItem: () => { throw new Error('quota') } }, { mode: 'off', city: '' }), false)
})

test('open-meteo urls encode the city and ask only for the weather code', () => {
  const geo = SkyLogic.geocodeUrl('Hồ Chí Minh')
  assert.ok(geo.startsWith('https://geocoding-api.open-meteo.com/v1/search?'))
  assert.ok(geo.includes('name=H%E1%BB%93%20Ch%C3%AD%20Minh'), geo)
  assert.ok(geo.includes('count=1'))
  const fc = SkyLogic.forecastUrl(10.82, 106.63)
  assert.ok(fc.startsWith('https://api.open-meteo.com/v1/forecast?'))
  for (const part of ['latitude=10.82', 'longitude=106.63', 'current=weather_code']) assert.ok(fc.includes(part), fc)
})

const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const fakeFetch = (geo, forecast) => async (url) => (url.includes('geocoding-api') ? geo : forecast)

test('real weather maps the current code for the found city', async () => {
  const calls = []
  const fetchFn = async (url) => {
    calls.push(url)
    return url.includes('geocoding-api') ? reply({ results: [{ name: 'Da Lat', latitude: 11.94, longitude: 108.44 }] }) : reply({ current: { weather_code: 63 } })
  }
  assert.deepEqual(await SkyLogic.fetchRealWeather('Đà Lạt', fetchFn), { ok: true, type: 'rain', code: 63, place: 'Da Lat' })
  assert.equal(calls.length, 2)
  assert.ok(calls[1].includes('latitude=11.94') && calls[1].includes('longitude=108.44'))
})

test('real weather explains every failure instead of throwing', async () => {
  const found = reply({ results: [{ name: 'X', latitude: 1, longitude: 2 }] })
  assert.deepEqual(await SkyLogic.fetchRealWeather('  ', fakeFetch()), { ok: false, reason: 'Chưa nhập thành phố' })
  assert.deepEqual(await SkyLogic.fetchRealWeather('Xyz', fakeFetch(reply({ results: [] }))), { ok: false, reason: 'Không tìm thấy thành phố "Xyz"' })
  assert.deepEqual(await SkyLogic.fetchRealWeather('Xyz', fakeFetch(reply({}))), { ok: false, reason: 'Không tìm thấy thành phố "Xyz"' })
  assert.deepEqual(await SkyLogic.fetchRealWeather('X', async () => { throw new Error('offline') }), { ok: false, reason: 'Không lấy được thời tiết: offline' })
  assert.deepEqual(await SkyLogic.fetchRealWeather('X', fakeFetch(reply({}, 500))), { ok: false, reason: 'Không lấy được thời tiết: HTTP 500' })
  assert.deepEqual(await SkyLogic.fetchRealWeather('X', fakeFetch(found, reply({ current: {} }))), { ok: false, reason: 'Dữ liệu thời tiết không đọc được' })
  assert.deepEqual(await SkyLogic.fetchRealWeather('X', fakeFetch(found, reply({ current: { weather_code: 4 } }))), { ok: false, reason: 'Dữ liệu thời tiết không đọc được' })
  assert.deepEqual(await SkyLogic.fetchRealWeather('X', fakeFetch(found, { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json') } })), { ok: false, reason: 'Dữ liệu thời tiết không đọc được' })
})

// ---- sky colours ----

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const lum = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const spread = (hex) => { const c = rgb(hex); return Math.max(...c) - Math.min(...c) }

test('sky colours are hex and the night sky is darker than the day sky', () => {
  const day = SkyLogic.skyColors(1, 12, SkyLogic.FX.clear), nightSky = SkyLogic.skyColors(0, 23, SkyLogic.FX.clear)
  for (const c of [day, nightSky]) for (const k of ['zenith', 'horizon', 'haze', 'below', 'cloud', 'cloudShade']) assert.match(c[k], /^#[0-9a-f]{6}$/, k)
  assert.ok(lum(nightSky.zenith) < lum(day.zenith) - 60)
  assert.ok(lum(nightSky.cloud) < lum(day.cloud))
})

test('the horizon turns warm at dusk', () => {
  const [r, , b] = rgb(SkyLogic.skyColors(0.5, 17.5, SkyLogic.FX.clear).horizon)
  assert.ok(r > b + 30, `dusk horizon r=${r} b=${b}`)
  const [r2, , b2] = rgb(SkyLogic.skyColors(1, 12, SkyLogic.FX.clear).horizon)
  assert.ok(b2 > r2, 'midday horizon stays blue')
})

test('storms grey the sky', () => {
  assert.ok(spread(SkyLogic.skyColors(1, 12, SkyLogic.FX.storm).zenith) < spread(SkyLogic.skyColors(1, 12, SkyLogic.FX.clear).zenith) * 0.6)
  assert.ok(lum(SkyLogic.skyColors(1, 12, SkyLogic.FX.storm).zenith) < lum(SkyLogic.skyColors(1, 12, SkyLogic.FX.clear).zenith) + 5)
})

// ---- final review fixes ----

test('a hung weather request times out with a reason instead of waiting forever', async () => {
  const never = () => new Promise(() => {})
  const r = await SkyLogic.fetchRealWeather('Đà Lạt', never, { timeoutMs: 20 })
  assert.deepEqual(r, { ok: false, reason: 'Không lấy được thời tiết: hết thời gian chờ' })
})

test('a preview lasts a minute, then the weather from before comes back', () => {
  const wx0 = SkyLogic.initialWeather('rain', 0)
  const r = SkyLogic.startPreview(wx0, null, 'storm', 1000)
  assert.equal(r.wx.to, 'storm')
  assert.deepEqual(r.preview, { type: 'storm', until: 1000 + SkyLogic.PREVIEW_MS, back: 'rain' })
  const still = SkyLogic.stepPreview(r.wx, r.preview, 30_000)
  assert.equal(still.wx, r.wx)
  assert.equal(still.preview, r.preview)
  const back = SkyLogic.stepPreview(r.wx, r.preview, 1000 + SkyLogic.PREVIEW_MS)
  assert.equal(back.preview, null)
  assert.equal(back.wx.to, 'rain')
  assert.deepEqual(SkyLogic.weatherFx(back.wx, 1000 + SkyLogic.PREVIEW_MS + 60_000), SkyLogic.FX.rain)
})

test('a second preview keeps the weather to return to', () => {
  const first = SkyLogic.startPreview(SkyLogic.initialWeather('rain', 0), null, 'storm', 1000)
  const second = SkyLogic.startPreview(first.wx, first.preview, 'snow', 20_000)
  assert.equal(second.wx.to, 'snow')
  assert.deepEqual(second.preview, { type: 'snow', until: 20_000 + SkyLogic.PREVIEW_MS, back: 'rain' })
})

test('a lightning flash fades out instead of switching off', () => {
  assert.equal(SkyLogic.flashLevel(900, 1000, 160), 0)
  assert.equal(SkyLogic.flashLevel(1000, 1000, 160), 1)
  assert.ok(Math.abs(SkyLogic.flashLevel(1080, 1000, 160) - 0.25) < 1e-9)
  assert.equal(SkyLogic.flashLevel(1160, 1000, 160), 0)
  let prev = 1
  for (let t = 1000; t <= 1160; t += 10) { const v = SkyLogic.flashLevel(t, 1000, 160); assert.ok(v <= prev); prev = v }
})

// ---- pond, stairs and walking outside ----

const officeMargin = (x, y) => x >= -1 && x <= W && y >= -1 && y <= H
const stairs = SkyLogic.stairs(W, H)

test('the pond sits on the lawn, feeds the waterfall and has two bathing spots', () => {
  const { pond } = island
  assert.ok(pond.cells.size >= 6)
  for (const k of pond.cells) {
    const [x, y] = k.split(',').map(Number)
    assert.ok(has(x, y), `pond cell ${k} is off the island`)
    assert.ok(!officeMargin(x, y), `pond cell ${k} touches the office`)
    assert.ok(!island.spots.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h), `pond cell ${k} is on a reserved spot`)
  }
  assert.ok(pond.cells.has(island.waterfall.x + ',' + island.waterfall.y), 'the waterfall pours out of the pond')
  assert.equal(pond.spots.length, 2)
  for (const s of pond.spots) assert.ok(pond.cells.has(s.x + ',' + s.y))
  for (const d of island.decor) assert.ok(!pond.cells.has(d.x + ',' + d.y), `decor ${d.x},${d.y} is in the pond`)
})

test('agents leave the office only by the stairs', () => {
  assert.deepEqual(stairs, [{ side: 'east', x: W, y: 7, len: 2 }, { side: 'south', x: 22, y: H, len: 2 }])
  assert.equal(SkyLogic.canCross([W - 1, 7], [W, 7], W, H, stairs), true)
  assert.equal(SkyLogic.canCross([22, H - 1], [22, H], W, H, stairs), true)
  assert.equal(SkyLogic.canCross([23, H], [23, H - 1], W, H, stairs), true)
  assert.equal(SkyLogic.canCross([21, H - 1], [21, H], W, H, stairs), false)
  assert.equal(SkyLogic.canCross([24, H - 1], [24, H], W, H, stairs), false)
  assert.equal(SkyLogic.canCross([W, 8], [W - 1, 8], W, H, stairs), true)
  assert.equal(SkyLogic.canCross([W - 1, 6], [W, 6], W, H, stairs), false)
  assert.equal(SkyLogic.canCross([5, H - 1], [5, H], W, H, stairs), false)
  assert.equal(SkyLogic.canCross([3, 3], [4, 3], W, H, stairs), true)
  assert.equal(SkyLogic.canCross([W, 10], [W + 1, 10], W, H, stairs), true)
})

test('the lawn walk avoids water, trees and rocks but reaches the bathing spots', () => {
  const walk = SkyLogic.lawnWalk(island, W, H)
  for (const s of island.pond.spots) assert.ok(walk.has(s.x + ',' + s.y))
  for (const k of island.pond.cells) if (!island.pond.spots.some((s) => s.x + ',' + s.y === k)) assert.ok(!walk.has(k), `water cell ${k} is walkable`)
  for (const d of island.decor) if (d.kind !== 'flower') assert.ok(!walk.has(d.x + ',' + d.y), `${d.kind} at ${d.x},${d.y} is walkable`)
  assert.ok(!walk.has('5,5'), 'office cells are not lawn')
  assert.ok(walk.has(W + ',7') && walk.has(W + ',8'), 'the foot of the east stairs is walkable')
  assert.ok(walk.has('22,' + H) && walk.has('23,' + H), 'the foot of the south stairs is walkable')
})

// ---- garden paths ----

const inSpotId = (id, x, y) => island.spots.some((s) => s.id === id && x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
// Breadth-first search that may only step on the given cell set.
const reachWithin = (cells, from, to) => {
  const seen = new Set([from + '']), q = [from]
  while (q.length) {
    const [x, y] = q.shift()
    if (x === to[0] && y === to[1]) return true
    for (const [a, b] of N4) { const k = (x + a) + ',' + (y + b); if (cells.has(k) && !seen.has(k)) { seen.add(k); q.push([x + a, y + b]) } }
  }
  return false
}

test('garden paths are the same on every machine', () => {
  const again = SkyLogic.buildIsland({ W, H })
  assert.deepEqual([...again.paths.cells].sort(), [...island.paths.cells].sort())
  assert.deepEqual(again.paths.lines, island.paths.lines)
})

test('garden paths lie on walkable lawn, off the water and the reserved spots', () => {
  const walk = SkyLogic.lawnWalk(island, W, H)
  assert.ok(island.paths.cells.size > 0)
  for (const k of island.paths.cells) {
    const [x, y] = k.split(',').map(Number)
    assert.ok(walk.has(k), `path cell ${k} is not walkable`)
    assert.ok(!inOffice(x, y), `path cell ${k} is inside the office`)
    assert.ok(!island.pond.cells.has(k), `path cell ${k} is in the pond`)
    assert.ok(!island.spots.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h), `path cell ${k} is on a reserved spot`)
  }
  for (const d of island.decor) assert.ok(!island.paths.cells.has(d.x + ',' + d.y), `${d.kind} at ${d.x},${d.y} sits on the path`)
})

test('garden paths join both stairs to the pond and the east stairs to the smoking corner, never into the restroom block', () => {
  const cells = island.paths.cells
  const bath = island.pond.spots.reduce((a, b) => (b.y < a.y ? b : a))
  const entry = [bath.x, bath.y - 1]
  assert.ok(cells.has(entry + ''), 'the path ends right next to a bathing spot')
  assert.ok(reachWithin(cells, [W, 8], entry), 'east stairs → pond')
  assert.ok(reachWithin(cells, [23, H], entry), 'south stairs → pond')
  assert.equal(island.paths.lines.length, 3, 'one leg from each flight of stairs, and one to the smoking corner')
  const smoke = island.spots.find((s) => s.id === 'east-front')
  assert.ok(reachWithin(cells, [W, 7], [smoke.x - 1, smoke.y + smoke.h - 1]), 'east stairs → smoking corner entrance')
  for (const k of cells) assert.ok(!inSpotId('east-back', ...k.split(',').map(Number)), `path cell ${k} runs into the restroom block`)
})

test('garden paths keep the big lawn in front of the office whole', () => {
  for (const k of island.paths.cells) {
    const [x, y] = k.split(',').map(Number)
    assert.ok(x >= 22, `path cell ${k} cuts into the front lawn`)
    assert.ok(y <= H + 2 || x >= island.pond.spots[0].x - 1, `path cell ${k} wanders into the open lawn`)
  }
})

test('path lines start at the stair feet and run through the path cells', () => {
  for (const line of island.paths.lines) {
    assert.ok(line.length >= 2)
    for (const [x, y] of line.slice(1)) assert.ok(island.paths.cells.has(Math.floor(x) + ',' + Math.floor(y)), `line point ${x},${y} is off the path`)
  }
})

test('stepping stones keep off the reserved spots, the pond and the office', () => {
  const { stones } = island.paths
  assert.ok(stones.length > 10)
  for (const st of stones) {
    assert.equal(st.outline.length, 8)
    for (const [x, y] of st.outline) {
      const at = `stone at ${st.x.toFixed(2)},${st.y.toFixed(2)} reaches ${x.toFixed(2)},${y.toFixed(2)}`
      for (const s of island.spots) assert.ok(!(x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h), `${at}, inside spot ${s.id}`)
      assert.ok(!island.pond.cells.has(Math.floor(x) + ',' + Math.floor(y)), `${at}, in the pond`)
      assert.ok(!inOffice(x, y), `${at}, on the office floor`)
      assert.ok(has(Math.floor(x), Math.floor(y)), `${at}, off the island`)
    }
  }
})

test('stepping stones are laid about one stride apart', () => {
  const { stones } = island.paths
  for (const a of stones) {
    const near = Math.min(...stones.filter((b) => b !== a).map((b) => Math.hypot(a.x - b.x, a.y - b.y)))
    assert.ok(near >= 0.6 && near <= 1.0, `stone at ${a.x.toFixed(2)},${a.y.toFixed(2)} has its nearest neighbour ${near.toFixed(2)} tiles away`)
  }
})

test('the restroom block spot runs along the pantry east side, from the back-wall line to just above the east stairs', () => {
  const spot = island.spots.find((s) => s.id === 'east-back')
  assert.equal(spot.x, W, 'it starts right at the pantry edge')
  assert.equal(spot.y, 0, 'its back row is the office back row')
  const east = stairs.find((s) => s.side === 'east')
  assert.equal(spot.y + spot.h, east.y, 'its front row ends where the east stairs begin')
  const stones = island.paths.stones.filter((st) => st.y < east.y)
  assert.deepEqual(stones, [], 'no stepping stone above the east stairs')
  // the block's back wall (0.35 thick behind y = 0, like the office's) stands on land for all but its last tile
  for (let x = spot.x; x < spot.x + spot.w - 1; x++) assert.ok(has(x, -1), `no land under the back wall at x ${x}`)
})

// ---- cheapest route on the grid ----

const grid = (w, h) => (a, b) => b[0] >= 0 && b[1] >= 0 && b[0] < w && b[1] < h

test('with even costs the cheapest route is a shortest route', () => {
  const route = SkyLogic.cheapestPath([0, 0], [4, 3], grid(6, 6), () => 1)
  assert.equal(route.length, 7)
  assert.deepEqual(route[route.length - 1], [4, 3])
})

test('the cheapest route takes a short detour along cheap cells', () => {
  // a cheap lane along y = 2; walking straight across the expensive grass would be 2 steps shorter
  const lane = (c) => (c[1] === 2 ? 1 : 3)
  const route = SkyLogic.cheapestPath([0, 2], [5, 1], grid(6, 6), lane)
  assert.deepEqual(route.slice(0, 4), [[1, 2], [2, 2], [3, 2], [4, 2]])
})

test('the cheapest route cuts across expensive cells when the detour is too long', () => {
  const lane = (c) => (c[1] === 0 ? 1 : 2)
  const route = SkyLogic.cheapestPath([0, 0], [0, 5], grid(6, 6), lane)
  assert.equal(route.length, 5)
  assert.ok(route.every(([x]) => x === 0))
})

test('the cheapest route respects blocked steps and reports unreachable goals', () => {
  const wall = (a, b) => grid(5, 5)(a, b) && b[0] !== 2
  assert.deepEqual(SkyLogic.cheapestPath([0, 0], [4, 4], wall, () => 1), [])
  assert.deepEqual(SkyLogic.cheapestPath([1, 1], [1, 1], wall, () => 1), [])
})

test('agents walking out to the pond keep to the garden path', () => {
  const walk = SkyLogic.lawnWalk(island, W, H)
  const cells = island.paths.cells
  const bath = island.pond.spots.reduce((a, b) => (b.y < a.y ? b : a))
  const step = (a, b) => SkyLogic.canCross(a, b, W, H, stairs) && !inOffice(b[0], b[1]) && walk.has(b + '')
  const cost = (c) => (cells.has(c + '') ? 1 : SkyLogic.GRASS_COST)
  for (const from of [[W, 8], [23, H]]) {
    const route = SkyLogic.cheapestPath(from, [bath.x, bath.y], step, cost)
    assert.ok(route.length > 0, `no way from ${from} to the pond`)
    for (const c of route.slice(0, -1)) assert.ok(cells.has(c + ''), `from ${from} the walk leaves the path at ${c}`)
  }
})

test('agents still reach lawn goals off the path, and not by a long detour', () => {
  const walk = SkyLogic.lawnWalk(island, W, H)
  const step = (a, b) => SkyLogic.canCross(a, b, W, H, stairs) && !inOffice(b[0], b[1]) && walk.has(b + '')
  const cost = (c) => (island.paths.cells.has(c + '') ? 1 : SkyLogic.GRASS_COST)
  const spot = (id) => island.spots.find((s) => s.id === id)
  for (const [from, s] of [[[W, 8], spot('east-front')], [[23, H], spot('south-left')]]) {
    const goal = [s.x + 1, s.y + 1]
    const route = SkyLogic.cheapestPath(from, goal, step, cost), shortest = SkyLogic.cheapestPath(from, goal, step, () => 1)
    assert.ok(route.length > 0, `no way from ${from} to ${s.id}`)
    assert.deepEqual(route[route.length - 1], goal)
    assert.ok(route.length <= shortest.length + 4, `to ${s.id} the walk is ${route.length} steps, the shortest ${shortest.length}`)
  }
})

test('ground height is the floor inside, the lawn outside, and steps down the stairs', () => {
  const g = (x, y) => SkyLogic.groundZ(x, y, W, H, stairs, 8)
  assert.equal(g(10, 5), 8)
  assert.equal(g(W + 2, 7.5), 0)
  assert.equal(g(W + 0.3, 3), 0)
  const mid = g(W + 0.3, 7.5)
  assert.ok(mid > 0 && mid < 8, `half way down the stairs is ${mid}`)
  assert.ok(g(W + 0.1, 7.5) >= g(W + 0.5, 7.5))
  const south = g(22.5, H + 0.3)
  assert.ok(south > 0 && south < 8, `half way down the south stairs is ${south}`)
  assert.equal(g(22.5, H + 2), 0)
  assert.equal(g(20.5, H + 0.3), 0)
})

// ---- snow cover vs previews ----

test('a preview remembers which weather it shows', () => {
  const r = SkyLogic.startPreview(SkyLogic.initialWeather('clear', 0), null, 'snow', 0)
  assert.equal(r.preview.type, 'snow')
})

test('previewing snow whitens the lawn only while the preview lasts', () => {
  const during = SkyLogic.stepSnow(0, SkyLogic.FX.snow, { type: 'snow', back: 'clear', until: 60_000 }, 60_000)
  assert.deepEqual(during, { cover: 0, shown: 1 })
  const after = SkyLogic.stepSnow(during.cover, SkyLogic.FX.clear, null, 16)
  assert.deepEqual(after, { cover: 0, shown: 0 })
})

test('a non-snow preview shows the real snow cover underneath, which keeps building', () => {
  const r = SkyLogic.stepSnow(0.4, SkyLogic.FX.rain, { type: 'rain', back: 'snow', until: 60_000 }, 60_000)
  assert.ok(Math.abs(r.cover - 0.5) < 1e-9 && r.shown === r.cover)
})

test('real snow still covers the lawn over about 10 minutes', () => {
  assert.deepEqual(SkyLogic.stepSnow(0, SkyLogic.FX.snow, null, 600_000), { cover: 1, shown: 1 })
})
