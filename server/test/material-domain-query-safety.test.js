"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

test("material-facing routes are scoped to PRODUCT_CATALOG_V1 rather than the legacy ontology version", () => {
  assert.ok(source.includes('const PRODUCT_CATALOG_DATASET_ID = "PRODUCT_CATALOG_V1"'));
  assert.ok(source.includes("product_catalog_dataset_id"));
  assert.doesNotMatch(source, /ontology_version\s*=\s*'1\.4-material'/);
});

test("HAZOP keeps its own dedicated dataset service", () => {
  assert.ok(source.includes('createHazopService({ datasetId: "HAZOP_DA_H_R_V1" })'));
  assert.ok(source.includes('createMaterialRiskService({ datasetId: "PRODUCT_CATALOG_V1" })'));
});
