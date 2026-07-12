@echo off
title Auto Moto Mobility Solutions - Fleet CRM
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo  =====================================================
  echo   Node.js is not installed on this computer yet.
  echo.
  echo   1. Go to   https://nodejs.org
  echo   2. Download the LTS version and install it
  echo      ^(just keep clicking Next^)
  echo   3. RESTART this computer
  echo   4. Double-click this file again
  echo  =====================================================
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo  First-time setup: downloading required packages.
  echo  This takes 1-2 minutes and only happens once...
  echo.
  call npm install
)

echo.
echo  =====================================================
echo   Starting the Auto Moto Mobility Solutions CRM...
echo   Your browser will open automatically.
echo.
echo   KEEP THIS BLACK WINDOW OPEN while using the app.
echo   Close this window when you are done.
echo  =====================================================
echo.
call npm run dev -- --open
pause
