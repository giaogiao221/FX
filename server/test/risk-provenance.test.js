const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PREDICTED_CHAIN_PROVENANCE_QUERY,
  isPredictedRiskChain,
  mergeProvenance,
} = require('../lib/risk-provenance');

test('detects PredictedRiskChain labels', () => {
  assert.equal(isPredictedRiskChain(['Entity', 'PredictedRiskChain']), true);
  assert.equal(isPredictedRiskChain(['Process']), false);
});

test('merges provenance and removes empty or duplicate documents', () => {
  const merged = mergeProvenance(
    [{ sourceDoc: 'a.docx', factId: 'F1', relationName: '涉及物料', evidence: 'A' }],
    [
      { sourceDoc: 'a.docx', factId: 'F1', relationName: '涉及物料', evidence: 'A' },
      { sourceDoc: '', factId: 'F2' },
      { sourceDoc: 'b.docx', factId: 'F3', relationName: '存在危险因素', evidence: 'B' },
    ],
  );
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((item) => item.sourceDoc), ['a.docx', 'b.docx']);
});

test('predicted-chain query follows generated chain links back to original fact nodes', () => {
  for (const token of [
    'IN_PROCESS',
    'HAS_ORIGINAL_MATERIAL',
    'HAS_HAZARD_FACTOR',
    'PREDICTS',
    'MITIGATED_BY',
    'MONITORED_BY',
    'source_doc',
  ]) {
    assert.match(PREDICTED_CHAIN_PROVENANCE_QUERY, new RegExp(token));
  }
});

test('predicted-chain query also collects source documents from matched rules', () => {
  assert.match(PREDICTED_CHAIN_PROVENANCE_QUERY, /SUPPORTED_BY_AREA_RULE/);
  assert.match(PREDICTED_CHAIN_PROVENANCE_QUERY, /MATCHES_STIMULUS_RULE/);
  assert.match(PREDICTED_CHAIN_PROVENANCE_QUERY, /provenanceKind/);
});
