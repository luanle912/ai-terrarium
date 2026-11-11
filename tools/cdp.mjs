// Shared by the tools here: a page of a Chrome started with --remote-debugging-port, driven over the DevTools protocol.
export function args(defaults) {
  const out = { ...defaults }
  const a = process.argv.slice(2)
  for (let i = 0; i < a.length; i += 2) out[a[i].replace(/^--/, '')] = a[i + 1]
  return out
}
export async function page(port) {
  let list
  for (let i = 0; i < 30 && !list; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(500) }
  }
  if (!list) throw new Error(`no Chrome on port ${port}: start one with --headless=new --remote-debugging-port=${port}`)
  const ws = new WebSocket(list.find(p => p.type === 'page').webSocketDebuggerUrl)
  await new Promise(r => ws.addEventListener('open', r))
  let id = 0
  const pend = new Map(), errors = []
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 300))
  })
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('Runtime.enable'); await send('Page.enable')
  return { send, errors, close: () => ws.close() }
}
export const sleep = ms => new Promise(r => setTimeout(r, ms))
// Runs before the page's own scripts: `new Date()` and Date.now() read as if it were `at` (an ISO local time) now.
export const dateShim = at => `(() => { const RD = Date, off = new RD('${at}').getTime() - RD.now();
  class D extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off) } static now() { return RD.now() + off } }
  window.Date = D })();`
