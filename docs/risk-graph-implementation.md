# 预测风险图谱实现说明

本版本在原有实体图谱上增加了“规则层 + 桥接层 + 预测链路层”。

> 公开仓库说明：本文记录原实现，文中的路径以旧上级目录为基准。公开仓库根目录已经是 `kg-app`。业务 CSV/TSV 不随代码发布；下方 `npm run` 命令需要预先设置数据库环境变量，并不会自动加载 `.env`。使用 `.env` 的完整命令见 [数据约定](../data/README.md)，通用启动方式见 [README](../README.md)。

## 1. 新增内容

### 后端脚本

位置：`kg-app/server/scripts/risk-graph.js`

支持命令：

```powershell
cd kg-app\server

npm run import:facts
npm run import:rules
npm run risk:infer
npm run risk:status
```

也可以指定文件：

```powershell
node scripts/risk-graph.js import-facts --file ..\data\extracted_facts.csv
node scripts/risk-graph.js import-facts --file ..\data\risk_rules.tsv
node scripts/risk-graph.js infer --rules ..\data\risk_rules.tsv
```

### 后端接口

新增：

```text
GET /risk/stats
GET /graph/risk-chains?chainLimit=200&edgeLimit=2500
```

前端“预测链路”按钮会调用 `/graph/risk-chains`。

### 前端视图

图谱视图增加：

```text
全图
预测链路
当前实体一跳
```

预测链路模式只展示：

```text
PredictedRiskChain
Process
CanonicalMaterial
Stimulus
HazardFactor
RiskEvent
ControlMeasure
MonitorVariable
DangerZone
AreaRule
ProtectionRule
```

## 2. 新增图谱结构

新增节点：

```text
CanonicalMaterial       标准物料
Stimulus                刺激能量
DangerZone              F0/F1/F2 危险区域
ProtectionRule          防护等级规则
AreaRule                工序-危险区域规则
StimulusRule            设备动作-刺激规则
PredictedRiskChain      预测风险链路
```

新增关系：

```text
NORMALIZED_TO                 原始物料归一到标准物料
TRIGGERS_STIMULUS             危险因素或工序触发刺激能量
MATCHES_STIMULUS_RULE         匹配刺激规则
MATCHES_AREA_RULE             匹配危险区域规则
CANDIDATE_MATCHES_AREA_RULE   候选匹配区域规则
IN_PROCESS                    风险链所属工序
INVOLVES_MATERIAL             风险链涉及标准物料
HAS_HAZARD_FACTOR             风险链关联危险因素
TRIGGERED_BY                  风险链由刺激能量触发
PREDICTS                      风险链预测风险事件
MITIGATED_BY                  风险链对应控制措施
MONITORED_BY                  风险链对应监测变量
IN_DANGER_ZONE                风险链对应危险区域
SUPPORTED_BY_AREA_RULE        风险链由区域规则支撑
REQUIRES_PROTECTION           风险链要求防护等级
```

## 3. 推荐运行流程

如果你的 CSV / TSV 已经导入过 Neo4j，只需要执行：

```powershell
cd kg-app\server
npm run risk:infer
```

如果还没有导入，则执行：

```powershell
cd kg-app\server
npm run import:facts
npm run import:rules
npm run risk:infer
npm run risk:status
```

然后启动后端：

```powershell
node index.js
```

启动前端：

```powershell
cd ..\web
npm run dev
```

打开页面后，点击“预测链路”。

## 4. AP 映射说明

脚本中暂时把：

```text
氧化剂（AP） / AP -> 高氯酸铵
```

如果你们业务定义中 AP 不是高氯酸铵，请修改：

```text
kg-app/server/scripts/risk-graph.js
```

里的 `MATERIAL_ALIASES`。
