# Vendor Supplies Multi-Select

AMS-Test first. Port to AMS-v4-0 after AMS-Test is done.

## Goal

Vendor Master Supplies can store multiple Vendor Category values on one vendor (e.g. Assets and Services), without changing Asset / Consumable / Spare Parts / SIM vendor pickers.

## Data

- Keep `vendor.category` as one string.
- Multiple values joined with `", "` (comma + space), e.g. `Assets, Services`.
- Existing single values (`Assets`, `All`) stay valid.
- `All` is its own stored option. Multi-select does not expand All into every category.
- Helpers (split / join / "does this vendor include category X") live in `js/dummy-data.js`. Split accepts comma, pipe, or semicolon and trims; join writes `", "` in Vendor Category Master order (stable, no duplicates, case-preserving against the master name).
- Field stays optional (blank allowed).

## Schema

Widen `dbo.ams_vendors.category` from NVARCHAR(200) to NVARCHAR(250).

- CREATE TABLE uses NVARCHAR(250) for new databases.
- Idempotent ALTER COLUMN NVARCHAR(250) in C# bootstrap, Django bootstrap, and `database/AMS-TEST.sql` (then the v4 copies).
- Restart the AMS API so bootstrap applies. Do not run SQL by hand unless the API cannot CREATE/ALTER.

## UI

- Add `type: "multiselect"` to the generic master engine (`js/master-table.js`).
- Control is a checkbox group of `optionsFrom()` / `options`, not a native `<select multiple>`.
- Vendor Master Supplies uses `type: "multiselect"`; other masters stay single-select.
- Quick-add (+) still adds a Vendor Category, then checks that new box.
- Table, search, export show the joined string.
- Import: Supplies cell may be single or delimited (comma / pipe / semicolon); normalize to `", "` on save.

## Vendor Category Master

`usageCount` counts a vendor when the split Supplies list includes that category name (not `v.category === item.name`). `All` does not count as every category.

## Out of scope

- Filtering vendor dropdowns on Asset / Consumable / Spare Parts / SIM forms. Those still list every active vendor.
- New junction table or a separate `categories` array field.
- Changing Vendor Category Master itself to multi-select.
