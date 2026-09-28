# FX

风险可视化（Neo4j Graph UI）。

基于 React、Express 和 Neo4j 的风险知识图谱可视化项目，包含材料资料、材料风险链、产线 HAZOP、标准规则查询和证据追溯。

本仓库公开应用源码、测试和 Cypher 脚本。业务数据、完整 Neo4j 数据库、生成的分子结构图及原作者电脑的运维脚本不随仓库发布。下载代码后可以运行单元测试、构建前端；完整业务展示需要自行准备相应数据库和数据文件。

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
├── database/               # Cypher 校验与修复脚本
├── data/README.md          # 本地数据约定（不含业务数据）
├── docs/                   # 实现说明、结构库说明、发布指南
├── MATERIAL_RISK_OPTIMIZATION.md
├── LICENSE-NOTICE.md        # 现有许可声明与项目授权状态
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

自行启动材料 / HAZOP 数据库和标准规则数据库。在全新克隆的仓库中复制配置示例：

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

### 4. 准备业务数据（完整展示需要）

参见 [数据约定](data/README.md)、[风险图谱实现说明](docs/risk-graph-implementation.md) 和 [结构库说明](docs/structure-library.md)。

材料服务使用 `PRODUCT_CATALOG_V1`，HAZOP 服务使用 `HAZOP_DA_H_R_V1`；标准规则来自独立实例。本仓库未提供这些完整数据集，也未提供能重建全部业务图谱的一键种子数据。空数据库可能显示空数据或查询错误，不代表已完成数据初始化。

`database/*.cypher` 包含诊断、校验及修复操作，并非统一的全新数据库初始化流程。按实际数据结构选用，修复脚本会写入数据库。

## 测试与构建

从仓库根目录执行：

```powershell
node --test server/test/*.test.js web/test/*.test.mjs
npm run build --prefix web
```

现有测试主要覆盖领域逻辑、查询结构和前后端接线，不依赖公开业务数据或正在运行的 Neo4j。前端构建输出到 `web/dist/`，不会提交到仓库。单元测试与构建通过不等同于真实数据库集成测试通过。

## 公开范围与授权

`.gitignore` 排除了依赖目录、构建产物、环境配置、原始业务数据、结构图、历史备份、内部计划和绑定原电脑的 PowerShell 运维脚本；这些文件可以继续保留在原电脑上使用。公开版本采用上面的手动启动方式。

本次整理仅准备代码仓库，不部署在线服务。公开仓库不自动决定项目许可证，现有声明和授权状态见 [LICENSE-NOTICE.md](LICENSE-NOTICE.md)。

发布步骤见 [docs/PUBLISHING.md](docs/PUBLISHING.md)。
