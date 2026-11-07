# 静态站点服务端与 CLI

静态托管复用现有 Go API 和 PostgreSQL。API、单并发发布 Worker、内容网关在一个
Go 进程中运行，文件保存在本地持久化目录。不运行上传代码，不执行 npm/build，
不要求 OSS、CDN 或 Redis。Web 和桌面端暂未新增站点管理界面。

## 启动与配置

本地先按现有开发流程执行 `make up`；入口会执行迁移。默认内容域为
`sites.localhost:8080`，管理 API 为 `http://127.0.0.1:8080`。

- `NB_HUB_CONTENT_DOMAIN`：不含协议的内容域名，可在开发中带端口。自定义 API
  端口时同步修改此值。开发机器需能将 `*.sites.localhost` 解析到回环地址。
- `NB_HUB_SITES_ROOT`：存储根目录，默认 `.nb-hub/sites`，相对 API 的工作目录；
  通过 make 启动时位于 `server/` 下。生产 Compose 固定为 `/var/lib/nb-hub/sites`。
- `NB_HUB_SITES_OWNER_QUOTA_BYTES`：每个用户的部署存储配额，默认 1 GiB。
- `NB_HUB_SITES_TOTAL_QUOTA_BYTES`：所有用户共享的部署存储配额，默认 5 GiB。

生产环境未设置内容域名时保留原有后台行为，不启用站点接口或 Worker。
内容域名与 `FRONTEND_ORIGIN` 必须使用不同且互不包含的 hostname。
支持同一主域下的兄弟域名，例如后台 `hub.example.com`、内容 `site.example.com`；
生产的会话、CSRF、OAuth state 及内容 Cookie 使用 `__Host-` 前缀，不能设置 Domain。
管理 API 仍执行严格 Origin、CSRF 和资源归属校验。每个站点和预览版本使用独立 hostname：

```text
s<32 位 site UUID>.内容域名       正式站点
p<32 位 deployment UUID>.内容域名 固定版本预览
```

不使用同域路径托管用户内容。后台和内容网关不能通过同一个 hostname 混用。

## CLI

从仓库安装：

```bash
cd server
go install ./cmd/nb-hub
```

在已有账户页面生成 PAT，通过环境变量 `NB_HUB_TOKEN` 注入；CLI 不保存令牌。
服务地址优先级为 `--server`、`NB_HUB_API_URL`、保存的配置、`http://127.0.0.1:8080`。
远程使用 HTTPS，避免凭据通过明文网络传输。配置文件位于系统用户配置目录的
`nb-hub/config.json`，只保存服务地址。

```bash
nb-hub config set server https://hub.example.com
nb-hub site create --name docs --visibility public
nb-hub site list --limit 50 --offset 0
nb-hub site show <site-id>

nb-hub deploy ./dist --site <site-id> --publish
nb-hub deploy ./index.html --site <site-id> --wait
nb-hub deploy ./bundle.zip --site <site-id> --entrypoint public/index.html --wait

nb-hub deployment list --site <site-id>
nb-hub deployment show <site-id> <deployment-id>
nb-hub site publish <site-id> --deployment <deployment-id>
nb-hub site rollback <site-id> --deployment <deployment-id>
nb-hub site update <site-id> --visibility private
nb-hub site unpublish <site-id>
nb-hub site delete <site-id>
```

`deploy` 接受单个 HTML、ZIP 或目录，目录会在本地打包，跳过符号链接、`.git`、
`node_modules`、`.env` 和 `.env.*`。ZIP 根目录默认必须存在 `index.html`，不自动
剥离顶层文件夹；可用 `--entrypoint` 指定其他入口。嵌套入口会从 `/` 跳转到
实际入口路径，保留资源相对路径的含义。

默认上传后返回部署记录；`--wait` 等待就绪，`--publish` 隐含等待。发布使用上传前
读取的站点 revision，出现冲突时不自动重试覆盖。默认总等待上限 5 分钟，可用
`--timeout 10m` 调整。停止等待不取消服务器任务。上传响应成功后，stderr 会输出
部署 ID 和幂等 key；也可以提前指定 `--idempotency-key`，以便响应丢失时重试。
相同 key 必须携带完全相同的文件与元数据；上传中或内容不同返回 409。
上传已经失败且未得到文件摘要的 key 不可复用，需要新 key。

stdout 输出 JSON，默认缩进，`--json` 输出紧凑 JSON；进度在 stderr。
退出码：0 成功，1 失败，3 HTTP 409 冲突，130 用户取消。
PAT 不能创建访问票据、管理会话或创建其他 PAT。

## API

所有管理接口要求已有认证中间件。Bearer PAT 和交互式会话都可以管理本人站点；
Cookie 写操作仍要求现有 CSRF 校验。读取或修改其他用户的资源返回 404。
响应采用 JSON，错误格式为 `{ "code": "...", "error": "..." }`。
列表支持 `limit=1..100`、`offset>=0`，返回 `{items, limit, offset}`。

| 方法 | 路径 | 请求或行为 |
| --- | --- | --- |
| POST | `/api/v1/sites` | `{name, visibility?, routing_mode?}`，默认 private/static |
| GET | `/api/v1/sites` | 列出本人站点 |
| GET | `/api/v1/sites/{site_id}` | 站点和当前 revision |
| PATCH | `/api/v1/sites/{site_id}` | `{expected_revision, name?, visibility?, routing_mode?}` |
| DELETE | `/api/v1/sites/{site_id}` | 立即下线，延迟删除文件 |
| POST | `/api/v1/sites/{site_id}/deployments` | multipart 上传，返回 202 和 Location |
| GET | `/api/v1/sites/{site_id}/deployments` | 部署历史 |
| GET | `/api/v1/sites/{site_id}/deployments/{deployment_id}` | 状态及错误码 |
| PUT | `/api/v1/sites/{site_id}/publication` | `{deployment_id, expected_revision}` |
| DELETE | `/api/v1/sites/{site_id}/publication` | `{expected_revision}`，下线但保留版本 |
| POST | `/api/v1/sites/{site_id}/access-tickets` | `{deployment_id?}`，仅交互式会话 |

multipart 字段顺序为可选 `entrypoint`、`message`，最后一个字段必须是 `file`；
不能有重复或未知字段。支持 `.html`、`.htm` 和 `.zip`。幂等 key 通过
`Idempotency-Key` 请求头传入，最长 128 字节。

部署经过 `uploading → queued → processing → ready/failed`。上传阶段失败会释放
预留配额；Worker 使用 PostgreSQL 行锁领取任务，租约 5 分钟，每次文件处理最多
2 分钟。文件处理的暂时错误最多尝试 3 次，重启后等待租约到期继续处理。
无效归档直接失败。版本完成后不可修改；发布/回滚通过事务修改当前版本指针。
站点属性修改、发布、下线都会递增 revision；不匹配返回 `409 publication_conflict`。

## 文件访问与私有权限

正式站点支持 public/private，预览始终只允许所有者。权限检查覆盖所有 HTML、JS、
CSS、图片和条件请求。网关不接受管理端 Cookie 或 Bearer 作为内容访问凭据。

私有浏览器访问流程：

1. 通过管理域名的交互式会话调用 access-tickets，可指定预览部署 ID。
2. 返回 `{ticket, exchange_url, expires_at}`；票据有效期 1 分钟，绑定目标 hostname。
3. 向 `exchange_url` 提交 `application/x-www-form-urlencoded` 的 POST，字段为
   `ticket`。需要由浏览器表单导航完成，票据不放在 URL。
4. 网关一次性消费票据，设置 host-only/HttpOnly 内容 Cookie，303 跳回 `/`。
5. 每个文件请求检查原登录会话仍有效、站点未删除且归属不变。内容 Cookie 最长
   有效 1 小时，生产使用 Secure 与 `__Host-` 前缀，不能调用管理 API。

目前提供这套服务端接口，尚未实现浏览器登录跳转界面。CLI 使用 PAT 可以部署
私有站点，但不能把 PAT 换成浏览器内容凭据。

私有内容/预览返回 `private, no-store`，公开正式站点返回
`no-cache, must-revalidate`。先检查权限，再处理 ETag/304，防止收紧权限后
复用旧的公开缓存。普通静态模式不回退入口；SPA 模式仅对接受 HTML 的无扩展名
缺失路径回退，缺失 JS/CSS 返回 404。不提供目录列表。

## 代码组织

站点配置、部署处理和任务恢复放在现有 `server/internal/service/sites_*.go`；
管理及内容 HTTP 处理放在现有 `server/internal/handler`，路由放在 `api`。
不为配置、Worker 或内容网关单独创建包。

两个新增目录各自负责明确的边界：`storage` 处理归档校验及磁盘文件，
`sitecli` 处理 CLI 命令、HTTP 请求和本地打包。当前只有本地存储实现，
没有添加对象存储接口、插件机制或独立 Worker 服务。

## 文件和资源边界

- 上传最多 20 MiB，解压最多 50 MiB，ZIP 最多 1000 个条目。
- 拒绝路径穿越、反斜杠、符号链接、特殊文件、重复路径及保留的 `.nbhub` 路径。
- 用户最多 50 个未删除站点、累计 1000 条部署记录。
- 上传前使用数据库事务预留 70 MiB，避免并发上传绕过配额。完成后按实际产物
  大小计费。配额不含数据库及文件系统开销；磁盘需要为临时构建和其他服务留余量。
- 部署在 `work/` 完成后原子移动到 `releases/<site-id>/<deployment-id>/`。
- `staging/` 保存待处理上传。15 分钟未完成上传会失败并清理，崩溃遗留的临时
  目录也会清理。删除站点后等待至少 10 分钟再清理版本，避免与短期活跃任务竞争。
- 不执行上传的脚本。前端 JavaScript 只在访问者浏览器运行。

## 单机生产部署

主 Compose 为 API 增加独立 `sites_data` 卷；镜像为 UID 10001 准备可写目录。
启用内容访问时：

1. 在生产配置中设置独立内容 hostname 的 `NB_HUB_CONTENT_DOMAIN`（不含 `*.`），例如
   `usercontent.example.net`；将 `*.usercontent.example.net` 解析到服务器。
2. 将该通配域名的证书链与私钥分别放到 `deploy/content-tls/fullchain.pem` 和
   `deploy/content-tls/privkey.pem`。此目录已忽略，私钥只通过私有通道传输。
   默认 Caddy 镜像不包含云 DNS 插件，因此此方案使用提供的证书；证书续期后需
   reload Caddy，或自行构建 DNS provider 镜像实现自动续期。
3. 构建新镜像，在服务器使用两个 Compose 文件启动：

```bash
docker compose --env-file .env.production \
  -f docker-compose.production.yml -f docker-compose.sites.yml up -d
```

后续更新、查看日志和停止服务都使用同样两个文件，防止退回后台专用的 Caddy 配置。
复制部署文件时同时包含 overlay、`deploy/Caddyfile.sites` 和私有证书目录。
迁移服务仍先于 API 执行。除已有 80/443 外不新增公网端口。

备份 PostgreSQL 的同时备份 `sites_data` 卷中的 releases。需要一致快照时先停止
上传/发布，再备份数据库和文件；仅备份数据库无法恢复 HTML。不要运行带 `-v`
的 Compose down。OSS/CDN 后续通过存储边界扩展，第一版不依赖这些服务。

## 验证

默认 `cd server && go test ./...` 不连接数据库。真实 API、权限、发布竞争、
任务恢复及 CLI 上传测试需显式提供一次性数据库：

```bash
cd server
NB_HUB_SITES_TEST_DATABASE_URL='postgres://.../nbhub_test_sites?sslmode=disable' \
  go test ./internal/api -run TestSitesPostgres -v
```

库名必须以 `nbhub_test_` 开头。测试执行全部迁移、创建随机用户并清理自己的记录；
不连接真实智能体、邮件或第三方账户。

## 宿主机 Caddy 按站点签发证书

外部代理模式可在 `PRODUCTION_ENV` 设置 `NB_HUB_CONTENT_DOMAIN=site.hjxgogogo.me`。
DNS 添加 `*.site` 的 A 记录指向服务器；后台仍使用 `hub.hjxgogogo.me`。
`deploy/Caddyfile.host` 提供内容路由及 on-demand TLS 配置示例：
在宿主机 Caddy 的全局 `{ }` 中添加 `on_demand_tls` 的 ask URL，
内容域名块启用 `tls { on_demand }`。新站点首次 HTTPS 请求会申请该 hostname 的
证书，不需要云 DNS 插件；大规模使用时可改为预先配置通配证书以减少签发次数。

准入地址为 `http://127.0.0.1:18081/internal/sites/tls-allow?domain=...`，只接受
回环或私有网桥来源（Docker 会将宿主机请求转换成网桥地址），忽略可伪造的转发 IP 头，公开后台入口拒绝 `/internal/*`。服务端仅允许有效站点和就绪预览版本
对应的 hostname；未知、已删除、其他域名均拒绝，避免为任意通配名称申请证书。
宿主 Caddy 需要先通过配置校验再 reload，现有站点路由保持不变。
