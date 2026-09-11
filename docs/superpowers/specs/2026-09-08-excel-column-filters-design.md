# AMS-Test Excel-style column filters — Design

Date: 2026-09-08

## Goal

Every record table can be filtered and sorted by any data column so
operators find rows faster (e.g. Employees Designation, Owned, Team).

## Decisions

- **Surfaces:** list/master tables, reports, Log, Role Access, Access
  Rights. Not Settings, Company, Profile, or Add/Edit forms.
- **UI:** type-in row under headers plus a unique-values checklist
  (funnel) per data column. Click-to-sort stays on the header label.
- **Toolbar:** keep Status and Site (Active on lookup masters). Search
  and Add/Import/Export stay. Extra dropdowns (Department, Type, Make,
  Operator, Plan) move into the column filters.
- **Reports / Log:** keep their date-range (and similar) toolbars.
  Column filters stack on top.
- **Match:** type-in is case-insensitive contains. Numbers also accept
  `=`, `>`, `<`, `>=`, `<=`, `!=`, or `n-m`. Checklist ANDs with type-in.
  Empty cells appear as (Blanks).
- **State:** in-memory for the page visit. No SQL/API change. No new
  libraries.
- **Engine:** `js/sortable.js` (`amsFilterRows`, filter head row,
  funnel popover). Theme variables only; funnel panel is opaque
  `--bg-elevated`.

## Constraints

- Do not change database connectivity.
- Actions / empty columns are not filterable.
- Export helpers skip the filter row.
