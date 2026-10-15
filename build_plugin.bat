@echo off
REM ========================================================
REM Game Access Torrent Plugin - Builder
REM ========================================================
setlocal

cd /d "%~dp0"

echo ========================================================
echo Building Game Access Torrent Provider Plugin (.exe)
echo ========================================================

call npm run build

echo.
echo Build complete. Check the 'dist' folder for the executable.
pause
