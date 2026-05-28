@echo off
title [Brisbane TVs] Sync From Main
echo ============================================
echo   BRISBANE TVs - Sync From Main
echo ============================================
echo.
echo Fetching latest changes from GitHub...
echo.

cd /d "%~dp0.."
git fetch origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to fetch from GitHub. Check your internet connection.
    echo.
    pause
    exit /b 1
)

echo.
echo Pulling latest changes into your local branch...
echo.
git pull origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Pull failed. You may have local changes that conflict.
    echo         Run "git status" to check, then resolve conflicts manually.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Sync complete! Your local files are
echo   now up to date with main.
echo ============================================
echo.
pause
