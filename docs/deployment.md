# 本地与生产部署

## 环境隔离

| 配置 | 本地开发 | 生产 |
| --- | --- | --- |
| 环境文件 | `.env.development` | `.env.production` |
| Compose 文件 | `docker-compose.yml` | `docker-compose.production.yml` |
| Compose 项目名 | `nb-hub-dev` | `nb-hub-prod` |
| 数据库 | `nbhub_dev` | `nbhub_prod` |
| 数据库用户 | `nbhub_dev`（默认） | `nbhub_prod` |
| 数据卷 | `nb-hub-dev_postgres_data` | `nb-hub-prod_postgres_data` |
| 数据库网络 | 仅本机 `127.0.0.1:5432` | 仅容器网络，不发布端口 |

两套配置即使在同一台机器上运行，也使用不同项目和数据卷。不要通过
`COMPOSE_PROJECT_NAME` 或 `-p` 将两套配置改成同一个项目名。环境文件已加入
Git 和 Docker 构建上下文的忽略列表；生产凭据不会被复制到应用镜像。

代码通过 `DATABASE_URL` 选择数据库；`APP_ENV` 不会自动切换连接地址。
浏览器只访问 API，不能持有数据库凭据。

## 本地开发

```bash
make up
make status
make down
```

`make up` 首次从示例创建开发配置，启动并等待本地 PostgreSQL 健康，使用实际
`DATABASE_URL` 执行迁移，按需安装依赖、编译 Go API，再后台启动 API 和 Web。
它等待 HTTP 就绪，并验证监听端口的进程来自自己创建的监督进程。
重复运行不会重复启动健康服务。`make up C=api` 仅启动数据库和 API；`C=web`
会同时启动所需的 API。目前不提供自动 worktree 分库或端口分配。

应用进程、启动身份和日志保存在忽略的 `.nb-hub/dev/<配置路径摘要>/` 中。
`make status` 基于保存的进程身份和实际 HTTP 结果报告状态；未知进程不会被当成
已管理服务。`make down` 无需重新读取配置内容，按保存的身份停止 API、pnpm、Next
及其子进程；数据库继续运行。不能通过删状态目录来代替 down，否则会失去管理记录。

已有手动服务占用端口时，up 在启动数据库和应用前报错，不会自动杀进程。
启动失败会停止本次新启动的应用，保留原有健康服务和数据库。运行期间编辑配置后，
先 down 再 up。修改 Go 源码后同样需要重启；Web 保留 Next.js 的热更新能力。

配置 `FRONTEND_PORT` 可修改 Web 端口；同时为 E2E 设置对应的 `PLAYWRIGHT_BASE_URL`。
`NB_HUB_LISTEN_ADDR`、`NB_HUB_API_URL` 必须使用匹配的 API 端口。
统一入口仅管理开发用本地 `nbhub_dev`，连接参数必须与当前 Compose 的
`POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_PORT` 一致。远程库不能通过该入口启动。

需要逐个调试时，仍可运行 `make db-up`、`make migrate`、`make api` 和
`make dev-web`。这些手动前台服务不会被 up 自动接管，down 也不会停止它们。

开发入口加载 `.env.development` 并要求 `APP_ENV=development`。配置文件使用
shell 兼容的 `KEY=value` 格式，含空格或 shell 特殊字符的值需要引号。
文件中的值覆盖当前 shell 中的同名变量。若更改数据库用户、密码或端口，
同步修改 `DATABASE_URL`。移动真机调试时，在文件中设置电脑局域网 IP 对应的
`EXPO_PUBLIC_API_URL`，以及 `NB_HUB_LISTEN_ADDR=0.0.0.0:8080`。

`make db-down` 停止开发数据库并保留数据卷。首次创建卷后，修改
`POSTGRES_PASSWORD` 不会自动更改已有数据库密码，需要使用 SQL 修改。

旧版 Compose 使用的 `nbhub` 数据库和旧数据卷不会被新配置自动迁移或删除。
需要旧数据时先导出并核对，再导入新的开发数据库。

## 开发库重置

重置会断开连接、删除整个开发数据库、重新创建并执行迁移。建议先停下本地 API。

```bash
make db-reset CONFIRM=nbhub_dev
```

必须同时满足以下条件，否则在连接数据库前拒绝操作：

- `APP_ENV=development`。
- 显式确认 `CONFIRM=nbhub_dev`。
- `DATABASE_URL` 实际解析出的数据库名为 `nbhub_dev`。
- 所有连接目标均为字面量回环 IP，例如 `127.0.0.1`、`::1`。

不接受 `localhost`、远程域名、Unix socket 或远程备用地址。此命令用于当前
本机数据库，并非具备环境识别能力的通用删库工具；不要通过隧道将生产数据库
转发为开发连接。生产库名固定为 `nbhub_prod`，不在允许名单内。

## 数据库迁移

迁移文件放在 `server/migrations`，格式为 `000001_description.up.sql` 和对应
`.down.sql`。文件被嵌入迁移二进制，具体约定见该目录 README。当前迁移创建认证所需的用户、验证码、会话及个人令牌表，以及静态站点、部署任务与内容访问凭据；不创建工作区或任务占位模型。

本地运行 `make migrate`。生产 Compose 等待 PostgreSQL 健康后运行迁移服务，
迁移成功才启动 API。迁移失败会阻止新 API 启动，不会自动强制版本或回滚。
开发和生产执行相同版本的迁移，各自保留执行记录和数据。

修改迁移后需要重新构建 API 镜像。上线前先在开发环境验证迁移，并备份生产数据库；
重启应用不等于回滚数据库。已有实例运行时，数据库变更还应兼容旧版本应用。

## 阿里云单机生产部署

运行服务为 Caddy、Next.js、Go API、PostgreSQL。仅 Caddy 发布 80/443；Web、API
和数据库均不发布宿主机端口。Caddy 负责 HTTPS，`/api/*` 进入 API，其他请求进入
Web。尚无认证的 `/api/daemon` 路径在公网入口被拒绝。

Web 使用同源 `/api`，不同域名部署无需重建 Web 镜像。当前已支持登录、会话及个人令牌管理；生产必须设置独立的 `JWT_SECRET` 并配置邮件或 Google 登录，参见[认证配置](authentication.md)。

服务器需要 Docker Compose、域名解析和可用的 80/443。在阿里云安全组中允许
HTTP/HTTPS；数据库无须开放 5432。SSH 按自己的运维方式配置。

### 构建与传输

2 核 2GB 服务器优先只运行服务，在开发机或 CI 构建镜像。先准备配置：

```bash
make prod-env
```

该命令创建权限为 600 的 `.env.production`，分别生成随机十六进制数据库密码与 JWT_SECRET，且拒绝
覆盖已有文件。编辑其中的 `DOMAIN`，例如 `hub.example.com`；默认
`DEPLOY_PLATFORM=linux/amd64`，若服务器是 ARM 则改为 `linux/arm64`。

```bash
# 开发机或 CI：按 DEPLOY_PLATFORM 构建
make prod-build
docker save nb-hub-api:local nb-hub-web:local | gzip > nb-hub-images.tar.gz
```

将镜像包及以下文件通过 SSH/SCP 传到服务器的同一部署目录：

- `docker-compose.production.yml`
- `deploy/Caddyfile`（保留子目录）
- `.env.production`（通过私有通道传输，服务器上执行 `chmod 600 .env.production`）
- `nb-hub-images.tar.gz`

服务器执行：

```bash
docker load -i nb-hub-images.tar.gz
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps -a
```

访问 `https://你的域名` 和 `https://你的域名/api/health`。如果服务器有完整仓库，
也可以直接 `make prod-up`、`make prod-logs`、`make prod-down`。后续部署重复构建、
传输、加载镜像和 `up -d`；构建机与服务器使用相同的镜像名称和标签。
也可以将镜像推送到私有仓库，在环境文件中设置 `API_IMAGE`、`WEB_IMAGE`，然后
在服务器执行 `docker compose ... pull api web migrate` 和 `up -d`。

`down` 保留数据；不要给生产命令添加 `-v`，那会删除持久化数据卷。
API 的生产连接池上限为 4；这是低流量单机的起始设置，不代表已验证容量。
Next.js 采用 standalone 生产构建，Go 使用编译后的二进制。按实际内存和负载决定扩容。

## 备份

持久化卷不等于备份。上线前、每次变更表结构前，以及按需要定期执行备份：

```bash
mkdir -p backups
chmod 700 backups
umask 077
backup="backups/nbhub_prod-$(date +%Y%m%d-%H%M%S).dump"
docker compose --env-file .env.production -f docker-compose.production.yml \
  exec -T postgres pg_dump -U nbhub_prod -d nbhub_prod -Fc > "$backup"
```

确认导出命令成功，并用 `pg_restore --list` 检查归档，再将其复制到 OSS 或其他机器。
备份目录已忽略，不进入 Git 或镜像。定期在独立临时数据库中演练恢复；不要直接覆盖生产库。
当前提供备份命令说明，尚未配置定时备份或 OSS 上传。

## 验证数据库集成

`go test ./...` 默认不连接真实数据库。需要测试迁移时，先自行创建一个专用的
空数据库，名字必须以 `nbhub_test_` 开头，再显式提供连接：

```bash
cd server
NB_HUB_TEST_DATABASE_URL='postgres://user:password@127.0.0.1:5432/nbhub_test_migrations?sslmode=disable' \
  go test ./internal/database -run TestMigrationsPostgres -v
```

测试验证空迁移集、迁移重放、失败后的脏版本阻断，并清理自己的探针表与迁移记录。
不要指向已有业务数据库。

## 静态 HTML 托管

站点文件使用独立 `sites_data` 卷，API 内运行单并发发布 Worker。生产默认未启用，
设置独立内容主域并使用 `docker-compose.sites.yml` 后开放内容入口。通配 DNS、
TLS 证书、配额、文件备份及 CLI 操作见[静态站点指南](static-sites.md)。
