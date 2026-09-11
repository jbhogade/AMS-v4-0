# AMS-Test UI + performance Approach C — Design

Date: 2026-09-10

## Goal

Speed up first paint on list pages and lighten chrome, without new color
themes, layout rewrite, Role Access work, or Save persist.

Import / Export / Template headers were checked against Add/Edit form
fields (Assets, Mobiles, SIMs, Employees, lookup masters, Consumables,
Spare Parts, Accessories, Vendors, User Master). They match. Auto IDs
that the form does not type stay off the import template (Assets /
Mobiles: `amsAssetId`, `fullAssetId`). Master-table pages export extra
`active` plus auto-id when configured. No header changes in this slice.

## Decisions

- **Lazy-load SheetJS**: drop eager `js/vendor/xlsx.full.min.js` from
  every HTML page. `amsEnsureXlsx()` in `js/xlsx-helpers.js` injects it
  on first Import / Export / Template. CSV import still works without it.
- **`defer` on page scripts**: all bottom-of-page `.js` tags get `defer`
  except early `embed-mode.js`. Inline boot is wrapped in
  `DOMContentLoaded` so it runs after deferred files.
- **Debounce type-in filters ~150ms** in `amsColFilterText` so each
  keystroke does not re-render the whole table.
- **SVG chrome instead of emoji**: menu, bell, caret, lock, warn, KPI
  and activity icons. Currency `₹` stays. Sort arrows stay Unicode.
- **Tighter list toolbar / KPI tiles**: less gap and padding. No grid
  or column rewrite.
- **Dashboard skeleton**: placeholder KPI cards until `initDashboard`
  fills them.

## Out of scope

- New color themes; Bento Grid / Spatial layouts.
- Role Access or Asset/Consumable Save persist.
- Database connectivity / connection strings.

## Layout of changes

```
docs/superpowers/specs/2026-09-10-ui-performance-c-design.md
js/xlsx-helpers.js     amsEnsureXlsx; export/import wait on it
js/sortable.js         150ms debounce on type-in filters
js/app.js              amsUiIcon()
js/layout.js           SVG menu / bell / caret
js/dashboard.js        SVG KPI + activity icons
js/*.js + pages/*.html emoji chrome -> SVG or plain text
*.html                 remove xlsx script; defer other scripts
css/main.css           .ui-icon, skeleton, tighter toolbar
css/assets.css         tighter .stat-grid
css/dashboard.css      skeleton pulse
docs/CHANGELOG.md      operator note
```

## Constraints

- Theme tokens only (`--bg-body`, `--bg-card`, `--bg-elevated`,
  `--bg-input`, `--accent`, …). Not `--bg-surface` / `--bg-soft` /
  `--primary`.
- Comment-block conventions stay.
- Quick-add (+) popovers stay opaque.

Hard-refresh (Ctrl+F5) after deploy.
