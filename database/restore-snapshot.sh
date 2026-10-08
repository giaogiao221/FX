#!/usr/bin/env bash
set -euo pipefail
cd /snapshots
sha256sum --check SHA256SUMS
expected=$(cut -d ' ' -f 1 SHA256SUMS)
marker=/data/.fx-snapshot.sha256
if [ -d /data/databases/neo4j ]; then
  if [ -f "$marker" ] && [ "$(cat "$marker")" = "$expected" ]; then
    echo 'Existing initialized data retained; snapshot is not re-imported.'
    exit 0
  fi
  echo 'Refusing to overwrite an existing database without the matching FX snapshot marker.' >&2
  exit 1
fi
neo4j-admin database load neo4j --from-path=/snapshots
printf '%s\n' "$expected" > "$marker"
chown -R neo4j:neo4j /data
echo 'Business snapshot restored. No system database or source credentials were imported.'
