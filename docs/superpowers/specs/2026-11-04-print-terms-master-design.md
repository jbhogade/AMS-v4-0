# Print Terms Master

AMS-Test first. Port to AMS-v4-0 only after that is asked.

## Goal

Replace hardcoded acknowledgement / company-property numbered lists on print forms with a System Admin lookup master. Admins (Admin, Super Root, Supreme Root) maintain the rules. Blank or too-few rules must not print.

## Data

Each rule is one master row:

- `termId` (string, unique KeyField, auto-generated e.g. `PT-001`)
- `text` (required; the sentence printed as one numbered item)
- `usedOn` (required select): `Asset Issue Form` | `Asset Handover Form` | `Mobile Issue Form` | `SIM Card Issue Form` | `All`
- `sortOrder` (required integer)
- `active` (standard master flag)

Collection key: `printTerms`. In-memory array: `AMS_DUMMY_PRINT_TERMS`.

Whitespace-only `text` is treated as no rule (cannot save; ignored if present). Inactive rules never print and do not count toward min/max.

`Used On = All` unions with that form's own rules. Print order is all matching rules sorted by `sortOrder` ascending, then `text`. Duplicate `sortOrder` values are allowed.

## Seed

If `printTerms` is empty on first load, insert today's hardcoded terms as form-specific rows (not `All`), `active: true`, `sortOrder` 10, 20, 30, ... Seed through the existing API lookup seeder (`EnsureSeedLookups` / Django equivalent), same as Vendor Category.

Asset Issue Form (5), Asset Handover Form (4), Mobile Issue Form (5), SIM Card Issue Form (5). Wording stays the current strings in `js/assets.js`, `js/print-forms.js`, `js/mobiles.js`, and `js/sim-cards.js`.

## Schema

New table `dbo.ams_print_terms`, created by API bootstrap (C# `AmsDb` + Django `db.py`) and mirrored in `database/AMS-TEST.sql`.

Columns (JSON field names in parentheses):

- `term_id` NVARCHAR(20) (`termId`)
- `rule_text` NVARCHAR(1000) (`text`)
- `used_on` NVARCHAR(50) (`usedOn`)
- `sort_order` INT (`sortOrder`)
- `active` BIT (`active`)
- `data_json` (same JSON document pattern as other masters)

Register `printTerms` on `AMS_COLLECTIONS`, C# `AllowedKeys`, Django table defs / expected keys, and any collection-key tests.

Restart the AMS API so bootstrap applies. Do not run SQL by hand unless the API cannot CREATE/ALTER.

## UI

New lookup master via `js/master-configs.js` + `pages/masters.html?type=print-terms` (same engine as Asset Category).

Fields: Rule Text (multiline), Used On, Sort Order. Active/deactivate uses the existing master toggle. No `usageCount`; min-2 validation is the delete/deactivate guard.

System Admin hub: new tab **Print Terms Master** after Vendor Category Master and before Access Rights Control Master. Embed `masters.html?type=print-terms&embed=1`. Add the `print-terms` title in `js/layout.js` and the page-access map in `js/dummy-data.js` (`printTerms`).

Role Access key `printTerms`: Admin / Super Root / Supreme Root = `full`; Standard User / Viewer = `none`. Add to `AMS_PAGE_REGISTRY` and `AMS_ROLE_ACCESS_RECOMMENDED`. Hub tab hidden when the signed-in user cannot access it.

## Print

Shared helper (e.g. `amsGetPrintTerms(formUsedOn)`):

1. Active, non-blank rules where `usedOn` is `All` or `formUsedOn`
2. Sort by `sortOrder`, then `text`
3. Cap at 50

If the matching count is 0 or 1, omit the terms section entirely. If 2–50, print a numbered list.

Replace hardcoded `terms` arrays in `js/assets.js`, `js/print-forms.js`, `js/mobiles.js`, and `js/sim-cards.js`. Leave `js/mobiles-Akshara-PC.js` unchanged.

Form `usedOn` mapping:

- Asset Issue Form
- Asset Handover Form
- Mobile Issue Form
- SIM Card Issue Form

There is no Mobile Handover or SIM Handover target in this version.

## Validation

Max 50 matching active rules per printed form (form-specific + All) is always enforced on add / edit / activate. Alert names the form that would break, e.g. `Asset Issue Form would exceed 50 rules`.

Min 2 is a print gate, not a first-setup save block:

- A form with 0 or 1 matching rules may stay that way while the admin is setting up; print hides the terms block.
- Once a form has 2 or more matching active rules, further delete / deactivate / edit that would drop that form below 2 is blocked.

`All` has no separate 2–50 quota; it only adds to each form's count. Adding an `All` rule is blocked if any form would exceed 50. Deactivating/deleting an `All` rule is blocked if any form that already had 2+ would drop below 2.

Required on save: `text`, `usedOn`, `sortOrder`. Blank text cannot be saved.

## Out of scope

- AMS-v4-0 until explicitly asked
- `mobiles-Akshara-PC.js`
- Drag-and-drop reorder
- Per-company or per-site term sets
- Mobile Handover / SIM Handover Used On values
