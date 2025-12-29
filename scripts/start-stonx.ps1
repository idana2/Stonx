# Stonx startup script (Windows)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Starting Stonx Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; yarn workspace @stonx/server dev"

Start-Sleep -Seconds 2

Write-Host "Starting Stonx Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; yarn workspace @stonx/client dev"

Write-Host ""
Write-Host "Stonx is starting..." -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:3001"
Write-Host "Frontend: http://localhost:5173"
