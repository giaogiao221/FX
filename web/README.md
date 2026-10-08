# 图谱前端

React + Vite 前端，提供材料资料、材料风险链、HAZOP、标准规则和图谱交互页面。

完整安装、数据库配置和运行说明见 [根目录 README](../README.md)。

在本目录运行：

```powershell
npm ci
# 首次配置时复制；已有 .env 时保留现有文件
Copy-Item .env.example .env
npm run dev
```

通过 `VITE_API_BASE_URL` 设置后端地址，默认 `http://localhost:3001`。不得在前端配置中保存数据库密码。

```powershell
npm run build
node --test test/*.test.mjs
```

`public/structures/` 中的 42 个真实结构 SVG 已随源码发布。完整前后端与双库复现见 [REPRODUCE.md](../REPRODUCE.md)。构建产物 `dist/` 和依赖 `node_modules/` 不提交到仓库。
