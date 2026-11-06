import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createPublicView, kindOf, STATUSES, KINDS, MAX_SESSIONS } = require('../lib/public-view.js')

const SALT = 'a1'.repeat(32)
const mk = (o = {}) => ({
  id: 'real-id-1', parentId: null, name: 'secret-session-name', project: 'ai-terrarium', cwd: '/Users/victim/secret',
  model: 'claude-opus-4-5', tokens: 123, status: 'working', tool: 'Bash',
  detail: 'curl -H "Authorization: Bearer XYZ" sk-ant-api03-SECRET', talkingTo: '', _sendTo: { name: 'x' },
  recent: [{ t: '10:00:00', text: 'sk-ant-api03-SECRET' }], updatedAt: 1000, ...o,
})
const snap = (sessions) => ({ at: 1, sessions, usage: { token: 'sk-ant-api03-SECRET' }, version: '1.3.4' })
const opts = (o = {}) => ({ share: 'kin', projects: [], private: false, ...o })

test('no secret leaves the machine', () => {
  const s = snap([mk(), mk({ id: 'real-id-2', parentId: 'real-id-1', name: 'reviewer', talkingTo: 'secret-session-name' })])
  for (const share of ['kin', 'co-ban']) {
    const json = JSON.stringify(createPublicView(SALT)(s, opts({ share, projects: ['ai-terrarium'] })))
    for (const bad of ['SECRET', 'victim', 'Bearer', 'secret-session-name', 'real-id', 'usage', 'cwd', '_sendTo', 'recent', 'detail']) {
      assert.ok(!json.includes(bad), `${share} leaked ${bad}`)
    }
  }
})

test('ids are stable, salted and 12 hex', () => {
  const s = snap([mk()])
  const a = createPublicView(SALT)(s, opts()).sessions[0].id
  const b = createPublicView(SALT)(s, opts()).sessions[0].id
  const c = createPublicView('b2'.repeat(32))(s, opts()).sessions[0].id
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.match(a, /^[0-9a-f]{12}$/)
})

test('kin hides project names', () => {
  const view = createPublicView(SALT)
  const s1 = snap([mk({ id: '1', project: 'alpha' }), mk({ id: '2', project: 'beta' })])
  const o1 = view(s1, opts()).sessions
  assert.deepEqual(o1.map(x => x.dept), ['A', 'B'])
  const s2 = snap([mk({ id: '2', project: 'beta' }), mk({ id: '1', project: 'alpha' })])
  assert.deepEqual(view(s2, opts()).sessions.map(x => x.dept), ['B', 'A'])
})

test('co-ban shows only allowed projects', () => {
  const view = createPublicView(SALT)
  const s = snap([mk({ id: '1', project: 'ai-terrarium' }), mk({ id: '2', project: 'other' })])
  const out = view(s, opts({ share: 'co-ban', projects: ['ai-terrarium'] })).sessions
  assert.equal(out[0].dept, 'ai-terrarium')
  assert.match(out[1].dept, /^[A-P]$/)
})

test('tool and model only at co-ban', () => {
  const view = createPublicView(SALT)
  const s = snap([mk({ id: '1' }), mk({ id: '2', tool: 'mcp__github__create_issue', model: 'gpt-4' })])
  const kin = view(s, opts()).sessions
  assert.ok(!('tool' in kin[0]) && !('model' in kin[0]))
  const cb = view(s, opts({ share: 'co-ban' })).sessions
  assert.equal(cb[0].tool, 'Bash')
  assert.equal(cb[0].model, 'claude-opus-4-5')
  assert.equal(cb[1].tool, 'mcp__github')
  assert.equal(cb[1].kind, 'mcp')
  assert.ok(!('model' in cb[1]))
})

test('kindOf', () => {
  assert.equal(kindOf('Bash'), 'shell')
  assert.equal(kindOf('Edit'), 'edit')
  assert.equal(kindOf('Grep'), 'read')
  assert.equal(kindOf('WebFetch'), 'web')
  assert.equal(kindOf('Agent'), 'agent')
  assert.equal(kindOf(''), 'none')
  assert.equal(kindOf('Foo'), 'other')
  assert.equal(kindOf('mcp__x__y'), 'mcp')
  assert.ok(KINDS.includes('mcp') && STATUSES.includes('permission'))
})

test('talkingTo by name becomes the hashed id', () => {
  const view = createPublicView(SALT)
  const s = snap([
    mk({ id: 'a', talkingTo: 'reviewer' }),
    mk({ id: 'b', name: 'reviewer', parentId: 'a', talkingTo: 'ghost' }),
  ])
  const out = view(s, opts()).sessions
  assert.equal(out[0].talkingTo, out[1].id)
  assert.equal(out[1].talkingTo, null)
  assert.equal(out[1].parent, out[0].id)
  assert.equal(out[0].parent, null)
})

test('waitingOn is hashed like id', () => {
  const s = snap([mk({ id: 'a', status: 'waiting', waitingOn: 'b' }), mk({ id: 'b' })])
  const out = createPublicView(SALT)(s, opts()).sessions
  assert.equal(out[0].waitingOn, out[1].id)
})

test('unknown status becomes working', () => {
  const out = createPublicView(SALT)(snap([mk({ status: 'exploding' })]), opts()).sessions
  assert.equal(out[0].status, 'working')
})

test('private sends no sessions', () => {
  assert.deepEqual(createPublicView(SALT)(snap([mk()]), opts({ private: true })), { private: true, sessions: [] })
})

test('caps at 32, roots first', () => {
  const list = []
  for (let i = 0; i < 35; i++) list.push(mk({ id: 'k' + i, parentId: 'r0', updatedAt: 5000 + i }))
  for (let i = 0; i < 5; i++) list.push(mk({ id: 'r' + i, updatedAt: i }))
  const out = createPublicView(SALT)(snap(list), opts()).sessions
  assert.equal(out.length, MAX_SESSIONS)
  assert.equal(out.filter(x => x.parent === null).length, 5)
})

test('output keys are exactly the allowlist', () => {
  const view = createPublicView(SALT)
  const s = snap([mk({ id: 'a', status: 'waiting', waitingOn: 'b' }), mk({ id: 'b', parentId: 'a' })])
  const base = ['id', 'parent', 'status', 'waitingOn', 'talkingTo', 'dept', 'kind']
  for (const x of view(s, opts()).sessions) for (const k of Object.keys(x)) assert.ok(base.includes(k), k)
  for (const x of view(s, opts({ share: 'co-ban' })).sessions) for (const k of Object.keys(x)) assert.ok([...base, 'tool', 'model'].includes(k), k)
})

test('kin never shows a listed project name', () => {
  const s = snap([mk({ id: '1', project: 'ai-terrarium' })])
  const out = createPublicView(SALT)(s, opts({ share: 'kin', projects: ['ai-terrarium'] }))
  assert.ok(!JSON.stringify(out).includes('ai-terrarium'))
  assert.match(out.sessions[0].dept, /^[A-P]$/)
})

test('co-ban tool is sanitized', () => {
  const view = createPublicView(SALT)
  const s = snap([
    mk({ id: '1', tool: 'Bash; rm -rf /Users/victim' }),
    mk({ id: '2', tool: 'A'.repeat(80) }),
    mk({ id: '4', tool: 'B'.repeat(32) + '/Users/victim' }),
    mk({ id: '3', tool: 'mcp__ev il/srv__fn' }),
  ])
  for (const x of view(s, opts({ share: 'co-ban' })).sessions) {
    if ('tool' in x) assert.match(x.tool, /^[A-Za-z0-9_.-]{0,32}$/)
  }
  // Path text after the 32-char cap must not survive.
  const long = view(snap([mk({ id: '4', tool: 'B'.repeat(32) + '/Users/victim' })]), opts({ share: 'co-ban' }))
  assert.ok(!JSON.stringify(long).includes('victim'))
})

test('co-ban listed project failing the dept regex becomes a letter', () => {
  const view = createPublicView(SALT)
  const bad = ['../x', 'p'.repeat(41)]
  const s = snap(bad.map((p, i) => mk({ id: 'i' + i, project: p })))
  const out = view(s, opts({ share: 'co-ban', projects: bad })).sessions
  for (const x of out) assert.match(x.dept, /^[A-P]$/)
})

test('createPublicView rejects a salt that is not 64 hex chars', () => {
  for (const bad of ['', 'zz', 'ab'.repeat(16), 'ab'.repeat(33), 'g'.repeat(64), undefined, null, 5])
    assert.throws(() => createPublicView(bad), /salt/, String(bad));
  assert.doesNotThrow(() => createPublicView('AB'.repeat(32)));
});

test('the 17th project shares the last room instead of wrapping to A', () => {
  const v = createPublicView(SALT)
  const sessions = Array.from({ length: 20 }, (_, i) => mk({ id: 'id-' + i, project: 'proj-' + i }))
  const out = v(snap(sessions), opts()).sessions
  const depts = out.map((s) => s.dept)
  assert.equal(depts[0], 'A'); assert.equal(depts[15], 'P')
  for (const d of depts.slice(16)) assert.equal(d, 'P')
  assert.equal(depts.filter((d) => d === 'A').length, 1)
})

test('duplicate session ids leave the machine once', () => {
  const s = snap([
    mk({ id: 'dup', status: 'idle', updatedAt: 1000 }),
    mk({ id: 'other', parentId: 'dup', status: 'working', updatedAt: 3000 }),
    mk({ id: 'dup', status: 'thinking', updatedAt: 2000 }),
  ])
  const out = createPublicView(SALT)(s, opts()).sessions
  assert.equal(out.length, 2)
  const child = out.find((x) => x.parent)
  const dups = out.filter((x) => !x.parent)
  assert.equal(dups.length, 1, 'one element per id')
  assert.equal(dups[0].status, 'thinking', 'the newer root is kept')
  assert.equal(child.parent, dups[0].id, 'a parent pointing at the dropped twin still resolves')
})
