# AMS-Test on Windows — Django + SQL Server

This guide sets up the **Django** backend (`server/ams_django`) on Windows. The
frontend is unchanged and served by Django itself, so you only open one URL.

> The .NET API (`server/AMS.API`) still exists and shares the same database.
> You can run either backend; this guide covers Django.

---

## 1. Required software

| # | Software | Why | Get it |
|---|---|---|---|
| 1 | **Python 3.11+ (64-bit)** | Runs Django | https://www.python.org/downloads/ — during install, tick **"Add python.exe to PATH"** |
| 2 | **Git** | Clone the project | https://git-scm.com/download/win |
| 3 | **SQL Server** (Express / Developer / Standard) | The database | https://www.microsoft.com/sql-server/sql-server-downloads (Express is free; install default instance or `SQLEXPRESS`) |
| 4 | **Microsoft ODBC Driver 18 for SQL Server (64-bit)** | pyodbc needs it to talk to SQL Server — **the .NET API did not need this** | https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server |
| 5 | **SSMS** (optional but recommended) | Create/inspect the database | https://learn.microsoft.com/sql/ssms/download-sql-server-management-studio-ssms |

Python packages are installed automatically by `run-django.bat`
(`Django`, `mssql-django`, `pyodbc`, `PyJWT`, `python-dotenv`).

---

## 2. Clone the project

```bat
git clone <your-AMS-Test-repo-url>
cd AMS-Test
```

## 3. Create the database (optional — Django can do it automatically)

The Django backend auto-creates the database, schema, seeded users
(`operator.sys`, `testadmin`) and lookup data on first use, so this step is not
strictly required. If you prefer to create it explicitly:

**Option A — batch file (Windows):**
```bat
cd database
Setup-AMS-TEST.bat
```

**Option B — SSMS:** open `database\AMS-TEST.sql`, press F5.

## 4. Configure the connection

```bat
cd server\ams_django
copy .env.example .env
```

Open `.env` with Notepad and set:

- `AMS_DB_SERVER` — `localhost` (full SQL Server) or `localhost\SQLEXPRESS`
  (Express).
- `AMS_DB_DRIVER` — leave as `ODBC Driver 18 for SQL Server` if you installed
  Driver 18; change to `ODBC Driver 17 for SQL Server` if that's what you have.
- `AMS_DB_USER` / `AMS_DB_PASSWORD` — **leave commented out** on Windows to use
  the same Windows login the .NET API used.

## 5. Start the server

```bat
run-django.bat
```

(Or manually: `python -m pip install -r requirements.txt` then
`python manage.py runserver`.)

First launch installs the Python packages, then starts the server at
**http://127.0.0.1:8000/**. The first request initializes the database
(lazy, idempotent). Press **CTRL-BREAK** to stop.

## 6. Log in

Open http://127.0.0.1:8000/ and sign in with a seeded account:

| Username | Password | Role |
|---|---|---|
| `operator.sys` | `Sr#Ops@2026` | Supreme Root |
| `testadmin` | `Admin@#$12345` | Super Root |

Everything works exactly as it did with the .NET API — assets, employees,
masters, reports, profile, user management, print/download.

---

## Testing with your team on the network

On the host machine, start with the LAN interface:

```bat
run-django.bat 0.0.0.0:8000
```

Open firewall port 8000, then share **http://<host-ip>:8000/** with the team
(e.g. `http://192.168.1.50:8000`). If SQL Server is on another machine, set
`AMS_DB_SERVER` to that machine's IP, enable TCP/IP in SQL Server Configuration
Manager (port 1433) and use SQL auth (`AMS_DB_USER`/`AMS_DB_PASSWORD`).

> `runserver` is for development/testing only. For a longer-lived deployment use
> a production WSGI server (e.g. `waitress`) and set `AMS_DEBUG=0`.

---

## Troubleshooting

**"Data source name not found" (`IM002`)** — the ODBC driver is missing.
Install **Microsoft ODBC Driver 18 for SQL Server (64-bit)** (step 1, #4) or set
`AMS_DB_DRIVER=ODBC Driver 17 for SQL Server` in `.env`.

**"Login timeout expired" (`HYT00`)** — SQL Server is unreachable. Check the
instance in `AMS_DB_SERVER`, that TCP/IP is enabled (port 1433), and that the
SQL Server service is running.

**"Login failed for user"** — your Windows/SQL login lacks access. Prefer the
Windows login (leave `AMS_DB_USER` blank), or create a SQL login with
`db_owner` on `AMS-TEST` in SSMS.

**Database shows but queries fail / tables missing** — run `Setup-AMS-TEST.bat`
or execute `database\AMS-TEST.sql` in SSMS, then restart the server.

**". was unexpected at this time." when running a .bat** — the file was saved
with Unix line endings. Re-clone, or open the .bat in an editor that saves with
CRLF (e.g. Notepad++ Edit → EOL Conversion → Windows).

**Port 8000 already in use** — pass another port:
`run-django.bat 127.0.0.1:8080`.

**"Database unavailable" (503) in the UI** — the app is up but SQL Server is
not reachable. Read the `AMS-TEST database init failed. ...` line in the server
console for the real cause (matches the items above).

---

## Useful commands

```bat
python manage.py initdb          REM create/seed the database explicitly
python manage.py check           REM system checks
python -m unittest discover -s ams/tests -t .   REM run tests
```
