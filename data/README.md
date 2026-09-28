# 本地数据约定

此目录只公开本说明，以下业务文件由使用者在本地提供，已通过根目录 `.gitignore` 排除：

| 文件 | 使用位置 / 用途 |
| --- | --- |
| `extracted_facts.csv` | `server/scripts/risk-graph.js` 的事实导入输入 |
| `risk_rules.tsv` | 规则导入、预测链路生成及后端 `/risk/infer` 所需输入 |
| `material_structure_mapping.json` | 后端结构库映射，关联材料 ID、审核状态和结构 SVG |

CSV / TSV 解析逻辑以 `server/scripts/risk-graph.js` 为准。结构映射格式可参考 `server/test/structure-store.test.js` 中独立构造的测试对象；测试对象不是实际业务数据集。

结构 SVG 放到 `web/public/structures/`，映射中的路径形如 `/structures/<filename>.svg`。映射里的材料 ID 应与自己的 Neo4j 数据一致。缺少映射时，结构服务返回不可用状态。

完整材料 / HAZOP 数据库和标准规则数据库不在仓库中。仅有上述文件并不保证能重建所有页面依赖的数据；尤其不包含原标准库导入包的 `01_entities.csv`、`02_relations.csv` 和 manifest。

已有授权数据且需要执行旧风险图谱导入或推断时，在 `server` 目录显式加载环境配置：

```powershell
node --env-file=.env scripts/risk-graph.js import-facts --file ../data/extracted_facts.csv
node --env-file=.env scripts/risk-graph.js import-facts --file ../data/risk_rules.tsv
node --env-file=.env scripts/risk-graph.js infer --rules ../data/risk_rules.tsv
node --env-file=.env scripts/risk-graph.js status
```

导入和推断会写入所配置的数据库。当前不提供演示数据，也不将现有真实数据伪装成示例数据。
