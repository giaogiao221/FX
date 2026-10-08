@echo off
setlocal
cd /d "%~dp0"
echo Starting the original Windows setup from PowerShell...
echo This script uses the Neo4j installations and paths on the original computer.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
set "fx_exit_code=%ERRORLEVEL%"
if not "%fx_exit_code%"=="0" echo Startup failed with exit code %fx_exit_code%.
pause
exit /b %fx_exit_code%
