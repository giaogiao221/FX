"use strict";

const {
  MATERIAL_RISK_RULES,
  buildMaterialRiskChains,
} = require("./material-risk-rules");

const DEFAULT_DATASET_ID = "PRODUCT_CATALOG_V1";

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

function propertiesOf(node) {
  return node?.properties && typeof node.properties === "object" ? node.properties : {};
}

function get(record, key, fallback = null) {
  try {
    const value = record?.get ? record.get(key) : record?.[key];
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function number(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value?.toNumber === "function") return value.toNumber();
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function clampLimit(value, fallback, max) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function normalizeHazardCode(value) {
  return text(value)
    .replace(/^危险(?:类别|分类)\s*/i, "")
    .replace(/^第/, "")
    .replace(/类爆炸品.*$/, "")
    .replace(/类$/, "")
    .trim();
}

function mapRowsToMaterialFacts(records) {
  const byMaterial = new Map();
  for (const record of records || []) {
    const materialNode = get(record, "m");
    const materialProps = propertiesOf(materialNode);
    const materialAttrs = {
      ...parseJsonObject(materialProps.attributes_json),
      ...parseJsonObject(materialProps.product_catalog_attributes_json),
    };
    const materialId = text(materialProps.id || materialProps.entity_id || get(record, "mDbId"));
    if (!materialId) continue;

    if (!byMaterial.has(materialId)) {
      byMaterial.set(materialId, {
        material: {
          id: materialId,
          dbId: text(get(record, "mDbId")),
          name: text(materialProps.name || materialProps.raw_name, "未命名材料"),
          confidence: number(materialProps.confidence, 0.8),
          sourceDoc: text(materialProps.source_doc),
          hazardCodes: (get(record, "hazardCodes", []) || []).map(normalizeHazardCode).filter(Boolean),
          category: text(materialAttrs.major_category || materialAttrs.category),
          subcategory: text(materialAttrs.subcategory),
          props: { ...materialAttrs, ...materialProps },
        },
        properties: [],
      });
    }

    const fact = byMaterial.get(materialId);
    for (const code of (get(record, "hazardCodes", []) || []).map(normalizeHazardCode).filter(Boolean)) {
      if (!fact.material.hazardCodes.includes(code)) fact.material.hazardCodes.push(code);
    }

    const propertyNode = get(record, "p");
    if (!propertyNode) continue;
    const propertyProps = propertiesOf(propertyNode);
    const propertyId = text(propertyProps.id || propertyProps.entity_id || get(record, "pDbId"));
    if (!propertyId || fact.properties.some((item) => item.id === propertyId)) continue;

    const evidenceProps = propertiesOf(get(record, "e"));
    const evidenceAttrs = parseJsonObject(evidenceProps.attributes_json);
    const relationProps = get(record, "relProps", {}) || {};
    fact.properties.push({
      ...propertyProps,
      id: propertyId,
      dbId: text(get(record, "pDbId")),
      relation: {
        evidenceId: text(relationProps.evidence_id),
        sourceDoc: text(relationProps.source_doc || propertyProps.source_doc || materialProps.source_doc),
        confidence: number(relationProps.confidence, 1),
        relationId: text(relationProps.id || relationProps.relation_id),
      },
      evidence: evidenceProps && Object.keys(evidenceProps).length
        ? {
            id: text(evidenceProps.id || relationProps.evidence_id),
            text: text(evidenceProps.description || evidenceProps.evidence_text),
            sourceDoc: text(evidenceProps.source_doc || relationProps.source_doc),
            tableRow: text(evidenceAttrs.table_row || evidenceAttrs.row || evidenceProps.table_row),
          }
        : null,
    });
  }
  return Array.from(byMaterial.values());
}

function materialFactsQuery() {
  return `
    MATCH (m:KGNode:Material)
    WHERE (m.dataset_id = $datasetId OR m.product_catalog_dataset_id = $datasetId)
      AND coalesce(m.review_status, 'accepted') = 'accepted'
      AND ($materialId = '' OR toString(id(m)) = $materialId OR toString(m.id) = $materialId OR toString(m.entity_id) = $materialId)
      AND ($q = '' OR toLower(coalesce(m.name, '') + ' ' + coalesce(m.raw_name, '') + ' ' + coalesce(m.description, '')) CONTAINS toLower($q))
    WITH m
    ORDER BY coalesce(m.name, m.raw_name, m.id)
    LIMIT toInteger($materialLimit)
    OPTIONAL MATCH (m)-[rp:HAS_MATERIAL_PROPERTY]->(p:KGNode:MaterialProperty)
    WHERE coalesce(rp.review_status, 'accepted') = 'accepted'
      AND coalesce(p.review_status, 'accepted') = 'accepted'
    OPTIONAL MATCH (e:KGNode:Evidence {id: rp.evidence_id})
    OPTIONAL MATCH (m)-[rh:HAS_HAZARD_CLASS]->(h:KGNode:HazardClassification)
    WHERE coalesce(rh.review_status, 'accepted') = 'accepted'
    RETURN m, id(m) AS mDbId, p, CASE WHEN p IS NULL THEN null ELSE id(p) END AS pDbId,
           properties(rp) AS relProps, e,
           collect(DISTINCT coalesce(h.raw_name, h.name, h.code)) AS hazardCodes
    ORDER BY coalesce(m.name, m.raw_name, m.id), coalesce(p.name, p.id)
  `;
}

function filterChains(chains, options = {}) {
  const chainType = text(options.chainType).toUpperCase();
  const riskType = text(options.riskType).toLowerCase();
  const q = text(options.q).toLowerCase();
  const limit = clampLimit(options.limit, 300, 5000);
  return chains.filter((chain) => {
    if (chainType && chain.chainType !== chainType) return false;
    if (riskType && chain.riskType !== riskType) return false;
    if (q) {
      const haystack = [chain.name, chain.material?.name, chain.property?.name, chain.property?.rawValue, chain.trigger?.name, ...(chain.outcomes || []).map((item) => item.name)].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }).slice(0, limit);
}

function chainNode(chain) {
  return {
    id: `mr:chain:${chain.chainId}`,
    label: chain.chainType === "FACT" ? "原文事实" : chain.riskLabel,
    group: "MaterialRiskChain",
    labels: ["MaterialRiskChain"],
    props: {
      chainId: chain.chainId,
      chainType: chain.chainType,
      evidenceLevel: chain.evidenceLevel,
      riskDomain: chain.riskDomain,
      riskType: chain.riskType,
      riskLevel: chain.riskLevel,
      confidence: chain.confidence,
      reviewStatus: chain.reviewStatus,
    },
  };
}

function graphForChains(chains, { includeEvidence = true } = {}) {
  const nodes = new Map();
  const edges = new Map();
  const addNode = (node) => { if (node?.id && !nodes.has(node.id)) nodes.set(node.id, node); };
  const addEdge = (edge) => { if (edge?.id && !edges.has(edge.id)) edges.set(edge.id, edge); };

  for (const chain of chains) {
    const c = chainNode(chain);
    const materialId = `mr:material:${chain.material.id}`;
    const propertyId = `mr:property:${chain.property.id || chain.property.dbId}`;
    addNode(c);
    addNode({
      id: materialId,
      label: chain.material.name,
      group: "Material",
      labels: ["Material"],
      props: { ...chain.material, _neo4jInternalId: chain.material.dbId },
    });
    addNode({
      id: propertyId,
      label: `${chain.property.name}\n${chain.property.rawValue || ""}`.trim(),
      group: "MaterialProperty",
      labels: ["MaterialProperty"],
      props: { ...chain.property, rawValue: chain.property.rawValue },
    });
    addEdge({
      id: `mr:e:${chain.chainId}:material`,
      from: materialId,
      to: c.id,
      type: chain.chainType === "FACT" ? "事实主题" : "风险主题",
      relationType: "HAS_MATERIAL_RISK_THEME",
      props: { inference: chain.chainType === "INFERRED", evidenceLevel: chain.evidenceLevel },
    });
    addEdge({
      id: `mr:e:${chain.chainId}:property`,
      from: c.id,
      to: propertyId,
      type: chain.chainType === "FACT" ? "原文属性" : "事实依据",
      relationType: "BASED_ON_PROPERTY",
      props: { inference: false, evidenceLevel: "explicit_fact" },
    });

    if (includeEvidence && chain.evidence?.id) {
      const evidenceId = `mr:evidence:${chain.evidence.id}`;
      addNode({
        id: evidenceId,
        label: chain.evidence.sourceDoc || "来源证据",
        group: "Evidence",
        labels: ["Evidence"],
        props: { ...chain.evidence },
      });
      addEdge({
        id: `mr:e:${chain.chainId}:evidence`,
        from: propertyId,
        to: evidenceId,
        type: "证据来源",
        relationType: "SUPPORTED_BY",
        props: { inference: false, evidenceLevel: "explicit_fact" },
      });
    }

    if (chain.chainType === "INFERRED") {
      const triggerId = `mr:trigger:${chain.trigger.id}`;
      addNode({ id: triggerId, label: chain.trigger.name, group: "RiskTrigger", labels: ["RiskTrigger"], props: { ...chain.trigger } });
      addEdge({
        id: `mr:e:${chain.chainId}:trigger`,
        from: propertyId,
        to: triggerId,
        type: "规则推断",
        relationType: "TRIGGERS_RISK",
        props: { inference: true, ruleId: chain.rule.ruleId, confidence: chain.confidence },
      });
      for (const outcome of chain.outcomes || []) {
        const outcomeId = `mr:outcome:${outcome.id}`;
        addNode({ id: outcomeId, label: outcome.name, group: "RiskOutcome", labels: ["RiskOutcome"], props: { ...outcome } });
        addEdge({
          id: `mr:e:${chain.chainId}:outcome:${outcome.id}`,
          from: triggerId,
          to: outcomeId,
          type: "可能导致",
          relationType: "MAY_CAUSE",
          props: { inference: true, ruleId: chain.rule.ruleId, confidence: chain.confidence },
        });
      }
      const ruleId = `mr:rule:${chain.rule.ruleId}`;
      addNode({ id: ruleId, label: chain.rule.ruleId, group: "MaterialRiskRule", labels: ["MaterialRiskRule"], props: { ...chain.rule } });
      addEdge({
        id: `mr:e:${chain.chainId}:rule`,
        from: c.id,
        to: ruleId,
        type: "由规则生成",
        relationType: "GENERATED_BY",
        props: { inference: true, ruleId: chain.rule.ruleId },
      });
    }
  }
  return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) };
}

function createMaterialRiskService({ datasetId = DEFAULT_DATASET_ID } = {}) {
  async function loadMaterialFacts(session, options = {}) {
    const result = await session.run(materialFactsQuery(), {
      datasetId,
      materialId: text(options.materialId),
      q: text(options.q),
      materialLimit: clampLimit(options.materialLimit, 1000, 5000),
    });
    return mapRowsToMaterialFacts(result.records || []);
  }

  async function loadChains(session, options = {}) {
    const facts = await loadMaterialFacts(session, options);
    const chains = facts.flatMap(buildMaterialRiskChains);
    return { facts, chains };
  }

  return {
    datasetId,
    async getStatus(session) {
      const { facts, chains } = await loadChains(session, { materialLimit: 5000 });
      const inferred = chains.filter((item) => item.chainType === "INFERRED");

      const formalClassMaterials = new Map();
      for (const fact of facts) {
        for (const code of fact.material.hazardCodes || []) {
          if (!formalClassMaterials.has(code)) formalClassMaterials.set(code, new Set());
          formalClassMaterials.get(code).add(fact.material.id);
        }
      }
      const formalHazardClassStats = Array.from(formalClassMaterials.entries())
        .map(([name, materialIds]) => ({ name, materialCount: materialIds.size }))
        .sort((a, b) => b.materialCount - a.materialCount || a.name.localeCompare(b.name));
      const formallyClassifiedMaterialCount = new Set(
        facts.filter((fact) => (fact.material.hazardCodes || []).length > 0).map((fact) => fact.material.id)
      ).size;

      const characteristicMaterials = new Map();
      for (const chain of inferred) {
        const key = chain.riskType;
        if (!characteristicMaterials.has(key)) {
          characteristicMaterials.set(key, {
            riskType: key,
            name: chain.riskLabel,
            materialIds: new Set(),
            chainCount: 0,
          });
        }
        const item = characteristicMaterials.get(key);
        item.materialIds.add(chain.material.id);
        item.chainCount += 1;
      }
      const ruleOrder = new Map(MATERIAL_RISK_RULES.map((rule, index) => [rule.riskType, index]));
      const riskCharacteristicStats = Array.from(characteristicMaterials.values())
        .map((item) => ({
          riskType: item.riskType,
          name: item.name,
          materialCount: item.materialIds.size,
          chainCount: item.chainCount,
        }))
        .sort((a, b) => (ruleOrder.get(a.riskType) ?? 999) - (ruleOrder.get(b.riskType) ?? 999));

      return {
        available: facts.length > 0,
        datasetId,
        materialCount: facts.length,
        materialsWithRiskChains: new Set(inferred.map((item) => item.material.id)).size,
        factChainCount: chains.filter((item) => item.chainType === "FACT").length,
        inferredChainCount: inferred.length,
        ruleCount: new Set(inferred.map((item) => item.rule?.ruleId).filter(Boolean)).size,
        configuredRuleCount: MATERIAL_RISK_RULES.length,
        formalHazardClassStats,
        formallyClassifiedMaterialCount,
        unclassifiedMaterialCount: Math.max(0, facts.length - formallyClassifiedMaterialCount),
        riskCharacteristicStats,
        classificationNote: "材料风险特征由属性规则识别，用于风险通道展示，不等同于法定危险货物分类。",
      };
    },
    async listChains(session, options = {}) {
      const { facts, chains } = await loadChains(session, { q: options.materialQuery || "", materialLimit: options.materialLimit || 5000 });
      const items = filterChains(chains, options);
      return { datasetId, materialCount: facts.length, total: items.length, items };
    },
    async getMaterialChains(session, materialId) {
      const { facts, chains } = await loadChains(session, { materialId, materialLimit: 1 });
      if (!facts.length) return null;
      return { datasetId, material: facts[0].material, items: chains };
    },
    async getChainGraph(session, chainId) {
      const { chains } = await loadChains(session, { materialLimit: 5000 });
      const chain = chains.find((item) => item.chainId === chainId);
      if (!chain) return null;
      return { chain, ...graphForChains([chain], { includeEvidence: true }), meta: { datasetId, chainType: chain.chainType } };
    },
    async getOverviewGraph(session, options = {}) {
      const { chains } = await loadChains(session, { materialLimit: options.materialLimit || 5000 });
      const selected = filterChains(chains, {
        chainType: options.chainType || "INFERRED",
        riskType: options.riskType,
        q: options.q,
        limit: options.chainLimit || 120,
      });
      return {
        ...graphForChains(selected, { includeEvidence: false }),
        meta: {
          datasetId,
          returnedChains: selected.length,
          factChainCount: chains.filter((item) => item.chainType === "FACT").length,
          inferredChainCount: chains.filter((item) => item.chainType === "INFERRED").length,
        },
      };
    },
  };
}

module.exports = {
  DEFAULT_DATASET_ID,
  createMaterialRiskService,
  filterChains,
  graphForChains,
  mapRowsToMaterialFacts,
  materialFactsQuery,
};
