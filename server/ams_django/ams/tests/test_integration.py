"""Integration tests against a live SQL Server AMS-TEST database.

Skipped automatically when the database is unreachable (e.g. this build
environment). Run with the DB up:  python3 -m unittest ams.tests.test_integration
"""

import os
import unittest

from ams.db import AmsDb, CollectionSaveError

DB = AmsDb(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    f"SERVER={os.environ.get('AMS_DB_SERVER', 'localhost')};"
    f"DATABASE={os.environ.get('AMS_DB_NAME', 'AMS-TEST')};"
    f"UID={os.environ.get('AMS_DB_USER', 'sa')};"
    f"PWD={os.environ.get('AMS_DB_PASSWORD', '')};"
    "TrustServerCertificate=yes;Connection Timeout=5"
)


def db_available():
    try:
        conn = DB.connect()
        conn.close()
        return True
    except Exception:
        return False


@unittest.skipUnless(db_available(), "AMS-TEST SQL Server database not reachable")
class CollectionIntegrationTests(unittest.TestCase):
    def test_save_and_get_round_trip(self):
        payload = '[{"name":"Jio"},{"name":"Airtel"}]'
        DB.save_collection("simOperators", payload)
        stored = DB.get_collection("simOperators")
        self.assertIsNotNone(stored)
        self.assertIn("Jio", stored)
        self.assertIn("Airtel", stored)

    def test_duplicate_key_raises(self):
        payload = '[{"name":"Same"},{"name":"Same"}]'
        with self.assertRaises(CollectionSaveError):
            DB.save_collection("simOperators", payload)

    def test_clear(self):
        DB.save_collection("simOperators", "[]")
        self.assertEqual(DB.get_collection("simOperators"), "[]")


@unittest.skipUnless(db_available(), "AMS-TEST SQL Server database not reachable")
class UserIntegrationTests(unittest.TestCase):
    TEST_USER = "django_it_user"

    def setUp(self):
        try:
            DB.delete_user(self.TEST_USER)
        except Exception:
            pass

    def tearDown(self):
        try:
            DB.delete_user(self.TEST_USER)
        except Exception:
            pass

    def test_create_find_update_delete(self):
        DB.create_user(self.TEST_USER, "Password@123", "Super Root", None, "it@ams.local", None, True)
        user = DB.find_user(self.TEST_USER)
        self.assertIsNotNone(user)
        self.assertTrue(DB.verify_password(user, "Password@123"))
        self.assertFalse(DB.verify_password(user, "nope"))

        DB.update_user(self.TEST_USER, None, None, None, "new@ams.local", None, None,
                       "IT User", "12345", None, None, None)
        updated = DB.find_user(self.TEST_USER)
        self.assertEqual(updated["email"], "new@ams.local")
        self.assertEqual(updated["display_name"], "IT User")
        # role not overwritten when None
        self.assertEqual(updated["role"], "Super Root")

        DB.update_user(self.TEST_USER, "NewPass@456", None, None, None, None, None,
                       None, None, None, None, None)
        changed = DB.find_user(self.TEST_USER)
        self.assertTrue(DB.verify_password(changed, "NewPass@456"))

        DB.delete_user(self.TEST_USER)
        self.assertIsNone(DB.find_user(self.TEST_USER))

    def test_seeded_supreme_root_exists(self):
        user = DB.find_user("operator.sys")
        self.assertIsNotNone(user)
        self.assertEqual(user["role"], "Supreme Root")
        self.assertTrue(DB.verify_password(user, "Sr#Ops@2026"))


if __name__ == "__main__":
    unittest.main()
