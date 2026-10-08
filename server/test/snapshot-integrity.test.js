const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { verifySnapshots } = require('../scripts/verify-snapshots');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-snapshot-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = ['material', 'standard'].map(name => {
    fs.mkdirSync(path.join(root, name));
    const content = Buffer.from(`snapshot-${name}`);
    fs.writeFileSync(path.join(root, name, 'neo4j.dump'), content);
    return { path: `${name}/neo4j.dump`, bytes: content.length,
      sha256: crypto.createHash('sha256').update(content).digest('hex') };
  });
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ files }));
  return root;
}
test('verifies both complete snapshots', t => {
  assert.equal(verifySnapshots(fixture(t)).length, 2);
});
test('rejects a truncated snapshot', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'material/neo4j.dump'), 'truncated');
  assert.throws(() => verifySnapshots(root), /size|checksum/i);
});
test('rejects a missing database instead of claiming complete reproduction', t => {
  const root = fixture(t);
  fs.unlinkSync(path.join(root, 'standard/neo4j.dump'));
  assert.throws(() => verifySnapshots(root), /ENOENT/);
});
test('rejects unexpected paths and system-database archives', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ files: [{ path: '../system.dump' }] }));
  assert.throws(() => verifySnapshots(root), /exactly|expected|snapshot/i);
});
