import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const script = fileURLToPath(new URL('./deploy-production.sh', import.meta.url));
const sha = 'a'.repeat(40);
const releaseID = `${sha}-100-1`;

function fixture(t, { sites = false, failure = '', external = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'nbhub-cd-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  const payload = path.join(root, 'payload');
  const incoming = path.join(root, 'incoming', releaseID);
  mkdirSync(bin);
  mkdirSync(payload);
  mkdirSync(incoming, { recursive: true });
  writeFileSync(path.join(payload, 'images.tar.gz'), gzipSync('test image archive'));
  writeFileSync(path.join(payload, 'docker-compose.production.yml'), 'name: nb-hub-prod\n');
  writeFileSync(path.join(payload, 'docker-compose.sites.yml'), 'services: {}\n');
  writeFileSync(path.join(payload, 'docker-compose.external-proxy.yml'), 'services: {}\n');
  mkdirSync(path.join(payload, 'deploy'));
  execFileSync('tar', ['-cf', path.join(incoming, 'release.tar'), '-C', payload, '.'], { env: { ...process.env, LC_ALL: 'C' } });
  writeFileSync(path.join(root, '.env.production'), `DOMAIN=hub.example.com\nPOSTGRES_PASSWORD=private-db-secret\nJWT_SECRET=private-jwt-secret\nDEPLOY_PLATFORM=linux/amd64\nNB_HUB_PROXY_MODE=${external ? 'external' : 'bundled'}\nNB_HUB_CONTENT_DOMAIN=${sites ? 'content.example.net' : ''}\n`);
  if (sites) {
    const tls = path.join(root, 'deploy/content-tls');
    mkdirSync(tls, { recursive: true });
    writeFileSync(path.join(tls, 'fullchain.pem'), 'certificate');
    writeFileSync(path.join(tls, 'privkey.pem'), 'private key');
  }
  const log = path.join(root, 'docker.log');
  writeFileSync(path.join(bin, 'docker'), `#!/bin/bash
set -e
printf '%s\\n' "$*" >> "$TEST_LOG"
if [[ "$1" == load ]]; then cat > /dev/null; fi
if [[ "$*" == *'run --rm --no-deps migrate'* && "$FAIL_STAGE" == migration ]]; then exit 20; fi
if [[ "$*" == *'up -d --no-build --no-deps --wait'* && "$FAIL_STAGE" == application ]]; then exit 21; fi
`, { mode: 0o700 });
  writeFileSync(path.join(bin, 'curl'), '#!/bin/bash\nprintf "https-probe\\n" >> "$TEST_LOG"\nif [[ "$FAIL_STAGE" == https ]]; then exit 22; fi\n', { mode: 0o700 });
  writeFileSync(path.join(bin, 'sleep'), '#!/bin/bash\nexit 0\n', { mode: 0o700 });
  // The host-level lock is exercised by flock on Linux in production; this stub
  // allows the orchestration tests to run on macOS as well.
  writeFileSync(path.join(bin, 'flock'), '#!/bin/bash\nexit 0\n', { mode: 0o700 });
  return {
    root,
    release: path.join(root, 'releases', releaseID),
    run: () => spawnSync('bash', [script, root, releaseID, sha, 'linux/amd64'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TEST_LOG: log, FAIL_STAGE: failure },
    }),
    calls: () => readFileSync(log, 'utf8'),
  };
}

test('migration failure preserves the running applications and release pointer', (t) => {
  const f = fixture(t, { failure: 'migration' });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(f.calls(), /run --rm --no-deps migrate/);
  assert.doesNotMatch(f.calls(), /up -d --no-build/);
  assert.equal(existsSync(path.join(f.root, 'current')), false);
  assert.doesNotMatch(result.stdout + result.stderr, /private-db-secret|private-jwt-secret/);
});

test('successful release uses immutable images, probes HTTPS, and removes archives', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readlinkSync(path.join(f.root, 'current')), f.release);
  assert.match(readFileSync(path.join(f.release, 'images.env'), 'utf8'), new RegExp(`API_IMAGE=nb-hub-api:${sha}`));
  const calls = f.calls();
  assert.ok(calls.indexOf('run --rm --no-deps migrate') < calls.indexOf('up -d --no-build --no-deps --wait'));
  assert.equal((calls.match(/https-probe/g) || []).length, 2);
  assert.equal(existsSync(path.join(f.release, 'images.tar.gz')), false);
  assert.equal(existsSync(path.join(f.root, 'incoming', releaseID)), false);
});

test('application startup failure does not mark the release successful', (t) => {
  const f = fixture(t, { failure: 'application' });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(path.join(f.root, 'current')), false);
  assert.doesNotMatch(f.calls(), /force-recreate proxy|https-probe/);
});

test('content-host deployment keeps TLS files on the server', (t) => {
  const f = fixture(t, { sites: true });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readlinkSync(path.join(f.release, 'deploy/content-tls')), path.join(f.root, 'deploy/content-tls'));
  assert.match(f.calls(), /docker-compose.sites.yml/);
});

test('invalid release arguments fail before Docker is invoked', () => {
  const result = spawnSync('bash', [script, '/', releaseID, sha, 'linux/amd64']);
  assert.notEqual(result.status, 0);
});

test('failed HTTPS probes do not mark the release successful', (t) => {
  const f = fixture(t, { failure: 'https' });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(path.join(f.root, 'current')), false);
  assert.match(result.stderr, /Post-deployment HTTP checks failed/);
});

test('external proxy mode binds only app ports and preserves the host proxy', (t) => {
  const f = fixture(t, { external: true });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(f.calls(), /docker-compose.external-proxy.yml/);
  assert.doesNotMatch(f.calls(), /force-recreate proxy/);
});
