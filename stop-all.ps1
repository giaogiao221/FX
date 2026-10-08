# =====================================================================
# kg-app 停止脚本：仅停止本项目的后端(3001)、前端(5173)、
# 物料库(7687)、标准库(7689)。绝不触碰 CL20 (7688/7475)。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\stop-all.ps1
#   .\stop-all.ps1 -IncludeDatabases   # 同时停止两个 Neo4j（默认保留运行）
# =====================================================================
param(
    [switch]$IncludeDatabases
)
$ErrorActionPreference = "Continue"
. (Join-Path $PSScriptRoot 'scripts/windows-process-safety.ps1')
$materialHome = 'F:\graph\neo4j-community-5.25.1'
$standardHome = 'F:\graph\neo4j-gb50089-5.25.1'

function Stop-PortOwner([int]$Port, [string]$Name, [switch]$Skip) {
    if ($Skip) { return }
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -in @("127.0.0.1", "::1", "0.0.0.0", "::") }
    if (-not $conns) {
        Write-Host "[SKIP] $Name 未在端口 $Port 运行" -ForegroundColor DarkGray
        return
    }
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        $expectedRoot = switch ($Port) {
            7687 { $materialHome }
            7689 { $standardHome }
            default { $PSScriptRoot }
        }
        $details = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
        if (-not (Test-OwnedProcess $details.CommandLine $expectedRoot $procId $cl20Pids)) {
            Write-Warning "拒绝停止 PID $procId：无法验证项目归属，或它属于受保护实例。"
            continue
        }
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "[STOP] $Name (PID $procId, $($proc.ProcessName))" -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "===== kg-app 停止 =====" -ForegroundColor Green

# 安全检查：确认 CL20 端口范围不会被误杀
$cl20Pids = @(Get-NetTCPConnection -LocalPort 7688,7475 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
if ($cl20Pids) {
    Write-Host "[GUARD] CL20 进程 PID: $($cl20Pids -join ', ') —— 将全程跳过" -ForegroundColor Cyan
}

Stop-PortOwner -Port 3001 -Name "后端 API"
Stop-PortOwner -Port 5173 -Name "前端 vite"

if ($IncludeDatabases) {
    # 显式请求后才终止经过目录核对的实例；导出快照前应先正常关闭数据库。
    Stop-PortOwner -Port 7687 -Name "物料库 Neo4j"
    Stop-PortOwner -Port 7689 -Name "标准库 Neo4j"
} else {
    Write-Host "[KEEP] 两个 Neo4j 数据库保持运行（加 -IncludeDatabases 可一并停止）" -ForegroundColor Cyan
}

Start-Sleep -Seconds 1
Write-Host "`n===== 停止后端口状态 =====" -ForegroundColor Green
foreach ($p in 3001, 5173, 7687, 7689, 7688, 7475) {
    $listen = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    $mark = if ($listen) { "LISTENING" } else { "-" }
    $tag = switch ($p) {
        7688 { "(CL20 - 不属于本项目)" }
        7475 { "(CL20 - 不属于本项目)" }
        default { "" }
    }
    Write-Host ("  {0,-6} {1,-10} {2}" -f $p, $mark, $tag)
}
