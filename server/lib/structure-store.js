const fs = require("node:fs");
const path = require("node:path");

function isAvailableRecord(value) {
  if (!value || String(value.reviewStatus || "").toLowerCase() !== "approved") {
    return false;
  }

  const materialType = String(value.materialType || "").toLowerCase();
  if (materialType === "mixture") {
    return Array.isArray(value.components) && value.components.some((component) => (
      String(component?.reviewStatus || "").toLowerCase() === "approved"
      && Boolean(component?.svg)
    ));
  }

  return Boolean(value.structure?.svg);
}

function createStructureStore(mappingPath) {
  let materials = new Map();
  let error = "";

  function reload() {
    materials = new Map();
    error = "";

    try {
      const raw = fs.readFileSync(mappingPath, "utf8");
      const parsed = JSON.parse(raw);
      const source = parsed && typeof parsed.materials === "object" && parsed.materials
        ? parsed.materials
        : {};

      for (const [key, value] of Object.entries(source)) {
        if (!isAvailableRecord(value)) continue;
        const stableId = String(value.materialId || key).trim();
        if (stableId) materials.set(stableId, value);
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function getByMaterialId(materialId) {
    return materials.get(String(materialId || "").trim()) || null;
  }

  function getStatus() {
    return {
      available: !error,
      count: materials.size,
      mappingPath: path.resolve(mappingPath),
      error,
    };
  }

  reload();
  return { reload, getByMaterialId, getStatus };
}

module.exports = { createStructureStore, isAvailableRecord };
