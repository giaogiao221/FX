import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(here, '..');
const hazop = fs.readFileSync(path.join(webRoot, 'src', 'components', 'HazopWorkspace.jsx'), 'utf8');
const app = fs.readFileSync(path.join(webRoot, 'src', 'App.jsx'), 'utf8');

const forbiddenHazopCopy = [
  'HAZOP_DA_H_R_V1',
  'ID兼容',
  'RiskEventInstance',
  '专用场景视图',
  '结构化原因',
  '结构化后果',
  '实体对齐',
  'HAS_PROCESS',
];

const forbiddenGeneralCopy = [
  'helper="PredictedRiskChain"',
  'helper="CanonicalMaterial"',
  'helper="Stimulus"',
  'helper="AreaRule"',
  '无结构化组分',
  '技术ID和JSON',
  'Neo4j中',
];

test('HAZOP page uses business-facing copy without implementation labels', () => {
  for (const text of forbiddenHazopCopy) {
    assert.equal(hazop.includes(text), false, `unexpected implementation label: ${text}`);
  }
  assert.match(hazop, /生产线 HAZOP 分析/);
  assert.match(hazop, /工序链路：/);
  assert.match(hazop, /现有保护措施/);
});

test('main visualization removes exposed internal model labels', () => {
  for (const text of forbiddenGeneralCopy) {
    assert.equal(app.includes(text), false, `unexpected internal label: ${text}`);
  }
  assert.match(app, /helper="已生成链路"/);
  assert.match(app, /暂无组分信息/);
});
