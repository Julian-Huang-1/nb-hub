---
name: nb-hub-sites
description: 使用 nb-hub CLI 上传、发布、回滚和管理 HTML 静态站点，支持按需下载安装 CLI。用于用户要求部署 HTML、ZIP 或静态目录到 nb-hub 时。
---

# nb-hub 静态站点

先执行 `bash <本 skill 的绝对路径>/scripts/ensure-cli.sh`，将 stdout 保存为 `CLI`。
脚本检查固定版本，缺失时从 GitHub Release 下载并验证 SHA256，无需 sudo；
stdout 只返回 CLI 的绝对路径，后续使用该路径，不依赖 PATH 已更新。
支持 macOS/Linux 的 arm64、amd64，使用系统的 Bash、tar 和 sha256sum/shasum。
私有仓库需要已登录且有仓库读取权限的 `gh`，或通过环境提供 `GH_TOKEN`；
下载失败时停止并报告原因，不改用未经校验的二进制或其他下载源。

服务地址使用用户提供的 `--server`、`NB_HUB_API_URL` 或 CLI 已保存配置。
本项目生产入口为 `https://hub.hjxgogogo.me`；仅在用户指定本平台且未指定其他环境时使用。
访问 API 需要环境变量 `NB_HUB_TOKEN`（账户页面创建的 PAT）。不要输出令牌、
将其写入 skill/项目文件或放进命令参数；缺少令牌时提示用户配置环境。
安装 CLI 不需要平台 PAT。私有 GitHub 下载使用 GitHub 凭据，与平台 PAT 分开。

使用 `--json` 解析 stdout，进度与部署 ID 在 stderr。常用命令：

```bash
"$CLI" --json site list --limit 50 --offset 0
"$CLI" --json site create --name "demo" --visibility private
"$CLI" --json deploy ./index.html --site "$SITE_ID" --wait
"$CLI" --json deploy ./dist --site "$SITE_ID" --publish
"$CLI" --json deployment list --site "$SITE_ID"
"$CLI" --json site rollback "$SITE_ID" --deployment "$DEPLOYMENT_ID"
```

创建站点默认 private；仅在用户需要公开访问时使用 `--visibility public`。
上传支持单个 HTML、ZIP、目录，不执行构建。目录部署默认入口为根目录 `index.html`，
其他入口用 `--entrypoint`；ZIP 不剥离顶层目录。需要构建的项目先使用项目自身构建流程。
`--wait` 仅等待处理完成，`--publish` 等待并切换正式版本；按用户请求决定是否发布。
预览始终需要所有者浏览器会话，PAT 不能换取预览访问 Cookie。

上传前可生成并保存一个非敏感 `--idempotency-key`。仅在确认请求内容不变时用同一 key 重试；
超时先用 stderr 的部署 ID 或部署列表查询状态，避免重复上传。
退出码 3 表示版本冲突，重新读取站点与部署状态并报告，不盲目覆盖；
退出码 1 为失败，130 为取消。不要自动删除站点或放宽访问权限来解决错误。
部署后报告站点 ID、部署 ID、状态及返回的正式 URL；私有或未发布版本说明访问限制。
