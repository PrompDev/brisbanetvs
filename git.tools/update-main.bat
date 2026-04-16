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

:: Always stage everything first (picks up new folders, deleted files, etc.)
echo Adding all changes...
git add -A
echo.

:: Check if there is anything to commit
git diff --quiet --exit-code --cached
if %errorlevel%==0 (
    echo No new changes to commit.
    echo Checking for unpushed commits...
    echo.
    git push origin main
    if %errorlevel%==0 (
        echo.
        echo ============================================
        echo   All up to date!
        echo ============================================
    ) else (
        echo.
        echo [NOTE] Nothing to push or push failed.
    )
    echo.
    pause
    exit /b 0
)
echo.

:: Auto-generate commit message with timestamp
:: Use wmic for reliable date/time regardless of locale
for /f "skip=1" %%d in ('wmic os get localdatetime') do if not defined DTRAW set DTRAW=%%d
set DATESTAMP=%DTRAW:~0,4%-%DTRAW:~4,2%-%DTRAW:~6,2%
set TIMESTAMP=%DTRAW:~8,2%:%DTRAW:~10,2%

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
echo ---------------------------------------- >> git.tools\CHANGELOG.log
echo [%DATESTAMP% %TIMESTAMP%] %FILECOUNT% file(s) ^| commit: %COMMIT_HASH% >> git.tools\CHANGELOG.log
echo ---------------------------------------- >> git.tools\CHANGELOG.log

:: Get total insertions/deletions for the whole commit
for /f "tokens=1,2 delims= " %%a in ('git diff --shortstat HEAD~1 HEAD') do set TOTAL_STATS=placeholder
for /f "delims=" %%s in ('git diff --shortstat HEAD~1 HEAD') do (
    echo   Summary: %%s >> git.tools\CHANGELOG.log
)
echo. >> git.tools\CHANGELOG.log

:: Log each file with detailed +/- line and character counts
for /f "tokens=1,2,3" %%a in ('git diff --numstat HEAD~1 HEAD') do (
    set "ADDED=%%a"
    set "REMOVED=%%b"
    set "FNAME=%%c"
    if "!ADDED!"=="-" (
        echo   [binary]  !FNAME! >> git.tools\CHANGELOG.log
    ) else (
        :: Count characters added/removed per file
        set "CHARS_ADD=0"
        set "CHARS_DEL=0"
        for /f "delims=" %%x in ('git diff HEAD~1 HEAD -- "!FNAME!" ^| findstr /r "^+" ^| findstr /v "^+++" ') do (
            set "LINE=%%x"
            call :strlen "!LINE!" CLEN
            set /a CHARS_ADD+=!CLEN!
        )
        for /f "delims=" %%x in ('git diff HEAD~1 HEAD -- "!FNAME!" ^| findstr /r "^-" ^| findstr /v "^---" ') do (
            set "LINE=%%x"
            call :strlen "!LINE!" CLEN
            set /a CHARS_DEL+=!CLEN!
        )
        echo   [+!ADDED!/-!REMOVED! lines] [+!CHARS_ADD!/-!CHARS_DEL! chars]  !FNAME! >> git.tools\CHANGELOG.log
    )
)
echo. >> git.tools\CHANGELOG.log
goto :skipstrlen

:strlen
setlocal enabledelayedexpansion
set "s=!%~1!"
set len=0
if defined s (
    for %%i in (4096 2048 1024 512 256 128 64 32 16 8 4 2 1) do (
        if not "!s:~%%i,1!"=="" (
            set /a len+=%%i
            set "s=!s:~%%i!"
        )
    )
    set /a len+=1
)
endlocal & set %~2=%len%
exit /b

:skipstrlen

:: Stage and amend the log into the same commit
git add git.tools\CHANGELOG.log
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
