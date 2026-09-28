"use strict";

const DEFAULT_DATASET_ID = "HAZOP_DA_H_R_V1";

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

function propertiesOf(value) {
  return value?.properties && typeof value.properties === "object"
    ? value.properties
    : {};
}

function labelsOf(value) {
  return Array.isArray(value?.labels) ? value.labels : [];
}

function getRecordValue(record, key, fallback = null) {
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

function number(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value?.toNumber === "function") return value.toNumber();
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function mergeNodeProperties(node) {
  const raw = propertiesOf(node);
  return { ...parseJsonObject(raw.attributes_json), ...raw };
}

function stableNodeId(node, dbId = null) {
  const props = mergeNodeProperties(node);
  return text(props.id || props.entity_id || dbId);
}

function inferLineCode(props) {
  const direct = text(props.line_code || props.lineCode).toUpperCase();
  if (direct) return direct;
  const match = text(props.name).toUpperCase().match(/^(DA|H|R)/);
  return match?.[1] || "";
}

function inferNodeCode(props) {
  const direct = text(props.node_code || props.node_id || props.nodeCode).toUpperCase();
  if (direct) return direct;
  const match = text(props.name).toUpperCase().match(/\bN\s*0*(\d{1,3})\b/);
  return match ? `N${String(Number(match[1])).padStart(3, "0")}` : "";
}

function inferProcessOrder(props, nodeCode) {
  const direct = number(props.process_order ?? props.processOrder, NaN);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = text(nodeCode).match(/N0*(\d+)/i);
  return match ? Number(match[1]) : 999;
}

function processDisplayName(props, lineCode, nodeCode) {
  const name = text(props.name || props.raw_name || props.description, "未命名工序");
  const escapedLine = text(lineCode).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedNode = text(nodeCode).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = new RegExp(`^${escapedLine ? `${escapedLine}线?` : ""}${escapedNode ? `${escapedNode}` : ""}\\s*`, "i");
  const clean = name.replace(prefix, "").trim();
  return clean || name;
}

function normalizeLineRecord(record) {
  const line = getRecordValue(record, "line");
  const props = mergeNodeProperties(line);
  const dbId = getRecordValue(record, "lineDbId");
  return {
    id: stableNodeId(line, dbId),
    dbId: text(dbId),
    lineCode: inferLineCode(props),
    name: text(props.name || props.raw_name, "未命名生产线"),
    description: text(props.description),
    processCount: number(getRecordValue(record, "processCount")),
    scenarioCount: number(getRecordValue(record, "scenarioCount")),
    causeCount: number(getRecordValue(record, "causeCount")),
    consequenceCount: number(getRecordValue(record, "consequenceCount")),
    controlCount: number(getRecordValue(record, "controlCount")),
    recommendationCount: number(getRecordValue(record, "recommendationCount")),
  };
}

function normalizeProcessRecord(record) {
  const process = getRecordValue(record, "process");
  const props = mergeNodeProperties(process);
  const dbId = getRecordValue(record, "processDbId");
  const lineCode = inferLineCode(props);
  const nodeCode = inferNodeCode(props);
  return {
    id: stableNodeId(process, dbId),
    dbId: text(dbId),
    lineCode,
    nodeCode,
    processOrder: inferProcessOrder(props, nodeCode),
    name: text(props.name || props.raw_name, "未命名工序"),
    displayName: processDisplayName(props, lineCode, nodeCode),
    description: text(props.description),
    sourceDoc: text(props.source_doc),
    scenarioCount: number(getRecordValue(record, "scenarioCount")),
    causeCount: number(getRecordValue(record, "causeCount")),
    consequenceCount: number(getRecordValue(record, "consequenceCount")),
    controlCount: number(getRecordValue(record, "controlCount")),
    recommendationCount: number(getRecordValue(record, "recommendationCount")),
  };
}

function normalizeScenarioRecord(record) {
  const event = getRecordValue(record, "event");
  const props = mergeNodeProperties(event);
  const dbId = getRecordValue(record, "eventDbId");
  return {
    id: stableNodeId(event, dbId),
    dbId: text(dbId),
    serialNo: text(props.serial_no),
    name: text(props.name || props.raw_name, "未命名 HAZOP 场景"),
    description: text(props.description),
    lineCode: text(props.line_code).toUpperCase(),
    nodeCode: text(props.node_id || props.node_code).toUpperCase(),
    parameter: text(props.parameter),
    deviation: text(props.deviation),
    initialSeverity: text(props.initial_severity),
    initialLikelihood: text(props.initial_likelihood),
    initialRisk: text(props.initial_risk),
    residualSeverity: text(props.residual_severity),
    residualLikelihood: text(props.residual_likelihood),
    residualRisk: text(props.residual_risk),
    recommendationCategory: text(props.recommendation_category),
    recommendationNo: text(props.recommendation_no),
    responsibleParty: text(props.responsible_party),
    remarks: text(props.remarks),
    silLevel: props.sil_level ?? null,
    silStatus: text(props.sil_status),
    source: {
      document: text(props.source_doc),
      sheet: text(props.source_sheet || props.sheet),
      excelRow: number(props.excel_row, null),
    },
    causeCount: number(getRecordValue(record, "causeCount")),
    abnormalCount: number(getRecordValue(record, "abnormalCount")),
    consequenceCount: number(getRecordValue(record, "consequenceCount")),
    controlCount: number(getRecordValue(record, "controlCount")),
    recommendationCount: number(getRecordValue(record, "recommendationCount")),
    involvedCount: number(getRecordValue(record, "involvedCount")),
  };
}

function normalizeSimpleNode(record, key, dbIdKey) {
  const node = getRecordValue(record, key);
  const props = mergeNodeProperties(node);
  return {
    id: stableNodeId(node, getRecordValue(record, dbIdKey)),
    dbId: text(getRecordValue(record, dbIdKey)),
    name: text(props.name || props.raw_name || props.description, "未命名节点"),
    description: text(props.description),
    type: text(props.entity_type, labelsOf(node).find((label) => label !== "KGNode") || "KGNode"),
    sourceDoc: text(props.source_doc),
    attributes: parseJsonObject(props.attributes_json),
  };
}

function normalizeEvidenceRecord(record) {
  const result = normalizeSimpleNode(record, "evidence", "evidenceDbId");
  const node = getRecordValue(record, "evidence");
  const props = mergeNodeProperties(node);
  return {
    ...result,
    evidenceText: text(props.description || props.evidence_text || props.name),
    source: {
      document: text(props.source_doc),
      sheet: text(props.sheet || props.source_sheet),
      excelRow: number(props.excel_row, null),
    },
  };
}

function normalizeInvolvedRecord(record) {
  const item = normalizeSimpleNode(record, "item", "itemDbId");
  const itemNode = getRecordValue(record, "item");
  const canonicalNode = getRecordValue(record, "canonical");
  const variantNode = getRecordValue(record, "variant");
  const canonical = canonicalNode
    ? normalizeSimpleNode(record, "canonical", "canonicalDbId")
    : null;
  const variant = variantNode
    ? normalizeSimpleNode(record, "variant", "variantDbId")
    : null;

  let profileNode = variant;
  if (!profileNode && canonicalNode && labelsOf(canonicalNode).includes("Material")) profileNode = canonical;
  if (!profileNode && itemNode && labelsOf(itemNode).includes("Material")
      && text(propertiesOf(itemNode).dataset_id) !== DEFAULT_DATASET_ID) {
    profileNode = item;
  }

  const profileProps = profileNode
    ? mergeNodeProperties(
      profileNode === variant ? variantNode : profileNode === canonical ? canonicalNode : itemNode
    )
    : {};

  return {
    ...item,
    canonical,
    materialProfile: profileNode ? {
      id: profileNode.dbId,
      stableId: text(profileProps.id || profileProps.entity_id),
      name: profileNode.name,
      type: profileNode.type,
    } : null,
  };
}

function createHazopService({ datasetId = DEFAULT_DATASET_ID } = {}) {
  const dataset = text(datasetId, DEFAULT_DATASET_ID);

  async function getStatus(session) {
    const result = await session.run(`
      MATCH (n:KGNode)
      WHERE n.dataset_id = $datasetId
      WITH count(n) AS nodeCount,
           count(CASE WHEN n:ProductionLine THEN 1 END) AS lineCount,
           count(CASE WHEN n:Process THEN 1 END) AS processCount,
           count(CASE WHEN n:RiskEventInstance THEN 1 END) AS scenarioCount,
           count(CASE WHEN n.id IS NULL THEN 1 END) AS nodesWithoutId
      OPTIONAL MATCH (:Process)-[next:NEXT_PROCESS]->(:Process)
      WHERE next.dataset_id = $datasetId
      WITH nodeCount, lineCount, processCount, scenarioCount, nodesWithoutId,
           count(next) AS nextProcessCount
      OPTIONAL MATCH (reference:KGNode)-[aligned:ALIGNED_TO]->(:KGNode)
      WHERE reference.dataset_id = $datasetId
      RETURN nodeCount, lineCount, processCount, scenarioCount, nodesWithoutId,
             nextProcessCount, count(aligned) AS alignmentCount
    `, { datasetId: dataset });
    const row = result.records[0];
    return {
      available: Boolean(row) && number(getRecordValue(row, "scenarioCount")) > 0,
      datasetId: dataset,
      nodeCount: number(getRecordValue(row, "nodeCount")),
      lineCount: number(getRecordValue(row, "lineCount")),
      processCount: number(getRecordValue(row, "processCount")),
      scenarioCount: number(getRecordValue(row, "scenarioCount")),
      nodesWithoutId: number(getRecordValue(row, "nodesWithoutId")),
      nextProcessCount: number(getRecordValue(row, "nextProcessCount")),
      alignmentCount: number(getRecordValue(row, "alignmentCount")),
    };
  }

  async function listLines(session) {
    const result = await session.run(`
      MATCH (line:KGNode:ProductionLine)
      WHERE line.dataset_id = $datasetId
      OPTIONAL MATCH (line)-[:HAS_PROCESS]->(process:KGNode:Process)
      OPTIONAL MATCH (event:KGNode:RiskEventInstance)-[:EVENT_OCCURS_AT]->(process)
      OPTIONAL MATCH (cause:KGNode:LossOfControlCondition)-[:TRIGGERS]->(event)
      OPTIONAL MATCH (event)-[:RESULTS_IN]->(consequence:KGNode:Consequence)
      OPTIONAL MATCH (event)-[:CONTROLLED_BY]->(control:KGNode:ControlMeasure)
      OPTIONAL MATCH (recommendation:KGNode:ControlMeasure)-[:MITIGATES]->(event)
      RETURN line, id(line) AS lineDbId,
             count(DISTINCT process) AS processCount,
             count(DISTINCT event) AS scenarioCount,
             count(DISTINCT cause) AS causeCount,
             count(DISTINCT consequence) AS consequenceCount,
             count(DISTINCT control) AS controlCount,
             count(DISTINCT recommendation) AS recommendationCount
      ORDER BY coalesce(line.line_order, 999), line.name
    `, { datasetId: dataset });
    return result.records.map(normalizeLineRecord);
  }

  async function listProcesses(session, lineCode) {
    const normalizedLineCode = text(lineCode).toUpperCase();
    const result = await session.run(`
      MATCH (line:KGNode:ProductionLine)-[:HAS_PROCESS]->(process:KGNode:Process)
      WHERE line.dataset_id = $datasetId
        AND ($lineCode = '' OR toUpper(coalesce(line.line_code, '')) = $lineCode
             OR toUpper(coalesce(line.name, '')) STARTS WITH $lineCode)
      OPTIONAL MATCH (event:KGNode:RiskEventInstance)-[:EVENT_OCCURS_AT]->(process)
      OPTIONAL MATCH (cause:KGNode:LossOfControlCondition)-[:TRIGGERS]->(event)
      OPTIONAL MATCH (event)-[:RESULTS_IN]->(consequence:KGNode:Consequence)
      OPTIONAL MATCH (event)-[:CONTROLLED_BY]->(control:KGNode:ControlMeasure)
      OPTIONAL MATCH (recommendation:KGNode:ControlMeasure)-[:MITIGATES]->(event)
      RETURN process, id(process) AS processDbId,
             count(DISTINCT event) AS scenarioCount,
             count(DISTINCT cause) AS causeCount,
             count(DISTINCT consequence) AS consequenceCount,
             count(DISTINCT control) AS controlCount,
             count(DISTINCT recommendation) AS recommendationCount
      ORDER BY coalesce(process.process_order, 999), process.name
    `, { datasetId: dataset, lineCode: normalizedLineCode });
    return result.records.map(normalizeProcessRecord)
      .sort((left, right) => left.processOrder - right.processOrder || left.name.localeCompare(right.name, "zh-CN"));
  }

  async function listScenarios(session, processId, { q = "", limit = 300 } = {}) {
    const normalizedProcessId = text(processId);
    const query = text(q).toLowerCase();
    const safeLimit = Math.max(1, Math.min(Math.trunc(number(limit, 300)), 1000));
    const result = await session.run(`
      MATCH (event:KGNode:RiskEventInstance)-[:EVENT_OCCURS_AT]->(process:KGNode:Process)
      WHERE process.dataset_id = $datasetId
        AND (process.id = $processId OR process.entity_id = $processId OR toString(id(process)) = $processId)
        AND ($q = '' OR toLower(coalesce(event.name, '')) CONTAINS $q
             OR toLower(coalesce(event.description, '')) CONTAINS $q
             OR toLower(coalesce(event.attributes_json, '')) CONTAINS $q)
      OPTIONAL MATCH (cause:KGNode:LossOfControlCondition)-[:TRIGGERS]->(event)
      OPTIONAL MATCH (abnormal:KGNode:AbnormalState)-[:TRIGGERS]->(event)
      OPTIONAL MATCH (event)-[:RESULTS_IN]->(consequence:KGNode:Consequence)
      OPTIONAL MATCH (event)-[:CONTROLLED_BY]->(control:KGNode:ControlMeasure)
      OPTIONAL MATCH (recommendation:KGNode:ControlMeasure)-[:MITIGATES]->(event)
      OPTIONAL MATCH (event)-[:EVENT_INVOLVES]->(involved:KGNode)
      RETURN event, id(event) AS eventDbId,
             count(DISTINCT cause) AS causeCount,
             count(DISTINCT abnormal) AS abnormalCount,
             count(DISTINCT consequence) AS consequenceCount,
             count(DISTINCT control) AS controlCount,
             count(DISTINCT recommendation) AS recommendationCount,
             count(DISTINCT involved) AS involvedCount
      ORDER BY event.name
      LIMIT toInteger($limit)
    `, {
      datasetId: dataset,
      processId: normalizedProcessId,
      q: query,
      limit: safeLimit,
    });
    return result.records.map(normalizeScenarioRecord);
  }

  async function getScenario(session, scenarioId) {
    const normalizedScenarioId = text(scenarioId);
    const parameters = { datasetId: dataset, scenarioId: normalizedScenarioId };
    const base = await session.run(`
      MATCH (event:KGNode:RiskEventInstance)-[:EVENT_OCCURS_AT]->(process:KGNode:Process)
      WHERE event.dataset_id = $datasetId
        AND (event.id = $scenarioId OR event.entity_id = $scenarioId OR toString(id(event)) = $scenarioId)
      OPTIONAL MATCH (line:KGNode:ProductionLine)-[:HAS_PROCESS]->(process)
      RETURN event, id(event) AS eventDbId, process, id(process) AS processDbId,
             line, id(line) AS lineDbId
      LIMIT 1
    `, parameters);
    if (!base.records.length) return null;

    const baseRow = base.records[0];
    const event = normalizeScenarioRecord(baseRow);
    const process = normalizeProcessRecord(baseRow);
    const line = getRecordValue(baseRow, "line") ? normalizeLineRecord(baseRow) : null;

    // Neo4j sessions are not shared concurrently; execute the focused detail reads sequentially.
    const triggerResult = await session.run(`
      MATCH (trigger:KGNode)-[:TRIGGERS]->(event:KGNode:RiskEventInstance)
      WHERE event.dataset_id = $datasetId
        AND (event.id = $scenarioId OR event.entity_id = $scenarioId OR toString(id(event)) = $scenarioId)
      RETURN trigger, id(trigger) AS triggerDbId
      ORDER BY trigger.entity_type, trigger.name
    `, parameters);
    const consequenceResult = await session.run(`
      MATCH (event:KGNode:RiskEventInstance)-[:RESULTS_IN]->(consequence:KGNode:Consequence)
      WHERE event.dataset_id = $datasetId
        AND (event.id = $scenarioId OR event.entity_id = $scenarioId OR toString(id(event)) = $scenarioId)
      RETURN consequence, id(consequence) AS consequenceDbId
      ORDER BY consequence.name
    `, parameters);
    const controlResult = await session.run(`
      MATCH (event:KGNode:RiskEventInstance)-[:CONTROLLED_BY]->(control:KGNode:ControlMeasure)
      WHERE event.dataset_id = $datasetId
        AND (event.id = $scenarioId OR event.entity_id = $scenarioId OR toString(id(event)) = $scenarioId)
      RETURN control, id(control) AS controlDbId
      ORDER BY control.name
    `, parameters);
    const recommendationResult = await session.run(`
      MATCH (recommendation:KGNode:ControlMeasure)-[:MITIGATES]->(event:KGNode:RiskEventInstance)
      WHERE event.dataset_id = $datasetId
        AND (event.id = $scenarioId OR event.entity_id = $scenarioId OR toString(id(event)) = $scenarioId)
      RETURN recommendation, id(recommendation) AS recommendationDbId
      ORDER BY recommendation.name
    `, parameters);
    const involvedResult = await session.run(`
      MATCH (event:KGNode:RiskEventInstance)-[:EVENT_INVOLVES]->(item:KGNode)
      WHERE event.dataset_id = $datasetId
        AND (event.id = $scenarioId OR event.entity_id = $scenarioId OR toString(id(event)) = $scenarioId)
      OPTIONAL MATCH (item)-[:ALIGNED_TO]->(canonical:KGNode)
      OPTIONAL MATCH (canonical)-[:HAS_VARIANT]->(variant:KGNode:Material)
      RETURN DISTINCT item, id(item) AS itemDbId,
             canonical, id(canonical) AS canonicalDbId,
             variant, id(variant) AS variantDbId
      ORDER BY item.entity_type, item.name
    `, parameters);
    const evidenceResult = await session.run(`
      MATCH (event:KGNode:RiskEventInstance)-[:SUPPORTED_BY]->(evidence:KGNode:Evidence)
      WHERE event.dataset_id = $datasetId
        AND (event.id = $scenarioId OR event.entity_id = $scenarioId OR toString(id(event)) = $scenarioId)
      RETURN evidence, id(evidence) AS evidenceDbId
      ORDER BY evidence.name
    `, parameters);

    const triggers = triggerResult.records.map((row) => normalizeSimpleNode(row, "trigger", "triggerDbId"));
    return {
      event,
      process,
      line,
      causes: triggers.filter((item) => item.type === "LossOfControlCondition"),
      abnormalities: triggers.filter((item) => item.type === "AbnormalState"),
      consequences: consequenceResult.records.map((row) => normalizeSimpleNode(row, "consequence", "consequenceDbId")),
      controls: controlResult.records.map((row) => normalizeSimpleNode(row, "control", "controlDbId")),
      recommendations: recommendationResult.records.map((row) => normalizeSimpleNode(row, "recommendation", "recommendationDbId")),
      involved: involvedResult.records.map(normalizeInvolvedRecord),
      evidence: evidenceResult.records.map(normalizeEvidenceRecord),
    };
  }

  return { getStatus, listLines, listProcesses, listScenarios, getScenario };
}

module.exports = {
  DEFAULT_DATASET_ID,
  createHazopService,
  normalizeInvolvedRecord,
  normalizeLineRecord,
  normalizeProcessRecord,
  normalizeScenarioRecord,
  parseJsonObject,
};
