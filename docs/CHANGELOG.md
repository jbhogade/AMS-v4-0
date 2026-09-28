# AMS-v4-0 change log

## 2026-09-27 — Unused connections and page links

Sidebar, Profile, and login redirects now resolve from both the dashboard
and `/pages/` (`amsHref`). Unused CORS policy removed (UI is same-origin).
Settings no longer has Reset Demo Data. Stale "not connected" comments
updated. Hard-refresh (Ctrl+F5).

## 2026-09-24 — Vector glassy login pane, gold-to-charcoal backdrop

Login card uses Vector pane glass (theme tokens, no Halo SVG field).
Backdrop is a smooth accent-to-charcoal gradient instead of the lattice.
Username / password only. Hard-refresh (Ctrl+F5).

## 2026-09-23 — Platinum default, clearer glass, Django migrate

Default Theme stays Platinum. Glass panels are more transparent.
Django `DATABASES.OPTIONS` includes `extra_params: TrustServerCertificate=yes`
so `python manage.py migrate` works with ODBC Driver 18. README Django
steps include migrate. Hard-refresh (Ctrl+F5).

## 2026-09-21 — Lookup seeds and role-locked Access Rights

Empty master tables now seed SIM operators/plans, consumable
categories/units, spare-part categories, and vendor categories (same
lists as AMS-Test). Access Rights checklists lock Log / Access Rights /
Role Access to the role floor. SQL backup stays off live. Hard-refresh
(Ctrl+F5).

## 2026-09-19 — Theme already live; API errors show server text

Glass Platinum Theme stays the default. Failed API calls now show the
server message instead of a bare "API error 500". Role Access fills
missing page keys. SQL Database Backup is not on live. Hard-refresh
(Ctrl+F5).

## 2026-09-18 — Date field typing and month/year jump

Glass calendar stays. Type in the date box as before. Open the calendar
from the icon on the right (or Alt+ArrowDown). Click the month or year
in the calendar header to jump, then pick a day. Hard-refresh (Ctrl+F5).

## 2026-09-17 — Port AMS-Test UI to live AMS-v4-0

Glass Theme (Platinum default, Blue removed), login Theme dropdown,
per-user Theme and sidebar Show/Hide, Actions menus, themed date picker,
max+1 IDs, import date parse, For Reference cascade. Live cut stays
blank except logins. Database remains `AMS-v4-0`. Hard-refresh (Ctrl+F5).

## 2026-09-11 — Live blank cut (AMS-v4-0)

Live database is `AMS-v4-0`. Masters and business records start empty.
Login accounts are kept: `operator.sys` / `Sr#Ops@2026` and
`testadmin` / `Admin@#$12345`. AMS-Test stays on `AMS-TEST`.

## 2026-09-11 — Desktop sidebar hide (icon-only)

Desktop sidebar can collapse to a 64px icon rail so lists get more width.
Hover or keyboard focus peeks master names over the page; the peek
closes on leave unless Show is pinned (`localStorage` `ams-sidebar-show`).
Collapsed and peek keep Main / People / Inventory / Admin as a short
line so icons do not jump. Default is collapsed. Mobile hamburger
drawer is unchanged.

Hard-refresh (Ctrl+F5). Use the topbar rail button next to the page title.

## 2026-09-10 — Load speed + light chrome (Approach C)

List pages skip SheetJS until Import / Export / Template. Shared scripts
use `defer`. Type-in column filters wait ~150ms before re-drawing.

- Menu, bell, caret, lock, and dashboard KPI icons are SVG, not emoji.
- List toolbar and stock/KPI tiles are a little tighter.
- Dashboard KPI row shows a skeleton until numbers load.
- Import / Export / Template headers were checked against form fields;
  no header changes. Spec:
  `docs/superpowers/specs/2026-09-10-ui-performance-c-design.md`.

Hard-refresh (Ctrl+F5). Open Assets, type in a column filter, then use
Template / Export once (first Excel click may pause while the library
loads).

## 2026-09-09 — Excel filters: type-in only

Column filters keep the type-in row under headers. The funnel dropdown
button and unique-values checklist are removed. Click-to-sort on the
header is unchanged. Clear filters still empties the type-in row.
Hard-refresh (Ctrl+F5).

## 2026-09-09 — Appearance Style (surface look)

Color Theme and Style are independent. Mix any of the 11 themes with a
surface look: Default, Liquid Glass, Glassmorphism, Claymorphism,
Neomorphism, Skeuomorphism, Minimalism.

- Topbar: Style dropdown next to Theme. Settings > Appearance: Style gallery.
- Saved in the browser as `ams-ui-style`. Default is the current solid look.
- Layout, tables, Excel filters, and Role Access are unchanged.
- Quick-add (+) popovers stay opaque. Excel type-in filter inputs
  follow Theme and Style.
- Spec: `docs/superpowers/specs/2026-09-09-appearance-style-design.md`.

Hard-refresh (Ctrl+F5). Try Dark Grey + Glassmorphism, then Default.

## 2026-09-08 — Excel-style column filters

Every list table can be filtered by any data column.

- Type-in row under headers (contains; numbers also accept = > < >= <= != and n-m).
- Funnel on each header: unique-values checklist, like Excel AutoFilter.
- Toolbar keeps Status + Site (Active on lookup masters). Extra dropdowns
  (Department, Type, Make, Operator, Plan) moved into the columns.
- Click-to-sort is unchanged. Actions columns are not filterable.
- Settings, Company, Profile, Add/Edit forms, and Role Access (edit
  matrix) are unchanged. Spec:
  `docs/superpowers/specs/2026-09-08-excel-column-filters-design.md`.

Hard-refresh (Ctrl+F5). On Employees, type a designation or use the
funnel on Owned / Team. Clear filters resets the column row. Funnel
Select All / OK uses the full unique list (not only the search-visible
boxes). Unchecking every value hides all rows. Exports and report print
follow the on-screen column filters. Log, Access Rights, and each
Report panel have Clear filters.

## 2026-09-08 — Opaque quick-add (+) popovers

Department / Designation (+) on Add/Edit Employee used `--bg-surface`,
which was removed in the theme rename. The popover had no background and
showed the form through it.

- Employee popover and import banner now use `--bg-elevated`.
- Same solid panel on Assets, Mobiles, SIM, Vendor, and master-table (+)
  popovers so they sit above the modal instead of blending into it.
- Replace-modal selected-asset box: leftover `--primary` / `--bg-soft`
  mapped to `--accent` / `--bg-elevated`.

Hard-refresh (Ctrl+F5). Open Add Employee and click + beside Department
or Designation; the small panel should be fully opaque.

## 2026-09-08 — Role Access Recommended matrix (None / View / Full)

Role Access Master uses the Recommended sheet from
`docs/AMS-Role-Access-Matrix.xlsx`. No SQL schema change: the matrix is
JSON in `ams_documents` (`record_key` = `roleAccess`).

- Levels: **None** (hidden), **View** (open, cannot save), **Full**.
- Viewer is View on operational pages; Settings stays Full (theme/font).
- Admin gets lookup masters + User Master; not Company, Log, or security pages.
- Super Root adds Company + Log. Supreme Root only: Access Rights and Role Access.
- Legacy true/false maps migrate to this matrix on next load and are saved
  back to `ams_documents`. Hard-refresh (Ctrl+F5). Sign in as Supreme Root
  and open Role Access Master to confirm. Reset to Suggested Defaults if a
  custom map should be replaced.

## 2026-09-08 — Asset Type by Category (Used on)

Assets Master and Mobile Master only offer Asset Types that belong to
Categories tagged for that page.

- **Asset Type Master:** required **Asset Category**. SQL `ams_asset_types.category`.
- **Asset Category Master:** required **Used on** (`Assets` / `Mobiles` / `Both`).
  SQL `ams_asset_categories.used_on`.
- **Assets Master:** Types whose Category Used on is Assets or Both
  (IT Hardware, IT Materials). **Mobile Master:** Mobiles or Both
  (Communication).
- Add/Edit cascade: Category (page-scoped) → Type → Make. Category sits
  above Type on the form.
- **Plus (+):** `+ Category` saves Used on for the current page.
  `+ Type` inherits the selected Category. `+ Make` still inherits Type.
- Untagged Types/Categories stay in their master lists but are hidden on
  Assets/Mobiles until tagged.
- Spec: `docs/superpowers/specs/2026-09-08-asset-type-by-category-design.md`.

Restart the API or re-run `database/AMS-v4-0.sql`, then hard-refresh
(Ctrl+F5). Tag Categories (Used on) and Types (Category) before they
appear on Add Asset / Add Mobile.

## 2026-09-08 — Asset Make by Asset Type

Asset Make Master works like Accessory Master: each Make belongs to one
Asset Type. Add Asset / Add Mobile Make lists only Makes for the selected
Type.

- Uniqueness: Make Name + Asset Type (Dell + Desktop and Dell + Laptop
  are two rows). Hidden `makeCode` (`MAKE-000001`).
- Untagged legacy Makes stay in Make Master but are hidden in dropdowns
  until you pick a Type.
- SQL: `ams_asset_makes.make_code`, `asset_type`; `record_key` is
  `makeCode`. Index `IX_ams_asset_makes_asset_type`.
- Spec: `docs/superpowers/specs/2026-09-08-asset-make-by-type-design.md`.
