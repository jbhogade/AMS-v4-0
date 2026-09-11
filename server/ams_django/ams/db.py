"""Raw-SQL engine for AMS-Test — a faithful Python port of
server/AMS.API/Data/AmsDb.cs. Schema DDL, the collection registry, wholesale
replace preserving row_id order, duplicate-key detection, seed users/lookups
and legacy migration all behave identically to the .NET version, so the Django
backend and the .NET API can share the same SQL Server database.
"""

import json
import logging
import re
import uuid

import pyodbc

import ams.crypto as crypto

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Idempotent DDL (verbatim from AmsDb.cs SchemaTablesSql / SchemaIndexesSql /
# the EnsureSchemaAsync ALTER guards)
# ---------------------------------------------------------------------------

SCHEMA_TABLES_SQL = """
IF OBJECT_ID(N'dbo.ams_users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_users (
        username        NVARCHAR(100)  NOT NULL PRIMARY KEY,
        password_hash   NVARCHAR(256)  NOT NULL,
        password_salt   NVARCHAR(64)   NOT NULL,
        role            NVARCHAR(50)   NOT NULL,
        linked_employee NVARCHAR(100)  NULL,
        email           NVARCHAR(200)  NULL,
        remarks         NVARCHAR(500)  NULL,
        active          BIT            NOT NULL DEFAULT 1,
        display_name    NVARCHAR(200)  NULL,
        contact_no      NVARCHAR(50)   NULL,
        address         NVARCHAR(500)  NULL,
        dob             NVARCHAR(20)   NULL,
        gender          NVARCHAR(20)   NULL
    );
END;

IF OBJECT_ID(N'dbo.ams_collections', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_collections (
        collection_key NVARCHAR(100) NOT NULL PRIMARY KEY,
        data_json      NVARCHAR(MAX) NOT NULL,
        updated_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_user_profiles (
        row_id       BIGINT IDENTITY(1,1) NOT NULL,
        record_key   NVARCHAR(200) NOT NULL,
        username         NVARCHAR(100) NULL,
        role             NVARCHAR(50)  NULL,
        display_name     NVARCHAR(200) NULL,
        email            NVARCHAR(200) NULL,
        contact_no       NVARCHAR(50)  NULL,
        address          NVARCHAR(500) NULL,
        dob              NVARCHAR(20)  NULL,
        gender           NVARCHAR(20)  NULL,
        linked_employee  NVARCHAR(100) NULL,
        remarks          NVARCHAR(500) NULL,
        active           BIT           NOT NULL DEFAULT 1,
        data_json    NVARCHAR(MAX) NOT NULL,
        updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_user_profiles PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_asset_types', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_asset_types (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        name       NVARCHAR(200) NULL,
        shortform  NVARCHAR(20)  NULL,
        category   NVARCHAR(200) NULL,
        active     BIT           NOT NULL DEFAULT 1,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_asset_types PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_asset_makes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_asset_makes (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        make_code  NVARCHAR(50)  NULL,
        name       NVARCHAR(200) NULL,
        asset_type NVARCHAR(200) NULL,
        active     BIT           NOT NULL DEFAULT 1,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_asset_makes PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_asset_categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_asset_categories (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        name       NVARCHAR(200) NULL,
        used_on    NVARCHAR(50)  NULL,
        active     BIT           NOT NULL DEFAULT 1,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_asset_categories PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_sites', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_sites (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        name       NVARCHAR(200) NULL,
        shortform  NVARCHAR(20)  NULL,
        address    NVARCHAR(500) NULL,
        active     BIT           NOT NULL DEFAULT 1,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_sites PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_departments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_departments (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        name       NVARCHAR(200) NULL,
        shortform  NVARCHAR(20)  NULL,
        active     BIT           NOT NULL DEFAULT 1,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_departments PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_designations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_designations (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        name       NVARCHAR(200) NULL,
        active     BIT           NOT NULL DEFAULT 1,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_designations PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_accessories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_accessories (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        acc_code   NVARCHAR(50)  NULL,
        name       NVARCHAR(200) NULL,
        asset_type NVARCHAR(200) NULL,
        site       NVARCHAR(200) NULL,
        active     BIT           NOT NULL DEFAULT 1,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_accessories PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_vendors (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        vendor_id      NVARCHAR(50)  NULL,
        name           NVARCHAR(200) NULL,
        category       NVARCHAR(200) NULL,
        city           NVARCHAR(200) NULL,
        contact_person NVARCHAR(200) NULL,
        phone          NVARCHAR(50)  NULL,
        email          NVARCHAR(200) NULL,
        gstin          NVARCHAR(20)  NULL,
        remarks        NVARCHAR(500) NULL,
        active         BIT           NOT NULL DEFAULT 1,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_vendors PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_sim_operators', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_sim_operators (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        name       NVARCHAR(200) NULL,
        helpline   NVARCHAR(50)  NULL,
        website    NVARCHAR(300) NULL,
        active     BIT           NOT NULL DEFAULT 1,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_sim_operators PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_sim_plans', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_sim_plans (
        row_id      BIGINT IDENTITY(1,1) NOT NULL,
        record_key  NVARCHAR(200) NOT NULL,
        name        NVARCHAR(200) NULL,
        plan_type   NVARCHAR(100) NULL,
        description NVARCHAR(500) NULL,
        active      BIT           NOT NULL DEFAULT 1,
        data_json   NVARCHAR(MAX) NOT NULL,
        updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_sim_plans PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_consumable_categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_consumable_categories (
        row_id      BIGINT IDENTITY(1,1) NOT NULL,
        record_key  NVARCHAR(200) NOT NULL,
        name        NVARCHAR(200) NULL,
        description NVARCHAR(500) NULL,
        active      BIT           NOT NULL DEFAULT 1,
        data_json   NVARCHAR(MAX) NOT NULL,
        updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_consumable_categories PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_consumable_units', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_consumable_units (
        row_id      BIGINT IDENTITY(1,1) NOT NULL,
        record_key  NVARCHAR(200) NOT NULL,
        name        NVARCHAR(200) NULL,
        description NVARCHAR(500) NULL,
        active      BIT           NOT NULL DEFAULT 1,
        data_json   NVARCHAR(MAX) NOT NULL,
        updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_consumable_units PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_spare_part_categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_spare_part_categories (
        row_id      BIGINT IDENTITY(1,1) NOT NULL,
        record_key  NVARCHAR(200) NOT NULL,
        name        NVARCHAR(200) NULL,
        description NVARCHAR(500) NULL,
        active      BIT           NOT NULL DEFAULT 1,
        data_json   NVARCHAR(MAX) NOT NULL,
        updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_spare_part_categories PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_vendor_categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_vendor_categories (
        row_id      BIGINT IDENTITY(1,1) NOT NULL,
        record_key  NVARCHAR(200) NOT NULL,
        name        NVARCHAR(200) NULL,
        description NVARCHAR(500) NULL,
        active      BIT           NOT NULL DEFAULT 1,
        data_json   NVARCHAR(MAX) NOT NULL,
        updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_vendor_categories PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_assets (
        row_id         BIGINT IDENTITY(1,1) NOT NULL,
        record_key     NVARCHAR(200) NOT NULL,
        asset_id       NVARCHAR(200) NULL,
        ams_asset_id   NVARCHAR(200) NULL,
        display_id     NVARCHAR(200) NULL,
        name           NVARCHAR(300) NULL,
        status         NVARCHAR(100) NULL,
        asset_type     NVARCHAR(200) NULL,
        category       NVARCHAR(200) NULL,
        make           NVARCHAR(200) NULL,
        site           NVARCHAR(200) NULL,
        current_site   NVARCHAR(200) NULL,
        purchase_site  NVARCHAR(200) NULL,
        assigned_to    NVARCHAR(200) NULL,
        model          NVARCHAR(200) NULL,
        serial_number  NVARCHAR(200) NULL,
        vendor         NVARCHAR(200) NULL,
        purchase_date  NVARCHAR(20)  NULL,
        warranty_end   NVARCHAR(20)  NULL,
        purchase_cost  NVARCHAR(50)  NULL,
        data_json      NVARCHAR(MAX) NOT NULL,
        updated_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_assets PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_mobiles (
        row_id         BIGINT IDENTITY(1,1) NOT NULL,
        record_key     NVARCHAR(200) NOT NULL,
        asset_id       NVARCHAR(200) NULL,
        ams_asset_id   NVARCHAR(200) NULL,
        display_id     NVARCHAR(200) NULL,
        name           NVARCHAR(300) NULL,
        status         NVARCHAR(100) NULL,
        asset_type     NVARCHAR(200) NULL,
        category       NVARCHAR(200) NULL,
        make           NVARCHAR(200) NULL,
        site           NVARCHAR(200) NULL,
        current_site   NVARCHAR(200) NULL,
        purchase_site  NVARCHAR(200) NULL,
        assigned_to    NVARCHAR(200) NULL,
        model          NVARCHAR(200) NULL,
        serial_number  NVARCHAR(200) NULL,
        imei1          NVARCHAR(50)  NULL,
        imei2          NVARCHAR(50)  NULL,
        battery_no     NVARCHAR(100) NULL,
        charger_no     NVARCHAR(100) NULL,
        sim_mobile_no  NVARCHAR(50)  NULL,
        vendor         NVARCHAR(200) NULL,
        purchase_date  NVARCHAR(20)  NULL,
        warranty_end   NVARCHAR(20)  NULL,
        purchase_cost  NVARCHAR(50)  NULL,
        data_json      NVARCHAR(MAX) NOT NULL,
        updated_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_mobiles PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_employees (
        row_id      BIGINT IDENTITY(1,1) NOT NULL,
        record_key  NVARCHAR(200) NOT NULL,
        ams_id         NVARCHAR(100) NULL,
        emp_id         NVARCHAR(100) NULL,
        emp_id_company NVARCHAR(100) NULL,
        full_name      NVARCHAR(300) NULL,
        department  NVARCHAR(200) NULL,
        designation NVARCHAR(200) NULL,
        site           NVARCHAR(200) NULL,
        status         NVARCHAR(50)  NULL,
        contact        NVARCHAR(50)  NULL,
        email          NVARCHAR(200) NULL,
        manager_ams_id NVARCHAR(200) NULL,
        data_json      NVARCHAR(MAX) NOT NULL,
        updated_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_employees PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_consumables (
        row_id        BIGINT IDENTITY(1,1) NOT NULL,
        record_key    NVARCHAR(200) NOT NULL,
        consumable_id NVARCHAR(50)  NULL,
        name          NVARCHAR(300) NULL,
        category      NVARCHAR(200) NULL,
        unit          NVARCHAR(100) NULL,
        site          NVARCHAR(200) NULL,
        qty           INT           NULL,
        reorder_level INT           NULL,
        restock_date  NVARCHAR(20)  NULL,
        warranty_date NVARCHAR(20)  NULL,
        unit_cost     NVARCHAR(50)  NULL,
        vendor        NVARCHAR(200) NULL,
        remarks       NVARCHAR(500) NULL,
        data_json     NVARCHAR(MAX) NOT NULL,
        updated_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_consumables PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_consumable_log (
        row_id        BIGINT IDENTITY(1,1) NOT NULL,
        record_key    NVARCHAR(200) NOT NULL,
        log_date      NVARCHAR(20)  NULL,
        consumable_id NVARCHAR(50)  NULL,
        name          NVARCHAR(300) NULL,
        site          NVARCHAR(200) NULL,
        log_type      NVARCHAR(50)  NULL,
        qty           INT           NULL,
        by_whom       NVARCHAR(300) NULL,
        remarks       NVARCHAR(500) NULL,
        data_json     NVARCHAR(MAX) NOT NULL,
        updated_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_consumable_log PRIMARY KEY (row_id)
    );
END;

IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_spare_parts (
        row_id        BIGINT IDENTITY(1,1) NOT NULL,
        record_key    NVARCHAR(200) NOT NULL,
        part_id       NVARCHAR(50)  NULL,
        name          NVARCHAR(300) NULL,
        category      NVARCHAR(200) NULL,
        asset_type    NVARCHAR(200) NULL,
        site          NVARCHAR(200) NULL,
        qty           INT           NULL,
        reorder_level INT           NULL,
        restock_date  NVARCHAR(20)  NULL,
        warranty_date NVARCHAR(20)  NULL,
        unit_cost     NVARCHAR(50)  NULL,
        vendor        NVARCHAR(200) NULL,
        remarks       NVARCHAR(500) NULL,
        data_json     NVARCHAR(MAX) NOT NULL,
        updated_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_spare_parts PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_spare_part_log (
        row_id            BIGINT IDENTITY(1,1) NOT NULL,
        record_key        NVARCHAR(200) NOT NULL,
        log_date          NVARCHAR(20)  NULL,
        part_id           NVARCHAR(50)  NULL,
        name              NVARCHAR(300) NULL,
        site              NVARCHAR(200) NULL,
        log_type          NVARCHAR(50)  NULL,
        qty               INT           NULL,
        by_whom           NVARCHAR(300) NULL,
        remarks           NVARCHAR(500) NULL,
        asset_base_id     NVARCHAR(200) NULL,
        asset_id_snapshot NVARCHAR(200) NULL,
        data_json         NVARCHAR(MAX) NOT NULL,
        updated_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_spare_part_log PRIMARY KEY (row_id)
    );
END;

IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_sim_cards (
        row_id        BIGINT IDENTITY(1,1) NOT NULL,
        record_key    NVARCHAR(200) NOT NULL,
        sim_id        NVARCHAR(50)  NULL,
        mobile_number NVARCHAR(50)  NULL,
        operator      NVARCHAR(200) NULL,
        plan_name     NVARCHAR(200) NULL,
        status           NVARCHAR(50)  NULL,
        assigned_to      NVARCHAR(200) NULL,
        iccid            NVARCHAR(50)  NULL,
        activation_date  NVARCHAR(20)  NULL,
        vendor           NVARCHAR(200) NULL,
        cost             NVARCHAR(50)  NULL,
        assigned_date    NVARCHAR(20)  NULL,
        linked_mobile_id NVARCHAR(200) NULL,
        personal_mobile  BIT           NULL,
        site             NVARCHAR(200) NULL,
        remarks          NVARCHAR(500) NULL,
        data_json        NVARCHAR(MAX) NOT NULL,
        updated_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_sim_cards PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_exit_records', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_exit_records (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(200) NOT NULL,
        exit_id    NVARCHAR(50)  NULL,
        ams_id     NVARCHAR(100) NULL,
        emp_name   NVARCHAR(300) NULL,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_exit_records PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_company', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_company (
        row_id           BIGINT IDENTITY(1,1) NOT NULL,
        record_key       NVARCHAR(100) NOT NULL,
        name             NVARCHAR(300) NULL,
        address          NVARCHAR(500) NULL,
        slogan           NVARCHAR(300) NULL,
        hr_admin_contact NVARCHAR(200) NULL,
        head_title       NVARCHAR(200) NULL,
        head_contact     NVARCHAR(200) NULL,
        data_json        NVARCHAR(MAX) NOT NULL,
        updated_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_company PRIMARY KEY (record_key)
    );
END;

IF OBJECT_ID(N'dbo.ams_documents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_documents (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(100) NOT NULL,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_documents PRIMARY KEY (record_key)
    );
END;
"""

SCHEMA_ALTERS_SQL = """
IF COL_LENGTH(N'dbo.ams_users', N'display_name') IS NULL
    ALTER TABLE dbo.ams_users ADD display_name NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.ams_users', N'contact_no') IS NULL
    ALTER TABLE dbo.ams_users ADD contact_no NVARCHAR(50) NULL;
IF COL_LENGTH(N'dbo.ams_users', N'address') IS NULL
    ALTER TABLE dbo.ams_users ADD address NVARCHAR(500) NULL;
IF COL_LENGTH(N'dbo.ams_users', N'dob') IS NULL
    ALTER TABLE dbo.ams_users ADD dob NVARCHAR(20) NULL;
IF COL_LENGTH(N'dbo.ams_users', N'gender') IS NULL
    ALTER TABLE dbo.ams_users ADD gender NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_user_profiles', N'email') IS NULL
    ALTER TABLE dbo.ams_user_profiles ADD email NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_user_profiles', N'contact_no') IS NULL
    ALTER TABLE dbo.ams_user_profiles ADD contact_no NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_user_profiles', N'address') IS NULL
    ALTER TABLE dbo.ams_user_profiles ADD address NVARCHAR(500) NULL;
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_user_profiles', N'dob') IS NULL
    ALTER TABLE dbo.ams_user_profiles ADD dob NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_user_profiles', N'gender') IS NULL
    ALTER TABLE dbo.ams_user_profiles ADD gender NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'status') IS NULL
    ALTER TABLE dbo.ams_assets ADD status NVARCHAR(100) NULL;
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'current_site') IS NULL
    ALTER TABLE dbo.ams_assets ADD current_site NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'status') IS NULL
    ALTER TABLE dbo.ams_employees ADD status NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'site') IS NULL
    ALTER TABLE dbo.ams_employees ADD site NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'contact') IS NULL
    ALTER TABLE dbo.ams_employees ADD contact NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'email') IS NULL
    ALTER TABLE dbo.ams_employees ADD email NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'manager_ams_id') IS NULL
    ALTER TABLE dbo.ams_employees ADD manager_ams_id NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'model') IS NULL
    ALTER TABLE dbo.ams_assets ADD model NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'serial_number') IS NULL
    ALTER TABLE dbo.ams_assets ADD serial_number NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'vendor') IS NULL
    ALTER TABLE dbo.ams_assets ADD vendor NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'purchase_date') IS NULL
    ALTER TABLE dbo.ams_assets ADD purchase_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'warranty_end') IS NULL
    ALTER TABLE dbo.ams_assets ADD warranty_end NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'purchase_cost') IS NULL
    ALTER TABLE dbo.ams_assets ADD purchase_cost NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'model') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD model NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'serial_number') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD serial_number NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'imei1') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD imei1 NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'imei2') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD imei2 NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'battery_no') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD battery_no NVARCHAR(100) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'charger_no') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD charger_no NVARCHAR(100) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'sim_mobile_no') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD sim_mobile_no NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'vendor') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD vendor NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'purchase_date') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD purchase_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'warranty_end') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD warranty_end NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'purchase_cost') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD purchase_cost NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_vendors', N'contact_person') IS NULL
    ALTER TABLE dbo.ams_vendors ADD contact_person NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_vendors', N'phone') IS NULL
    ALTER TABLE dbo.ams_vendors ADD phone NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_vendors', N'email') IS NULL
    ALTER TABLE dbo.ams_vendors ADD email NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_vendors', N'gstin') IS NULL
    ALTER TABLE dbo.ams_vendors ADD gstin NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_vendors', N'remarks') IS NULL
    ALTER TABLE dbo.ams_vendors ADD remarks NVARCHAR(500) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'status') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD status NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'iccid') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD iccid NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'activation_date') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD activation_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'vendor') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD vendor NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'cost') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD cost NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'assigned_date') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD assigned_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'linked_mobile_id') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD linked_mobile_id NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'personal_mobile') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD personal_mobile BIT NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'plan_name') IS NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'plan') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD plan_name NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'plan_name') IS NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'plan') IS NOT NULL
    EXEC sp_rename N'dbo.ams_sim_cards.plan', N'plan_name', 'COLUMN';
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'site') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD site NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_accessories', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_accessories', N'site') IS NULL
    ALTER TABLE dbo.ams_accessories ADD site NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_asset_makes', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_asset_makes', N'make_code') IS NULL
    ALTER TABLE dbo.ams_asset_makes ADD make_code NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_asset_makes', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_asset_makes', N'asset_type') IS NULL
    ALTER TABLE dbo.ams_asset_makes ADD asset_type NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_asset_types', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_asset_types', N'category') IS NULL
    ALTER TABLE dbo.ams_asset_types ADD category NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_asset_categories', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_asset_categories', N'used_on') IS NULL
    ALTER TABLE dbo.ams_asset_categories ADD used_on NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'purchase_site') IS NULL
    ALTER TABLE dbo.ams_assets ADD purchase_site NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'purchase_site') IS NULL
    ALTER TABLE dbo.ams_mobiles ADD purchase_site NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'emp_id_company') IS NULL
    ALTER TABLE dbo.ams_employees ADD emp_id_company NVARCHAR(100) NULL;
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'remarks') IS NULL
    ALTER TABLE dbo.ams_sim_cards ADD remarks NVARCHAR(500) NULL;
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumables', N'restock_date') IS NULL
    ALTER TABLE dbo.ams_consumables ADD restock_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumables', N'warranty_date') IS NULL
    ALTER TABLE dbo.ams_consumables ADD warranty_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumables', N'unit_cost') IS NULL
    ALTER TABLE dbo.ams_consumables ADD unit_cost NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumables', N'vendor') IS NULL
    ALTER TABLE dbo.ams_consumables ADD vendor NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumables', N'remarks') IS NULL
    ALTER TABLE dbo.ams_consumables ADD remarks NVARCHAR(500) NULL;
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_parts', N'restock_date') IS NULL
    ALTER TABLE dbo.ams_spare_parts ADD restock_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_parts', N'warranty_date') IS NULL
    ALTER TABLE dbo.ams_spare_parts ADD warranty_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_parts', N'unit_cost') IS NULL
    ALTER TABLE dbo.ams_spare_parts ADD unit_cost NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_parts', N'vendor') IS NULL
    ALTER TABLE dbo.ams_spare_parts ADD vendor NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_parts', N'remarks') IS NULL
    ALTER TABLE dbo.ams_spare_parts ADD remarks NVARCHAR(500) NULL;
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'log_date') IS NULL
    ALTER TABLE dbo.ams_consumable_log ADD log_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'consumable_id') IS NULL
    ALTER TABLE dbo.ams_consumable_log ADD consumable_id NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'name') IS NULL
    ALTER TABLE dbo.ams_consumable_log ADD name NVARCHAR(300) NULL;
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'site') IS NULL
    ALTER TABLE dbo.ams_consumable_log ADD site NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'log_type') IS NULL
    ALTER TABLE dbo.ams_consumable_log ADD log_type NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'qty') IS NULL
    ALTER TABLE dbo.ams_consumable_log ADD qty INT NULL;
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'by_whom') IS NULL
    ALTER TABLE dbo.ams_consumable_log ADD by_whom NVARCHAR(300) NULL;
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'remarks') IS NULL
    ALTER TABLE dbo.ams_consumable_log ADD remarks NVARCHAR(500) NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'log_date') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD log_date NVARCHAR(20) NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'part_id') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD part_id NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'name') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD name NVARCHAR(300) NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'site') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD site NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'log_type') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD log_type NVARCHAR(50) NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'qty') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD qty INT NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'by_whom') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD by_whom NVARCHAR(300) NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'remarks') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD remarks NVARCHAR(500) NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'asset_base_id') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD asset_base_id NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'asset_id_snapshot') IS NULL
    ALTER TABLE dbo.ams_spare_part_log ADD asset_id_snapshot NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_company', N'address') IS NULL
    ALTER TABLE dbo.ams_company ADD address NVARCHAR(500) NULL;
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_company', N'slogan') IS NULL
    ALTER TABLE dbo.ams_company ADD slogan NVARCHAR(300) NULL;
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_company', N'hr_admin_contact') IS NULL
    ALTER TABLE dbo.ams_company ADD hr_admin_contact NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_company', N'head_title') IS NULL
    ALTER TABLE dbo.ams_company ADD head_title NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_company', N'head_contact') IS NULL
    ALTER TABLE dbo.ams_company ADD head_contact NVARCHAR(200) NULL;
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_user_profiles', N'linked_employee') IS NULL
    ALTER TABLE dbo.ams_user_profiles ADD linked_employee NVARCHAR(100) NULL;
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_user_profiles', N'remarks') IS NULL
    ALTER TABLE dbo.ams_user_profiles ADD remarks NVARCHAR(500) NULL;
"""

SCHEMA_INDEXES_SQL = """
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_assets_status' AND object_id = OBJECT_ID(N'dbo.ams_assets'))
    AND COL_LENGTH(N'dbo.ams_assets', N'status') IS NOT NULL
    CREATE INDEX IX_ams_assets_status ON dbo.ams_assets(status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_assets_type' AND object_id = OBJECT_ID(N'dbo.ams_assets'))
    AND COL_LENGTH(N'dbo.ams_assets', N'asset_type') IS NOT NULL
    CREATE INDEX IX_ams_assets_type ON dbo.ams_assets(asset_type);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_assets_site' AND object_id = OBJECT_ID(N'dbo.ams_assets'))
    AND COL_LENGTH(N'dbo.ams_assets', N'current_site') IS NOT NULL
    CREATE INDEX IX_ams_assets_site ON dbo.ams_assets(current_site);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_employees_department' AND object_id = OBJECT_ID(N'dbo.ams_employees'))
    AND COL_LENGTH(N'dbo.ams_employees', N'department') IS NOT NULL
    CREATE INDEX IX_ams_employees_department ON dbo.ams_employees(department);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_employees_status' AND object_id = OBJECT_ID(N'dbo.ams_employees'))
    AND COL_LENGTH(N'dbo.ams_employees', N'status') IS NOT NULL
    CREATE INDEX IX_ams_employees_status ON dbo.ams_employees(status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_employees_site' AND object_id = OBJECT_ID(N'dbo.ams_employees'))
    AND COL_LENGTH(N'dbo.ams_employees', N'site') IS NOT NULL
    CREATE INDEX IX_ams_employees_site ON dbo.ams_employees(site);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_consumables_site' AND object_id = OBJECT_ID(N'dbo.ams_consumables'))
    AND COL_LENGTH(N'dbo.ams_consumables', N'site') IS NOT NULL
    CREATE INDEX IX_ams_consumables_site ON dbo.ams_consumables(site);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_spare_parts_site' AND object_id = OBJECT_ID(N'dbo.ams_spare_parts'))
    AND COL_LENGTH(N'dbo.ams_spare_parts', N'site') IS NOT NULL
    CREATE INDEX IX_ams_spare_parts_site ON dbo.ams_spare_parts(site);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_sim_cards_operator' AND object_id = OBJECT_ID(N'dbo.ams_sim_cards'))
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'operator') IS NOT NULL
    CREATE INDEX IX_ams_sim_cards_operator ON dbo.ams_sim_cards(operator);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_sim_cards_status' AND object_id = OBJECT_ID(N'dbo.ams_sim_cards'))
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'status') IS NOT NULL
    CREATE INDEX IX_ams_sim_cards_status ON dbo.ams_sim_cards(status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_sim_cards_linked_mobile' AND object_id = OBJECT_ID(N'dbo.ams_sim_cards'))
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'linked_mobile_id') IS NOT NULL
    CREATE INDEX IX_ams_sim_cards_linked_mobile ON dbo.ams_sim_cards(linked_mobile_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_mobiles_imei1' AND object_id = OBJECT_ID(N'dbo.ams_mobiles'))
    AND COL_LENGTH(N'dbo.ams_mobiles', N'imei1') IS NOT NULL
    CREATE INDEX IX_ams_mobiles_imei1 ON dbo.ams_mobiles(imei1);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_mobiles_sim_mobile_no' AND object_id = OBJECT_ID(N'dbo.ams_mobiles'))
    AND COL_LENGTH(N'dbo.ams_mobiles', N'sim_mobile_no') IS NOT NULL
    CREATE INDEX IX_ams_mobiles_sim_mobile_no ON dbo.ams_mobiles(sim_mobile_no);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_employees_email' AND object_id = OBJECT_ID(N'dbo.ams_employees'))
    AND COL_LENGTH(N'dbo.ams_employees', N'email') IS NOT NULL
    CREATE INDEX IX_ams_employees_email ON dbo.ams_employees(email);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_sim_cards_site' AND object_id = OBJECT_ID(N'dbo.ams_sim_cards'))
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'site') IS NOT NULL
    CREATE INDEX IX_ams_sim_cards_site ON dbo.ams_sim_cards(site);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_accessories_site' AND object_id = OBJECT_ID(N'dbo.ams_accessories'))
    AND COL_LENGTH(N'dbo.ams_accessories', N'site') IS NOT NULL
    CREATE INDEX IX_ams_accessories_site ON dbo.ams_accessories(site);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_asset_makes_asset_type' AND object_id = OBJECT_ID(N'dbo.ams_asset_makes'))
    AND COL_LENGTH(N'dbo.ams_asset_makes', N'asset_type') IS NOT NULL
    CREATE INDEX IX_ams_asset_makes_asset_type ON dbo.ams_asset_makes(asset_type);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_asset_types_category' AND object_id = OBJECT_ID(N'dbo.ams_asset_types'))
    AND COL_LENGTH(N'dbo.ams_asset_types', N'category') IS NOT NULL
    CREATE INDEX IX_ams_asset_types_category ON dbo.ams_asset_types(category);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_asset_categories_used_on' AND object_id = OBJECT_ID(N'dbo.ams_asset_categories'))
    AND COL_LENGTH(N'dbo.ams_asset_categories', N'used_on') IS NOT NULL
    CREATE INDEX IX_ams_asset_categories_used_on ON dbo.ams_asset_categories(used_on);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_assets_purchase_site' AND object_id = OBJECT_ID(N'dbo.ams_assets'))
    AND COL_LENGTH(N'dbo.ams_assets', N'purchase_site') IS NOT NULL
    CREATE INDEX IX_ams_assets_purchase_site ON dbo.ams_assets(purchase_site);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_mobiles_purchase_site' AND object_id = OBJECT_ID(N'dbo.ams_mobiles'))
    AND COL_LENGTH(N'dbo.ams_mobiles', N'purchase_site') IS NOT NULL
    CREATE INDEX IX_ams_mobiles_purchase_site ON dbo.ams_mobiles(purchase_site);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_consumable_log_consumable_id' AND object_id = OBJECT_ID(N'dbo.ams_consumable_log'))
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'consumable_id') IS NOT NULL
    CREATE INDEX IX_ams_consumable_log_consumable_id ON dbo.ams_consumable_log(consumable_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_spare_part_log_part_id' AND object_id = OBJECT_ID(N'dbo.ams_spare_part_log'))
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'part_id') IS NOT NULL
    CREATE INDEX IX_ams_spare_part_log_part_id ON dbo.ams_spare_part_log(part_id);
"""

SEED_USERS = [
    {
        "username": "operator.sys",
        "password": "Sr#Ops@2026",
        "role": "Supreme Root",
        "email": "operator.sys@ams.local",
        "remarks": "Portal account (looks like a low-level operator login, but holds Supreme Root rights).",
        "display_name": "Operator",
    },
    {
        "username": "testadmin",
        "password": "Admin@#$12345",
        "role": "Super Root",
        "email": "testadmin@ams.local",
        "remarks": "Super Root account for creating other users (cannot create Supreme Root).",
        "display_name": "Test Admin",
    },
]

SEED_LOOKUPS = {
    "simOperators": """[
        {"name":"Jio","helpline":"198","website":"https://www.jio.com","active":true},
        {"name":"Airtel","helpline":"198","website":"https://www.airtel.in","active":true},
        {"name":"Vodafone Idea","helpline":"199","website":"https://www.myvi.in","active":true},
        {"name":"BSNL","helpline":"1503","website":"https://www.bsnl.co.in","active":true},
        {"name":"MTNL","helpline":"1503","website":"https://www.mtnl.co.in","active":true}
    ]""",
    "simPlans": """[
        {"name":"Prepaid","planType":"Prepaid","description":"","active":true},
        {"name":"Postpaid","planType":"Postpaid","description":"","active":true},
        {"name":"Corporate Plan","planType":"Corporate","description":"","active":true}
    ]""",
    "consumableCategories": """[
        {"name":"Printer Supplies","description":"","active":true},
        {"name":"Cables","description":"","active":true},
        {"name":"Peripherals","description":"","active":true},
        {"name":"Stationery","description":"","active":true},
        {"name":"IT Accessories","description":"","active":true}
    ]""",
    "consumableUnits": """[
        {"name":"Nos","description":"Number of pieces","active":true},
        {"name":"Box","description":"","active":true},
        {"name":"Pack","description":"","active":true},
        {"name":"Ream","description":"","active":true},
        {"name":"Meter","description":"","active":true}
    ]""",
    "sparePartCategories": """[
        {"name":"Internal Component","description":"","active":true},
        {"name":"Toner / Ink","description":"","active":true},
        {"name":"Mechanical Part","description":"","active":true}
    ]""",
    "vendorCategories": """[
        {"name":"Assets","description":"Supplies assets / capital equipment","active":true},
        {"name":"Consumables","description":"Supplies consumable items","active":true},
        {"name":"Spare Parts","description":"Supplies spare / repair parts","active":true},
        {"name":"Services","description":"Provides services (AMC, repair, etc.)","active":true},
        {"name":"All","description":"General supplier - multiple categories","active":true}
    ]""",
}


# ---------------------------------------------------------------------------
# Collection registry (collection key -> table + typed column mapping)
# ---------------------------------------------------------------------------


class ColumnDef:
    __slots__ = ("sql", "json", "type", "compute")

    def __init__(self, sql, json, type="nvarchar", compute=None):
        self.sql = sql
        self.json = json
        self.type = type
        self.compute = compute


class TableDef:
    __slots__ = ("key", "table", "key_field", "fixed_key", "is_document", "columns")

    def __init__(self, key, table, key_field=None, fixed_key=None, is_document=False, columns=None):
        self.key = key
        self.table = table
        self.key_field = key_field
        self.fixed_key = fixed_key
        self.is_document = is_document
        self.columns = columns or []


def _full_name_compute(rec):
    """employees.full_name: prefer 'name', else join firstName/middleName/lastName."""
    name = rec.get("name")
    if isinstance(name, str) and name.strip():
        return name
    parts = [rec.get("firstName") or "", rec.get("middleName") or "", rec.get("lastName") or ""]
    full = " ".join(p for p in parts if isinstance(p, str) and p.strip())
    return full or None


def _build_table_defs():
    c = lambda sql, json=None, type="nvarchar", compute=None: ColumnDef(sql, json, type, compute)

    defs = [
        TableDef("assets", "ams_assets", key_field="id", columns=[
            c("asset_id", "id"), c("ams_asset_id", "amsAssetId"),
            c("display_id", "displayId"), c("name", "name"),
            c("status", "status"), c("asset_type", "type"),
            c("category", "category"), c("make", "make"),
            c("site", "site"), c("current_site", "currentSite"),
            c("purchase_site", "purchaseSite"),
            c("assigned_to", "assignedTo"),
            c("model", "model"), c("serial_number", "serialNumber"),
            c("vendor", "vendor"), c("purchase_date", "purchaseDate"),
            c("warranty_end", "warrantyEnd"), c("purchase_cost", "purchaseCost"),
        ]),
        TableDef("mobiles", "ams_mobiles", key_field="id", columns=[
            c("asset_id", "id"), c("ams_asset_id", "amsAssetId"),
            c("display_id", "displayId"), c("name", "name"),
            c("status", "status"), c("asset_type", "type"),
            c("category", "category"), c("make", "make"),
            c("site", "site"), c("current_site", "currentSite"),
            c("purchase_site", "purchaseSite"),
            c("assigned_to", "assignedTo"),
            c("model", "model"), c("serial_number", "serialNumber"),
            c("imei1", "imei1"), c("imei2", "imei2"),
            c("battery_no", "batteryNo"), c("charger_no", "chargerNo"),
            c("sim_mobile_no", "simMobileNo"), c("vendor", "vendor"),
            c("purchase_date", "purchaseDate"), c("warranty_end", "warrantyEnd"),
            c("purchase_cost", "purchaseCost"),
        ]),
        TableDef("employees", "ams_employees", key_field="amsId", columns=[
            c("ams_id", "amsId"), c("emp_id", "empId"),
            c("emp_id_company", "empIdCompany"),
            c("full_name", None, compute=_full_name_compute),
            c("department", "department"), c("designation", "designation"),
            c("site", "site"),
            c("status", "status"),
            c("contact", "contact"), c("email", "email"),
            c("manager_ams_id", "managerAmsId"),
        ]),
        TableDef("assetTypes", "ams_asset_types", key_field="name", columns=[
            c("name", "name"), c("shortform", "shortform"), c("category", "category"), c("active", "active", "bit"),
        ]),
        TableDef("assetMakes", "ams_asset_makes", key_field="makeCode", columns=[
            c("make_code", "makeCode"), c("name", "name"), c("asset_type", "assetType"), c("active", "active", "bit"),
        ]),
        TableDef("assetCategories", "ams_asset_categories", key_field="name", columns=[
            c("name", "name"), c("used_on", "usedOn"), c("active", "active", "bit"),
        ]),
        TableDef("sites", "ams_sites", key_field="name", columns=[
            c("name", "name"), c("shortform", "shortform"), c("address", "address"), c("active", "active", "bit"),
        ]),
        TableDef("departments", "ams_departments", key_field="name", columns=[
            c("name", "name"), c("shortform", "shortform"), c("active", "active", "bit"),
        ]),
        TableDef("designations", "ams_designations", key_field="name", columns=[
            c("name", "name"), c("active", "active", "bit"),
        ]),
        TableDef("accessories", "ams_accessories", key_field="accCode", columns=[
            c("acc_code", "accCode"), c("name", "name"), c("asset_type", "assetType"), c("site", "site"), c("active", "active", "bit"),
        ]),
        TableDef("vendors", "ams_vendors", key_field="name", columns=[
            c("vendor_id", "vendorId"), c("name", "name"), c("category", "category"), c("city", "city"),
            c("contact_person", "contactPerson"), c("phone", "phone"), c("email", "email"),
            c("gstin", "gstin"), c("remarks", "remarks"), c("active", "active", "bit"),
        ]),
        TableDef("simOperators", "ams_sim_operators", key_field="name", columns=[
            c("name", "name"), c("helpline", "helpline"), c("website", "website"), c("active", "active", "bit"),
        ]),
        TableDef("simPlans", "ams_sim_plans", key_field="name", columns=[
            c("name", "name"), c("plan_type", "planType"), c("description", "description"), c("active", "active", "bit"),
        ]),
        TableDef("consumableCategories", "ams_consumable_categories", key_field="name", columns=[
            c("name", "name"), c("description", "description"), c("active", "active", "bit"),
        ]),
        TableDef("consumableUnits", "ams_consumable_units", key_field="name", columns=[
            c("name", "name"), c("description", "description"), c("active", "active", "bit"),
        ]),
        TableDef("sparePartCategories", "ams_spare_part_categories", key_field="name", columns=[
            c("name", "name"), c("description", "description"), c("active", "active", "bit"),
        ]),
        TableDef("vendorCategories", "ams_vendor_categories", key_field="name", columns=[
            c("name", "name"), c("description", "description"), c("active", "active", "bit"),
        ]),
        TableDef("consumables", "ams_consumables", key_field="consumableId", columns=[
            c("consumable_id", "consumableId"), c("name", "name"),
            c("category", "category"), c("unit", "unit"), c("site", "site"),
            c("qty", "qty", "int"), c("reorder_level", "reorderLevel", "int"),
            c("restock_date", "restockDate"), c("warranty_date", "warrantyDate"),
            c("unit_cost", "unitCost"), c("vendor", "vendor"), c("remarks", "remarks"),
        ]),
        TableDef("consumableLog", "ams_consumable_log", key_field=None, columns=[
            c("log_date", "date"), c("consumable_id", "consumableId"),
            c("name", "name"), c("site", "site"), c("log_type", "type"),
            c("qty", "qty", "int"), c("by_whom", "by"), c("remarks", "remarks"),
        ]),
        TableDef("spareParts", "ams_spare_parts", key_field="partId", columns=[
            c("part_id", "partId"), c("name", "name"),
            c("category", "category"), c("asset_type", "assetType"),
            c("site", "site"), c("qty", "qty", "int"),
            c("reorder_level", "reorderLevel", "int"),
            c("restock_date", "restockDate"), c("warranty_date", "warrantyDate"),
            c("unit_cost", "unitCost"), c("vendor", "vendor"), c("remarks", "remarks"),
        ]),
        TableDef("sparePartLog", "ams_spare_part_log", key_field=None, columns=[
            c("log_date", "date"), c("part_id", "partId"),
            c("name", "name"), c("site", "site"), c("log_type", "type"),
            c("qty", "qty", "int"), c("by_whom", "by"), c("remarks", "remarks"),
            c("asset_base_id", "assetBaseId"), c("asset_id_snapshot", "assetIdSnapshot"),
        ]),
        TableDef("simCards", "ams_sim_cards", key_field="simId", columns=[
            c("sim_id", "simId"), c("mobile_number", "mobileNumber"),
            c("operator", "operator"), c("plan_name", "plan"),
            c("status", "status"), c("assigned_to", "assignedTo"),
            c("iccid", "iccid"), c("activation_date", "activationDate"),
            c("vendor", "vendor"), c("cost", "cost"),
            c("assigned_date", "assignedDate"), c("linked_mobile_id", "linkedMobileId"),
            c("personal_mobile", "personalMobile", "bit"), c("site", "site"),
            c("remarks", "remarks"),
        ]),
        TableDef("users", "ams_user_profiles", key_field="username", columns=[
            c("username", "username"), c("role", "role"), c("display_name", "displayName"),
            c("email", "email"), c("contact_no", "contactNo"), c("address", "address"),
            c("dob", "dob"), c("gender", "gender"), c("linked_employee", "linkedEmployee"),
            c("remarks", "remarks"), c("active", "active", "bit"),
        ]),
        TableDef("exitRecords", "ams_exit_records", key_field="exitId", columns=[
            c("exit_id", "exitId"), c("ams_id", "amsId"), c("emp_name", "empName"),
        ]),
        TableDef("company", "ams_company", fixed_key="company", is_document=True, columns=[
            c("name", "companyName"), c("address", "address"), c("slogan", "slogan"),
            c("hr_admin_contact", "hrAdminContact"), c("head_title", "headTitle"),
            c("head_contact", "headContact"),
        ]),
        TableDef("roleAccess", "ams_documents", fixed_key="roleAccess", is_document=True, columns=[]),
        TableDef("reportPrefs", "ams_documents", fixed_key="reportPrefs", is_document=True, columns=[]),
        TableDef("accessRights", "ams_documents", fixed_key="accessRights", is_document=True, columns=[]),
    ]
    return defs


TABLE_DEFS = _build_table_defs()
ALLOWED_KEYS = {d.key for d in TABLE_DEFS}
KEY_INDEX = {d.key: d for d in TABLE_DEFS}


class CollectionSaveError(Exception):
    def __init__(self, collection, key_field, key_value):
        super().__init__(f"Duplicate {key_field} '{key_value}' in collection '{collection}'.")


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


class AmsDb:
    def __init__(self, conn_string):
        self.conn_string = conn_string
        self.db_name = "AMS-TEST"
        self.master_conn_string = re.sub(r"(?i)DATABASE=[^;]*", "DATABASE=master", conn_string)

    # ---- connection helpers -------------------------------------------------
    def connect(self, conn_string=None):
        return pyodbc.connect(conn_string or self.conn_string)

    @staticmethod
    def scalar(conn, sql, params=None):
        cur = conn.cursor()
        cur.execute(sql, params or [])
        row = cur.fetchone()
        return row[0] if row else None

    @staticmethod
    def exec(conn, sql, params=None):
        cur = conn.cursor()
        cur.execute(sql, params or [])
        conn.commit()

    @staticmethod
    def execute(conn, sql, params=None):
        """Execute without committing (for callers that own the transaction)."""
        cur = conn.cursor()
        cur.execute(sql, params or [])

    # ---- init (mirrors InitializeAsync) -------------------------------------
    def initialize(self):
        self.ensure_database_exists()
        self.ensure_schema()
        self.ensure_seed_users()
        self.migrate_legacy_collections()
        self.ensure_seed_lookups()

    def ensure_database_exists(self):
        try:
            conn = pyodbc.connect(self.master_conn_string)
            try:
                self.exec(conn, f"IF DB_ID(?) IS NULL CREATE DATABASE [{self.db_name}];", [self.db_name])
            finally:
                conn.close()
        except pyodbc.Error:
            # Permission denied to create a database - the user should run
            # Setup-AMS-TEST.bat (sqlcmd) as administrator. The schema step
            # below still runs against the existing database.
            pass

    def ensure_schema(self):
        conn = pyodbc.connect(self.conn_string)
        try:
            self.exec(conn, SCHEMA_TABLES_SQL)
            self.exec(conn, SCHEMA_ALTERS_SQL)
            self.exec(conn, SCHEMA_INDEXES_SQL)
        finally:
            conn.close()

    def ensure_seed_users(self):
        conn = pyodbc.connect(self.conn_string)
        try:
            for seed in SEED_USERS:
                exists = self.scalar(
                    conn,
                    "SELECT COUNT(1) FROM dbo.ams_users WHERE username = ?",
                    [seed["username"]],
                ) or 0
                salt = crypto.new_salt()
                digest = crypto.hash_password(seed["password"], salt)
                if exists > 0:
                    self.exec(
                        conn,
                        "UPDATE dbo.ams_users SET password_hash = ?, password_salt = ?, role = ?, active = 1 WHERE username = ?",
                        [digest, salt, seed["role"], seed["username"]],
                    )
                else:
                    self.exec(
                        conn,
                        "INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name) "
                        "VALUES (?, ?, ?, ?, NULL, ?, ?, 1, ?);",
                        [seed["username"], digest, salt, seed["role"], seed["email"], seed["remarks"], seed["display_name"]],
                    )
        finally:
            conn.close()

    def migrate_legacy_collections(self):
        conn = pyodbc.connect(self.conn_string)
        try:
            legacy_exists = (
                self.scalar(conn, "SELECT COUNT(1) FROM sys.tables WHERE name = 'ams_collections'") or 0
            ) > 0
            if not legacy_exists:
                return
            for d in TABLE_DEFS:
                count = self.scalar(conn, f"SELECT COUNT(1) FROM dbo.{d.table}") or 0
                if count > 0:
                    continue
                legacy = self.scalar(
                    conn,
                    "SELECT data_json FROM dbo.ams_collections WHERE collection_key = ?",
                    [d.key],
                )
                if not legacy:
                    continue
                try:
                    root = json.loads(legacy)
                    if d.is_document and not isinstance(root, dict):
                        continue
                    if not d.is_document and not isinstance(root, list):
                        continue
                    self.save_collection(d.key, legacy)
                except (ValueError, json.JSONDecodeError):
                    continue
        finally:
            conn.close()

    def ensure_seed_lookups(self):
        conn = pyodbc.connect(self.conn_string)
        try:
            for key, data in SEED_LOOKUPS.items():
                d = KEY_INDEX.get(key)
                if d is None:
                    continue
                count = self.scalar(conn, f"SELECT COUNT(1) FROM dbo.{d.table}") or 0
                if count > 0:
                    continue
                self.save_collection(key, data)
        finally:
            conn.close()

    # ---- collections ---------------------------------------------------------
    def get_collection(self, key):
        d = KEY_INDEX.get(key)
        if d is None:
            return None
        conn = pyodbc.connect(self.conn_string)
        try:
            if d.is_document:
                result = self.scalar(
                    conn,
                    f"SELECT data_json FROM dbo.{d.table} WHERE record_key = ?",
                    [d.fixed_key],
                )
                return result
            jsons = []
            cur = conn.cursor()
            cur.execute(f"SELECT data_json FROM dbo.{d.table} ORDER BY row_id")
            for row in cur.fetchall():
                jsons.append(row[0])
            if not jsons:
                return "[]"
            return "[" + ",".join(jsons) + "]"
        finally:
            conn.close()

    def save_collection(self, key, data_json):
        d = KEY_INDEX.get(key)
        if d is None:
            return
        conn = pyodbc.connect(self.conn_string)
        try:
            if d.is_document:
                self.execute(conn, f"DELETE FROM dbo.{d.table} WHERE record_key = ?", [d.fixed_key])
                doc = json.loads(data_json)
                if isinstance(doc, dict):
                    self._insert_row(conn, d, d.fixed_key, doc)
                conn.commit()
            else:
                self.execute(conn, f"DELETE FROM dbo.{d.table}")
                doc = json.loads(data_json)
                if isinstance(doc, list):
                    seen = set()
                    for rec in doc:
                        if not isinstance(rec, dict):
                            continue
                        record_key = self._resolve_record_key(rec, d)
                        if d.key_field and record_key.lower() in seen:
                            raise CollectionSaveError(key, d.key_field, record_key)
                        seen.add(record_key.lower())
                        self._insert_row(conn, d, record_key, rec)
                conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    @staticmethod
    def _resolve_record_key(rec, d):
        if d.key_field and isinstance(rec.get(d.key_field), str):
            v = rec[d.key_field]
            if v and v.strip():
                return v
        return uuid.uuid4().hex

    @staticmethod
    def _column_value(rec, col):
        if col.compute is not None:
            return col.compute(rec)
        if not col.json:
            return None
        if col.json not in rec or rec[col.json] is None:
            return None
        value = rec[col.json]
        if col.type == "int":
            return int(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None
        if col.type == "bit":
            return bool(value) if isinstance(value, bool) else (value is True or value == "true")
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        return value if isinstance(value, str) else None

    def _insert_row(self, conn, d, record_key, rec):
        cols = ["record_key"]
        vals = [record_key]
        for col in d.columns:
            value = self._column_value(rec, col)
            cols.append(col.sql)
            vals.append(value)
        cols.append("data_json")
        vals.append(json.dumps(rec, ensure_ascii=False))
        placeholders = ", ".join("?" * len(vals))
        self.execute(
            conn,
            f"INSERT INTO dbo.{d.table} ({', '.join(cols)}) VALUES ({placeholders});",
            vals,
        )

    # ---- users / login -------------------------------------------------------
    _USER_COLUMNS = (
        "username, password_hash, password_salt, role, linked_employee, email, remarks, active, "
        "display_name, contact_no, address, dob, gender"
    )

    def _row_to_user(self, row):
        return {
            "username": row[0],
            "password_hash": row[1],
            "password_salt": row[2],
            "role": row[3],
            "linked_employee": row[4],
            "email": row[5],
            "remarks": row[6],
            "active": bool(row[7]),
            "display_name": row[8],
            "contact_no": row[9],
            "address": row[10],
            "dob": row[11],
            "gender": row[12],
        }

    def find_user(self, username):
        conn = pyodbc.connect(self.conn_string)
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT {self._USER_COLUMNS} FROM dbo.ams_users WHERE username = ?;", [username])
            row = cur.fetchone()
            return self._row_to_user(row) if row else None
        finally:
            conn.close()

    def list_users(self):
        conn = pyodbc.connect(self.conn_string)
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT {self._USER_COLUMNS} FROM dbo.ams_users ORDER BY username;")
            return [self._row_to_user(row) for row in cur.fetchall()]
        finally:
            conn.close()

    def verify_password(self, user, password):
        return crypto.verify_password(password, user["password_salt"], user["password_hash"])

    def create_user(self, username, password, role, linked_employee, email, remarks, active):
        salt = crypto.new_salt()
        digest = crypto.hash_password(password, salt)
        conn = pyodbc.connect(self.conn_string)
        try:
            self.exec(
                conn,
                "INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);",
                [username, digest, salt, role, linked_employee, email, remarks, bool(active), linked_employee],
            )
        finally:
            conn.close()

    def update_user(self, username, new_password, role, linked_employee, email, remarks, active,
                    display_name, contact_no, address, dob, gender):
        sets = [
            "role = ISNULL(?, role)",
            "linked_employee = ISNULL(?, linked_employee)",
            "email = ?",
            "remarks = ?",
            "active = ISNULL(?, active)",
            "display_name = ?",
            "contact_no = ?",
            "address = ?",
            "dob = ?",
            "gender = ?",
        ]
        params = [role, linked_employee, email, remarks, active,
                  display_name, contact_no, address, dob, gender]
        if new_password:
            salt = crypto.new_salt()
            digest = crypto.hash_password(new_password, salt)
            sets.append("password_hash = ?")
            sets.append("password_salt = ?")
            params.extend([digest, salt])
        params.append(username)
        conn = pyodbc.connect(self.conn_string)
        try:
            self.exec(
                conn,
                f"UPDATE dbo.ams_users SET {', '.join(sets)} WHERE username = ?;",
                params,
            )
        finally:
            conn.close()

    def delete_user(self, username):
        conn = pyodbc.connect(self.conn_string)
        try:
            self.exec(conn, "DELETE FROM dbo.ams_users WHERE username = ?;", [username])
        finally:
            conn.close()


def get_db():
    from django.conf import settings
    return AmsDb(settings.DATABASES["default"]["OPTIONS"]["conn_string"])
