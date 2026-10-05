@echo off
setlocal enabledelayedexpansion
title MED School
cd /d "%~dp0"

echo.
echo  ============================================================
echo                       MED School
echo  ============================================================
echo.

REM ---- 1) Check Node.js ----
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js is not installed.
  echo.
  echo  Please install Node.js LTS from:  https://nodejs.org/
  echo  Then run this file again.
  echo.
  pause
  exit /b 1
)
echo  [OK] Node.js found.
echo.

REM ---- 2) Install server packages (first run only) ----
if not exist "server\node_modules" (
  echo  [1/4] Installing server packages ... please wait
  pushd server
  call npm install
  popd
  if errorlevel 1 goto ERR
) else (
  echo  [1/4] Server packages already installed.
)
echo.

REM ---- 3) Install client packages (first run only) ----
if not exist "client\node_modules" (
  echo  [2/4] Installing client packages ...
  pushd client
  call npm install
  popd
  if errorlevel 1 goto ERR
) else (
  echo  [2/4] Client packages already installed.
)

REM ---- 4) Build the client if missing OR if the version changed ----
set "NEED_BUILD=0"
if not exist "client\dist\index.html" set "NEED_BUILD=1"
set "CUR_VER="
if exist "VERSION.txt" set /p CUR_VER=<VERSION.txt
set "BUILT_VER="
if exist "client\dist\BUILT_VERSION.txt" set /p BUILT_VER=<client\dist\BUILT_VERSION.txt
if not "!CUR_VER!"=="!BUILT_VER!" set "NEED_BUILD=1"

if "!NEED_BUILD!"=="1" (
  echo  [3/4] Building the site ^(new version detected^) ...
  pushd client
  call npm run build
  popd
  if errorlevel 1 goto ERR
  REM stamp the built version so we don't rebuild needlessly next time
  if exist "VERSION.txt" copy /y "VERSION.txt" "client\dist\BUILT_VERSION.txt" >nul
  echo.
  echo  [!] The site was updated. If your BROWSER still shows the old
  echo      version, press Ctrl+Shift+R once ^(hard refresh^) to clear the
  echo      cached app. You only need to do this after an update.
) else (
  echo  [3/4] Site is up to date ^(no rebuild needed^).
)
echo.

REM ---- 5) Seed the database (only if empty) ----
REM All your data (database + uploads) lives in the "data" folder, OUTSIDE the
REM code, so you never lose it when you upgrade the site. Keep the "data" folder!
if not exist "data\medlab.db" (
  echo  [4/4] Filling the database with demo content ...
  pushd server
  call npm run seed
  popd
  if errorlevel 1 goto ERR
) else (
  echo  [4/4] Database already exists in the data folder - your data is kept.
)
echo.

echo  ============================================================
echo   Everything is ready. Starting the server ...
echo.
echo   Open in your browser:  http://localhost:4000
echo   Tip: press Ctrl+Shift+R in the browser to clear its cache.
echo   To stop: close this window or press Ctrl+C
echo  ============================================================
echo.

start "" cmd /c "timeout /t 5 >nul & start http://localhost:4000"

cd server
call npm start
goto END

:ERR
echo.
echo  ============================================================
echo   [ERROR] Something went wrong.
echo   Make sure you are connected to the internet
echo   (needed to download packages) and run this file again.
echo  ============================================================
echo.
pause
exit /b 1

:END
endlocal
