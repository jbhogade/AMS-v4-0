"""
Django settings for the AMS-v4-0 backend (side-by-side twin of server/AMS.API).

Environment-driven configuration. Defaults mirror the .NET appsettings.json so
the two backends behave identically out of the box.
"""

from __future__ import annotations

import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

_load_env: Callable[..., bool] | None
try:
    from dotenv import load_dotenv as _load_env
except ImportError:
    _load_env = None

BASE_DIR = Path(__file__).resolve().parent.parent

# The AMS-v4-0 web root (index.html, pages/, js/, css/, assets/) that this
# backend serves same-origin, exactly like the .NET API's UseStaticFiles.
FRONTEND_ROOT = BASE_DIR.parent.parent

# Optional .env file next to manage.py (see .env.example). Values in the real
# environment always win over the file. Best-effort so the app also runs when
# python-dotenv has not been installed yet.
if _load_env is not None:
    try:
        _load_env(BASE_DIR / ".env")
    except Exception:
        pass

DEBUG = os.environ.get("AMS_DEBUG", "1") == "1"

# Insecure development fallbacks are only allowed while DEBUG is on. Running
# with AMS_DEBUG=0 requires the real values to be supplied via the environment,
# otherwise a shipped default secret key/signing key would be forgeable.
SECRET_KEY = os.environ.get("AMS_DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError(
            "Set AMS_DJANGO_SECRET_KEY (see .env.example) before running with AMS_DEBUG=0."
        )
    SECRET_KEY = "ams-test-django-dev-secret-key-2026"

_allowed_hosts = os.environ.get("AMS_ALLOWED_HOSTS", "")
if _allowed_hosts:
    ALLOWED_HOSTS = [h for h in _allowed_hosts.split(",") if h]
elif DEBUG:
    ALLOWED_HOSTS = ["*"]
else:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

INSTALLED_APPS = [
    "ams",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "ams.middleware.InitDbMiddleware",
]

ROOT_URLCONF = "ams_django.urls"

TEMPLATES: list[dict[str, Any]] = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "ams_django.wsgi.application"

# ---- Database (SQL Server via mssql-django / pyodbc) -----------------------
# Connection string is built from env vars so it can be expressed as a DSN the
# same way the .NET SqlConnectionStringBuilder produced it.
def _build_connection_string() -> str:
    server = os.environ.get("AMS_DB_SERVER", "localhost")
    name = os.environ.get("AMS_DB_NAME", "AMS-v4-0")
    user = os.environ.get("AMS_DB_USER", "")
    pwd = os.environ.get("AMS_DB_PASSWORD", "")
    driver = os.environ.get("AMS_DB_DRIVER", "ODBC Driver 18 for SQL Server")
    trust_cert = os.environ.get("AMS_DB_TRUST_CERT", "yes")
    timeout = os.environ.get("AMS_DB_CONNECT_TIMEOUT", "15")
    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={server}",
        f"DATABASE={name}",
        f"TrustServerCertificate={trust_cert}",
        f"Connection Timeout={timeout}",
    ]
    if user:
        parts.append(f"UID={user}")
        parts.append(f"PWD={pwd}")
    else:
        parts.append("Trusted_Connection=yes")
    return ";".join(parts)


DATABASES: dict[str, dict[str, Any]] = {
    "default": {
        "ENGINE": "mssql",
        "NAME": os.environ.get("AMS_DB_NAME", "AMS-v4-0"),
        "OPTIONS": {
            "conn_string": _build_connection_string(),
            "extra_params": "TrustServerCertificate=yes",
        },
    }
}

# ---- JWT (parity with AuthController.CreateToken) ---------------------------
JWT_KEY = os.environ.get("AMS_JWT_KEY", "")
if not JWT_KEY:
    if not DEBUG:
        raise RuntimeError("Set AMS_JWT_KEY (see .env.example) before running with AMS_DEBUG=0.")
    JWT_KEY = "AmsTestDbLoginSigningKey_2026_ChangeMeInProduction_0123456789ABCDEF"
JWT_ISSUER = os.environ.get("AMS_JWT_ISSUER", "AMS-API")
JWT_AUDIENCE = os.environ.get("AMS_JWT_AUDIENCE", "AMS-App")
JWT_EXPIRY_MINUTES = int(os.environ.get("AMS_JWT_EXPIRY_MINUTES", "480"))

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
