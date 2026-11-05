'use strict';
// Strict check of a publish packet (spec 10.2). The value that comes back is BUILT from allowed fields only.
// Unknown keys anywhere reject the whole packet. The hub never takes island or user ids from the body.
//   {v:1, seq, share?:'kin'|'co-ban', private?, sessions:[{id,parent?,status,waitingOn?,talkingTo?,dept,kind,tool?,model?}]}
// `share` is optional (default 'kin'); tool/model are only allowed with share 'co-ban'.

const STATUSES = ['working', 'thinking', 'talking', 'permission', 'waiting', 'idle', 'error', 'done'];
const KINDS = ['shell', 'edit', 'read', 'web', 'agent', 'mcp', 'other', 'none'];
const MAX_SESSIONS = 32;
const ID_RE = /^[0-9a-f]{12}$/;
const DEPT_KIN_RE = /^[A-P]$/;
const DEPT_NAME_RE = /^[\p{L}\p{N} ._-]{1,40}$/u;
const TOOL_RE = /^[A-Za-z0-9_.-]{1,32}$/;
const MODEL_RE = /^claude-[a-z0-9.-]{1,40}$/;
const TOP_KEYS = new Set(['v', 'seq', 'share', 'private', 'sessions']);
const SESSION_KEYS = new Set(['id', 'parent', 'status', 'waitingOn', 'talkingTo', 'dept', 'kind', 'tool', 'model']);

const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const fail = (error) => ({ ok: false, error });

function validatePublish(body) {
  if (!isObj(body)) return fail('body must be an object');
  for (const k of Object.keys(body)) if (!TOP_KEYS.has(k)) return fail('unknown key: ' + k.slice(0, 20));
  if (body.v !== 1) return fail('v must be 1');
  if (!Number.isSafeInteger(body.seq) || body.seq < 0) return fail('seq must be an integer >= 0');
  const share = body.share === undefined ? 'kin' : body.share;
  if (share !== 'kin' && share !== 'co-ban') return fail('bad share');
  if (body.private !== undefined && typeof body.private !== 'boolean') return fail('private must be boolean');
  if (!Array.isArray(body.sessions)) return fail('sessions must be an array');
  if (body.sessions.length > MAX_SESSIONS) return fail('too many sessions');
  const priv = body.private === true;
  const coBan = share === 'co-ban';
  const ids = new Set();
  const raw = [];
  for (const s of body.sessions) {
    if (!isObj(s)) return fail('session must be an object');
    for (const k of Object.keys(s)) {
      if (!SESSION_KEYS.has(k)) return fail('unknown session key: ' + k.slice(0, 20));
      if ((k === 'tool' || k === 'model') && !coBan) return fail(k + ' needs share co-ban');
    }
    if (typeof s.id !== 'string' || !ID_RE.test(s.id)) return fail('bad id');
    if (ids.has(s.id)) return fail('duplicate id');
    ids.add(s.id);
    if (!STATUSES.includes(s.status)) return fail('bad status');
    if (!KINDS.includes(s.kind)) return fail('bad kind');
    if (typeof s.dept !== 'string' || !(coBan ? DEPT_NAME_RE : DEPT_KIN_RE).test(s.dept)) return fail('bad dept');
    for (const k of ['parent', 'waitingOn', 'talkingTo']) {
      const v = s[k];
      if (v !== undefined && v !== null && (typeof v !== 'string' || !ID_RE.test(v))) return fail('bad ' + k);
    }
    if (s.tool !== undefined && (typeof s.tool !== 'string' || !TOOL_RE.test(s.tool))) return fail('bad tool');
    if (s.model !== undefined && (typeof s.model !== 'string' || !MODEL_RE.test(s.model))) return fail('bad model');
    raw.push(s);
  }
  // Private: the packet carries no sessions, whatever it says.
  const sessions = priv ? [] : raw.map((s) => {
    const ref = (v) => (typeof v === 'string' && v !== s.id && ids.has(v) ? v : null);
    const out = { id: s.id, parent: ref(s.parent), status: s.status, waitingOn: ref(s.waitingOn), talkingTo: ref(s.talkingTo), dept: s.dept, kind: s.kind };
    if (s.tool !== undefined) out.tool = s.tool;
    if (s.model !== undefined) out.model = s.model;
    return out;
  });
  return { ok: true, value: { v: 1, seq: body.seq, share, private: priv, sessions } };
}

// Island name typed by a user: NFC, collapsed whitespace, trimmed; 1-24 letters, marks, digits, space . _ -
const ISLAND_NAME_RE = /^[\p{L}\p{M}\p{N} ._-]{1,24}$/u;
function validIslandName(s) {
  if (typeof s !== 'string') return null;
  const t = s.normalize('NFC').replace(/\s+/g, ' ').trim();
  return ISLAND_NAME_RE.test(t) ? t : null;
}

module.exports = { validatePublish, validIslandName, MAX_SESSIONS };
