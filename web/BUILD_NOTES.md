# 前端依赖与构建

交付包未携带 `node_modules`，避免把原 Windows 原生依赖打进压缩包并降低体积。

在 Windows PowerShell 中执行：

```powershell
cd web
npm install
npm run build
```

日常开发可直接运行：

```powershell
npm run dev
```

旧 `dist` 已从交付包移除，防止误用未包含本次材料风险页面的历史构建产物。
