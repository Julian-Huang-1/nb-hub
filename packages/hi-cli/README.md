# hi-cli

Natural language to shell command. Calls the Xiaohongshu internal AI gateway directly — no extra server required.

```
$ hi 添加 http 临时代理环境变量
# zsh: buffer fills with → export HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890

$ hi list all files larger than 100mb
# zsh: buffer fills with → find . -size +100M -type f
```

## Install

```bash
npm install -g @nb-hub/hi-cli
```

Then run the one-time setup:

```bash
hi setup
```

`hi setup` auto-detects your shell (zsh/bash), appends the init line to your rc file, and tells you what to run to reload.

Under the hood it adds this single line to `~/.zshrc` (or `~/.bashrc`):

```zsh
eval "$(hi init zsh)"
```

## Configure

Save your Xiaohongshu access token once — it gets written to your rc file:

```bash
hi login AT-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

This writes (or overwrites) a managed block in `~/.zshrc` / `~/.bashrc`:

```zsh
# hi — XHS access token (managed by `hi login`)
export XHS_ACCESS_TOKEN="AT-xxxxxxxx..."
```

To rotate the token, just run `hi login <new-token>` again. To remove it, run `hi logout`.

> How to get the token: open [codewiz](http://codewiz.devops.xiaohongshu.com) in your browser, open DevTools → Network, pick any request, and copy the value of the `common-internal-access-token-prod` cookie.

## How it works

```
hi <query>
  └─ shell function hi()          captures stdout, injects into buffer
       └─ command hi <query>      binary: POST <gateway>/messages → Anthropic-compatible LLM
```

- `command hi` bypasses the shell function and calls the binary directly
- **zsh**: result injected into readline buffer via `print -z` — review and press Enter
- **bash**: result displayed + copied to clipboard + added to history (press ↑)

The binary talks to the gateway directly using the Anthropic Messages protocol — there is no api-server in the loop.

## Configuration

| Env var | Required | Default | Description |
|---|---|---|---|
| `XHS_ACCESS_TOKEN` | ✅ | — | Xiaohongshu internal AI gateway token |
| `HI_MODEL` |   | `claude-4.6-sonnet-google` | Model id |
| `HI_GATEWAY` |   | `http://codewiz.devops.xiaohongshu.com/llmratelimit/v3/anthropic` | Gateway base URL (Anthropic-compatible) |

## CLI reference

| Command | Description |
|---|---|
| `hi <query>` | Generate and inject a shell command |
| `hi setup` | One-time shell integration setup |
| `hi login <token>` | Save (or replace) `XHS_ACCESS_TOKEN` in your rc file |
| `hi logout` | Remove the saved token from your rc file |
| `hi init zsh` | Print zsh function definition (for eval) |
| `hi init bash` | Print bash function definition (for eval) |

## Troubleshooting

- **`missing XHS_ACCESS_TOKEN`** — export it as shown in [Configure](#configure).
- **`gateway returned 401`** / **`403`** — the token is invalid or expired. Re-copy it from the browser.
- **`cannot reach gateway`** — check that you are on the corporate network / VPN.
