import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  openSync,
  closeSync,
  copyFileSync,
  chmodSync,
} from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "..");
const script = path.join(root, "scripts/dev-env.mjs");
const envFile = path.resolve(root, process.env.ENV_FILE || ".env.development");
const key = createHash("sha256").update(envFile).digest("hex").slice(0, 16);
const directory = path.join(root, ".nb-hub/dev", key);
const stateFile = path.join(directory, "state.json");
const lockDirectory = path.join(directory, "lock");
process.umask(0o077);

function readJSON(filename) {
  try {
    return JSON.parse(readFileSync(filename, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function writeJSON(filename, value) {
  const temporary = `${filename}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n");
  renameSync(temporary, filename);
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" },
  });
  if (result.error) throw result.error;
  return result;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`${command} failed (${signal || code})`)),
    );
  });
}

function stamp(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 1) return null;
  const result = capture("ps", ["-p", String(pid), "-o", "lstart=", "-o", "command="]);
  return result.status === 0 ? result.stdout.trim() : null;
}

function owns(record) {
  return (
    record &&
    record.stamp &&
    record.stamp.includes(record.token) &&
    stamp(record.pid) === record.stamp
  );
}

function descendants(record) {
  const result = capture("ps", ["-axo", "pid=,ppid=,stat="]);
  if (result.status !== 0) throw new Error("Cannot inspect process ancestry");
  const processes = result.stdout
    .trim()
    .split("\n")
    .map((line) => {
      const [pid, parent, status] = line.trim().split(/\s+/);
      return { pid: Number(pid), parent: Number(parent), status };
    });
  const tree = new Set([record.pid]);
  let added;
  do {
    added = false;
    for (const child of processes) {
      if (tree.has(child.parent) && !tree.has(child.pid)) {
        tree.add(child.pid);
        added = true;
      }
    }
  } while (added);
  return processes.filter(
    (child) => child.pid !== record.pid && tree.has(child.pid) && !child.status.startsWith("Z"),
  );
}

function listeners(port) {
  const result = capture("lsof", ["-nP", "-a", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  if (result.status !== 0 && result.status !== 1)
    throw new Error(result.stderr || "Cannot inspect listening processes");
  return [...new Set(result.stdout.trim().split(/\s+/).filter(Boolean).map(Number))];
}

function serves(record) {
  if (!owns(record)) return false;
  const pids = listeners(record.port);
  const owned = new Set(descendants(record).map((child) => child.pid));
  return pids.length > 0 && pids.every((pid) => owned.has(pid));
}

async function healthy(record, component) {
  if (!serves(record)) return false;
  try {
    const response = await fetch(record.url + (component === "api" ? "/api/health" : "/"), {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    if (component === "api") {
      const health = await response.json();
      return health.status === "ok" && health.service === "nb-hub-api";
    }
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

async function stop(record) {
  if (!owns(record)) return false;
  // pnpm's executable shim can create new process groups. Capture ancestry and
  // start identities before signalling, so reparented children remain identifiable.
  const targets = descendants(record)
    .map(({ pid }) => ({ pid, stamp: stamp(pid) }))
    .filter((target) => target.stamp);
  const alive = (target) => stamp(target.pid) === target.stamp;
  const signal = (target, name) => {
    if (!alive(target)) return;
    try {
      process.kill(target.pid, name);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  for (const target of targets.toReversed()) signal(target, "SIGTERM");
  for (let attempt = 0; attempt < 80; attempt++) {
    if (!targets.some(alive)) {
      if (owns(record)) process.kill(record.pid, "SIGUSR2");
      else return true;
    }
    await delay(100);
  }
  for (const target of targets) signal(target, "SIGKILL");
  if (owns(record)) process.kill(record.pid, "SIGUSR2");
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!targets.some(alive) && !owns(record)) return true;
    await delay(100);
  }
  if (targets.some(alive) || owns(record))
    throw new Error("Managed process did not stop; lifecycle records were retained.");
  return true;
}

async function lock() {
  mkdirSync(directory, { recursive: true });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      mkdirSync(lockDirectory);
      writeJSON(path.join(lockDirectory, "owner.json"), {
        pid: process.pid,
        stamp: stamp(process.pid),
      });
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const owner = readJSON(path.join(lockDirectory, "owner.json"));
      if (owner && stamp(owner.pid) !== owner.stamp) {
        rmSync(lockDirectory, { recursive: true });
        continue;
      }
      await delay(100);
    }
  }
  throw new Error("Another lifecycle command is running; retry after it finishes.");
}

function compose(args) {
  return [
    "compose",
    "--env-file",
    envFile,
    "-p",
    "nb-hub-dev",
    "-f",
    path.join(root, "docker-compose.yml"),
    ...args,
  ];
}

function configuration() {
  if (process.env.APP_ENV !== "development") throw new Error("APP_ENV must be development");
  const db = new URL(process.env.DATABASE_URL || "");
  const databasePort = process.env.POSTGRES_PORT || "5432";
  if (
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(db.hostname) ||
    db.pathname !== "/nbhub_dev" ||
    (db.port || "5432") !== databasePort ||
    decodeURIComponent(db.username) !== (process.env.POSTGRES_USER || "nbhub_dev") ||
    decodeURIComponent(db.password) !== (process.env.POSTGRES_PASSWORD || "nbhub_dev") ||
    [...db.searchParams.keys()].some(
      (name) => !["sslmode", "pool_max_conns", "pool_min_conns", "connect_timeout"].includes(name),
    )
  ) {
    throw new Error(
      "DATABASE_URL must target this Compose's local nbhub_dev database and match POSTGRES_USER/PASSWORD/PORT.",
    );
  }
  const address = process.env.NB_HUB_LISTEN_ADDR || "127.0.0.1:8080";
  const api = new URL(`http://${address}`);
  if (!["127.0.0.1", "localhost", "0.0.0.0", "[::1]", "[::]"].includes(api.hostname)) {
    throw new Error("Managed development requires a local API listen address.");
  }
  if (["0.0.0.0", "[::]"].includes(api.hostname))
    api.hostname = api.hostname === "[::]" ? "[::1]" : "127.0.0.1";
  const frontendPort = Number(process.env.FRONTEND_PORT || "3000");
  if (!Number.isInteger(frontendPort) || frontendPort < 1 || frontendPort > 65535)
    throw new Error("Invalid FRONTEND_PORT");
  const apiPort = Number(api.port || "80");
  if (
    apiPort === frontendPort ||
    apiPort === Number(databasePort) ||
    frontendPort === Number(databasePort)
  ) {
    throw new Error("API, Web and PostgreSQL must use different ports.");
  }
  const publicAPI = new URL(process.env.NB_HUB_API_URL || api.origin);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(publicAPI.hostname) ||
    publicAPI.protocol !== "http:" ||
    Number(publicAPI.port || "80") !== apiPort ||
    publicAPI.pathname !== "/"
  ) {
    throw new Error("NB_HUB_API_URL must point at this local API's HTTP port.");
  }
  const components = (process.env.C || "api,web").split(",");
  if (components.some((name) => !["api", "web"].includes(name)))
    throw new Error("C supports api,web or api");
  return {
    hash: createHash("sha256").update(readFileSync(envFile)).digest("hex"),
    components: components.includes("web") ? ["api", "web"] : ["api"],
    api: { port: apiPort, url: api.origin },
    web: { port: frontendPort, url: `http://127.0.0.1:${frontendPort}` },
  };
}

async function start(state, component, desired, command) {
  const token = randomUUID();
  const log = path.join(directory, `${component}.log`);
  const exitFile = path.join(directory, `${token}.exit.json`);
  const output = openSync(log, "w");
  const supervisor = spawn(
    process.execPath,
    [script, "_run", token, exitFile, JSON.stringify(command)],
    {
      cwd: root,
      detached: true,
      stdio: ["ignore", output, output],
      env: { ...process.env, PORT: String(desired.port) },
    },
  );
  closeSync(output);
  await new Promise((resolve, reject) => {
    supervisor.once("spawn", resolve);
    supervisor.once("error", reject);
  });
  supervisor.unref();
  const record = {
    ...desired,
    pid: supervisor.pid,
    token,
    stamp: stamp(supervisor.pid),
    log,
    exitFile,
  };
  if (!owns(record)) throw new Error(`Could not identify ${component} supervisor`);
  state.components[component] = record;
  writeJSON(stateFile, state);
  console.log(`Starting ${component}: ${desired.url} (log: ${log})`);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await healthy(record, component)) return;
    if (!owns(record) || existsSync(exitFile)) break;
    await delay(500);
  }
  throw new Error(`${component} did not become ready; inspect ${log}`);
}

async function up() {
  const desired = configuration();
  process.env.NB_HUB_API_URL = desired.api.url;
  await lock();
  let state;
  const started = [];
  try {
    state = readJSON(stateFile) || { root, envFile, components: {} };
    if (state.hash && state.hash !== desired.hash && Object.values(state.components).some(owns)) {
      throw new Error(
        "Configuration changed while managed services are running. Run make down, then make up.",
      );
    }
    for (const component of desired.components) {
      const record = state.components[component];
      if (await healthy(record, component)) continue;
      const other = listeners(desired[component].port).filter((pid) => {
        if (!owns(record)) return true;
        return !descendants(record).some((child) => child.pid === pid);
      });
      if (other.length)
        throw new Error(
          `Port ${desired[component].port} is occupied by an unmanaged process (PID ${other.join(", ")}). It was not stopped.`,
        );
    }
    state.hash = desired.hash;
    console.log("Preparing PostgreSQL and applying migrations...");
    await run("docker", compose(["up", "-d", "--wait", "postgres"]));
    const postgres = capture("docker", compose(["ps", "-q", "postgres"]));
    if (postgres.status !== 0 || !postgres.stdout.trim())
      throw new Error("Cannot identify the development PostgreSQL container");
    state.database = { id: postgres.stdout.trim() };
    writeJSON(stateFile, state);
    await run("go", ["run", "./cmd/migrate"], { cwd: path.join(root, "server") });
    const missing = [];
    for (const component of desired.components) {
      if (!(await healthy(state.components[component], component))) missing.push(component);
    }
    if (missing.includes("web") && !existsSync(path.join(root, "node_modules")))
      await run("pnpm", ["install", "--frozen-lockfile"]);
    const binary = path.join(directory, "api");
    if (missing.includes("api"))
      await run("go", ["build", "-o", binary, "./cmd/server"], { cwd: path.join(root, "server") });
    for (const component of missing) {
      const previous = state.components[component];
      await stop(previous);
      if (previous) rmSync(previous.exitFile, { force: true });
      started.push(component);
      const command =
        component === "api"
          ? [binary]
          : ["pnpm", "dev:web", "--hostname", "127.0.0.1", "--port", String(desired.web.port)];
      await start(state, component, desired[component], command);
    }
    console.log("Development environment is ready.");
    await status();
  } catch (error) {
    for (const component of started.reverse()) {
      const record = state.components[component];
      await stop(record);
      if (record) rmSync(record.exitFile, { force: true });
      delete state.components[component];
    }
    if (state) writeJSON(stateFile, state);
    throw error;
  } finally {
    rmSync(lockDirectory, { recursive: true, force: true });
  }
}

async function down() {
  await lock();
  try {
    const state = readJSON(stateFile);
    if (!state) {
      console.log("No managed development services. Existing manual services were not touched.");
      return;
    }
    for (const component of Object.keys(state.components).reverse()) {
      const record = state.components[component];
      const stopped = await stop(record);
      console.log(`${component}: ${stopped ? "stopped" : "not owned/running; no signal sent"}`);
      rmSync(record.exitFile, { force: true });
      delete state.components[component];
      writeJSON(stateFile, state);
    }
    console.log(
      "Application services stopped. PostgreSQL and its data are preserved (make db-down stops PostgreSQL).",
    );
  } finally {
    rmSync(lockDirectory, { recursive: true, force: true });
  }
}

async function status() {
  const state = readJSON(stateFile);
  if (!state) {
    console.log("No managed environment. Run make up; manually started services are not adopted.");
    return;
  }
  console.log(`Environment: ${state.envFile}`);
  if (state.database) {
    const result = capture("docker", [
      "inspect",
      "--format",
      "{{.State.Status}} / {{if .State.Health}}{{.State.Health.Status}}{{end}}",
      state.database.id,
    ]);
    console.log(`postgres: ${result.status === 0 ? result.stdout.trim() : "unavailable"}`);
  }
  for (const component of ["api", "web"]) {
    const record = state.components[component];
    if (!record) {
      console.log(`${component}: stopped / not managed`);
      continue;
    }
    const stateName = (await healthy(record, component))
      ? "running"
      : owns(record)
        ? "unhealthy"
        : "stale / not owned";
    console.log(`${component}: ${stateName}  ${record.url}  supervisor PID ${record.pid}`);
    console.log(`  log: ${record.log}`);
  }
}

function supervise() {
  const [, , , token, exitFile, serialized] = process.argv;
  if (!token) throw new Error("Missing supervisor identity");
  const [command, ...args] = JSON.parse(serialized);
  // Keep the ownership anchor alive after a child exits, including failed starts.
  setInterval(() => {}, 60_000);
  const child = spawn(command, args, { cwd: root, stdio: "inherit" });
  child.once("error", (error) => {
    console.error(error.message);
    writeJSON(exitFile, { error: error.message });
  });
  child.once("exit", (code, signal) => writeJSON(exitFile, { code, signal }));
  // down closes this supervisor only after its captured descendants have stopped.
  process.on("SIGTERM", () => {});
  process.on("SIGINT", () => {});
  process.on("SIGUSR2", () => process.exit(0));
}

const action = process.argv[2];
try {
  if (action === "_run") supervise();
  else if (action === "up") {
    if (!existsSync(envFile)) {
      copyFileSync(path.join(root, ".env.development.example"), envFile, constants.COPYFILE_EXCL);
      chmodSync(envFile, 0o600);
      console.log(`Created ${envFile}`);
    }
    await run("bash", [path.join(root, "scripts/dev.sh"), process.execPath, script, "_up"], {
      env: { ...process.env, ENV_FILE: envFile },
    });
  } else if (action === "_up") await up();
  else if (action === "down") await down();
  else if (action === "status") await status();
  else throw new Error("Usage: node scripts/dev-env.mjs up|down|status");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
