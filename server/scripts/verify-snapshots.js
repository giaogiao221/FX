const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function verifySnapshots(root = path.join(__dirname, '../../database/snapshots')) {
  const { files } = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const expected = ['material/neo4j.dump', 'standard/neo4j.dump'];
  if (!Array.isArray(files) || files.length !== 2 ||
      JSON.stringify(files.map(file => file.path).sort()) !== JSON.stringify(expected)) {
    throw new Error('Snapshot manifest must contain exactly the expected two business snapshots.');
  }
  return files.map(file => {
    const bytes = fs.readFileSync(path.join(root, file.path));
    if (bytes.length !== file.bytes) throw new Error(`Snapshot size mismatch: ${file.path}`);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== file.sha256) throw new Error(`Snapshot checksum mismatch: ${file.path}`);
    return { path: file.path, bytes: bytes.length, sha256 };
  });
}

if (require.main === module) {
  try { console.log(JSON.stringify(verifySnapshots(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verifySnapshots };
