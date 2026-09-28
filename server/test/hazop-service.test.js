const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseJsonObject,
  normalizeInvolvedRecord,
  normalizeLineRecord,
  normalizeProcessRecord,
  normalizeScenarioRecord,
} = require('../lib/hazop-service');

function node(properties, labels = ['KGNode']) {
  return { properties, labels };
}

function record(values) {
  return { get(key) { return values[key]; } };
}

test('normalizes line code and summary counts from HAZOP node', () => {
  const row = record({
    line: node({ entity_id: 'LINEHZ_1', name: 'DA生产线', attributes_json: '{"line_code":"DA"}' }, ['KGNode', 'ProductionLine']),
    lineDbId: 10,
    processCount: 4,
    scenarioCount: 111,
    causeCount: 78,
    consequenceCount: 61,
    controlCount: 35,
    recommendationCount: 15,
  });
  const result = normalizeLineRecord(row);
  assert.equal(result.id, 'LINEHZ_1');
  assert.equal(result.lineCode, 'DA');
  assert.equal(result.processCount, 4);
  assert.equal(result.scenarioCount, 111);
});

test('normalizes process order from node_code when direct order is absent', () => {
  const row = record({
    process: node({
      entity_id: 'PROCHZ_1',
      name: 'H线N004 转晶',
      attributes_json: '{"node_id":"N004"}',
    }, ['KGNode', 'Process']),
    processDbId: 20,
    scenarioCount: 12,
    causeCount: 10,
    consequenceCount: 8,
    controlCount: 7,
  });
  const result = normalizeProcessRecord(row);
  assert.equal(result.nodeCode, 'N004');
  assert.equal(result.processOrder, 4);
  assert.equal(result.displayName, '转晶');
});

test('normalizes scenario risk and source fields from attributes JSON', () => {
  const row = record({
    event: node({
      entity_id: 'HAZOP_1',
      name: '1.4.1 硝化机压力过高',
      description: '可能导致人员伤亡',
      source_doc: 'R线 HAZOP分析记录表.xls',
      attributes_json: JSON.stringify({
        serial_no: '1.4.1',
        parameter: '压力',
        deviation: '压力过高',
        initial_severity: 'F',
        initial_likelihood: '5',
        initial_risk: 'S',
        residual_severity: 'F',
        residual_likelihood: '4',
        residual_risk: 'H',
        source_sheet: 'N001',
        excel_row: 12,
      }),
    }, ['KGNode', 'RiskEventInstance']),
    eventDbId: 30,
    causeCount: 1,
    consequenceCount: 1,
    controlCount: 2,
    recommendationCount: 1,
  });
  const result = normalizeScenarioRecord(row);
  assert.equal(result.serialNo, '1.4.1');
  assert.equal(result.initialRisk, 'S');
  assert.equal(result.residualRisk, 'H');
  assert.equal(result.source.sheet, 'N001');
  assert.equal(result.source.excelRow, 12);
});

test('invalid JSON properties are treated as empty object', () => {
  assert.deepEqual(parseJsonObject('{broken'), {});
  assert.deepEqual(parseJsonObject(null), {});
});


test('resolves an aligned material family to a concrete material profile', () => {
  const row = record({
    item: node({ entity_id: 'ENTM91_FAMILY', name: '黑索今', dataset_id: 'HAZOP_DA_H_R_V1' }, ['KGNode', 'MaterialFamily']),
    itemDbId: 40,
    canonical: node({ id: 'ENTM91_FAMILY', name: '黑索今' }, ['KGNode', 'MaterialFamily']),
    canonicalDbId: 41,
    variant: node({ id: 'MATM91_RDX', name: '黑索今具体物料' }, ['KGNode', 'Material']),
    variantDbId: 42,
  });
  const result = normalizeInvolvedRecord(row);
  assert.deepEqual(result.materialProfile, {
    id: '42',
    stableId: 'MATM91_RDX',
    name: '黑索今具体物料',
    type: 'Material',
  });
});

test('scenario list coerces LIMIT parameter to an integer in Cypher', async () => {
  const { createHazopService } = require('../lib/hazop-service');
  let capturedQuery = '';
  let capturedParameters = null;
  const session = {
    async run(query, parameters) {
      capturedQuery = query;
      capturedParameters = parameters;
      return { records: [] };
    },
  };

  const service = createHazopService();
  const items = await service.listScenarios(session, 'PROCHZ_1', { limit: 300.9 });

  assert.deepEqual(items, []);
  assert.match(capturedQuery, /LIMIT\s+toInteger\(\$limit\)/);
  assert.equal(capturedParameters.limit, 300);
});
