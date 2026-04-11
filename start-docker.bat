@echo off
REM Job Search Hub Docker Starter Script
REM This script automatically navigates to the correct directory and starts Docker

cd /d "%~dp0"
echo.
echo ========================================
echo  Job Search Hub - Docker Startup
echo ========================================
echo.
echo Starting containers...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
docker compose up --build
pause
