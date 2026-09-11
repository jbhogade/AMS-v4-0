from django.core.management.commands.runserver import Command as RunserverCommand


class Command(RunserverCommand):
    """runserver that skips the DB-backed migration check.

    The AMS-v4-0 Django backend uses a raw-SQL engine with no ORM migrations,
    so the startup migration check (which opens a database connection and
    crashes when SQL Server is down) is skipped. The server must start even
    when the database is unreachable, matching the .NET API behavior.
    """

    def check_migrations(self):
        pass
