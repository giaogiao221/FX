import test from "node:test";
import assert from "node:assert/strict";

import {
  formulaCheckLabel,
  normalizeStructureResponse,
  structureStatusLabel,
} from "../src/structure-utils.js";

test("normalizes unavailable response", () => {
  assert.deepEqual(normalizeStructureResponse({ available: false, reason: "no_approved_structure" }), {
    available: false,
    reason: "no_approved_structure",
    material: null,
  });
});

test("normalizes component list", () => {
  const result = normalizeStructureResponse({
    available: true,
    material: { materialId: "MAT_1", components: null },
  });
  assert.equal(result.available, true);
  assert.deepEqual(result.material.components, []);
});

test("returns Chinese status labels", () => {
  assert.equal(structureStatusLabel("approved"), "已审核");
  assert.equal(formulaCheckLabel("match"), "分子式一致");
});
