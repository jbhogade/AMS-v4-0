# AMS-Django (Django backend)

Behavioral twin of `server/AMS.API` (.NET), sharing the same SQL Server
`AMS-TEST` database. Runs side-by-side with the .NET API and serves the
unchanged AMS-Test frontend same-origin.

> **On Windows?** Follow [`SETUP-WINDOWS.md`](SETUP-WINDOWS.md) for the full
> software list and step-by-step process. You can just run `run-django.bat`.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env      # Windows: copy .env.example .env  (edit it)
# System dependency (Debian/Ubuntu):
#   Microsoft ODBC Driver 18 for SQL Server + unixodbc-dev
```

## Run

```bash
python manage.py runserver            # http://127.0.0.1:8000
python manage.py initdb               # optional: create/seed the database
```

Startup is lazy: the first request runs the idempotent bootstrap (create
database, schema, seed users, migrate legacy collections, seed lookups), so the
server works even if `database/Setup-AMS-TEST.bat` was never run. Logs a warning
and serves API errors as 503 if SQL Server is unreachable.

## Configuration (env vars)

| Variable | Default | Meaning |
|---|---|---|
| `AMS_DB_SERVER` | `localhost` | SQL Server host |
| `AMS_DB_NAME` | `AMS-TEST` | database name |
| `AMS_DB_DRIVER` | `ODBC Driver 18 for SQL Server` | ODBC driver name (use `ODBC Driver 17 for SQL Server` if that's what's installed) |
| `AMS_DB_USER` / `AMS_DB_PASSWORD` | (empty) | SQL auth; unset => trusted connection |
| `AMS_DB_TRUST_CERT` | `yes` | `TrustServerCertificate` |
| `AMS_DB_CONNECT_TIMEOUT` | `15` | login timeout (seconds) |
| `AMS_JWT_KEY` | .NET default | HS256 signing key (must match .NET if you want tokens to be interchangeable) |
| `AMS_JWT_ISSUER` / `AMS_JWT_AUDIENCE` | `AMS-API` / `AMS-App` | JWT iss/aud |
| `AMS_JWT_EXPIRY_MINUTES` | `480` | token lifetime |
| `AMS_ALLOWED_HOSTS` | `*` | comma-separated allowed hosts |
| `AMS_DJANGO_SECRET_KEY` | dev default | Django secret |

## Tests

```bash
python -m unittest discover -s ams/tests -t .   # unit tests always run;
                                                # DB integration tests skip when
                                                # AMS-TEST is unreachable
```

## Notes

- No ORM models / migrations: the collection engine is raw SQL
  (`ams/db.py`), an exact port of `AmsDb.cs`. `runserver` is overridden to skip
  the migration check so the server starts when SQL Server is down.
- Passwords use the .NET PBKDF2 scheme, so existing `ams_users` rows work in
  both backends.
- Keep the schema DDL in `ams/db.py` in sync with `database/AMS-TEST.sql` and
  `AmsDb.cs`.
