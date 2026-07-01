$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$backend = Join-Path $Root "backend\.venv\Scripts\python.exe"
$frontend = Join-Path $Root "frontend"

if (-not (Test-Path $backend)) {
    Write-Error "未找到 backend/.venv，请先执行: cd backend; python -m venv .venv; pip install -r requirements.txt"
    exit 1
}

Start-Process -FilePath $backend -ArgumentList "-m uvicorn app.main:app --reload --host 127.0.0.1 --port 8082" -WorkingDirectory (Join-Path $Root "backend") -NoNewWindow
Set-Location $frontend
npm run dev
