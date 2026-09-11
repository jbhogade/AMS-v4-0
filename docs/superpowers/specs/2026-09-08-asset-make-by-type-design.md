# AMS-Test Asset Make by Asset Type — Design

Date: 2026-09-08

## Goal

Asset Make Master works like Accessory Master: each Make belongs to one
Asset Type. Assets and Mobiles Add/Edit (and Replace) Make dropdowns list
only active Makes for the selected Asset Type.

Example: Asset Type Desktop or Laptop shows Dell, ASUS, HP for that Type,
not smartphone brands. Mobile Type Smartphone or Basic Keypad Phone shows
Motorola, Nokia, HMD, Samsung for that Type.

This is Approach A (Accessory clone). Same Name + Asset Type uniqueness,
hidden auto code, Type-filtered dropdowns, typed SQL columns for the full
Make record.

## Decisions

- **Uniqueness**: Make Name + Asset Type. Dell + Desktop and Dell + Laptop
  are two rows (same rule as Accessory Name + Asset Type).
- **Identity**: hidden auto code `makeCode` (`MAKE-000001`). Import and
  duplicate-check match on `["name", "assetType"]`. `idKey` is `makeCode`.
- **Untagged existing Makes**: rows with empty `assetType` stay in Asset
  Make Master. They do **not** appear in any Asset/Mobile Make dropdown
  until an operator edits the row and picks a Type.
- **Quick-add Make** on Add Asset / Add Mobile: Name only; the new row is
  saved with the currently selected Asset Type. Duplicate Name + Type is
  blocked.
- **SQL**: type the full Make record on `dbo.ams_asset_makes`
  (`make_code`, `name`, `asset_type`, `active`) plus `data_json`.
  `record_key` is `makeCode`. Connection strings unchanged.
- **Delete**: blocked while any Asset or Mobile uses that Make Name with
  the same Asset Type.

## Constraints

- Do not change database connectivity for ASP.NET Core (`server/AMS.API`)
  or Django (`server/ams_django`).
- Keep existing comment-block conventions and theme-variable CSS.
- Do not implement UI/UX polish, Run-anywhere, Architecture, or Security
  in this slice.
- Do not fix the reported Asset/Consumable Save/Update persist bug in this
  spec (separate follow-up).

## Layout of changes

```
js/dummy-data.js              amsGetMakeOptions, amsQuickAddMake,
                              AMS_MAKE_SEQ, ensure makeCode on load
js/master-configs.js          "asset-make" config: makeCode, assetType,
                              importMatchKeys, usageCount
js/assets.js                  filter #fMake by #fType; Type change
                              rebuilds Make; quick-add inherits Type
js/mobiles.js                 same as assets.js
pages/assets.html             (only if Replace Make markup needs wiring;
                              no new fields on the Add Asset form)
pages/mobiles.html            same
database/AMS-TEST.sql         CREATE + ALTER make_code / asset_type;
                              index IX_ams_asset_makes_asset_type
server/AMS.API/Data/AmsDb.cs  same schema + TableDef KeyField makeCode
server/ams_django/ams/db.py   same
server/ams_django/ams/tests/test_engine.py
                              assert promoted make columns
```

Asset Make Master still uses `pages/masters.html` + `js/master-table.js`
via the `"asset-make"` config. No new HTML page.

## Components

### 1. Asset Make Master (data + UI)

Record shape:

```
{ makeCode, name, assetType, active }
```

- **Make Name**: required text.
- **Asset Type**: required select from active `AMS_DUMMY_ASSET_TYPES`,
  with + quick-add Type (same pattern as Accessory Master).
- **makeCode**: auto `MAKE-######`, not shown as an editable field
  (`autoIdField`). Sequence `AMS_MAKE_SEQ` in `js/dummy-data.js`.
- **importMatchKeys**: `["name", "assetType"]`.
- **usageCount**: count of `DUMMY_ASSETS` plus `DUMMY_MOBILES` (or the
  mobiles array the page already uses) where `type === item.assetType`
  and `make === item.name`. Delete is blocked while that count is > 0.

CSV template/export/import pick up `assetType` and `makeCode` from the
generic master-table engine. Duplicate Name + Type toasts
`A record with this Make Name + Asset Type already exists.`

### 2. Make options helper

In `js/dummy-data.js`, mirror accessories:

```
amsGetMakeOptions(assetType)
  -> active Makes whose assetType === assetType (empty Type never matches)

amsQuickAddMake(name, assetType)
  -> no-op if name empty or Name+Type already exists
  -> push { makeCode, name, assetType, active: true }
  -> amsDbSaveAsync("assetMakes")
```

`amsPopulateAssetDropdowns` in `js/assets.js` and `js/mobiles.js` fills
`#fMake` from `amsGetMakeOptions(#fType.value)`, not from all Makes.

On `#fType` change: rebuild `#fMake`. If the current Make is not in the
new list, clear or leave the first option. Also keep the existing
`amsUpdateAssetIdPreview` listener.

Edit of an existing asset/mobile: after filling Type, rebuild Make, then
set `#fMake` to the saved `a.make`. If that value is missing from the
filtered list (untagged or Type mismatch), add a one-off option so the
saved value still displays; new choices remain Type-filtered.

Replace modal Make list uses the same helper and the asset's Type (or the
Type field on that modal if it has one).

Quick-add Make (+) on Add Asset / Add Mobile: read `#qaMakeName` and the
current `#fType`. Call `amsQuickAddMake`. Alert if Type is empty
("Select an Asset Type first.") or if Name+Type already exists.

### 3. SQL / API — full typed record

Make fields are few; type all of them as columns. `data_json` still
stores the full JSON document (same pattern as other collections).

**New CREATE** for `dbo.ams_asset_makes` (fresh DB):

```
row_id     BIGINT IDENTITY(1,1) NOT NULL
record_key NVARCHAR(200) NOT NULL   -- makeCode
make_code  NVARCHAR(50)  NULL
name       NVARCHAR(200) NULL
asset_type NVARCHAR(200) NULL
active     BIT           NOT NULL DEFAULT 1
data_json  NVARCHAR(MAX) NOT NULL
updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
PK (record_key)
```

**Idempotent ALTER** on existing DBs (same style as accessories `site`):

```
ALTER TABLE dbo.ams_asset_makes ADD make_code NVARCHAR(50) NULL;
ALTER TABLE dbo.ams_asset_makes ADD asset_type NVARCHAR(200) NULL;
```

**Index** after the ALTER block:

```
IX_ams_asset_makes_asset_type ON dbo.ams_asset_makes(asset_type)
```

Apply in `database/AMS-TEST.sql`, `server/AMS.API/Data/AmsDb.cs`, and
`server/ams_django/ams/db.py`.

**TableDef** (`assetMakes` / `ams_asset_makes`):

- `KeyField` / `key_field`: `makeCode` (was `name`).
- Columns: `make_code` <- `makeCode`, `name` <- `name`,
  `asset_type` <- `assetType`, `active` <- `active`.

Wholesale PUT still replaces the collection. After this change, two rows
named Dell can coexist because `record_key` is `MAKE-000001` vs
`MAKE-000002`, not the name.

**Backfill (client, on load/save):** if a Make has no `makeCode`, assign
the next `MAKE-######` and persist with the rest of `assetMakes`. Do not
invent an `assetType`. Untagged rows remain hidden in dropdowns.

**Key migration:** existing rows used `record_key = name`. After the
TableDef key change, a PUT writes `record_key = makeCode`. The first
save after backfill replaces name-keyed rows with code-keyed rows. That
is expected; there is no SQL data-migration script beyond ALTER.

Connection strings and SQL auth are not touched.

## Data flow

1. Operator opens System Admin -> Asset Make Master, adds Name + Type
   (or edits an old row and picks a Type). Save writes `assetMakes`.
2. Operator opens Assets -> Add Asset, picks Asset Type. `#fMake` lists
   only active Makes for that Type.
3. Changing Type rebuilds Make. Quick-add Make creates a master row for
   the current Type and selects it.
4. Saved Asset/Mobile still stores Make as the **name string** (`make`).
   Filtering is by `asset.type` + `make` name against the master. No
   foreign key to `makeCode` on assets/mobiles in this slice.

## Error handling

- Duplicate Name + Type on master add/edit/import: toast, do not save.
- Quick-add Make with empty Type: alert, do not save.
- Quick-add Make duplicate: alert, do not save.
- Delete while in use: existing master-table usage guard.
- `amsDbSaveAsync("assetMakes")` no-ops if DB not ready or saves
  suspended (unchanged).

## Testing

Manual:

- Asset Make Master: add Dell + Desktop and Dell + Laptop; both save.
  Duplicate Dell + Desktop is blocked. CSV template has name, assetType,
  makeCode, active.
- Existing untagged Make: visible in the master table, absent from every
  Add Asset / Add Mobile Make list until tagged.
- Add Asset, Type Laptop: Make shows only Laptop Makes. Switch to
  Desktop: list rebuilds. Quick-add "Lenovo" while Type is Laptop creates
  Lenovo + Laptop and selects it.
- Add Mobile, Type Smartphone: Make shows only Smartphone Makes.
- Edit an asset whose Make is untagged: saved Make still displays; new
  options are Type-filtered.
- Delete a Make used by an asset of that Type: blocked.
- Restart API or re-run `database/AMS-TEST.sql`; hard-refresh (Ctrl+F5).

Automated:

- `node --check` on `js/dummy-data.js`, `js/master-configs.js`,
  `js/assets.js`, `js/mobiles.js`.
- `python3 -m py_compile server/ams_django/ams/db.py`.
- Django test: TableDef for `assetMakes` includes `make_code` /
  `asset_type` and `key_field == "makeCode"`.

## Out of scope

- Asset/Consumable Save/Update persist bug.
- UI/UX polish spec (`2026-09-04-ui-ux-polish-design.md`).
- One Make row with many Types.
- Changing Asset/Mobile `make` from a name string to `makeCode`.
- Site on Asset Make Master.
- Database connection strings.

## Success criteria

- Accessory-style checklist already filters by Type; Make dropdowns do
  the same from Asset Make Master.
- Same brand can exist under more than one Asset Type as separate rows.
- Untagged legacy Makes never appear in Add/Edit Make lists.
- Full Make record is queryable as typed SQL columns, not JSON-only.
