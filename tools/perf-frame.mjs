// node tools/perf-frame.mjs --port 9333 --url http://localhost:4317/ --at 2026-12-20T21:00:00 [--seconds 9]
// One line of JSON about a frame of the page at that date and time: the JS time of ClaudeOffice.frame (p50 / p95, ms),
// the canvas calls it makes (p50), each bake of the island (renderIsland / renderProps, ms) and the share of time in GC.
// The first 60 frames are left out. See tools/README.md for the baseline and the budget.
import { args, page, sleep, dateShim } from './cdp.mjs'

const o = args({ port: 9333, url: 'http://localhost:4317/', at: '', seconds: 9, w: 1512, h: 982, dpr: 2 })
const p = await page(o.port)
await p.send('Emulation.setDeviceMetricsOverride', { width: +o.w, height: +o.h, deviceScaleFactor: +o.dpr, mobile: false })
const hook = `${o.at ? dateShim(o.at) : ''}
(() => {
  const N = (window.__perf = { calls: 0, frames: [], per: [], bakes: [] }), P = CanvasRenderingContext2D.prototype;
  for (const m of ['fillRect', 'fill', 'stroke', 'drawImage', 'strokeRect', 'clearRect', 'fillText']) {
    const f = P[m]; P[m] = function (...a) { N.calls++; return f.apply(this, a) } }
  // the page's own modules, wrapped before its first frame: the same module instances the page imports. They need the
  // page's React global, so wait for it.
  const ready = fn => (window.React && window.ReactDOM ? fn() : setTimeout(() => ready(fn), 0));
  ready(() => {
  import('/web/sky-render.js').then(({ SkyRender }) => {
    for (const m of ['renderIsland', 'renderProps']) { const f = SkyRender[m];
      SkyRender[m] = (...a) => { const t = performance.now(), v = f(...a); N.bakes.push([m, +(performance.now() - t).toFixed(1)]); return v } } });
  import('/web/office.js').then(({ ClaudeOffice }) => { const f = ClaudeOffice.prototype.frame;
    ClaudeOffice.prototype.frame = function (ts) { const c = N.calls, t = performance.now(), v = f.call(this, ts);
      N.frames.push(performance.now() - t); N.per.push(N.calls - c); return v } });
  });
})();`
const s = await p.send('Page.addScriptToEvaluateOnNewDocument', { source: hook })
await p.send('Page.navigate', { url: o.url }); await sleep(3000)
await p.send('Profiler.enable'); await p.send('Profiler.setSamplingInterval', { interval: 500 }); await p.send('Profiler.start')
await sleep(+o.seconds * 1000)
const { result: { profile } } = await p.send('Profiler.stop')
const self = new Map(); profile.samples.forEach((n, i) => self.set(n, (self.get(n) || 0) + (profile.timeDeltas[i] || 0)))
let total = 0, gc = 0
for (const n of profile.nodes) { const t = self.get(n.id) || 0; total += t; if (n.callFrame.functionName === '(garbage collector)') gc += t }
const r = await p.send('Runtime.evaluate', { returnByValue: true, expression: `(() => { const N = window.__perf,
  q = (a, f) => { const s = a.slice(60).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * f)] : null };
  return { frames: N.frames.length, ms_p50: +q(N.frames, .5)?.toFixed(2), ms_p95: +q(N.frames, .95)?.toFixed(2), calls_p50: q(N.per, .5), bakes: N.bakes } })()` })
await p.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: s.result.identifier })
console.log(JSON.stringify({ at: o.at, url: o.url, ...r.result.result.value, gcPct: +((gc / total) * 100).toFixed(2), errors: p.errors }))
p.close()
