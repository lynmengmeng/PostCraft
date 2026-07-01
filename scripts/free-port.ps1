param(
    [int]$Port = 8082
)

$lines = netstat -ano | Select-String ":$Port\s"
$processIds = @()

foreach ($line in $lines) {
    if ($line -notmatch "LISTENING") { continue }
    $parts = ($line -replace "\s+", " ").Trim().Split(" ")
    $processId = $parts[-1]
    if ($processId -match "^\d+$") { $processIds += [int]$processId }
}

$processIds = $processIds | Sort-Object -Unique

foreach ($processId in $processIds) {
    $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $proc) { continue }
    if ($proc.ProcessName -ne "python") {
        Write-Host "Port $Port is used by $($proc.ProcessName) (PID $processId). Stop it manually or change API_PORT."
        exit 1
    }
    Write-Host "Stopping stale backend on port $Port (PID $processId)..."
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Write-Host "Port $Port is ready."
