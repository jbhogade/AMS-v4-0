# AMS-v4-0 change log

## 2026-10-28 — Default Style is Apple

Default Theme stays **Dark Grey**. Default Style is now **Apple**
(was Plain). HTML `data-ui-style="apple"`. Users with no saved Style
get Apple. Saved per-user Style is unchanged. Cache-bust `?v=v40u`.
Hard-refresh (Ctrl+F5). If Style still shows Plain, pick Apple once.

## 2026-10-27 — Nine themes (Dark Grey default) + Appearance Style

Same nine palettes as AMS-Test. Default Theme is **Dark Grey**. Default
Style is **Apple**. Optional Styles: Plain, macOS, iOS, iPadOS.

- Topbar and login: Theme + Style dropdowns.
- Settings > Appearance: Theme gallery (9) and Style gallery.
- Saved per signed-in username (`ams-theme-by-user`, `ams-ui-style-by-user`).
- Removed names map: platinum/blue -> dark-grey, obsidian -> midnight,
  teal -> ice, emerald -> forest, violet -> purple, wine/rose-gold/amber/copper
  -> dark-gold, crimson -> contrast.
- `applyTheme` no longer forces `data-ui-style="plain"`.
- Cache-bust `?v=v40u` on `css/themes.css`, `css/ui-styles.css`, `js/theme.js`.

Hard-refresh (Ctrl+F5). Try Dark Grey + Apple, then Plain.

## 2026-10-23 — Django HTTPS packages

`server/ams_django/requirements.txt` now includes `uvicorn==0.34.2` and
`cryptography==50.0.2` so HTTPS can be installed with
`pip install -r requirements.txt`. `runserver` stays HTTP-only;
`runserver_plus` is not available. Also added `cryptography` (and
`PyJWT` where it was missing) to `requirements-2*.txt`.
`run-django.bat` upgrades pip first when a newer release is available.
HTTPS: run `run-django-https.bat` (creates `cert.pem` / `key.pem`) and open
`https://127.0.0.1:8000/`.

## 2026-10-21 — Mobile Master labels, Model Number, Swap Mobile

Mobile Master user-facing text now says Mobile (not Asset): IDs, types,
stock, transfer/replace/history, issue form, notifications. Internal field
IDs are unchanged.

Optional **Model Number** sits beside Mobile Model on Add/Edit. It shows in
View, CSV, table Make/Model, print Type/Make/Model, import/export. SQL column
`ams_mobiles.model_number` (Django / .NET maps included).

New **Swap** action (Replace is unchanged): Assigned↔Assigned or Assigned↔In
Store. Holders are exchanged. If either phone has a SIM, you must choose
**Move SIM with holder** or **Keep SIM in this phone**. History is written
on both phones and on SIMs when a SIM is involved. Swap includes optional
**Common / Supportive Accessories**, saved on the mobile the original holder
receives.

Hard-refresh (Ctrl+F5).

## 2026-10-20 — SIM Assign To (Subordinate / Actual User)

SIM Assign / Reassign / Edit Issue now has **Assign To (Subordinate /
Actual User)** matching Asset Assign: optional employee, Other (free
text), and + quick-add. Table shows `Direct → Holder`. View, CSV, print
(Issued vs For Reference), owned/team counts, and Exit follow the same
rules as assets and mobiles.

Hard-refresh (Ctrl+F5).

## 2026-10-20 — Exit checklist includes mobiles and SIMs; print remarks use base IDs

Employee Exit now lists mobiles and SIM cards to return (same as assets),
and counts them on subordinate handover. Issue / Handover **Remarks /
Notes** use the base ID (`LT25SLPD`, `SIM-000001`) instead of appending
site/department (`LT25SLPDSLPRD`, `undefinedPRD`).

Hard-refresh (Ctrl+F5).

## 2026-10-20 — Mobile Issue Form print scope

Mobile Master **Print Issue Form** now asks Direct / Team / Both before
printing, matching Asset Master: directly assigned mobiles only, plus
team mobiles, or team only. SIM sections follow the same choice.

Hard-refresh (Ctrl+F5).

## 2026-10-19 — Print mobile remarks with asset remarks

When an employee also has mobiles assigned, the Issue Form **Remarks /
Notes** section now lists each mobile's on-record remarks in the same
style as assets (`Mobile ID - Remarks (on record)`). Applies to Asset
Master and Employee Master prints. Handover already included returned
mobiles.

Hard-refresh (Ctrl+F5).

## 2026-10-19 — One SIM Card per mobile

Mobile Master no longer lists a SIM that is already linked to another
phone. Add / Edit **Mobile No (SIM Card)** and Assign hide those numbers
(the current phone's own SIM stays selectable). Saving a taken number is
blocked.

Hard-refresh (Ctrl+F5).

## 2026-10-19 — Print Date of Issue on issued and subordinate holdings

The Issue Form header no longer has a single **Date of Issue** box. Each
issued and subordinate (For Reference) row now has its own **Date of Issue**
column, taken from that item's last assignment date.

- Asset / Mobile / SIM issued tables and subordinate tables.
- **Date Generated** in the letterhead is unchanged. Handover Form is unchanged.

Hard-refresh (Ctrl+F5).

## 2026-10-19 — Print accessories are only those selected at assignment

The Issue Form **Accessories / Items Included** section now lists only the
accessories ticked in Assign / Replace **Common / Supportive Accessories
(optional)**. If none were selected, the section is omitted.

Hard-refresh (Ctrl+F5).

## 2026-10-18 — Print Date of Issue uses the assignment date

Asset Issue Form / SIM Card Issue Form previously put today's date in
**Date of Issue**, so a print taken later than the assignment showed the
wrong handover date.

- **Date of Issue** now comes from the item's last assignment (`assignedDate`
  / `issueDate`, else the newest "Assigned" / "Reassigned" / "Assignment
  updated" history row).
- **Date Generated** in the letterhead is still the day the form is printed.
- Applies to Asset Master, Mobile Master, SIM Card Master, and Employee
  Master issue prints. Handover Form is unchanged (Date of Exit + Form
  Generated).

Hard-refresh (Ctrl+F5).

## 2026-10-18 — Plain solid surfaces (theme / UI style)

The portal now uses opaque, plain surfaces instead of frosted glass, matching
AMS-Test and cutting GPU/RAM use on older machines.

- Every page, `index.html`, and `login.html` now set `data-ui-style="plain"`;
  `applyTheme()` / `applyUiStyle()` pin it to plain, so a previously saved
  "glass" value is overwritten.
- `css/ui-styles.css` is the flattened plain stylesheet: no `backdrop-filter`,
  no Halo streaks/lattice, no `color-mix` glass fills. Cards, sidebar, topbar,
  modals, menus, inputs, and table headers use the theme's solid tokens.
- Login pane uses the solid card/field/button tokens (gold-to-charcoal gradient
  and blurred pane removed). Colour palettes in `css/themes.css` are unchanged,
  and the Theme dropdown still works exactly as before.

Hard-refresh (Ctrl+F5) so the browser drops the cached stylesheet.

## 2026-10-18 — Faster startup data load and Replace accessories

Startup no longer pays ~28 sequential queries for the business collections.

- **Bulk endpoint:** `GET /api/collections` (ASP.NET Core and Django) returns
  every collection in a single SQL round-trip
  (`AmsDb.GetAllCollectionsAsync` / `db.get_all_collections`). The frontend
  uses it once and falls back to per-collection loads if it fails.
- **ETag / 304:** the bulk response carries an `ETag` built from row counts and
  newest `updated_at`, and the frontend keeps the payload in `sessionStorage`,
  so moving between pages revalidates with a 304 instead of re-downloading.
- **Parallel account load:** `/api/auth/users` is fetched at the same time as
  the collections instead of after them.
- **Earlier kickoff:** the load starts as soon as `dummy-data.js` runs when a
  session exists, overlapping the rest of the page boot.
- **Response compression:** gzip/brotli enabled for API and static responses.
- **Seed accounts:** startup skips the two expensive PBKDF2 re-hashes when the
  seeded rows already verify, so the API reaches "ready" noticeably sooner.
- **Replace Accessories:** the Replace modal on Assets and Mobiles now has an
  optional Common / Supportive Accessories checklist with the usual quick-add.
  It pre-fills from the selected replacement asset (falling back to the old
  asset) and is saved onto the replacement record.

Restart the API, then hard-refresh (Ctrl+F5).

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
