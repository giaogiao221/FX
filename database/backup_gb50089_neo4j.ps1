param(
  [switch]$Confirm,
  [string]$Neo4jHome = "F:\graph\neo4j-gb50089-5.25.1",
  [string]$Database = "neo4j",
  [string]$DumpDirectory = "F:\graph\neo4j-gb50089-backups"
)
$ErrorActionPreference = "Stop"
if (-not $Confirm) { throw "Refusing offline dump without -Confirm. Stop the isolated GB50089 instance before proceeding." }
if (-not (Test-Path "$Neo4jHome\bin\neo4j-admin.bat")) { throw "Isolated Neo4j home is missing: $Neo4jHome" }
$stamp = (Get-Date -Format "yyyyMMdd_HHmmss") + '_' + [guid]::NewGuid().ToString('N').Substring(0,8)
$runDirectory = Join-Path $DumpDirectory $stamp
New-Item $runDirectory -ItemType Directory -Force | Out-Null
& "$Neo4jHome\bin\neo4j-admin.bat" database dump $Database --to-path=$runDirectory
if ($LASTEXITCODE -ne 0) { throw "Neo4j dump failed with exit code $LASTEXITCODE." }
$created = Get-Item -LiteralPath (Join-Path $runDirectory "$Database.dump") -ErrorAction Stop
if (-not $created -or $created.Length -le 0) { throw "Neo4j dump was not created." }
[ordered]@{ database=$Database; dump=$created.FullName; bytes=$created.Length } | ConvertTo-Json
