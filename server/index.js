// server/index.js
const express = require("express");
const cors = require("cors");
const neo4j = require("neo4j-driver");
const path = require("path");
const { execFile } = require("child_process");
const { createStructureStore } = require("./lib/structure-store");
const { createHazopService } = require("./lib/hazop-service");
const { createMaterialRiskService } = require("./lib/material-risk-service");
const { createStandardRulesService } = require("./lib/standard-rules-service");
const { createGraphCollector } = require("./lib/graph-collector");
const {
  PREDICTED_CHAIN_PROVENANCE_QUERY,
  isPredictedRiskChain,
  mergeProvenance,
} = require("./lib/risk-provenance");

const app = express();
app.use(cors());
app.use(express.json());

const STRUCTURE_MAPPING_PATH = process.env.STRUCTURE_MAPPING_PATH
  || path.join(__dirname, "..", "data", "material_structure_mapping.json");
const structureStore = createStructureStore(STRUCTURE_MAPPING_PATH);

// ====== Neo4j connection ======
// PowerShell 示例：
//   $env:NEO4J_URI="bolt://localhost:7687"
//   $env:NEO4J_USER="neo4j"
//   $env:NEO4J_PASS="你的Neo4j密码"
//   node index.js
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASS = process.env.NEO4J_PASS || "";
const NEO4J_STANDARD_URI = process.env.NEO4J_STANDARD_URI || "bolt://localhost:7688";
const NEO4J_STANDARD_USER = process.env.NEO4J_STANDARD_USER || "neo4j";
const NEO4J_STANDARD_PASS = process.env.NEO4J_STANDARD_PASS || "";
const PRODUCT_CATALOG_DATASET_ID = "PRODUCT_CATALOG_V1";

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASS),
  { disableLosslessIntegers: true }
);
const standardDriver = neo4j.driver(
  NEO4J_STANDARD_URI,
  neo4j.auth.basic(NEO4J_STANDARD_USER, NEO4J_STANDARD_PASS),
  { disableLosslessIntegers: true }
);

const hazopService = createHazopService({ datasetId: "HAZOP_DA_H_R_V1" });
const materialRiskService = createMaterialRiskService({ datasetId: "PRODUCT_CATALOG_V1" });
const standardRulesService = createStandardRulesService();

function hazopRoute(handler) {
  return async (req, res) => {
    const session = driver.session();
    try {
      await handler(req, res, session);
    } catch (cause) {
      console.error("HAZOP API error", cause);
      if (!res.headersSent) {
        res.status(500).json({ error: cause instanceof Error ? cause.message : String(cause) });
      }
    } finally {
      await session.close();
    }
  };
}

function materialRiskRoute(handler) {
  return async (req, res) => {
    const session = driver.session();
    try {
      await handler(req, res, session);
    } catch (cause) {
      console.error("Material risk API error", cause);
      if (!res.headersSent) {
        res.status(500).json({ error: cause instanceof Error ? cause.message : String(cause) });
      }
    } finally {
      await session.close();
    }
  };
}

function standardRulesRoute(handler) {
  return async (req, res) => {
    const session = standardDriver.session();
    try {
      await handler(req, res, session);
    } catch (cause) {
      console.error("Standard rules API error", cause);
      if (!res.headersSent) res.status(500).json({ error: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      await session.close();
    }
  };
}

function safeGet(rec, key) {
  try {
    return rec.get(key);
  } catch {
    return null;
  }
}

function nodeProps(node) {
  return node?.properties || {};
}

function relProps(rel) {
  return rel?.properties || {};
}

function toText(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function nodeDisplayName(node, internalId) {
  const p = nodeProps(node);
  return firstNonEmpty(
    p.name,
    p.id,
    p.title,
    p.label,
    p.subject,
    p.object,
    p.raw,
    internalId
  );
}

function nodeGroup(labels, props) {
  const semanticType = firstNonEmpty(props?.entity_type, props?.type);
  if (semanticType) return semanticType;
  if (Array.isArray(labels) && labels.length > 0) {
    return labels.find((label) => label !== "Entity") || labels[0];
  }
  return "Node";
}


function productCatalogWhere(alias = "n") {
  return `(${alias}.dataset_id = '${PRODUCT_CATALOG_DATASET_ID}' OR ${alias}.product_catalog_dataset_id = '${PRODUCT_CATALOG_DATASET_ID}')`;
}

function normalizeHazardCode(value) {
  return String(value || "")
    .replace(/^UN\s*/i, "")
    .replace(/^危险(?:类别|分类)\s*/i, "")
    .trim();
}

function splitHazardCode(value) {
  const code = normalizeHazardCode(value);
  const match = code.match(/^(\d+(?:\.\d+)?)([A-Z])?$/i);
  return {
    code,
    division: match?.[1] || code,
    compatibilityGroup: (match?.[2] || "").toUpperCase(),
  };
}

function hazardSystemName(value) {
  return String(value || "").toUpperCase() === "UN_TDG"
    ? "联合国危险货物运输分类（UN TDG）"
    : String(value || "未注明分类体系");
}

function hazardRoleName(value) {
  const role = String(value || "").toLowerCase();
  if (role === "primary") return "主分类";
  if (role === "alternative") return "条件/备选分类";
  return value || "未注明";
}

function normalizeNode(node, internalId, labels) {
  const rawProps = nodeProps(node);
  const attributeProps = parseJsonObject(rawProps.attributes_json);
  const props = { ...attributeProps, ...rawProps };
  const idText = toText(internalId);
  const group = nodeGroup(labels, props);
  let name = nodeDisplayName(node, idText);

  if (group === "HazardClassification") {
    const parts = splitHazardCode(firstNonEmpty(props.code, props.raw_name, props.name));
    name = `危险分类 ${parts.code}`;
    props.hazard_code = parts.code;
    props.hazard_division = parts.division;
    props.compatibility_group = parts.compatibilityGroup;
    props.classification_system_name = hazardSystemName(
      firstNonEmpty(props.classification_system, attributeProps.classification_system)
    );
    props.display_name = name;
  }

  return {
    dbId: idText,
    materialId: idText, // 兼容原前端命名：这里实际是 Neo4j 内部节点 ID
    name,
    labels: labels || [],
    group,
    props: { ...props, _neo4jInternalId: idText },
  };
}

function normalizeRelationshipRow(centerId, centerNode, centerLabels, rel, neighborNode, neighborId, neighborLabels, startId, endId) {
  const center = normalizeNode(centerNode, centerId, centerLabels);
  const neighbor = normalizeNode(neighborNode, neighborId, neighborLabels);
  const rp = relProps(rel);
  const relId = toText(rel.identity);
  const relType = rel.type;
  const direction = toText(startId) === toText(centerId) ? "out" : "in";
  const subject = direction === "out" ? center : neighbor;
  const object = direction === "out" ? neighbor : center;

  return {
    edgeId: `r:${relId}`,
    direction,
    relationType: relType,
    relationName: firstNonEmpty(rp.relation_name, rp.name, relType),
    sourceDoc: firstNonEmpty(rp.source_doc, rp.source, rp.doc),
    confidence: rp.confidence ?? null,
    subject: subject.name,
    subjectType: subject.group,
    object: object.name,
    objectType: object.group,
    neighborId: neighbor.dbId,
    neighborName: neighbor.name,
    neighborType: neighbor.group,
    startId: toText(startId),
    endId: toText(endId),
    props: { ...rp, _neo4jInternalId: relId },
  };
}

// ====== Material risk domain (PRODUCT_CATALOG_V1 only) ======
app.get("/material-risk/status", materialRiskRoute(async (req, res, session) => {
  res.json(await materialRiskService.getStatus(session));
}));

app.get("/material-risk/chains", materialRiskRoute(async (req, res, session) => {
  res.json(await materialRiskService.listChains(session, {
    q: String(req.query.q || ""),
    chainType: String(req.query.chainType || ""),
    riskType: String(req.query.riskType || ""),
    limit: Number(req.query.limit || 500),
  }));
}));

app.get("/material-risk/material/:materialId", materialRiskRoute(async (req, res, session) => {
  const result = await materialRiskService.getMaterialChains(session, String(req.params.materialId || ""));
  if (!result) return res.status(404).json({ error: "Material not found in PRODUCT_CATALOG_V1" });
  return res.json(result);
}));

app.get("/graph/material-risk-chains", materialRiskRoute(async (req, res, session) => {
  res.json(await materialRiskService.getOverviewGraph(session, {
    chainType: String(req.query.chainType || "INFERRED"),
    riskType: String(req.query.riskType || ""),
    q: String(req.query.q || ""),
    chainLimit: Number(req.query.chainLimit || 120),
  }));
}));

app.get("/graph/material-risk-chain/:chainId", materialRiskRoute(async (req, res, session) => {
  const result = await materialRiskService.getChainGraph(session, String(req.params.chainId || ""));
  if (!result) return res.status(404).json({ error: "Material risk chain not found" });
  return res.json(result);
}));

// ====== Offline molecular structures ======
app.get("/structure/status", (req, res) => {
  res.json(structureStore.getStatus());
});

app.get("/structure/material/:materialId", (req, res) => {
  const materialId = String(req.params.materialId || "").trim();
  const status = structureStore.getStatus();

  if (!status.available) {
    return res.json({
      available: false,
      reason: "structure_mapping_not_found",
      materialId,
    });
  }

  const material = structureStore.getByMaterialId(materialId);
  if (!material) {
    return res.json({
      available: false,
      reason: "no_approved_structure",
      materialId,
    });
  }

  return res.json({ available: true, material });
});

// ====== HAZOP analysis workspace ======
app.get("/hazop/status", hazopRoute(async (req, res, session) => {
  res.json(await hazopService.getStatus(session));
}));

app.get("/hazop/lines", hazopRoute(async (req, res, session) => {
  const items = await hazopService.listLines(session);
  res.json({ datasetId: "HAZOP_DA_H_R_V1", items });
}));

app.get("/hazop/line/:lineCode/processes", hazopRoute(async (req, res, session) => {
  const lineCode = String(req.params.lineCode || "").trim().toUpperCase();
  const items = await hazopService.listProcesses(session, lineCode);
  res.json({ lineCode, items });
}));

app.get("/hazop/process/:processId/scenarios", hazopRoute(async (req, res, session) => {
  const processId = String(req.params.processId || "").trim();
  const q = String(req.query.q || "").trim();
  const limit = Number(req.query.limit || 300);
  const items = await hazopService.listScenarios(session, processId, { q, limit });
  res.json({ processId, q, items });
}));

app.get("/hazop/scenario/:scenarioId", hazopRoute(async (req, res, session) => {
  const scenarioId = String(req.params.scenarioId || "").trim();
  const detail = await hazopService.getScenario(session, scenarioId);
  if (!detail) {
    return res.status(404).json({ error: "HAZOP scenario not found", scenarioId });
  }
  return res.json({ available: true, ...detail });
}));

// ====== Standard rules domain (isolated Neo4j instance only) ======
app.get("/standard-rules/status", standardRulesRoute(async (req, res, session) => {
  res.json(await standardRulesService.getStatus(session));
}));

app.get("/standard-rules/rules", standardRulesRoute(async (req, res, session) => {
  res.json(await standardRulesService.listRules(session, { q: String(req.query.q || ""), limit: Number(req.query.limit || 300) }));
}));

app.get("/standard-rules/rule/:ruleId", standardRulesRoute(async (req, res, session) => {
  const ruleId = String(req.params.ruleId || "");
  const rule = await standardRulesService.getRule(session, ruleId);
  if (!rule) return res.status(404).json({ error: "Standard rule not found", ruleId });
  return res.json(rule);
}));

app.get("/graph/standard-rule/:ruleId", standardRulesRoute(async (req, res, session) => {
  const ruleId = String(req.params.ruleId || "");
  const graph = await standardRulesService.getRuleGraph(session, ruleId, { edgeLimit: Number(req.query.edgeLimit || 100) });
  if (!graph) return res.status(404).json({ error: "Standard rule not found", ruleId });
  return res.json(graph);
}));

// ====== Health ======
app.get("/health", async (req, res) => {
  const session = driver.session();
  try {
    const r = await session.run("RETURN 1 AS ok");
    res.json({
      ok: r.records[0].get("ok"),
      neo4j: {
        uri: NEO4J_URI,
        user: NEO4J_USER,
        passwordProvided: Boolean(NEO4J_PASS),
      },
    });
  } catch (e) {
    res.status(500).json({
      error: String(e),
      hint: "请确认 Neo4j 已启动，并且已设置 NEO4J_URI / NEO4J_USER / NEO4J_PASS 环境变量。",
    });
  } finally {
    await session.close();
  }
});

// ====== Debug schema ======
app.get("/debug/schema", async (req, res) => {
  const session = driver.session();
  try {
    const labels = await session.run(`
      MATCH (n)
      RETURN labels(n) AS labels, keys(n) AS keys, count(n) AS count
      ORDER BY count DESC
      LIMIT 50
    `);

    const rels = await session.run(`
      MATCH ()-[r]->()
      RETURN type(r) AS type, keys(r) AS keys, count(r) AS count
      ORDER BY count DESC
      LIMIT 50
    `);

    const samples = await session.run(`
      MATCH (a)-[r]->(b)
      RETURN
        labels(a) AS aLabels,
        properties(a) AS aProps,
        type(r) AS relType,
        properties(r) AS relProps,
        labels(b) AS bLabels,
        properties(b) AS bProps
      LIMIT 30
    `);

    res.json({
      labels: labels.records.map((r) => ({
        labels: r.get("labels"),
        keys: r.get("keys"),
        count: r.get("count"),
      })),
      relationships: rels.records.map((r) => ({
        type: r.get("type"),
        keys: r.get("keys"),
        count: r.get("count"),
      })),
      samples: samples.records.map((r) => ({
        subject_labels: r.get("aLabels"),
        subject: nodeDisplayName({ properties: r.get("aProps") }, ""),
        relation_type: r.get("relType"),
        relation_name: firstNonEmpty(r.get("relProps")?.relation_name, r.get("relType")),
        object_labels: r.get("bLabels"),
        object: nodeDisplayName({ properties: r.get("bProps") }, ""),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});

// ====== Generic node search ======
// 保留 /materials 路由名以兼容旧前端，但现在搜索的是“所有实体节点”，不是只搜 Material。
app.get("/materials", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const scope = String(req.query.scope || "material");
  const allowedTypes = ["Material", "MaterialFamily"];
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (n:KGNode)
      WHERE (
          $scope = 'all'
          OR (
            ${productCatalogWhere("n")}
            AND n.entity_type IN $allowedTypes
            AND coalesce(n.review_status, 'accepted') = 'accepted'
          )
        )
      WITH
        n,
        toString(id(n)) AS dbId,
        labels(n) AS labels,
        properties(n) AS props,
        coalesce(
          toString(n.name),
          toString(n.raw_name),
          toString(n.id),
          toString(id(n))
        ) AS nameText,
        coalesce(
          toString(n.entity_type),
          head([label IN labels(n) WHERE NOT label IN ['KGNode', 'Entity']]),
          head(labels(n)),
          'Node'
        ) AS groupText,
        toLower(
          coalesce(toString(n.name), '') + ' ' +
          coalesce(toString(n.raw_name), '') + ' ' +
          coalesce(toString(n.description), '') + ' ' +
          coalesce(toString(n.attributes_json), '') + ' ' +
          coalesce(toString(n.id), '')
        ) AS searchableText
      WHERE $q = ''
         OR searchableText CONTAINS toLower($q)
         OR toLower(dbId) CONTAINS toLower($q)
      RETURN n, dbId, labels, props, nameText, groupText
      ORDER BY
        CASE groupText
          WHEN 'Material' THEN 0
          WHEN 'MaterialFamily' THEN 1
          ELSE 9
        END,
        nameText
      LIMIT 100
      `,
      { q, scope, allowedTypes }
    );

    res.json(
      result.records.map((r) => {
        const node = r.get("n");
        const dbId = r.get("dbId");
        const labels = r.get("labels") || [];
        const props = r.get("props") || {};
        return {
          dbId,
          materialId: dbId,
          name: firstNonEmpty(r.get("nameText"), nodeDisplayName(node, dbId)),
          labels,
          group: firstNonEmpty(r.get("groupText"), nodeGroup(labels, props)),
          props: { ...props, _neo4jInternalId: dbId },
        };
      })
    );
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});

// ====== Generic node detail ======
// 保留 /material/:id 路由名以兼容旧前端；现在展示该节点的一跳关系明细。
app.get(["/material/:materialId", "/materials/:materialId"], async (req, res) => {
  const nodeId = req.params.materialId;
  const session = driver.session();

  let limit = parseInt(req.query.limit ?? "1000", 10);
  if (Number.isNaN(limit) || limit < 1) limit = 1000;
  if (limit > 5000) limit = 5000;

  try {
    const result = await session.run(
      `
      MATCH (center)
      WHERE toString(id(center)) = $nodeId
         OR toString(center.materialId) = $nodeId
         OR toString(center.id) = $nodeId
      WITH center LIMIT 1
      OPTIONAL MATCH (center)-[r]-(neighbor)
      RETURN
        center,
        id(center) AS centerId,
        labels(center) AS centerLabels,
        r,
        neighbor,
        id(neighbor) AS neighborId,
        labels(neighbor) AS neighborLabels,
        CASE WHEN r IS NULL THEN null ELSE id(startNode(r)) END AS startId,
        CASE WHEN r IS NULL THEN null ELSE id(endNode(r)) END AS endId
      LIMIT toInteger($limit)
      `,
      { nodeId, limit }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ error: "Node not found" });
    }

    const first = result.records[0];
    const center = first.get("center");
    const centerId = first.get("centerId");
    const centerLabels = first.get("centerLabels") || [];
    const centerNode = normalizeNode(center, centerId, centerLabels);

    const rows = [];
    for (const rec of result.records) {
      const rel = safeGet(rec, "r");
      const neighbor = safeGet(rec, "neighbor");
      if (!rel || !neighbor) continue;
      rows.push(
        normalizeRelationshipRow(
          centerId,
          center,
          centerLabels,
          rel,
          neighbor,
          safeGet(rec, "neighborId"),
          safeGet(rec, "neighborLabels") || [],
          safeGet(rec, "startId"),
          safeGet(rec, "endId")
        )
      );
    }

    res.json({
      materialDbId: centerNode.dbId,
      materialId: centerNode.dbId,
      materialName: centerNode.name,
      node: centerNode,
      rows,
      relationshipCount: rows.length,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});

// ====== Generic graph API ======
// 展开被选节点的一跳关系，适配 subject/object/relation_type 这类普通知识图谱结构。
app.get("/material/:materialId/graph", async (req, res) => {
  const nodeId = req.params.materialId;
  const session = driver.session();

  let limit = parseInt(req.query.limit ?? "800", 10);
  if (Number.isNaN(limit) || limit < 1) limit = 800;
  if (limit > 5000) limit = 5000;

  try {
    const result = await session.run(
      `
      MATCH (center)
      WHERE toString(id(center)) = $nodeId
         OR toString(center.materialId) = $nodeId
         OR toString(center.id) = $nodeId
      WITH center LIMIT 1
      OPTIONAL MATCH (center)-[r]-(neighbor)
      RETURN
        center,
        id(center) AS centerId,
        labels(center) AS centerLabels,
        r,
        neighbor,
        id(neighbor) AS neighborId,
        labels(neighbor) AS neighborLabels,
        CASE WHEN r IS NULL THEN null ELSE id(startNode(r)) END AS startId,
        CASE WHEN r IS NULL THEN null ELSE id(endNode(r)) END AS endId
      LIMIT toInteger($limit)
      `,
      { nodeId, limit }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ error: "Node not found" });
    }

    const nodesMap = new Map();
    const edgesMap = new Map();

    const addNode = (node, internalId, labels) => {
      if (!node || internalId === null || internalId === undefined) return null;
      const normalized = normalizeNode(node, internalId, labels || []);
      const graphId = `n:${normalized.dbId}`;
      if (!nodesMap.has(graphId)) {
        nodesMap.set(graphId, {
          id: graphId,
          label: normalized.name,
          group: normalized.group,
          labels: normalized.labels,
          props: normalized.props,
        });
      }
      return graphId;
    };

    const addEdge = (rel, startId, endId) => {
      if (!rel || startId === null || startId === undefined || endId === null || endId === undefined) return;
      const rp = relProps(rel);
      const edgeId = `r:${toText(rel.identity)}`;
      if (!edgesMap.has(edgeId)) {
        edgesMap.set(edgeId, {
          id: edgeId,
          from: `n:${toText(startId)}`,
          to: `n:${toText(endId)}`,
          type: firstNonEmpty(rp.relation_name, rp.name, rel.type),
          relationType: rel.type,
          props: { ...rp, _neo4jInternalId: toText(rel.identity), _neo4jType: rel.type },
        });
      }
    };

    for (const rec of result.records) {
      addNode(safeGet(rec, "center"), safeGet(rec, "centerId"), safeGet(rec, "centerLabels") || []);
      addNode(safeGet(rec, "neighbor"), safeGet(rec, "neighborId"), safeGet(rec, "neighborLabels") || []);
      addEdge(safeGet(rec, "r"), safeGet(rec, "startId"), safeGet(rec, "endId"));
    }

    res.json({
      materialId: nodeId,
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});



// ====== Material graph APIs ======
// V9.2 展示原则：总览只展示物料层级和危险类别；属性、证据和长文本按实体展开。
const MATERIAL_OVERVIEW_TYPES = [
  "Material", "MaterialCategory", "HazardClassification",
];
const MATERIAL_OVERVIEW_RELATIONS = [
  "BELONGS_TO_CATEGORY", "HAS_HAZARD_CLASS",
];
const MATERIAL_CORE_TYPES = [
  "MaterialFamily", "MaterialCategory", "HazardClassification", "HazardFactor",
  "ExposureRoute", "HealthEffect", "ChemicalComponent", "ComponentGroup",
  "FirefightingAgent", "ControlMeasure",
];
const MATERIAL_CORE_RELATIONS = [
  "HAS_VARIANT", "BELONGS_TO_CATEGORY", "HAS_HAZARD_CLASS", "HAS_HAZARD",
  "HAS_EXPOSURE_ROUTE", "CAUSES_HEALTH_EFFECT", "CONTAINS_COMPONENT",
  "ALLOWS_FIREFIGHTING_AGENT", "PROHIBITS_FIREFIGHTING_AGENT",
  "INEFFECTIVE_FIREFIGHTING_AGENT", "REQUIRES_CONTROL_MEASURE", "INCOMPATIBLE_WITH",
];

function makeGraphCollectors() {
  const nodesMap = new Map();
  const edgesMap = new Map();

  const addNode = (node, internalId, labels) => {
    if (!node || internalId === null || internalId === undefined) return null;
    const normalized = normalizeNode(node, internalId, labels || []);
    const graphId = `n:${normalized.dbId}`;
    if (!nodesMap.has(graphId)) {
      nodesMap.set(graphId, {
        id: graphId,
        label: normalized.name,
        group: normalized.group,
        labels: normalized.labels,
        props: normalized.props,
      });
    }
    return graphId;
  };

  const addEdge = (rel, startId, endId, extraProps = {}) => {
    if (!rel || startId === null || startId === undefined || endId === null || endId === undefined) return;
    const rp = relProps(rel);
    const parsed = parseJsonObject(rp.properties_json);
    const merged = { ...parsed, ...rp, ...extraProps };
    const edgeId = `r:${toText(rel.identity)}`;
    if (!edgesMap.has(edgeId)) {
      edgesMap.set(edgeId, {
        id: edgeId,
        from: `n:${toText(startId)}`,
        to: `n:${toText(endId)}`,
        type: firstNonEmpty(rp.relation_name, rp.name, rel.type),
        relationType: rel.type,
        props: { ...merged, _neo4jInternalId: toText(rel.identity), _neo4jType: rel.type },
      });
    }
  };

  return { nodesMap, edgesMap, addNode, addEdge };
}

// 物料总览：仅显示 家族 → 型号 → 类别/危险类别，避免证据和属性节点形成毛线团。
app.get("/graph/material-overview", async (req, res) => {
  const session = driver.session();
  let nodeLimit = parseInt(req.query.nodeLimit ?? "600", 10);
  let edgeLimit = parseInt(req.query.edgeLimit ?? "1200", 10);
  if (Number.isNaN(nodeLimit) || nodeLimit < 1) nodeLimit = 600;
  if (Number.isNaN(edgeLimit) || edgeLimit < 0) edgeLimit = 1200;
  nodeLimit = Math.min(nodeLimit, 1500);
  edgeLimit = Math.min(edgeLimit, 4000);

  try {
    const countResult = await session.run(`
      MATCH (n:KGNode)
      WHERE ${productCatalogWhere("n")}
        AND coalesce(n.review_status, 'accepted') = 'accepted'
        AND n.entity_type IN $types
      WITH count(n) AS nodeCount
      OPTIONAL MATCH (a:KGNode)-[r]->(b:KGNode)
      WHERE ${productCatalogWhere("a")}
        AND ${productCatalogWhere("b")}
        AND coalesce(r.review_status, 'accepted') = 'accepted'
        AND type(r) IN $relations
        AND a.entity_type IN $types AND b.entity_type IN $types
      RETURN nodeCount, count(r) AS edgeCount
    `, { types: MATERIAL_OVERVIEW_TYPES, relations: MATERIAL_OVERVIEW_RELATIONS });

    const nodeResult = await session.run(`
      MATCH (n:KGNode)
      WHERE ${productCatalogWhere("n")}
        AND coalesce(n.review_status, 'accepted') = 'accepted'
        AND n.entity_type IN $types
      RETURN n, id(n) AS nodeId, labels(n) AS labels
      ORDER BY CASE n.entity_type
        WHEN 'MaterialFamily' THEN 0
        WHEN 'Material' THEN 1
        WHEN 'MaterialCategory' THEN 2
        ELSE 3 END,
        coalesce(n.name, ''), id(n)
      LIMIT toInteger($nodeLimit)
    `, { types: MATERIAL_OVERVIEW_TYPES, nodeLimit });

    const { nodesMap, edgesMap, addNode, addEdge } = makeGraphCollectors();
    const nodeIds = [];
    for (const rec of nodeResult.records) {
      const nodeId = rec.get("nodeId");
      nodeIds.push(nodeId);
      addNode(rec.get("n"), nodeId, rec.get("labels") || []);
    }

    if (nodeIds.length && edgeLimit > 0) {
      const edgeResult = await session.run(`
        MATCH (a)-[r]->(b)
        WHERE id(a) IN $nodeIds AND id(b) IN $nodeIds
          AND type(r) IN $relations
          AND coalesce(r.review_status, 'accepted') = 'accepted'
        OPTIONAL MATCH (e:Evidence {id:r.evidence_id})
        RETURN r, id(startNode(r)) AS startId, id(endNode(r)) AS endId,
               properties(e) AS evidenceProps
        ORDER BY id(r)
        LIMIT toInteger($edgeLimit)
      `, { nodeIds, relations: MATERIAL_OVERVIEW_RELATIONS, edgeLimit });
      for (const rec of edgeResult.records) {
        const ep = rec.get("evidenceProps") || {};
        const ea = parseJsonObject(ep.attributes_json);
        addEdge(rec.get("r"), rec.get("startId"), rec.get("endId"), {
          source_doc_resolved: ep.source_doc || "",
          source_sheet: ea.sheet_name || "",
          source_cell: ea.cell_address || ep.name || "",
          source_field: ea.field_name || ep.raw_name || "",
          source_text: ep.description || "",
        });
      }
    }

    const first = countResult.records[0];
    res.json({
      mode: "material",
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
      meta: {
        nodeLimit,
        edgeLimit,
        returnedNodes: nodesMap.size,
        returnedEdges: edgesMap.size,
        totalNodes: first?.get("nodeCount") ?? nodesMap.size,
        totalEdges: first?.get("edgeCount") ?? edgesMap.size,
        description: "物料总览仅展示具体物料、物料类别和危险分类；单型号家族不重复显示。",
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});

// 单个物料分层展示：core=风险特性，properties=属性与测量值，full=一跳但隐藏证据。
app.get("/graph/material/:materialId", async (req, res) => {
  const nodeId = req.params.materialId;
  const view = String(req.query.view || "core");
  const session = driver.session();
  let edgeLimit = parseInt(req.query.edgeLimit ?? "500", 10);
  if (Number.isNaN(edgeLimit) || edgeLimit < 1) edgeLimit = 500;
  edgeLimit = Math.min(edgeLimit, 1500);

  try {
    let result;
    if (view === "properties") {
      result = await session.run(`
        MATCH (center:Material)
        WHERE (toString(id(center)) = $nodeId OR toString(center.id) = $nodeId)
          AND center.entity_type = 'Material'
        WITH center LIMIT 1
        CALL {
          WITH center
          MATCH (center)-[r:HAS_MATERIAL_PROPERTY]->(neighbor:MaterialProperty)
          WHERE coalesce(r.review_status, 'accepted') = 'accepted'
          RETURN r, neighbor, id(neighbor) AS neighborId, labels(neighbor) AS neighborLabels,
                 id(startNode(r)) AS startId, id(endNode(r)) AS endId
          UNION ALL
          WITH center
          MATCH (center)-[:HAS_MATERIAL_PROPERTY]->(:MaterialProperty)-[r:HAS_MEASUREMENT]->(neighbor:PropertyMeasurement)
          WHERE coalesce(r.review_status, 'accepted') = 'accepted'
          RETURN r, neighbor, id(neighbor) AS neighborId, labels(neighbor) AS neighborLabels,
                 id(startNode(r)) AS startId, id(endNode(r)) AS endId
        }
        RETURN center, id(center) AS centerId, labels(center) AS centerLabels,
               r, neighbor, neighborId, neighborLabels, startId, endId
        LIMIT toInteger($edgeLimit)
      `, { nodeId, edgeLimit });
    } else if (view === "full") {
      result = await session.run(`
        MATCH (center:Material)
        WHERE (toString(id(center)) = $nodeId OR toString(center.id) = $nodeId)
          AND center.entity_type = 'Material'
        WITH center LIMIT 1
        OPTIONAL MATCH (center)-[r]-(neighbor)
        WHERE coalesce(r.review_status, 'accepted') = 'accepted'
          AND NOT neighbor.entity_type IN ['Evidence', 'Document', 'Dataset']
        RETURN center, id(center) AS centerId, labels(center) AS centerLabels,
               r, neighbor, id(neighbor) AS neighborId, labels(neighbor) AS neighborLabels,
               CASE WHEN r IS NULL THEN null ELSE id(startNode(r)) END AS startId,
               CASE WHEN r IS NULL THEN null ELSE id(endNode(r)) END AS endId
        LIMIT toInteger($edgeLimit)
      `, { nodeId, edgeLimit });
    } else {
      result = await session.run(`
        MATCH (center:Material)
        WHERE (toString(id(center)) = $nodeId OR toString(center.id) = $nodeId)
          AND center.entity_type = 'Material'
        WITH center LIMIT 1
        OPTIONAL MATCH (center)-[r]-(neighbor)
        WHERE coalesce(r.review_status, 'accepted') = 'accepted'
          AND neighbor.entity_type IN $types
          AND type(r) IN $relations
        RETURN center, id(center) AS centerId, labels(center) AS centerLabels,
               r, neighbor, id(neighbor) AS neighborId, labels(neighbor) AS neighborLabels,
               CASE WHEN r IS NULL THEN null ELSE id(startNode(r)) END AS startId,
               CASE WHEN r IS NULL THEN null ELSE id(endNode(r)) END AS endId
        LIMIT toInteger($edgeLimit)
      `, {
        nodeId,
        edgeLimit,
        types: MATERIAL_CORE_TYPES,
        relations: MATERIAL_CORE_RELATIONS,
      });
    }

    if (!result.records.length) return res.status(404).json({ error: "Node not found" });
    const { nodesMap, edgesMap, addNode, addEdge } = makeGraphCollectors();
    for (const rec of result.records) {
      addNode(rec.get("center"), rec.get("centerId"), rec.get("centerLabels") || []);
      addNode(safeGet(rec, "neighbor"), safeGet(rec, "neighborId"), safeGet(rec, "neighborLabels") || []);
      addEdge(safeGet(rec, "r"), safeGet(rec, "startId"), safeGet(rec, "endId"));
    }

    res.json({
      mode: view,
      materialId: nodeId,
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
      meta: { returnedNodes: nodesMap.size, returnedEdges: edgesMap.size, view },
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});

// ====== Full graph API ======
// 展示全库图谱（带性能保护）：默认取前 1000 个节点、3000 条边。
// 可通过 /graph/all?nodeLimit=3000&edgeLimit=8000 调整。
app.get("/graph/all", async (req, res) => {
  const session = driver.session();

  let nodeLimit = parseInt(req.query.nodeLimit ?? "1000", 10);
  let edgeLimit = parseInt(req.query.edgeLimit ?? "3000", 10);
  if (Number.isNaN(nodeLimit) || nodeLimit < 1) nodeLimit = 1000;
  if (Number.isNaN(edgeLimit) || edgeLimit < 0) edgeLimit = 3000;
  if (nodeLimit > 10000) nodeLimit = 10000;
  if (edgeLimit > 30000) edgeLimit = 30000;

  try {
    const counts = await session.run(`
      MATCH (n)
      WITH count(n) AS nodeCount
      OPTIONAL MATCH ()-[r]->()
      RETURN nodeCount, count(r) AS edgeCount
    `);

    const nodeResult = await session.run(
      `
      MATCH (n)
      WITH
        n,
        id(n) AS nodeId,
        labels(n) AS labels,
        coalesce(
          toString(n.name),
          toString(n.id),
          toString(n.title),
          toString(n.label),
          toString(n.subject),
          toString(n.object),
          toString(n.raw),
          toString(id(n))
        ) AS nameText,
        coalesce(head(labels(n)), toString(n.entity_type), toString(n.type), 'Node') AS groupText
      RETURN n, nodeId, labels, nameText, groupText
      ORDER BY nodeId
      LIMIT toInteger($nodeLimit)
      `,
      { nodeLimit }
    );

    const nodesMap = new Map();
    const nodeIds = [];

    const addNode = (node, internalId, labels) => {
      if (!node || internalId === null || internalId === undefined) return null;
      const normalized = normalizeNode(node, internalId, labels || []);
      const graphId = `n:${normalized.dbId}`;
      if (!nodesMap.has(graphId)) {
        nodesMap.set(graphId, {
          id: graphId,
          label: normalized.name,
          group: normalized.group,
          labels: normalized.labels,
          props: normalized.props,
        });
      }
      return graphId;
    };

    for (const rec of nodeResult.records) {
      const nodeId = rec.get("nodeId");
      nodeIds.push(nodeId);
      addNode(rec.get("n"), nodeId, rec.get("labels") || []);
    }

    const edgesMap = new Map();
    const addEdge = (rel, startId, endId) => {
      if (!rel || startId === null || startId === undefined || endId === null || endId === undefined) return;
      const rp = relProps(rel);
      const edgeId = `r:${toText(rel.identity)}`;
      if (!edgesMap.has(edgeId)) {
        edgesMap.set(edgeId, {
          id: edgeId,
          from: `n:${toText(startId)}`,
          to: `n:${toText(endId)}`,
          type: firstNonEmpty(rp.relation_name, rp.name, rel.type),
          relationType: rel.type,
          props: { ...rp, _neo4jInternalId: toText(rel.identity), _neo4jType: rel.type },
        });
      }
    };

    if (nodeIds.length > 0 && edgeLimit > 0) {
      const edgeResult = await session.run(
        `
        MATCH (a)-[r]->(b)
        WHERE id(a) IN $nodeIds AND id(b) IN $nodeIds
        RETURN r, id(startNode(r)) AS startId, id(endNode(r)) AS endId
        ORDER BY id(r)
        LIMIT toInteger($edgeLimit)
        `,
        { nodeIds, edgeLimit }
      );

      for (const rec of edgeResult.records) {
        addEdge(rec.get("r"), rec.get("startId"), rec.get("endId"));
      }
    }

    const firstCount = counts.records[0];
    const totalNodes = firstCount?.get("nodeCount") ?? nodesMap.size;
    const totalEdges = firstCount?.get("edgeCount") ?? edgesMap.size;

    res.json({
      mode: "all",
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
      meta: {
        nodeLimit,
        edgeLimit,
        returnedNodes: nodesMap.size,
        returnedEdges: edgesMap.size,
        totalNodes,
        totalEdges,
        isNodeTruncated: totalNodes > nodesMap.size,
        isEdgeTruncated: totalEdges > edgesMap.size,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});



function getRiskStats(session) {
  return session.run(`
    CALL { MATCH (c:CanonicalMaterial) RETURN count(c) AS canonicalMaterials }
    CALL { MATCH (s:Stimulus) RETURN count(s) AS stimuli }
    CALL { MATCH (a:AreaRule) RETURN count(a) AS areaRules }
    CALL { MATCH (p:ProtectionRule) RETURN count(p) AS protectionRules }
    CALL { MATCH (chain:PredictedRiskChain) RETURN count(chain) AS predictedRiskChains }
    CALL { MATCH ()-[r:NORMALIZED_TO]->() RETURN count(r) AS normalizedLinks }
    CALL { MATCH ()-[r:TRIGGERS_STIMULUS]->() RETURN count(r) AS stimulusLinks }
    CALL { MATCH ()-[r:MATCHES_AREA_RULE]->() RETURN count(r) AS areaRuleLinks }
    RETURN canonicalMaterials, stimuli, areaRules, protectionRules, predictedRiskChains, normalizedLinks, stimulusLinks, areaRuleLinks
  `).then((result) => {
    const r = result.records[0];
    return {
      canonicalMaterials: r.get("canonicalMaterials"),
      stimuli: r.get("stimuli"),
      areaRules: r.get("areaRules"),
      protectionRules: r.get("protectionRules"),
      predictedRiskChains: r.get("predictedRiskChains"),
      normalizedLinks: r.get("normalizedLinks"),
      stimulusLinks: r.get("stimulusLinks"),
      areaRuleLinks: r.get("areaRuleLinks"),
    };
  });
}



function compactUnique(items, keyFn = (x) => JSON.stringify(x)) {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    if (item === null || item === undefined) continue;
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function graphFromRiskRecords(records, mode = "risk") {
  const nodesMap = new Map();
  const edgesMap = new Map();

  const addNode = (node, internalId, labels) => {
    if (!node || internalId === null || internalId === undefined) return null;
    const normalized = normalizeNode(node, internalId, labels || []);
    const graphId = `n:${normalized.dbId}`;
    if (!nodesMap.has(graphId)) {
      nodesMap.set(graphId, {
        id: graphId,
        label: normalized.name,
        group: normalized.group,
        labels: normalized.labels,
        props: normalized.props,
      });
    }
    return graphId;
  };

  const addEdge = (rel, startId, endId, extraProps = {}) => {
    if (!rel || startId === null || startId === undefined || endId === null || endId === undefined) return;
    const rp = relProps(rel);
    const parsed = parseJsonObject(rp.properties_json);
    const merged = { ...parsed, ...rp, ...extraProps };
    const edgeId = `r:${toText(rel.identity)}`;
    if (!edgesMap.has(edgeId)) {
      edgesMap.set(edgeId, {
        id: edgeId,
        from: `n:${toText(startId)}`,
        to: `n:${toText(endId)}`,
        type: firstNonEmpty(rp.relation_name, rp.name, rel.type),
        relationType: rel.type,
        props: { ...merged, _neo4jInternalId: toText(rel.identity), _neo4jType: rel.type },
      });
    }
  };

  for (const rec of records) {
    addNode(safeGet(rec, "a"), safeGet(rec, "aId"), safeGet(rec, "aLabels") || []);
    addNode(safeGet(rec, "b"), safeGet(rec, "bId"), safeGet(rec, "bLabels") || []);
    addEdge(safeGet(rec, "r"), safeGet(rec, "startId"), safeGet(rec, "endId"));
  }

  return {
    mode,
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
  };
}

// ====== Risk prediction graph APIs ======
app.get("/risk/stats", async (req, res) => {
  const session = driver.session();
  try {
    res.json(await getRiskStats(session));
  } catch (e) {
    res.status(500).json({ error: String(e), hint: "请先在 server 目录执行 npm run risk:infer 生成预测链路。" });
  } finally {
    await session.close();
  }
});

// 从可视化界面一键构建/刷新预测链路。本地开发工具，等同于在 server 目录执行 npm run risk:infer。
app.post("/risk/infer", async (req, res) => {
  const script = path.join(__dirname, "scripts", "risk-graph.js");
  execFile(
    process.execPath,
    [script, "infer", "--rules", path.join(__dirname, "..", "data", "risk_rules.tsv")],
    {
      cwd: __dirname,
      env: { ...process.env, NEO4J_URI, NEO4J_USER, NEO4J_PASS },
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 8,
    },
    async (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({
          ok: false,
          error: String(error.message || error),
          stdout,
          stderr,
          hint: "请确认 Neo4j 已启动、密码环境变量正确，并且 server/scripts/risk-graph.js 存在。",
        });
      }

      const session = driver.session();
      try {
        const stats = await getRiskStats(session);
        res.json({ ok: true, stdout, stderr, stats });
      } catch (e) {
        res.json({ ok: true, stdout, stderr, statsError: String(e) });
      } finally {
        await session.close();
      }
    }
  );
});


// 规则匹配链路清单：给前端表格展示“哪条预测链路匹配了哪条规则、依据是什么”。
app.get("/risk/chains", async (req, res) => {
  const session = driver.session();
  let limit = parseInt(req.query.limit ?? "120", 10);
  if (Number.isNaN(limit) || limit < 1) limit = 120;
  if (limit > 500) limit = 500;
  const onlyWithRules = String(req.query.onlyWithRules ?? "true") !== "false";
  const q = String(req.query.q ?? "").trim().toLowerCase();

  try {
    const result = await session.run(
      `
      MATCH (chain:PredictedRiskChain)
      WHERE ($onlyWithRules = false OR EXISTS { MATCH (chain)-[:SUPPORTED_BY_AREA_RULE]->(:AreaRule) })
      OPTIONAL MATCH (chain)-[:IN_PROCESS]->(p)
      OPTIONAL MATCH (chain)-[:INVOLVES_MATERIAL]->(cm:CanonicalMaterial)
      OPTIONAL MATCH (chain)-[:HAS_ORIGINAL_MATERIAL]->(om)
      OPTIONAL MATCH (chain)-[:HAS_HAZARD_FACTOR]->(h)
      OPTIONAL MATCH (chain)-[:TRIGGERED_BY]->(s:Stimulus)
      OPTIONAL MATCH (chain)-[:PREDICTS]->(e)
      OPTIONAL MATCH (chain)-[:MITIGATED_BY]->(c)
      OPTIONAL MATCH (chain)-[:MONITORED_BY]->(v)
      OPTIONAL MATCH (chain)-[:SUPPORTED_BY_AREA_RULE]->(ar:AreaRule)-[:HAS_DANGER_ZONE]->(z:DangerZone)
      OPTIONAL MATCH (p)-[matchRel:MATCHES_AREA_RULE|CANDIDATE_MATCHES_AREA_RULE]->(ar)
      OPTIONAL MATCH (chain)-[:REQUIRES_PROTECTION]->(pr:ProtectionRule)
      WITH chain, p, cm, h, s,
        collect(DISTINCT om) AS originalMaterials,
        collect(DISTINCT e) AS events,
        collect(DISTINCT c) AS controls,
        collect(DISTINCT v) AS monitors,
        collect(DISTINCT pr) AS protections,
        collect(DISTINCT {
          id: id(ar),
          name: ar.name,
          category: ar.category,
          operation: ar.operation,
          zone: coalesce(ar.zone, z.name),
          condition: ar.condition,
          evidence: ar.evidence,
          sourceDoc: ar.source_doc,
          sourceSection: ar.source_section,
          sourceLocation: ar.source_location,
          ruleConfidence: ar.confidence,
          matchMethod: matchRel.method,
          matchConfidence: matchRel.confidence,
          matchMaterial: matchRel.material,
          matchRelation: matchRel.relation_name
        }) AS areaRules
      WITH chain, p, cm, h, s, originalMaterials, events, controls, monitors, protections,
        [r IN areaRules WHERE r.id IS NOT NULL] AS areaRules
      CALL {
        WITH p, h, originalMaterials, events, controls, monitors
        WITH [node IN ([p, h] + originalMaterials + events + controls + monitors) WHERE node IS NOT NULL] AS traceNodes
        UNWIND traceNodes AS traceNode
        OPTIONAL MATCH (traceNode)-[tr]-(other)
        WHERE other IN traceNodes
          AND coalesce(tr.source_doc, '') <> ''
        WITH collect(DISTINCT {
          factId: tr.fact_id,
          relationName: tr.relation_name,
          sourceDoc: tr.source_doc,
          sourceSection: tr.source_section,
          sourceLocation: tr.source_location,
          evidence: tr.evidence,
          confidence: tr.confidence
        }) AS collected
        RETURN [item IN collected WHERE item.sourceDoc IS NOT NULL AND item.sourceDoc <> ''] AS provenance
      }
      WITH chain, p, cm, h, s, originalMaterials, events, controls, monitors, protections, areaRules, provenance
      WHERE $q = '' OR toLower(coalesce(chain.name, '') + ' ' + coalesce(chain.process, '') + ' ' + coalesce(chain.material, '') + ' ' + coalesce(chain.stimulus, '') + ' ' + coalesce(chain.hazard_factor, '') + ' ' + coalesce(p.name, '') + ' ' + coalesce(cm.name, '') + ' ' + coalesce(h.name, '') + ' ' + coalesce(s.name, '')) CONTAINS $q
      RETURN
        id(chain) AS chainDbId,
        chain.chain_id AS chainId,
        chain.name AS chainName,
        chain.confidence AS confidence,
        chain.source AS source,
        chain.process AS processText,
        chain.material AS materialText,
        chain.hazard_factor AS hazardText,
        chain.stimulus AS stimulusText,
        p.name AS processName,
        id(p) AS processDbId,
        cm.name AS materialName,
        h.name AS hazardName,
        id(h) AS hazardDbId,
        s.name AS stimulusName,
        [x IN originalMaterials WHERE x IS NOT NULL | {id:id(x), name:x.name, type:coalesce(x.entity_type, head(labels(x))) }] AS originalMaterials,
        [x IN events WHERE x IS NOT NULL | {id:id(x), name:x.name, type:coalesce(x.entity_type, head(labels(x))) }] AS events,
        [x IN controls WHERE x IS NOT NULL | {id:id(x), name:x.name, type:coalesce(x.entity_type, head(labels(x))) }] AS controls,
        [x IN monitors WHERE x IS NOT NULL | {id:id(x), name:x.name, type:coalesce(x.entity_type, head(labels(x))) }] AS monitors,
        [x IN protections WHERE x IS NOT NULL | {id:id(x), name:x.name, zone:x.zone, epl:x.epl, ip:x.ip }] AS protections,
        areaRules,
        provenance
      ORDER BY size(areaRules) DESC, coalesce(confidence, 0) DESC, chainDbId
      LIMIT toInteger($limit)
      `,
      { limit, onlyWithRules, q }
    );

    const rows = result.records.map((r) => {
      const areaRules = compactUnique(r.get("areaRules") || [], (x) => `${x.id}|${x.matchMethod}|${x.matchConfidence}`);
      const provenance = compactUnique(
        r.get("provenance") || [],
        (x) => `${x.sourceDoc}|${x.sourceSection}|${x.sourceLocation}|${x.factId}|${x.relationName}|${x.evidence}`
      );
      return {
        chainDbId: r.get("chainDbId"),
        graphNodeId: `n:${toText(r.get("chainDbId"))}`,
        chainId: r.get("chainId"),
        name: r.get("chainName"),
        confidence: r.get("confidence"),
        source: r.get("source"),
        process: firstNonEmpty(r.get("processName"), r.get("processText")),
        processDbId: r.get("processDbId"),
        material: firstNonEmpty(r.get("materialName"), r.get("materialText")),
        hazardFactor: firstNonEmpty(r.get("hazardName"), r.get("hazardText")),
        hazardDbId: r.get("hazardDbId"),
        stimulus: firstNonEmpty(r.get("stimulusName"), r.get("stimulusText")),
        originalMaterials: compactUnique(r.get("originalMaterials") || [], (x) => `${x.id}|${x.name}`),
        events: compactUnique(r.get("events") || [], (x) => `${x.id}|${x.name}`),
        controls: compactUnique(r.get("controls") || [], (x) => `${x.id}|${x.name}`),
        monitors: compactUnique(r.get("monitors") || [], (x) => `${x.id}|${x.name}`),
        protections: compactUnique(r.get("protections") || [], (x) => `${x.id}|${x.name}|${x.zone}`),
        areaRules,
        provenance,
        hasRuleMatch: areaRules.length > 0,
      };
    });

    res.json({
      rows,
      meta: {
        limit,
        onlyWithRules,
        q,
        returned: rows.length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e), hint: "请先执行 npm run risk:infer 生成 PredictedRiskChain 与规则匹配关系。" });
  } finally {
    await session.close();
  }
});

// 单条预测链路图：用于点击清单后只看这一条链路的完整规则路径。
app.get("/graph/risk-chain/:chainId", async (req, res) => {
  const session = driver.session();
  const chainId = String(req.params.chainId || "");
  const chainDbId = Number.parseInt(chainId.replace(/^n:/, ""), 10);

  try {
    const result = await session.run(
      `
      MATCH (chain:PredictedRiskChain)
      WHERE id(chain) = $chainDbId OR chain.chain_id = $chainId
      MATCH (chain)-[r]-(n)
      WHERE any(label IN labels(n) WHERE label IN [
        'Process', 'Material', 'CanonicalMaterial', 'Stimulus', 'HazardFactor', 'RiskEvent',
        'ControlMeasure', 'MonitorVariable', 'Parameter', 'DangerZone', 'AreaRule',
        'ProtectionRule', 'Equipment', 'ManagementRule', 'RuleCategory'
      ]) OR coalesce(n.entity_type, '') IN [
        'Process', 'Material', 'CanonicalMaterial', 'Stimulus', 'HazardFactor', 'RiskEvent',
        'ControlMeasure', 'MonitorVariable', 'Parameter', 'DangerZone', 'AreaRule',
        'ProtectionRule', 'Equipment', 'ManagementRule', 'RuleCategory'
      ]
      RETURN
        chain AS a,
        id(chain) AS aId,
        labels(chain) AS aLabels,
        r,
        n AS b,
        id(n) AS bId,
        labels(n) AS bLabels,
        id(startNode(r)) AS startId,
        id(endNode(r)) AS endId
      LIMIT 500
      `,
      { chainDbId: Number.isNaN(chainDbId) ? -1 : chainDbId, chainId }
    );

    const graph = graphFromRiskRecords(result.records, "riskSingle");
    res.json({
      ...graph,
      meta: {
        chainId,
        returnedNodes: graph.nodes.length,
        returnedEdges: graph.edges.length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e), hint: "请确认该 PredictedRiskChain 仍存在。" });
  } finally {
    await session.close();
  }
});

// 预测链路视图：只展示 PredictedRiskChain 及其关联的工序、物料、刺激、事件、控制措施、监测变量、区域规则。
app.get("/graph/risk-chains", async (req, res) => {
  const session = driver.session();

  let chainLimit = parseInt(req.query.chainLimit ?? req.query.nodeLimit ?? "200", 10);
  let edgeLimit = parseInt(req.query.edgeLimit ?? "2500", 10);
  if (Number.isNaN(chainLimit) || chainLimit < 1) chainLimit = 200;
  if (Number.isNaN(edgeLimit) || edgeLimit < 1) edgeLimit = 2500;
  if (chainLimit > 2000) chainLimit = 2000;
  if (edgeLimit > 20000) edgeLimit = 20000;

  try {
    const counts = await session.run(`
      MATCH (chain:PredictedRiskChain)
      WITH count(chain) AS chainCount
      OPTIONAL MATCH (chain:PredictedRiskChain)-[r]-()
      RETURN chainCount, count(r) AS edgeCount
    `);

    const result = await session.run(
      `
      MATCH (chain:PredictedRiskChain)
      WITH chain
      ORDER BY coalesce(chain.confidence, 0) DESC, id(chain)
      LIMIT toInteger($chainLimit)
      MATCH (chain)-[r]-(n)
      WHERE any(label IN labels(n) WHERE label IN [
        'Process', 'Material', 'CanonicalMaterial', 'Stimulus', 'HazardFactor', 'RiskEvent',
        'ControlMeasure', 'MonitorVariable', 'Parameter', 'DangerZone', 'AreaRule',
        'ProtectionRule', 'Equipment', 'ManagementRule', 'RuleCategory'
      ]) OR coalesce(n.entity_type, '') IN [
        'Process', 'Material', 'CanonicalMaterial', 'Stimulus', 'HazardFactor', 'RiskEvent',
        'ControlMeasure', 'MonitorVariable', 'Parameter', 'DangerZone', 'AreaRule',
        'ProtectionRule', 'Equipment', 'ManagementRule', 'RuleCategory'
      ]
      RETURN
        chain AS a,
        id(chain) AS aId,
        labels(chain) AS aLabels,
        r,
        n AS b,
        id(n) AS bId,
        labels(n) AS bLabels,
        id(startNode(r)) AS startId,
        id(endNode(r)) AS endId
      LIMIT toInteger($edgeLimit)
      `,
      { chainLimit, edgeLimit }
    );

    const nodesMap = new Map();
    const edgesMap = new Map();

    const addNode = (node, internalId, labels) => {
      if (!node || internalId === null || internalId === undefined) return null;
      const normalized = normalizeNode(node, internalId, labels || []);
      const graphId = `n:${normalized.dbId}`;
      if (!nodesMap.has(graphId)) {
        nodesMap.set(graphId, {
          id: graphId,
          label: normalized.name,
          group: normalized.group,
          labels: normalized.labels,
          props: normalized.props,
        });
      }
      return graphId;
    };

    const addEdge = (rel, startId, endId) => {
      if (!rel || startId === null || startId === undefined || endId === null || endId === undefined) return;
      const rp = relProps(rel);
      const edgeId = `r:${toText(rel.identity)}`;
      if (!edgesMap.has(edgeId)) {
        edgesMap.set(edgeId, {
          id: edgeId,
          from: `n:${toText(startId)}`,
          to: `n:${toText(endId)}`,
          type: firstNonEmpty(rp.relation_name, rp.name, rel.type),
          relationType: rel.type,
          props: { ...rp, _neo4jInternalId: toText(rel.identity), _neo4jType: rel.type },
        });
      }
    };

    for (const rec of result.records) {
      addNode(rec.get("a"), rec.get("aId"), rec.get("aLabels") || []);
      addNode(rec.get("b"), rec.get("bId"), rec.get("bLabels") || []);
      addEdge(rec.get("r"), rec.get("startId"), rec.get("endId"));
    }

    const firstCount = counts.records[0];
    const totalChains = firstCount?.get("chainCount") ?? 0;
    const totalEdges = firstCount?.get("edgeCount") ?? edgesMap.size;

    res.json({
      mode: "risk",
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
      meta: {
        chainLimit,
        edgeLimit,
        returnedNodes: nodesMap.size,
        returnedEdges: edgesMap.size,
        totalChains,
        totalEdges,
        isChainTruncated: totalChains > chainLimit,
        isEdgeTruncated: totalEdges > edgesMap.size,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e), hint: "请先执行 npm run risk:infer 生成 PredictedRiskChain。" });
  } finally {
    await session.close();
  }
});

// ====== Node Info API ======
// 支持 n:<Neo4j内部id>，也兼容旧版 m:/p:/v: 前缀。
app.get("/node/:nodeId", async (req, res) => {
  const nodeId = req.params.nodeId;
  const session = driver.session();
  try {
    const sep = nodeId.indexOf(":");
    const key = sep > 0 ? nodeId.slice(sep + 1) : nodeId;
    const nodeInternalId = Number.parseInt(key, 10);
    if (Number.isNaN(nodeInternalId)) {
      return res.status(400).json({ error: "bad Neo4j internal id" });
    }

    const r = await session.run(
      `
      MATCH (n)
      WHERE id(n) = $id
      OPTIONAL MATCH (n)-[rel]-()
      RETURN n,
             labels(n) AS labels,
             count(rel) AS relationshipCount,
             collect(DISTINCT CASE
               WHEN coalesce(rel.source_doc, '') <> '' THEN {
                 factId: rel.fact_id,
                 relationName: rel.relation_name,
                 sourceDoc: rel.source_doc,
                 sourceSection: rel.source_section,
                 sourceLocation: rel.source_location,
                 evidence: rel.evidence,
                 confidence: rel.confidence
               }
             END) AS provenance
      `,
      { id: nodeInternalId }
    );

    if (r.records.length === 0) return res.status(404).json({ error: "not found" });
    const node = r.records[0].get("n");
    const labels = r.records[0].get("labels") || [];
    const normalized = normalizeNode(node, nodeInternalId, labels);

    const directProvenance = r.records[0].get("provenance") || [];
    let tracedProvenance = [];
    let provenanceResolution = directProvenance.length ? "direct_relationship" : "none";

    // PredictedRiskChain is a system-generated result node. Its one-hop edges are
    // organizational/inference edges and normally do not carry source_doc.
    // Resolve provenance through the chain's process/material/hazard/event/control
    // nodes and collect the original extracted fact relations among those nodes.
    if (isPredictedRiskChain(labels)) {
      const traceResult = await session.run(
        PREDICTED_CHAIN_PROVENANCE_QUERY,
        { id: nodeInternalId }
      );
      tracedProvenance = traceResult.records[0]?.get("provenance") || [];
      if (tracedProvenance.length) provenanceResolution = "predicted_chain_support";
    }

    return res.json({
      label: normalized.group,
      labels: normalized.labels,
      nodeId: `n:${normalized.dbId}`,
      name: normalized.name,
      properties: normalized.props,
      relationshipCount: r.records[0].get("relationshipCount"),
      provenanceResolution,
      provenance: mergeProvenance(directProvenance, tracedProvenance),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});


// ====== Demo APIs ======
// Demo只展示“单一材料画像”，不展示全库毛线团。
function parseJsonObject(value) {
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function materialIdentityWhere(alias = "m") {
  return `(toString(id(${alias})) = $nodeId OR toString(${alias}.id) = $nodeId)`;
}

function cleanDisplay(value, fallback = "-") {
  const text = firstNonEmpty(value);
  return text || fallback;
}

function formatMeasurement(props = {}) {
  const value = firstNonEmpty(props.value_num, props.value, props.parsed_value);
  const min = firstNonEmpty(props.min_value_num, props.min_value);
  const max = firstNonEmpty(props.max_value_num, props.max_value);
  const unit = firstNonEmpty(props.unit, "") || "";
  const operator = firstNonEmpty(props.operator, props.qualifier, "") || "";
  if (min && max) return `${operator}${min}–${max}${unit ? ` ${unit}` : ""}`.trim();
  if (value) return `${operator}${value}${unit ? ` ${unit}` : ""}`.trim();
  return firstNonEmpty(props.raw_value, props.description, props.qualitative_level, "-");
}

app.get("/demo/summary", async (req, res) => {
  const session = driver.session();
  try {
    const counts = await session.run(`
      CALL {
        MATCH (m:Material)
        WHERE ${productCatalogWhere("m")} AND coalesce(m.review_status,'accepted')='accepted'
        RETURN count(m) AS materials
      }
      CALL {
        MATCH (c:MaterialCategory)
        WHERE ${productCatalogWhere("c")}
        RETURN count(c) AS categories
      }
      CALL {
        MATCH (h:HazardClassification)
        WHERE ${productCatalogWhere("h")}
        RETURN count(h) AS hazardClasses
      }
      CALL {
        MATCH (p:MaterialProperty)
        WHERE ${productCatalogWhere("p")}
          AND toString(p.numeric_validated) = 'true'
        RETURN count(p) AS numericProperties
      }
      RETURN materials, categories, hazardClasses, numericProperties
    `);

    const categoryStats = await session.run(`
      MATCH (m:Material)-[:BELONGS_TO_CATEGORY]->(c:MaterialCategory)
      WHERE ${productCatalogWhere("m")}
        AND coalesce(m.review_status,'accepted')='accepted'
      RETURN c.name AS name, count(DISTINCT m) AS count
      ORDER BY count DESC, name
    `);

    const hazardStats = await session.run(`
      MATCH (m:Material)-[:HAS_HAZARD_CLASS]->(h:HazardClassification)
      WHERE ${productCatalogWhere("m")}
        AND coalesce(m.review_status,'accepted')='accepted'
      RETURN h.name AS name, count(DISTINCT m) AS count
      ORDER BY count DESC, name
      LIMIT 6
    `);

    const riskStatus = await materialRiskService.getStatus(session);
    const row = counts.records[0];
    res.json({
      counts: {
        materials: row?.get("materials") ?? 0,
        categories: row?.get("categories") ?? 0,
        hazardClasses: row?.get("hazardClasses") ?? 0,
        formallyClassifiedMaterials: riskStatus.formallyClassifiedMaterialCount,
        unclassifiedMaterials: riskStatus.unclassifiedMaterialCount,
        riskCharacteristics: riskStatus.riskCharacteristicStats.length,
        numericProperties: row?.get("numericProperties") ?? 0,
      },
      categoryStats: categoryStats.records.map((r) => ({ name: r.get("name"), count: r.get("count") })),
      hazardStats: hazardStats.records.map((r) => ({ name: r.get("name"), count: r.get("count") })),
      formalHazardClassStats: riskStatus.formalHazardClassStats,
      riskCharacteristicStats: riskStatus.riskCharacteristicStats,
      classificationNote: riskStatus.classificationNote,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});

app.get("/demo/materials", async (req, res) => {
  const q = String(req.query.q || "").trim();
  let limit = parseInt(req.query.limit || "12", 10);
  if (Number.isNaN(limit) || limit < 1) limit = 12;
  limit = Math.min(limit, 300);
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (m:Material)
      WHERE ${productCatalogWhere("m")}
        AND coalesce(m.review_status,'accepted')='accepted'
      WITH m,
        toLower(
          coalesce(toString(m.name),'') + ' ' +
          coalesce(toString(m.raw_name),'') + ' ' +
          coalesce(toString(m.attributes_json),'')
        ) AS searchText
      WHERE $q = '' OR searchText CONTAINS toLower($q)
      OPTIONAL MATCH (m)-[:BELONGS_TO_CATEGORY]->(c:MaterialCategory)
      OPTIONAL MATCH (m)-[:HAS_HAZARD_CLASS]->(h:HazardClassification)
      WITH m, collect(DISTINCT c.name) AS categories, collect(DISTINCT h.name) AS hazardCodes
      OPTIONAL MATCH (m)-[r]-()
      WITH m, categories, hazardCodes, count(r) AS degree
      RETURN m, id(m) AS dbId, categories, hazardCodes, degree
      ORDER BY CASE WHEN $q <> '' AND toLower(m.name) = toLower($q) THEN 0 ELSE 1 END,
               degree DESC, m.name
      LIMIT toInteger($limit)
    `, { q, limit });

    res.json(result.records.map((r) => {
      const m = r.get("m");
      const props = nodeProps(m);
      const attrs = parseJsonObject(props.attributes_json);
      return {
        id: String(r.get("dbId")),
        stableId: props.id || "",
        name: cleanDisplay(props.name, "未命名物料"),
        rawName: props.raw_name || "",
        category: r.get("categories")?.[0] || attrs.category || "未分类",
        hazardCodes: r.get("hazardCodes") || attrs.hazard_codes || [],
        variantCode: attrs.variant_code || "",
        casNumbers: attrs.cas_numbers || [],
        degree: r.get("degree") || 0,
      };
    }));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});

app.get("/demo/material/:materialId/profile", async (req, res) => {
  const nodeId = req.params.materialId;
  const session = driver.session();
  try {
    const materialResult = await session.run(`
      MATCH (m:Material)
      WHERE ${materialIdentityWhere("m")}
        AND ${productCatalogWhere("m")}
      OPTIONAL MATCH (m)-[:BELONGS_TO_CATEGORY]->(c:MaterialCategory)
      OPTIONAL MATCH (m)-[:HAS_HAZARD_CLASS]->(h:HazardClassification)
      RETURN m, id(m) AS dbId,
             collect(DISTINCT c.name) AS categories,
             collect(DISTINCT h.name) AS hazardCodes
      LIMIT 1
    `, { nodeId });
    if (!materialResult.records.length) return res.status(404).json({ error: "Material not found" });

    const materialRecord = materialResult.records[0];
    const materialNode = materialRecord.get("m");
    const materialProps = nodeProps(materialNode);
    const attrs = parseJsonObject(materialProps.attributes_json);

    const hazardDetailResult = await session.run(`
      MATCH (m:Material)-[r:HAS_HAZARD_CLASS]->(h:HazardClassification)
      WHERE ${materialIdentityWhere("m")}
        AND coalesce(r.review_status,'accepted')='accepted'
      OPTIONAL MATCH (e:Evidence {id:r.evidence_id})
      RETURN h.name AS hazardCode,
             properties(r) AS relationProps,
             e.name AS cell,
             e.raw_name AS fieldName,
             e.description AS evidenceText,
             e.source_doc AS sourceDoc
      ORDER BY hazardCode
    `, { nodeId });

    const propertyResult = await session.run(`
      MATCH (m:Material)-[r:HAS_MATERIAL_PROPERTY]->(p:MaterialProperty)
      WHERE ${materialIdentityWhere("m")}
        AND coalesce(r.review_status,'accepted')='accepted'
      OPTIONAL MATCH (p)-[:HAS_MEASUREMENT]->(v:PropertyMeasurement)
      WITH p, collect(v) AS measurements
      RETURN p, measurements
      ORDER BY CASE coalesce(p.property_name, '')
        WHEN '密度' THEN 0 WHEN '爆速' THEN 1 WHEN '爆温' THEN 2
        WHEN '爆压' THEN 3 WHEN '分解温度' THEN 4 WHEN '熔点' THEN 5
        WHEN '摩擦感度(需对应不同测试条件)' THEN 6
        WHEN '撞击感度(需对应不同测试条件)' THEN 7
        WHEN '静电感度(需对应不同测试条件)' THEN 8
        ELSE 20 END, coalesce(p.property_name,p.name)
    `, { nodeId });

    const properties = propertyResult.records.map((r) => {
      const p = nodeProps(r.get("p"));
      const pAttrs = parseJsonObject(p.attributes_json);
      const merged = { ...pAttrs, ...p };
      const measurements = (r.get("measurements") || []).filter(Boolean).map((v) => {
        const vp = nodeProps(v);
        const va = parseJsonObject(vp.attributes_json);
        const vm = { ...va, ...vp };
        return {
          role: vm.measurement_role || "测量值",
          label: formatMeasurement(vm),
          metric: vm.test_metric || "",
          context: vm.context_text || "",
        };
      });
      return {
        id: p.id || "",
        name: merged.property_name || p.name || "属性",
        group: merged.property_group || "其他属性",
        value: formatMeasurement(merged),
        rawValue: merged.raw_value || p.description || "",
        numericValidated: String(merged.numeric_validated) === "true",
        measurements,
      };
    });

    const componentResult = await session.run(`
      MATCH (m:Material)-[r:CONTAINS_COMPONENT]->(c)
      WHERE ${materialIdentityWhere("m")}
        AND coalesce(r.review_status,'accepted')='accepted'
      RETURN c, properties(r) AS relProps
      ORDER BY c.name
      LIMIT 12
    `, { nodeId });

    const relationResult = await session.run(`
      MATCH (m:Material)-[r]->(x)
      WHERE ${materialIdentityWhere("m")}
        AND coalesce(r.review_status,'accepted')='accepted'
        AND type(r) IN [
          'HAS_HAZARD','HAS_EXPOSURE_ROUTE','CAUSES_HEALTH_EFFECT','CAUSES_HEALTH_HAZARD',
          'REQUIRES_CONTROL_MEASURE','ALLOWS_FIREFIGHTING_AGENT',
          'PROHIBITS_FIREFIGHTING_AGENT','INEFFECTIVE_FIREFIGHTING_AGENT',
          'INCOMPATIBLE_WITH','REQUIRES_FIRST_AID','REQUIRES_FIREFIGHTING',
          'REQUIRES_SPILL_RESPONSE','REQUIRES_STORAGE_CONTROL'
        ]
      RETURN type(r) AS type, r, x, id(x) AS xId
      ORDER BY type, x.name
      LIMIT 80
    `, { nodeId });

    const evidenceResult = await session.run(`
      MATCH (m:Material)-[r]->(x)
      WHERE ${materialIdentityWhere("m")}
        AND coalesce(r.evidence_id,'') <> ''
      MATCH (e:Evidence {id:r.evidence_id})
      RETURN DISTINCT type(r) AS relationType, x.name AS targetName,
             e.name AS cell, e.raw_name AS fieldName,
             e.description AS evidenceText, e.source_doc AS sourceDoc
      ORDER BY relationType, targetName
      LIMIT 40
    `, { nodeId });

    const relations = relationResult.records.map((r) => {
      const rel = r.get("r");
      const x = r.get("x");
      const xp = nodeProps(x);
      return {
        type: r.get("type"),
        relationName: firstNonEmpty(relProps(rel).relation_name, r.get("type")),
        targetId: String(r.get("xId")),
        targetType: firstNonEmpty(xp.entity_type, "Node"),
        targetName: cleanDisplay(xp.name, xp.description),
        description: xp.description || "",
        props: relProps(rel),
      };
    });

    const relationGroups = {};
    for (const item of relations) {
      if (!relationGroups[item.type]) relationGroups[item.type] = [];
      relationGroups[item.type].push(item);
    }

    const materialRiskProfile = await materialRiskService.getMaterialChains(session, nodeId);
    const riskCharacteristicMap = new Map();
    for (const chain of materialRiskProfile?.items || []) {
      if (chain.chainType !== "INFERRED") continue;
      if (!riskCharacteristicMap.has(chain.riskType)) {
        riskCharacteristicMap.set(chain.riskType, {
          riskType: chain.riskType,
          name: chain.riskLabel,
          riskLevel: chain.riskLevel,
          chainCount: 0,
          ruleIds: new Set(),
          properties: new Set(),
        });
      }
      const item = riskCharacteristicMap.get(chain.riskType);
      item.chainCount += 1;
      if (chain.rule?.ruleId) item.ruleIds.add(chain.rule.ruleId);
      if (chain.property?.name) item.properties.add(chain.property.name);
      if (chain.riskLevel === "high") item.riskLevel = "high";
      else if (chain.riskLevel === "medium-high" && item.riskLevel !== "high") item.riskLevel = "medium-high";
    }
    const riskCharacteristics = Array.from(riskCharacteristicMap.values()).map((item) => ({
      riskType: item.riskType,
      name: item.name,
      riskLevel: item.riskLevel,
      chainCount: item.chainCount,
      ruleIds: Array.from(item.ruleIds),
      properties: Array.from(item.properties),
    }));

    res.json({
      material: {
        id: String(materialRecord.get("dbId")),
        stableId: materialProps.id || "",
        name: cleanDisplay(materialProps.name, "未命名物料"),
        rawName: materialProps.raw_name || "",
        category: materialRecord.get("categories")?.[0] || attrs.category || "未分类",
        hazardCodes: materialRecord.get("hazardCodes") || attrs.hazard_codes || [],
        variantCode: attrs.variant_code || "",
        casNumbers: attrs.cas_numbers || [],
        formula: attrs.formula_raw || "",
        compositionRaw: attrs.composition_raw || "",
        sourceRow: attrs.source_row || "",
        sourceDoc: materialProps.source_doc || "",
      },
      riskCharacteristics,
      riskClassificationNote: "材料风险特征由已审核属性和版本化规则识别，不等同于法定危险货物分类。",
      properties,
      hazardClassDetails: hazardDetailResult.records.map((r) => {
        const relationProps = r.get("relationProps") || {};
        const relationJson = parseJsonObject(relationProps.properties_json);
        const parts = splitHazardCode(r.get("hazardCode") || "");
        return {
          code: parts.code,
          division: parts.division,
          compatibilityGroup: parts.compatibilityGroup,
          classificationSystem: relationJson.classification_system || "UN_TDG",
          classificationSystemName: hazardSystemName(relationJson.classification_system || "UN_TDG"),
          role: relationJson.role || "",
          roleName: hazardRoleName(relationJson.role),
          conditionText: relationJson.condition_text || "",
          rawText: relationJson.raw_text || r.get("evidenceText") || "",
          cell: r.get("cell") || "",
          sheetName: "Sheet1",
          fieldName: r.get("fieldName") || "危险性类别",
          sourceDoc: r.get("sourceDoc") || materialProps.source_doc || "",
        };
      }),
      components: componentResult.records.map((r) => {
        const cp = nodeProps(r.get("c"));
        const rp = r.get("relProps") || {};
        return {
          name: cp.name || "组分",
          type: cp.entity_type || "ChemicalComponent",
          proportion: firstNonEmpty(rp.proportion_raw, rp.amount_qualifier, ""),
        };
      }),
      relations: relationGroups,
      evidence: evidenceResult.records.map((r) => ({
        relationType: r.get("relationType"),
        targetName: r.get("targetName") || "",
        cell: r.get("cell") || "",
        fieldName: r.get("fieldName") || "",
        text: r.get("evidenceText") || "",
        sourceDoc: r.get("sourceDoc") || "",
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});

app.get("/demo/material/:materialId/graph", async (req, res) => {
  const nodeId = req.params.materialId;
  const view = String(req.query.view || "profile");
  const session = driver.session();
  try {
    const centerResult = await session.run(`
      MATCH (m:Material)
      WHERE ${materialIdentityWhere("m")}
        AND ${productCatalogWhere("m")}
      RETURN m, id(m) AS dbId
      LIMIT 1
    `, { nodeId });
    if (!centerResult.records.length) return res.status(404).json({ error: "Material not found" });

    const centerRecord = centerResult.records[0];
    const centerProps = nodeProps(centerRecord.get("m"));
    const centerId = String(centerRecord.get("dbId"));
    const graph = createGraphCollector({
      nodes: [{
        id: `demo:m:${centerId}`,
        label: centerProps.name || "物料",
        group: "Material",
        props: { ...centerProps, _demoLevel: 0, _demoKind: "material" },
      }],
    });
    const addNode = (id, label, group, level, props = {}) => {
      graph.addNode({ id, label, group, props: { ...props, _demoLevel: level } });
    };
    const addEdge = (id, from, to, type, props = {}, relationType = type) => {
      graph.addEdge({ id, from, to, type, relationType, props });
    };

    if (view === "profile") {
      const overview = await session.run(`
        MATCH (m:Material)
        WHERE ${materialIdentityWhere("m")}
        OPTIONAL MATCH (m)-[:BELONGS_TO_CATEGORY]->(c:MaterialCategory)
        RETURN collect(DISTINCT c) AS categories
      `, { nodeId });
      const hazardOverview = await session.run(`
        MATCH (m:Material)-[r:HAS_HAZARD_CLASS]->(h:HazardClassification)
        WHERE ${materialIdentityWhere("m")}
          AND coalesce(r.review_status,'accepted')='accepted'
        OPTIONAL MATCH (e:Evidence {id:r.evidence_id})
        RETURN h, properties(r) AS relationProps, properties(e) AS evidenceProps
        ORDER BY h.name
        LIMIT 3
      `, { nodeId });

      const orow = overview.records[0];
      for (const c of (orow?.get("categories") || []).filter(Boolean)) {
        const cp = nodeProps(c);
        const id = `demo:c:${cp.id || cp.name}`;
        addNode(id, `物料类别\n${cp.name}`, "MaterialCategory", 1, cp);
        addEdge(`demo:e:${id}`, `demo:m:${centerId}`, id, "属于类别");
      }

      for (const record of hazardOverview.records) {
        const h = record.get("h");
        const hp = nodeProps(h);
        const ha = parseJsonObject(hp.attributes_json);
        const rp = record.get("relationProps") || {};
        const rj = parseJsonObject(rp.properties_json);
        const ep = record.get("evidenceProps") || {};
        const ea = parseJsonObject(ep.attributes_json);
        const parts = splitHazardCode(firstNonEmpty(ha.code, hp.raw_name, hp.name));
        const id = `demo:h:${hp.id || hp.name}`;

        const detailProps = {
          ...ha,
          ...hp,
          hazard_code: parts.code,
          hazard_division: parts.division,
          compatibility_group: parts.compatibilityGroup,
          classification_system: firstNonEmpty(rj.classification_system, ha.classification_system, "UN_TDG"),
          classification_system_name: hazardSystemName(firstNonEmpty(rj.classification_system, ha.classification_system, "UN_TDG")),
          classification_role: rj.role || "",
          classification_role_name: hazardRoleName(rj.role),
          condition_text: rj.condition_text || "",
          source_doc_resolved: ep.source_doc || centerProps.source_doc || "",
          source_sheet: ea.sheet_name || "Sheet1",
          source_cell: ea.cell_address || ep.name || "",
          source_field: ea.field_name || ep.raw_name || "危险性类别",
          source_text: ep.description || rj.raw_text || "",
        };

        addNode(id, `危险分类\n${parts.code}`, "HazardClassification", 1, detailProps);
        addEdge(
          `demo:e:${id}`,
          `demo:m:${centerId}`,
          id,
          "危险分类",
          { ...detailProps, _demoRelation: "危险分类" },
          "HAS_HAZARD_CLASS"
        );
      }

      const propsResult = await session.run(`
        MATCH (m:Material)-[:HAS_MATERIAL_PROPERTY]->(p:MaterialProperty)
        WHERE ${materialIdentityWhere("m")}
          AND coalesce(p.review_status,'accepted')='accepted'
        RETURN p
        ORDER BY CASE coalesce(p.property_name,'')
          WHEN '密度' THEN 0 WHEN '爆速' THEN 1 WHEN '爆温' THEN 2
          WHEN '爆压' THEN 3 WHEN '分解温度' THEN 4 WHEN '熔点' THEN 5
          WHEN '撞击感度(需对应不同测试条件)' THEN 6
          WHEN '摩擦感度(需对应不同测试条件)' THEN 7 ELSE 20 END
        LIMIT 8
      `, { nodeId });
      for (const r of propsResult.records) {
        const pp = nodeProps(r.get("p"));
        const pa = parseJsonObject(pp.attributes_json);
        const merged = { ...pa, ...pp };
        const id = `demo:p:${pp.id || pp.name}`;
        const value = formatMeasurement(merged);
        addNode(id, `${merged.property_name || pp.name}\n${value}`, "MaterialProperty", 1, merged);
        addEdge(`demo:e:${id}`, `demo:m:${centerId}`, id, "关键属性");
      }

      const compResult = await session.run(`
        MATCH (m:Material)-[r:CONTAINS_COMPONENT]->(c)
        WHERE ${materialIdentityWhere("m")}
          AND coalesce(r.review_status,'accepted')='accepted'
        RETURN c, properties(r) AS rp
        ORDER BY c.name
        LIMIT 6
      `, { nodeId });
      for (const r of compResult.records) {
        const cp = nodeProps(r.get("c"));
        const rp = r.get("rp") || {};
        const id = `demo:comp:${cp.id || cp.name}`;
        addNode(id, `${cp.name}${rp.proportion_raw ? `\n${rp.proportion_raw}` : ""}`, cp.entity_type || "ChemicalComponent", 1, { ...cp, ...rp });
        addEdge(`demo:e:${id}`, `demo:m:${centerId}`, id, "组成");
      }
    } else {
      const relationTypes = [
        'HAS_HAZARD','HAS_EXPOSURE_ROUTE','CAUSES_HEALTH_EFFECT','CAUSES_HEALTH_HAZARD',
        'REQUIRES_CONTROL_MEASURE','ALLOWS_FIREFIGHTING_AGENT',
        'PROHIBITS_FIREFIGHTING_AGENT','INEFFECTIVE_FIREFIGHTING_AGENT',
        'INCOMPATIBLE_WITH'
      ];
      const riskResult = await session.run(`
        MATCH (m:Material)-[r]->(x)
        WHERE ${materialIdentityWhere("m")}
          AND type(r) IN $types
          AND coalesce(r.review_status,'accepted')='accepted'
        RETURN type(r) AS type, r, x
        ORDER BY CASE type(r)
          WHEN 'HAS_HAZARD' THEN 0
          WHEN 'HAS_EXPOSURE_ROUTE' THEN 1
          WHEN 'CAUSES_HEALTH_EFFECT' THEN 2
          WHEN 'CAUSES_HEALTH_HAZARD' THEN 3
          WHEN 'REQUIRES_CONTROL_MEASURE' THEN 4
          WHEN 'PROHIBITS_FIREFIGHTING_AGENT' THEN 5
          WHEN 'INEFFECTIVE_FIREFIGHTING_AGENT' THEN 6
          ELSE 9 END, x.name
        LIMIT 22
      `, { nodeId, types: relationTypes });
      const typeLabels = {
        HAS_HAZARD: "危险特性",
        HAS_EXPOSURE_ROUTE: "侵入途径",
        CAUSES_HEALTH_EFFECT: "健康影响",
        CAUSES_HEALTH_HAZARD: "健康危害",
        REQUIRES_CONTROL_MEASURE: "控制措施",
        ALLOWS_FIREFIGHTING_AGENT: "适用灭火介质",
        PROHIBITS_FIREFIGHTING_AGENT: "禁止灭火介质",
        INEFFECTIVE_FIREFIGHTING_AGENT: "无效灭火介质",
        INCOMPATIBLE_WITH: "禁忌接触",
      };
      let index = 0;
      for (const r of riskResult.records) {
        const type = r.get("type");
        const xp = nodeProps(r.get("x"));
        const id = `demo:r:${index++}:${xp.id || xp.name}`;
        const label = cleanDisplay(xp.name, xp.description);
        addNode(id, label, xp.entity_type || "Node", 1, { ...xp, _demoRelation: typeLabels[type] || type });
        addEdge(`demo:e:${id}`, `demo:m:${centerId}`, id, typeLabels[type] || type, relProps(r.get("r")));
      }
    }

    const graphPayload = graph.toJSON();
    res.json({
      mode: view === "profile" ? "demoProfile" : "demoRisk",
      ...graphPayload,
      meta: {
        returnedNodes: graphPayload.nodes.length,
        returnedEdges: graphPayload.edges.length,
        description: "业务投影展示单一材料的关键知识。重复关系已聚合，避免图渲染 ID 冲突。",
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    await session.close();
  }
});

// ====== Start ======
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Using Neo4j: ${NEO4J_URI} (user=${NEO4J_USER}, passwordProvided=${Boolean(NEO4J_PASS)})`);
});
