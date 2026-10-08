# 完整复现指南

本版本包含应用代码、业务数据、42 个分子结构 SVG、两套 Neo4j 5.25.1 业务数据库的原生快照和原 Windows 运维脚本。完整复现优先使用 Docker Compose，不要求在电脑上预装 Neo4j、Java、Node.js，也不要求原作者的磁盘路径。

## 1. 环境要求

- Git，或从 GitHub 的 Code → Download ZIP 下载并解压。
- Docker Engine / Docker Desktop，启用 Linux containers，带 Docker Compose v2（支持 `up --wait`）。
- 首次运行需要联网下载官方容器镜像和 npm 依赖；建议为 Docker 分配至少 4 GB 内存及 3 GB 可用磁盘。
- 以下命令在包含 `compose.yaml` 的仓库根目录执行。

```powershell
git clone https://github.com/giaogiao221/FX.git
cd FX
```

## 2. 配置复现环境

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

也可以直接双击仓库根目录的 `run-fx.cmd`：首次运行自动生成随机本地数据库密码并存入 `.env`，接着构建并启动全部服务。此入口用于全新复现。`run-local.cmd` 是原作者电脑上调用 `start-all.ps1` 的入口，依赖已有的 `F:\graph` Neo4j 安装。

在资源管理器中直接双击 `.ps1` 不会可靠运行脚本。Windows 的文件关联可能把它交给编辑器，或在启动前报“无法访问指定设备、路径或文件”。需手动运行原脚本时，在项目目录打开 PowerShell，执行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-all.ps1`；这只影响该 PowerShell 进程的执行策略。

Linux / macOS：

```bash
cp .env.example .env
```

编辑根目录 `.env`，为 `FX_NEO4J_PASSWORD`、`FX_STANDARD_PASSWORD` 分别设置至少 8 位的新本地密码。示例值仅用于本地演示，不是原数据库密码。不要覆盖已有配置，不要提交 `.env`。

此配置只供 Compose 使用，与 `server/.env`、`web/.env` 相互独立。发布包未包含原 `system` 数据库、用户、密码或认证文件；新实例首次启动会创建自己的账号。

## 3. 一条命令恢复并启动

```powershell
docker compose up -d --build --wait --wait-timeout 300
```

此命令依次执行：校验两个快照 SHA-256 → 恢复到两个独立空数据卷 → 启动两个 Neo4j → 安装锁定依赖并构建后端与前端 → 检查服务健康。

| 服务 | 本地地址 / 端口 |
| --- | --- |
| 前端完整应用 | **http://localhost:8080** |
| 前端同源 API | http://localhost:8080/api/health |
| 后端 API | http://localhost:13001 |
| 材料 / HAZOP Bolt | bolt://localhost:17687 |
| 标准规则 Bolt | bolt://localhost:17689 |

所有宿主机映射只绑定 `127.0.0.1`。端口冲突时修改根目录 `.env` 的 `FX_*_PORT`。前端通过 `/api` 反向代理后端，改变网页端口无需重新填写前端 API 地址。

`material-init` 和 `standard-init` 完成后显示 `Exited (0)` 是正常现象；它们是一次性恢复任务。再次启动时保留已初始化的数据，不重复导入、不覆盖用户更改。

## 4. 验证复现结果

```powershell
docker compose ps -a
docker compose exec server node --test test/*.test.js
```

如果主机已安装 Node.js 22，可校验快照和完整接口基线：

```powershell
node server/scripts/verify-snapshots.js
node server/scripts/verify-reproduction.js http://localhost:8080/api
node --test server/test/*.test.js web/test/*.test.mjs
```

主机没有 Node.js 时也可使用一次性 Node 容器（此命令从仓库根目录执行）：

```powershell
docker run --rm --mount "type=bind,source=$((Get-Location).Path),target=/workspace,readonly" -w /workspace node:22.22.0-bookworm-slim node server/scripts/verify-snapshots.js
```

初始快照的业务基线：

| 指标 | 数量 |
| --- | ---: |
| 材料 | 224 |
| 可形成风险链的材料 | 77 |
| 事实链 / 推断链 | 307 / 307 |
| HAZOP 节点 / 产线 / 工序 / 场景 | 1670 / 3 / 12 / 307 |
| 标准规则 | 5123 |
| 可用结构映射 | 132 |
| SVG 文件 | 42 |

结构映射数不等于 SVG 数，多个材料可以引用共享组分结构。页面可检查“材料资料 → 单材料详情 / 结构”“材料风险链”“产线 HAZOP”“标准规则”。

`database/snapshots/expected-api.json` 保存导出后原服务的接口结果。快照是已有数据库的完整业务状态；旧 CSV 导入脚本可能只覆盖部分数据或历史阶段，因此**完整复现以快照恢复为准，不要把所有历史导入脚本重新执行一遍**。

## 5. 停止、重启与保留数据

```powershell
docker compose stop
docker compose start
# 移除容器和网络，但保留两个数据卷
docker compose down
```

需要从原快照彻底重新开始时，以下命令会删除**当前 Compose 项目**的两个数据库数据卷及在复现环境中的所有修改。确认不需要这些修改后才执行：

```powershell
docker compose down --volumes
docker compose up -d --build --wait --wait-timeout 300
```

如果启动时提示 existing database / snapshot marker 不匹配，不要覆盖未知数据库；先检查是否使用了原来的 Compose 项目名称、数据卷或不同版本快照。

## 6. 不使用 Docker 的手动恢复

准备两个独立、全新的 Neo4j Community **5.25.1** 安装目录及 Java 17。保持两个实例停止，分别执行（替换 `<...>` 为自己的路径）：

```powershell
& '<材料实例>/bin/neo4j-admin.bat' database load neo4j --from-path='<仓库>/database/snapshots/material'
& '<标准实例>/bin/neo4j-admin.bat' database load neo4j --from-path='<仓库>/database/snapshots/standard'
```

不要添加覆盖选项来覆盖已有实例。两个安装目录各自配置独立的 Bolt / HTTP 端口（例如 `7687/7474` 与 `7689/7476`），分别设置新的初始密码并启动。随后按根目录 README 的手动开发步骤安装前后端依赖，显式配置两套数据库地址。

原本机 `start-all.ps1`、`stop-all.ps1`、`database/*.ps1` 已公开供参考。它们保留原 Windows 路径、端口和运维假设，不属于跨平台快速复现入口；在其他电脑上使用前应修改相应路径。备份脚本需要先停库；创建标准实例脚本会复制安装目录。主复现流程无需执行这些脚本。

## 7. 常见问题

- **Docker Hub 连接超时**：检查 Docker Desktop 网络与代理，先运行 `docker pull neo4j:5.25.1-community`、`docker pull node:22.22.0-bookworm-slim`、`docker pull nginx:1.28.0-alpine`，然后重试启动。
- **密码修改后认证失败**：环境变量仅用于新实例初始化，不能修改已有数据卷中的密码。用旧密码登录修改，或明确放弃复现卷的修改后按第 5 节重置。
- **缺少快照 / 校验失败**：重新下载完整仓库；本仓库直接保存 `.dump`，不需要 Git LFS 或另行索取数据。
- **页面空白或 API 错误**：运行 `docker compose logs --tail=100 server material standard web`，先确认两个数据库及后端健康。不要误连原电脑上其他 Neo4j 实例。
- **不能离线首次安装**：仓库包含复现所需代码和业务数据，第三方运行时及 npm 依赖仍需首次联网下载。

原生快照恢复方式参考 [Neo4j 官方 dump](https://neo4j.com/docs/operations-manual/current/backup-restore/offline-backup/) 和 [load](https://neo4j.com/docs/operations-manual/current/backup-restore/restore-dump/) 文档。实际使用的版本固定为 5.25.1，两个恢复卷与原本机实例独立。
