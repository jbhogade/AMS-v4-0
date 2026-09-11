from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Create/update the AMS-TEST database, schema, seed users, legacy "
        "migration and seed lookups. Idempotent and safe to re-run."
    )

    def handle(self, *args, **options):
        from ams.db import get_db

        db = get_db()
        db.initialize()
        self.stdout.write(self.style.SUCCESS("AMS-TEST database initialized."))
