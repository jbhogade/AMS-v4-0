# AMS-Test Django Backend — Design

Date: 2026-08-26

## Goal

Add a Django backend to AMS-Test that is a behavioral twin of the existing
ASP.NET Core API (`server/AMS.API`), running **side-by-side** with it against
the **same SQL Server `AMS-TEST` database**. The frontend is unchanged and is
served same-origin by the Django backend. The .NET API stays in the repo and is
not modified.

## Decisions

- **Side-by-side**: keep `server/AMS.API`; add the Django project at
  `server/ams_django`. Both may run against the same database.
- **Data layer**: raw-SQL engine — a faithful Python port of `AmsDb.cs`
  (TableDefs registry, idempotent DDL, wholesale replace preserving `row_id`
  order, duplicate-key detection, seed users/lookups, legacy migration). No ORM
  models, no Django migrations. Connections via the **mssql-django** backend
  (`cursor()`).
- **Auth**: replicate the .NET PBKDF2-SHA256 scheme (100 000 iterations,
  16-byte random salt, hex-encoded, upper-case) so existing `ams_users` rows and
  passwords keep working. HS256 JWT via PyJWT with identical claims
  (`sub`, `jti`, `nameidentifier`, `role`, `name`), issuer/audience and
  480-minute expiry.
- **Database**: SQL Server (unchanged). Env-configurable connection; defaults
  match the .NET `appsettings.json`.
- **Excluded (YAGNI)**: Django admin, ORM migrations, CORS (same-origin),
  session auth, changes to the frontend or test harnesses.

## Layout

```
server/ams_django/
  manage.py
  requirements.txt          Django==5.2.13, mssql-django, pyodbc, PyJWT
  ams_django/
    settings.py             env-driven (DB connection, JWT); frontend root
    urls.py                 /api/* routes then frontend catch-all
    wsgi.py asgi.py
  ams/
    apps.py
    crypto.py               PBKDF2 port + JWT create/validate
    db.py                   port of AmsDb.cs (engine, TableDefs, DDL, seeds)
    views.py                auth, users, collection, health, frontend serving
    urls.py
    middleware.py           lazy DB init once per process (mirrors .NET startup)
    management/commands/initdb.py
    tests/                  unit tests (no DB) + DB-gated integration tests
```

## Data engine (`db.py`)

Port of `AmsDb.cs`:

- `SchemaTablesSql` / `SchemaIndexesSql` reused verbatim as idempotent DDL.
- `TableDefs`: all 27 collection keys with typed columns, including the
  `employees.full_name` compute (name → parts fallback), `int`/`bit` coercion,
  document collections (`company`, `roleAccess`, `reportPrefs`, `accessRights`),
  log tables with no natural key (`consumableLog`, `sparePartLog`).
- `EnsureDatabaseExists` (master connection), `EnsureSchema`,
  `EnsureSeedUserAsync` (2 seeds; re-hash/activate on every start),
  `MigrateLegacyCollectionsAsync`, `EnsureSeedLookupsAsync` (6 lookup seeds).
  All idempotent; each step best-effort.
- `GetCollectionAsync` / `SaveCollectionAsync` / `ResolveRecordKey` /
  `InsertRow`: wholesale DELETE + INSERT in array order; duplicate natural key
  raises `CollectionSaveError` → 409; document collections keyed by fixed key.
- Users: `FindUserAsync`, `VerifyPassword`, `ListUsersAsync`, `CreateUserAsync`,
  `UpdateUserAsync` (ISNULL-merge semantics), `DeleteUserAsync`.

## Auth (`crypto.py`)

- `new_salt()` → 16 random bytes hex (upper-case).
- `hash_password(password, salt_hex)` → `pbkdf2_hmac('sha256', password,
  bytes.fromhex(salt), 100_000, 32).hex().upper()`.
- `verify_password(hash_hex, salt_hex, password)` via `hmac.compare_digest`.
- `create_token(user)` / `validate_token(token)`: HS256, claims above, expiry
  from settings (default 480), issuer/audience from settings (defaults
  `AMS-API`/`AMS-App`).

## API endpoints (status-code parity)

| Route | Behavior |
|---|---|
| `POST /api/auth/login` | 200 profile+token; 400 blank; 401 inactive/invalid |
| `GET /api/auth/me` | 200 profile; 401 |
| `PUT /api/auth/me` | update profile/password; 400 wrong current password |
| `GET/POST /api/auth/users` | list/create; role gates, 409 duplicate, 403 |
| `PUT/DELETE /api/auth/users/{u}` | update/delete; 404, 403 Supreme-Root rules |
| `GET/PUT/DELETE /api/collection/{key}` | 404 unknown key; 400 bad body/>16 MB; 409 duplicate key |
| `GET /api/health` | `{ok:true, app, database}` |

- `require_auth` decorator: parse `Authorization: Bearer`, 401 on missing/
  invalid/expired (frontend clears session and redirects on 401).
- `pyodbc.Error` → **503** JSON: "Database unavailable. Check that SQL Server is
  running and run database/Setup-AMS-TEST.bat, then restart the API." (matches
  the .NET message).
- 16 MB request body cap for collection PUTs.

## Frontend serving

Django serves the AMS-Test root same-origin: `/` → `index.html`, `/pages/*.html`,
`/js/*`, `/css/*`, `/assets/*` via a path-guarded file view (no traversal).
`/api/*` and `/static/*` are excluded from the catch-all.

## Bootstrap

- `python manage.py initdb` — explicit idempotent init.
- Lazy init middleware runs init once per process on first request (logged on
  failure), mirroring .NET `InitializeAsync` at startup.

## Configuration

Env vars (with .NET-equivalent defaults):

- `AMS_DB_SERVER` (default `localhost`), `AMS_DB_NAME` (`AMS-TEST`),
  `AMS_DB_USER` / `AMS_DB_PASSWORD` (SQL auth; if unset → trusted connection),
  `AMS_DB_DRIVER` (`ODBC Driver 18 for SQL Server`), `AMS_DB_TRUST_CERT` (`yes`).
- `AMS_JWT_KEY` (default matches .NET), `AMS_JWT_ISSUER` (`AMS-API`),
  `AMS_JWT_AUDIENCE` (`AMS-App`), `AMS_JWT_EXPIRY_MINUTES` (`480`).

## Verification

- Unit tests (no DB): PBKDF2 vectors vs .NET, JWT round-trip, record-key
  resolution, column extraction incl. `full_name` compute, duplicate detection.
- Integration tests (skipUnless DB reachable): full endpoint parity.
- Local: `runserver` boot, `/api/health` 200, frontend served, DB-down endpoints
  return 503 (same checks performed against the .NET API).
- Frontend jsdom harnesses re-run unchanged against the Django-served frontend.

## Out of scope / deferred

- Django admin, ORM migrations, CORS, session auth, frontend changes, .NET API
  changes.
