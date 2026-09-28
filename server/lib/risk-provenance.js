const PREDICTED_CHAIN_PROVENANCE_QUERY = `
  MATCH (chain:PredictedRiskChain)
  WHERE id(chain) = $id
  OPTIONAL MATCH (chain)-[:IN_PROCESS]->(p)
  OPTIONAL MATCH (chain)-[:HAS_ORIGINAL_MATERIAL]->(m)
  OPTIONAL MATCH (chain)-[:HAS_HAZARD_FACTOR]->(h)
  OPTIONAL MATCH (chain)-[:PREDICTS]->(e)
  OPTIONAL MATCH (chain)-[:MITIGATED_BY]->(c)
  OPTIONAL MATCH (chain)-[:MONITORED_BY]->(v)
  WITH chain,
       collect(DISTINCT p) +
       collect(DISTINCT m) +
       collect(DISTINCT h) +
       collect(DISTINCT e) +
       collect(DISTINCT c) +
       collect(DISTINCT v) AS rawTraceNodes
  WITH chain, [node IN rawTraceNodes WHERE node IS NOT NULL] AS traceNodes
  CALL {
    WITH traceNodes
    UNWIND CASE WHEN size(traceNodes) = 0 THEN [null] ELSE traceNodes END AS traceNode
    OPTIONAL MATCH (traceNode)-[tr]-(other)
      WHERE other IN traceNodes
        AND coalesce(tr.source_doc, '') <> ''
    WITH collect(DISTINCT CASE
      WHEN tr IS NULL THEN null
      ELSE {
        provenanceKind: 'extracted_fact',
        factId: tr.fact_id,
        relationName: tr.relation_name,
        sourceDoc: tr.source_doc,
        sourceSection: tr.source_section,
        sourceLocation: tr.source_location,
        evidence: tr.evidence,
        confidence: tr.confidence
      }
    END) AS items
    RETURN [item IN items WHERE item IS NOT NULL] AS factProvenance
  }
  CALL {
    WITH chain
    OPTIONAL MATCH (chain)-[:SUPPORTED_BY_AREA_RULE]->(ar:AreaRule)
    OPTIONAL MATCH (chain)-[:TRIGGERED_BY]->(chainStimulus:Stimulus)
    OPTIONAL MATCH (chain)-[:IN_PROCESS]->(process)-[:MATCHES_STIMULUS_RULE]->(sr:StimulusRule)-[:TRIGGERS_STIMULUS]->(chainStimulus)
    WITH
      collect(DISTINCT CASE
        WHEN coalesce(ar.source_doc, '') = '' THEN null
        ELSE {
          provenanceKind: 'area_rule',
          factId: ar.rule_id,
          relationName: '危险区域规则',
          sourceDoc: ar.source_doc,
          sourceSection: ar.source_section,
          sourceLocation: ar.source_location,
          evidence: ar.evidence,
          confidence: ar.confidence
        }
      END) +
      collect(DISTINCT CASE
        WHEN coalesce(sr.source_doc, '') = '' THEN null
        ELSE {
          provenanceKind: 'stimulus_rule',
          factId: sr.rule_id,
          relationName: '刺激能量规则',
          sourceDoc: sr.source_doc,
          sourceSection: sr.source_section,
          sourceLocation: sr.source_location,
          evidence: sr.evidence,
          confidence: sr.confidence
        }
      END) AS items
    RETURN [item IN items WHERE item IS NOT NULL] AS ruleProvenance
  }
  RETURN factProvenance + ruleProvenance AS provenance
`;

function isPredictedRiskChain(labels) {
  return Array.isArray(labels) && labels.includes('PredictedRiskChain');
}

function provenanceKey(item) {
  return [
    item?.sourceDoc || '',
    item?.sourceSection || '',
    item?.sourceLocation || '',
    item?.factId || '',
    item?.relationName || '',
    item?.evidence || '',
  ].join('|');
}

function mergeProvenance(...groups) {
  const seen = new Set();
  const result = [];
  for (const group of groups) {
    for (const item of Array.isArray(group) ? group : []) {
      if (!item || !String(item.sourceDoc || '').trim()) continue;
      const key = provenanceKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

module.exports = {
  PREDICTED_CHAIN_PROVENANCE_QUERY,
  isPredictedRiskChain,
  mergeProvenance,
};
