# 启动前清理残留 dev 进程（8082 后端 / 3002 前端）
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $ScriptDir) {
    $ScriptDir = Join-Path (Get-Location).Path "scripts"
}

$FreePort = Join-Path $ScriptDir "free-port.ps1"
if (-not (Test-Path $FreePort)) {
    Write-Error "找不到 free-port.ps1: $FreePort"
    exit 1
}

& $FreePort -Port 8082 -AllowedProcessNames python
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $FreePort -Port 3002 -AllowedProcessNames node
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
