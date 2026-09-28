"use strict";

function mergeProps(existing = {}, incoming = {}) {
  const currentCount = Number(existing.duplicateCount || 1);
  const variants = Array.isArray(existing.variants)
    ? existing.variants.slice()
    : [{ ...existing }];
  variants.push({ ...incoming });
  return {
    ...existing,
    ...incoming,
    duplicateCount: currentCount + 1,
    variants,
  };
}

function createGraphCollector(initial = {}) {
  const nodes = new Map();
  const edges = new Map();

  function addNode(node) {
    if (!node?.id) return null;
    const id = String(node.id);
    const existing = nodes.get(id);
    if (!existing) {
      nodes.set(id, { ...node, id });
      return nodes.get(id);
    }
    nodes.set(id, {
      ...existing,
      ...node,
      id,
      props: { ...(existing.props || {}), ...(node.props || {}) },
    });
    return nodes.get(id);
  }

  function addEdge(edge) {
    if (!edge?.id || edge.from === undefined || edge.to === undefined) return null;
    const id = String(edge.id);
    const normalized = { ...edge, id, from: String(edge.from), to: String(edge.to) };
    const existing = edges.get(id);
    if (!existing) {
      edges.set(id, normalized);
      return edges.get(id);
    }
    edges.set(id, {
      ...existing,
      ...normalized,
      id,
      props: mergeProps(existing.props || {}, normalized.props || {}),
    });
    return edges.get(id);
  }

  for (const node of initial.nodes || []) addNode(node);
  for (const edge of initial.edges || []) addEdge(edge);

  return {
    addNode,
    addEdge,
    toJSON() {
      return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) };
    },
  };
}

module.exports = { createGraphCollector };
