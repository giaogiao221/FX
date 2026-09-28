"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createMaterialRiskService } = require("../lib/material-risk-service");

function node(properties, labels = []) {
  return { properties, labels };
}

function record(values) {
  return { get(key) { return values[key]; } };
}

function fakeSession(rows) {
  const calls = [];
  return {
    calls,
    async run(query, params) {
      calls.push({ query, params });
      return { records: rows };
    },
  };
}

const row = record({
  m: node({
    id: "MATPD_1",
    entity_id: "MATPD_1",
    entity_type: "Material",
    name: "三硝基间苯二酚铅",
    dataset_id: "PRODUCT_CATALOG_V1",
    confidence: 0.98,
    source_doc: "非密-危险特性汇总表.docx",
  }, ["KGNode", "Material"]),
  mDbId: 101,
  p: node({
    id: "PROPPD_1",
    entity_id: "PROPPD_1",
    entity_type: "MaterialProperty",
    name: "摩擦感度",
    description: "摩擦感度：70%",
    attributes_json: JSON.stringify({ property_name: "摩擦感度", raw_value: "摩擦感度：70%", nominal_value: 70, unit: "%" }),
    confidence: 0.97,
  }, ["KGNode", "MaterialProperty"]),
  pDbId: 202,
  relProps: {
    evidence_id: "EVPD_1",
    source_doc: "非密-危险特性汇总表.docx",
    confidence: 0.96,
  },
  e: node({
    id: "EVPD_1",
    entity_type: "Evidence",
    description: "摩擦感度（发火率）：70%",
    source_doc: "非密-危险特性汇总表.docx",
    attributes_json: JSON.stringify({ table_row: 5 }),
  }, ["KGNode", "Evidence"]),
  hazardCodes: ["第1.1类爆炸品"],
});

test("material risk service scopes Neo4j reads to the product catalog dataset", async () => {
  const session = fakeSession([row]);
  const service = createMaterialRiskService({ datasetId: "PRODUCT_CATALOG_V1" });

  const result = await service.listChains(session, { limit: 20 });

  assert.equal(result.items.length, 2);
  assert.equal(session.calls.length, 1);
  assert.match(session.calls[0].query, /PRODUCT_CATALOG|\$datasetId/);
  assert.doesNotMatch(session.calls[0].query, /HAZOP_DA_H_R_V1/);
  assert.equal(session.calls[0].params.datasetId, "PRODUCT_CATALOG_V1");
});

test("status reports separate fact and inferred chain counts", async () => {
  const service = createMaterialRiskService({ datasetId: "PRODUCT_CATALOG_V1" });
  const status = await service.getStatus(fakeSession([row]));

  assert.equal(status.available, true);
  assert.equal(status.materialCount, 1);
  assert.equal(status.factChainCount, 1);
  assert.equal(status.inferredChainCount, 1);
  assert.equal(status.ruleCount, 1);
});

test("single-chain graph contains solid fact edges and flagged inference edges", async () => {
  const service = createMaterialRiskService({ datasetId: "PRODUCT_CATALOG_V1" });
  const listed = await service.listChains(fakeSession([row]), { chainType: "INFERRED" });
  const chainId = listed.items[0].chainId;
  const graph = await service.getChainGraph(fakeSession([row]), chainId);

  assert.ok(graph.nodes.some((item) => item.group === "MaterialRiskChain"));
  assert.ok(graph.nodes.some((item) => item.group === "RiskTrigger"));
  assert.ok(graph.nodes.some((item) => item.group === "RiskOutcome"));
  assert.ok(graph.edges.some((item) => item.props?.inference === false));
  assert.ok(graph.edges.some((item) => item.props?.inference === true));
  assert.ok(graph.edges.some((item) => item.type === "规则推断"));
});

test("empty material dataset returns an available=false status without HAZOP fallback", async () => {
  const service = createMaterialRiskService({ datasetId: "PRODUCT_CATALOG_V1" });
  const status = await service.getStatus(fakeSession([]));

  assert.equal(status.available, false);
  assert.equal(status.datasetId, "PRODUCT_CATALOG_V1");
  assert.equal(status.materialCount, 0);
  assert.equal(status.inferredChainCount, 0);
});

test("status separates source-stated hazard classes from rule-derived risk characteristics", async () => {
  const service = createMaterialRiskService({ datasetId: "PRODUCT_CATALOG_V1" });
  const status = await service.getStatus(fakeSession([row]));

  assert.deepEqual(status.formalHazardClassStats, [{ name: "1.1", materialCount: 1 }]);
  assert.equal(status.formallyClassifiedMaterialCount, 1);
  assert.equal(status.riskCharacteristicStats[0].riskType, "friction");
  assert.equal(status.riskCharacteristicStats[0].materialCount, 1);
  assert.match(status.classificationNote, /不等同于法定危险货物分类/);
});
