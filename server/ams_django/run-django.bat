@echo off
REM ============================================================
REM  run-django.bat  -  start the AMS-Test Django backend
REM  Usage:  run-django.bat [host:port]
REM    default host:port is 127.0.0.1:8000
REM    for LAN/team testing:  run-django.bat 0.0.0.0:8000
REM ============================================================
setlocal
cd /d "%~dp0"

if not exist ".env" (
    echo  [i] No .env found - creating one from .env.example.
    echo      Open .env and set AMS_DB_SERVER, AMS_DB_DRIVER and, if needed,
    echo      AMS_DB_USER / AMS_DB_PASSWORD before continuing.
    copy ".env.example" ".env" >nul
)

echo  [1/2] Installing / checking Python packages...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo  [!] pip install failed. Check that Python is installed and on PATH.
    pause
    exit /b 1
)

echo  [2/2] Starting the server. Press CTRL-BREAK to stop.
python manage.py runserver %*
endlocal
