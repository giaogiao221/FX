param(
  [switch]$Confirm,
  [string]$Neo4jHome = "F:\graph\neo4j-community-5.25.1",
  [string]$Database = "neo4j",
  [string]$DumpDirectory = "F:\graph\neo4j-backups"
)
$ErrorActionPreference = "Stop"
if (-not $Confirm) { throw "Refusing to stop the existing Neo4j service. Re-run with -Confirm after scheduling maintenance." }
$service = Get-Service -Name neo4j -ErrorAction Stop
$wasRunning = $service.Status -eq "Running"
$stamp = (Get-Date -Format "yyyyMMdd_HHmmss") + '_' + [guid]::NewGuid().ToString('N').Substring(0,8)
$runDirectory = Join-Path $DumpDirectory $stamp
New-Item $runDirectory -ItemType Directory -Force | Out-Null
$dumpPath = Join-Path $runDirectory "$Database.dump"
try {
  if ($wasRunning) { Stop-Service -Name neo4j -ErrorAction Stop }
  & "$Neo4jHome\bin\neo4j-admin.bat" database dump $Database --to-path=$runDirectory
  if ($LASTEXITCODE -ne 0) { throw "Neo4j dump failed with exit code $LASTEXITCODE." }
  $created = Get-Item -LiteralPath $dumpPath -ErrorAction Stop
  if (-not $created -or $created.Length -le 0) { throw "Neo4j dump was not created." }
  [ordered]@{ database=$Database; dump=$created.FullName; bytes=$created.Length; originalServiceWasRunning=$wasRunning } | ConvertTo-Json
} finally {
  if ($wasRunning) { Start-Service -Name neo4j }
}
