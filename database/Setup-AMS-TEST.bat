@echo off
REM ===========================================================================
REM  Setup-AMS-TEST.bat  -  creates the AMS-TEST database + schema
REM ---------------------------------------------------------------------------
REM  Run this once on Windows BEFORE starting the API (or if the API reports a
REM  database connection error). It needs a local SQL Server instance:
REM    - SQL Server Express (default instance SQLEXPRESS) or full SQL Server.
REM  The API can also auto-create everything on first run, so this script is
REM  optional but recommended.
REM ===========================================================================
setlocal EnableDelayedExpansion

echo.
echo  ==========================================================
echo   AMS-TEST Database Setup
echo  ==========================================================
echo.

set "DBNAME=AMS-TEST"
set "SQLFILE=%~dp0AMS-TEST.sql"

REM ---- Locate sqlcmd.exe -----------------------------------------------
set "SQLCMD="
for %%P in (sqlcmd sqlcmd.exe) do (
    where %%P >nul 2>nul && set "SQLCMD=%%P" && goto :found
)
REM Common SQL Server Express install paths (fallback)
for %%S in (
    "%ProgramFiles%\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"
    "%ProgramFiles(x86)%\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"
    "%ProgramFiles%\Microsoft SQL Server\150\Tools\Binn\SQLCMD.EXE"
    "%ProgramFiles%\Microsoft SQL Server\140\Tools\Binn\SQLCMD.EXE"
    "%ProgramFiles%\Microsoft SQL Server\130\Tools\Binn\SQLCMD.EXE"
    "%ProgramFiles%\Microsoft SQL Server\110\Tools\Binn\SQLCMD.EXE"
) do (
    if exist "%%~S" set "SQLCMD=%%~S" && goto :found
)
:found

if not defined SQLCMD (
    echo  [!] sqlcmd was not found on this machine.
    echo      Either install SQL Server Express, or run the script manually in
    echo      SQL Server Management Studio (open %SQLFILE%, press F5).
    echo.
    pause
    exit /b 1
)

echo  [1/3] Locating SQL Server instance...
set "SERVER="
for %%S in (".\SQLEXPRESS" "localhost\SQLEXPRESS" "localhost") do (
    "!SQLCMD!" -S %%S -E -l 5 -Q "SELECT 1" >nul 2>nul
    if not errorlevel 1 set "SERVER=%%S" && goto :gotserver
)
:gotserver

if not defined SERVER (
    echo  [!] No local SQL Server instance reachable with Windows authentication.
    echo      Instances tried: .\SQLEXPRESS, localhost\SQLEXPRESS, localhost
    echo      If your instance uses a different name, edit SERVER below and rerun.
    echo.
    pause
    exit /b 1
)

echo      Using instance: %SERVER%
echo  [2/3] Creating %DBNAME% database + schema...
"%SQLCMD%" -S %SERVER% -E -b -i "%SQLFILE%"
if errorlevel 1 (
    echo  [!] SQL script failed. Review the messages above and try again.
    echo      Common cause: the login lacks CREATE DATABASE permission - run
    echo      this script from an account with sysadmin rights, or pre-create
    echo      the AMS-TEST database manually in SSMS.
    echo.
    pause
    exit /b 1
)

echo  [3/3] Verifying...
"%SQLCMD%" -S %SERVER% -E -Q "SELECT name FROM sys.databases WHERE name='%DBNAME%'" >nul 2>nul
if errorlevel 1 (
    echo  [!] Database not found after setup. Check the messages above.
    pause
    exit /b 1
)

echo.
echo  ==========================================================
echo   SUCCESS: database "%DBNAME%" is ready.
echo  ==========================================================
echo.
echo   Next steps:
echo     1. Open server\AMS.API\appsettings.json and confirm the
echo        ConnectionStrings:Default value matches your instance
echo        (default: Server=.\SQLEXPRESS;Database=AMS-TEST;
echo                  Trusted_Connection=True;TrustServerCertificate=True;)
echo     2. Run the API:   cd server\AMS.API && dotnet run
echo     3. Open http://localhost:5000  in your browser and log in.
echo.
pause
endlocal
