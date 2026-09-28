import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatRisk,
  normalizeHazopLine,
  normalizeHazopProcess,
  normalizeHazopScenario,
  riskTone,
} from '../src/hazop-utils.js';

test('normalizes line and process API payloads', () => {
  assert.deepEqual(normalizeHazopLine({ lineCode: 'DA', name: 'DA生产线', processCount: '4' }), {
    lineCode: 'DA', name: 'DA生产线', processCount: 4, scenarioCount: 0,
    causeCount: 0, consequenceCount: 0, controlCount: 0, recommendationCount: 0,
  });
  const process = normalizeHazopProcess({ id: 'P1', nodeCode: 'N002', processOrder: '2', displayName: '洗涤' });
  assert.equal(process.processOrder, 2);
  assert.equal(process.displayName, '洗涤');
});

test('formats risk level and scenario counts', () => {
  assert.equal(formatRisk('S', 'F', '5'), 'S · F/5');
  assert.equal(riskTone('S'), 'critical');
  assert.equal(riskTone('H'), 'high');
  const scenario = normalizeHazopScenario({ id: 'E1', initialRisk: 'S', causeCount: '1', consequenceCount: 2 });
  assert.equal(scenario.causeCount, 1);
  assert.equal(scenario.consequenceCount, 2);
});
