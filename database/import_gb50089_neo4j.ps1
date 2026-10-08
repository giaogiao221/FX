param(
  [switch]$Import,
  [string]$Neo4jHome = "F:\graph\neo4j-gb50089-5.25.1",
  [string]$Uri = "bolt://localhost:7689",
  [string]$User = $env:NEO4J_STANDARD_USER,
  [string]$Password = $env:NEO4J_STANDARD_PASS,
  [string]$SourcePackage = ""
)
$ErrorActionPreference = "Stop"
if ($Uri -ne "bolt://localhost:7689") { throw "Only the isolated standard instance is allowed: bolt://localhost:7689" }
if (-not $User) { $User = "neo4j" }
$packageDir = if ($SourcePackage) { $SourcePackage } else { Join-Path $Neo4jHome "import\gb50089_accepted_graph_v1" }
$importRoot = Join-Path $Neo4jHome "import"
$entities = Join-Path $packageDir "01_entities.csv"
$relations = Join-Path $packageDir "02_relations.csv"
$manifestPath = Join-Path $packageDir "manifest_standard_rule_accepted_graph.json"
if (-not (Test-Path $manifestPath)) { throw "Staged package manifest is missing: $manifestPath" }
if (-not (Test-Path (Join-Path $Neo4jHome "bin\cypher-shell.bat"))) { throw "Neo4jHome does not contain cypher-shell: $Neo4jHome" }
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
foreach ($name in @("01_entities.csv", "02_relations.csv")) {
  $source = Join-Path $packageDir $name
  $expected = $manifest.files.PSObject.Properties | Where-Object { $_.Name -eq $name } | Select-Object -ExpandProperty Value
  if (-not (Test-Path $source)) { throw "Staged package file is missing: $source" }
  if ((Get-FileHash $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.sha256) { throw "Staged package hash mismatch: $source" }
}
$rootEntities = Join-Path $importRoot "01_entities.csv"
$rootRelations = Join-Path $importRoot "02_relations.csv"
$rootCypher = Join-Path $importRoot "import_gb50089_root.cypher"
$result = [ordered]@{ uri=$Uri; package=$packageDir; import=$Import; safeTarget=$true; stagingMode="import-root" }
if (-not $Import) {
  $result.staged = (Test-Path $rootEntities) -and (Test-Path $rootRelations)
  $result | ConvertTo-Json
  exit 0
}
if (-not $Password) { throw "Set NEO4J_STANDARD_PASS before importing." }
function Copy-Utf8WithoutBom([string]$source, [string]$target) {
  $bytes = [IO.File]::ReadAllBytes($source)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $bytes = $bytes[3..($bytes.Length - 1)]
  }
  [IO.File]::WriteAllBytes($target, $bytes)
}
Copy-Utf8WithoutBom $entities $rootEntities
Copy-Utf8WithoutBom $relations $rootRelations
@"
CREATE CONSTRAINT kg_node_id IF NOT EXISTS FOR (n:KGNode) REQUIRE n.id IS UNIQUE;
LOAD CSV WITH HEADERS FROM 'file:///01_entities.csv' AS row
WITH row WHERE row.review_status = 'accepted'
MERGE (n:KGNode {id: row.entity_id})
SET n.entity_type = row.entity_type, n.name = row.name, n.attributes_json = row.attributes_json, n.review_status = row.review_status;
LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.review_status = 'accepted'
MATCH (h:KGNode {id: row.head_id})
MATCH (t:KGNode {id: row.tail_id})
MERGE (h)-[r:STANDARD_RULE {id: row.relation_id}]->(t)
SET r.relation_code = row.relation_code, r.properties_json = row.properties_json, r.review_status = row.review_status;
"@ | Set-Content $rootCypher -Encoding ASCII
& "$Neo4jHome\bin\cypher-shell.bat" -a $Uri -u $User -p $Password -f $rootCypher
if ($LASTEXITCODE -ne 0) { throw "GB50089 Cypher import failed with exit code $LASTEXITCODE." }
$query = "MATCH (n:KGNode) RETURN count(n) AS node_count; MATCH ()-[r:STANDARD_RULE]->() RETURN count(r) AS relation_count; MATCH (n:KGNode) WHERE n.review_status <> 'accepted' RETURN count(n) AS nonaccepted_count;"
& "$Neo4jHome\bin\cypher-shell.bat" -a $Uri -u $User -p $Password $query
if ($LASTEXITCODE -ne 0) { throw "GB50089 post-import validation failed with exit code $LASTEXITCODE." }
