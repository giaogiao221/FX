#!/usr/bin/env node
/*
 * 风险预测图谱构建脚本
 *
 * 用法：
 *   node scripts/risk-graph.js import-facts --file ../data/extracted_facts.csv
 *   node scripts/risk-graph.js import-facts --file ../data/risk_rules.tsv
 *   node scripts/risk-graph.js infer --rules ../data/risk_rules.tsv
 *   node scripts/risk-graph.js status
 *
 * 连接配置：
 *   NEO4J_URI=bolt://localhost:7687
 *   NEO4J_USER=neo4j
 *   NEO4J_PASS=你的密码
 */

const fs = require("fs");
const path = require("path");
const neo4j = require("neo4j-driver");

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASS = process.env.NEO4J_PASS || "";

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASS),
  { disableLosslessIntegers: true }
);

const MATERIAL_ALIASES = [
  { alias: "多孔粒状硝酸铵", canonical: "硝酸铵", confidence: 0.98 },
  { alias: "硝酸铵", canonical: "硝酸铵", confidence: 1.0 },
  { alias: "氧化剂（AP）", canonical: "高氯酸铵", confidence: 0.75, note: "AP 通常按高氯酸铵处理，若业务定义不同请改此映射" },
  { alias: "氧化剂(AP)", canonical: "高氯酸铵", confidence: 0.75, note: "AP 通常按高氯酸铵处理，若业务定义不同请改此映射" },
  { alias: "AP", canonical: "高氯酸铵", confidence: 0.75, note: "AP 通常按高氯酸铵处理，若业务定义不同请改此映射" },
  { alias: "高氯酸铵", canonical: "高氯酸铵", confidence: 1.0 },
  { alias: "柴油", canonical: "柴油", confidence: 1.0 },
  { alias: "酸类物质", canonical: "酸类物质", confidence: 1.0 },
  { alias: "酸类", canonical: "酸类物质", confidence: 0.9 },
  { alias: "RDX", canonical: "RDX", confidence: 1.0 },
];

const STIMULUS_KEYWORDS = [
  { keyword: "摩擦", stimulus: "摩擦", confidence: 0.94 },
  { keyword: "撞击", stimulus: "撞击", confidence: 0.94 },
  { keyword: "冲击", stimulus: "撞击", confidence: 0.78 },
  { keyword: "静电火花", stimulus: "静电", confidence: 0.96 },
  { keyword: "静电", stimulus: "静电", confidence: 0.94 },
  { keyword: "加热", stimulus: "热刺激", confidence: 0.92 },
  { keyword: "热刺激", stimulus: "热刺激", confidence: 0.95 },
  { keyword: "温度", stimulus: "热刺激", confidence: 0.72 },
  { keyword: "热", stimulus: "热刺激", confidence: 0.7 },
];

const DEFAULT_STIMULUS_RULES = [
  { action: "搅拌", stimulus: "摩擦", part: "设备运动部位" },
  { action: "转动", stimulus: "摩擦", part: "设备运动部位" },
  { action: "切削", stimulus: "摩擦", part: "设备运动部位" },
  { action: "振动过筛", stimulus: "摩擦", part: "设备运动部位" },
  { action: "挤压", stimulus: "摩擦", part: "设备运动部位" },
  { action: "输送", stimulus: "摩擦", part: "设备运动部位" },
  { action: "下料", stimulus: "撞击", part: "设备运动部位" },
  { action: "机械手抓取", stimulus: "撞击", part: "设备运动部位" },
  { action: "机械手转运", stimulus: "撞击", part: "设备运动部位" },
  { action: "AGV转运", stimulus: "撞击", part: "设备运动部位" },
  { action: "搅拌", stimulus: "静电", part: "设备、管道、物料、环境" },
  { action: "转动", stimulus: "静电", part: "设备、管道、物料、环境" },
  { action: "切削", stimulus: "静电", part: "设备、管道、物料、环境" },
  { action: "振动过筛", stimulus: "静电", part: "设备、管道、物料、环境" },
  { action: "振动下料", stimulus: "静电", part: "设备、管道、物料、环境" },
  { action: "输送", stimulus: "静电", part: "设备、管道、物料、环境" },
  { action: "加热", stimulus: "热刺激", part: "设备、环境、工艺辅助系统" },
  { action: "低温", stimulus: "热刺激", part: "设备、环境、工艺辅助系统" },
  { action: "物料中气泡", stimulus: "其他刺激", part: "物料" },
];

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return fallback;
  return process.argv[idx + 1] || fallback;
}

function absFile(file) {
  if (!file) return null;
  return path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
}

function text(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function truthy(v) {
  const t = text(v).toLowerCase();
  return !!t && t !== "nan" && t !== "null" && t !== "undefined";
}

function cleanName(v) {
  return text(v).replace(/^"|"$/g, "").trim();
}

function parseJsonSafe(s) {
  const raw = text(s);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { raw };
  } catch {
    return { raw };
  }
}

function csvParse(content, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((x) => truthy(x))) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((x) => truthy(x))) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => text(h));
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? "";
    });
    return obj;
  });
}

function readTable(file) {
  const content = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const delimiter = file.toLowerCase().endsWith(".tsv") ? "\t" : ",";
  return csvParse(content, delimiter);
}

function labelForType(typeValue) {
  const t = cleanName(typeValue);
  const map = {
    Process: "Process",
    OperationStep: "OperationStep",
    Material: "Material",
    HazardFactor: "HazardFactor",
    RiskEvent: "RiskEvent",
    ControlMeasure: "ControlMeasure",
    MonitorVariable: "MonitorVariable",
    Parameter: "Parameter",
    Equipment: "Equipment",
    Personnel: "Personnel",
    RiskDimension: "RiskDimension",
    ManagementRule: "ManagementRule",
    EmergencyAction: "EmergencyAction",
    SafetyFacility: "SafetyFacility",
    "危险物料实例": "Material",
    "危险物料": "Material",
    "物料信息": "Material",
    "危险特性实例": "HazardCharacteristic",
    "危险源": "HazardFactor",
    "危险源实例": "HazardFactor",
    "风险因素实例": "HazardFactor",
    "类别概念": "RuleCategory",
    "位置部位实例": "OperationRule",
    "设备动作实例": "EquipmentAction",
    "风险对象实例": "RiskObject",
    "刺激能量形式": "Stimulus",
    "设备名称及选型": "Equipment",
    "涉及设备": "Equipment",
    "工序/岗位": "Process",
    "操作步骤": "OperationStep",
    "操作行为": "OperationAction",
    "电气危险区域": "DangerZone",
    "评估结果值": "Value",
    "状态实例": "State",
    "作业信息": "Process",
    "工艺设备": "Equipment",
    "其他": "Value",
  };
  return map[t] || "Entity";
}

function relTypeForName(nameValue) {
  const n = cleanName(nameValue);
  const map = {
    "包含操作步骤": "HAS_OPERATION_STEP",
    "需要人数": "REQUIRES_PERSONNEL",
    "涉及物料": "INVOLVES_MATERIAL",
    "涉及危险物料": "INVOLVES_MATERIAL",
    "设备名称及选型涉及物料": "INVOLVES_MATERIAL",
    "具有状态": "HAS_STATE",
    "处于状态": "HAS_STATE",
    "具有危险性质": "HAS_HAZARD_CHARACTERISTIC",
    "具有危险特性": "HAS_HAZARD_CHARACTERISTIC",
    "危险特性特征值": "HAS_HAZARD_VALUE",
    "存在危险因素": "HAS_HAZARD_FACTOR",
    "属于风险维度": "BELONGS_TO_RISK_DIMENSION",
    "可能导致": "MAY_CAUSE",
    "受控于": "CONTROLLED_BY",
    "需要监测": "REQUIRES_MONITOR",
    "参数索引": "HAS_PARAMETER",
    "触发应急处置": "TRIGGERS_EMERGENCY_ACTION",
    "需要审批": "REQUIRES_APPROVAL",
    "不相容对象": "INCOMPATIBLE_WITH",
    "涉及设备": "INVOLVES_EQUIPMENT",
    "执行动作": "HAS_ACTION",
    "危险区域": "HAS_DANGER_ZONE",
    "电气危险区域": "HAS_DANGER_ZONE",
    "危险工作间名称": "HAS_OPERATION_RULE",
    "分类条件": "HAS_CONDITION",
    "生产分类": "HAS_PRODUCTION_CATEGORY",
    "刺激能量形式": "HAS_STIMULUS",
    "可能产生部位": "MAY_OCCUR_AT",
    "刺激产生条件": "HAS_STIMULUS_CONDITION",
    "设备选型符合性": "HAS_EQUIPMENT_COMPLIANCE",
    "设备名称及选型": "HAS_EQUIPMENT_SELECTION",
    "电气设备保护级别": "REQUIRES_EPL",
    "外壳防护级别": "REQUIRES_IP",
  };
  return map[n] || "KG_REL";
}

function safeCypherIdentifier(s) {
  const t = text(s).replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(t) ? t : `_${t}`;
}

function entityKey(typeValue, nameValue) {
  const label = labelForType(typeValue);
  return `${label}|${cleanName(nameValue)}`;
}

function splitCondition(conditionText) {
  const condition = text(conditionText);
  const out = {};
  for (const part of condition.split(/[；;｜|]/)) {
    const [k, ...rest] = part.split("=");
    if (k && rest.length) out[text(k)] = text(rest.join("="));
  }
  return out;
}

function rowsToFacts(rows, sourceFile) {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const isScenarioCsv = headers.includes("主体实体") && headers.includes("关系");
  const isRuleTsv = headers.includes("主体名称") && headers.includes("关系/属性名称");
  if (!isScenarioCsv && !isRuleTsv) {
    throw new Error(`无法识别表头：${headers.join(", ")}`);
  }

  return rows.map((r, idx) => {
    if (isScenarioCsv) {
      const subjectName = cleanName(r["主体实体"]);
      const objectName = cleanName(r["尾实体"]);
      const subjectType = cleanName(r["主体类型"] || "Entity");
      const objectType = cleanName(r["尾实体类型"] || "Entity");
      return {
        fact_id: cleanName(r.fact_id) || `${path.basename(sourceFile)}#${idx + 1}`,
        subjectName,
        subjectType,
        subjectKey: entityKey(subjectType, subjectName),
        subjectLabel: labelForType(subjectType),
        subjectProps: parseJsonSafe(r["主体属性_JSON"]),
        relationName: cleanName(r["关系"]),
        relType: relTypeForName(r["关系"]),
        objectName,
        objectType,
        objectKey: entityKey(objectType, objectName),
        objectLabel: labelForType(objectType),
        objectProps: parseJsonSafe(r["尾实体属性_JSON"]),
        sourceDoc: cleanName(r["来源文档"]),
        sourceSection: cleanName(r["来源章节"]),
        evidence: cleanName(r["证据"]),
        confidence: Number(r["置信度"] || 0) || null,
        extractor: cleanName(r["抽取器"]),
        sourceFile: path.basename(sourceFile),
      };
    }

    const subjectName = cleanName(r["主体名称"]);
    const objectName = cleanName(r["尾实体/取值文本"]);
    const subjectType = cleanName(r["主体类型"] || "Entity");
    const objectType = cleanName(r["尾实体类型/属性类别"] || "Entity");
    return {
      fact_id: cleanName(r["文档ID"]) ? `${cleanName(r["文档ID"])}:${cleanName(r["来源定位"])}:${idx + 1}` : `${path.basename(sourceFile)}#${idx + 1}`,
      subjectName,
      subjectType,
      subjectKey: entityKey(subjectType, subjectName),
      subjectLabel: labelForType(subjectType),
      subjectProps: {},
      relationName: cleanName(r["关系/属性名称"]),
      relType: relTypeForName(r["关系/属性名称"]),
      objectName,
      objectType,
      objectKey: entityKey(objectType, objectName),
      objectLabel: labelForType(objectType),
      objectProps: {},
      sourceDoc: cleanName(r["文档ID"]),
      sourceSection: cleanName(r["章节路径"]),
      sourceLocation: cleanName(r["来源定位"]),
      evidence: cleanName(r["证据文本"]),
      conditionText: cleanName(r["条件文本"]),
      confidence: Number(r["置信度"] || 0) || null,
      extractor: cleanName(r["抽取来源"]),
      factType: cleanName(r["事实类型"]),
      sourceFile: path.basename(sourceFile),
    };
  }).filter((f) => truthy(f.subjectName) && truthy(f.objectName) && truthy(f.relationName));
}

function areaRulesFromRows(rows) {
  const rules = [];
  for (const r of rows) {
    if (cleanName(r["关系/属性名称"]) !== "危险区域") continue;
    const operation = cleanName(r["主体名称"]);
    const zone = cleanName(r["尾实体/取值文本"]);
    if (!operation || !/^F[012]/.test(zone)) continue;
    const c = splitCondition(r["条件文本"]);
    rules.push({
      rule_id: `${c["生产分类"] || "未指定生产分类"}|${c["分类条件"] || ""}|${operation}|${zone}`,
      category: c["生产分类"] || "未指定生产分类",
      condition: c["分类条件"] || "",
      operation,
      zone,
      evidence: cleanName(r["证据文本"]),
      sourceDoc: cleanName(r["文档ID"]),
      sourceSection: cleanName(r["章节路径"]),
      sourceLocation: cleanName(r["来源定位"]),
      extractor: cleanName(r["抽取来源"]),
      confidence: Number(r["置信度"] || 0) || 0.9,
    });
  }
  return rules;
}

function stimulusRulesFromRows(rows) {
  const map = new Map();
  for (const r of rows) {
    if (cleanName(r["关系/属性名称"]) !== "刺激能量形式") continue;
    const action = cleanName(r["主体名称"]);
    const stimulus = cleanName(r["尾实体/取值文本"]);
    if (!action || !stimulus) continue;
    const key = `${action}|${stimulus}`;
    map.set(key, {
      rule_id: key,
      action,
      stimulus,
      part: "",
      evidence: cleanName(r["证据文本"]),
      sourceDoc: cleanName(r["文档ID"]),
      sourceSection: cleanName(r["章节路径"]),
      sourceLocation: cleanName(r["来源定位"]),
      extractor: cleanName(r["抽取来源"]),
      confidence: Number(r["置信度"] || 0) || 0.9,
    });
  }
  return Array.from(map.values());
}

async function run(session, cypher, params = {}) {
  return session.run(cypher, params);
}

async function initSchema(session) {
  const statements = [
    "CREATE CONSTRAINT canonical_material_unique IF NOT EXISTS FOR (n:CanonicalMaterial) REQUIRE n.name IS UNIQUE",
    "CREATE CONSTRAINT stimulus_unique IF NOT EXISTS FOR (n:Stimulus) REQUIRE n.name IS UNIQUE",
    "CREATE CONSTRAINT danger_zone_unique IF NOT EXISTS FOR (n:DangerZone) REQUIRE n.name IS UNIQUE",
    "CREATE CONSTRAINT area_rule_unique IF NOT EXISTS FOR (n:AreaRule) REQUIRE n.rule_id IS UNIQUE",
    "CREATE CONSTRAINT stimulus_rule_unique IF NOT EXISTS FOR (n:StimulusRule) REQUIRE n.rule_id IS UNIQUE",
    "CREATE CONSTRAINT predicted_risk_chain_unique IF NOT EXISTS FOR (n:PredictedRiskChain) REQUIRE n.chain_id IS UNIQUE",
  ];
  for (const s of statements) await run(session, s);
}

async function importFacts(file) {
  const session = driver.session();
  try {
    const rows = readTable(file);
    const facts = rowsToFacts(rows, file);
    await initSchema(session);

    const grouped = new Map();
    for (const f of facts) {
      const key = `${f.subjectLabel}|${f.objectLabel}|${f.relType}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(f);
    }

    let imported = 0;
    for (const [key, groupRows] of grouped.entries()) {
      const [subjectLabelRaw, objectLabelRaw, relTypeRaw] = key.split("|");
      const subjectLabel = safeCypherIdentifier(subjectLabelRaw);
      const objectLabel = safeCypherIdentifier(objectLabelRaw);
      const relType = safeCypherIdentifier(relTypeRaw);
      for (let i = 0; i < groupRows.length; i += 500) {
        const batch = groupRows.slice(i, i + 500);
        await run(session, `
          UNWIND $rows AS row
          MERGE (s:Entity:${subjectLabel} {entity_key: row.subjectKey})
          SET s.name = row.subjectName,
              s.entity_type = row.subjectLabel,
              s.source_type = row.subjectType,
              s += row.subjectProps,
              s.updated_at = datetime()
          MERGE (o:Entity:${objectLabel} {entity_key: row.objectKey})
          SET o.name = row.objectName,
              o.entity_type = row.objectLabel,
              o.source_type = row.objectType,
              o += row.objectProps,
              o.updated_at = datetime()
          MERGE (s)-[rel:${relType} {fact_id: row.fact_id}]->(o)
          SET rel.relation_name = row.relationName,
              rel.source_doc = row.sourceDoc,
              rel.source_section = row.sourceSection,
              rel.source_location = row.sourceLocation,
              rel.evidence = row.evidence,
              rel.condition_text = row.conditionText,
              rel.confidence = row.confidence,
              rel.extractor = row.extractor,
              rel.source_file = row.sourceFile,
              rel.updated_at = datetime()
        `, { rows: batch });
        imported += batch.length;
      }
    }

    console.log(`已导入 ${imported} 条事实：${file}`);
  } finally {
    await session.close();
  }
}

async function buildBaseRules(session, rulesFile) {
  await initSchema(session);

  await run(session, `
    UNWIND [
      {zone:'F0', epl:'Da', ip:'IP65及以上'},
      {zone:'F1', epl:'Da或Db', ip:'IP65及以上'},
      {zone:'F2', epl:'Da或Db或Dc', ip:'IP54及以上'}
    ] AS row
    MERGE (z:DangerZone {name: row.zone})
    SET z.entity_type = 'DangerZone'
    MERGE (p:ProtectionRule {zone: row.zone, epl: row.epl, ip: row.ip})
    SET p.name = row.zone + '防护要求', p.entity_type = 'ProtectionRule'
    MERGE (z)-[:REQUIRES_PROTECTION {relation_name:'要求防护'}]->(p)
  `);

  await run(session, `
    UNWIND $rows AS row
    MERGE (s:Stimulus {name: row.name})
    SET s.entity_type = 'Stimulus'
  `, { rows: ["摩擦", "撞击", "静电", "热刺激", "其他刺激"].map((name) => ({ name })) });

  const defaultStimRules = DEFAULT_STIMULUS_RULES.map((r) => ({
    rule_id: `${r.action}|${r.stimulus}|default`,
    ...r,
    evidence: "内置刺激能量映射规则",
    sourceDoc: "",
    sourceSection: "",
    sourceLocation: "",
    extractor: "builtin",
    confidence: 0.82,
  }));
  await upsertStimulusRules(session, defaultStimRules);

  if (rulesFile && fs.existsSync(rulesFile)) {
    const rows = readTable(rulesFile);
    const areaRules = areaRulesFromRows(rows);
    const stimRules = stimulusRulesFromRows(rows);
    await upsertAreaRules(session, areaRules);
    await upsertStimulusRules(session, stimRules);
    console.log(`已从规则 TSV 建立 AreaRule ${areaRules.length} 条，StimulusRule ${stimRules.length} 条。`);
  } else {
    console.log("未提供 rules.tsv，仅写入基础刺激/防护规则。可用 --rules ../data/risk_rules.tsv 导入规则表。");
  }
}

async function upsertAreaRules(session, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    await run(session, `
      UNWIND $rows AS row
      MERGE (r:AreaRule {rule_id: row.rule_id})
      SET r.name = row.operation + ' / ' + row.zone,
          r.entity_type = 'AreaRule',
          r.category = row.category,
          r.operation = row.operation,
          r.condition = row.condition,
          r.zone = row.zone,
          r.evidence = row.evidence,
          r.source_doc = row.sourceDoc,
          r.source_section = row.sourceSection,
          r.source_location = row.sourceLocation,
          r.extractor = row.extractor,
          r.confidence = row.confidence,
          r.updated_at = datetime()
      REMOVE r.source
      MERGE (z:DangerZone {name: row.zone})
      SET z.entity_type = 'DangerZone'
      MERGE (r)-[:HAS_DANGER_ZONE {relation_name:'危险区域'}]->(z)
      MERGE (c:RuleCategory {name: row.category})
      SET c.entity_type = 'RuleCategory'
      MERGE (c)-[:HAS_AREA_RULE {relation_name:'包含区域规则'}]->(r)
    `, { rows: batch });
  }
}

async function upsertStimulusRules(session, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    await run(session, `
      UNWIND $rows AS row
      MERGE (r:StimulusRule {rule_id: row.rule_id})
      SET r.name = row.action + ' → ' + row.stimulus,
          r.entity_type = 'StimulusRule',
          r.action = row.action,
          r.stimulus = row.stimulus,
          r.part = row.part,
          r.evidence = row.evidence,
          r.source_doc = row.sourceDoc,
          r.source_section = row.sourceSection,
          r.source_location = row.sourceLocation,
          r.extractor = row.extractor,
          r.confidence = row.confidence,
          r.updated_at = datetime()
      REMOVE r.source
      MERGE (s:Stimulus {name: row.stimulus})
      SET s.entity_type = 'Stimulus'
      MERGE (r)-[:TRIGGERS_STIMULUS {relation_name:'触发刺激'}]->(s)
    `, { rows: batch });
  }
}

async function normalizeMaterials(session) {
  await run(session, `
    UNWIND $rows AS row
    MERGE (c:CanonicalMaterial {name: row.canonical})
    SET c.entity_type = 'CanonicalMaterial'
    WITH row, c
    MATCH (m)
    WHERE (coalesce(m.entity_type, '') = 'Material' OR 'Material' IN labels(m))
      AND (coalesce(toString(m.name), '') CONTAINS row.alias OR coalesce(toString(m.id), '') CONTAINS row.alias)
    MERGE (m)-[rel:NORMALIZED_TO]->(c)
    SET rel.relation_name = '归一化为',
        rel.method = 'alias_dictionary',
        rel.alias = row.alias,
        rel.confidence = row.confidence,
        rel.note = row.note,
        rel.updated_at = datetime()
  `, { rows: MATERIAL_ALIASES });

  await run(session, `
    MATCH (m)
    WHERE (coalesce(m.entity_type, '') = 'Material' OR 'Material' IN labels(m))
      AND NOT (m)-[:NORMALIZED_TO]->(:CanonicalMaterial)
      AND coalesce(toString(m.name), '') <> ''
    WITH m, coalesce(toString(m.name), toString(m.id)) AS name
    MERGE (c:CanonicalMaterial {name: name})
    SET c.entity_type = 'CanonicalMaterial'
    MERGE (m)-[rel:NORMALIZED_TO]->(c)
    SET rel.relation_name = '归一化为',
        rel.method = 'same_name',
        rel.confidence = 0.7,
        rel.updated_at = datetime()
  `);
}

async function buildStimulusLinks(session) {
  await run(session, `
    UNWIND $rows AS row
    MATCH (h)
    WHERE (coalesce(h.entity_type, '') = 'HazardFactor' OR 'HazardFactor' IN labels(h))
      AND coalesce(toString(h.name), '') CONTAINS row.keyword
    MERGE (s:Stimulus {name: row.stimulus})
    SET s.entity_type = 'Stimulus'
    MERGE (h)-[rel:TRIGGERS_STIMULUS]->(s)
    SET rel.relation_name = '触发刺激',
        rel.method = 'hazard_keyword',
        rel.keyword = row.keyword,
        rel.confidence = row.confidence,
        rel.updated_at = datetime()
  `, { rows: STIMULUS_KEYWORDS });

  await run(session, `
    MATCH (p)
    WHERE coalesce(p.entity_type, '') = 'Process' OR 'Process' IN labels(p)
    MATCH (r:StimulusRule)
    WHERE coalesce(toString(p.name), '') CONTAINS r.action
       OR coalesce(toString(p["操作行为"]), '') CONTAINS r.action
       OR coalesce(toString(p["操作步骤"]), '') CONTAINS r.action
       OR coalesce(toString(p.raw), '') CONTAINS r.action
    MATCH (s:Stimulus {name: r.stimulus})
    MERGE (p)-[rel:MATCHES_STIMULUS_RULE]->(r)
    SET rel.relation_name = '匹配刺激规则', rel.method = 'process_action_keyword', rel.confidence = coalesce(r.confidence, 0.75)
    MERGE (p)-[ts:TRIGGERS_STIMULUS]->(s)
    SET ts.relation_name = '触发刺激', ts.method = 'process_action_keyword', ts.confidence = coalesce(r.confidence, 0.75)
  `);
}

async function matchAreaRules(session) {
  await run(session, `
    MATCH (p)
    WHERE coalesce(p.entity_type, '') = 'Process' OR 'Process' IN labels(p)
    MATCH (r:AreaRule)
    WHERE coalesce(toString(p.name), '') = r.operation
       OR coalesce(toString(p.name), '') CONTAINS r.operation
       OR r.operation CONTAINS coalesce(toString(p.name), '')
    MERGE (p)-[rel:CANDIDATE_MATCHES_AREA_RULE]->(r)
    SET rel.relation_name = '候选匹配危险区域规则',
        rel.method = 'operation_name',
        rel.confidence = CASE WHEN coalesce(toString(p.name), '') = r.operation THEN 0.82 ELSE 0.58 END,
        rel.updated_at = datetime()
  `);

  await run(session, `
    MATCH (p)-[pm]->(m)-[:NORMALIZED_TO]->(cm:CanonicalMaterial)
    WHERE (coalesce(p.entity_type, '') = 'Process' OR 'Process' IN labels(p))
      AND (coalesce(m.entity_type, '') = 'Material' OR 'Material' IN labels(m))
      AND (coalesce(pm.relation_name, '') IN ['涉及物料', '设备名称及选型涉及物料'] OR type(pm) CONTAINS 'MATERIAL')
    MATCH (r:AreaRule)
    WHERE r.operation CONTAINS cm.name
       OR cm.name CONTAINS r.operation
       OR (cm.name = '高氯酸铵' AND r.operation CONTAINS '高氯酸铵')
       OR (cm.name = '硝酸铵' AND r.operation CONTAINS '硝酸铵')
    MERGE (p)-[rel:MATCHES_AREA_RULE]->(r)
    SET rel.relation_name = '匹配危险区域规则',
        rel.method = 'process_material_operation',
        rel.material = cm.name,
        rel.confidence = 0.86,
        rel.updated_at = datetime()
  `);
}

async function createRiskChains(session) {
  await run(session, `
    MATCH (p)-[pm]->(m)-[:NORMALIZED_TO]->(cm:CanonicalMaterial)
    WHERE (coalesce(p.entity_type, '') = 'Process' OR 'Process' IN labels(p))
      AND (coalesce(m.entity_type, '') = 'Material' OR 'Material' IN labels(m))
      AND (coalesce(pm.relation_name, '') IN ['涉及物料', '设备名称及选型涉及物料'] OR type(pm) CONTAINS 'MATERIAL')
    MATCH (p)-[ph]->(h)
    WHERE (coalesce(h.entity_type, '') = 'HazardFactor' OR 'HazardFactor' IN labels(h))
      AND (coalesce(ph.relation_name, '') IN ['存在危险因素', '具有危险性质'] OR type(ph) CONTAINS 'HAZARD')
    MATCH (h)-[:TRIGGERS_STIMULUS]->(s:Stimulus)
    OPTIONAL MATCH (h)-[he]->(e)
    WHERE (coalesce(e.entity_type, '') = 'RiskEvent' OR 'RiskEvent' IN labels(e))
      AND (coalesce(he.relation_name, '') = '可能导致' OR type(he) CONTAINS 'CAUSE')
    WITH p, m, cm, h, s, collect(DISTINCT e) AS events
    MERGE (chain:PredictedRiskChain {
      chain_id: coalesce(toString(id(p)), p.name, '') + '|' + cm.name + '|' + coalesce(toString(id(h)), h.name, '') + '|' + s.name
    })
    SET chain.name = coalesce(p.name, '未知工序') + ' - ' + cm.name + ' - ' + s.name + '风险链',
        chain.entity_type = 'PredictedRiskChain',
        chain.process = p.name,
        chain.material = cm.name,
        chain.hazard_factor = h.name,
        chain.stimulus = s.name,
        chain.confidence = 0.85,
        chain.inference_method = 'facts+stimulus_rule',
        chain.updated_at = datetime()
    REMOVE chain.source
    MERGE (chain)-[:IN_PROCESS {relation_name:'所在工序'}]->(p)
    MERGE (chain)-[:INVOLVES_MATERIAL {relation_name:'涉及物料'}]->(cm)
    MERGE (chain)-[:HAS_ORIGINAL_MATERIAL {relation_name:'原始物料'}]->(m)
    MERGE (chain)-[:HAS_HAZARD_FACTOR {relation_name:'危险因素'}]->(h)
    MERGE (chain)-[:TRIGGERED_BY {relation_name:'触发刺激'}]->(s)
    WITH chain, h, events
    UNWIND events AS e
    WITH chain, h, e
    WHERE e IS NOT NULL
    MERGE (chain)-[:PREDICTS {relation_name:'预测导致'}]->(e)
  `);

  await run(session, `
    MATCH (chain:PredictedRiskChain)-[:HAS_HAZARD_FACTOR]->(h)
    MATCH (h)-[r]->(c)
    WHERE (coalesce(c.entity_type, '') = 'ControlMeasure' OR 'ControlMeasure' IN labels(c))
      AND (coalesce(r.relation_name, '') = '受控于' OR type(r) CONTAINS 'CONTROL')
    MERGE (chain)-[:MITIGATED_BY {relation_name:'控制措施'}]->(c)
  `);

  await run(session, `
    MATCH (chain:PredictedRiskChain)-[:IN_PROCESS]->(p)
    MATCH (p)-[r]->(v)
    WHERE (coalesce(v.entity_type, '') IN ['MonitorVariable', 'Parameter'] OR 'MonitorVariable' IN labels(v) OR 'Parameter' IN labels(v))
      AND (coalesce(r.relation_name, '') IN ['需要监测', '参数索引'] OR type(r) CONTAINS 'MONITOR' OR type(r) CONTAINS 'PARAMETER')
    MERGE (chain)-[:MONITORED_BY {relation_name:'监测变量'}]->(v)
  `);

  await run(session, `
    MATCH (chain:PredictedRiskChain)-[:IN_PROCESS]->(p)
    OPTIONAL MATCH (p)-[:MATCHES_AREA_RULE|CANDIDATE_MATCHES_AREA_RULE]->(ar:AreaRule)-[:HAS_DANGER_ZONE]->(z:DangerZone)
    WITH chain, ar, z
    WHERE ar IS NOT NULL AND z IS NOT NULL
    MERGE (chain)-[:SUPPORTED_BY_AREA_RULE {relation_name:'区域规则支撑'}]->(ar)
    MERGE (chain)-[:IN_DANGER_ZONE {relation_name:'危险区域'}]->(z)
  `);

  await run(session, `
    MATCH (chain:PredictedRiskChain)-[:IN_DANGER_ZONE]->(z:DangerZone)-[:REQUIRES_PROTECTION]->(p:ProtectionRule)
    MERGE (chain)-[:REQUIRES_PROTECTION {relation_name:'要求防护'}]->(p)
  `);
}

async function infer(rulesFile) {
  const session = driver.session();
  try {
    await buildBaseRules(session, rulesFile);
    await normalizeMaterials(session);
    await buildStimulusLinks(session);
    await matchAreaRules(session);
    await createRiskChains(session);
    await status(session);
  } finally {
    await session.close();
  }
}

async function status(sessionArg) {
  const own = !sessionArg;
  const session = sessionArg || driver.session();
  try {
    const r = await run(session, `
      CALL {
        MATCH (c:CanonicalMaterial) RETURN count(c) AS canonicalMaterials
      }
      CALL {
        MATCH (s:Stimulus) RETURN count(s) AS stimuli
      }
      CALL {
        MATCH (a:AreaRule) RETURN count(a) AS areaRules
      }
      CALL {
        MATCH (p:ProtectionRule) RETURN count(p) AS protectionRules
      }
      CALL {
        MATCH (chain:PredictedRiskChain) RETURN count(chain) AS predictedRiskChains
      }
      CALL {
        MATCH ()-[r:NORMALIZED_TO]->() RETURN count(r) AS normalizedLinks
      }
      CALL {
        MATCH ()-[r:TRIGGERS_STIMULUS]->() RETURN count(r) AS stimulusLinks
      }
      RETURN canonicalMaterials, stimuli, areaRules, protectionRules, predictedRiskChains, normalizedLinks, stimulusLinks
    `);
    const rec = r.records[0];
    const out = {
      canonicalMaterials: rec.get("canonicalMaterials"),
      stimuli: rec.get("stimuli"),
      areaRules: rec.get("areaRules"),
      protectionRules: rec.get("protectionRules"),
      predictedRiskChains: rec.get("predictedRiskChains"),
      normalizedLinks: rec.get("normalizedLinks"),
      stimulusLinks: rec.get("stimulusLinks"),
    };
    console.log(JSON.stringify(out, null, 2));
  } finally {
    if (own) await session.close();
  }
}

async function main() {
  const command = process.argv[2];
  try {
    if (command === "import-facts") {
      const file = absFile(arg("--file"));
      if (!file) throw new Error("请提供 --file 文件路径");
      await importFacts(file);
    } else if (command === "infer") {
      const rules = absFile(arg("--rules", path.resolve(process.cwd(), "../data/risk_rules.tsv")));
      await infer(rules);
    } else if (command === "status") {
      await status();
    } else {
      console.log(`未知命令：${command || "未提供"}\n\n用法：\n  node scripts/risk-graph.js import-facts --file ../data/extracted_facts.csv\n  node scripts/risk-graph.js import-facts --file ../data/risk_rules.tsv\n  node scripts/risk-graph.js infer --rules ../data/risk_rules.tsv\n  node scripts/risk-graph.js status`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await driver.close();
  }
}

main();
