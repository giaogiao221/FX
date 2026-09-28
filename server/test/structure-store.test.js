const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createStructureStore } = require("../lib/structure-store");

function writeMapping(root, body) {
  const mappingPath = path.join(root, "material_structure_mapping.json");
  fs.writeFileSync(mappingPath, JSON.stringify(body), "utf8");
  return mappingPath;
}

test("loads an approved pure material with an SVG", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "structure-store-"));
  const mappingPath = writeMapping(root, {
    materials: {
      MAT_001: {
        materialId: "MAT_001",
        reviewStatus: "approved",
        materialType: "pure",
        structure: { svg: "/structures/MAT_MAT_001.svg" },
        components: [],
      },
    },
  });
  const store = createStructureStore(mappingPath);
  assert.equal(store.getByMaterialId("MAT_001").materialId, "MAT_001");
  assert.equal(store.getStatus().count, 1);
});

test("loads an approved mixture only when it has approved component structures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "structure-store-"));
  const mappingPath = writeMapping(root, {
    materials: {
      MAT_MIX: {
        materialId: "MAT_MIX",
        reviewStatus: "approved",
        materialType: "mixture",
        structure: null,
        components: [{ reviewStatus: "approved", svg: "/structures/CMP_1.svg" }],
      },
      MAT_EMPTY: {
        materialId: "MAT_EMPTY",
        reviewStatus: "approved",
        materialType: "mixture",
        structure: null,
        components: [],
      },
    },
  });
  const store = createStructureStore(mappingPath);
  assert.ok(store.getByMaterialId("MAT_MIX"));
  assert.equal(store.getByMaterialId("MAT_EMPTY"), null);
  assert.equal(store.getStatus().count, 1);
});

test("does not expose non-approved material", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "structure-store-"));
  const mappingPath = writeMapping(root, {
    materials: {
      MAT_002: {
        materialId: "MAT_002",
        reviewStatus: "pending",
        materialType: "pure",
        structure: { svg: "/structures/MAT_MAT_002.svg" },
      },
    },
  });
  const store = createStructureStore(mappingPath);
  assert.equal(store.getByMaterialId("MAT_002"), null);
});

test("missing mapping file returns unavailable status", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "structure-store-"));
  const store = createStructureStore(path.join(root, "missing.json"));
  assert.equal(store.getStatus().available, false);
  assert.equal(store.getByMaterialId("MAT_404"), null);
});
