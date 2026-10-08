@echo off
setlocal
cd /d "%~dp0"
where docker.exe >nul 2>&1
if errorlevel 1 (
  echo Docker was not found. Install and start Docker Desktop first.
  pause
  exit /b 1
)
if not exist ".env" (
  powershell.exe -NoProfile -Command "$a=[Guid]::NewGuid().ToString('N'); $b=[Guid]::NewGuid().ToString('N'); $t='FX_NEO4J_PASSWORD='+$a+[Environment]::NewLine+'FX_STANDARD_PASSWORD='+$b+[Environment]::NewLine; [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'),$t,[Text.UTF8Encoding]::new($false))"
  if errorlevel 1 (
    echo Could not create the local configuration file.
    pause
    exit /b 1
  )
  echo Created .env with two random local database passwords.
)
docker compose up -d --build --wait --wait-timeout 300
set "fx_exit_code=%ERRORLEVEL%"
if not "%fx_exit_code%"=="0" (
  echo Startup failed. Check Docker Desktop and REPRODUCE.md.
  pause
  exit /b %fx_exit_code%
)
echo FX is available at http://localhost:8080
pause
exit /b 0
