// IslandScene (world mode) borrows ClaudeOffice's simulation and drawing methods by name (SCENE_METHODS). A borrowed
// method that calls another method of the office not on that list throws on the island every frame, so this test reads
// each borrowed method's body and checks every `this.x(` call it makes is borrowed too, or is IslandScene's own.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const WEB = new URL('../web/', import.meta.url)
const read = f => readFileSync(new URL(f, WEB), 'utf8')
const scene = read('island-scene.js')
const listed = new Set([...scene.match(/SCENE_METHODS = \[([\s\S]*?)\]/)[1].matchAll(/'(\w+)'/g)].map(m => m[1]))
const own = new Set([...scene.matchAll(/^ {2}(?:get |set )?(\w+)\(/gm)].map(m => m[1]))

// Method bodies of the office mixins: a method starts at a line `    name(args) {` (class body in mixin) and runs to the
// next such line.
function bodies() {
  const out = new Map()
  for (const f of readdirSync(WEB).filter(n => /^office.*\.js$/.test(n))) {
    const lines = read(f).split('\n')
    let name = null
    for (const l of lines) {
      const m = /^ {2,4}(\w+)\([^)]*\) \{$/.exec(l)
      if (m && !['if', 'for', 'while', 'switch', 'catch', 'function'].includes(m[1])) name = m[1]
      if (name) out.set(name, (out.get(name) || '') + l + '\n')
    }
  }
  return out
}

test('every method a borrowed scene method calls is borrowed too', () => {
  const src = bodies()
  const missing = []
  for (const name of listed) {
    const body = src.get(name)
    if (!body) continue
    for (const m of body.matchAll(/\bthis\.(\w+)\(/g)) {
      const callee = m[1]
      if (listed.has(callee) || own.has(callee) || !src.has(callee)) continue
      missing.push(`${name} → ${callee}`)
    }
  }
  assert.deepEqual([...new Set(missing)], [])
})
