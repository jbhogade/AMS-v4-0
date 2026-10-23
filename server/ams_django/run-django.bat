@echo off
REM ============================================================
REM  run-django.bat  -  start the AMS-v4-0 Django backend
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

echo  [1/3] Checking pip (upgrade if a newer release is available)...
python -m pip install --upgrade pip
if errorlevel 1 (
    echo  [!] pip upgrade failed. Continuing with the current pip.
)

echo  [2/3] Installing / checking Python packages...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo  [!] pip install failed. Check that Python is installed and on PATH.
    echo      If you see WinError 32 / "used by another process", stop the
    echo      running server and close other Python windows using this venv,
    echo      then retry. OneDrive can also lock files under this folder.
    pause
    exit /b 1
)

echo  [3/3] Starting the server. Press CTRL-BREAK to stop.
python manage.py runserver %*
endlocal
