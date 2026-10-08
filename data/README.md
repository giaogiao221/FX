# 业务数据约定

此目录公开以下真实业务文件，配合两套数据库快照和结构 SVG 使用：

| 文件 | 使用位置 / 用途 |
| --- | --- |
| `extracted_facts.csv` | `server/scripts/risk-graph.js` 的事实导入输入 |
| `risk_rules.tsv` | 规则导入、预测链路生成及后端 `/risk/infer` 所需输入 |
| `material_structure_mapping.json` | 后端结构库映射，关联材料 ID、审核状态和结构 SVG |

CSV / TSV 解析逻辑以 `server/scripts/risk-graph.js` 为准。结构映射格式可参考 `server/test/structure-store.test.js` 中独立构造的测试对象；测试对象不是实际业务数据集。

结构 SVG 放到 `web/public/structures/`，映射中的路径形如 `/structures/<filename>.svg`。映射里的材料 ID 应与自己的 Neo4j 数据一致。缺少映射时，结构服务返回不可用状态。

完整材料 / HAZOP 数据库和标准规则数据库快照位于 `database/snapshots/`，原始导入资料位于 `database/imports/`。其中 `standard/gb50089_accepted_graph_v1/` 包含原标准库导入包及 manifest。导入资料记录历史阶段，不保证单独重跑某个导入脚本就等同于最终快照；完整复现以 [REPRODUCE.md](../REPRODUCE.md) 的快照恢复流程为准。

已有授权数据且需要执行旧风险图谱导入或推断时，在 `server` 目录显式加载环境配置：

```powershell
node --env-file=.env scripts/risk-graph.js import-facts --file ../data/extracted_facts.csv
node --env-file=.env scripts/risk-graph.js import-facts --file ../data/risk_rules.tsv
node --env-file=.env scripts/risk-graph.js infer --rules ../data/risk_rules.tsv
node --env-file=.env scripts/risk-graph.js status
```

导入和推断会写入所配置的数据库。已从快照恢复的实例无需重复执行这些命令；只有要更新业务图谱时才执行。此处是真实项目数据，不是人工构造的示例数据。
