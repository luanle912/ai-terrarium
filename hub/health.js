'use strict';
// Health and metrics for uptime monitors and Prometheus.
//   GET /healthz   {ok, uptimeS, db, streams, version}; 503 {ok: false, db: 'error'} when the database does not answer.
//                  Public, no-store, under the general rate limit. HEAD works too (the router reuses the GET route).
//   GET /metrics   Prometheus text 0.0.4, only with HUB_METRICS_TOKEN: 404 when unset, 401 unless `Bearer <token>`.
//                  Counters and gauges only: never a token, email, name or id.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version || 'dev'; } catch { return 'dev'; }
})();
const NO_STORE = { 'Cache-Control': 'no-store' };

function sameToken(header, token) {
  const m = /^Bearer (\S{1,300})$/.exec(String(header || ''));
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1]).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  return crypto.timingSafeEqual(a, b); // equal-length digests, so the length of the token is not leaked
}

function routes(ctx) {
  const { config, db, deps, world, helpers } = ctx;
  const startedAt = deps.now();
  const uptime = () => Math.max(0, Math.floor((deps.now() - startedAt) / 1000));
  const streamCount = () => (ctx.streams ? ctx.streams.count() : 0);
  const list = [];

  list.push({
    method: 'GET', path: '/healthz',
    handler(req, res) {
      let dbOk = true;
      try { db.islandCount(); } catch { dbOk = false; }
      if (!dbOk) return helpers.sendJson(res, 503, { ok: false, db: 'error' });
      helpers.sendJson(res, 200, { ok: true, uptimeS: uptime(), db: 'ok', streams: streamCount(), version: VERSION });
    },
  });

  list.push({
    method: 'GET', path: '/metrics',
    handler(req, res) {
      if (!config.metricsToken) throw new helpers.HttpError(404, 'not found');
      if (!sameToken(req.headers.authorization, config.metricsToken)) {
        throw new helpers.HttpError(401, 'unauthorized', { 'WWW-Authenticate': 'Bearer' });
      }
      const st = ctx.stats;
      const lines = [];
      const metric = (name, type, help, samples) => {
        lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
        for (const [labels, v] of samples) lines.push(`${name}${labels} ${v}`);
      };
      const one = (v) => [['', v]];
      const labelled = (key, obj) => Object.entries(obj).map(([k, v]) => [`{${key}="${k}"}`, v]);
      let slotted = 0;
      let onlineIslands = 0;
      try { slotted = db.listSlottedIslands().length; } catch { /* /healthz reports a broken database */ }
      try { onlineIslands = world.islands().filter((i) => i.online).length; } catch { /* ignore */ }
      metric('terrarium_uptime_seconds', 'gauge', 'Seconds since the hub started.', one(uptime()));
      metric('terrarium_streams', 'gauge', 'Open world streams.', one(streamCount()));
      metric('terrarium_islands_slotted', 'gauge', 'Islands that hold a slot.', one(slotted));
      metric('terrarium_islands_online', 'gauge', 'Islands with a machine heard from lately.', one(onlineIslands));
      metric('terrarium_publish_total', 'counter', 'Publish requests by result.', labelled('result', st.publish));
      metric('terrarium_stream_refused_total', 'counter', 'World streams refused by a cap.', labelled('reason', st.streamRefused));
      metric('terrarium_http_429_total', 'counter', 'Responses with status 429.', one(st.http429));
      metric('terrarium_world_broadcasts_total', 'counter', 'World broadcasts sent to all viewers.', one(st.worldBroadcasts));
      metric('terrarium_frames_written_total', 'counter', 'Stream frames written to viewers.', one(st.framesWritten));
      helpers.send(res, 200, lines.join('\n') + '\n', { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', ...NO_STORE });
    },
  });

  return list;
}

module.exports = { routes };
