param(
    [int]$Port = 8082,
    [string[]]$AllowedProcessNames = @("python")
)

$processIds = @()

try {
    $processIds += Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
} catch {
    # Fallback for environments without Get-NetTCPConnection
}

if ($processIds.Count -eq 0) {
    $lines = netstat -ano | Select-String ":$Port\s"
    foreach ($line in $lines) {
        if ($line -notmatch "LISTENING") { continue }
        $parts = ($line -replace "\s+", " ").Trim().Split(" ")
        $processId = $parts[-1]
        if ($processId -match "^\d+$") { $processIds += [int]$processId }
    }
}

$processIds = $processIds | Sort-Object -Unique

foreach ($processId in $processIds) {
    $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $proc) { continue }
    if ($AllowedProcessNames -notcontains $proc.ProcessName) {
        Write-Host "Port $Port is used by $($proc.ProcessName) (PID $processId). Stop it manually or change the port."
        exit 1
    }
    Write-Host "Stopping stale $($proc.ProcessName) on port $Port (PID $processId)..."
    # /T ensures uvicorn reload workers are also terminated
    cmd /c "taskkill /F /PID $processId /T >nul 2>&1"
}

Write-Host "Port $Port is ready."
