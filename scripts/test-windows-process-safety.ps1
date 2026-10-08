$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows-process-safety.ps1')
if (-not (Test-OwnedProcess 'node.exe "D:\FX\server\index.js"' 'D:\FX' 101 @())) { throw 'Owned process rejected.' }
if (Test-OwnedProcess 'node.exe "D:\OTHER\server\index.js"' 'D:\FX' 101 @()) { throw 'Unrelated process accepted.' }
if (Test-OwnedProcess 'node.exe "D:\FX-other\server\index.js"' 'D:\FX' 101 @()) { throw 'Prefix collision accepted.' }
if (Test-OwnedProcess 'node.exe "D:\FX\server\index.js"' 'D:\FX' 101 @(101)) { throw 'Protected PID accepted.' }
if (Test-OwnedProcess '' 'D:\FX' 101 @()) { throw 'Unknown command line accepted.' }
Write-Output 'PASS: owned process, unrelated process, prefix collision, protected PID, missing command line.'
