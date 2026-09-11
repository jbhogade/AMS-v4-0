# AMS-Test Asset Type by Category — Design

Date: 2026-09-08

## Goal

Asset Type Master belongs to an Asset Category (same pattern as Make /
Accessory). Asset Category Master has **Used on**: Assets, Mobiles, or
Both. Assets Master only lists Types whose Category is Assets or Both
(IT Hardware, IT Materials). Mobile Master only lists Types whose
Category is Mobiles or Both (Communication).

## Decisions

- **Asset Type Master**: Name + Shortform + Asset Category (required).
  Type **name stays unique** (one Laptop). SQL typed `category` on
  `ams_asset_types`.
- **Asset Category Master**: Name + Used on (Assets / Mobiles / Both).
  SQL typed `used_on` on `ams_asset_categories`.
- **Untagged rows**: Types with no Category, and Categories with no
  Used on, stay in their master lists but do **not** appear on Assets
  or Mobiles until tagged.
- **Plus (+)**: Add Asset / Add Mobile `+ Category` saves Used on =
  Assets or Mobiles for that page. `+ Type` inherits the currently
  selected Category. `+ Make` still inherits Type.
- **Form cascade**: Category (page-scoped) then Type (that Category,
  still page-scoped) then Make (that Type).
- Connection strings unchanged.

## Layout of changes

```
js/dummy-data.js              category/type helpers, quick-add, backfill
js/master-configs.js          Type.category; Category.usedOn; Type +
js/master-table.js            quick-add fields may be <select>
js/assets.js / js/mobiles.js  page-scoped Type/Category; + wiring
pages/assets.html
pages/mobiles.html            Category field before Type
pages/accessories.html        Type + requires Category
js/spare-parts.js             Type + requires Category
database/AMS-TEST.sql
server/AMS.API/Data/AmsDb.cs
server/ams_django/ams/db.py   category + used_on columns/indexes
```

## SQL

**ams_asset_types** (CREATE + ALTER): `category NVARCHAR(200) NULL`.
Index `IX_ams_asset_types_category`.

**ams_asset_categories** (CREATE + ALTER): `used_on NVARCHAR(50) NULL`.
Index `IX_ams_asset_categories_used_on`.

TableDefs: `assetTypes.category` <- `category`; `assetCategories.used_on`
<- `usedOn`. `data_json` still holds the full record.

## Out of scope

- Save/Update persist bug.
- UI/UX polish.
- Changing Type uniqueness to Name + Category.
- Database connection strings.
