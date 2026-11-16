# CLI 发布与 skill 安装

CLI 实现保留在 `server/internal/sitecli`，入口为 `server/cmd/nb-hub`。
`nb-hub --version` 显示版本、commit 和构建时间；源码安装默认显示 `dev`。
与 Multica 一样，使用 GoReleaser 编译、打包、生成 SHA256 并上传 GitHub Release，
安装使用 Shell，无需 Python。当前支持 macOS/Linux 的 arm64、amd64。

## 发布

第一次发布使用 `v0.1.0`。后续先更新
`.agents/skills/nb-hub-sites/scripts/ensure-cli.sh` 的 `VERSION`，再创建对应 tag。
workflow 检查 tag 为稳定的 `vX.Y.Z` 且与 skill 一致。
这里使用普通版本 tag 发布二进制，不提供通过 Go 子模块版本号安装的发布流程。

```bash
# 本地验证，需要 GoReleaser v2.20.0、Go 和 Node
node --test scripts/ensure-cli.test.mjs
goreleaser check
goreleaser release --snapshot --clean

# 提交并推送修改后，在准备发布的 commit 创建 tag
git tag -a v0.1.0 -m 'nb-hub CLI v0.1.0'
git push origin v0.1.0
```

`Release CLI` workflow 运行测试，使用 `.goreleaser.yml` 构建四个平台及 skill 包，
上传 draft Release，全部成功后发布。只需要 GitHub 内置 `GITHUB_TOKEN`。
发布失败的 draft 可删除后重跑，已发布版本使用新 tag；版本 tag 不触发生产部署。
Release 包含：

- `nb-hub_0.1.0_{darwin,linux}_{amd64,arm64}.tar.gz`：CLI 和使用文档。
- `nb-hub-sites_0.1.0.tar.gz`：skill 及 Shell 安装器。
- `SHA256SUMS`：上述文件的 SHA256。

本地 snapshot 产物在 `dist/`，带快照版本，不上传；不会被固定稳定版本安装器接受。
SHA256 用于检测文件损坏，信任来源仍是 GitHub 仓库。

## 使用 skill

仓库内 `.agents/skills/nb-hub-sites` 可被支持项目 skill 的智能体发现。
其他机器可以将该文件夹复制到 `~/.codex/skills/nb-hub-sites`，
或下载 Release 的 skill 包，验证 SHA256 后解压到 `~/.codex/skills`。

安装器使用 Bash、tar 和 sha256sum/shasum。私有仓库下载需要有读取权限的
GitHub CLI（`gh auth login`，或给 gh 注入 `GH_TOKEN`）；公开仓库可通过 curl 下载。
仓库当前为私有，Release 不会自动公开。

```bash
CLI="$(bash .agents/skills/nb-hub-sites/scripts/ensure-cli.sh)"
"$CLI" --version
"$CLI" config set server https://hub.hjxgogogo.me
# NB_HUB_TOKEN 通过运行环境注入，不写入 skill 或命令参数
"$CLI" --json site list
```

安装器优先复用 PATH 或 `~/.local/bin` 中的固定版本；缺失或版本不符时下载、
校验 SHA256 和版本后，原子替换 `~/.local/bin/nb-hub`。失败保留原文件。
不需要 sudo，不改 shell 配置；stdout 只返回 CLI 绝对路径，诊断写入 stderr。
首次 Release 发布前下载会失败。更新 skill 的版本后才会升级，不追踪 latest。

GitHub 凭据只用于下载安装。访问平台需要独立的 `NB_HUB_TOKEN`（PAT）。
部署命令与权限说明见 [静态站点文档](static-sites.md)。
