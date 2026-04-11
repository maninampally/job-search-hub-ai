# Job Search Hub Docker Starter Script (PowerShell)
# Run from PowerShell to start Docker with one command

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Job Search Hub - Docker Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting containers..." -ForegroundColor Green
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""

Set-Location $PSScriptRoot
docker compose up --build

Write-Host ""
Write-Host "Docker containers stopped." -ForegroundColor Red
Read-Host "Press Enter to exit"
