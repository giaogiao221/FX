param(
  [switch]$Apply,
  [string]$SourceHome = "F:\graph\neo4j-community-5.25.1",
  [string]$TargetHome = "F:\graph\neo4j-gb50089-5.25.1",
  [string]$Package = ""
)
$ErrorActionPreference = "Stop"
if (-not $Package) { throw "Pass -Package with the absolute accepted graph package path." }
if (-not (Test-Path "$Package\manifest_standard_rule_accepted_graph.json")) { throw "Accepted graph package is missing: $Package" }
$manifest = Get-Content "$Package\manifest_standard_rule_accepted_graph.json" -Raw | ConvertFrom-Json
foreach ($property in $manifest.files.PSObject.Properties) {
  $path = Join-Path $Package $property.Name
  if (-not (Test-Path $path)) { throw "Missing package file: $path" }
  $hash = (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $property.Value.sha256) { throw "Package hash mismatch: $path" }
}
$existing = Get-Process neo4j -ErrorAction SilentlyContinue | Select-Object Id, Path
$result = [ordered]@{ sourceHome=$SourceHome; targetHome=$TargetHome; package=$Package; existingNeo4jProcesses=@($existing).Count; apply=$Apply; validPackage=$true; bolt="bolt://localhost:7689"; http="http://localhost:7476" }
if (-not $Apply) { $result | ConvertTo-Json -Depth 4; exit 0 }
if (Test-Path $TargetHome) { throw "Target home already exists: $TargetHome" }
Copy-Item $SourceHome $TargetHome -Recurse
Remove-Item "$TargetHome\data", "$TargetHome\logs", "$TargetHome\run", "$TargetHome\import" -Recurse -Force -ErrorAction SilentlyContinue
New-Item "$TargetHome\data", "$TargetHome\logs", "$TargetHome\run", "$TargetHome\import" -ItemType Directory -Force | Out-Null
Copy-Item $Package "$TargetHome\import\gb50089_accepted_graph_v1" -Recurse
Add-Content "$TargetHome\conf\neo4j.conf" @"
server.directories.data=data
server.directories.logs=logs
server.directories.run=run
server.directories.import=import
server.bolt.listen_address=127.0.0.1:7689
server.http.listen_address=127.0.0.1:7476
server.https.enabled=false
"@
$result.provisioned = $true
$result | ConvertTo-Json -Depth 4
