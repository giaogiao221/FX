"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

test("server exposes isolated material risk endpoints", () => {
  for (const route of [
    "/material-risk/status",
    "/material-risk/chains",
    "/material-risk/material/:materialId",
    "/graph/material-risk-chains",
    "/graph/material-risk-chain/:chainId",
  ]) {
    assert.ok(source.includes(route), `missing route ${route}`);
  }
  assert.ok(source.includes("createMaterialRiskService"));
  assert.ok(source.includes('datasetId: "PRODUCT_CATALOG_V1"'));
});

test("material profile exposes rule-derived risk characteristics without replacing formal classifications", () => {
  assert.ok(source.includes("riskCharacteristics"));
  assert.ok(source.includes("materialRiskService.getMaterialChains"));
  assert.ok(source.includes("不等同于法定危险货物分类"));
});
