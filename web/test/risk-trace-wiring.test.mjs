import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.resolve(here, "../src/App.jsx");
const app = fs.readFileSync(appPath, "utf8");

test("risk graph forwards node and edge selections to the application", () => {
  assert.match(app, /function RiskWorkspace\(\{\s*onGraphSelect,\s*onChainSelect\s*\}\)/);
  assert.match(app, /<GraphView[\s\S]*?onSelect=\{onGraphSelect\}/);
  assert.match(app, /onChainSelect\?\.\(chain\)/);
});

test("legacy process risk trace remains isolated while material risk uses its own workspace", () => {
  assert.match(app, /function RiskTracePanel\(/);
  assert.match(app, /function RiskWorkspace\(/);
  assert.match(app, /page === "materialRisk"[\s\S]*?<MaterialRiskWorkspace/);
  assert.doesNotMatch(app, />风险链路<\/TopNavButton>/);
});
