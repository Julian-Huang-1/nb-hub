import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(
  new URL("../.agents/skills/nb-hub-sites/scripts/ensure-cli.sh", import.meta.url),
);

function fixture(t, { checksum = "valid", version = "0.1.0", os = "Linux", download = "gh" } = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "nbhub-install-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin");
  const assets = path.join(root, "assets");
  const payload = path.join(root, "payload");
  const destination = path.join(root, ".local/bin");
  for (const directory of [bin, assets, payload, destination])
    mkdirSync(directory, { recursive: true });
  const binary = path.join(destination, "nb-hub");
  const old = '#!/bin/sh\necho "nb-hub dev"\n';
  writeFileSync(binary, old, { mode: 0o755 });
  // Shadow any real CLI and network commands; no account or network access.
  writeFileSync(path.join(bin, "nb-hub"), old, { mode: 0o755 });
  writeFileSync(
    path.join(bin, "uname"),
    `#!/bin/sh\ncase "$1" in -s) echo '${os}';; -m) echo x86_64;; esac\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(bin, "gh"),
    `#!/bin/bash
set -eu
printf '%s\\n' "$*" >> "$TEST_DOWNLOADS"
[[ "$1 $2 $3" == 'release download v0.1.0' ]]
[[ "$*" != *'platform-token'* && "$*" != *'github-token'* ]]
[[ "$TEST_DOWNLOAD_MODE" == gh ]] || exit 1
while [[ $# -gt 0 ]]; do
  case "$1" in --pattern) asset=$2; shift 2;; --dir) directory=$2; shift 2;; *) shift;; esac
done
cp "$TEST_ASSETS/$asset" "$directory/$asset"
`,
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(bin, "curl"),
    `#!/bin/bash
set -eu
[[ "$TEST_DOWNLOAD_MODE" == public ]] || exit 22
while [[ $# -gt 0 ]]; do
  case "$1" in -o) destination=$2; shift 2;; https://*) asset=$(basename "$1"); shift;; *) shift;; esac
done
cp "$TEST_ASSETS/$asset" "$destination"
`,
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(payload, "nb-hub"),
    `#!/bin/sh\necho "nb-hub ${version} (commit test, built test)"\n`,
  );
  const asset = "nb-hub_0.1.0_linux_amd64.tar.gz";
  const archive = path.join(assets, asset);
  execFileSync("tar", ["-czf", archive, "-C", payload, "nb-hub"], {
    env: { ...process.env, LC_ALL: "C" },
  });
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  writeFileSync(
    path.join(assets, "SHA256SUMS"),
    checksum === "missing" ? "" : `${checksum === "valid" ? digest : "0".repeat(64)}  ${asset}\n`,
  );
  const log = path.join(root, "downloads");
  return {
    bin,
    binary,
    old,
    log,
    destination,
    run: () =>
      spawnSync("bash", [script], {
        encoding: "utf8",
        timeout: 10_000,
        env: {
          ...process.env,
          HOME: root,
          PATH: `${bin}:${process.env.PATH}`,
          TEST_ASSETS: assets,
          TEST_DOWNLOADS: log,
          TEST_DOWNLOAD_MODE: download,
          GH_TOKEN: "github-token",
          NB_HUB_TOKEN: "platform-token",
        },
      }),
  };
}

test("installs a verified pinned release and reuses it without downloading again", (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${f.binary}\n`);
  assert.match(execFileSync(f.binary, ["--version"], { encoding: "utf8" }), /^nb-hub 0.1.0/);
  assert.deepEqual(readdirSync(f.destination), ["nb-hub"]);
  const downloads = readFileSync(f.log, "utf8");
  assert.equal(downloads.split("\n").filter(Boolean).length, 2);
  assert.equal(f.run().status, 0);
  assert.equal(readFileSync(f.log, "utf8"), downloads);
});

for (const checksum of ["corrupt", "missing"]) {
  test(`${checksum} checksum preserves the existing CLI`, (t) => {
    const f = fixture(t, { checksum });
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /checksum|SHA256 mismatch/);
    assert.equal(result.stdout, "");
    assert.equal(readFileSync(f.binary, "utf8"), f.old);
    assert.deepEqual(readdirSync(f.destination), ["nb-hub"]);
  });
}

test("wrong version preserves the existing CLI", (t) => {
  const f = fixture(t, { version: "9.9.9" });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /version verification/);
  assert.equal(readFileSync(f.binary, "utf8"), f.old);
});

test("public release falls back to curl when gh cannot download", (t) => {
  const f = fixture(t, { download: "public" });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${f.binary}\n`);
});

test("failed download preserves the existing CLI and cleans staging files", (t) => {
  const f = fixture(t, { download: "fail" });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /private repositories require gh/);
  assert.equal(result.stdout, "");
  assert.equal(readFileSync(f.binary, "utf8"), f.old);
  assert.deepEqual(readdirSync(f.destination), ["nb-hub"]);
});

test("reuses the pinned CLI from PATH", (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.bin, "nb-hub"), '#!/bin/sh\necho "nb-hub v0.1.0"\n');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${f.bin}/nb-hub\n`);
  assert.equal(existsSync(f.log), false);
});

test("unsupported OS fails before downloading", (t) => {
  const f = fixture(t, { os: "Windows" });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Only macOS and Linux/);
  assert.equal(existsSync(f.log), false);
});
