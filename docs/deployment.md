# 本地与生产部署

## 环境隔离

| 配置           | 本地开发                   | 生产                            |
| -------------- | -------------------------- | ------------------------------- |
| 环境文件       | `.env.development`         | `.env.production`               |
| Compose 文件   | `docker-compose.yml`       | `docker-compose.production.yml` |
| Compose 项目名 | `nb-hub-dev`               | `nb-hub-prod`                   |
| 数据库         | `nbhub_dev`                | `nbhub_prod`                    |
| 数据库用户     | `nbhub_dev`（默认）        | `nbhub_prod`                    |
| 数据卷         | `nb-hub-dev_postgres_data` | `nb-hub-prod_postgres_data`     |
| 数据库网络     | 仅本机 `127.0.0.1:5432`    | 仅容器网络，不发布端口          |

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
配置独立内容 hostname 与 DNS 后开放内容入口：内置代理使用 `docker-compose.sites.yml`，
已有宿主机代理使用 external 模式及对应站点路由。通配 DNS、
TLS 证书、配额、文件备份及 CLI 操作见[静态站点指南](static-sites.md)。

## GitHub Actions CI/CD

工作流为 `.github/workflows/ci-cd.yml`。PR 和 main 推送会执行类型检查、前端单测、
开发环境脚本测试、Go 单测、真实 PostgreSQL 集成测试、go vet 及 sqlc 生成文件检查。
测试数据库完全位于临时 runner，不连接开发或生产数据库。

自动部署默认关闭。启用后，main 测试通过才会在 GitHub 构建 API/Web 镜像，
通过 SSH 发送压缩镜像及 Compose 配置，在服务器执行迁移、替换应用并检查 HTTPS。
服务器只负责加载和运行镜像，不需要 Go、Node 或镜像仓库。
同一分支的工作流串行执行，不中断正在执行的迁移。PR 不使用生产凭据或部署。
当前流水线支持 `linux/amd64`；ARM 服务器需先调整 runner/build 配置，不能直接启用。

### 服务器准备（一次）

先确认当前生产 Compose 项目名为 `nb-hub-prod`；已有服务采用其他项目名时，需要先
核对数据库/文件卷迁移方案，避免启动一套空环境。部署用户需要访问 Docker，主机需
提供 Bash、Docker Compose v2、curl、gzip、tar 和 flock。安全组及 SSH 配置需允许
GitHub runner 连接指定 SSH 端口，对外应用只开放已有 80/443。

部署根目录示例为 `/opt/nb-hub`。CI 的配置来源统一为 GitHub production 环境的
`PRODUCTION_ENV` Secret，内容是完整的、shell 兼容的生产 `.env.production`。
部署通过 SSH 标准输入单独传输配置，不进入镜像、发布归档或命令参数；服务器
校验后原子写入 `/opt/nb-hub/.env.production`，权限为 600。
首次部署可直接从 Secret 生成文件，不再要求预先在服务器创建配置。
已有生产环境迁移时必须保留原数据库密码、JWT 密钥及数据卷，不能重新随机生成。
不要上传 `.env.development`。
启用静态托管时，内容通配证书继续放在根目录的 `deploy/content-tls/`。

为 CI 使用一把专用 SSH 密钥，将公钥加入部署用户的 `authorized_keys`；私钥保存到
GitHub Secrets，不提交仓库或发送到聊天。通过可信连接取得并核对服务器 SSH host key，
保存完整 known_hosts 行，非 22 端口使用 `[hostname]:port` 格式。

### GitHub 配置

仓库 Settings → Environments 创建 `production`。可将部署分支限制为 main。
在该环境的 Secrets（或仓库 Actions Secrets）添加：

| Secret               | 内容                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `DEPLOY_HOST`        | 服务器公网 IPv4 或 SSH 域名，不含协议                              |
| `DEPLOY_USER`        | SSH 用户名                                                         |
| `DEPLOY_PORT`        | SSH 端口，空值默认为 22                                            |
| `DEPLOY_SSH_KEY`     | 专用私钥全文，无交互口令                                           |
| `DEPLOY_KNOWN_HOSTS` | 已核对的服务器 known_hosts 行                                      |
| `PRODUCTION_ENV`     | 完整生产配置，包含 DOMAIN、数据库密码、JWT、SMTP、登录和站点配置等 |

在仓库 Settings → Secrets and variables → Actions → Variables 添加：

| Variable          | 内容                                             |
| ----------------- | ------------------------------------------------ |
| `DEPLOY_DIR`      | 服务器绝对部署目录，例如 `/opt/nb-hub`，不含空格 |
| `DEPLOY_PLATFORM` | `linux/amd64`，必须与服务器和生产配置一致        |
| `DEPLOY_ENABLED`  | 初始设为 `false`，准备完毕后改为 `true`          |

`DEPLOY_ENABLED` 必须是仓库级变量，工作流在进入 production 环境前读取它。
SSH host key 强制校验；不会采用跳过校验的连接方式。
将工作流提交并推送后，可在 Actions → CI / CD → Run workflow 选择 main 进行首次部署。
启用后的 main 推送会自动部署。

### 发布行为与运维

每次发布使用独立镜像标签 `<commit-sha>-<run-id>-<attempt>`。服务器的目录为：

```text
/opt/nb-hub/
  .env.production                 # 部署从 GitHub Secret 生成的运行配置
  deploy/content-tls/             # 可选内容域名证书
  releases/<release-id>/           # Compose、Caddy 配置及 images.env
  current -> releases/<release-id> # 最近一次通过检查的发布
```

数据库及站点数据继续使用 `nb-hub-prod` 的固定命名卷，不放入 release 目录。
迁移失败会停止替换应用。应用启动或 HTTPS 检查失败会将工作流标为失败，不会自动
回滚数据库；`current` 仅记录最近成功的发布，故障时仍应检查实际运行的容器。
单机重建 Caddy 时可能短暂中断连接，不承诺零停机。

成功后删除传输的镜像压缩包，保留已导入镜像和历史配置供手动回滚。
不会全局执行 docker prune，也不会删除数据库卷。按实际磁盘占用清理确认不用的
历史发布和对应 nb-hub 镜像。

CI 部署后的手动操作需要同时加载生产配置与该版本的镜像配置。例如：

```bash
cd /opt/nb-hub
docker compose --env-file .env.production --env-file current/images.env \
  -f current/docker-compose.production.yml ps -a
```

启用了内容域名时再加 `-f current/docker-compose.sites.yml`。
手动回滚应用使用旧 release 的 Compose 和 images.env，确认与当前配置及数据库兼容后再
启动；不自动执行 down 迁移。原先在完整仓库中进行的 `make prod-*` 手动部署流程
保持独立，不能混用旧的 `:local` 标签覆盖 CI 版本。

工作流及部署脚本验证：

```bash
node --test scripts/deploy-production.test.mjs
bash -n scripts/deploy-production.sh
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7 .github/workflows/ci-cd.yml
```

### 复用服务器上已有的 Caddy

已有应用占用 80/443 时，在服务器 `.env.production` 设置
`NB_HUB_PROXY_MODE=external`。发布脚本会叠加 `docker-compose.external-proxy.yml`，
API/Web 分别只绑定 `127.0.0.1:18081` 和 `127.0.0.1:18080`，不启动 Caddy 容器。
可将 `deploy/Caddyfile.host` 中的站点块导入宿主机现有 Caddyfile，先验证配置再 reload。
该配置目前对应 `hub.hjxgogogo.me`，旧站域名及已有路由保持独立。

外部代理模式下，手动 Compose 命令需叠加
`-f current/docker-compose.external-proxy.yml`；不要直接启动默认 proxy 服务。
如果后续启用内容域名，也需在宿主机 Caddy 单独配置内容域名到 API 的路由及证书。

发布包同时包含 PostgreSQL/Caddy 基础镜像，避免阿里云服务器直连 Docker Hub
失败影响首次上线。SSH 的专用 CI 密钥仅用于此部署，原有运维私钥不上传 GitHub。

### 更新生产配置

在仓库 Settings → Environments → production → Environment secrets 更新
`PRODUCTION_ENV`，保留未修改的配置行，然后手动运行 main 的 CI / CD 工作流。
Secret 保存后不会自动触发运行。SMTP 等参数在下次部署时写入服务器并使对应容器重建。
直接修改服务器文件仅会临时生效，后续部署会按 Secret 覆盖。

缺失或空的 `PRODUCTION_ENV` 会阻止部署，不会回退到旧配置继续报告成功。
配置写入前必须包含域名、数据库密码、JWT 密钥并通过 Compose 校验。
数据库密码更新还需要单独修改 PostgreSQL 中已有角色的密码；修改 Secret 不能
自动更改持久化数据库里的密码。JWT 密钥变更会使现有登录会话令牌失效。

阿里云邮件推送杭州地域可使用 `SMTP_HOST=smtpdm.aliyun.com`、`SMTP_PORT=80`，
应用会强制升级 STARTTLS 并校验 TLS 证书。用户名和发件地址均使用完整的已验证
发信地址，SMTP 密码写入 `PRODUCTION_ENV` 的 `SMTP_PASSWORD`。
端口与地域说明见[阿里云 SMTP 文档](https://help.aliyun.com/zh/direct-mail/smtp-endpoints)。
