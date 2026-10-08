const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const base = (process.argv[2] || 'http://localhost:8080/api').replace(/\/$/, '');
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '../../database/snapshots/expected-api.json'), 'utf8'));
  const health = await fetch(`${base}/health`);
  assert.ok(health.ok && (await health.json()).ok, 'Database health check failed');
  for (const [endpoint, baseline] of Object.entries(expected)) {
    const response = await fetch(`${base}/${endpoint}`);
    assert.ok(response.ok, `${endpoint}: HTTP ${response.status}`);
    const actual = await response.json();
    if (endpoint === 'structure/status') delete actual.mappingPath;
    assert.deepEqual(actual, baseline, `${endpoint}: restored data differs from the captured baseline`);
    console.log(`PASS ${endpoint}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
