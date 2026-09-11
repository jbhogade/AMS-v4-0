/* =============================================================================
   AMS-TEST DATABASE SCRIPT  (relational schema)
   -----------------------------------------------------------------------------
   Creates the AMS-TEST database and the full relational schema used by the
   Asset Management System test portal.

   DESIGN NOTES (v2 - per-entity tables)
   -----------------------------------------------------------------------------
   Previous versions stored every business entity as a JSON document in a single
   dbo.ams_collections table (one row per collection: "assets", "employees",
   "simCards", ...). This version replaces that single collector table with one
   table per entity, so data is queryable, indexable and joinable with real SQL.

   Each table follows the same shape:
     - row_id      : identity column that preserves the order in which records
                     are saved (the frontend stores its in-memory arrays in
                     display order and replaces them wholesale).
     - record_key  : the record's natural key from the application
                     (asset id, employee AMS id, sim id, vendor name, ...).
     - typed columns: the key business fields promoted to real columns so the
                     data can be reported on / queried directly.
     - data_json   : the full JSON record (the frontend reads/writes the whole
                     record object; the typed columns mirror the important
                     fields for querying while data_json preserves everything).
     - updated_at  : last-write timestamp.

   Login accounts are fully relational in dbo.ams_users (security critical,
   PBKDF2-SHA256 hashed passwords + JWT sessions).

   The old dbo.ams_collections table is deliberately NOT dropped - existing
   databases keep their legacy rows untouched, and the API migrates them into
   the new per-entity tables on first run (see AmsDb.MigrateLegacyCollections).

   IDEMPOTENT: safe to run more than once (IF NOT EXISTS guards everywhere).

   HOW TO RUN ON WINDOWS
   -----------------------------------------------------------------------------
   Option 1 (recommended): double-click database\Setup-AMS-TEST.bat
   Option 2 (manual, in SQL Server Management Studio):
       1. Open SSMS -> Connect to your SQL Server instance.
       2. Open this file (AMS-TEST.sql).
       3. Press F5 / Execute. (If AMS-TEST does not exist yet it is created.)

   NOTE: The API (server\AMS.API) ALSO auto-creates the database, schema and
   seed data on first run, so this script is optional - it exists for manual
   preparation and as documentation of the schema.
   =============================================================================*/

/* ---- 1. Create the database (if missing) ----------------------------------- */
IF DB_ID(N'AMS-TEST') IS NULL
BEGIN
    CREATE DATABASE [AMS-TEST];
END
GO

IF DB_ID(N'AMS-TEST') IS NULL
BEGIN
    RAISERROR(N'AMS-TEST database could not be created. Either create it manually in SSMS (CREATE DATABASE [AMS-TEST]) or grant the current login the CREATE DATABASE permission, then re-run this script.', 16, 1);
END
GO

USE [AMS-TEST];
GO

/* =============================================================================
   2) USERS  (relational - login is security critical)
   =========================================================================== */
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
END
GO

/* User Master mirror (the page's own copy without password fields - keeps the
   generic CRUD engine working while dbo.ams_users stays authoritative). */
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_user_profiles (
        row_id       BIGINT IDENTITY(1,1) NOT NULL,
        record_key   NVARCHAR(100) NOT NULL,
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
END
GO

/* =============================================================================
   3) LOOKUP MASTERS  (managed via System Administrator hub)
   =========================================================================== */

/* ---- Asset Type Master (name + shortform used in Smart Asset IDs) ---------- */
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
END
GO

/* ---- Asset Make Master ------------------------------------------------------ */
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
END
GO

/* ---- Asset Category Master -------------------------------------------------- */
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
END
GO

/* ---- Site Master (name + shortform site code) ------------------------------- */
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
END
GO

/* ---- Department Master (name + shortform used in Employee IDs) -------------- */
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
END
GO

/* ---- Designation Master ----------------------------------------------------- */
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
END
GO

/* ---- Accessory Master (linked to an Asset Type) ----------------------------- */
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
END
GO

/* ---- Vendor Master ---------------------------------------------------------- */
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
END
GO

/* ---- SIM Operator Master (telecom operators on SIM Card records) ------------ */
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
END
GO

/* ---- SIM Plan Master -------------------------------------------------------- */
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
END
GO

/* ---- Consumable Category Master --------------------------------------------- */
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
END
GO

/* ---- Unit of Measure Master (consumable units) ------------------------------ */
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
END
GO

/* ---- Spare Part Category Master --------------------------------------------- */
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
END
GO

/* ---- Vendor Category Master ------------------------------------------------- */
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
END
GO

/* =============================================================================
   4) BUSINESS ENTITIES  (one table per entity)
   =========================================================================== */

/* ---- Assets ----------------------------------------------------------------- */
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
END
GO

/* Indexes for a table that may already exist from an older script version:
   each statement is independently guarded so it never errors, whether the
   table/column/index is missing or already present. */
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'status') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_assets_status' AND object_id = OBJECT_ID(N'dbo.ams_assets'))
    CREATE INDEX IX_ams_assets_status ON dbo.ams_assets(status);
GO
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'asset_type') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_assets_type' AND object_id = OBJECT_ID(N'dbo.ams_assets'))
    CREATE INDEX IX_ams_assets_type ON dbo.ams_assets(asset_type);
GO
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'current_site') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_assets_site' AND object_id = OBJECT_ID(N'dbo.ams_assets'))
    CREATE INDEX IX_ams_assets_site ON dbo.ams_assets(current_site);
GO

/* ---- Mobiles ---------------------------------------------------------------- */
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
END
GO

IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'status') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_mobiles_status' AND object_id = OBJECT_ID(N'dbo.ams_mobiles'))
    CREATE INDEX IX_ams_mobiles_status ON dbo.ams_mobiles(status);
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'asset_type') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_mobiles_type' AND object_id = OBJECT_ID(N'dbo.ams_mobiles'))
    CREATE INDEX IX_ams_mobiles_type ON dbo.ams_mobiles(asset_type);
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'current_site') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_mobiles_site' AND object_id = OBJECT_ID(N'dbo.ams_mobiles'))
    CREATE INDEX IX_ams_mobiles_site ON dbo.ams_mobiles(current_site);
GO

/* ---- Employees -------------------------------------------------------------- */
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
        updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_employees PRIMARY KEY (record_key)
    );
END
GO

IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'department') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_employees_department' AND object_id = OBJECT_ID(N'dbo.ams_employees'))
    CREATE INDEX IX_ams_employees_department ON dbo.ams_employees(department);
GO
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'status') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_employees_status' AND object_id = OBJECT_ID(N'dbo.ams_employees'))
    CREATE INDEX IX_ams_employees_status ON dbo.ams_employees(status);
GO
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'site') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_employees_site' AND object_id = OBJECT_ID(N'dbo.ams_employees'))
    CREATE INDEX IX_ams_employees_site ON dbo.ams_employees(site);
GO

/* ---- Consumables (stock per site) -------------------------------------------- */
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
END
GO

IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumables', N'site') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_consumables_site' AND object_id = OBJECT_ID(N'dbo.ams_consumables'))
    CREATE INDEX IX_ams_consumables_site ON dbo.ams_consumables(site);
GO

/* ---- Consumable movement log (restock / used) ------------------------------- */
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
END
GO

/* ---- Spare Parts (stock per site) -------------------------------------------- */
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
END
GO

IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_parts', N'site') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_spare_parts_site' AND object_id = OBJECT_ID(N'dbo.ams_spare_parts'))
    CREATE INDEX IX_ams_spare_parts_site ON dbo.ams_spare_parts(site);
GO

/* ---- Spare Part movement log (restock / used) ------------------------------- */
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
END
GO

/* ---- SIM Cards --------------------------------------------------------------- */
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
END
GO

IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'operator') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_sim_cards_operator' AND object_id = OBJECT_ID(N'dbo.ams_sim_cards'))
    CREATE INDEX IX_ams_sim_cards_operator ON dbo.ams_sim_cards(operator);
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'status') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_sim_cards_status' AND object_id = OBJECT_ID(N'dbo.ams_sim_cards'))
    CREATE INDEX IX_ams_sim_cards_status ON dbo.ams_sim_cards(status);
GO

/* Upgrade tables created by an earlier script version. `plan` is a reserved
   keyword, so the SIM card column is now `plan_name`; some older tables may
   also be missing the `status`/`current_site` typed columns that the indexes
   above reference. All statements are idempotent. */
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_assets', N'status') IS NULL
   ALTER TABLE dbo.ams_assets ADD status NVARCHAR(100) NULL;
GO

IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_assets', N'current_site') IS NULL
   ALTER TABLE dbo.ams_assets ADD current_site NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_assets', N'model') IS NULL
   ALTER TABLE dbo.ams_assets ADD model NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_assets', N'serial_number') IS NULL
   ALTER TABLE dbo.ams_assets ADD serial_number NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_assets', N'vendor') IS NULL
   ALTER TABLE dbo.ams_assets ADD vendor NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_assets', N'purchase_date') IS NULL
   ALTER TABLE dbo.ams_assets ADD purchase_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_assets', N'warranty_end') IS NULL
   ALTER TABLE dbo.ams_assets ADD warranty_end NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_assets', N'purchase_cost') IS NULL
   ALTER TABLE dbo.ams_assets ADD purchase_cost NVARCHAR(50) NULL;
GO

IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'model') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD model NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'serial_number') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD serial_number NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'imei1') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD imei1 NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'imei2') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD imei2 NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'battery_no') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD battery_no NVARCHAR(100) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'charger_no') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD charger_no NVARCHAR(100) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'sim_mobile_no') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD sim_mobile_no NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'vendor') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD vendor NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'purchase_date') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD purchase_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'warranty_end') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD warranty_end NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'purchase_cost') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD purchase_cost NVARCHAR(50) NULL;
GO

IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_vendors', N'contact_person') IS NULL
   ALTER TABLE dbo.ams_vendors ADD contact_person NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_vendors', N'phone') IS NULL
   ALTER TABLE dbo.ams_vendors ADD phone NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_vendors', N'email') IS NULL
   ALTER TABLE dbo.ams_vendors ADD email NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_vendors', N'gstin') IS NULL
   ALTER TABLE dbo.ams_vendors ADD gstin NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_vendors', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_vendors', N'remarks') IS NULL
   ALTER TABLE dbo.ams_vendors ADD remarks NVARCHAR(500) NULL;
GO

IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_employees', N'status') IS NULL
   ALTER TABLE dbo.ams_employees ADD status NVARCHAR(50) NULL;
GO

IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_employees', N'site') IS NULL
   ALTER TABLE dbo.ams_employees ADD site NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_employees', N'contact') IS NULL
   ALTER TABLE dbo.ams_employees ADD contact NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_employees', N'email') IS NULL
   ALTER TABLE dbo.ams_employees ADD email NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_employees', N'manager_ams_id') IS NULL
   ALTER TABLE dbo.ams_employees ADD manager_ams_id NVARCHAR(200) NULL;
GO

IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'status') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD status NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'iccid') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD iccid NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'activation_date') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD activation_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'vendor') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD vendor NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'cost') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD cost NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'assigned_date') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD assigned_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'linked_mobile_id') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD linked_mobile_id NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'personal_mobile') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD personal_mobile BIT NULL;
GO

IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'plan_name') IS NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'plan') IS NULL
BEGIN
    ALTER TABLE dbo.ams_sim_cards ADD plan_name NVARCHAR(200) NULL;
END
GO

IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'plan_name') IS NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'plan') IS NOT NULL
BEGIN
    EXEC sp_rename N'dbo.ams_sim_cards.plan', N'plan_name', 'COLUMN';
END
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'site') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD site NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_accessories', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_accessories', N'site') IS NULL
   ALTER TABLE dbo.ams_accessories ADD site NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_asset_makes', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_asset_makes', N'make_code') IS NULL
   ALTER TABLE dbo.ams_asset_makes ADD make_code NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_asset_makes', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_asset_makes', N'asset_type') IS NULL
   ALTER TABLE dbo.ams_asset_makes ADD asset_type NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_asset_types', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_asset_types', N'category') IS NULL
   ALTER TABLE dbo.ams_asset_types ADD category NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_asset_categories', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_asset_categories', N'used_on') IS NULL
   ALTER TABLE dbo.ams_asset_categories ADD used_on NVARCHAR(50) NULL;
GO

IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_assets', N'purchase_site') IS NULL
   ALTER TABLE dbo.ams_assets ADD purchase_site NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_mobiles', N'purchase_site') IS NULL
   ALTER TABLE dbo.ams_mobiles ADD purchase_site NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_employees', N'emp_id_company') IS NULL
   ALTER TABLE dbo.ams_employees ADD emp_id_company NVARCHAR(100) NULL;
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_sim_cards', N'remarks') IS NULL
   ALTER TABLE dbo.ams_sim_cards ADD remarks NVARCHAR(500) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumables', N'restock_date') IS NULL
   ALTER TABLE dbo.ams_consumables ADD restock_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumables', N'warranty_date') IS NULL
   ALTER TABLE dbo.ams_consumables ADD warranty_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumables', N'unit_cost') IS NULL
   ALTER TABLE dbo.ams_consumables ADD unit_cost NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumables', N'vendor') IS NULL
   ALTER TABLE dbo.ams_consumables ADD vendor NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumables', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumables', N'remarks') IS NULL
   ALTER TABLE dbo.ams_consumables ADD remarks NVARCHAR(500) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_parts', N'restock_date') IS NULL
   ALTER TABLE dbo.ams_spare_parts ADD restock_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_parts', N'warranty_date') IS NULL
   ALTER TABLE dbo.ams_spare_parts ADD warranty_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_parts', N'unit_cost') IS NULL
   ALTER TABLE dbo.ams_spare_parts ADD unit_cost NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_parts', N'vendor') IS NULL
   ALTER TABLE dbo.ams_spare_parts ADD vendor NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_parts', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_parts', N'remarks') IS NULL
   ALTER TABLE dbo.ams_spare_parts ADD remarks NVARCHAR(500) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumable_log', N'log_date') IS NULL
   ALTER TABLE dbo.ams_consumable_log ADD log_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumable_log', N'consumable_id') IS NULL
   ALTER TABLE dbo.ams_consumable_log ADD consumable_id NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumable_log', N'name') IS NULL
   ALTER TABLE dbo.ams_consumable_log ADD name NVARCHAR(300) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumable_log', N'site') IS NULL
   ALTER TABLE dbo.ams_consumable_log ADD site NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumable_log', N'log_type') IS NULL
   ALTER TABLE dbo.ams_consumable_log ADD log_type NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumable_log', N'qty') IS NULL
   ALTER TABLE dbo.ams_consumable_log ADD qty INT NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumable_log', N'by_whom') IS NULL
   ALTER TABLE dbo.ams_consumable_log ADD by_whom NVARCHAR(300) NULL;
GO
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_consumable_log', N'remarks') IS NULL
   ALTER TABLE dbo.ams_consumable_log ADD remarks NVARCHAR(500) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'log_date') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD log_date NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'part_id') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD part_id NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'name') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD name NVARCHAR(300) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'site') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD site NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'log_type') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD log_type NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'qty') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD qty INT NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'by_whom') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD by_whom NVARCHAR(300) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'remarks') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD remarks NVARCHAR(500) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'asset_base_id') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD asset_base_id NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_spare_part_log', N'asset_id_snapshot') IS NULL
   ALTER TABLE dbo.ams_spare_part_log ADD asset_id_snapshot NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_company', N'address') IS NULL
   ALTER TABLE dbo.ams_company ADD address NVARCHAR(500) NULL;
GO
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_company', N'slogan') IS NULL
   ALTER TABLE dbo.ams_company ADD slogan NVARCHAR(300) NULL;
GO
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_company', N'hr_admin_contact') IS NULL
   ALTER TABLE dbo.ams_company ADD hr_admin_contact NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_company', N'head_title') IS NULL
   ALTER TABLE dbo.ams_company ADD head_title NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_company', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_company', N'head_contact') IS NULL
   ALTER TABLE dbo.ams_company ADD head_contact NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_user_profiles', N'linked_employee') IS NULL
   ALTER TABLE dbo.ams_user_profiles ADD linked_employee NVARCHAR(100) NULL;
GO
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_user_profiles', N'remarks') IS NULL
   ALTER TABLE dbo.ams_user_profiles ADD remarks NVARCHAR(500) NULL;
GO

/* Indexes on columns that older databases only get via the ALTER block above.
   Create them here so a single script run on an existing DB both adds the
   columns and indexes them (CREATE INDEX is skipped if the column is still
   missing). Fresh databases already have the columns from CREATE TABLE. */
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'linked_mobile_id') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_sim_cards_linked_mobile' AND object_id = OBJECT_ID(N'dbo.ams_sim_cards'))
    CREATE INDEX IX_ams_sim_cards_linked_mobile ON dbo.ams_sim_cards(linked_mobile_id);
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'imei1') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_mobiles_imei1' AND object_id = OBJECT_ID(N'dbo.ams_mobiles'))
    CREATE INDEX IX_ams_mobiles_imei1 ON dbo.ams_mobiles(imei1);
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'sim_mobile_no') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_mobiles_sim_mobile_no' AND object_id = OBJECT_ID(N'dbo.ams_mobiles'))
    CREATE INDEX IX_ams_mobiles_sim_mobile_no ON dbo.ams_mobiles(sim_mobile_no);
GO
IF OBJECT_ID(N'dbo.ams_employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_employees', N'email') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_employees_email' AND object_id = OBJECT_ID(N'dbo.ams_employees'))
    CREATE INDEX IX_ams_employees_email ON dbo.ams_employees(email);
GO
IF OBJECT_ID(N'dbo.ams_sim_cards', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_sim_cards', N'site') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_sim_cards_site' AND object_id = OBJECT_ID(N'dbo.ams_sim_cards'))
    CREATE INDEX IX_ams_sim_cards_site ON dbo.ams_sim_cards(site);
GO
IF OBJECT_ID(N'dbo.ams_accessories', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_accessories', N'site') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_accessories_site' AND object_id = OBJECT_ID(N'dbo.ams_accessories'))
    CREATE INDEX IX_ams_accessories_site ON dbo.ams_accessories(site);
GO
IF OBJECT_ID(N'dbo.ams_asset_makes', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_asset_makes', N'asset_type') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_asset_makes_asset_type' AND object_id = OBJECT_ID(N'dbo.ams_asset_makes'))
    CREATE INDEX IX_ams_asset_makes_asset_type ON dbo.ams_asset_makes(asset_type);
GO
IF OBJECT_ID(N'dbo.ams_asset_types', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_asset_types', N'category') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_asset_types_category' AND object_id = OBJECT_ID(N'dbo.ams_asset_types'))
    CREATE INDEX IX_ams_asset_types_category ON dbo.ams_asset_types(category);
GO
IF OBJECT_ID(N'dbo.ams_asset_categories', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_asset_categories', N'used_on') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_asset_categories_used_on' AND object_id = OBJECT_ID(N'dbo.ams_asset_categories'))
    CREATE INDEX IX_ams_asset_categories_used_on ON dbo.ams_asset_categories(used_on);
GO
IF OBJECT_ID(N'dbo.ams_assets', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_assets', N'purchase_site') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_assets_purchase_site' AND object_id = OBJECT_ID(N'dbo.ams_assets'))
    CREATE INDEX IX_ams_assets_purchase_site ON dbo.ams_assets(purchase_site);
GO
IF OBJECT_ID(N'dbo.ams_mobiles', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_mobiles', N'purchase_site') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_mobiles_purchase_site' AND object_id = OBJECT_ID(N'dbo.ams_mobiles'))
    CREATE INDEX IX_ams_mobiles_purchase_site ON dbo.ams_mobiles(purchase_site);
GO
IF OBJECT_ID(N'dbo.ams_consumable_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_consumable_log', N'consumable_id') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_consumable_log_consumable_id' AND object_id = OBJECT_ID(N'dbo.ams_consumable_log'))
    CREATE INDEX IX_ams_consumable_log_consumable_id ON dbo.ams_consumable_log(consumable_id);
GO
IF OBJECT_ID(N'dbo.ams_spare_part_log', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.ams_spare_part_log', N'part_id') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ams_spare_part_log_part_id' AND object_id = OBJECT_ID(N'dbo.ams_spare_part_log'))
    CREATE INDEX IX_ams_spare_part_log_part_id ON dbo.ams_spare_part_log(part_id);
GO

/* Profile columns for dbo.ams_users. Databases created by an older script
   version lack display_name / contact_no / address / dob / gender, which makes
   the My Profile page (GET+PUT /api/auth/me) throw "API error 500". Each ALTER
   is idempotent and safe on a fresh or existing database. */
IF OBJECT_ID(N'dbo.ams_users', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_users', N'display_name') IS NULL
   ALTER TABLE dbo.ams_users ADD display_name NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_users', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_users', N'contact_no') IS NULL
   ALTER TABLE dbo.ams_users ADD contact_no NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_users', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_users', N'address') IS NULL
   ALTER TABLE dbo.ams_users ADD address NVARCHAR(500) NULL;
GO
IF OBJECT_ID(N'dbo.ams_users', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_users', N'dob') IS NULL
   ALTER TABLE dbo.ams_users ADD dob NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_users', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_users', N'gender') IS NULL
   ALTER TABLE dbo.ams_users ADD gender NVARCHAR(20) NULL;
GO

/* Profile columns for the dbo.ams_user_profiles mirror too, so the User Master
   copy exposes the same profile fields as dbo.ams_users. Idempotent + safe on
   a fresh or existing database. */
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_user_profiles', N'email') IS NULL
   ALTER TABLE dbo.ams_user_profiles ADD email NVARCHAR(200) NULL;
GO
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_user_profiles', N'contact_no') IS NULL
   ALTER TABLE dbo.ams_user_profiles ADD contact_no NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_user_profiles', N'address') IS NULL
   ALTER TABLE dbo.ams_user_profiles ADD address NVARCHAR(500) NULL;
GO
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_user_profiles', N'dob') IS NULL
   ALTER TABLE dbo.ams_user_profiles ADD dob NVARCHAR(20) NULL;
GO
IF OBJECT_ID(N'dbo.ams_user_profiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ams_user_profiles', N'gender') IS NULL
   ALTER TABLE dbo.ams_user_profiles ADD gender NVARCHAR(20) NULL;
GO

/* ---- Exit Records (handover snapshots) --------------------------------------- */
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
END
GO

/* =============================================================================
   5) DOCUMENT-STYLE COLLECTIONS  (single-record settings)
   =========================================================================== */

/* ---- Company Master (single-record form) ------------------------------------- */
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
END
GO

/* ---- Role Access defaults + Report header preferences ------------------------ */
IF OBJECT_ID(N'dbo.ams_documents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ams_documents (
        row_id     BIGINT IDENTITY(1,1) NOT NULL,
        record_key NVARCHAR(100) NOT NULL,
        data_json  NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ams_documents PRIMARY KEY (record_key)
    );
END
GO

/* =============================================================================
   6) SEED DATA  (lookup masters only - business entities start empty)
   -----------------------------------------------------------------------------
   These lookups were historically hardcoded in the frontend (and therefore
   could not be extended). They are seeded here so they appear immediately, and
   are now fully manageable from the System Administrator hub. Each insert is
   guarded so re-running the script never duplicates rows.
   =========================================================================== */

/* ---- SIM Operators ----------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.ams_sim_operators WHERE record_key = N'Jio')
    INSERT INTO dbo.ams_sim_operators (record_key, name, helpline, website, active, data_json)
    VALUES (N'Jio', N'Jio', N'198', N'https://www.jio.com', 1, N'{"name":"Jio","helpline":"198","website":"https://www.jio.com","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_sim_operators WHERE record_key = N'Airtel')
    INSERT INTO dbo.ams_sim_operators (record_key, name, helpline, website, active, data_json)
    VALUES (N'Airtel', N'Airtel', N'198', N'https://www.airtel.in', 1, N'{"name":"Airtel","helpline":"198","website":"https://www.airtel.in","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_sim_operators WHERE record_key = N'Vodafone Idea')
    INSERT INTO dbo.ams_sim_operators (record_key, name, helpline, website, active, data_json)
    VALUES (N'Vodafone Idea', N'Vodafone Idea', N'199', N'https://www.myvi.in', 1, N'{"name":"Vodafone Idea","helpline":"199","website":"https://www.myvi.in","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_sim_operators WHERE record_key = N'BSNL')
    INSERT INTO dbo.ams_sim_operators (record_key, name, helpline, website, active, data_json)
    VALUES (N'BSNL', N'BSNL', N'1503', N'https://www.bsnl.co.in', 1, N'{"name":"BSNL","helpline":"1503","website":"https://www.bsnl.co.in","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_sim_operators WHERE record_key = N'MTNL')
    INSERT INTO dbo.ams_sim_operators (record_key, name, helpline, website, active, data_json)
    VALUES (N'MTNL', N'MTNL', N'1503', N'https://www.mtnl.co.in', 1, N'{"name":"MTNL","helpline":"1503","website":"https://www.mtnl.co.in","active":true}');
GO

/* ---- SIM Plans --------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.ams_sim_plans WHERE record_key = N'Prepaid')
    INSERT INTO dbo.ams_sim_plans (record_key, name, plan_type, description, active, data_json)
    VALUES (N'Prepaid', N'Prepaid', N'Prepaid', N'', 1, N'{"name":"Prepaid","planType":"Prepaid","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_sim_plans WHERE record_key = N'Postpaid')
    INSERT INTO dbo.ams_sim_plans (record_key, name, plan_type, description, active, data_json)
    VALUES (N'Postpaid', N'Postpaid', N'Postpaid', N'', 1, N'{"name":"Postpaid","planType":"Postpaid","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_sim_plans WHERE record_key = N'Corporate Plan')
    INSERT INTO dbo.ams_sim_plans (record_key, name, plan_type, description, active, data_json)
    VALUES (N'Corporate Plan', N'Corporate Plan', N'Corporate', N'', 1, N'{"name":"Corporate Plan","planType":"Corporate","description":"","active":true}');
GO

/* ---- Consumable Categories ---------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_categories WHERE record_key = N'Printer Supplies')
    INSERT INTO dbo.ams_consumable_categories (record_key, name, description, active, data_json)
    VALUES (N'Printer Supplies', N'Printer Supplies', N'', 1, N'{"name":"Printer Supplies","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_categories WHERE record_key = N'Cables')
    INSERT INTO dbo.ams_consumable_categories (record_key, name, description, active, data_json)
    VALUES (N'Cables', N'Cables', N'', 1, N'{"name":"Cables","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_categories WHERE record_key = N'Peripherals')
    INSERT INTO dbo.ams_consumable_categories (record_key, name, description, active, data_json)
    VALUES (N'Peripherals', N'Peripherals', N'', 1, N'{"name":"Peripherals","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_categories WHERE record_key = N'Stationery')
    INSERT INTO dbo.ams_consumable_categories (record_key, name, description, active, data_json)
    VALUES (N'Stationery', N'Stationery', N'', 1, N'{"name":"Stationery","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_categories WHERE record_key = N'IT Accessories')
    INSERT INTO dbo.ams_consumable_categories (record_key, name, description, active, data_json)
    VALUES (N'IT Accessories', N'IT Accessories', N'', 1, N'{"name":"IT Accessories","description":"","active":true}');
GO

/* ---- Units of Measure ---------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_units WHERE record_key = N'Nos')
    INSERT INTO dbo.ams_consumable_units (record_key, name, description, active, data_json)
    VALUES (N'Nos', N'Nos', N'Number of pieces', 1, N'{"name":"Nos","description":"Number of pieces","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_units WHERE record_key = N'Box')
    INSERT INTO dbo.ams_consumable_units (record_key, name, description, active, data_json)
    VALUES (N'Box', N'Box', N'', 1, N'{"name":"Box","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_units WHERE record_key = N'Pack')
    INSERT INTO dbo.ams_consumable_units (record_key, name, description, active, data_json)
    VALUES (N'Pack', N'Pack', N'', 1, N'{"name":"Pack","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_units WHERE record_key = N'Ream')
    INSERT INTO dbo.ams_consumable_units (record_key, name, description, active, data_json)
    VALUES (N'Ream', N'Ream', N'', 1, N'{"name":"Ream","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_consumable_units WHERE record_key = N'Meter')
    INSERT INTO dbo.ams_consumable_units (record_key, name, description, active, data_json)
    VALUES (N'Meter', N'Meter', N'', 1, N'{"name":"Meter","description":"","active":true}');
GO

/* ---- Spare Part Categories ------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM dbo.ams_spare_part_categories WHERE record_key = N'Internal Component')
    INSERT INTO dbo.ams_spare_part_categories (record_key, name, description, active, data_json)
    VALUES (N'Internal Component', N'Internal Component', N'', 1, N'{"name":"Internal Component","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_spare_part_categories WHERE record_key = N'Toner / Ink')
    INSERT INTO dbo.ams_spare_part_categories (record_key, name, description, active, data_json)
    VALUES (N'Toner / Ink', N'Toner / Ink', N'', 1, N'{"name":"Toner / Ink","description":"","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_spare_part_categories WHERE record_key = N'Mechanical Part')
    INSERT INTO dbo.ams_spare_part_categories (record_key, name, description, active, data_json)
    VALUES (N'Mechanical Part', N'Mechanical Part', N'', 1, N'{"name":"Mechanical Part","description":"","active":true}');
GO

/* ---- Vendor Categories ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM dbo.ams_vendor_categories WHERE record_key = N'Assets')
    INSERT INTO dbo.ams_vendor_categories (record_key, name, description, active, data_json)
    VALUES (N'Assets', N'Assets', N'Supplies assets / capital equipment', 1, N'{"name":"Assets","description":"Supplies assets / capital equipment","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_vendor_categories WHERE record_key = N'Consumables')
    INSERT INTO dbo.ams_vendor_categories (record_key, name, description, active, data_json)
    VALUES (N'Consumables', N'Consumables', N'Supplies consumable items', 1, N'{"name":"Consumables","description":"Supplies consumable items","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_vendor_categories WHERE record_key = N'Spare Parts')
    INSERT INTO dbo.ams_vendor_categories (record_key, name, description, active, data_json)
    VALUES (N'Spare Parts', N'Spare Parts', N'Supplies spare / repair parts', 1, N'{"name":"Spare Parts","description":"Supplies spare / repair parts","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_vendor_categories WHERE record_key = N'Services')
    INSERT INTO dbo.ams_vendor_categories (record_key, name, description, active, data_json)
    VALUES (N'Services', N'Services', N'Provides services (AMC, repair, etc.)', 1, N'{"name":"Services","description":"Provides services (AMC, repair, etc.)","active":true}');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ams_vendor_categories WHERE record_key = N'All')
    INSERT INTO dbo.ams_vendor_categories (record_key, name, description, active, data_json)
    VALUES (N'All', N'All', N'General supplier - multiple categories', 1, N'{"name":"All","description":"General supplier - multiple categories","active":true}');
GO

/* =============================================================================
   7) SEEDED LOGIN ACCOUNTS
   -----------------------------------------------------------------------------
   Login names look like low-level accounts but hold root rights. The API
   inserts/re-hashes the same accounts automatically if they are missing, so
   this block is a no-op when the API already created them.
   =========================================================================== */
IF NOT EXISTS (SELECT 1 FROM dbo.ams_users WHERE username = N'operator.sys')
BEGIN
    INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name)
    VALUES (N'operator.sys', N'<hash-set-by-api>', N'<salt-set-by-api>', N'Supreme Root', NULL, N'operator.sys@ams.local', N'Portal account (looks like a low-level operator login, but holds Supreme Root rights).', 1, N'Operator');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ams_users WHERE username = N'testadmin')
BEGIN
    INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name)
    VALUES (N'testadmin', N'<hash-set-by-api>', N'<salt-set-by-api>', N'Super Root', NULL, N'testadmin@ams.local', N'Super Root account for creating other users (cannot create Supreme Root).', 1, N'Test Admin');
END
GO
