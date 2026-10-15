@echo off
REM ========================================================
REM Game Access Torrent Plugin - Local Runner
REM ========================================================
setlocal

cd /d "%~dp0"

echo ========================================================
echo Starting Game Access Torrent Provider Plugin...
echo Press Ctrl+C to stop.
echo ========================================================

call npm start
