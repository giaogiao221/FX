const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'database', name), 'utf8');
}

test('HAZOP repair is additive and creates process order links', () => {
  const source = read('repair_hazop_v1.cypher');
  assert.doesNotMatch(source, /DETACH\s+DELETE|\bDELETE\b/i);
  assert.match(source, /ALIGNED_TO/);
  assert.match(source, /NEXT_PROCESS/);
  assert.match(source, /HAZOP_REF_/);
  assert.match(source, /process_order/);
});

test('verification script checks compatibility and process links', () => {
  const source = read('verify_hazop_v1.cypher');
  assert.match(source, /incompatible_nodes/);
  assert.match(source, /next_process_count/);
  assert.match(source, /alignment_relations/);
});
