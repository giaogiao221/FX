# =====================================================================
# kg-app 运行总控脚本（一键启动：两个数据库 + 后端 + 前端）
#
#   物料/HAZOP 库   F:\graph\neo4j-community-5.25.1   bolt 7687 / http 7474
#   标准规则库     F:\graph\neo4j-gb50089-5.25.1     bolt 7689 / http 7476
#   可视化后端     <kg-app>\server                    http 3001
#   可视化前端     <kg-app>\web (vite)                http 5173
#
# 安全边界：绝不启动/停止/修改 CL20 实例（D:\CL20-KG-Demo\neo4j-cl20,
# 端口 7688/7475）。后端 NEO4J_STANDARD_URI 显式指向 7689，
# 避免落到代码默认值 7688（CL20）。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\start-all.ps1
# 密码：优先读环境变量 NEO4J_PASS（两库密码相同时只需设一个），
# 未设置时交互式输入一次。停止请用 stop-all.ps1。
# =====================================================================
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

$MaterialHome = "F:\graph\neo4j-community-5.25.1"
$StandardHome = "F:\graph\neo4j-gb50089-5.25.1"
$MaterialBolt = 7687
$StandardBolt = 7689
$BackendPort  = 3001
$FrontendPort = 5173

function Test-Port([int]$Port) {
    foreach ($family in @([System.Net.Sockets.AddressFamily]::InterNetwork, [System.Net.Sockets.AddressFamily]::InterNetworkV6)) {
        $client = New-Object System.Net.Sockets.TcpClient($family)
        try {
            $addr = if ($family -eq [System.Net.Sockets.AddressFamily]::InterNetwork) { "127.0.0.1" } else { "::1" }
            $async = $client.BeginConnect([System.Net.IPAddress]::Parse($addr), $Port, $null, $null)
            $ok = $async.AsyncWaitHandle.WaitOne(800)
            if ($ok -and $client.Connected) { return $true }
        } catch { } finally { $client.Close() }
    }
    return $false
}

function Wait-Port([int]$Port, [string]$Name, [int]$TimeoutSec = 150) {
    Write-Host "  等待 $Name (端口 $Port) ..." -ForegroundColor Cyan
    for ($i = 0; $i -lt $TimeoutSec; $i++) {
        if (Test-Port $Port) {
            Write-Host "  $Name 就绪（$i 秒）" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Seconds 1
    }
    Write-Host "  $Name 启动超时（$TimeoutSec 秒），请检查其控制台窗口日志" -ForegroundColor Red
    return $false
}

function Start-Neo4j([string]$Home_, [int]$Port, [string]$Name) {
    if (Test-Port $Port) {
        Write-Host "[DB] $Name 已在运行（端口 $Port），跳过" -ForegroundColor Yellow
        return $true
    }
    Write-Host "[DB] 启动 $Name ..." -ForegroundColor Cyan
    $neo4jBat = Join-Path $Home_ "bin\neo4j.bat"
    if (-not (Test-Path -LiteralPath $neo4jBat)) { throw "找不到 $neo4jBat" }
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$neo4jBat' console" -WindowStyle Hidden
    return Wait-Port $Port $Name
}

Write-Host "===== kg-app 总控启动 =====" -ForegroundColor Green
Write-Host "项目目录: $Root"

# ---------- 密码 ----------
if (-not $env:NEO4J_PASS) {
    $secure = Read-Host "请输入 Neo4j 密码（物料库与标准库共用）" -AsSecureString
    $env:NEO4J_PASS = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if (-not $env:NEO4J_STANDARD_PASS) { $env:NEO4J_STANDARD_PASS = $env:NEO4J_PASS }

# ---------- 1/4 物料库 7687 ----------
$db1 = Start-Neo4j $MaterialHome $MaterialBolt "物料/HAZOP库"

# ---------- 2/4 标准规则库 7689 ----------
$db2 = Start-Neo4j $StandardHome $StandardBolt "标准规则库"

if (-not ($db1 -and $db2)) {
    Write-Host "数据库未全部就绪，终止启动。" -ForegroundColor Red
    exit 1
}

# ---------- 3/4 后端 3001 ----------
if (Test-Port $BackendPort) {
    Write-Host "[API] 后端已在运行（端口 $BackendPort），跳过" -ForegroundColor Yellow
} else {
    Write-Host "[API] 启动后端 ..." -ForegroundColor Cyan
    $serverDir = Join-Path $Root "server"
    $env:NEO4J_URI = "bolt://localhost:$MaterialBolt"
    $env:NEO4J_USER = 'neo4j'
    $env:NEO4J_STANDARD_URI = "bolt://localhost:$StandardBolt"
    $env:NEO4J_STANDARD_USER = 'neo4j'
    # Child processes inherit credentials; never interpolate passwords into command lines.
    $serverEntry = (Join-Path $serverDir 'index.js').Replace("'", "''")
    Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "node '$serverEntry'" -WindowStyle Hidden
    if (-not (Wait-Port $BackendPort "后端" 60)) { exit 1 }
}

# ---------- 4/4 前端 5173 ----------
if (Test-Port $FrontendPort) {
    Write-Host "[WEB] 前端已在运行（端口 $FrontendPort），跳过" -ForegroundColor Yellow
} else {
    Write-Host "[WEB] 启动前端 ..." -ForegroundColor Cyan
    $webDir = Join-Path $Root "web"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webDir'; npm run dev" -WindowStyle Hidden
    if (-not (Wait-Port $FrontendPort "前端" 90)) { exit 1 }
}

# ---------- 健康检查 ----------
Write-Host "`n===== 健康检查 =====" -ForegroundColor Green
try {
    $health = Invoke-RestMethod -Uri "http://localhost:$BackendPort/health" -TimeoutSec 10
    Write-Host ("  物料库连接: ok={0} uri={1}" -f $health.ok, $health.neo4j.uri) -ForegroundColor Green
} catch {
    Write-Host "  /health 失败: $($_.Exception.Message)" -ForegroundColor Red
}
try {
    $status = Invoke-RestMethod -Uri "http://localhost:$BackendPort/standard-rules/status" -TimeoutSec 10
    if ($status.available) {
        Write-Host ("  标准规则库: available=true ruleCount={0}" -f $status.ruleCount) -ForegroundColor Green
    } else {
        Write-Host "  标准规则库: available=false（检查 NEO4J_STANDARD_URI 是否为 7689）" -ForegroundColor Red
    }
} catch {
    Write-Host "  /standard-rules/status 失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n===== 完成 =====" -ForegroundColor Green
Write-Host "  前端:     http://localhost:$FrontendPort"
Write-Host "  后端 API: http://localhost:$BackendPort"
Write-Host "  物料库浏览器:   http://localhost:7474  (bolt 7687)"
Write-Host "  标准库浏览器:   http://localhost:7476  (bolt 7689)"
Write-Host "  CL20 (7688/7475) 不属于本项目，未被触碰。"
Write-Host "  停止全部（不含 CL20）: .\stop-all.ps1" -ForegroundColor Yellow
