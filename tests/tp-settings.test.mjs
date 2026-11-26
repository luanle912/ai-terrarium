// The teleport style in Settings (web/tp-settings.js): Random, Off and every style by name, the choice saved in the
// browser, posted to the local server and adopted from it like the event choice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb, readWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('en')
// A React that keeps the element tree, so the section can be read back.
globalThis.React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }), Component: class {} }
globalThis.document ??= { visibilityState: 'visible' }
const { ClaudeOffice } = loadWeb('office')
loadWeb('office-render-settings')
const { TpStyles } = loadWeb('tp-styles')
const { tr } = loadWeb('i18n')

const all = (el, type, out = []) => {
  if (!el || typeof el !== 'object') return out
  if (el.type === type) out.push(el)
  for (const c of el.children || []) all(c, type, out)
  return out
}
const text = el => (el.children || []).map(c => (typeof c === 'object' ? text(c) : String(c))).join('')
function page(over = {}) {
  const saved = [],
    pushed = []
  const p = Object.assign(Object.create(ClaudeOffice.prototype), {
    state: { weatherMode: 'off', city: '' },
    eventChoice: 'auto',
    storage: { getItem: () => null, setItem: (k, v) => saved.push([k, v]) },
    setState(patch, cb) {
      Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch)
      cb && cb()
    },
    pushSettings: w => pushed.push(w),
    ...over,
  })
  return { p, saved, pushed }
}

test('the section lists Random, Off and every style by name, the holiday ones apart', () => {
  TpStyles.reset()
  const { p } = page(),
    el = p.teleportSection(),
    sel = all(el, 'select')[0]
  assert.equal(el.props.id, 'teleport-section')
  assert.equal(sel.props.value, 'random')
  assert.equal(sel.props['aria-label'], tr('settings.teleport.mode'))
  const opts = all(sel, 'option')
  assert.deepEqual(opts.map(o => o.props.value).sort(), [...TpStyles.CHOICES].sort())
  assert.deepEqual(opts.slice(0, 2).map(text), [tr('settings.teleport.random'), tr('settings.teleport.off')])
  for (const o of opts.slice(2)) {
    assert.equal(text(o), tr('tp.style.' + o.props.value))
    assert.ok(!text(o).startsWith('tp.style.'), `${o.props.value} has an English name`)
  }
  const groups = all(sel, 'optgroup')
  assert.equal(opts.length, 38)
  assert.deepEqual(groups.map(g => g.props.label), [tr('settings.teleport.styles'), tr('settings.teleport.holidays')])
  assert.deepEqual(all(groups[0], 'option').map(o => o.props.value), TpStyles.RANDOM)
  assert.deepEqual(all(groups[1], 'option').map(o => o.props.value).sort(), Object.values(TpStyles.HOLIDAY).sort())
  assert.equal(text(all(el, 'label')[0]).startsWith(tr('settings.teleport')), true)
})

test('choosing a style applies it, saves it and posts it; from the server it is not posted back', () => {
  TpStyles.reset()
  const { p, saved, pushed } = page()
  p.setTpChoice('dashrun')
  assert.equal(TpStyles.choice(), 'dashrun')
  assert.deepEqual(saved.at(-1), ['ai-terrarium.teleport', 'dashrun'])
  assert.equal(pushed.length, 1)
  assert.equal(p.state.tpChoice, 'dashrun')
  p.setTpChoice('nonsense')
  assert.equal(TpStyles.choice(), 'dashrun', 'an unknown value is ignored')
  p.setTpChoice('off', true)
  assert.equal(TpStyles.choice(), 'off')
  assert.equal(pushed.length, 1)
  TpStyles.reset()
})

test('adoptSettings takes the server choice; a server with none is seeded once with this page own', () => {
  TpStyles.reset()
  const { p, pushed } = page({ wallpaper: false })
  p.adoptSettings({ weather: { mode: 'off', city: '' }, teleport: 'gitbranch' })
  assert.equal(TpStyles.choice(), 'gitbranch')
  p.adoptSettings({ weather: { mode: 'off', city: '' }, teleport: 'mole' })
  assert.equal(TpStyles.choice(), 'mole')
  assert.equal(pushed.length, 0, 'taken from the server: not posted back')
  const q = page({ wallpaper: false })
  TpStyles.setChoice('pipe')
  q.p.adoptSettings({ weather: { mode: 'off', city: '' } })
  assert.equal(q.pushed.length, 1, 'seeded')
  q.p.adoptSettings({ weather: { mode: 'off', city: '' } })
  assert.equal(q.pushed.length, 1, 'once')
  TpStyles.reset()
})

test('the page loads the saved choice and sends it with the others', () => {
  const office = readWeb('office')
  assert.match(office, /^import \{ TpStyles \} from '\.\/tp-styles\.js';$/m)
  assert.match(office, /TpStyles\.setChoice\(TpStyles\.loadChoice\(this\.storage\)\);/)
  assert.match(office, /teleport: TpStyles\.choice\(\),/)
  assert.match(readWeb('office-render-settings'), /this\.eventSection\(\),\n\s*this\.teleportSection\(\),/)
})
