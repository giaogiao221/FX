import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, "..", "src", "App.jsx"), "utf8");
const graph = fs.readFileSync(path.join(here, "..", "src", "GraphView.jsx"), "utf8");
const workspacePath = path.join(here, "..", "src", "components", "MaterialRiskWorkspace.jsx");

test("App exposes separate material risk and production HAZOP navigation", () => {
  assert.ok(app.includes("MaterialRiskWorkspace"));
  assert.ok(app.includes("材料资料"));
  assert.ok(app.includes("材料风险链"));
  assert.ok(app.includes("产线 HAZOP"));
  assert.ok(!app.includes(">HAZOP 分析<"));
  assert.ok(fs.existsSync(workspacePath));
});

test("GraphView wires material-risk endpoints and inference edge styling", () => {
  assert.ok(graph.includes("materialRisk"));
  assert.ok(graph.includes("/graph/material-risk-chains"));
  assert.ok(graph.includes("/graph/material-risk-chain/"));
  assert.ok(graph.includes("MaterialRiskChain"));
  assert.ok(graph.includes("RiskTrigger"));
  assert.ok(graph.includes("RiskOutcome"));
  assert.ok(graph.includes("dashes"));
  assert.ok(graph.includes("当前材料没有命中可生成风险链的属性"));
  assert.ok(!graph.includes("materialRiskSingle' || graphMode === 'materialRisk'"));
});

test("overview distinguishes formal hazard classes from material risk characteristics", () => {
  assert.ok(app.includes("原文危险货物分类"));
  assert.ok(app.includes("材料风险特征分类"));
  assert.ok(app.includes("不等同于法定危险货物分类"));
});

test("material risk detail explains deterministic rule reasoning and its boundary", () => {
  const workspace = fs.readFileSync(workspacePath, "utf8");
  assert.ok(workspace.includes("推断机理"));
  assert.ok(workspace.includes("判定边界"));
  assert.ok(workspace.includes("链路关注等级"));
});

test("material profile displays source classifications and rule-derived risk characteristics separately", () => {
  assert.ok(app.includes("材料风险特征"));
  assert.ok(app.includes("profile.riskCharacteristics"));
  assert.ok(app.includes("原文未给出明确危险货物分类"));
});
