@echo off
rem Double-click to update and run chartbook at http://localhost:3000
cd /d "%~dp0"
title chartbook

where node >nul 2>nul || (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

echo === Getting latest version ===
git pull

echo === Installing packages ===
call npm install
if errorlevel 1 goto fail

echo === Building page ===
call npm run build
if errorlevel 1 goto fail

echo === Starting (browser opens in a few seconds) ===
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
call npm start

:fail
echo.
echo chartbook stopped. If there is an error above, screenshot this window and send it to Claude.
pause
