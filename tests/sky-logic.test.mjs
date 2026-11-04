import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadSkyLogic } from './load-sky-logic.mjs'

const SkyLogic = loadSkyLogic()
const W = 27, H = 14, TW = 16, TH = 8, WALL = 56
const island = SkyLogic.buildIsland({ W, H, lawn: 6, back: 2 })
const has = (x, y) => island.cells.has(x + ',' + y)
const neighbours = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => has(x + a, y + b)).length
const inOffice = (x, y) => x >= 0 && x < W && y >= 0 && y < H

// ---- island ----

test('island is deterministic', () => {
  const again = SkyLogic.buildIsland({ W, H, lawn: 6, back: 2 })
  assert.deepEqual(again.list, island.list)
})

test('island contains the whole office', () => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) assert.ok(has(x, y), `office cell ${x},${y}`)
})

test('lawn is 6 tiles wide in front and a thin 2-tile strip behind the walls', () => {
  for (const [x, y] of [[13, 19], [32, 7]]) assert.ok(has(x, y), `front lawn cell ${x},${y}`)
  for (const [x, y] of [[13, -2], [-2, 7]]) assert.ok(has(x, y), `back lawn cell ${x},${y}`)
  for (const [x, y] of [[13, -4], [-4, 7]]) assert.ok(!has(x, y), `lawn behind the walls is wider than 3 tiles at ${x},${y}`)
})

test('the island defaults to the approved lawn widths', () => {
  assert.equal(SkyLogic.LAWN, 6)
  assert.equal(SkyLogic.LAWN_BACK, 2)
  assert.deepEqual(SkyLogic.buildIsland({ W, H }).list, island.list)
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

test('underside is deepest inside', () => {
  const centre = island.depth.get('13,7')
  for (const c of island.list) if (c.shore === 0) assert.ok(centre > c.d, `shore cell ${c.x},${c.y} is as deep as the centre`)
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

test('scene frame fits the island and keeps the office near 63%', () => {
  const f = SkyLogic.sceneFrame(island, { W, H, TW, TH, WALL, pad: 16 })
  const P = (x, y, z = 0) => [f.OX + (x - y) * TW, f.OY + (x + y) * TH - z]
  for (const c of island.list) {
    for (const [px, py] of [P(c.x, c.y), P(c.x + 1, c.y + 1, -c.d), P(c.x + 1, c.y), P(c.x, c.y + 1, -c.d)]) {
      assert.ok(px >= 0 && px <= f.LW && py >= 0 && py <= f.LH, `cell ${c.x},${c.y} leaves the frame`)
    }
  }
  // Office size on screen compared to today's 688×414 scene, both fitted into the 1440×900 window's stage (1408×813).
  const fit = (lw, lh) => Math.min(1408 / lw, 813 / lh)
  const rel = fit(f.LW, f.LH) / fit(688, 414)
  assert.ok(rel >= 0.58 && rel <= 0.68, `office is ${(rel * 100).toFixed(1)}% of today's size`)
  for (const v of Object.values(f)) assert.ok(Number.isInteger(v))
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

test('the camera frames the island top, so the office is bigger than the whole-island fit', () => {
  const f = SkyLogic.sceneFrame(island, { W, H, TW, TH, WALL: WALL + 8, pad: 16 })
  assert.ok(Number.isInteger(f.FH) && f.FH < f.LH)
  const fit = (lw, lh) => Math.min(1408 / lw, 813 / lh)
  const rel = fit(f.LW, f.FH) / fit(688, 414)
  assert.ok(rel >= 0.7 && rel <= 0.85, `office is ${(rel * 100).toFixed(1)}% of today's size`)
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
