# Build wheel package (API only; web UI is next-console separately).
# Run from repo root: pwsh -File scripts/wheel_build.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $RepoRoot

Write-Host "[wheel_build] Building wheel + sdist..."
python -m pip install --quiet build
$DistDir = Join-Path $RepoRoot "dist"
if (Test-Path $DistDir) {
  Remove-Item -Path (Join-Path $DistDir "*") -Force -ErrorAction SilentlyContinue
}
python -m build --outdir dist .
if ($LASTEXITCODE -ne 0) { throw "python -m build failed with exit code $LASTEXITCODE" }

Write-Host "[wheel_build] Done. Wheel(s) in: $RepoRoot\dist\"