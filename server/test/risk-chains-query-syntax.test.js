const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('risk chains query carries variables through WITH after provenance subquery before WHERE', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const routeStart = source.indexOf('app.get("/risk/chains"');
  const routeEnd = source.indexOf('app.get("/risk/chain/', routeStart);
  const routeSource = source.slice(routeStart, routeEnd > routeStart ? routeEnd : undefined);

  assert.match(
    routeSource,
    /RETURN \[item IN collected[\s\S]*?AS provenance\s*}\s*WITH\s+chain,[\s\S]*?provenance\s*WHERE\s+\$q\s*=\s*''/,
    'Cypher WHERE cannot directly follow CALL { ... }; add WITH to carry route variables and provenance first.'
  );
});
