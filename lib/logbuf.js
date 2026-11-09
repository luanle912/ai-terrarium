'use strict'
// Ring buffer of the publisher's log lines, served by GET /api/log. Every line is masked before it is stored or
// handed to the sink, so a token can never reach the buffer, the console or the page.
const mask = (s) => String(s).replace(/Bearer\s+\S+/g, 'Bearer ***').replace(/"token"\s*:\s*"[^"]*"/g, '"token":"***"')

function createLogBuffer({ size = 200, now = Date.now, sink = console.log } = {}) {
  const buf = []
  return {
    log(line) {
      const l = mask(line)
      buf.push({ at: now(), line: l })
      if (buf.length > size) buf.splice(0, buf.length - size)
      try { sink(l) } catch {}
    },
    lines() { return buf.map((e) => ({ ...e })) },
  }
}

module.exports = { createLogBuffer }
