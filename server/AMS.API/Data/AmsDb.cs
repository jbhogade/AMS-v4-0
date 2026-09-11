using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace AMS.API.Data;

/// <summary>
/// Database access layer for the AMS-TEST database.
///
/// Business data (assets, employees, masters, settings, ...) is stored in one
/// per-entity table (ams_assets, ams_employees, ams_sim_operators, ...) instead
/// of a single JSON collector table, so data is queryable / indexable with real
/// SQL. Each record is stored as a row carrying:
///   - row_id      : identity column preserving the display order (the frontend
///                   keeps its arrays in display order and replaces them
///                   wholesale when it saves).
///   - record_key  : the application's natural key for the record.
///   - typed columns: the important business fields promoted to real columns.
///   - data_json   : the full JSON record (what the frontend reads/writes).
///
/// The old dbo.ams_collections table is retained and its rows are migrated into
/// the per-entity tables on first run (see MigrateLegacyCollectionsAsync).
///
/// The ams_users table is fully relational because login is security critical
/// (username primary key + PBKDF2 password hash).
///
/// Schema creation, the per-entity tables, the migrated/seed data and the seeded
/// login accounts are all idempotent and run automatically at startup, so the
/// app works even if the AMS-TEST.sql script was never executed manually.
/// </summary>
public class AmsDb
{
    private readonly string _connectionString;
    private readonly string _dbName;

    public AmsDb(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("Default") ?? "";
        _dbName = "AMS-TEST";
    }

    /// <summary>Connection string targeted at the AMS-TEST database.</summary>
    public string ConnectionString => _connectionString;

    private string GetDbConnectionString()
    {
        // Point the same credentials at a specific database instead of master.
        var builder = new SqlConnectionStringBuilder(_connectionString) { InitialCatalog = _dbName };
        return builder.ConnectionString;
    }

    private string GetMasterConnectionString()
    {
        var builder = new SqlConnectionStringBuilder(_connectionString) { InitialCatalog = "master" };
        return builder.ConnectionString;
    }

    /// <summary>
    /// Ensures the database, schema, per-entity tables, migrated/seed data and
    /// the seeded login accounts exist. Each step is best-effort: if the caller
    /// lacks permission to create the database they will have run
    /// Setup-AMS-TEST.bat (sqlcmd) instead, and the remaining steps still run
    /// against the existing database.
    /// </summary>
    public async Task InitializeAsync()
    {
        await EnsureDatabaseExistsAsync();
        await EnsureSchemaAsync();
        await EnsureSeedUserAsync();
        await MigrateLegacyCollectionsAsync();
        await EnsureSeedLookupsAsync();
    }

    private async Task EnsureDatabaseExistsAsync()
    {
        try
        {
            await using var conn = new SqlConnection(GetMasterConnectionString());
            await conn.OpenAsync();
            var cmd = new SqlCommand(
                $"IF DB_ID(@db) IS NULL CREATE DATABASE [{_dbName}];", conn);
            cmd.Parameters.AddWithValue("@db", _dbName);
            await cmd.ExecuteNonQueryAsync();
        }
        catch
        {
            // Permission denied to create a database - the user should run the
            // provided Setup-AMS-TEST.bat (sqlcmd) as an administrator. The
            // schema step below will still run if the database already exists.
        }
    }

    /* =========================================================================
       PER-ENTITY TABLE DDL  (mirrors database/AMS-TEST.sql)
       Each table: row_id IDENTITY, record_key, typed columns, data_json,
       updated_at. Log tables (consumable_log / spare_part_log) are keyed on
       row_id because log entries have no natural key.
       ========================================================================= */

    private const string SchemaTablesSql = @"
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
";

    private const string SchemaIndexesSql = @"
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
 ";

    private async Task EnsureSchemaAsync()
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();

        await ExecuteAsync(conn, SchemaTablesSql);

        /* Idempotent column additions for databases created before the profile
           columns existed (ALTER TABLE ... ADD is not idempotent in T-SQL). */
        await ExecuteAsync(conn, @"
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
                ALTER TABLE dbo.ams_user_profiles ADD remarks NVARCHAR(500) NULL;");

        await ExecuteAsync(conn, SchemaIndexesSql);
    }

    private async Task EnsureSeedUserAsync()
    {
        /* (username, password, role, email, remarks, displayName) */
        (string, string, string, string, string, string)[] seeds =
        {
            ("operator.sys", "Sr#Ops@2026", "Supreme Root", "operator.sys@ams.local",
             "Portal account (looks like a low-level operator login, but holds Supreme Root rights).", "Operator"),
            ("testadmin", "Admin@#$12345", "Super Root", "testadmin@ams.local",
             "Super Root account for creating other users (cannot create Supreme Root).", "Test Admin"),
        };

        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();

        foreach (var (username, password, role, email, remarks, displayName) in seeds)
        {
            var exists = (int?)await ExecuteScalarAsync(conn,
                "SELECT COUNT(1) FROM dbo.ams_users WHERE username = @u",
                ("@u", username)) ?? 0;

            var salt = HashUtils.NewSalt();
            var hash = HashUtils.HashPassword(password, salt);

            if (exists > 0)
            {
                // Keep the seeded account in sync (re-hash + re-activate). A row
                // inserted by AMS-TEST.sql carries a placeholder hash until the
                // API first runs, so this update guarantees a valid login.
                var upd = new SqlCommand(@"
                    UPDATE dbo.ams_users
                    SET password_hash = @h, password_salt = @s, role = @r, active = 1
                    WHERE username = @u;", conn);
                upd.Parameters.AddWithValue("@h", hash);
                upd.Parameters.AddWithValue("@s", salt);
                upd.Parameters.AddWithValue("@r", role);
                upd.Parameters.AddWithValue("@u", username);
                await upd.ExecuteNonQueryAsync();
                continue;
            }

            var cmd = new SqlCommand(@"
                INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name)
                VALUES (@u, @h, @s, @r, NULL, @e, @m, 1, @dn);", conn);
            cmd.Parameters.AddWithValue("@u", username);
            cmd.Parameters.AddWithValue("@h", hash);
            cmd.Parameters.AddWithValue("@s", salt);
            cmd.Parameters.AddWithValue("@r", role);
            cmd.Parameters.AddWithValue("@e", email);
            cmd.Parameters.AddWithValue("@m", remarks);
            cmd.Parameters.AddWithValue("@dn", displayName);
            await cmd.ExecuteNonQueryAsync();
        }
    }

    /* =========================================================================
       COLLECTION REGISTRY  (collection key -> table + typed column mapping)
       ========================================================================= */

    private sealed class TableDef
    {
        public string Key = "";                  // collection key (api/collection/{key})
        public string Table = "";                // dbo table name
        public string? KeyField;                 // JSON field used as record_key (array collections)
        public string? FixedKey;                 // fixed record_key for document collections
        public bool IsDocument;                  // single-record object collection
        public List<ColumnDef> Columns = new();  // typed columns

        public sealed class ColumnDef
        {
            public string Sql = "";              // SQL column name
            public string? Json;                 // JSON field to read (null => skip / custom)
            public string Type = "nvarchar";     // nvarchar | int | bit
            public Func<JsonElement, object?>? Compute; // optional custom extractor
        }
    }

    private static readonly TableDef[] TableDefs = BuildTableDefs();

    private static TableDef[] BuildTableDefs()
    {
        TableDef.ColumnDef C(string sql, string? json, string type = "nvarchar", Func<JsonElement, object?>? compute = null)
            => new() { Sql = sql, Json = json, Type = type, Compute = compute };

        var defs = new List<TableDef>();

        defs.Add(new TableDef
        {
            Key = "assets", Table = "ams_assets", KeyField = "id",
            Columns =
            {
                C("asset_id", "id"), C("ams_asset_id", "amsAssetId"),
                C("display_id", "displayId"), C("name", "name"),
                C("status", "status"), C("asset_type", "type"),
                C("category", "category"), C("make", "make"),
                C("site", "site"), C("current_site", "currentSite"),
                C("purchase_site", "purchaseSite"),
                C("assigned_to", "assignedTo"),
                C("model", "model"), C("serial_number", "serialNumber"),
                C("vendor", "vendor"), C("purchase_date", "purchaseDate"),
                C("warranty_end", "warrantyEnd"), C("purchase_cost", "purchaseCost"),
            },
        });
        defs.Add(new TableDef
        {
            Key = "mobiles", Table = "ams_mobiles", KeyField = "id",
            Columns =
            {
                C("asset_id", "id"), C("ams_asset_id", "amsAssetId"),
                C("display_id", "displayId"), C("name", "name"),
                C("status", "status"), C("asset_type", "type"),
                C("category", "category"), C("make", "make"),
                C("site", "site"), C("current_site", "currentSite"),
                C("purchase_site", "purchaseSite"),
                C("assigned_to", "assignedTo"),
                C("model", "model"), C("serial_number", "serialNumber"),
                C("imei1", "imei1"), C("imei2", "imei2"),
                C("battery_no", "batteryNo"), C("charger_no", "chargerNo"),
                C("sim_mobile_no", "simMobileNo"), C("vendor", "vendor"),
                C("purchase_date", "purchaseDate"), C("warranty_end", "warrantyEnd"),
                C("purchase_cost", "purchaseCost"),
            },
        });

        defs.Add(new TableDef
        {
            Key = "employees", Table = "ams_employees", KeyField = "amsId",
            Columns =
            {
                C("ams_id", "amsId"), C("emp_id", "empId"),
                C("emp_id_company", "empIdCompany"),
                C("full_name", null, "nvarchar", (r) =>
                {
                    if (r.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(n.GetString()))
                        return n.GetString();
                    var parts = new[]
                    {
                        (r.TryGetProperty("firstName", out var f) && f.ValueKind == JsonValueKind.String ? f.GetString() : ""),
                        (r.TryGetProperty("middleName", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : ""),
                        (r.TryGetProperty("lastName", out var l) && l.ValueKind == JsonValueKind.String ? l.GetString() : ""),
                    };
                    var name = string.Join(" ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
                    return string.IsNullOrWhiteSpace(name) ? null : name;
                }),
                C("department", "department"), C("designation", "designation"),
                C("site", "site"),
                C("status", "status"),
                C("contact", "contact"), C("email", "email"),
                C("manager_ams_id", "managerAmsId"),
            },
        });

        defs.Add(new TableDef
        {
            Key = "assetTypes", Table = "ams_asset_types", KeyField = "name",
            Columns = { C("name", "name"), C("shortform", "shortform"), C("category", "category"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "assetMakes", Table = "ams_asset_makes", KeyField = "makeCode",
            Columns = { C("make_code", "makeCode"), C("name", "name"), C("asset_type", "assetType"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "assetCategories", Table = "ams_asset_categories", KeyField = "name",
            Columns = { C("name", "name"), C("used_on", "usedOn"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "sites", Table = "ams_sites", KeyField = "name",
            Columns = { C("name", "name"), C("shortform", "shortform"), C("address", "address"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "departments", Table = "ams_departments", KeyField = "name",
            Columns = { C("name", "name"), C("shortform", "shortform"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "designations", Table = "ams_designations", KeyField = "name",
            Columns = { C("name", "name"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "accessories", Table = "ams_accessories", KeyField = "accCode",
            Columns = { C("acc_code", "accCode"), C("name", "name"), C("asset_type", "assetType"), C("site", "site"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "vendors", Table = "ams_vendors", KeyField = "name",
            Columns = { C("vendor_id", "vendorId"), C("name", "name"), C("category", "category"), C("city", "city"),
                        C("contact_person", "contactPerson"), C("phone", "phone"), C("email", "email"),
                        C("gstin", "gstin"), C("remarks", "remarks"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "simOperators", Table = "ams_sim_operators", KeyField = "name",
            Columns = { C("name", "name"), C("helpline", "helpline"), C("website", "website"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "simPlans", Table = "ams_sim_plans", KeyField = "name",
            Columns = { C("name", "name"), C("plan_type", "planType"), C("description", "description"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "consumableCategories", Table = "ams_consumable_categories", KeyField = "name",
            Columns = { C("name", "name"), C("description", "description"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "consumableUnits", Table = "ams_consumable_units", KeyField = "name",
            Columns = { C("name", "name"), C("description", "description"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "sparePartCategories", Table = "ams_spare_part_categories", KeyField = "name",
            Columns = { C("name", "name"), C("description", "description"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "vendorCategories", Table = "ams_vendor_categories", KeyField = "name",
            Columns = { C("name", "name"), C("description", "description"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "consumables", Table = "ams_consumables", KeyField = "consumableId",
            Columns =
            {
                C("consumable_id", "consumableId"), C("name", "name"),
                C("category", "category"), C("unit", "unit"), C("site", "site"),
                C("qty", "qty", "int"), C("reorder_level", "reorderLevel", "int"),
                C("restock_date", "restockDate"), C("warranty_date", "warrantyDate"),
                C("unit_cost", "unitCost"), C("vendor", "vendor"), C("remarks", "remarks"),
            },
        });
        defs.Add(new TableDef
        {
            Key = "consumableLog", Table = "ams_consumable_log", KeyField = null,
            Columns =
            {
                C("log_date", "date"), C("consumable_id", "consumableId"),
                C("name", "name"), C("site", "site"), C("log_type", "type"),
                C("qty", "qty", "int"), C("by_whom", "by"), C("remarks", "remarks"),
            },
        });
        defs.Add(new TableDef
        {
            Key = "spareParts", Table = "ams_spare_parts", KeyField = "partId",
            Columns =
            {
                C("part_id", "partId"), C("name", "name"),
                C("category", "category"), C("asset_type", "assetType"),
                C("site", "site"), C("qty", "qty", "int"),
                C("reorder_level", "reorderLevel", "int"),
                C("restock_date", "restockDate"), C("warranty_date", "warrantyDate"),
                C("unit_cost", "unitCost"), C("vendor", "vendor"), C("remarks", "remarks"),
            },
        });
        defs.Add(new TableDef
        {
            Key = "sparePartLog", Table = "ams_spare_part_log", KeyField = null,
            Columns =
            {
                C("log_date", "date"), C("part_id", "partId"),
                C("name", "name"), C("site", "site"), C("log_type", "type"),
                C("qty", "qty", "int"), C("by_whom", "by"), C("remarks", "remarks"),
                C("asset_base_id", "assetBaseId"), C("asset_id_snapshot", "assetIdSnapshot"),
            },
        });
        defs.Add(new TableDef
        {
            Key = "simCards", Table = "ams_sim_cards", KeyField = "simId",
            Columns =
            {
                C("sim_id", "simId"), C("mobile_number", "mobileNumber"),
                C("operator", "operator"), C("plan_name", "plan"),
                C("status", "status"), C("assigned_to", "assignedTo"),
                C("iccid", "iccid"), C("activation_date", "activationDate"),
                C("vendor", "vendor"), C("cost", "cost"),
                C("assigned_date", "assignedDate"), C("linked_mobile_id", "linkedMobileId"),
                C("personal_mobile", "personalMobile", "bit"), C("site", "site"),
                C("remarks", "remarks"),
            },
        });
        defs.Add(new TableDef
        {
            Key = "users", Table = "ams_user_profiles", KeyField = "username",
            Columns = { C("username", "username"), C("role", "role"), C("display_name", "displayName"),
                        C("email", "email"), C("contact_no", "contactNo"), C("address", "address"),
                        C("dob", "dob"), C("gender", "gender"), C("linked_employee", "linkedEmployee"),
                        C("remarks", "remarks"), C("active", "active", "bit") },
        });
        defs.Add(new TableDef
        {
            Key = "exitRecords", Table = "ams_exit_records", KeyField = "exitId",
            Columns = { C("exit_id", "exitId"), C("ams_id", "amsId"), C("emp_name", "empName") },
        });

        /* Document collections (single-record objects) share fixed keys. */
        defs.Add(new TableDef
        {
            Key = "company", Table = "ams_company", IsDocument = true, FixedKey = "company",
            Columns = { C("name", "companyName"), C("address", "address"), C("slogan", "slogan"),
                        C("hr_admin_contact", "hrAdminContact"), C("head_title", "headTitle"),
                        C("head_contact", "headContact") },
        });
        defs.Add(new TableDef
        {
            Key = "roleAccess", Table = "ams_documents", IsDocument = true, FixedKey = "roleAccess",
            Columns = { },
        });
        defs.Add(new TableDef
        {
            Key = "reportPrefs", Table = "ams_documents", IsDocument = true, FixedKey = "reportPrefs",
            Columns = { },
        });
        defs.Add(new TableDef
        {
            Key = "accessRights", Table = "ams_documents", IsDocument = true, FixedKey = "accessRights",
            Columns = { },
        });

        return defs.ToArray();
    }

    private static TableDef? GetTableDef(string key)
        => TableDefs.FirstOrDefault(t => t.Key.Equals(key, StringComparison.OrdinalIgnoreCase));

    /* =========================================================================
       LEGACY MIGRATION  (dbo.ams_collections -> per-entity tables)
       Runs only when a target table is still empty and a legacy row exists, so
       it is safe to re-run and never overwrites newer data.
       ========================================================================= */

    private async Task MigrateLegacyCollectionsAsync()
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();

        var legacyExists = (int?)await ExecuteScalarAsync(conn,
            "SELECT COUNT(1) FROM sys.tables WHERE name = 'ams_collections'") > 0;
        if (!legacyExists) return;

        foreach (var def in TableDefs)
        {
            var count = (int?)await ExecuteScalarAsync(conn,
                $"SELECT COUNT(1) FROM dbo.{def.Table}") ?? 0;
            if (count > 0) continue; // already populated (seeded or migrated earlier)

            var legacy = await ExecuteScalarAsync(conn,
                "SELECT data_json FROM dbo.ams_collections WHERE collection_key = @k",
                ("@k", def.Key)) as string;
            if (string.IsNullOrWhiteSpace(legacy)) continue;

            try
            {
                using var doc = JsonDocument.Parse(legacy);
                var root = doc.RootElement;
                if (def.IsDocument && root.ValueKind != JsonValueKind.Object) continue;
                if (!def.IsDocument && root.ValueKind != JsonValueKind.Array) continue;
                await SaveCollectionAsync(def.Key, legacy);
            }
            catch (JsonException)
            {
                // Malformed legacy payload - skip; the frontend starts empty.
            }
        }
    }

    /* =========================================================================
       LOOKUP SEEDS  (the 6 masters that were previously hardcoded in the UI)
       Inserted only when the target table is empty (mirrors AMS-TEST.sql).
       ========================================================================= */

    private static readonly (string Key, string Json)[] SeedLookups =
    {
        ("simOperators", @"[
            {""name"":""Jio"",""helpline"":""198"",""website"":""https://www.jio.com"",""active"":true},
            {""name"":""Airtel"",""helpline"":""198"",""website"":""https://www.airtel.in"",""active"":true},
            {""name"":""Vodafone Idea"",""helpline"":""199"",""website"":""https://www.myvi.in"",""active"":true},
            {""name"":""BSNL"",""helpline"":""1503"",""website"":""https://www.bsnl.co.in"",""active"":true},
            {""name"":""MTNL"",""helpline"":""1503"",""website"":""https://www.mtnl.co.in"",""active"":true}
        ]"),
        ("simPlans", @"[
            {""name"":""Prepaid"",""planType"":""Prepaid"",""description"":"""",""active"":true},
            {""name"":""Postpaid"",""planType"":""Postpaid"",""description"":"""",""active"":true},
            {""name"":""Corporate Plan"",""planType"":""Corporate"",""description"":"""",""active"":true}
        ]"),
        ("consumableCategories", @"[
            {""name"":""Printer Supplies"",""description"":"""",""active"":true},
            {""name"":""Cables"",""description"":"""",""active"":true},
            {""name"":""Peripherals"",""description"":"""",""active"":true},
            {""name"":""Stationery"",""description"":"""",""active"":true},
            {""name"":""IT Accessories"",""description"":"""",""active"":true}
        ]"),
        ("consumableUnits", @"[
            {""name"":""Nos"",""description"":""Number of pieces"",""active"":true},
            {""name"":""Box"",""description"":"""",""active"":true},
            {""name"":""Pack"",""description"":"""",""active"":true},
            {""name"":""Ream"",""description"":"""",""active"":true},
            {""name"":""Meter"",""description"":"""",""active"":true}
        ]"),
        ("sparePartCategories", @"[
            {""name"":""Internal Component"",""description"":"""",""active"":true},
            {""name"":""Toner / Ink"",""description"":"""",""active"":true},
            {""name"":""Mechanical Part"",""description"":"""",""active"":true}
        ]"),
        ("vendorCategories", @"[
            {""name"":""Assets"",""description"":""Supplies assets / capital equipment"",""active"":true},
            {""name"":""Consumables"",""description"":""Supplies consumable items"",""active"":true},
            {""name"":""Spare Parts"",""description"":""Supplies spare / repair parts"",""active"":true},
            {""name"":""Services"",""description"":""Provides services (AMC, repair, etc.)"",""active"":true},
            {""name"":""All"",""description"":""General supplier - multiple categories"",""active"":true}
        ]"),
    };

    private async Task EnsureSeedLookupsAsync()
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();

        foreach (var (key, json) in SeedLookups)
        {
            var def = GetTableDef(key);
            if (def is null) continue;
            var count = (int?)await ExecuteScalarAsync(conn,
                $"SELECT COUNT(1) FROM dbo.{def.Table}") ?? 0;
            if (count > 0) continue;
            await SaveCollectionAsync(key, json);
        }
    }

    /* ---- Collections (per-entity table storage) ---------------------------- */

    /// <summary>Returns the stored collection as JSON. Array collections are
    /// reconstructed from the data_json column in row_id order.</summary>
    public async Task<string?> GetCollectionAsync(string key)
    {
        var def = GetTableDef(key);
        if (def is null) return null;

        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();

        if (def.IsDocument)
        {
            var result = await ExecuteScalarAsync(conn,
                $"SELECT data_json FROM dbo.{def.Table} WHERE record_key = @k",
                ("@k", def.FixedKey!));
            return result as string;
        }

        var jsons = new List<string>();
        var cmd = new SqlCommand($"SELECT data_json FROM dbo.{def.Table} ORDER BY row_id", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync()) jsons.Add(reader.GetString(0));

        if (jsons.Count == 0) return "[]";
        return "[" + string.Join(",", jsons) + "]";
    }

    /// <summary>Replaces a collection wholesale. Array collections are stored
    /// one row per record (row_id preserves display order); document collections
    /// are a single row keyed by the fixed collection key.</summary>
    public async Task SaveCollectionAsync(string key, string dataJson)
    {
        var def = GetTableDef(key);
        if (def is null) return;

        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        await using var tx = conn.BeginTransaction();

        if (def.IsDocument)
        {
            await ExecuteAsync(conn, $"DELETE FROM dbo.{def.Table} WHERE record_key = @k",
                ("@k", def.FixedKey!), tx);
            using var doc = JsonDocument.Parse(dataJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
                await InsertRowAsync(conn, tx, def, def.FixedKey!, doc.RootElement);
        }
        else
        {
            await ExecuteAsync(conn, $"DELETE FROM dbo.{def.Table}", tx);
            using var doc = JsonDocument.Parse(dataJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var rec in doc.RootElement.EnumerateArray())
                {
                    if (rec.ValueKind != JsonValueKind.Object) continue;
                    var recordKey = ResolveRecordKey(rec, def);
                    /* Detect duplicate natural keys BEFORE inserting so the whole
                       transaction is not lost to a PK violation (500). Report the
                       offending key so the frontend can tell the user what to fix. */
                    if (!string.IsNullOrEmpty(def.KeyField) && !seen.Add(recordKey))
                        throw new CollectionSaveException(key, def.KeyField!, recordKey);
                    await InsertRowAsync(conn, tx, def, recordKey, rec);
                }
            }
        }

        await tx.CommitAsync();
    }

    private static string ResolveRecordKey(JsonElement rec, TableDef def)
    {
        if (!string.IsNullOrEmpty(def.KeyField) &&
            rec.TryGetProperty(def.KeyField!, out var prop) &&
            prop.ValueKind == JsonValueKind.String)
        {
            var v = prop.GetString();
            if (!string.IsNullOrWhiteSpace(v)) return v!;
        }
        // No natural key (log entries) or missing key - generate a unique one.
        return Guid.NewGuid().ToString("N");
    }

    private static async Task InsertRowAsync(SqlConnection conn, SqlTransaction tx, TableDef def, string recordKey, JsonElement rec)
    {
        var cols = new List<string> { "record_key" };
        var pars = new List<string> { "@rk" };
        var cmd = new SqlCommand { Connection = conn, Transaction = tx };
        cmd.Parameters.AddWithValue("@rk", recordKey);

        foreach (var col in def.Columns)
        {
            object? val;
            if (col.Compute != null)
            {
                val = col.Compute(rec);
            }
            else if (string.IsNullOrEmpty(col.Json))
            {
                val = null;
            }
            else if (!rec.TryGetProperty(col.Json!, out var prop) ||
                     prop.ValueKind == JsonValueKind.Null ||
                     prop.ValueKind == JsonValueKind.Undefined)
            {
                val = null;
            }
            else if (col.Type == "int")
            {
                val = prop.ValueKind == JsonValueKind.Number ? prop.GetInt32() : null;
            }
            else if (col.Type == "bit")
            {
                val = prop.ValueKind == JsonValueKind.True || prop.ValueKind == JsonValueKind.String && prop.GetString() == "true";
            }
            else
            {
                val = prop.ValueKind == JsonValueKind.String ? prop.GetString()
                    : prop.ValueKind == JsonValueKind.Number ? prop.GetRawText()
                    : prop.ValueKind == JsonValueKind.True || prop.ValueKind == JsonValueKind.False ? prop.GetBoolean().ToString()
                    : null;
            }

            var pname = "@c" + cols.Count;
            cols.Add(col.Sql);
            pars.Add(pname);
            cmd.Parameters.AddWithValue(pname, val ?? (object)DBNull.Value);
        }

        cols.Add("data_json");
        pars.Add("@dj");
        cmd.Parameters.AddWithValue("@dj", rec.GetRawText());

        cmd.CommandText = $"INSERT INTO dbo.{def.Table} ({string.Join(", ", cols)}) VALUES ({string.Join(", ", pars)});";
        await cmd.ExecuteNonQueryAsync();
    }

    /* ---- Users / login --------------------------------------------------- */

    public async Task<AmsUser?> FindUserAsync(string username)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var cmd = new SqlCommand(@"
            SELECT username, password_hash, password_salt, role, linked_employee, email, remarks, active,
                   display_name, contact_no, address, dob, gender
            FROM dbo.ams_users WHERE username = @u;", conn);
        cmd.Parameters.AddWithValue("@u", username);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;
        return new AmsUser
        {
            Username = reader.GetString(0),
            PasswordHash = reader.GetString(1),
            PasswordSalt = reader.GetString(2),
            Role = reader.GetString(3),
            LinkedEmployee = reader.IsDBNull(4) ? null : reader.GetString(4),
            Email = reader.IsDBNull(5) ? null : reader.GetString(5),
            Remarks = reader.IsDBNull(6) ? null : reader.GetString(6),
            Active = reader.GetBoolean(7),
            DisplayName = reader.IsDBNull(8) ? null : reader.GetString(8),
            ContactNo = reader.IsDBNull(9) ? null : reader.GetString(9),
            Address = reader.IsDBNull(10) ? null : reader.GetString(10),
            Dob = reader.IsDBNull(11) ? null : reader.GetString(11),
            Gender = reader.IsDBNull(12) ? null : reader.GetString(12),
        };
    }

    public bool VerifyPassword(AmsUser user, string password)
    {
        if (string.IsNullOrEmpty(password)) return false;
        var hash = HashUtils.HashPassword(password, user.PasswordSalt);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(hash),
            Encoding.UTF8.GetBytes(user.PasswordHash));
    }

    /* ---- User management (User Master page syncs login accounts to this table) */

    public async Task<List<AmsUser>> ListUsersAsync()
    {
        var users = new List<AmsUser>();
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var cmd = new SqlCommand(@"
            SELECT username, password_hash, password_salt, role, linked_employee, email, remarks, active,
                   display_name, contact_no, address, dob, gender
            FROM dbo.ams_users ORDER BY username;", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            users.Add(new AmsUser
            {
                Username = reader.GetString(0),
                PasswordHash = reader.GetString(1),
                PasswordSalt = reader.GetString(2),
                Role = reader.GetString(3),
                LinkedEmployee = reader.IsDBNull(4) ? null : reader.GetString(4),
                Email = reader.IsDBNull(5) ? null : reader.GetString(5),
                Remarks = reader.IsDBNull(6) ? null : reader.GetString(6),
                Active = reader.GetBoolean(7),
                DisplayName = reader.IsDBNull(8) ? null : reader.GetString(8),
                ContactNo = reader.IsDBNull(9) ? null : reader.GetString(9),
                Address = reader.IsDBNull(10) ? null : reader.GetString(10),
                Dob = reader.IsDBNull(11) ? null : reader.GetString(11),
                Gender = reader.IsDBNull(12) ? null : reader.GetString(12),
            });
        }
        return users;
    }

    public async Task CreateUserAsync(string username, string password, string role,
        string? linkedEmployee, string? email, string? remarks, bool active)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var salt = HashUtils.NewSalt();
        var hash = HashUtils.HashPassword(password, salt);
        var cmd = new SqlCommand(@"
            INSERT INTO dbo.ams_users (username, password_hash, password_salt, role, linked_employee, email, remarks, active, display_name)
            VALUES (@u, @h, @s, @r, @le, @e, @m, @a, @le);", conn);
        cmd.Parameters.AddWithValue("@u", username);
        cmd.Parameters.AddWithValue("@h", hash);
        cmd.Parameters.AddWithValue("@s", salt);
        cmd.Parameters.AddWithValue("@r", role);
        cmd.Parameters.AddWithValue("@le", (object?)linkedEmployee ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@e", (object?)email ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@m", (object?)remarks ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@a", active);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task UpdateUserAsync(string username, string? newPassword, string? role,
        string? linkedEmployee, string? email, string? remarks, bool? active,
        string? displayName, string? contactNo, string? address, string? dob, string? gender)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();

        var sql = new List<string> {
            "role = ISNULL(@r, role)",
            "linked_employee = ISNULL(@le, linked_employee)",
            "email = @e",
            "remarks = @m",
            "active = ISNULL(@a, active)",
            "display_name = @dn",
            "contact_no = @c",
            "address = @ad",
            "dob = @d",
            "gender = @g",
        };
        var ps = new List<(string, object?)>
        {
            ("@r", role), ("@le", (object?)linkedEmployee ?? DBNull.Value),
            ("@e", (object?)email ?? DBNull.Value), ("@m", (object?)remarks ?? DBNull.Value),
            ("@a", active), ("@dn", (object?)displayName ?? DBNull.Value),
            ("@c", (object?)contactNo ?? DBNull.Value), ("@ad", (object?)address ?? DBNull.Value),
            ("@d", (object?)dob ?? DBNull.Value), ("@g", (object?)gender ?? DBNull.Value),
        };

        if (!string.IsNullOrWhiteSpace(newPassword))
        {
            var salt = HashUtils.NewSalt();
            var hash = HashUtils.HashPassword(newPassword, salt);
            sql.Add("password_hash = @h");
            sql.Add("password_salt = @s");
            ps.Add(("@h", hash));
            ps.Add(("@s", salt));
        }

        var cmd = new SqlCommand($"UPDATE dbo.ams_users SET {string.Join(", ", sql)} WHERE username = @u;", conn);
        cmd.Parameters.AddWithValue("@u", username);
        foreach (var (name, value) in ps) cmd.Parameters.AddWithValue(name, value);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteUserAsync(string username)
    {
        await using var conn = new SqlConnection(GetDbConnectionString());
        await conn.OpenAsync();
        var cmd = new SqlCommand("DELETE FROM dbo.ams_users WHERE username = @u;", conn);
        cmd.Parameters.AddWithValue("@u", username);
        await cmd.ExecuteNonQueryAsync();
    }

    /* ---- Helpers ---------------------------------------------------------- */

    private static async Task ExecuteAsync(SqlConnection conn, string sql)
    {
        await using var cmd = new SqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task ExecuteAsync(SqlConnection conn, string sql, SqlTransaction tx)
    {
        await using var cmd = new SqlCommand(sql, conn, tx);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task ExecuteAsync(SqlConnection conn, string sql, (string, object?) param, SqlTransaction tx)
    {
        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue(param.Item1, param.Item2 ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task<object?> ExecuteScalarAsync(SqlConnection conn, string sql, params (string, object)[] parameters)
    {
        await using var cmd = new SqlCommand(sql, conn);
        foreach (var (name, value) in parameters) cmd.Parameters.AddWithValue(name, value);
        return await cmd.ExecuteScalarAsync();
    }
}

/// <summary>Raised when a wholesale collection save would violate the natural
/// key (record_key) uniqueness - i.e. two records in the array share the same
/// id / simId / amsId / name. Translated to a 409 by the controller so the
/// frontend shows a real explanation instead of "API error 500".</summary>
public class CollectionSaveException : Exception
{
    public CollectionSaveException(string collection, string keyField, string keyValue)
        : base($"Duplicate {keyField} '{keyValue}' in collection '{collection}'.") { }
}

public class AmsUser
{
    public string Username { get; set; } = "";    public string PasswordHash { get; set; } = "";
    public string PasswordSalt { get; set; } = "";
    public string Role { get; set; } = "";
    public string? LinkedEmployee { get; set; }
    public string? Email { get; set; }
    public string? Remarks { get; set; }
    public bool Active { get; set; }
    public string? DisplayName { get; set; }
    public string? ContactNo { get; set; }
    public string? Address { get; set; }
    public string? Dob { get; set; }
    public string? Gender { get; set; }
}

/// <summary>PBKDF2 password hashing (SHA-256, 100k iterations).</summary>
public static class HashUtils
{
    public static string NewSalt() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16));

    public static string HashPassword(string password, string saltHex)
    {
        var salt = Convert.FromHexString(saltHex);
        return Convert.ToHexString(Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32));
    }
}
