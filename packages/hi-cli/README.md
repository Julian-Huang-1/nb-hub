# hi-cli

Natural language to shell command, powered by the nb-hub api-server.

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

`hi setup` auto-detects your shell (zsh/bash), appends the init line to your rc file, and tells you what to run to reload. That's it.

Under the hood it adds this single line to `~/.zshrc` (or `~/.bashrc`):

```zsh
eval "$(hi init zsh)"
```

## How it works

```
hi <query>
  └─ shell function hi()          captures stdout, injects into buffer
       └─ command hi <query>      binary: POST /hi/command → api-server LLM
```

- `command hi` bypasses the shell function and calls the binary directly
- **zsh**: result injected into readline buffer via `print -z` — review and press Enter
- **bash**: result displayed + copied to clipboard + added to history (press ↑)

## api-server

The LLM call lives in the api-server. Make sure it's running:

```bash
pnpm --filter @nb-hub/api-server run start
```

Required env vars on the server:

```bash
AI_PROVIDER=kimi-coding   # or openai, anthropic, etc.
AI_MODEL=kimi-k2-thinking
# + the API key env var for your provider
```

## Configuration

| Env var | Default | Description |
|---|---|---|
| `HI_SERVER` | `http://localhost:9999` | api-server base URL |

```zsh
export HI_SERVER=https://my-api.example.com
```

## CLI reference

| Command | Description |
|---|---|
| `hi <query>` | Generate and inject a shell command |
| `hi setup` | One-time shell integration setup |
| `hi init zsh` | Print zsh function definition (for eval) |
| `hi init bash` | Print bash function definition (for eval) |
