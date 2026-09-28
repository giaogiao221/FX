import test from "node:test";
import assert from "node:assert/strict";
import { dedupeGraphPayload } from "../src/graph-data-utils.js";

test("dedupes duplicate graph ids before constructing vis-network DataSets", () => {
  const result = dedupeGraphPayload({
    nodes: [{ id: "n1", label: "A" }, { id: "n1", label: "A2" }],
    edges: [
      { id: "e1", from: "n1", to: "n2", props: { source: "A" } },
      { id: "e1", from: "n1", to: "n2", props: { source: "B" } },
    ],
  });

  assert.equal(result.nodes.length, 1);
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].props.duplicateCount, 2);
});
