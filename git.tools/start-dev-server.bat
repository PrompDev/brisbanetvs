@echo off
title [Brisbane TVs] Dev Server
echo ============================================
echo   BRISBANE TVs - Local Dev Server
echo ============================================
echo.

cd /d "%~dp0.."

:: Check if live-server is installed
where live-server >nul 2>nul
if %errorlevel% neq 0 (
    echo live-server is not installed. Installing now...
    echo.
    npm install -g live-server
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install live-server.
        echo         Make sure Node.js is installed: https://nodejs.org
        echo.
        pause
        exit /b 1
    )
    echo.
    echo live-server installed successfully!
    echo.
)

echo Starting dev server...
echo.
echo   Your site will open at: http://127.0.0.1:8080
echo   Any file changes will auto-refresh the browser.
echo   Press Ctrl+C to stop the server.
echo.
echo ============================================
echo.

live-server --port=8080

echo.
echo Dev server stopped.
echo.
pause
