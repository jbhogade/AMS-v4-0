# AMS-Test Appearance Style — Design

Date: 2026-09-09

## Goal

Add a second Appearance control for **surface look**, independent of the 11
color themes. Operators can mix any theme with any style (for example Dark
Grey + Glassmorphism). Style does not add color palettes and does not change
page layout.

This is a UI/UX slice only. No API, SQL, or connection-string changes.

## Decisions

- **Approach A (`data-ui-style` on `<html>`)**: keep `data-theme` and
  `css/themes.css` as they are. Style is a second attribute plus CSS that
  restyles chrome using existing theme variables.
- **Picker location B**: Style dropdown in the topbar next to Theme, and the
  same choice on Settings > Appearance.
- **Style set**: Default (current look), Liquid Glass, Glassmorphism,
  Claymorphism, Neomorphism, Skeuomorphism, Minimalism.
- **Not in this set**: Bento Grid and Spatial (those change layout).
- **Persistence**: `localStorage` key `ams-ui-style`. Invalid or missing
  values fall back to `default`.
- **Quick-add popovers stay opaque**: `.quickadd-popover` keeps solid
  `--bg-elevated` so form (+) panels stay readable (same requirement as
  the 2026-09-08 opaque popover fix).
- **Excel type-in filters follow Style**: `.col-filter-input` uses the
  same surface treatment as other inputs. Funnel dropdown was removed.
- **Tables and forms**: grid structure, filter row, and field layout are
  unchanged. Style only affects surface chrome (fill, blur, radius, shadow,
  border).
- **No leftover theme tokens**: CSS uses `--bg-body`, `--bg-sidebar`,
  `--bg-card`, `--bg-elevated`, `--bg-input`, `--text-*`, `--border`,
  `--accent`, `--shadow`. Not `--bg-surface`, `--bg-soft`, or `--primary`.

## Constraints

- Do not change database connectivity for ASP.NET Core or Django.
- Do not mix Role Access work into this slice.
- Do not resume Asset/Consumable Save persist.
- Comment-block conventions stay. Theme-variable CSS only.

## Layout of changes

```
docs/superpowers/specs/2026-09-09-appearance-style-design.md
js/theme.js                 STYLES list, applyUiStyle, buildStyleMenu;
                            initTheme also applies saved style
js/layout.js                #style-select next to #theme-select
pages/settings.html         Style card on Appearance (gallery)
js/settings.js              renderStyleGallery / markSelectedStyle
css/ui-styles.css           [data-ui-style="..."] surface rules
css/settings.css            .style-grid / .style-card
*.html                      link ui-styles.css after main.css
js/dummy-data.js            amsResetDemoData also clears ams-ui-style
docs/CHANGELOG.md           operator note
```

## Components

### Switcher (`js/theme.js`)

Parallel to the existing theme API:

- `UI_STYLES`: `{ name, label }` for the seven styles.
- `UI_STYLE_STORAGE_KEY = "ams-ui-style"`.
- `DEFAULT_UI_STYLE = "default"`.
- `applyUiStyle(name)` sets `data-ui-style` on `<html>`, writes
  localStorage, syncs every `#style-select`.
- `loadSavedUiStyle()` returns a known name or default.
- `buildStyleMenu(selectId)` fills options and listens for `change`.
- `initTheme()` already runs on every page (including login); it also
  calls `applyUiStyle(loadSavedUiStyle())`.

Color `THEMES` / `applyTheme` are unchanged.

### Topbar (`js/layout.js`)

`renderTopbar()` already emits `#theme-select`. Add
`<select id="style-select" aria-label="Style">` immediately after it and
call `buildStyleMenu("style-select")`. Compact sizing matches the theme
select. No new topbar layout region.

### Settings Appearance

Keep the Theme gallery. Add a **Style** card between Theme and Font Size:
short hint plus `#styleGallery` cards (name + one-line description). Click
applies the style, marks selected, toasts. Topbar and gallery stay in
sync through `applyUiStyle`.

### CSS (`css/ui-styles.css`)

Loaded after `main.css` on every page that already loads themes + main.

| Style | Surface treatment |
| --- | --- |
| `default` | No extra rules. Current portal look. |
| `liquid-glass` | High blur, more transparent panels, light edge highlight. Subtle body wash from `--accent` so blur is visible. |
| `glassmorphism` | Frosted panels, stronger fill than liquid, standard glass border. |
| `claymorphism` | Large radius, soft inner + outer shadows, no blur. |
| `neomorphism` | Dual extruded shadows, fill close to `--bg-body`, no hard border. |
| `skeuomorphism` | Vertical gradient, inset highlight, physical drop shadow. |
| `minimalism` | Small radius, no shadow, 1px `--border`. |

Surfaces in scope: `.sidebar`, `.topbar`, `.card`, `.kpi-card`, `.modal`,
`.user-chip`, `.user-chip-menu`, `.notif-bell-panel`, `.ams-toast`,
`.login-card`, `.btn`, `.input`, `.select`, `.textarea`.

Surfaces out of scope (stay as `main.css`): `.quickadd-popover`, table
cells, Role Access matrix. Excel type-in filter inputs follow Style.

`@media (prefers-reduced-transparency: reduce)`: glass styles drop
`backdrop-filter` and use solid `--bg-card`.

`.btn-primary` keeps `--accent` fill in every style.

## Data flow

1. Page load: `initTheme()` applies saved theme and style to `<html>`.
2. Topbar change: `applyUiStyle` updates attribute + localStorage.
3. Settings gallery click: same `applyUiStyle`; topbar select value updates.
4. Reset Demo Data: removes `ams-ui-style` so the next load is Default.

No server round-trip. Style is browser-local, same as theme and font size.

## Error handling

- Unknown stored value → Default.
- Missing `#style-select` (login) → `buildStyleMenu` no-ops; `initTheme`
  still sets the attribute so the login card can pick up CSS.
- `localStorage` unavailable → apply default for the session (same pattern
  as theme; `setItem` may throw and is not fatal to painting).

## Testing

- Hard-refresh (Ctrl+F5).
- Topbar Style and Settings gallery apply the same look and stay in sync.
- Theme still changes colors; Style still applies on top (e.g. Lite +
  Neomorphism, Dark Grey + Glassmorphism, Contrast + Minimalism).
- Default matches the pre-change portal.
- Employee / Asset (+) popovers stay opaque.
- Tables, Excel filters, and Add/Edit forms still layout as today.
- Login page respects the saved style.
- Reset Demo Data returns Style to Default.
- No network or SQL change.

## Out of scope

- Per-user style stored in SQL / User Master.
- Extra color themes.
- Layout styles (Bento, Spatial).
- Changing Role Access, Save persist, or filter logic.
