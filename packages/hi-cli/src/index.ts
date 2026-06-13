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
// One-shot setup: detects shell, appends init line to rc file.
if (subcommand === "setup") {
  setup();
  process.exit(0);
}

// ─── hi login <token> ─────────────────────────────────────────────────────────
// Persists XHS_ACCESS_TOKEN into the rc file (overwrites any previous value).
if (subcommand === "login") {
  const token = args[1];
  if (!token) {
    process.stderr.write("Usage: hi login <token>\n");
    process.exit(1);
  }
  login(token);
  process.exit(0);
}

// ─── hi logout ────────────────────────────────────────────────────────────────
// Removes the managed token block from the rc file.
if (subcommand === "logout") {
  logout();
  process.exit(0);
}

// ─── hi <query> ───────────────────────────────────────────────────────────────
// Default: call the gateway, print the generated command to stdout.
const query = args.join(" ").trim();

if (!query) {
  process.stderr.write(
    [
      "Usage:",
      "  hi <query>          generate a shell command",
      "  hi setup            one-time shell integration setup",
      "  hi login <token>    save XHS_ACCESS_TOKEN to your rc file",
      "  hi logout           remove the saved token from your rc file",
      "  hi init <zsh|bash>  print shell function (for eval)",
    ].join("\n") + "\n",
  );
  process.exit(1);
}

// NOTE: the trailing `/v1` matters — the gateway routes `/v1/messages`
// (matching Anthropic's public API). Hitting `/messages` directly falls into
// a default handler that returns 500 {"error":"unknown error"}.
const DEFAULT_GATEWAY = "http://codewiz.devops.xiaohongshu.com/llmratelimit/v3/anthropic/v1";
const DEFAULT_MODEL = "claude-4.6-sonnet-google";

const gateway = (process.env.HI_GATEWAY ?? DEFAULT_GATEWAY).replace(/\/+$/, "");
const model = process.env.HI_MODEL ?? DEFAULT_MODEL;
const accessToken = process.env.XHS_ACCESS_TOKEN ?? "";
const shell = detectShell();
const cwd = process.cwd();
const osName = process.platform === "darwin" ? "macOS" : "Linux";

async function main() {
  if (!accessToken) {
    process.stderr.write(
      "hi: missing XHS_ACCESS_TOKEN\n" +
        "    export XHS_ACCESS_TOKEN=AT-xxxxxxxx...   # get it from codewiz\n",
    );
    process.exit(1);
  }

  const spinner = createSpinner();

  const systemPrompt = [
    "You are a shell command expert.",
    `Shell: ${shell}`,
    `OS: ${osName}`,
    `Current directory: ${cwd}`,
    "",
    "Rules:",
    "- Return ONLY the raw shell command, nothing else",
    "- No explanations, no markdown, no backticks, no code fences",
    "- If multiple steps are needed, chain them with && or write a one-liner",
    "- The command must be ready to run as-is",
  ].join("\n");

  // NOTE: the gateway (codewiz llmratelimit/v3/anthropic) only implements the
  // streaming branch — non-stream requests fall through to a default handler
  // that returns 500 {"error":"unknown error"}. We therefore always use SSE
  // and reassemble the text deltas ourselves.
  let res: Response;
  try {
    res = await fetch(`${gateway}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "text/event-stream",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "anthropic-beta": "fine-grained-tool-streaming-2025-05-14",
        "x-adapter-source": "openclaw",
        Cookie: `common-internal-access-token-prod=${accessToken}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: query }],
      }),
    });
  } catch (err) {
    spinner.stop();
    const msg = err instanceof Error ? err.message : String(err);
    die(`cannot reach gateway at ${gateway} — ${msg}`);
  }

  if (!res.ok) {
    spinner.stop();
    const body = await safeReadText(res);
    process.stderr.write(`hi: gateway returned ${res.status} ${res.statusText}\n`);
    if (res.status === 401 || res.status === 403) {
      process.stderr.write("hi: XHS_ACCESS_TOKEN may be invalid or expired\n");
    }
    if (body) process.stderr.write(`hi: ${truncate(body, 500)}\n`);
    process.exit(1);
  }

  let command: string;
  try {
    command = await collectStreamedText(res);
  } catch (err) {
    spinner.stop();
    const msg = err instanceof Error ? err.message : String(err);
    die(`failed to read response — ${msg}`);
  }
  spinner.stop();

  command = command.trim();
  if (!command) {
    process.stderr.write("hi: gateway returned an empty response\n");
    process.exit(1);
  }

  process.stdout.write(command + "\n");
  process.exit(0);
}

/**
 * Read an Anthropic Messages SSE stream and concatenate every `text_delta`
 * inside `content_block_delta` events. Surfaces server-side `error` events
 * as thrown errors so the caller can show a meaningful message.
 */
async function collectStreamedText(res: Response): Promise<string> {
  if (!res.body) throw new Error("response has no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let text = "";

  const handleEvent = (rawData: string) => {
    if (!rawData || rawData === "[DONE]") return;
    let evt: any;
    try {
      evt = JSON.parse(rawData);
    } catch {
      return; // ignore non-JSON keepalives
    }
    if (evt?.type === "content_block_delta" && evt.delta?.type === "text_delta") {
      text += evt.delta.text ?? "";
    } else if (evt?.type === "error") {
      const msg = evt.error?.message || "stream error";
      throw new Error(msg);
    }
  };

  // SSE frame := lines separated by \n, frames separated by a blank line.
  // We accept both \n\n and \r\n\r\n as frame separators.
  const flushFrames = () => {
    while (true) {
      const sep = buffer.indexOf("\n\n");
      const sepCRLF = buffer.indexOf("\r\n\r\n");
      let cut = -1;
      let cutLen = 0;
      if (sep !== -1 && (sepCRLF === -1 || sep < sepCRLF)) {
        cut = sep;
        cutLen = 2;
      } else if (sepCRLF !== -1) {
        cut = sepCRLF;
        cutLen = 4;
      }
      if (cut === -1) return;
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + cutLen);

      // Concatenate every `data:` line in the frame, per SSE spec.
      let data = "";
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith("data:")) {
          data += line.slice(5).replace(/^ /, "");
        }
      }
      handleEvent(data);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushFrames();
  }
  buffer += decoder.decode();
  if (buffer.length > 0) {
    // Process any trailing frame without a final blank line.
    buffer += "\n\n";
    flushFrames();
  }

  return text;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}

function die(message: string): never {
  process.stderr.write(`hi: ${message}\n`);
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`hi: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Writes directly to /dev/tty, bypassing stdout/stderr redirection.
 * This is necessary because the shell wrapper captures both streams:
 *   cmd=$(command hi "$@" 2>/tmp/hi-err)
 * Writing to /dev/tty reaches the real terminal regardless.
 */
function createSpinner() {
  const noop = { stop: () => {} };

  // /dev/tty may be missing (e.g. CI, redirected stdio); fail silently.
  let tty: fs.WriteStream;
  try {
    tty = fs.createWriteStream("/dev/tty");
  } catch {
    return noop;
  }
  // createWriteStream is lazy — open errors surface asynchronously on the
  // 'error' event. Swallow them so the CLI keeps running headless.
  let alive = true;
  tty.on("error", () => {
    alive = false;
  });

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const label = " thinking...";
  const dim = "\x1b[2m";
  const reset = "\x1b[0m";
  const clearLine = "\r\x1b[K";

  let frame = 0;
  const write = (s: string) => {
    if (alive) tty.write(s);
  };

  write(`${dim}${frames[0]}${label}${reset}`);

  const timer = setInterval(() => {
    frame = (frame + 1) % frames.length;
    write(`${clearLine}${dim}${frames[frame]}${label}${reset}`);
  }, 80);

  return {
    stop() {
      clearInterval(timer);
      write(clearLine);
      // Use destroy() instead of end(): /dev/tty is a character device that
      // never emits EOF, so end() can leave the fd referenced and prevent
      // the Node process from exiting. destroy() releases it immediately.
      try {
        tty.destroy();
      } catch {
        /* already dead */
      }
    },
  };
}

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

function rcFilePath(): string {
  const sh = detectShell();
  return sh === "bash" ? path.join(os.homedir(), ".bashrc") : path.join(os.homedir(), ".zshrc");
}

function readRc(rcFile: string): string {
  try {
    return fs.readFileSync(rcFile, "utf8");
  } catch {
    return "";
  }
}

const TOKEN_MARKER = "# hi — XHS access token (managed by `hi login`)";

/**
 * Replaces or removes the `TOKEN_MARKER` + next line block in rcContent.
 * If `nextLine` is null, the block is removed entirely.
 * If the marker is absent and `nextLine` is provided, the block is appended.
 */
function rewriteTokenBlock(rcContent: string, nextLine: string | null): string {
  const lines = rcContent.split("\n");
  const idx = lines.indexOf(TOKEN_MARKER);

  if (idx === -1) {
    if (nextLine === null) return rcContent;
    const sep = rcContent.length === 0 || rcContent.endsWith("\n") ? "" : "\n";
    return `${rcContent}${sep}${TOKEN_MARKER}\n${nextLine}\n`;
  }

  // Drop marker + the following line (token export).
  lines.splice(idx, 2);
  const cleaned = lines.join("\n");
  if (nextLine === null) return cleaned;
  const sep = cleaned.length === 0 || cleaned.endsWith("\n") ? "" : "\n";
  return `${cleaned}${sep}${TOKEN_MARKER}\n${nextLine}\n`;
}

function maskToken(token: string): string {
  if (token.length <= 14) return "***";
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function setup(): void {
  const sh = detectShell();
  const rcFile = rcFilePath();
  const initLine = `eval "$(hi init ${sh})"`;

  const existing = readRc(rcFile);
  if (existing.includes("hi init")) {
    console.log(`✓ hi is already set up in ${rcFile}`);
  } else {
    const sep = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
    fs.appendFileSync(rcFile, `${sep}${initLine}\n`);
    console.log(`✓ Added to ${rcFile}:`);
    console.log(`    ${initLine}`);
  }

  console.log("");
  console.log(`  Restart your shell or run:`);
  console.log(`    source ${rcFile}`);

  // Hint if no token has been saved yet.
  const after = readRc(rcFile);
  if (!after.includes(TOKEN_MARKER) && !process.env.XHS_ACCESS_TOKEN) {
    console.log("");
    console.log("  Tip: save your token with:");
    console.log("    hi login <token>");
  }
}

function login(token: string): void {
  const rcFile = rcFilePath();
  const exportLine = `export XHS_ACCESS_TOKEN="${token.replace(/"/g, '\\"')}"`;
  const next = rewriteTokenBlock(readRc(rcFile), exportLine);
  fs.writeFileSync(rcFile, next);

  console.log(`✓ Saved XHS_ACCESS_TOKEN (${maskToken(token)}) to ${rcFile}`);
  console.log("");
  console.log(`  Restart your shell or run:`);
  console.log(`    source ${rcFile}`);

  if (!next.includes("hi init")) {
    console.log("");
    console.log("  Tip: enable shell integration with:");
    console.log("    hi setup");
  }
}

function logout(): void {
  const rcFile = rcFilePath();
  const current = readRc(rcFile);
  if (!current.includes(TOKEN_MARKER)) {
    console.log(`✓ No saved token found in ${rcFile}`);
    return;
  }
  const next = rewriteTokenBlock(current, null);
  fs.writeFileSync(rcFile, next);
  console.log(`✓ Removed XHS_ACCESS_TOKEN from ${rcFile}`);
  console.log(`  The variable stays in your current shell session until you restart it.`);
}
