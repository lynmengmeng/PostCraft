# Install PostCraft deploy public key on test EC2 (run once; prompts for root password)
param(
    [string]$DeployHost = "13.52.175.51",
    [string]$DeployUser = "root",
    [string]$KeyPath = "$env:USERPROFILE\.ssh\postcraft-test"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "$KeyPath.pub")) {
    Write-Host "Public key not found: $KeyPath.pub" -ForegroundColor Red
    Write-Host "Generate one first:"
    Write-Host "  ssh-keygen -t ed25519 -f `"$KeyPath`" -N `"`" -C postcraft-deploy"
    exit 1
}

$pubKey = (Get-Content "$KeyPath.pub" -Raw).Trim()
if (-not $pubKey) {
    Write-Host "Public key file is empty" -ForegroundColor Red
    exit 1
}

$target = "${DeployUser}@${DeployHost}"
Write-Host "==> Target: $target"
Write-Host "==> Public key: $KeyPath.pub"
Write-Host ""
Write-Host "Enter root password when prompted (one-time setup)" -ForegroundColor Yellow
Write-Host ""

$escaped = $pubKey.Replace("'", "'\''")
$remoteCmd = @"
mkdir -p ~/.ssh; chmod 700 ~/.ssh; touch ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys; grep -qxF '$escaped' ~/.ssh/authorized_keys 2>/dev/null || echo '$escaped' >> ~/.ssh/authorized_keys; echo SSH_KEY_INSTALLED
"@

ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o StrictHostKeyChecking=accept-new $target $remoteCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Install failed. Check host, user, and password." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "==> Verifying key login..."
$verifyCmd = "echo KEY_LOGIN_OK; hostname"
ssh -i $KeyPath -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new $target $verifyCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "Public key written, but key login failed. Check sshd config." -ForegroundColor Red
    exit 1
}

$localEnvExample = Join-Path $PSScriptRoot "deploy.local.env.example"
$localEnv = Join-Path $PSScriptRoot "deploy.local.env"
if (-not (Test-Path $localEnv)) {
    if (Test-Path $localEnvExample) {
        Copy-Item $localEnvExample $localEnv
    } else {
        $envContent = @(
            "DEPLOY_HOST=$DeployHost"
            "DEPLOY_USER=$DeployUser"
            "DEPLOY_PORT=22"
            "DEPLOY_ROOT=/opt/PostCraft"
            "DEPLOY_SSH_KEY_PATH=$KeyPath"
        ) -join "`n"
        Set-Content -Path $localEnv -Value $envContent -Encoding utf8
    }
}

$content = Get-Content $localEnv -Raw -ErrorAction SilentlyContinue
if ($content -and ($content -notmatch 'DEPLOY_SSH_KEY_PATH=')) {
    Add-Content -Path $localEnv -Value "DEPLOY_SSH_KEY_PATH=$KeyPath"
} elseif ($content) {
    $updated = $content -replace 'DEPLOY_SSH_KEY_PATH=.*', "DEPLOY_SSH_KEY_PATH=$KeyPath"
    Set-Content -Path $localEnv -Value $updated -Encoding utf8
}

Write-Host ""
Write-Host "[OK] Key login ready" -ForegroundColor Green
Write-Host "     Private key: $KeyPath"
Write-Host "     Local config: $localEnv"
Write-Host ""
Write-Host "For GitHub Actions, add private key to secret DEPLOY_SSH_KEY"
Write-Host "  DEPLOY_HOST=$DeployHost"
Write-Host "  DEPLOY_USER=$DeployUser"
