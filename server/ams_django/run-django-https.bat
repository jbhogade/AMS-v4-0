@echo off
REM ============================================================
REM  run-django-https.bat  -  start AMS-v4-0 Django over HTTPS
REM  Usage:  run-django-https.bat [host:port]
REM    default host:port is 127.0.0.1:8000
REM    for LAN/team testing:  run-django-https.bat 0.0.0.0:8000
REM  Open https://127.0.0.1:8000/  (not https://0.0.0.0:8000)
REM ============================================================
setlocal
cd /d "%~dp0"

if exist "venv\Scripts\python.exe" (
    set "PY=venv\Scripts\python.exe"
) else (
    set "PY=python"
)

if not exist ".env" (
    echo  [i] No .env found - creating one from .env.example.
    echo      Open .env and set AMS_DB_SERVER, AMS_DB_DRIVER and, if needed,
    echo      AMS_DB_USER / AMS_DB_PASSWORD before continuing.
    copy ".env.example" ".env" >nul
)

echo  [1/4] Checking pip (upgrade if a newer release is available)...
"%PY%" -m pip install --upgrade pip
if errorlevel 1 (
    echo  [!] pip upgrade failed. Continuing with the current pip.
)

echo  [2/4] Installing / checking Python packages...
"%PY%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo  [!] pip install failed. Check that Python is installed and on PATH.
    echo      If you see WinError 32 / "used by another process", stop the
    echo      running server and close other Python windows using this venv,
    echo      then retry. OneDrive can also lock files under this folder.
    pause
    exit /b 1
)

echo  [3/4] Checking HTTPS certificate (cert.pem / key.pem)...
"%PY%" make_https_cert.py
if errorlevel 1 (
    echo  [!] Could not create cert.pem / key.pem.
    pause
    exit /b 1
)

set "HOST=127.0.0.1"
set "PORT=8000"
if not "%~1"=="" (
    for /f "tokens=1,2 delims=:" %%a in ("%~1") do (
        set "HOST=%%a"
        if not "%%b"=="" set "PORT=%%b"
    )
)

echo  [4/4] Starting HTTPS. Press CTRL-BREAK to stop.
echo        Open https://127.0.0.1:%PORT%/  (not https://0.0.0.0:%PORT%/)
echo        The browser will warn on the self-signed cert; click Advanced, then Continue.
"%PY%" -m uvicorn ams_django.asgi:application --host %HOST% --port %PORT% --ssl-certfile cert.pem --ssl-keyfile key.pem
endlocal
