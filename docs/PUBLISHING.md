# 发布代码仓库

仓库根目录是 `kg-app`。公开源码、测试、运行说明、业务数据、分子结构资源、两套业务数据库快照、原始导入资料及本机运维脚本，支持本地完整复现，不部署公网服务。

## 已排除的本地内容

- 各层级 `node_modules`、`dist`、日志和缓存。
- `.env`、`.env.*`（保留 `.env.example`）、本地 npm 配置及密钥文件。
- `backup_*`、临时数据库 dump、压缩包和旧补丁。仅 `database/snapshots/material/neo4j.dump` 与 `standard/neo4j.dump` 两个正式业务快照允许入库。
- `docs/superpowers/` 内部开发记录和编码异常的历史说明文件。
- 原 Neo4j `system` 数据库、认证文件、运行目录、日志和真实密码不进入仓库。复现使用新建账号。

不要使用 `git add -f` 强行加入上述内容。`.gitignore` 不会清除已提交的文件或历史秘密；未来若误提交敏感信息，需要单独处理历史和凭据。

## 发布前验证

从仓库根目录执行：

```powershell
git status --short
git diff --cached --stat
git -c core.whitespace=cr-at-eol diff --cached --check -- . ':(exclude)database/imports/**'
node --test server/test/*.test.js web/test/*.test.mjs
npm run build --prefix web
```

待提交清单应包含根目录和前后端 `.env.example`、业务 CSV/TSV/JSON、结构 SVG、两个正式快照及校验文件，不应有真实 `.env`、账号库、历史备份或依赖目录。`database/imports/` 保留来源 CSV/JSONL 的原始字节以匹配其 SHA-256 manifest，少数来源记录末尾本来含空格，因此上面的通用排版检查不改写该目录。发布前执行 `node server/scripts/verify-snapshots.js`，并在空 Compose 数据卷上按 `REPRODUCE.md` 验证恢复及接口基线。

本次整理没有替权利人选择统一开源许可证。发布前阅读 `LICENSE-NOTICE.md`，按实际权属决定是否添加 `LICENSE`；公开可见与授予统一开源许可是不同事项。

## 首次提交与推送

如果尚未初始化 Git，先执行 `git init -b main`。本地整理可能已完成初始化及暂存，可通过 `git status` 确认。

```powershell
git add .
git diff --cached --stat
git commit -m "Prepare source repository for public release"
```

若 Git 提示身份未配置，设置本仓库实际作者的 `user.name` 和 `user.email` 后再提交。不要使用虚构身份。

在 GitHub 创建 Public 空仓库，不在网页上额外生成 README、忽略文件或许可证。将下面地址替换为自己的真实仓库地址：

```powershell
git remote add origin https://github.com/YOUR_ACCOUNT/neo4j-graph-ui.git
git push -u origin main
```

如果已有 `origin`，先用 `git remote -v` 核对地址，勿重复添加或盲目覆盖。此流程也适用于其他 Git 托管平台，只需换成相应仓库地址。

参考：[GitHub 官方本地代码导入说明](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。
