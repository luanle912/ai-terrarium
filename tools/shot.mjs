// node tools/shot.mjs --port 9333 --url http://localhost:4317/ --at 2026-12-20T21:00:00 --out shot.png [--w 1512 --h 982 --dpr 2]
//   [--eval "js run in the page after --wait ms" --settle 3000]  e.g. __office.setState({ dataSource: 'sim', agentCount: 16 })
// A screenshot of the page as it looks at a given date and time, to compare before and after a change.
import fs from 'node:fs'
import { args, page, sleep, dateShim } from './cdp.mjs'

const o = args({ port: 9333, url: 'http://localhost:4317/', at: '', out: 'shot.png', w: 1512, h: 982, dpr: 2, wait: 6000, eval: '', settle: 3000 })
const p = await page(o.port)
await p.send('Emulation.setDeviceMetricsOverride', { width: +o.w, height: +o.h, deviceScaleFactor: +o.dpr, mobile: false })
const s = o.at ? await p.send('Page.addScriptToEvaluateOnNewDocument', { source: dateShim(o.at) }) : null
await p.send('Page.navigate', { url: o.url }); await sleep(+o.wait)
let ev = null
const js = o.eval[0] === '@' ? fs.readFileSync(o.eval.slice(1), 'utf8') : o.eval // --eval @file.js reads the script from a file
if (js) { ev = (await p.send('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true })).result; await sleep(+o.settle) }
const shot = await p.send('Page.captureScreenshot', { format: 'png' })
fs.writeFileSync(o.out, Buffer.from(shot.result.data, 'base64'))
if (s) await p.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: s.result.identifier })
console.log(JSON.stringify({ out: o.out, at: o.at, eval: ev && (ev.exceptionDetails ? ev.exceptionDetails.exception?.description : ev.result?.value), errors: p.errors }))
p.close()
