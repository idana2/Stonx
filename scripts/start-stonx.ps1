# Stonx staelmSpvsERf5lPZ7ZPQEhxSoTweNldZLL


$env:FMP_API_KEY="elmSpvsERf5lPZ7ZPQEhxSoTweNldZLL"
$env:YAHOO_COOKIE="A1=d=AQABBDyDqWgCEG5u2362YtRQQtJnYFjnShcFEgABCAG3WmmNaV5DyyMAAiAAAAcIPIOpaFjnShc&S=AQAAAhoCZjmmteyEYYBhE4FLUEU;A3=d=AQABBDyDqWgCEG5u2362YtRQQtJnYFjnShcFEgABCAG3WmmNaV5DyyMAAiAAAAcIPIOpaFjnShc&S=AQAAAhoCZjmmteyEYYBhE4FLUEU;GUC=AQABCAFpWrdpjUIeXQSB&s=AQAAAI9HmR4x&g=aVlymg;A1S=d=AQABBDyDqWgCEG5u2362YtRQQtJnYFjnShcFEgABCAG3WmmNaV5DyyMAAiAAAAcIPIOpaFjnShc&S=AQAAAhoCZjmmteyEYYBhE4FLUEU"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Starting Stonx Backend..." -ForegroundColor Cyan
#Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; yarn workspace @stonx/server dev"

$serverCmd = @"
cd '$root'
`$env:FMP_API_KEY='$($env:FMP_API_KEY)'
`$env:YAHOO_COOKIE='$($env:YAHOO_COOKIE)'
yarn workspace @stonx/server dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $serverCmd




Start-Sleep -Seconds 2

Write-Host "Starting Stonx Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; yarn workspace @stonx/client dev"

Write-Host ""
Write-Host "Stonx is starting..." -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:3001"
Write-Host "Frontend: http://localhost:5173"
