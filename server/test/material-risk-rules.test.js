"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RULE_VERSION,
  buildMaterialRiskChains,
  normalizePropertyFact,
} = require("../lib/material-risk-rules");

function materialFact(property) {
  return {
    material: {
      id: "MATPD_demo",
      dbId: "101",
      name: "测试材料",
      confidence: 0.98,
      hazardCodes: ["1.1"],
      sourceDoc: "危险特性汇总表.docx",
    },
    properties: [{
      id: "PROPPD_demo",
      name: property.name,
      group: property.group || "性能",
      rawValue: property.rawValue,
      confidence: property.confidence ?? 0.96,
      attributes: property.attributes || {},
      relation: {
        evidenceId: "EVPD_demo",
        sourceDoc: "危险特性汇总表.docx",
        confidence: 0.95,
      },
      evidence: {
        id: "EVPD_demo",
        text: `原文：${property.rawValue}`,
        sourceDoc: "危险特性汇总表.docx",
        tableRow: "5",
      },
    }],
  };
}

const CASES = [
  ["摩擦感度", "摩擦感度：70%", "MR-FRICTION-001", "摩擦/剪切刺激", "意外发火"],
  ["撞击感度", "撞击感度：12%", "MR-IMPACT-001", "撞击/冲击刺激", "意外发火"],
  ["静电感度", "静电感度：0.18J", "MR-ELECTROSTATIC-001", "静电放电", "点火"],
  ["火焰感度", "火焰感度下限：10cm", "MR-FLAME-001", "明火/高温火焰", "点火"],
  ["爆发点", "爆发点：210℃", "MR-THERMAL-001", "异常受热", "热分解"],
  ["安定性说明", "50℃安定；100℃减量1.57%", "MR-STABILITY-001", "超出温度/时间边界", "热稳定性下降"],
];

for (const [name, rawValue, ruleId, trigger, outcome] of CASES) {
  test(`builds separate fact and inferred chains for ${name}`, () => {
    const chains = buildMaterialRiskChains(materialFact({ name, rawValue }));
    assert.equal(chains.length, 2);

    const fact = chains.find((item) => item.chainType === "FACT");
    const inferred = chains.find((item) => item.chainType === "INFERRED");

    assert.equal(fact.evidenceLevel, "explicit_fact");
    assert.equal(fact.property.rawValue, rawValue);
    assert.equal(fact.evidence.sourceDoc, "危险特性汇总表.docx");
    assert.equal(fact.rule, null);

    assert.equal(inferred.evidenceLevel, "rule_inference");
    assert.equal(inferred.rule.ruleId, ruleId);
    assert.equal(inferred.rule.version, RULE_VERSION);
    assert.equal(inferred.trigger.name, trigger);
    assert.ok(inferred.outcomes.some((item) => item.name === outcome));
    assert.ok(inferred.confidence > 0 && inferred.confidence <= 1);
    assert.equal(inferred.riskDomain, "material");
    assert.equal(inferred.reviewStatus, "system_generated");
  });
}

test("does not infer a risk chain from ordinary performance parameters", () => {
  const chains = buildMaterialRiskChains(materialFact({ name: "爆速", rawValue: "7000m/s" }));
  assert.deepEqual(chains, []);
});

test("normalizes JSON-backed material property values", () => {
  const normalized = normalizePropertyFact({
    id: "P1",
    name: "",
    description: "摩擦感度：25%",
    attributes_json: JSON.stringify({
      property_name: "摩擦感度",
      raw_value: "摩擦感度：25%",
      nominal_value: 25,
      unit: "%",
    }),
  });

  assert.equal(normalized.name, "摩擦感度");
  assert.equal(normalized.rawValue, "摩擦感度：25%");
  assert.equal(normalized.numericValue, 25);
  assert.equal(normalized.unit, "%");
});

test("chain identifiers are deterministic and distinct by evidence level", () => {
  const input = materialFact({ name: "摩擦感度", rawValue: "摩擦感度：70%" });
  const first = buildMaterialRiskChains(input);
  const second = buildMaterialRiskChains(input);

  assert.deepEqual(first.map((item) => item.chainId), second.map((item) => item.chainId));
  assert.notEqual(first[0].chainId, first[1].chainId);
});

test("inferred chains expose auditable reasoning and do not pretend to calculate accident probability", () => {
  const inferred = buildMaterialRiskChains(materialFact({ name: "摩擦感度", rawValue: "摩擦感度：28%（0.51MPa，45°摆角）" }))
    .find((item) => item.chainType === "INFERRED");

  assert.equal(inferred.reasoning.method, "deterministic_rule");
  assert.equal(inferred.reasoning.matchedProperty, "摩擦感度");
  assert.ok(inferred.reasoning.steps.some((item) => item.includes("摩擦/剪切刺激")));
  assert.match(inferred.reasoning.limitations.join(" "), /不等同于事故概率/);
  assert.ok(inferred.priorityBasis.length > 0);
});
