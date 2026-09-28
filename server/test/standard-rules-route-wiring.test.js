const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

test("server exposes isolated standard rules endpoints", () => {
  assert.match(source, /createStandardRulesService/);
  assert.match(source, /NEO4J_STANDARD_URI/);
  assert.match(source, /standardDriver\.session\(\)/);
  for (const route of ["/standard-rules/status", "/standard-rules/rules", "/standard-rules/rule/:ruleId", "/graph/standard-rule/:ruleId"]) assert.ok(source.includes(route));
});
