# AMS-Test UI/UX Polish — Design

Date: 2026-09-04

## Goal

A thin visual-consistency pass on the portal shell and the four main list
pages so operators see filters and the first table rows with less scroll,
Employees matches Assets/SIMs, and unused chrome is gone. No filter, auth,
API, or data-layer changes.

This is workstream 1 of 4 (UI/UX, then Run-anywhere/preview, Architecture,
Security). The other three get their own specs later.

## Decisions

- **Approach A (surgical shell + list-page pass)**: CSS plus a few HTML and
  `layout.js` markup edits. No shared toolbar JS renderer (too much risk for
  a thin slice). No new app shell.
- **Dead chrome**: remove unused topbar `#global-search` (rendered, never
  wired). Do not add a real global search in this round.
- **Duplicate titles**: drop in-page `h1` on list pages; the topbar already
  shows the page title from `PAGE_TITLES`. Keep the one-line subtitle.
- **Sticky table headers**: out of scope. `.table-wrap { overflow-x: auto }`
  prevents `position: sticky` on `thead` from working without a layout rewrite.
- **Stock by Type**: wrap the Assets/Mobiles "Stock by Asset Type" card in a
  collapsed `<details>` so the table is visible on first paint.
- **Employee actions**: move Add / Template / Import / Export from the page
  heading into the toolbar (same left-filters / right-actions pattern as
  Assets and SIMs). Existing button ids and handlers stay.
- **Theme / comments**: keep theme CSS variables and existing comment-block
  conventions. No hardcoded colors.

## Constraints

- Do not change database connectivity for ASP.NET Core or Django.
- Do not change filter logic, collection saves, print, or CSV import/export
  behavior.
- Do not touch `js/dummy-data.js` in this round.

## Layout of changes

```
js/layout.js                 remove #global-search from topbar markup
css/main.css                 .list-toolbar, compact .page-heading,
                             hide breadcrumb at 900px, full-width search at 600px
css/assets.css               alias .asset-toolbar to shared list-toolbar rules
css/employees.css            alias .emp-toolbar; drop heading-only action cluster
pages/employees.html         subtitle only; actions in toolbar
pages/assets.html            subtitle only; Stock by Type in collapsed <details>
pages/mobiles.html           same as assets.html
pages/sim-cards.html         subtitle only; toolbar already matches target
```

## Components

### Shared shell

`renderTopbar()` in `js/layout.js` currently emits a search input
`#global-search` that no script reads. Remove that input and its wrapping
`.topbar-search` block. Keep: hamburger, title, breadcrumb, spacer, bell,
theme select, user chip (profile / logout).

`css/main.css`:

- `.topbar-breadcrumb { display: none }` inside the existing
  `@media (max-width: 900px)` block.
- Compact `.page-heading`: no in-page `h1` expected; subtitle is a single
  muted line; reduce top/bottom margin so stats + toolbar sit higher.
- Shared `.list-toolbar`: flex, wrap, space-between, search + filters on the
  left, action buttons on the right. `.asset-toolbar` and `.emp-toolbar`
  keep their class names (HTML unchanged except Employees button move) and
  inherit or alias these rules so Assets/Mobiles/SIMs/Employees look the same.
- `@media (max-width: 600px)`: list-toolbar search `width: 100%`; action
  buttons wrap. No card-table rewrite. Table horizontal scroll stays on
  `.table-wrap`.

### List pages

**Employees** (`pages/employees.html`):

- Remove the heading `h1`. Keep the subtitle paragraph.
- Remove the `.quick-actions` cluster from the heading.
- Put Add Employee, Template, Import, Export (same ids:
  `emp-add-btn`, `emp-template-btn`, `emp-import-btn`, `emp-export-btn`) on
  the right of `.emp-toolbar`. Search + Department + Site + Status stay on
  the left. Hidden file input stays. `js/employees.js` bindings unchanged.

**Assets / Mobiles**:

- Remove the heading `h1`. Keep the subtitle.
- Wrap the "Stock by Asset Type" card in `<details>` (closed by default)
  with a `<summary>` of "Stock by Asset Type". Table render into
  `#assetStockByTypeTable` is unchanged.

**SIM Cards**:

- Remove the heading `h1`. Keep the subtitle.
- Toolbar already has left filters / right actions; only heading + shared
  CSS apply.

## Behavior

- After login, every page topbar has no search box. Page title still comes
  from `PAGE_TITLES`. Bell, theme, and profile/logout are unchanged.
- On Employees, Assets, Mobiles, SIMs: first paint is subtitle, then
  stats/tiles, then toolbar, then the main table. Stock by Type (Assets and
  Mobiles) is collapsed until the operator opens it.
- Filter dropdowns, per-page search boxes, CSV template/import/export,
  modals, and print forms keep current logic.
- Under 900px: breadcrumb hidden; hamburger still opens the sidebar overlay.
- Under 600px: toolbar search is full width; action buttons wrap. Tables
  still scroll horizontally inside `.table-wrap`.

## Error handling

None new. Button and table element ids do not change. If a heading wrapper
is missing, existing scripts still bind by id.

## Testing

Manual:

- Desktop: Employees, Assets, Mobiles, SIMs — toolbar layout, filters,
  add/import/export still work; Stock by Type opens and closes on Assets
  and Mobiles.
- Viewport ~900px and ~600px: topbar (title, bell, theme, user chip) is
  usable; sidebar overlay still works; tables scroll horizontally.
- Theme switch still restyles the shell (variables only).
- Employee AMS-ID hint and Supreme Root column visibility unchanged.

Automated: `node --check` on `js/layout.js` if the topbar template string
changes.

## Out of scope

- Run-anywhere / preview (workstream 2).
- Architecture split of `dummy-data.js` / de-dupe Assets vs Mobiles
  (workstream 3).
- API authorization, JWT key, CORS (workstream 4).
- Wiring a real global search.
- Sticky `thead`.
- Mobile card-table layouts.
- Keyboard-driven filter redesign.
- Database connection strings or schema.

## Success criteria

- On a list page, filters and the first table rows are visible with less
  scrolling than today.
- Employees toolbar matches Assets/SIMs (filters left, actions right).
- Unused topbar search is gone.
- Under 900px the topbar remains usable (no cramped unused search).
