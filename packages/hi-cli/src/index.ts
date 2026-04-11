import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const subcommand = args[0];

// ─── hi init <shell> ──────────────────────────────────────────────────────────
// Prints the shell function definition to stdout.
// Users add `eval "$(hi init zsh)"` to their rc file.
if (subcommand === "init") {
  const targetShell = args[1] ?? detectShell();
  process.stdout.write(shellInit(targetShell));
  process.exit(0);
}

// ─── hi setup ─────────────────────────────────────────────────────────────────
// One-shot interactive setup: detects shell, appends init line to rc file.
if (subcommand === "setup") {
  setup();
  process.exit(0);
}

// ─── hi <query> ───────────────────────────────────────────────────────────────
// Default: call api-server, print the generated command to stdout.
const query = args.join(" ").trim();

if (!query) {
  process.stderr.write(
    [
      "Usage:",
      "  hi <query>          generate a shell command",
      "  hi setup            one-time shell integration setup",
      "  hi init <zsh|bash>  print shell function (for eval)",
    ].join("\n") + "\n",
  );
  process.exit(1);
}

const server = process.env.HI_SERVER ?? "http://localhost:9999";
const shell = detectShell();
const cwd = process.cwd();

async function main() {
  let res: Response;
  try {
    res = await fetch(`${server}/hi/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, shell, cwd }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`hi: cannot reach api-server at ${server} — ${msg}\n`);
    process.stderr.write(
      `hi: make sure api-server is running (pnpm --filter @nb-hub/api-server run dev)\n`,
    );
    process.exit(1);
  }

  const json = (await res.json()) as { status: string; command?: string; message?: string };

  if (!res.ok || json.status !== "ok" || !json.command) {
    process.stderr.write(`hi: ${json.message ?? "unknown error"}\n`);
    process.exit(1);
  }

  process.stdout.write(json.command + "\n");
}

main().catch((err) => {
  process.stderr.write(`hi: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function detectShell(): string {
  return path.basename(process.env.SHELL ?? "zsh");
}

function shellInit(sh: string): string {
  if (sh === "bash") return bashInit();
  return zshInit(); // default to zsh
}

function zshInit(): string {
  return `
# hi — natural language to shell command (added by \`hi setup\`)
hi() {
  if [[ $# -eq 0 ]]; then
    command hi
    return
  fi
  local cmd
  cmd=$(command hi "$@" 2>/tmp/hi-err)
  local code=$?
  if [[ $code -ne 0 ]]; then
    cat /tmp/hi-err >&2
    return $code
  fi
  [[ -n "$cmd" ]] && print -z "$cmd"
}
`.trimStart();
}

function bashInit(): string {
  return `
# hi — natural language to shell command (added by \`hi setup\`)
hi() {
  if [[ $# -eq 0 ]]; then
    command hi
    return
  fi
  local cmd
  cmd=$(command hi "$@" 2>/tmp/hi-err)
  local code=$?
  if [[ $code -ne 0 ]]; then
    cat /tmp/hi-err >&2
    return $code
  fi
  if [[ -n "$cmd" ]]; then
    printf "\\n  \\033[1;32m%s\\033[0m\\n\\n" "$cmd"
    if command -v pbcopy &>/dev/null; then
      printf '%s' "$cmd" | pbcopy && echo "  ✓ Copied to clipboard — ⌘V to paste"
    elif command -v xclip &>/dev/null; then
      printf '%s' "$cmd" | xclip -selection clipboard && echo "  ✓ Copied — Ctrl+Shift+V to paste"
    fi
    history -s "$cmd"
  fi
}
`.trimStart();
}

function setup(): void {
  const sh = detectShell();
  const rcFile = sh === "bash" ? path.join(os.homedir(), ".bashrc") : path.join(os.homedir(), ".zshrc");
  const initLine = `eval "$(hi init ${sh})"`;

  // Check if already installed
  try {
    const existing = fs.readFileSync(rcFile, "utf8");
    if (existing.includes("hi init")) {
      console.log(`✓ hi is already set up in ${rcFile}`);
      console.log(`  Restart your shell or run: source ${rcFile}`);
      return;
    }
  } catch {
    // rc file doesn't exist yet, will be created
  }

  fs.appendFileSync(rcFile, `\n${initLine}\n`);

  console.log(`✓ Added to ${rcFile}:`);
  console.log(`    ${initLine}`);
  console.log("");
  console.log(`  Restart your shell or run:`);
  console.log(`    source ${rcFile}`);
}
