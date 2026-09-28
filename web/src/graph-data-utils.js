function mergeDuplicateProps(existing = {}, incoming = {}) {
  const duplicateCount = Number(existing.duplicateCount || 1) + 1;
  return { ...existing, ...incoming, duplicateCount };
}

export function dedupeGraphPayload(payload = {}) {
  const nodeMap = new Map();
  const edgeMap = new Map();

  for (const raw of Array.isArray(payload.nodes) ? payload.nodes : []) {
    if (raw?.id === undefined || raw?.id === null || String(raw.id) === "") continue;
    const id = String(raw.id);
    const existing = nodeMap.get(id);
    nodeMap.set(id, existing
      ? { ...existing, ...raw, id, props: { ...(existing.props || {}), ...(raw.props || {}) } }
      : { ...raw, id });
  }

  for (const [index, raw] of (Array.isArray(payload.edges) ? payload.edges : []).entries()) {
    if (raw?.from === undefined || raw?.to === undefined) continue;
    const from = String(raw.from);
    const to = String(raw.to);
    const id = String(raw.id || `${from}-${to}-${raw.type || "edge"}-${index}`);
    const edge = { ...raw, id, from, to };
    const existing = edgeMap.get(id);
    edgeMap.set(id, existing
      ? { ...existing, ...edge, id, props: mergeDuplicateProps(existing.props || {}, edge.props || {}) }
      : edge);
  }

  return { nodes: Array.from(nodeMap.values()), edges: Array.from(edgeMap.values()) };
}
