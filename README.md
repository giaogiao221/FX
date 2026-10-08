# FX

风险可视化（Neo4j Graph UI）。

基于 React、Express 和 Neo4j 的风险知识图谱可视化项目，包含材料资料、材料风险链、产线 HAZOP、标准规则查询和证据追溯。

本仓库包含应用源码、业务 CSV/TSV、分子结构映射与 SVG、两套 Neo4j 5.25.1 业务数据库快照、原 Windows 运维脚本和完整恢复流程。数据库快照直接随 Git 下载，无需 Git LFS 或另行索取数据。账号库和真实密码不公开，复现时建立新账号。

## 完整复现（推荐）

安装 Docker Desktop / Docker Engine 和 Compose v2，从仓库根目录执行：

Windows 可以双击 `run-fx.cmd`；首次运行会生成两个随机本地数据库密码并写入 Git 忽略的 `.env`，随后启动整套系统。原电脑已有的 Neo4j 安装也可以通过 `run-local.cmd` 启动。请不要通过双击 `start-all.ps1` 启动：Windows 可能将 `.ps1` 关联到编辑器，或在打开前显示权限错误。

```powershell
Copy-Item .env.example .env
# 编辑 .env，设置两套数据库的新本地密码
docker compose up -d --build --wait --wait-timeout 300
```

Linux / macOS 使用 `cp .env.example .env`。启动完成后打开 **http://localhost:8080**。首次运行需要联网下载固定版本运行时镜像和 npm 依赖。

**逐步运行说明、数据基线、手动恢复、故障排查：[REPRODUCE.md](REPRODUCE.md)。**

Compose 会自动校验并恢复两套快照，使用独立数据卷，前端通过同源 `/api` 调用后端。默认端口避开原 Windows 开发实例。后续启动保留复现卷中的数据，不重复导入。

## 功能与架构

- **材料资料**：检索材料、查看属性与来源证据，展示本地审核后的分子结构。
- **材料风险链**：分别展示原文事实和规则推断，支持风险主题筛选及单链聚焦。
- **产线 HAZOP**：查看工序、偏差、原因、后果和措施。
- **标准规则**：从独立 Neo4j 实例读取标准规则及其关系。
- **图谱交互**：通过 vis-network 展示图谱、邻域和证据链。

浏览器前端通过 HTTP 调用 Express API，由后端连接两个 Neo4j 实例。数据库密码只放在后端。

| 组件 | 技术 / 默认本地地址 |
| --- | --- |
| 前端 | React 19、Vite 7、vis-network；`http://localhost:5173` |
| 后端 | Node.js、Express 5、neo4j-driver 6；`http://localhost:3001` |
| 材料 / HAZOP 数据库 | Neo4j；`bolt://localhost:7687` |
| 标准规则数据库 | 独立 Neo4j 实例；示例配置为 `bolt://localhost:7689` |

## 目录

```text
.
├── server/                 # API、领域服务、导入和推断脚本、测试
├── web/                    # 前端源码、配置、公共资源、测试
├── database/               # 双库快照、原始导入资料、恢复/运维/Cypher 脚本
├── data/                   # 业务事实、风险规则、结构映射
├── docs/                   # 实现说明、结构库说明、发布指南
├── MATERIAL_RISK_OPTIMIZATION.md
├── LICENSE-NOTICE.md        # 现有许可声明与项目授权状态
├── compose.yaml            # 双库、后端、前端的完整复现环境
├── REPRODUCE.md             # 完整复现指南
└── README.md
```

## 本地开发

### 1. 安装依赖

以下命令从仓库根目录执行。建议使用 Node.js 22.12 或更高的 22.x 版本与 npm；本项目本次整理使用 Node.js 22.22.0。现有数据库脚本以 Neo4j 5.25.1 为背景，未验证所有其他版本。

```powershell
npm ci --prefix server
npm ci --prefix web
```

`server` 和 `web` 分别维护锁文件，不是 npm workspace。根目录的历史 `package.json` / 锁文件保留供追溯，启动应用不需要在根目录额外安装那组依赖。

### 2. 配置数据库与环境变量

按 [完整复现指南](REPRODUCE.md) 第 6 节把快照恢复到两个独立数据库并启动。在全新克隆的仓库中复制开发配置示例：

```powershell
Copy-Item server/.env.example server/.env
Copy-Item web/.env.example web/.env
```

已有 `.env` 时直接编辑，不要覆盖自己的配置。填写 `server/.env` 中两组数据库地址、用户和密码。

必须显式设置 `NEO4J_STANDARD_URI`：原后端代码的回退值为 `7688`，本仓库示例使用 `7689`，避免连接到其他本地实例。端口应与你实际启动的独立数据库一致。

前端 `.env` 只配置 `VITE_API_BASE_URL`。`VITE_` 变量会进入浏览器代码，不能包含密码或其他凭据。

### 3. 分别启动后端和前端

在第一个终端中：

```powershell
cd server
node --env-file=.env index.js
```

在第二个终端中，从仓库根目录执行：

```powershell
npm run dev --prefix web
```

打开终端显示的前端地址。后端本身不会自动读取 `.env`；上述命令通过 Node.js 显式加载。如果选择 `npm start --prefix server`，需要先在该进程的环境中设置全部数据库变量。

### 4. 数据与原始导入资料

参见 [数据约定](data/README.md)、[风险图谱实现说明](docs/risk-graph-implementation.md) 和 [结构库说明](docs/structure-library.md)。

材料服务使用 `PRODUCT_CATALOG_V1`，HAZOP 服务使用 `HAZOP_DA_H_R_V1`；标准规则来自独立实例。`database/snapshots/material/neo4j.dump` 和 `database/snapshots/standard/neo4j.dump` 保存两套完整业务数据库状态；`database/imports/` 保留原始导入资料。完整复现直接恢复快照，不需要重跑历史导入流程。

`database/*.cypher` 包含诊断、校验及修复操作，并非统一的全新数据库初始化流程。按实际数据结构选用，修复脚本会写入数据库。

## 测试与构建

从仓库根目录执行：

```powershell
node --test server/test/*.test.js web/test/*.test.mjs
npm run build --prefix web
```

单元测试覆盖领域逻辑、查询结构、前后端接线和快照校验。前端构建输出到 `web/dist/`，不会提交到仓库。真实恢复后的接口基线通过 `node server/scripts/verify-reproduction.js http://localhost:8080/api` 验证。

## 公开范围与授权

`.gitignore` 仍排除依赖目录、构建产物、真实环境配置、历史备份及内部计划。业务数据、42 个结构 SVG、两套经校验的业务快照和本机 PowerShell 运维脚本现已纳入仓库。完整复现入口为 Compose；原本机脚本保留原路径假设，其他电脑需调整后使用。

本项目提供本地复现环境，不部署公网服务。公开仓库不自动决定项目许可证，现有声明和授权状态见 [LICENSE-NOTICE.md](LICENSE-NOTICE.md)。

发布步骤见 [docs/PUBLISHING.md](docs/PUBLISHING.md)。
