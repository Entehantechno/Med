@echo off
setlocal
title MED School - Rebuild site
cd /d "%~dp0"

echo.
echo  ============================================================
echo    Rebuild the site (client)
echo  ============================================================
echo.
echo  Run this after you change the client code,
echo  so the changes show up in the site.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js is not installed. Get it from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "client\node_modules" (
  echo  Installing client packages ...
  pushd client
  call npm install
  popd
)

echo  Building ...
pushd client
call npm run build
popd
if errorlevel 1 (
  echo.
  echo  [ERROR] Build failed.
  pause
  exit /b 1
)

echo.
echo  [OK] Build complete.
echo       Now run START-MED-School.bat
echo.
pause
endlocal
