# 材料风险域优化说明

## 1. 优化目标

本版本将项目划分为两个互不混用的风险域：

- **材料风险域**：只读取 `PRODUCT_CATALOG_V1` 中已审核的材料、材料属性、危险分类和证据。
- **产线 HAZOP 域**：继续只读取 `HAZOP_DA_H_R_V1`，表达产线、工序、偏差、原因、后果和措施。

材料风险链不会补造“未知工序”，也不会调用 HAZOP 场景作为推断依据。两类风险仅复用图谱渲染、检索和证据展示组件。

## 2. 页面变化

顶部导航调整为：

1. 项目总览
2. 材料资料
3. 材料风险链
4. 产线 HAZOP

“材料风险链”页面提供：

- 材料总数、可形成风险链材料数、事实链数、推断链数；
- 事实链/推断链筛选；
- 摩擦、撞击、静电、火焰、异常受热、安定性边界筛选；
- 全局风险链投影和单链聚焦；
- 原始属性、来源文档、表格行、证据原文；
- 规则编号、规则版本、置信度和人工审核提示。

图中**实线**表示入库事实，**虚线**表示系统推断。

## 3. 材料风险链语义

### 3.1 事实链

事实链只复述资料中明确存在的属性：

```text
材料 -> 原文事实 -> 材料属性 -> 来源证据
```

字段：

- `chainType = FACT`
- `evidenceLevel = explicit_fact`
- `reviewStatus = accepted_fact`

### 3.2 推断链

推断链基于事实属性和版本化规则形成：

```text
材料 -> 风险主题 -> 事实属性 --规则推断--> 触发条件 -> 可能后果
                            \-> 生成规则
```

字段：

- `chainType = INFERRED`
- `evidenceLevel = rule_inference`
- `riskDomain = material`
- `ruleId`、`ruleVersion`、`confidence`
- `reviewStatus = system_generated`

推断结果不覆盖原始事实，也不等同于人工审核结论。

## 4. 当前规则

| 规则 | 命中属性 | 触发条件 | 可能后果 |
|---|---|---|---|
| MR-FRICTION-001 | 摩擦感度、摩擦发火/爆炸 | 摩擦或剪切刺激 | 意外发火；燃烧或爆炸 |
| MR-IMPACT-001 | 撞击/冲击感度、落锤、落高 | 撞击或冲击刺激 | 意外发火；燃烧或爆炸 |
| MR-ELECTROSTATIC-001 | 静电感度、静电火花/放电 | 静电放电 | 点火；燃烧或爆炸 |
| MR-FLAME-001 | 火焰/明火/点火感度 | 明火或高温火焰 | 点火；燃烧或爆炸 |
| MR-THERMAL-001 | 爆发点、分解温度、热分解、自燃点 | 异常受热 | 热分解；燃烧或爆炸 |
| MR-STABILITY-001 | 安定性及相关试验 | 超出温度或时间边界 | 热稳定性下降；分解、燃烧或爆炸 |

普通性能参数（例如爆速、密度、威力）不会单独生成事故风险链。

## 5. 后端接口

- `GET /material-risk/status`
- `GET /material-risk/chains`
- `GET /material-risk/material/:materialId`
- `GET /graph/material-risk-chains`
- `GET /graph/material-risk-chain/:chainId`

材料接口严格使用：

```text
dataset_id = PRODUCT_CATALOG_V1
或 product_catalog_dataset_id = PRODUCT_CATALOG_V1
```

HAZOP 服务仍严格使用：

```text
dataset_id = HAZOP_DA_H_R_V1
```

## 6. 运行方式（Windows PowerShell）

公开代码仓库的运行方式以根目录 `README.md` 为准。后端不会自动读取 `.env`，请使用 `node --env-file=.env index.js` 显式加载，或预先设置系统环境变量。

以下一键脚本仅用于原作者电脑，已从公开仓库排除。原本地目录中，确保 Neo4j 已启动并设置进程环境变量后可运行：

```powershell
.\start-all.ps1
```

也可分别启动：

```powershell
cd server
npm install
node --env-file=.env index.js

cd ..\web
npm install
npm run dev
```

打开 Vite 输出的本地地址，一般为 `http://localhost:5173`。

静态部署前重新构建：

```powershell
cd web
npm install
npm run build
```

## 7. 验证命令

```powershell
node --test server/test/*.test.js
node --test web/test/*.test.mjs
```

本版本验证基线：后端 34 项测试通过，前端 14 项测试通过。


## v1.1 修正：推断解释、分类口径与图谱稳定性

- 材料风险规则升级到 1.1.0，接口返回 `reasoning` 与 `priorityBasis`，说明规则命中、机理路径和适用边界。
- “风险等级”改为“链路关注等级”，避免误解为事故概率或定量严重度。
- 项目总览分开显示“原文危险货物分类”和“材料风险特征分类”。当前数据中只有来源明确给出的分类会进入前者，后者由材料属性规则识别，二者不混用。
- 单材料图谱在服务端聚合重复节点/关系，并在前端构造 vis-network DataSet 前再次去重，修复 `Cannot add item: item with id ... already exists`。
