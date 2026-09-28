"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createGraphCollector } = require("../lib/graph-collector");

test("graph collector merges duplicate node and edge identifiers instead of crashing vis-network", () => {
  const graph = createGraphCollector();
  graph.addNode({ id: "n:1", label: "组分", group: "ChemicalComponent", props: { source: "A" } });
  graph.addNode({ id: "n:1", label: "组分", group: "ChemicalComponent", props: { source: "B" } });
  graph.addEdge({ id: "e:1", from: "m:1", to: "n:1", type: "组成", props: { proportion: "10%" } });
  graph.addEdge({ id: "e:1", from: "m:1", to: "n:1", type: "组成", props: { proportion: "20%" } });

  const result = graph.toJSON();
  assert.equal(result.nodes.length, 1);
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].props.duplicateCount, 2);
  assert.deepEqual(result.edges[0].props.variants, [
    { proportion: "10%" },
    { proportion: "20%" },
  ]);
});
