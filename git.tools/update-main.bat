@echo off
setlocal enabledelayedexpansion
title [Brisbane TVs] Update Main
echo ============================================
echo   BRISBANE TVs - Push Changes to Main
echo ============================================
echo.

cd /d "%~dp0.."

echo Checking for changes...
echo.
git status

echo.
echo ============================================
echo.

:: Check if there are any changes to commit (including untracked files)
git diff --quiet --exit-code
set UNSTAGED=%errorlevel%
git diff --quiet --exit-code --cached
set STAGED=%errorlevel%

:: Check for untracked files
for /f %%i in ('git ls-files --others --exclude-standard') do set UNTRACKED=1
if not defined UNTRACKED set UNTRACKED=0

if %UNSTAGED%==0 if %STAGED%==0 if %UNTRACKED%==0 (
    echo No changes detected. Nothing to push.
    echo.
    pause
    exit /b 0
)

echo Adding all changes...
git add -A
echo.

:: Auto-generate commit message with timestamp and summary
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set DATESTAMP=%%c-%%a-%%b
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIMESTAMP=%%a:%%b

:: Count changed files
for /f %%i in ('git diff --cached --numstat ^| find /c /v ""') do set FILECOUNT=%%i

:: Get list of changed files for the log
set "CHANGED_FILES="
for /f "delims=" %%f in ('git diff --cached --name-only') do (
    if defined CHANGED_FILES (
        set "CHANGED_FILES=!CHANGED_FILES!, %%f"
    ) else (
        set "CHANGED_FILES=%%f"
    )
)

echo Committing %FILECOUNT% file(s)...
git commit -m "Update: %FILECOUNT% file(s) changed - %DATESTAMP% %TIMESTAMP%"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Commit failed.
    echo.
    pause
    exit /b 1
)

:: Get the short commit hash
for /f %%h in ('git rev-parse --short HEAD') do set COMMIT_HASH=%%h

:: Log the change to CHANGELOG.log
echo [%DATESTAMP% %TIMESTAMP%] %FILECOUNT% file(s) ^| %COMMIT_HASH% >> CHANGELOG.log
for /f "delims=" %%f in ('git diff --name-only HEAD~1 HEAD') do (
    echo   - %%f >> CHANGELOG.log
)
echo. >> CHANGELOG.log

:: Stage and amend the log into the same commit
git add CHANGELOG.log
git commit --amend --no-edit

echo.
echo Pushing to main on GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed. Try running "Sync From Main" first
    echo         to pull the latest changes, then try again.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Changes pushed to main successfully!
echo   GitHub repo is now up to date.
echo ============================================
echo.
pause
