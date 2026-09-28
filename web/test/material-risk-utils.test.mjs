import test from "node:test";
import assert from "node:assert/strict";
import {
  chainTypeLabel,
  evidenceLevelLabel,
  normalizeMaterialRiskPayload,
  riskLevelLabel,
} from "../src/material-risk-utils.js";

test("normalizes material risk status and chains", () => {
  const result = normalizeMaterialRiskPayload({
    datasetId: "PRODUCT_CATALOG_V1",
    materialCount: 3,
    items: [{
      chainId: "MRINF_1",
      chainType: "INFERRED",
      evidenceLevel: "rule_inference",
      riskLevel: "high",
      material: { name: "测试材料" },
      property: { name: "摩擦感度", rawValue: "70%" },
      trigger: { name: "摩擦/剪切刺激" },
      outcomes: [{ name: "意外发火" }],
      rule: { ruleId: "MR-FRICTION-001" },
    }],
  });

  assert.equal(result.datasetId, "PRODUCT_CATALOG_V1");
  assert.equal(result.items[0].materialName, "测试材料");
  assert.equal(result.items[0].outcomeText, "意外发火");
  assert.equal(result.items[0].ruleId, "MR-FRICTION-001");
});

test("returns Chinese labels for fact and inference semantics", () => {
  assert.equal(chainTypeLabel("FACT"), "原文事实");
  assert.equal(chainTypeLabel("INFERRED"), "系统推断");
  assert.equal(evidenceLevelLabel("explicit_fact"), "事实证据");
  assert.equal(evidenceLevelLabel("rule_inference"), "规则推断");
  assert.equal(riskLevelLabel("medium-high"), "较高");
});
