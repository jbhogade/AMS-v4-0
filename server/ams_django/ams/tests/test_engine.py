"""Unit tests for the collection engine (no database required)."""

import unittest

from ams.db import (
    ALLOWED_KEYS,
    TABLE_DEFS,
    KEY_INDEX,
    ColumnDef,
    TableDef,
    _full_name_compute,
    AmsDb,
)

DB = AmsDb(
    "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost;DATABASE=AMS-TEST;"
    "TrustServerCertificate=yes;Connection Timeout=3"
)


class RegistryTests(unittest.TestCase):
    def test_expected_collection_keys(self):
        expected = {
            "assets", "employees", "assetTypes", "assetMakes", "assetCategories",
            "sites", "departments", "designations", "vendors", "consumables",
            "spareParts", "accessories", "mobiles", "company", "roleAccess", "accessRights",
            "reportPrefs", "users", "exitRecords", "consumableLog", "sparePartLog",
            "simCards", "simOperators", "simPlans", "consumableCategories",
            "consumableUnits", "sparePartCategories", "vendorCategories",
        }
        self.assertEqual(ALLOWED_KEYS, expected)
        self.assertEqual(len(TABLE_DEFS), len(expected))
        for d in TABLE_DEFS:
            self.assertIsNotNone(KEY_INDEX.get(d.key))

    def test_document_collections_have_fixed_keys(self):
        for key in ("company", "roleAccess", "reportPrefs", "accessRights"):
            d = KEY_INDEX[key]
            self.assertTrue(d.is_document)
            self.assertIsNotNone(d.fixed_key)

    def test_log_collections_have_no_key_field(self):
        for key in ("consumableLog", "sparePartLog"):
            self.assertIsNone(KEY_INDEX[key].key_field)

    def test_employees_table_has_site_column(self):
        cols = {c.sql for c in KEY_INDEX["employees"].columns}
        self.assertIn("site", cols)
        self.assertIn("department", cols)
        self.assertIn("status", cols)
        self.assertIn("emp_id_company", cols)

    def test_promoted_form_columns(self):
        self.assertIn("purchase_site", {c.sql for c in KEY_INDEX["assets"].columns})
        self.assertIn("purchase_site", {c.sql for c in KEY_INDEX["mobiles"].columns})
        self.assertIn("remarks", {c.sql for c in KEY_INDEX["simCards"].columns})
        self.assertIn("vendor", {c.sql for c in KEY_INDEX["consumables"].columns})
        self.assertIn("vendor", {c.sql for c in KEY_INDEX["spareParts"].columns})
        self.assertIn("log_type", {c.sql for c in KEY_INDEX["consumableLog"].columns})
        self.assertIn("asset_base_id", {c.sql for c in KEY_INDEX["sparePartLog"].columns})
        self.assertIn("linked_employee", {c.sql for c in KEY_INDEX["users"].columns})
        self.assertIn("hr_admin_contact", {c.sql for c in KEY_INDEX["company"].columns})

    def test_asset_makes_typed_by_type(self):
        d = KEY_INDEX["assetMakes"]
        self.assertEqual(d.key_field, "makeCode")
        cols = {c.sql for c in d.columns}
        self.assertIn("make_code", cols)
        self.assertIn("asset_type", cols)
        self.assertIn("name", cols)

    def test_asset_type_category_and_used_on(self):
        type_cols = {c.sql for c in KEY_INDEX["assetTypes"].columns}
        self.assertIn("category", type_cols)
        cat_cols = {c.sql for c in KEY_INDEX["assetCategories"].columns}
        self.assertIn("used_on", cat_cols)


class ColumnValueTests(unittest.TestCase):
    def test_full_name_compute_prefers_name(self):
        self.assertEqual(_full_name_compute({"name": "Ravi Kumar", "firstName": "Ravi"}), "Ravi Kumar")

    def test_full_name_compute_parts(self):
        rec = {"firstName": "John", "middleName": "Q", "lastName": "Public"}
        self.assertEqual(_full_name_compute(rec), "John Q Public")

    def test_full_name_compute_blank(self):
        self.assertIsNone(_full_name_compute({}))
        self.assertIsNone(_full_name_compute({"firstName": "  "}))

    def test_string_column_extraction(self):
        col = ColumnDef("name", "name")
        self.assertEqual(DB._column_value({"name": "Printer"}, col), "Printer")
        self.assertIsNone(DB._column_value({}, col))
        self.assertIsNone(DB._column_value({"name": None}, col))

    def test_int_column_extraction(self):
        col = ColumnDef("qty", "qty", type="int")
        self.assertEqual(DB._column_value({"qty": 5}, col), 5)
        self.assertIsNone(DB._column_value({"qty": "abc"}, col))
        self.assertIsNone(DB._column_value({"qty": None}, col))

    def test_bit_column_extraction(self):
        col = ColumnDef("active", "active", type="bit")
        self.assertIs(DB._column_value({"active": True}, col), True)
        self.assertIs(DB._column_value({"active": False}, col), False)
        self.assertIs(DB._column_value({"active": "true"}, col), True)
        self.assertIsNone(DB._column_value({}, col))

    def test_numeric_string_coercion(self):
        col = ColumnDef("vendor_id", "vendorId")
        self.assertEqual(DB._column_value({"vendorId": 42}, col), "42")


class RecordKeyTests(unittest.TestCase):
    def test_uses_key_field(self):
        d = TableDef("assets", "ams_assets", key_field="id")
        self.assertEqual(DB._resolve_record_key({"id": "AST-001"}, d), "AST-001")

    def test_blank_key_field_generates(self):
        d = TableDef("assets", "ams_assets", key_field="id")
        key = DB._resolve_record_key({"id": ""}, d)
        self.assertEqual(len(key), 32)

    def test_log_entries_generate_keys(self):
        d = TableDef("consumableLog", "ams_consumable_log", key_field=None)
        key = DB._resolve_record_key({"note": "x"}, d)
        self.assertEqual(len(key), 32)


if __name__ == "__main__":
    unittest.main()
