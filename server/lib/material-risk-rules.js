"use strict";

const crypto = require("node:crypto");

const RULE_VERSION = "1.1.0";

const SHARED_LIMITATIONS = [
  "规则只识别材料属性对应的风险通道，不等同于事故概率或定量后果计算。",
  "感度数值受试验方法、样品状态和测试条件影响，未完成条件归一化前不能直接横向排序。",
  "推断未引入产线工序、人员暴露、设备状态或保护层信息，必须结合具体作业场景复核。",
];

const MATERIAL_RISK_RULES = [
  {
    ruleId: "MR-FRICTION-001",
    family: "sensitivity",
    riskType: "friction",
    label: "摩擦感度风险",
    match: /摩擦感度|摩擦发火|摩擦爆炸/,
    trigger: "摩擦/剪切刺激",
    outcomes: ["意外发火", "燃烧或爆炸"],
    baseConfidence: 0.9,
    rationale: "材料存在摩擦感度或摩擦发火试验事实时，摩擦与剪切可作为潜在点火刺激。",
  },
  {
    ruleId: "MR-IMPACT-001",
    family: "sensitivity",
    riskType: "impact",
    label: "撞击/冲击感度风险",
    match: /撞击感度|冲击感度|落锤|落高/,
    trigger: "撞击/冲击刺激",
    outcomes: ["意外发火", "燃烧或爆炸"],
    baseConfidence: 0.88,
    rationale: "材料存在撞击、冲击或落锤试验事实时，机械冲击可作为潜在起爆或点火刺激。",
  },
  {
    ruleId: "MR-ELECTROSTATIC-001",
    family: "sensitivity",
    riskType: "electrostatic",
    label: "静电感度风险",
    match: /静电感度|静电火花|静电放电/,
    trigger: "静电放电",
    outcomes: ["点火", "燃烧或爆炸"],
    baseConfidence: 0.9,
    rationale: "材料存在静电感度或静电火花试验事实时，静电放电可构成潜在点火源。",
  },
  {
    ruleId: "MR-FLAME-001",
    family: "sensitivity",
    riskType: "flame",
    label: "火焰感度风险",
    match: /火焰感度|明火感度|点火感度/,
    trigger: "明火/高温火焰",
    outcomes: ["点火", "燃烧或爆炸"],
    baseConfidence: 0.9,
    rationale: "材料存在火焰或点火感度试验事实时，明火和高温火焰可构成直接点火刺激。",
  },
  {
    ruleId: "MR-THERMAL-001",
    family: "thermal",
    riskType: "thermal",
    label: "爆发点/热分解风险",
    match: /爆发点|分解温度|热分解|自燃点/,
    trigger: "异常受热",
    outcomes: ["热分解", "燃烧或爆炸"],
    baseConfidence: 0.88,
    rationale: "材料记录爆发点、分解温度或自燃点时，超过相应热边界可能触发分解、点火或爆炸。",
  },
  {
    ruleId: "MR-STABILITY-001",
    family: "thermal",
    riskType: "stability",
    label: "热稳定性边界风险",
    match: /安定性|安定试验|维也里试验|甲基紫试验|加热试验|重复法|普通法/,
    trigger: "超出温度/时间边界",
    outcomes: ["热稳定性下降", "分解、燃烧或爆炸"],
    baseConfidence: 0.76,
    rationale: "材料存在安定性或加热试验事实时，温度和持续时间超出已验证边界可能导致稳定性下降。",
  },
];

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value?.toNumber === "function") return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampConfidence(...values) {
  const numbers = values.map(finiteNumber).filter((value) => value !== null);
  if (!numbers.length) return 0.7;
  return Math.max(0.01, Math.min(1, Math.min(...numbers)));
}

function normalizePropertyFact(raw = {}) {
  const props = raw?.properties && typeof raw.properties === "object" ? raw.properties : raw;
  const attrs = {
    ...parseJsonObject(props.attributes_json),
    ...parseJsonObject(props.product_catalog_attributes_json),
    ...(raw.attributes && typeof raw.attributes === "object" ? raw.attributes : {}),
  };
  return {
    id: text(props.id || props.entity_id || raw.id),
    dbId: text(raw.dbId || props._neo4jInternalId),
    name: text(attrs.property_name || attrs.name || props.name || props.raw_name, "未命名属性"),
    group: text(attrs.property_group || props.property_group, "其他属性"),
    rawValue: text(attrs.raw_value || attrs.raw_item || props.description || raw.rawValue),
    numericValue: finiteNumber(attrs.nominal_value ?? attrs.min_value ?? attrs.max_value),
    unit: text(attrs.unit),
    confidence: finiteNumber(props.confidence ?? raw.confidence) ?? 0.8,
    attributes: attrs,
    relation: raw.relation || {},
    evidence: raw.evidence || null,
  };
}

function stableId(prefix, ...parts) {
  const payload = parts.map((part) => text(part)).join("|");
  return `${prefix}_${crypto.createHash("sha1").update(payload, "utf8").digest("hex").slice(0, 20)}`;
}

function normalizedHazardCodes(material = {}) {
  const values = Array.isArray(material.hazardCodes) ? material.hazardCodes : [];
  return values.map((value) => text(value).replace(/^第/, "").replace(/类.*$/, "")).filter(Boolean);
}

function positiveResponse(property, rule) {
  const raw = `${property.name} ${property.rawValue}`;
  if (/爆炸|发火|点火|分解|自燃|失重|减量|不安定|敏感/.test(raw)) return true;
  if (rule.family === "sensitivity") {
    const percents = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((match) => Number(match[1]));
    if (percents.some((value) => Number.isFinite(value) && value > 0)) return true;
  }
  return false;
}

function priorityAssessment(material, rule, property) {
  const hazardCodes = normalizedHazardCodes(material);
  const formalHigh = hazardCodes.find((code) => /^1\.(1|2)/.test(code));
  if (formalHigh) {
    return {
      level: "high",
      basis: [`原文明确危险货物分类为 ${formalHigh}，用于提高链路关注优先级。`],
    };
  }
  if (positiveResponse(property, rule)) {
    return {
      level: "medium-high",
      basis: ["原始属性记录了发火、爆炸、分解、失重或正响应比例，说明该风险通道存在实测响应。"],
    };
  }
  return {
    level: "medium",
    basis: ["当前仅确认存在相应感度或热稳定性试验事实，未据此计算事故概率或跨材料严重度排序。"],
  };
}

function ruleSearchText(property) {
  return [property.name, property.group, property.rawValue].filter(Boolean).join(" ");
}

function buildReasoning(rule, property, searchText) {
  return {
    method: "deterministic_rule",
    matchedProperty: property.name,
    matchedText: searchText,
    rulePattern: rule.match.source,
    rationale: rule.rationale,
    steps: [
      `读取已审核材料属性“${property.name}”：${property.rawValue || "已记录相关试验事实"}。`,
      `属性文本命中规则 ${rule.ruleId}，识别潜在刺激“${rule.trigger}”。`,
      `依据规则机理映射到可能后果“${rule.outcomes.join("、")}”。`,
      "将结果标记为系统推断并保留原属性、证据、规则版本和置信度，等待人工复核。",
    ],
    limitations: SHARED_LIMITATIONS.slice(),
  };
}

function buildMaterialRiskChains(materialFact = {}) {
  const material = materialFact.material || {};
  const materialId = text(material.id || material.entityId || material.dbId);
  if (!materialId) return [];

  const chains = [];
  const seen = new Set();
  for (const rawProperty of Array.isArray(materialFact.properties) ? materialFact.properties : []) {
    const property = normalizePropertyFact(rawProperty);
    if (!property.id && !property.dbId) continue;
    const searchText = ruleSearchText(property);

    for (const rule of MATERIAL_RISK_RULES) {
      if (!rule.match.test(searchText)) continue;
      const key = `${property.id || property.dbId}|${rule.ruleId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const relationConfidence = finiteNumber(property.relation?.confidence) ?? 1;
      const confidence = clampConfidence(material.confidence ?? 1, property.confidence, relationConfidence, rule.baseConfidence);
      const evidence = property.evidence
        ? {
            id: text(property.evidence.id || property.relation?.evidenceId),
            text: text(property.evidence.text || property.evidence.description),
            sourceDoc: text(property.evidence.sourceDoc || property.evidence.source_doc || property.relation?.sourceDoc || material.sourceDoc),
            tableRow: text(property.evidence.tableRow || property.evidence.table_row),
            available: true,
          }
        : {
            id: text(property.relation?.evidenceId),
            text: "",
            sourceDoc: text(property.relation?.sourceDoc || material.sourceDoc),
            tableRow: "",
            available: false,
          };
      const assessment = priorityAssessment(material, rule, property);

      const common = {
        riskDomain: "material",
        riskType: rule.riskType,
        riskLabel: rule.label,
        material: {
          id: materialId,
          dbId: text(material.dbId),
          name: text(material.name, "未命名材料"),
          hazardCodes: normalizedHazardCodes(material),
          sourceDoc: text(material.sourceDoc),
        },
        property,
        evidence,
        confidence,
        riskLevel: assessment.level,
        priorityBasis: assessment.basis,
      };

      chains.push({
        ...common,
        chainId: stableId("MRFACT", materialId, property.id || property.dbId, rule.ruleId),
        chainType: "FACT",
        evidenceLevel: "explicit_fact",
        reviewStatus: "accepted_fact",
        name: `${common.material.name} · ${property.name}事实依据`,
        trigger: null,
        outcomes: [],
        rule: null,
        reasoning: null,
      });

      chains.push({
        ...common,
        chainId: stableId("MRINF", materialId, property.id || property.dbId, rule.ruleId),
        chainType: "INFERRED",
        evidenceLevel: "rule_inference",
        reviewStatus: "system_generated",
        name: `${common.material.name} · ${rule.label}`,
        trigger: {
          id: stableId("MRTRG", rule.trigger),
          name: rule.trigger,
        },
        outcomes: rule.outcomes.map((name) => ({
          id: stableId("MROUT", name),
          name,
        })),
        rule: {
          ruleId: rule.ruleId,
          version: RULE_VERSION,
          family: rule.family,
          name: rule.label,
          baseConfidence: rule.baseConfidence,
          rationale: rule.rationale,
        },
        reasoning: buildReasoning(rule, property, searchText),
      });
    }
  }

  return chains.sort((a, b) => a.chainId.localeCompare(b.chainId));
}

module.exports = {
  MATERIAL_RISK_RULES,
  RULE_VERSION,
  buildMaterialRiskChains,
  normalizePropertyFact,
};
