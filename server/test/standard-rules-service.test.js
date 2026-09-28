"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createStandardRulesService, graphQuery, ruleDetailQuery, ruleListQuery } = require("../lib/standard-rules-service");

function record(values) { return { get(key) { return values[key]; } }; }
function node(properties) { return { properties }; }
function session(rows) { const calls = []; return { calls, async run(query, params) { calls.push({ query, params }); return { records: rows }; } }; }

test("standard rules service only queries accepted rule entity types", async () => {
  const s = session([record({ rule: node({ id: "rule_1", entity_type: "ManagementRequirement", name: "设备应设置保护装置", review_status: "accepted", clause_id: "4.1.1", page_idx: 8 }), dbId: 1 })]);
  const result = await createStandardRulesService().listRules(s, { q: "保护", limit: 9999 });
  assert.equal(result.items.length, 1);
  assert.equal(s.calls[0].params.limit, 1000);
  assert.match(s.calls[0].query, /review_status/);
  assert.deepEqual(s.calls[0].params.ruleTypes, ["ManagementRequirement", "InspectionRequirement"]);
  assert.doesNotMatch(s.calls[0].query, /PRODUCT_CATALOG_V1|HAZOP_DA_H_R_V1/);
});

test("standard rule graph query applies accepted filters to neighbors and relationships", () => {
  assert.match(graphQuery(), /coalesce\(evidence\.review_status, 'accepted'\)/);
  assert.match(graphQuery(), /coalesce\(standard\.review_status, 'accepted'\)/);
  assert.match(ruleListQuery(), /\$q/);
});

test("standard rule detail and graph queries follow imported relation codes", () => {
  for (const query of [ruleDetailQuery(), graphQuery()]) {
    assert.match(query, /:STANDARD_RULE/);
    assert.match(query, /relation_code = 'HAS_CLAUSE'/);
    assert.match(query, /relation_code = 'HAS_REQUIREMENT'/);
    assert.match(query, /relation_code = 'SUPPORTED_BY'/);
    assert.doesNotMatch(query, /\[:HAS_CLAUSE\]|\[:HAS_REQUIREMENT\]|\[:SUPPORTED_BY\]/);
  }
  assert.match(graphQuery(), /standard:KGNode\)-\[standardRel:STANDARD_RULE\]->\(clause:KGNode\)-\[clauseRel:STANDARD_RULE\]->\(rule\)/);
});

test("standard rules detail normalizes evidence stored in attributes JSON", async () => {
  const evidence = node({ id: "evidence_1", entity_type: "Evidence", attributes_json: JSON.stringify({ text: "设备应设置保护装置。", page_idx: 18, source_block_id: "block_18" }), review_status: "accepted" });
  const detail = record({
    rule: node({ id: "rule_1", entity_type: "ManagementRequirement", name: "设备应设置保护装置。", review_status: "accepted" }), ruleDbId: 1,
    clause: node({ id: "clause_1", name: "4.1.1" }), clauseDbId: 2,
    standard: node({ id: "standard_1", name: "GB 50089-2018" }), standardDbId: 3,
    evidence: [evidence],
  });
  const result = await createStandardRulesService().getRule(session([detail]), "rule_1");
  assert.equal(result.standard.title, "GB 50089-2018");
  assert.equal(result.clause.code, "4.1.1");
  assert.deepEqual(result.evidence.map((item) => ({ text: item.text, page: item.page, sourceBlockId: item.sourceBlockId })), [{ text: "设备应设置保护装置。", page: 18, sourceBlockId: "block_18" }]);
});

test("standard rules detail returns null when the isolated graph has no rule", async () => {
  assert.equal(await createStandardRulesService().getRule(session([]), "missing"), null);
});
