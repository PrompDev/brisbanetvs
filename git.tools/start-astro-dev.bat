@echo off
setlocal enabledelayedexpansion
title [Brisbane TVs] Astro Dev Server
echo ============================================
echo   BRISBANE TVs - Astro Blog Dev Server
echo ============================================
echo.

cd /d "%~dp0..\astro"

:: ============================================================
::  Find Node.js even if Explorer's PATH is stale.
::  (Explorer caches PATH at login, so a freshly installed Node
::   isn't visible to cmd windows it spawns until re-login.)
::  Strategy: check PATH first, then probe common install dirs,
::  then prepend whichever we find so npm, npx also work.
:: ============================================================

set "NODE_EXE="

:: 1) Already on PATH?
for /f "delims=" %%i in ('where node 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%i"
)

:: 2) Common install locations
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe"         set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe"    set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%APPDATA%\npm\node.exe"                 set "NODE_EXE=%APPDATA%\npm\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\scoop\apps\nodejs\current\node.exe" set "NODE_EXE=%USERPROFILE%\scoop\apps\nodejs\current\node.exe"

:: 3) nvm-windows: pick the active version
if not defined NODE_EXE if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" set "NODE_EXE=%NVM_SYMLINK%\node.exe"

:: 4) Registry lookup as a last resort (Node installer writes InstallPath)
if not defined NODE_EXE (
    for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Node.js" /v InstallPath 2^>nul ^| find "InstallPath"') do (
        if exist "%%b\node.exe" set "NODE_EXE=%%b\node.exe"
    )
)
if not defined NODE_EXE (
    for /f "tokens=2*" %%a in ('reg query "HKCU\SOFTWARE\Node.js" /v InstallPath 2^>nul ^| find "InstallPath"') do (
        if exist "%%b\node.exe" set "NODE_EXE=%%b\node.exe"
    )
)

if not defined NODE_EXE (
    echo [ERROR] Could not find Node.js anywhere.
    echo.
    echo         Install the LTS build from: https://nodejs.org
    echo         If it IS installed, try restarting Explorer:
    echo           Ctrl+Shift+Esc  ^>  Windows Explorer  ^>  Restart
    echo.
    pause
    exit /b 1
)

:: Prepend Node's folder to PATH so npm / npx also resolve.
for %%F in ("%NODE_EXE%") do set "NODE_DIR=%%~dpF"
set "PATH=%NODE_DIR%;%PATH%"

echo Found Node at: %NODE_EXE%
for /f "delims=" %%v in ('"%NODE_EXE%" --version') do echo Node version:  %%v
echo.

:: Confirm npm is reachable now
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node was found but npm is missing from "%NODE_DIR%".
    echo         Your Node install may be corrupted - reinstall from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Install deps on first run
if not exist "node_modules\" (
    echo First run detected - installing Astro dependencies...
    echo This takes 30-60 seconds and only happens once.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Scroll up to see the error.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed!
    echo.
)

:: ============================================================
::  Start Decap CMS local proxy in a separate window.
::  This is what makes /admin/ editable on your machine without
::  any GitHub OAuth setup - Decap looks for localhost:8081 and,
::  if found, writes directly to src/content/blog/*.md.
:: ============================================================

echo Starting Decap CMS local proxy in a separate window...
start "Brisbane TVs - Decap CMS Proxy" cmd /k "title [Brisbane TVs] Decap CMS Proxy && echo =========================================== && echo   Decap CMS Proxy (localhost:8081) && echo   Keep this window open while editing /admin/ && echo   Close it or press Ctrl+C to stop. && echo =========================================== && echo. && npx decap-server"

:: Give decap-server a moment to bind to port 8081 before Astro starts
timeout /t 2 /nobreak >nul

echo Starting Astro dev server...
echo.
echo   Your blog will open at: http://localhost:4321
echo     - Blog index:  http://localhost:4321/blog/
echo     - Admin:       http://localhost:4321/admin-nav/
echo     - CMS editor:  http://localhost:4321/admin/
echo.
echo   Any .astro or .md file you save will hot-reload the browser.
echo   Press Ctrl+C to stop the Astro server.
echo   (Close the Decap CMS Proxy window separately when done.)
echo.
echo ============================================
echo.

call npm run dev

echo.
echo Astro dev server stopped.
echo You can close the Decap CMS Proxy window now.
echo.
pause
