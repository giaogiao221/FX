import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, '..', 'src', 'App.jsx'), 'utf8');

test('App wires the dedicated HAZOP workspace and navigation', () => {
  assert.match(app, /HazopWorkspace/);
  assert.match(app, /产线 HAZOP/);
  assert.match(app, /page === "hazop"/);
});
