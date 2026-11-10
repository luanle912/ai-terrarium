import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const wp = require('../lib/wallpaper.js');

test('on macOS `wallpaper` builds and installs the app; `wallpaper build` only builds', () => {
  const sh = path.join(wp.DIR, 'build.sh');
  assert.deepEqual(wp.plan([], 'darwin'), { cmd: 'bash', args: [sh, 'install'] });
  assert.deepEqual(wp.plan(['install'], 'darwin'), { cmd: 'bash', args: [sh, 'install'] });
  assert.deepEqual(wp.plan(['build'], 'darwin'), { cmd: 'bash', args: [sh] });
  assert.ok(fs.existsSync(sh), 'wallpaper/build.sh ships with the plugin');
  assert.ok(fs.existsSync(path.join(wp.DIR, 'Package.swift')));
});

test('elsewhere, or with an unknown option, nothing runs and the command fails', () => {
  for (const [argv, platform] of [[[], 'linux'], [[], 'win32'], [['build'], 'linux'], [['rm'], 'darwin']]) {
    const lines = [];
    let ran = false;
    const code = wp.run(argv, { platform, spawnSync: () => { ran = true; return { status: 0 } }, log: l => lines.push(l) });
    assert.equal(code, 1, `${argv} on ${platform}`);
    assert.equal(ran, false);
    assert.match(lines[0], /^wallpaper: /);
  }
});

test('the build script exit code is the command exit code', () => {
  const calls = [];
  const spawnSync = (cmd, args) => { calls.push([cmd, ...args]); return { status: 3 } };
  assert.equal(wp.run(['build'], { platform: 'darwin', spawnSync, log: () => {} }), 3);
  assert.equal(calls.length, 1);
  assert.equal(wp.run(['build'], { platform: 'darwin', spawnSync: () => ({ error: new Error('no bash') }), log: () => {} }), 1);
});
