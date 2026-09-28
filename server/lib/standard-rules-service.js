"use strict";

const { createGraphCollector } = require("./graph-collector");

const RULE_TYPES = ["ManagementRequirement", "InspectionRequirement"];

function get(record, key, fallback = null) {
  try {
    const value = record?.get ? record.get(key) : record?.[key];
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function text(value, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function number(value, fallback = 0) {
  if (typeof value?.toNumber === "function") return value.toNumber();
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function clampLimit(value, fallback, max) {
  const result = Number.parseInt(value ?? fallback, 10);
  return Number.isFinite(result) && result > 0 ? Math.min(result, max) : fallback;
}

function propertiesOf(node) {
  return node?.properties && typeof node.properties === "object" ? node.properties : {};
}

function parseAttributes(value) {
  try { return typeof value === "string" ? JSON.parse(value) : value || {}; } catch { return {}; }
}

function nodePayload(node, dbId, labels = []) {
  const raw = propertiesOf(node);
  const props = { ...parseAttributes(raw.attributes_json), ...raw, _neo4jInternalId: text(dbId) };
  const group = text(props.entity_type, labels.find((label) => label !== "KGNode") || "Node");
  return {
    id: text(props.id || props.entity_id || dbId),
    label: text(props.name || props.requirement_text || props.property_name, group),
    group,
    labels,
    props,
  };
}

function ruleListQuery() {
  return `
    MATCH (rule:KGNode)
    WHERE rule.entity_type IN $ruleTypes
      AND coalesce(rule.review_status, 'accepted') = 'accepted'
      AND ($q = '' OR toLower(coalesce(rule.name, '') + ' ' + coalesce(rule.attributes_json, '')) CONTAINS toLower($q))
    RETURN rule, id(rule) AS dbId
    ORDER BY coalesce(rule.name, rule.id)
    LIMIT toInteger($limit)
  `;
}

function ruleDetailQuery() {
  return `
    MATCH (rule:KGNode)
    WHERE rule.entity_type IN $ruleTypes
      AND coalesce(rule.review_status, 'accepted') = 'accepted'
      AND (toString(rule.id) = $ruleId OR toString(id(rule)) = $ruleId)
    WITH rule LIMIT 1
    OPTIONAL MATCH (clause:KGNode)-[clauseRel:STANDARD_RULE]->(rule)
    WHERE clause.entity_type = 'Clause'
      AND clauseRel.relation_code = 'HAS_REQUIREMENT'
      AND coalesce(clause.review_status, 'accepted') = 'accepted'
      AND coalesce(clauseRel.review_status, 'accepted') = 'accepted'
    OPTIONAL MATCH (standard:KGNode)-[standardRel:STANDARD_RULE]->(clause)
    WHERE standard.entity_type = 'Standard'
      AND standardRel.relation_code = 'HAS_CLAUSE'
      AND coalesce(standard.review_status, 'accepted') = 'accepted'
      AND coalesce(standardRel.review_status, 'accepted') = 'accepted'
    OPTIONAL MATCH (rule)-[evidenceRel:STANDARD_RULE]->(evidence:KGNode)
    WHERE evidence.entity_type = 'Evidence'
      AND evidenceRel.relation_code = 'SUPPORTED_BY'
      AND coalesce(evidence.review_status, 'accepted') = 'accepted'
      AND coalesce(evidenceRel.review_status, 'accepted') = 'accepted'
    RETURN rule, id(rule) AS ruleDbId,
      collect(DISTINCT clause)[0] AS clause, collect(DISTINCT id(clause))[0] AS clauseDbId,
      collect(DISTINCT standard)[0] AS standard, collect(DISTINCT id(standard))[0] AS standardDbId,
      collect(DISTINCT evidence) AS evidence
  `;
}

function graphQuery() {
  return `
    MATCH (rule:KGNode)
    WHERE rule.entity_type IN $ruleTypes
      AND coalesce(rule.review_status, 'accepted') = 'accepted'
      AND (toString(rule.id) = $ruleId OR toString(id(rule)) = $ruleId)
    WITH rule LIMIT 1
    OPTIONAL MATCH (standard:KGNode)-[standardRel:STANDARD_RULE]->(clause:KGNode)-[clauseRel:STANDARD_RULE]->(rule)
    WHERE standard.entity_type = 'Standard'
      AND clause.entity_type = 'Clause'
      AND standardRel.relation_code = 'HAS_CLAUSE'
      AND clauseRel.relation_code = 'HAS_REQUIREMENT'
      AND coalesce(standard.review_status, 'accepted') = 'accepted'
      AND coalesce(clause.review_status, 'accepted') = 'accepted'
      AND coalesce(standardRel.review_status, 'accepted') = 'accepted'
      AND coalesce(clauseRel.review_status, 'accepted') = 'accepted'
    OPTIONAL MATCH (rule)-[evidenceRel:STANDARD_RULE]->(evidence:KGNode)
    WHERE evidence.entity_type = 'Evidence'
      AND evidenceRel.relation_code = 'SUPPORTED_BY'
      AND coalesce(evidence.review_status, 'accepted') = 'accepted'
      AND coalesce(evidenceRel.review_status, 'accepted') = 'accepted'
    RETURN rule, id(rule) AS ruleDbId, labels(rule) AS ruleLabels,
      standard, id(standard) AS standardDbId, labels(standard) AS standardLabels, standardRel,
      clause, id(clause) AS clauseDbId, labels(clause) AS clauseLabels, clauseRel,
      evidence, id(evidence) AS evidenceDbId, labels(evidence) AS evidenceLabels, evidenceRel
  `;
}

function normalizeRule(record) {
  const rule = propertiesOf(get(record, "rule"));
  const attrs = { ...parseAttributes(rule.attributes_json), ...rule };
  const evidence = (get(record, "evidence", []) || []).filter(Boolean).map((item) => {
    const props = { ...parseAttributes(propertiesOf(item).attributes_json), ...propertiesOf(item) };
    return { id: text(props.id), text: text(props.text || props.evidence_text || props.name), page: props.page_idx ?? "", sourceBlockId: text(props.source_block_id), props };
  });
  const clause = propertiesOf(get(record, "clause"));
  const standard = propertiesOf(get(record, "standard"));
  return { ruleId: text(attrs.id || get(record, "ruleDbId")), ruleType: text(attrs.entity_type), title: text(attrs.name || attrs.requirement_text || attrs.property_name), requirementText: text(attrs.requirement_text), propertyName: text(attrs.property_name), operator: text(attrs.operator), rawThreshold: text(attrs.raw_threshold), unit: text(attrs.unit), modality: text(attrs.modality), subject: text(attrs.subject), action: text(attrs.action), object: text(attrs.object), condition: text(attrs.condition), confidence: attrs.confidence ?? "", standard: { id: text(standard.id || get(record, "standardDbId")), title: text(standard.name) }, clause: { id: text(clause.id || get(record, "clauseDbId")), code: text(clause.name) }, evidence };
}

function createStandardRulesService() {
  return {
    async getStatus(session) {
      const result = await session.run(`MATCH (n:KGNode) WHERE n.entity_type IN $ruleTypes AND coalesce(n.review_status, 'accepted') = 'accepted' RETURN count(n) AS ruleCount`, { ruleTypes: RULE_TYPES });
      const ruleCount = number(get(result.records?.[0], "ruleCount"));
      return { available: ruleCount > 0, ruleCount, ruleTypes: RULE_TYPES };
    },
    async listRules(session, options = {}) {
      const result = await session.run(ruleListQuery(), { ruleTypes: RULE_TYPES, q: text(options.q), limit: clampLimit(options.limit, 300, 1000) });
      const items = (result.records || []).map((record) => {
        const props = { ...parseAttributes(propertiesOf(get(record, "rule")).attributes_json), ...propertiesOf(get(record, "rule")) };
        return { ruleId: text(props.id || get(record, "dbId")), ruleType: text(props.entity_type), title: text(props.name || props.requirement_text || props.property_name), clauseId: text(props.clause_id), page: props.page_idx ?? "", evidenceText: text(props.evidence_text), confidence: props.confidence ?? "" };
      });
      return { total: items.length, items };
    },
    async getRule(session, ruleId) {
      const result = await session.run(ruleDetailQuery(), { ruleTypes: RULE_TYPES, ruleId: text(ruleId) });
      return result.records?.length ? normalizeRule(result.records[0]) : null;
    },
    async getRuleGraph(session, ruleId, options = {}) {
      const result = await session.run(graphQuery(), { ruleTypes: RULE_TYPES, ruleId: text(ruleId), edgeLimit: clampLimit(options.edgeLimit, 100, 500) });
      if (!result.records?.length) return null;
      const graph = createGraphCollector();
      for (const record of result.records) {
        const rule = get(record, "rule");
        const ruleNode = nodePayload(rule, get(record, "ruleDbId"), get(record, "ruleLabels", []));
        graph.addNode(ruleNode);
        const standard = get(record, "standard");
        const clause = get(record, "clause");
        const evidence = get(record, "evidence");
        const standardNode = standard ? nodePayload(standard, get(record, "standardDbId"), get(record, "standardLabels", [])) : null;
        const clauseNode = clause ? nodePayload(clause, get(record, "clauseDbId"), get(record, "clauseLabels", [])) : null;
        const evidenceNode = evidence ? nodePayload(evidence, get(record, "evidenceDbId"), get(record, "evidenceLabels", [])) : null;
        if (standardNode) graph.addNode(standardNode);
        if (clauseNode) graph.addNode(clauseNode);
        if (evidenceNode) graph.addNode(evidenceNode);
        const addRelationship = (rel, from, to) => {
          if (!rel || !from || !to) return;
          const props = propertiesOf(rel);
          graph.addEdge({ id: text(props.id || rel.identity || `${from.id}:${to.id}:${rel.type}`), from: text(from.id), to: text(to.id), type: text(rel.type), relationType: text(props.relation_code || rel.type), props });
        };
        addRelationship(get(record, "standardRel"), standardNode, clauseNode);
        addRelationship(get(record, "clauseRel"), clauseNode, ruleNode);
        addRelationship(get(record, "evidenceRel"), ruleNode, evidenceNode);
      }
      return { ...graph.toJSON(), meta: { ruleId: text(ruleId), ruleTypes: RULE_TYPES } };
    },
  };
}

module.exports = { RULE_TYPES, clampLimit, createStandardRulesService, graphQuery, ruleDetailQuery, ruleListQuery };
