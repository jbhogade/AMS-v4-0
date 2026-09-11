"""Lazy database bootstrap, mirroring the .NET API's InitializeAsync at startup.

Runs once per process on first request: create database, schema, seed users,
migrate legacy collections, seed lookups. All idempotent and best-effort - a
failure (e.g. SQL Server is down or setup was not run) is logged, matching the
.NET behavior of swallowing the startup init error.
"""

import logging

logger = logging.getLogger(__name__)

_initialized = False


class InitDbMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        global _initialized
        if not _initialized:
            _initialized = True
            self._init()

    def _init(self):
        try:
            from .db import get_db

            get_db().initialize()
        except Exception as ex:  # noqa: BLE001 - init must never block requests
            logger.error(
                "AMS-TEST database init failed. Run database/Setup-AMS-TEST.bat then retry. %s", ex
            )

    def __call__(self, request):
        return self.get_response(request)
