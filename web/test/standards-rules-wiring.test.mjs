import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, "..", "src", "App.jsx"), "utf8");
const graph = fs.readFileSync(path.join(here, "..", "src", "GraphView.jsx"), "utf8");
const workspace = fs.readFileSync(path.join(here, "..", "src", "components", "StandardsRulesWorkspace.jsx"), "utf8");

test("standard rules workspace is isolated in navigation", () => {
  assert.ok(app.includes("StandardsRulesWorkspace"));
  assert.ok(app.includes("标准规则库"));
  assert.ok(workspace.includes("/standard-rules/status"));
  assert.ok(workspace.includes("/standard-rules/rules"));
  assert.ok(workspace.includes("未混入材料风险链或 HAZOP 场景"));
});

test("GraphView exposes focused standard rule graph mode", () => {
  assert.ok(graph.includes("standardRule"));
  assert.ok(graph.includes("/graph/standard-rule/"));
  assert.ok(graph.includes("ManagementRequirement"));
  assert.ok(graph.includes("InspectionRequirement"));
  assert.ok(graph.includes("focusRuleId"));
});
