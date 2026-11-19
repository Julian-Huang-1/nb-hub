import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import http from "node:http";

const source = import.meta.dirname;

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const fakeServer = `
const http = require('node:http');
const api = process.env.FAKE_COMPONENT === 'api';
const port = api ? Number(process.env.NB_HUB_LISTEN_ADDR.split(':').pop()) : Number(process.env.PORT);
if (!api && process.env.FAKE_WEB_FAILURE === '1') process.exit(2);
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(api ? {status:'ok', service:'nb-hub-api'} : {web:true}));
});
server.listen(port, '127.0.0.1');
`;

async function fixture(t, extra = "") {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nb-hub-lifecycle-"));
  await mkdir(path.join(directory, "scripts"));
  await mkdir(path.join(directory, "server"));
  await mkdir(path.join(directory, "bin"));
  for (const name of ["dev.sh", "dev-env.mjs"])
    await copyFile(path.join(source, name), path.join(directory, "scripts", name));
  const apiPort = await freePort();
  const webPort = await freePort();
  const configuration = `APP_ENV=development\nPOSTGRES_PORT=5432\nDATABASE_URL=postgres://nbhub_dev:nbhub_dev@127.0.0.1:5432/nbhub_dev?sslmode=disable\nNB_HUB_LISTEN_ADDR=127.0.0.1:${apiPort}\nFRONTEND_PORT=${webPort}\nNEXT_PUBLIC_API_URL=http://127.0.0.1:${apiPort}\n${extra}`;
  await writeFile(path.join(directory, ".env.development.example"), configuration);
  await writeFile(path.join(directory, "fake-server.cjs"), fakeServer);
  const header = `#!${process.execPath}\nconst fs = require('node:fs'); const path = require('node:path'); const root = ${JSON.stringify(directory)}; const args = process.argv.slice(2);\n`;
  await writeFile(
    path.join(directory, "bin/docker"),
    header +
      `
fs.appendFileSync(path.join(root, 'docker.log'), args.join(' ') + '\\n');
if (args.includes('ps')) console.log('fixture-postgres');
if (args.includes('inspect')) console.log('running / healthy');
`,
    { mode: 0o755 },
  );
  await writeFile(
    path.join(directory, "bin/go"),
    header +
      `
if (args[0] === 'build') {
  fs.writeFileSync(args[args.indexOf('-o') + 1], '#!${process.execPath}\\nprocess.env.FAKE_COMPONENT="api";\\n' + fs.readFileSync(path.join(root, 'fake-server.cjs')), {mode:0o755});
} else {
  fs.appendFileSync(path.join(root, 'migrate.log'), 'migrate\\n');
  if (process.env.FAKE_MIGRATE_FAILURE === '1') process.exit(2);
}
`,
    { mode: 0o755 },
  );
  await writeFile(
    path.join(directory, "bin/pnpm"),
    header +
      `
if (args[0] === 'install') fs.mkdirSync(path.join(root, 'node_modules'), {recursive:true});
else {
  const child = require('node:child_process').spawn(process.execPath, [path.join(root, 'fake-server.cjs')], {stdio:'inherit', detached:true});
  child.on('exit', (code) => process.exit(code || 0));
}
`,
    { mode: 0o755 },
  );
  const environment = {
    ...process.env,
    PATH: `${path.join(directory, "bin")}:${process.env.PATH}`,
    ENV_FILE: path.join(directory, ".env.development"),
    C: "",
  };
  const command = async (action, overrides = {}) => {
    const child = spawn(process.execPath, [path.join(directory, "scripts/dev-env.mjs"), action], {
      cwd: directory,
      env: { ...environment, ...overrides },
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`Timed out: ${output}`));
      }, 30_000);
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        resolve({ code, output });
      });
    });
  };
  const state = async () => {
    const [key] = await readdir(path.join(directory, ".nb-hub/dev"));
    return JSON.parse(
      await readFile(path.join(directory, ".nb-hub/dev", key, "state.json"), "utf8"),
    );
  };
  t.after(async () => {
    await command("down");
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, apiPort, webPort, configuration, command, state };
}

test(
  "up is idempotent; status and down use saved ownership after config edits",
  { timeout: 45_000 },
  async (t) => {
    const env = await fixture(t);
    const started = await env.command("up");
    assert.equal(started.code, 0, started.output);
    const first = await env.state();
    assert.equal((await fetch(`http://127.0.0.1:${env.apiPort}/api/health`)).status, 200);
    assert.equal((await env.command("up")).code, 0);
    const second = await env.state();
    assert.equal(second.components.api.pid, first.components.api.pid);
    assert.equal(second.components.web.pid, first.components.web.pid);
    await writeFile(
      path.join(env.directory, ".env.development"),
      env.configuration.replace(`FRONTEND_PORT=${env.webPort}`, "FRONTEND_PORT=1"),
    );
    const blocked = await env.command("up");
    assert.equal(blocked.code, 1);
    assert.match(blocked.output, /Configuration changed/);
    const status = await env.command("status");
    assert.match(status.output, /api: running/);
    assert.match(status.output, /web: running/);
    const stopped = await env.command("down");
    assert.equal(stopped.code, 0, stopped.output);
    await assert.rejects(fetch(`http://127.0.0.1:${env.apiPort}`));
    await assert.rejects(fetch(`http://127.0.0.1:${env.webPort}`));
    assert.doesNotMatch(await readFile(path.join(env.directory, "docker.log"), "utf8"), /\bdown\b/);
  },
);

test(
  "up refuses an unmanaged listener and down leaves it alive",
  { timeout: 45_000 },
  async (t) => {
    const env = await fixture(t);
    const other = http.createServer((request, response) => response.end("unmanaged"));
    await new Promise((resolve) => other.listen(env.webPort, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => other.close(resolve)));
    const result = await env.command("up");
    assert.equal(result.code, 1);
    assert.match(result.output, /occupied by an unmanaged process/);
    await env.command("down");
    assert.equal(await (await fetch(`http://127.0.0.1:${env.webPort}`)).text(), "unmanaged");
  },
);

test("failed Web startup rolls back the newly started API", { timeout: 45_000 }, async (t) => {
  const env = await fixture(t, "FAKE_WEB_FAILURE=1\n");
  const result = await env.command("up");
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /web did not become ready/);
  assert.deepEqual((await env.state()).components, {});
  await assert.rejects(fetch(`http://127.0.0.1:${env.apiPort}`));
});

test(
  "down does not signal a PID whose recorded identity does not match",
  { timeout: 45_000 },
  async (t) => {
    const env = await fixture(t);
    const started = await env.command("up");
    assert.equal(started.code, 0, started.output);
    const state = await env.state();
    const original = structuredClone(state);
    const [key] = await readdir(path.join(env.directory, ".nb-hub/dev"));
    const file = path.join(env.directory, ".nb-hub/dev", key, "state.json");
    try {
      state.components.api.pid = process.pid;
      await writeFile(file, JSON.stringify(state));
      const result = await env.command("down");
      assert.equal(result.code, 0, result.output);
      assert.match(result.output, /not owned\/running; no signal sent/);
      assert.equal((await fetch(`http://127.0.0.1:${env.apiPort}/api/health`)).status, 200);
    } finally {
      await writeFile(file, JSON.stringify(original));
    }
  },
);

test("failed migration never starts application processes", { timeout: 45_000 }, async (t) => {
  const env = await fixture(t, "FAKE_MIGRATE_FAILURE=1\n");
  const result = await env.command("up");
  assert.equal(result.code, 1, result.output);
  assert.deepEqual((await env.state()).components, {});
});

test(
  "a failed additional Web startup preserves the already healthy API",
  { timeout: 45_000 },
  async (t) => {
    const env = await fixture(t, "FAKE_WEB_FAILURE=1\n");
    const first = await env.command("up", { C: "api" });
    assert.equal(first.code, 0, first.output);
    const api = (await env.state()).components.api;
    const additional = await env.command("up");
    assert.equal(additional.code, 1, additional.output);
    assert.equal((await env.state()).components.api.pid, api.pid);
    assert.equal((await fetch(`http://127.0.0.1:${env.apiPort}/api/health`)).status, 200);
  },
);
