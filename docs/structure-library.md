# 本地分子结构库

公开代码仓库不包含真实结构映射和生成 SVG；以下文件由使用者自行提供。相关目录仅发布说明文件，已有本地业务文件不会被删除。

风险辨识预测系统运行时只读取以下本地文件：

- `data/material_structure_mapping.json`
- `web/public/structures/*.svg`

运行阶段不联网，也不调用 RDKit。

## 数据更新流程

1. 在抽取工程的 `structure_pipeline/data` 中维护审核表；
2. 使用 RDKit 离线校验已审核 SMILES 并生成 SVG；
3. 将映射 JSON 和 SVG 部署到 `kg-app`；
4. 重启前后端；
5. 在单材料页面检查纯化合物、混合物、无结构三种状态。

## 审核约束

- 分子式只用于一致性校验，不能推断唯一 SMILES；
- 只有 `review_status=approved` 的记录可以展示；
- 混合物只能展示已审核主要组分，不生成虚假的整体分子结构；
- 聚合物只能展示已审核重复单元，并必须明确标注；
- 冲突、待审核、非法 SMILES 均不进入运行时结构库。

## 本地接口

- `GET /structure/status`：返回结构映射状态和可用物料数量；
- `GET /structure/material/:materialId`：按 Neo4j 稳定物料 ID 返回结构数据。
