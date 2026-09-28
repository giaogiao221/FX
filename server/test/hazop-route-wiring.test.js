const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

test('server exposes dedicated HAZOP endpoints', () => {
  assert.match(source, /createHazopService/);
  for (const route of [
    '/hazop/status',
    '/hazop/lines',
    '/hazop/line/:lineCode/processes',
    '/hazop/process/:processId/scenarios',
    '/hazop/scenario/:scenarioId',
  ]) {
    assert.ok(source.includes(route), `missing route ${route}`);
  }
});
