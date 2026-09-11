# MERGE PLAN : v3-3 Features -> v4-0 Architecture

- **Decision (confirmed with user):** Keep **v4-0** as the base (clean architecture,
  single-source nav via `layout.js`, comment blocks, CSS-variable theming) and
  **port v3-3's mature features into it page-by-page**, following the existing
  "build one thing, confirm, move on" workflow.
- **v3-3 source of truth:** `/tmp/opencode/ams-v3-3` (cloned from GitHub,
  repo now public). Re-clone any time if the local copy is lost.
- **Conventions to honour on every ported page:**
  1. Every file starts/ends with `#-------------- Start Code for ... / End of the code ...` blocks.
  2. Dates shown as `dd-mm-yyyy` in the UI (use `amsFormatDate` / `amsParseDMY`).
  3. Major actions give feedback via `amsToast` (info / success / warning / danger).
  4. No password fields anywhere (frontend only; SQL Server comes later).
  5. New pages read colours ONLY from theme variables (never hardcoded hex).

---

## Phase 1 - Shared Foundation  (DONE)

- [x] 1A. Extend `css/themes.css` from 8 to **11 themes**.
      Added `violet`, `crimson`, `contrast` (ported values from v3-3
      `themes-v1-0.css`), each mapped onto v4-0's variable set
      (`--bg-body`, `--bg-card`, `--accent`, ...).
      Registered in `js/theme.js` `THEMES` list -> dropdown now shows 11.
- [x] 1B. Port v3-3's shared helpers into `js/dummy-data.js`:
      `amsFormatDate`, `amsParseDMY`, `amsToast`, `amsCsvRow`,
      `amsParseCsv`, `amsDownloadFile`.
      Added the missing `.ams-toast*` CSS into `css/main.css`
      (v3-3 never shipped toast styles - this fixes that gap).
- [x] 1C. Verify: `node --check` all JS; existing jsdom smoke tests still pass;
      new helpers + toast render correctly (tested with jsdom polyfill).

## Phase 2 - Master Table Engine  (generic CRUD for lookup masters)

Port v3-3's config-driven table engine so the lookup masters
(Asset Type / Make / Category, Site, Department, Designation, Accessory, ...)
can be built without repeating code.

- [x] 2A. Port `master-table-v1-0.js` -> `js/master-table.js`
          (adapt CSS variable names + comment-block style).
- [x] 2B. Port `master-table-v1-0.css` -> `css/master-table.css`.
- [x] 2C. Add the lookup-master pages under `pages/` (one generic page or
          one page per master) wired into `layout.js` under the Admin section.
          -> single generic `pages/masters.html` served via `?type=` query,
             driven by `js/master-configs.js` definitions.
- [x] 2D. Verify with jsdom test + visual check in preview.
          (`/tmp/opencode/amstest/test-master.js` passes).

## Phase 3 - Roles & Access Control

- [x] 3A. Roles data model (Standard User .. Supreme Root) + "Viewing As" simulator.
          -> "Viewing As" role selector already lives in `js/layout.js` topbar
          (`#viewing-as`), wired to gate nav visibility + page actions.
- [x] 3B. Access Rights matrix + Role Access Master page.
          -> Three role-gated pages ported from v3-3, embedded as System
          Administrator hub tabs (shared `css/role-gate.css` for the
          "Viewing As" bar / access-denied card / actor badges / filter row):
          - `pages/access-rights.html` + `js/access-rights.js` +
            `css/access-rights.css` - Supreme Root only; per-user
            `allowedPages` checkbox checklist from `AMS_PAGE_REGISTRY`;
            saves via user-record mutation; search + "Role Default vs Custom"
            badges. Verified: `/tmp/opencode/amstest/test-access-rights.js`.
          - `pages/role-access.html` + `js/role-access.js` +
            `css/role-access.css` - Supreme Root only; Role x Page matrix
            (5 roles x 26 registry entries incl. `report.*`); saves via
            `amsSaveRoleAccessDefaults()` (localStorage); `accessRights` /
            `roleAccess` / `log` rows shown but locked (role-enforced);
            Reset restores `amsDefaultRoleAccessMap()`. Verified:
            `/tmp/opencode/amstest/test-role-access.js`.
          - `pages/log-report.html` + `js/log-report.js` (no page css -
            role-gate.css covers it) - Super Root / Supreme Root only;
            Super Root hides records logged while viewing as Supreme Root;
            Supreme Root sees all + can clear the log; search / actor /
            page / date filters + CSV export via `amsDownloadFile`.
            Verified: `/tmp/opencode/amstest/test-log-report.js`.
          - All three wired into the System Administrator hub
            (`AMS_ADMIN_TABS` in `js/system-admin.js`) and `PAGE_TITLES`
            in `js/layout.js` (`access-rights` / `role-access` / `log`).
- [x] 3C. Wire role visibility into the sidebar (`layout.js`) and key pages.
- [x] 3D. Verify.
          -> test-access-rights.js / test-role-access.js / test-log-report.js
          all pass; system-admin test extended to cover the 3 new hub tabs.

## Phase 4 - Notifications / Audit Log + Company Master

- [x] 4A. Notification bell in the topbar + persistent audit/log report page.
          -> bell + badge + panel live in `js/layout.js`; notifications persist
          via `amsNotify` / `amsSaveNotifications` in `js/dummy-data.js`.
- [x] 4B. Company Master (feeds print letterheads) page + data model.
          -> `AMS_DUMMY_COMPANY_DETAILS` + `amsGetCompanyDetails()` in
          `js/dummy-data.js`; read/write via `AMS_COMPANY_STORAGE_KEY`.
          (Consumed by the Asset Issue Form print from Phase 5.)
          -> Page + form built later (Phase 4 follow-up): `pages/company.html`
          is a single-record form (Company Name required, Address, Logo upload/
          preview, HR/Admin + Head contact) saving through `amsSaveCompanyDetails`.
          Now embedded as the default tab of the System Administrator hub
          (`pages/system-admin.html`), so lookup masters and Company share one
          entry point. Verified: `/tmp/opencode/amstest/test-company.js`
          (loads existing details, save persists, empty-name rejected).
- [x] 4C. Verify.
          -> `/tmp/opencode/amstest/test-company.js` passes.

## Phase 5 - Asset Master (full lifecycle)  (DONE)

- [x] 5A. Asset data model upgrade (Smart Asset ID, history, condition, doc refs).
          -> `js/dummy-data.js` section 5b: `amsTypeShort`, `amsSiteShort`,
          `amsDeptShort`, `amsBaseDisplayId`, `amsGetEmployeeByAmsId`,
          `amsGetEmployeesForPortal`, `amsComputeFullId`; `DUMMY_ASSETS`
          upgraded with `amsAssetId` + full-ID records; `AMS_DUMMY_SPAREPART_LOG`
          carries `assetBaseId`.
- [x] 5B. Assign / Reassign / Return / Transfer / Retire / Replace flows.
          -> `js/assets.js` (`amsConfirmAssign`, `amsReturnAsset`,
          `amsConfirmTransfer`, `amsMarkNotWorking`, `amsRetireAsset`,
          `amsSubmitReplaceForm`), all status transitions logged to history.
- [x] 5C. Asset history / log viewer.
          -> `amsOpenHistoryModal` lifecycle popup.
- [x] 5D. Import / Export CSV.
          -> `amsExportAssets`, `amsImportAssetsFile`, `amsDownloadAssetTemplate`
          with `*`-required headers, `#` comment rows, skip/update summary banner.
- [x] 5E. Verify.
          -> `/tmp/opencode/amstest/test-assets.js` (48 checks) passes;
             full regression: test.js/test2.js/test3.js/test4.js/test-master.js
             all still pass. Visual check pending in preview.

## Phase 6 - Consumable Master & Spare Parts Master

- [x] 6A. Consumables with Restock / Used tracking + movement log.
          -> Data (categories, units, stock rows, movement log) already in
             `js/dummy-data.js` §7; new `js/consumables.js` provides the
             `AMS_MASTER_CONFIG` (CRUD/search/import/export via the generic
             `js/master-table.js` engine; fields match v3-3 incl. Last
             Restocked Date + Warranty End Date) plus three custom row
             actions: **Restock** and **Used / Assign** (modal-driven, mutate
             `qty` + append to `AMS_DUMMY_CONSUMABLE_LOG`, `amsToast`
             feedback) and **Restock Report** / **Assign-Used Report**
             (movement log scoped to the clicked row). `pages/consumables.html`
             was rebuilt on the `masters.html` shell with `modalRestock`,
             `modalUsed`, `modalStockReport`. Low-stock rows (qty <= reorder
             level) get a `badge-red` "Low Stock" flag via `rowBadge`.
             Verified: `/tmp/opencode/amstest/test-consumables.js` (table
             render + badge, restock qty/log, used-assign decrement, over-use
             guard, scoped report, add-via-engine with auto `CNS-` ID).
- [x] 6B. Spare Parts with Restock / Used tracking + per-item report.
          -> Same pattern as 6A: data in `js/dummy-data.js` §8; new
             `js/spare-parts.js` provides the `AMS_MASTER_CONFIG` (fields match
             v3-3 incl. Compatible Asset Type + Category quick-adds and the two
             date columns) plus the four row actions. The **Used / Assign**
             modal additionally offers a "Used For Asset" picker - compatible
             assets (matching the part's Asset Type) listed first - which
             records `assetBaseId` (the PERMANENT `amsAssetId` link) and
             `assetIdSnapshot` (the display ID at the time) into
             `AMS_DUMMY_SPAREPART_LOG`; the Assign/Used report shows a
             "Used For Asset" column. `pages/spare-parts.html` rebuilt on the
             `masters.html` shell with `modalRestock`, `modalUsed`,
             `modalStockReport`.
             Verified: `/tmp/opencode/amstest/test-spare-parts.js` (table +
             low-stock badge, restock qty/date/log, compatible-asset grouping,
             permanent-link + snapshot logging, over-use guard, scoped report
             with asset column, add-via-engine with auto `SP-` ID).
- [x] 6C. Verify. -> full regression (test.js/test2.js/test3.js/test4.js/
          test-master.js/test-assets.js/test-consumables.js/test-spare-parts.js)
          all pass.

## Print-form reconciliation (Asset Issue / Assign / Exit Handover)

Port fix applied after Phase 5 while reconciling the three print forms:

- [x] Shared print engine `js/print-docs.js` (`amsPrintDocument(content, pageTitle)`
      opens a blank tab, writes one shared `.pf-*` A4 stylesheet, `win.print()`;
      guards against popup-block). All self-contained hardcoded styles live here.
- [x] `js/assets.js` Asset Issue Form now goes through the shared engine
      (per-asset, Assigned-only).
- [x] `js/print-forms.js` rewritten: `amsGenerateReport(amsId, type, extraRemarks)`
      -> `type:"assign"` = **Asset Issue Form** (AIF, live data for Active
      employees, subordinate assets reference table, "Issued By" signature),
      `type:"exit"` = **Asset Handover Form** (AHF, from the immutable exit
      snapshot, clearance checklist, "Received By" signature). Exit forms also
      print the **Exit Reason** and the **New Incharge / HOD** + the transferred
      subordinate/team assets section. `AIF-`/`AHF-` numbers via
      `amsGenerateFormNo`; letterhead via `amsGetCompanyDetails()`.
- [x] `js/dummy-data.js`: `exitEmployee()` snapshots held assets + disabled
      facilities into `AMS_DUMMY_EXIT_RECORDS` (exitId `EXIT-#####`) before
      releasing assets back to store; `getExitRecord(amsId)` reads it back.
      `exitEmployee()` now also accepts an optional **Reason of Exit** and a
      **teamInchargeAmsId** - direct subordinates are re-pointed to the new
      Incharge/HOD and the transfer (person + their asset list) is snapshotted
      for the Handover Form.
- [x] `pages/employees.html`: old asset-picker modals removed; the pre-print
      `modalPrintRemarks` step has been **removed** - "Assign Report" and
      "Exit Report" print directly. The Exit modal now has a dedicated
      **Reason of Exit** select and, when the exiting employee has direct
      subordinates holding assets, a mandatory **New Incharge / HOD** picker.
- [x] Verified: `test.js`, `test3.js`, `test4.js`, `test-assets.js`,
      `printcheck.js` all pass (direct-print flow).

## Phase 7 - Employee Master extras (from v3-3)

- [x] 7A. Immutable Exit Record snapshot on employee exit.
          -> done as part of the print reconciliation (see above):
             `exitEmployee()` snapshots assets + facilities into
             `AMS_DUMMY_EXIT_RECORDS`; the Exit Report (AHF) reads it.
- [x] 7B. Mandatory HOD reassignment check on exit (assets must have a new custodian).
          -> when the exiting employee has direct subordinates holding assets,
             the Exit modal requires a **New Incharge / HOD**; the subordinates'
             reporting line is re-pointed and the transfer (person + their
             assets) is snapshotted onto the printed Handover Form.
- [x] 7C. Import / Export CSV.
- [x] 7D. Verify.

## Phase 8 - Reports

- [x] 8A. Report Master page (Asset Lifecycle, Issue / Handover reports).
          -> Ported from v3-3 `reports-master-v1-0.html` to `pages/reports.html`
          + `js/reports.js` + `css/reports.css`. Seven tabs: Asset Lifecycle
          (every asset-history event with Type/Site/Date filters), Asset Issue
          Form (active employees holding assets, click-to-print the AIF),
          Asset Handover Form (exited employees, click-to-print the AHF),
          Consumable Restock / Used, Spare Parts Restock / Used (all items, not
          one row at a time; Used reports show the "Used For Asset" column when
          the log carries an `assetIdSnapshot`). Adapted to the v4-0 data model:
          reads `DUMMY_ASSETS[].history[]` / `DUMMY_EMPLOYEES` (join via amsId) /
          `AMS_DUMMY_CONSUMABLE_LOG` / `AMS_DUMMY_SPAREPART_LOG`; classifies the
          v4-0 history action strings ("Assign"/"Assigned - New"/"Reassigned"/
          "Return(ed)"/"Transferred to ..."/"Replaced by ..."/"Added to
          Inventory (Replacement ...)"/"Retired / Scrapped"/"Not Working").
          Issue/Handover deep-links call `amsGenerateReport()` (js/print-forms.js)
          directly instead of navigating to the Employee Master; print goes
          through the shared js/print-docs.js letterhead engine.
- [x] 8B. Export CSV + Excel from every report.
          -> Every panel has Print / Export CSV / Export Excel (the "HTML table
          as .xls" trick - no external library). Verified: CSV capture test.
- [x] 8C. Verify.
          -> `/tmp/opencode/amstest/test-reports.js` passes (7 tabs render,
          10 lifecycle rows / 8 Assign / 1 Return / 1 Fault, 7 issue rows,
          handover empty-state, stock-log tables, tab switching, deep-link
          wiring, CSV export).

## Phase 9 - Final Integration & Cleanup

- [x] 9A. Add remaining masters (User Master, Accessory Master, etc.) if applicable.
          -> **System Administrator hub** (v3-3 `system-admin-master-v1-0.html`
             port): `pages/system-admin.html` + `js/system-admin.js` +
             `css/system-admin.css`. Tabs (Company, Asset Type, Category, Make,
             Site, Department, Designation, Accessory) lazy-load an iframe with
             `?embed=1` (`AMS_ADMIN_TABS` map; embed support in `js/embed-mode.js`
             + `css/embed-mode.css` hides sidebar/topbar). Default tab = Company.
             Verified: `/tmp/opencode/amstest/test-system-admin.js` (tab map,
             tab switch re-navigates iframe with correct `?embed=1` vs `&embed=1`,
             active-tab toggling, sidebar links rewired).
          -> **Company Master** built: see Phase 4B above.
          -> **Accessory Master** built (Phase 6 follow-up): `pages/accessories.html`
             is a config-only page over the generic engine - auto `accCode`
             (ACC-000001.., `AMS_ACC_SEQ` counter), import matched by
             Name+AssetType, Asset Type quick-add, and `usageCount` that blocks
             delete while any asset of that type has the accessory issued
             (feed into the Assign/Reassign/Replace checklists via
             `amsGetAccessoryOptions()`). Verified:
             `/tmp/opencode/amstest/test-accessories.js` (24 rows render,
             add-via-engine -> ACC-000025, same-name-different-type works,
             in-use accessory delete blocked / unused deleted).
          -> **User Master** built: `pages/user-master.html` is a config-only
             page over the generic engine with no password field (dummy data
             only). Fields: username, Linked Employee (Active employees only,
             via `DUMMY_EMPLOYEES` + `getEmployeeFullName`), Role (badged,
             options gated by the topbar "Viewing As" simulator), Email,
             Remarks. Delete guards: Supreme Root accounts never deletable;
             Super Root accounts only deletable while viewing as Supreme Root;
             a role-hint bar stays in sync with the `#viewing-as` selector.
             Verified: `/tmp/opencode/amstest/test-user-master.js` (6 rows +
             2 root badges render, guards flip with the viewing role, Supreme
             Root option hidden/offered correctly, add -> 7 rows).
- [x] 9B. Wire everything into `layout.js` / `PAGE_TITLES` / dashboard KPIs.
          -> `layout.js` NAV_ITEMS: lookup masters removed from the sidebar;
             Admin section now has System Administrator (hub) + User Master;
             `ICONS.systemAdmin` / `ICONS.people`; page-title registry gained
             `system-admin` / `company` / `user-master` / `access-rights` /
             `role-access` / `log`.
- [x] 9C. Full regression: run all jsdom smoke tests.
          -> 16/16 suites pass: test, test2, test3, test4, test-master,
             test-assets, test-consumables, test-spare-parts, test-accessories,
             test-system-admin, test-company, test-user-master, test-reports,
             test-access-rights, test-role-access, test-log-report.
- [ ] 9D. Review naming/CSS-variable reconciliation for any stragglers.
- [ ] 9E. Confirm with user before considering the merge complete.

## Phase 10 - Vendor Master

- [x] 10A. Vendor data model + page.
          -> `AMS_DUMMY_VENDORS` (12 seed entries) + `AMS_VENDOR_CATEGORIES`
             added in `js/dummy-data.js` §8b. Every seeded vendor name is one
             already referenced somewhere in the portal data (assets,
             consumables, spare parts) so existing records link back. The
             config-only page `pages/vendors.html` uses the generic
             `js/master-table.js` engine: fields = Vendor Name (required, unique
             key), Contact Person, Phone, Email, City, Supplies (select),
             GSTIN (auto-uppercased), Remarks. `usageCount` sums references
             across `DUMMY_ASSETS` + `AMS_DUMMY_CONSUMABLES` +
             `AMS_DUMMY_SPARE_PARTS` (shown as "Used By") and blocks delete
             while in use.
- [x] 10B. Vendor datalist feeds the portal forms.
          -> `amsGetActiveVendorNames()` + `amsPopulateVendorDatalists()` in
             `js/dummy-data.js`; a shared `<datalist id="ams-vendor-list">` is
             added to the Asset page (`#fVendor`, `#replVendor`) and the
             Consumable / Spare Parts Restock modals (`#restockVendor`), so a
             vendor added/renamed on the master shows up as a suggestion there
             without a reload.
             NOTE: superseded by Phase 12F - the datalist fields became
             `<select class="ams-vendor-select">` + quick-add; the
             `amsPopulateVendorDatalists()` helper and `ams-vendor-list`
             datalist were removed from the codebase.
- [x] 10C. Wire into the System Administrator hub.
          -> `vendors: "vendors.html"` added to `AMS_ADMIN_TABS` + a
             "Vendor Master" tab button in `pages/system-admin.html`.
- [x] 10D. Verify.
          -> `/tmp/opencode/amstest/test-vendors.js` (20 checks) passes:
             12 rows render, used-by counts (Dell=3 / Om Traders=3 /
             Lenovo=1 / unused=0), add via engine (8 fields), duplicate-name
             rejected, in-use delete blocked / unused delete allowed,
             active toggle, search filter, datalist population, CSV export.
              Full regression (20/20 suites) still green.

---

## Phase 11 - Bulk CSV hardening (Dashboard cleanup + Template/Import/Export completeness & uniqueness)

- [x] 11A. Dashboard cleanup.
          -> `index.html`: quick-actions strip removed - the "Add Asset" and
             "Export" buttons no longer appear on the dashboard. No JS
             references remain; only an orphaned `.quick-actions` CSS rule is
             left in `css/main.css`.
- [x] 11B. Employee Template / Export now mirror the Add-Employee form.
          -> `EMP_CSV_HEADERS` = `empId*, firstName*, middleName, lastName*,
             dept*, designation*, reportsTo, managerId, contact, email, status`.
             `reportsTo` carries the manager's company Employee ID and
             `managerId` the manager's AMS ID (the auto-filled field on the
             form); the template marks every required form field with `*` and
             the export writes per-field values (no more merged `name` column).
- [x] 11C. Employee import uniqueness + per-row Import Report.
          -> `amsImportEmployeesFile` now validates required fields (empId,
             firstName, lastName, dept, designation), enforces `empId` unique
             against `DUMMY_EMPLOYEES` AND within the file, resolves the
             manager by reportsTo/managerId, and rejects invalid
             Departments/Managers. Instead of the one-line banner it shows a
             structured Import Report modal - Total / Added / Updated / Skipped
             / Error chips plus a per-row table with reasons.
- [x] 11D. Shared Import Report modal (`amsShowImportReport` in `js/dummy-data.js`).
          -> Built on the fly (no page markup), theme-variable only, reused by
             every importer. Callers: employee import, asset import, and the
             generic master-table engine.
- [x] 11E. Asset import hardened.
          -> `AST_IMPORT_HEADERS` now marks `category*` required (matching the
             form); import validates Category against the Category Master,
             rejects within-file duplicate `displayId`s, and reports per-row
             results (invalid Type/Category/Site are skipped with reasons).
- [x] 11F. Master-table engine import hardened.
          -> `amsHandleImportFile` (powers Department / Designation / Asset
             Type / Category / Site / Location / User / Vendor / Consumable /
             Spare Part / Accessory masters) now detects within-file duplicate
             identities (idKey or importMatchKeys), reports missing-required
             and missing-identity rows per-row, and opens the shared Import
             Report modal. Required-field `*` marking and the instruction row
             were already in place.
- [x] 11G. Verify.
          -> New/updated checks: empcheck.js (new header format, in-file + 
             system empId duplicate rejection, missing-required rejection,
             report modal), test-assets.js (invalid category skip, in-file dup
             displayId), test-master.js (in-file dup department, mini-report).
             Full regression (20/20 suites) still green.

---

## Phase 12 - UX round 2 (manager ID, import report tools, asset chart/paging,
          Action buttons, vendor picker + quick-add)

- [x] 12A. Reporting Manager ID shows only the company ID.
          -> `onManagerChange()` in `js/employees.js` now fills the read-only
             "Reporting Manager ID" field with the manager's company Employee
             ID (e.g. "00609") instead of the full `EMP-ADM-000001 (00609)`.
             The full AMS ID stays in the hidden select value and is what is
             actually saved. Edit-modal fill updated to match.
- [x] 12B. Import Report gets a Download button.
          -> `amsShowImportReport()` (js/dummy-data.js) adds a "Download
             Report" footer button that exports the per-row results
             (Row / Record / Result / Reason) as `Import_Report.csv`. Works for
             every importer (employee, asset, master-table engine).
- [x] 12C. Supreme Root can add missing Department / Designation from the
             Import Report.
          -> Imported rows with a Department/Designation not in the master are
             skipped and tagged (`missingDept` / `missingDesig`). For Supreme
             Root only, the report shows a "Missing lookups from this file"
             panel: Designation adds in one click; Department opens an inline
             shortform editor (auto-suggested, used inside AMS Employee IDs).
             Both write to the shared arrays so a re-import picks them up.
- [x] 12D. Asset: Stock by Asset Type is a compact bar chart + paginated list.
          -> `renderAssetStockSummary()` renders each type as a horizontal
             stacked bar (In Stock green / Used amber / Retired red) with a
             legend and compact cells. The Asset list now defaults to 20 rows
             with a scrollable container (`#assetTableWrap`) and a "Showing X
             of Y" footer with Show More / Show Less (`AST_TABLE_PAGE_SIZE`).
             Search/status-filter/toggle resets the page size.
- [x] 12E. Three-dot menus replaced with "Actions" buttons everywhere.
          -> The `&#8942;` triggers in `js/assets.js` and `js/master-table.js`
             (covers Asset + every engine master: Department, Designation,
             Asset Type/Category/Make/Site, User, Vendor, Consumable, Spare
             Part, Accessory) now render "Actions &#9662;" like the Employee
             page. `.actions-trigger` styled as a labelled button in
             `css/assets.css` + `css/master-table.css`.
- [x] 12F. Vendor fields become a pick-list + quick-add (+) button.
          -> `#fVendor` / `#replVendor` (Assets) and `#restockVendor`
             (Consumables / Spare Parts) changed from free-text datalists to
             `<select class="ams-vendor-select">` populated by
             `amsPopulateVendorSelects()` (preserves values no longer in the
             master). A shared "+" popover (`amsWireVendorQuickAdds()`, built
             on the fly in js/dummy-data.js) adds a vendor with name + contact
             / phone / email / city and selects it immediately. Shared
             `.select-with-add` / `.btn-quickadd` / `.quickadd-popover` styles
             moved into `css/main.css` so the engine pages get them too.
- [x] 12G. Verify.
          -> Updated: empcheck.js (company-only manager ID, report download,
             Supreme-Root quick-add of Department/Designation), test-assets.js
             (paging + chart bars + vendor quick-add + custom vendor preserved
             on edit), consumables/spare-parts restock flow (vendor select
             refresh). Full regression (21/21 suites) still green.
- [x] 12H. Vendor pick-list also in the Consumable / Spare Parts Add-Edit modal.
          -> Feedback found the Consumable & Spare Parts master-table Add/Edit
             modal still had a free-text Vendor field, unlike Assets. The
             generic engine now supports optional pick-list fields
             (`includeBlank` renders a "(None - optional)" first option) and
             `amsMtEnsureOption()` preserves a value no longer present in the
             master when editing. Both configs' `vendor` field became
             `type: "select"` + `includeBlank` + `optionsFrom:
             amsGetActiveVendorNames()` + a 5-field quick-add that creates the
             vendor (VEN-xxxxxx) and selects it, matching the Restock modal and
             the Assets page. Tests: test-consumables.js + test-spare-parts.js
             gained section 7 (select + blank + options + (+) popover +
             create/select + legacy preserved on edit). Full regression
             (21/21 suites) still green.
- [x] 13. Settings page (the last unchecked roadmap item).
           -> `pages/settings.html` replaced the placeholder with a 4-tab portal
              preferences hub + `js/settings.js` + `css/settings.css`:
                Appearance - theme gallery (11 cards, each carrying its own
                  `data-theme` so themes.css' plain `[data-theme=...]` selectors
                  give a live CSS-var preview; click applies via `applyTheme`)
                  + font size sm/md/lg (`data-font-size` attr + `main.css`
                  overrides on `html`, 14/16/18px).
                General - portal name saved to `ams_portal_name` and reflected
                  in the sidebar brand (layout.js reads `amsGetPortalName()`);
                  default list page size saved to `ams_page_size` and wired into
                  the Asset table (`AST_TABLE_PAGE_SIZE` reads
                  `amsGetDefaultPageSize()`, default 20, tests unchanged);
                  currency note (₹ en-IN).
                Notifications - toast popup toggle (`amsGet/SetToastEnabled`
                  gates `amsToast`; history still records), Clear bell /
                  activity log (use `amsToast` so a clear does not re-log
                  itself), live counts.
                Data - "Viewing As" role shortcut + Reset Demo Data
                  (`amsResetDemoData()` wipes every ams_* localStorage key;
                  in-memory seeds return on reload).
              Shared helpers live in dummy-data.js (portal preferences section)
              so every page can apply them; `initLayout` now calls
              `amsApplyPortalPrefs()`. New `test-settings.js` (7 sections: shell,
              gallery apply+persist, font size, general/page size, toast gate,
              clear counts, viewing-as/reset). Full regression 22/22 green.

## Phase 14 - Report Header & Assign-Other fixes

- [x] 14A. Company Master gains Slogan + rectangular banner image.
           -> `AMS_DUMMY_COMPANY_DETAILS` (js/dummy-data.js) adds `slogan` and
              `bannerDataUrl`. `pages/company.html` + `js/company.js` +
              `css/company.css` add a Slogan input and a banner upload row
              (`#bannerPreview` 320x80, `#btnChooseBanner` via hidden
              `#bannerFileInput`, `#btnRemoveBanner`); `CM_STATE.bannerDataUrl`
              round-trips through load/save under `ams_company_details`. Uses a
              generic `amsWireImageUpload()` so future image fields can reuse it.
- [x] 14B. Report Appearance editor on the Reports page.
           -> `pages/reports.html` + `js/reports.js` + `css/reports.css` add a
              toggle button + collapsible panel: header-style radios
              (classic / banner), show-toggles for logo / name / slogan /
              address, and a live white-paper preview. Persisted to
              `ams_report_header_prefs` (`AMS_REPORT_HEADER_STORAGE_KEY`) via
              `amsSaveReportHeaderPrefs()`; `amsResetDemoData()` wipes it.
- [x] 14C. Shared letterhead engine.
           -> `js/print-docs.js` gains `amsBuildPrintHeader(title, metaHtml,
              fallbackSubtitle)` - banner style when `prefs.style==="banner"`
              and a banner is uploaded, else classic; honours all four
              show-toggles. Replaces the three duplicated inline letterheads
              (print-forms.js, assets.js, reports.js), so Company Master +
              Report Appearance changes apply to every printable form.
- [x] 14D. Assign/Reassign free-text Subordinate / Department fix.
           -> Subordinate select gains "Other / Not in User Master..." and the
              Department select gains "Other / Not in Department Master...",
              each revealing a free-text input (`#assignSubText` /
              `#assignDeptText`). `amsConfirmAssign` stores free text ONLY in
              `assignedSubText` / `assignedDeptText` (never in `assignedTo`,
              which still requires a real User Master entry). The Direct
              dropdown contains only real active employees. New helpers in
              dummy-data.js: `amsAssetIsDeptOrSub()`, `amsAssetHolderLabel()`,
              `amsSplitDirectVsSubordinateAssets()`. Asset table "Assigned To"
              and View modal display the typed names; every reset/return/
              transfer/import/replace path clears the two fields (replace
              inherits them).
- [x] 14E. Printable Asset Issue Form reflects the fix.
           -> `js/print-forms.js` (and the assets.js print) split assets via
              `amsSplitDirectVsSubordinateAssets()`: the "Assets Issued" table,
              Remarks and footer count use only direct personal-issue assets,
              while "Assets Currently Assigned to Subordinates (For Reference)"
              merges subordinate records with free-text / dept-holder assets
              (holder label via `amsAssetHolderLabel()`, Employee ID "-" for
              free text).
- [x] 14F. Verify.
           -> New suites: `test-report-appearance.js` (company slogan/banner
              round-trip, classic header content, hide-toggles, banner + fallback,
              UI load/persist, reset restores defaults) and
              `test-assign-other.js` (free-text subordinate AND dept stored in
              `assignedSubText`/`assignedDeptText` with `assignedTo` untouched,
              split helper, issue-form print routes holder assets ONLY to the
              reference section, reassign restores the typed values, return
              clears them). Full regression still green (18/18 core suites).
- [x] 14G. Recheck Reports AIF + AHF end-to-end (second pass, per user request).
           -> New suite `test-reports-forms.js` generates the ACTUAL printable
              output from the Reports page via `amsGenerateReport`:
                - AIF with injected free-text subordinate AND free-text dept
                  assets for a seeded employee: both appear in "Assets Currently
                  Assigned to Subordinates (For Reference)" only (1 occurrence
                  each), the direct "Assets Issued" table keeps only personal-use
                  assets, holder names print, footer counts only direct assets,
                  classic letterhead renders logo + name.
                - AIF for the seed subordinate-held asset (LT00012SLPS) routes it
                  to the reference section only, with the subordinate Employee ID.
                - AHF after `exitEmployee`: reads the exit snapshot, renders
                  "Assets Returned (Direct Assignment Only)" + exit date / reason
                  / Clearance Checklist, footer counts snapshot assets.
                - AIF honours the banner Report Appearance (full-width
                  `pf-header-banner`) when a banner is uploaded.
           Findings: no app defects - the earlier three failures were test-
           expectation bugs (EMP-IT-000001 holds 2 seed direct assets, and the
           print CSS always contains the `.pf-company-block` selector regardless
           of the active layout). Full regression 21/21 suites green.
- [x] 14H. Fix: HOD/main-user assets wrongly routed to the reference section.
           -> User reported: Arjun Prakash Mehta (Production HOD) "Owned: 1 /
              Team: 1", yet his Asset Issue Form showed NO row in "Assets
              Issued" and TWO rows in "Assets Currently Assigned to
              Subordinates (For Reference)" - one of which was his OWN directly
              issued asset (LT00012SLPS, whose ACTUAL USER is his subordinate
              Suresh via the master field `assignedToSubordinate`).
              Root cause: `amsAssetIsDeptOrSub()` treated MASTER sub/department
              records (`assignedToSubordinate` / `assignedDepartment`) the same
              as FREE-TEXT holders, so a formally assigned asset was pulled out
              of "Assets Issued".
              Fix: the classifier now only routes FREE-TEXT holders
              (`assignedSubText` / `assignedDeptText` - parties not in the User/
              Department masters) to the reference section. Assets whose actual
              user is a User/Department MASTER record remain in "Assets Issued"
              (the asset is directly issued to the employee; the master record
              is a sub-record of that assignment). Applied at the shared
              classifier (`js/dummy-data.js`) so Assets page, Reports page and
              Employee Assign Report all agree. Also aligned print-forms.js
              Remarks to use the direct list like assets.js already did.
              Tests updated: test-assign-other.js (split keeps master sub/dept
              records direct), test-reports-forms.js (Arjun's LT00012SLPS now
              asserted in "Assets Issued", reference lists only Suresh's own
              PC00019PNIT, footer counts 1). Full regression 21/21 suites green.
- [x] 14I. Assets-page AIF confirmed; Department column removed from prints.
           -> User asked to confirm the Assets -> Actions -> Asset Issue Form
              path behaves like the Reports one (it shares the same shared
              classifier + split, so it does): all assets assigned directly to
              the employee stay in "Assets Issued" and his subordinates' assets
              appear under "Assets Currently Assigned to Subordinates (For
              Reference)". Verified with the Assets-page print: Imran's 2 seed
              direct assets (LT00007HOIT + MN00045SLIT) both appear in "Assets
              Issued" while a free-text-holder asset is reference-only.
              Also removed the redundant Department column from the "Assets
              Issued" table (Assets page + Reports page AIF) and the "Assets
              Returned (Direct Assignment Only)" table (AHF) in `js/assets.js`
              and `js/print-forms.js` - the Actual/Direct User department is
              already shown in the "Issued To" / "Employee Details (Exiting)"
              info boxes, so printing it again per-row was duplicate.
              Tables are now: # / Asset ID / Asset Name+Type / Site / Condition
              (colspan adjusted 6->5 for the empty state). Tests updated:
               test-assign-other.js + test-reports-forms.js assert all direct
               assets are listed and no `<th>Department</th>` appears in the
               printed AIF/AHF. Full regression 21/21 suites green.
- [x] 14J. Assets-page AIF: Department/Use assets route to reference; AHF gets
           an Exit Reason writing line.
           -> User reported two remaining issues: (1) the Assets-page Asset
              Issue Form again listed, under "Assets Issued", assets assigned
              to a Department/Use via the "Actual Usage / Team Details
              (Optional)" (`usageNote`) field - the same "assigned to the user
              directly" confusion the Employee "Assign to Team" fix solved for
              free-text holders; (2) the Asset Handover Form's Exit Reason had
              no blank writing line beneath it.
              Fixes:
                - `amsAssetIsDeptOrSub()` (`js/dummy-data.js`) now also returns
                  true for assets carrying a `usageNote`, so the shared split
                  (`amsSplitDirectVsSubordinateAssets`) routes Department/Use
                  assets OUT of "Assets Issued" into "Assets Currently Assigned
                  to Subordinates (For Reference)" on both the Assets page and
                  the Reports page AIF. `amsAssetHolderLabel()` falls back to the
                  usage note as the reference "Held By" text. The Assets table's
                  "Assigned To" column shows the note too (`Employee -> note`).
                  Master sub/dept records still stay in "Assets Issued" (14H).
                - `js/print-forms.js` AHF "Employee Details (Exiting)": Exit
                  Reason moved to a full-width box (`.pf-box pf-box-wide`) with
                  the reason value followed by a ruled `.pf-box-line` writing
                  line; the cols-2 grid now carries New Incharge/HOD on its own
                  row so the section reads cleanly. CSS added in
                  `js/print-docs.js` (`.pf-box-wide`, `.pf-box-line`).
              Tests updated: test-assign-other.js (split now expects usageNote
              holders in reference; new UI test assigns with only a usage note
              and asserts reference-only routing + holder label fallback),
              test-reports-forms.js (AIF round adds a usageNote asset - 1x in
              reference, note printed as holder; AHF round asserts the Exit
              Reason full-width box + ruled line after the reason value). Full
              regression 21/21 suites green.
- [x] 14J2. Handover Form signature order swap.
           -> User requested: in the Exit Report (Asset Handover Form), swap the
              "Employee" and "Authorised By" signature boxes. The shared sign
              grid in `js/print-forms.js` is now conditional on form type: the
              AIF keeps "Authorised By | Issued By (IT/Admin) | Employee", while
              the AHF renders "Employee | Received By (IT/Admin) | Authorised
              By". test-reports-forms.js asserts both orders. Full regression
              21/21 suites green.

## Phase 15 - SQL Server / ASP.NET Core migration (AMS-TEST)  (IN PROGRESS)

**Why AMS-Backup vs AMS-Test:** the whole v4-0 project (with every seed record
and the 14A-14J2 print fixes) is preserved unchanged as `AMS-Backup`. `AMS-Test`
is the live-testing copy that now talks to a real SQL Server database through a
C#/ASP.NET Core Web API, instead of serving from dummy arrays.

User choices for this phase: **backend = C# / ASP.NET Core Web API**;
**database starts empty, no seed** (beyond the one login account); **migration
scope = everything at once** (all pages).

### 15.1 Architecture decisions
- **Two projects** at the repo root: `AMS-Backup` (immutable reference, all
  dummy data intact) and `AMS-Test` (the live app being migrated).
- **API**: `AMS-Test/server/AMS.API` - ASP.NET Core (net8.0), JWT Bearer auth,
  CORS enabled, and it ALSO serves the AMS-Test frontend from the project root
  (same origin - the user opens ONE URL, no CORS pain, no separate static host).
- **Storage**: business data is kept as **JSON documents** in a single
  `dbo.ams_collections` table (`collection_key` PK + `data_json` NVARCHAR(MAX) +
  `updated_at`). The frontend PUTs each collection wholesale whenever the
  in-memory array changes. `dbo.ams_users` stays **relational** (username PK,
  password hash/salt, role, active) because login is security-critical.
- **Auth**: JWT (HMAC-SHA256). Session stored in localStorage under
  `ams_session`; any 401 clears the session and redirects to `login.html`.
- **Database init is idempotent in THREE layers**: `database/AMS-TEST.sql`,
  `database/Setup-AMS-TEST.bat` (locates sqlcmd, probes instances), and the
  API's `AmsDb.InitializeAsync()` (best-effort CREATE DATABASE + schema +
  seed upsert). The API re-hashes the seed account every startup, so the login
  always works even if the .bat ran first.

### 15.2 Login account (delivered to the user this round)
| Field | Value |
|-------|-------|
| username | `operator.sys` |
| password | `Sr#Ops@2026` |
| role     | Supreme Root |
| remark   | Portal account (looks like a low-level operator login, but holds Supreme Root rights) |

The username deliberately does NOT contain "dummy"/"test" - it presents as a
normal low-level operator login while actually holding Supreme Root rights.

### 15.3 Files
- `server/AMS.API/Program.cs` - JWT + CORS + serves frontend + health endpoint.
- `server/AMS.API/Data/AmsDb.cs` - idempotent DB/schema/seed init, PBKDF2-SHA256
  (100k iterations) password hashing, `FixedTimeEquals` verification, JSON
  document storage + user CRUD.
- `server/AMS.API/Controllers/AuthController.cs` - POST /api/auth/login,
  GET /api/auth/me.
- `server/AMS.API/Controllers/CollectionsController.cs` - GET/PUT/DELETE
  /api/collection/{key} (authorized; PUT accepts array OR object).
- `database/AMS-TEST.sql` + `database/Setup-AMS-TEST.bat` - manual SSMS / sqlcmd
  setup (bat had a missing `setlocal EnableDelayedExpansion` bug - fixed).
- `login.html` + `js/login.js` - sign-in gate for the live portal.
- `js/dummy-data.js` - **DB/API layer block at the top**: `ams_api_base`,
  session helpers, `amsApiFetch` (+401 handling), `AMS_COLLECTIONS` /
  `AMS_DOC_COLLECTIONS` registries, `amsDbLoadAll` / `amsDbSave` /
  `amsDbSaveDoc` / fire-and-forget async variants. The 17 master/page arrays
  are emptied (no seed) and refilled from the API on load.
- All page modules (`js/master-table.js`, `assets.js`, `employees.js`,
  `consumables.js`, `spare-parts.js`, `reports.js`, `access-rights.js`,
  `role-access.js`, `company.js`, `dashboard.js`, `system-admin.js`,
  `login.js`) - every mutation now persists via `amsDbSaveAsync(...)`, and
  every page's init awaits `amsDbEnsureLoaded()` before first render.
- `js/layout.js` - session gate (`amsRequireSession` -> redirect to
  `login.html`) + user chip shows the signed-in name.

### 15.4 Regression status
- The 21-suite regression is GREEN against `Asset_Management_System_v4-0`
  (last run for 14J2). It still needs an AMS-Test variant: the tests assert the
  old SEED data which AMS-Test no longer carries (empty DB). TODO next step.

### 15.5 User's Windows steps (after this phase is verified)
1. Run `database\Setup-AMS-TEST.bat` (or let the API auto-create the DB).
2. Confirm `server\AMS.API\appsettings.json` ConnectionStrings:Default matches
   the local instance (default `Server=.\SQLEXPRESS;Database=AMS-TEST;...`).
3. `cd server\AMS.API && dotnet run` - serves the UI + API on one URL.
4. Log in with `operator.sys` / `Sr#Ops@2026`.

### 15.6 New-feature round (real login accounts, profile, live activity)
The "6 new features" request is implemented. Summary of what changed and why:

| Feature | Implementation |
|---------|----------------|
| 1. Logout + user menu | Topbar user chip is now a dropdown (`#user-chip-menu`) with **My Profile** + **Logout**; `amsLogout()` clears the session/role override and redirects to `login.html`. |
| 2. Real dashboard activity | `index.html` banner + "Dummy data" label removed; `dashboard.js` renders the real stored activity log via `amsGetActivityLog()` (times via `amsTimeAgo`, actor role badges, type-coloured icons) and the welcome heading is dynamic ("Welcome back, {display name}"). |
| 3. `testadmin` seed account | New **Super Root** account `testadmin` / `Admin@#$12345`, display name "Test Admin". Seeded/re-hashed idempotently on API startup alongside `operator.sys` so end users never need the Supreme Root login. |
| 4. User Master passwords | `master-table.js` supports `type:"password"` fields (hidden in table, never rendered back on edit, never stored in the local copy) plus `onBeforeSave` / `onBeforeToggle` / `onBeforeDelete` hooks that sync to `POST/PUT/DELETE /api/auth/users`. New users now get real login accounts. |
| 5. Actions-menu overlay | `.table-wrap` is lifted to `overflow:visible` (`.mt-menu-open`) while a row menu is open so the dropdown overlays the table frame instead of being clipped / spawning a scrollbar. |
| 6. Display name in chip | Topbar chip shows `displayName` (falling back to linked employee, then username); populated from login/me + refreshed on profile save. |

Role simulator removed: `amsGetViewingAsRole()` now resolves to the real session
role (the `ams_viewing_as_role` localStorage override is ignored/cleared), and
the per-page simulators on Settings, Role Access Master, Access Rights Master
and Log Report became read-only "Signed-in Role" inputs.

Profile page: `pages/profile.html` + `js/profile.js` reads `GET /api/auth/me`
(offline fallback to the stored session), saves profile fields + changes the
password via `PUT /api/auth/me` (current-password verified server-side), and
refreshes the stored session so the topbar chip updates immediately.

Login accounts now live in relational `dbo.ams_users` (with `display_name`,
`contact_no`, `address`, `dob`, `gender` columns); business data stays JSON in
`dbo.ams_collections`. User Master's local array still mirrors the account list
for the shared engine, but passwords never persist client-side.

---

### 15.7 Follow-up round (assign/reassign + report + UI cleanup)
Frontend-only polish following the 15.6 round. All changes are HTML/CSS/JS.

| Point | Change |
|-------|--------|
| 1. Profile appearance | `pages/profile.html` form controls switched from `.form-field` (a class styled only in `css/master-table.css`, which profile.html does not load) to the app-wide `.field` + `.input`/`.select`/`.textarea` convention (styled in `css/main.css`), so textboxes/selects/date/textareas render correctly. |
| 2. Assign/Reassign form cleanup | Removed the "Assign to Department" block (select + quick-add popover + free-text fallback) and the "Actual Usage / Team Details" textarea from the shared `#modalAssign` (`pages/assets.html`). Stripped `assignDept`/`assignDeptText`/`assignUsageNote` from `js/assets.js` populate/submit/other-toggles and removed the now-dead `amsWireDeptQuickAdd()`. The asset table + view modal + print remarks no longer show department/usage fields. |
| 3. Assign Report gating | `openIssueForm()` (`js/employees.js`) now refuses to generate an Assign Report when the employee holds no assets (direct or via subordinates), and the row's "Assign Report (Asset Issue Form)" menu item is rendered disabled (`.menu-disabled`) in that case. |
| 4. Employees actions cleanup | Removed the "Assign Asset" / "Reassign Asset" entries from the employee row Actions menu. The header "Assign Asset" button (`pages/employees.html`) remains the entry point for assigning; `openAssignModal`/`openReassignModal` still exist for it. |
| 5. Accessories in Issue Form | New shared `amsBuildPrintAccessoriesHtml()` (`js/dummy-data.js`) renders the accessories recorded on the issued assets as pre-checked blocks (labelled with the asset ID) in the "Accessories / Items Included" section of the Asset Issue Form, falling back to the old blank checklist when nothing is recorded. Used by both `js/assets.js` and `js/print-forms.js`. |
| 6. Dummy activity removed | Deleted the unused `DUMMY_ACTIVITY_LOG` and `AMS_DUMMY_ACTIVITY` arrays from `js/dummy-data.js`. The dashboard reads the real `amsGetActivityLog()`; the employee-exit event in `js/employees.js` now writes to the live audit log via `amsNotify()` instead of the removed dummy array. |
| 7. Actions-menu overlay everywhere | Ported the 15.6 master-table overflow fix to the Asset Master and Employee Master pages: `#assetTableWrap` (`css/assets.css`) and the shared `.table-wrap` (`css/main.css`) get `.mt-menu-open` (`overflow:visible`) while a row menu is open, synced by `amsSyncWrapOverflow()` (`js/assets.js`) / `amsSyncEmpMenuOverflow()` (`js/employees.js`). |

Regression status: all 15 `test-*-amstest.js` suites still pass, plus a new
`probe-points257.js` covering points 2-7. No backend changes; API build is
0 warnings / 0 errors.

---

### 15.8 Access + Issue-Form ID round

Frontend-only. Two user-reported fixes after 15.7.

| Point | Change |
|-------|--------|
| 1. No Access Denied wall for non-Supreme roles | The System Administrator hub (`js/system-admin.js`) now hides the Supreme-Root-exclusive tabs - "Access Rights Control Master" and "Role Access Master" - from every role except Supreme Root, and the "Log Report" tab from everyone below Super Root. So a Super Root never sees a button that leads to a lock-out. On the pages themselves (`js/access-rights.js`, `js/role-access.js`), a non-Supreme role opening them directly (e.g. typed URL) is redirected to the dashboard instead of being shown the old "Access Denied" card. |
| 2. Issue Form shows the full Smart Asset ID | New shared `amsPrintAssetId()` (`js/dummy-data.js`) returns the COMPUTED full ID (`amsComputeFullId()` = base + site + dept, e.g. `BKMP00001SLIT`) for live assigned assets, falling back to the stored id for snapshot records (exit reports). Both Issue Form generators now use it for the Asset ID column, subordinate rows, accessories labels and remarks headers: `js/print-forms.js` and `js/assets.js` (`amsGenerateAssetIssueFormPrint`), plus the accessories section in `js/dummy-data.js`. Previously they printed the stored `oa.id`, which could be an older base+site form (`BKMP00001SL`) without the department suffix. |

Regression status: all 15 `test-*-amstest.js` suites pass (the two role-gate
tests were updated: a non-Supreme role now gets no locked/unlocked view instead
of a shown Access Denied card), plus new `probe-newtasks.js` covering both
points. No backend changes; API build is 0 warnings / 0 errors.

---

### 15.9 SIM Card Master + Department/Designation sync round

Two new user requests delivered on top of 15.8. Frontend + one backend
whitelist entry (`CollectionsController` `AllowedKeys` gains `"simCards"`).

| Point | Change |
|-------|--------|
| 1. SIM Card Master page | New standalone record type `pages/sim-cards.html` + `js/sim-cards.js`, mirroring the Asset Master but tracking **mobile SIM cards** independently (the phone stays in the Asset Master). Auto SIM ID (`SIM-000001` …) via `amsNextSimId()`; ICCID/serial, mobile number, operator + plan pick-lists (`AMS_SIM_OPERATOR_OPTIONS`), status (In Store / Issued / Blocked / Retired via `AMS_SIM_STATUS_OPTIONS`), vendor quick-add, cost, activation date, remarks. Lifecycle actions assign/reassign/return/block/retire each write a history entry visible in the View modal; stock-summary tiles, search + status filter, CSV Template / Export / Import (mobileNumber required, status defaults to In Store, dates via `amsParseDMY`, existing SIMs updated by simId). Persists to the DB-backed `AMS_DUMMY_SIM_CARDS` collection via `amsDbSaveAsync("simCards")`; `AMS_COLLECTIONS` + server `AllowedKeys` updated so the generic save path works. |
| 2. Department / Designation Master sync fix | Departments/designations now stay in sync across the hardcoded seeds (`DEPARTMENTS` / `DESIGNATIONS`) and the DB-backed masters (`AMS_DUMMY_DEPARTMENTS` / `AMS_DESIGNATION_OPTIONS`). Root cause of the drop: the Import Report inline Add handlers pushed to both arrays but never called `amsDbSaveAsync`, so the value vanished on next page load (Masters read from SQL); and import validation only checked the const arrays, not the DB-backed ones. New shared helpers in `js/dummy-data.js`: `amsDeptKnown()` / `amsDesigKnown()` (union check), `amsEnsureDepartment(name, shortform)` and `amsEnsureDesignation(name)` (dedupe into both arrays + persist). Consumers now use them: Employee form quick-add + bulk import (`addEmployee()` registers the imported lookup into both masters), Import Report quick-add handlers (`[data-save-dept]`, `amsQuickAddDeptFromReport`, `amsQuickAddDesigFromReport`), Employee page `populateSelects()` + `allDeptOptions()` / `allDesigOptions()` union dropdowns, and the Asset Master quick-add employee pickers. |

Regression status: all 17 `test-*-amstest.js` suites pass (15 prior + new
`test-sim-cards-amstest.js` with 12 checks and `test-point2-amstest.js` with 5
checks). No SQL Server in the sandbox, so DB persistence was verified by
code-path analysis + the harness `saves[]` capture of `amsDbSaveAsync` calls.
API build is 0 warnings / 0 errors.

---

### 15.10 Lookup Master pages + relational SQL schema round

Two work streams delivered together. Frontend + a full `AmsDb.cs`/SQL rewrite.

| Point | Change |
|-------|--------|
| 1. Six new master pages | Every remaining hardcoded lookup list becomes a real, DB-backed master page reachable from System Admin (reusing the generic `master-table.js` engine via `masters.html?type=...`): **SIM Card Operator** (`sim-operator`), **SIM Plan** (`sim-plan`), **Consumable Category** (`consumable-category`), **Unit of Measure** (`unit-of-measure`), **Spare Part Category** (`spare-part-category`), **Vendor Category** (`vendor-category`). Each config in `js/master-configs.js` carries detail fields (e.g. helpline/website for operators, planType/description for plans) and `usageCount` guards. The SIM form's Operator/Plan fields now have "+" quick-add buttons (`.select-with-add`), and the SIM save auto-registers any typed operator/plan into its master (`amsEnsureSimOperator` / `amsEnsureSimPlan`) - the same pattern departments/designations already use. Consumables/spare-parts/vendors quick-adds now write through the master helpers too. |
| 2. Relational SQL schema | `database/AMS-TEST.sql` rewritten from a single JSON collector table into **one table per entity** (30+ tables, each with `row_id` IDENTITY, `record_key` PK, typed queryable columns, `data_json NVARCHAR(MAX)`, `updated_at`): `ams_users`/`ams_user_profiles`, lookup masters (`ams_asset_types`, `ams_asset_makes`, `ams_asset_categories`, `ams_sites`, `ams_departments`, `ams_designations`, `ams_accessories`, `ams_vendors`, `ams_sim_operators`, `ams_sim_plans`, `ams_consumable_categories`, `ams_consumable_units`, `ams_spare_part_categories`, `ams_vendor_categories`), business entities (`ams_assets`, `ams_employees`, `ams_consumables`, `ams_consumable_log`, `ams_spare_parts`, `ams_spare_part_log`, `ams_sim_cards`, `ams_exit_records`), and documents (`ams_company`, `ams_documents`). |
| 3. `AmsDb.cs` rewrite | Table-backed storage driven by a `TableDefs` registry mapping each collection key to a table + typed columns. `InitializeAsync` is idempotent: ensure DB → ensure schema (creates all per-entity tables + indexes + `ams_users` profile ALTERs) → re-hash/re-activate seed users → migrate legacy `ams_collections` rows (per-table, only into empty tables) → seed the 6 new lookups. Array collections are stored one row per record (wholesale replace = DELETE + re-INSERT in a transaction); document collections are single rows keyed by fixed keys. `ResolveRecordKey` maps per-collection JSON key fields (assets→`id`, employees→`amsId`, etc.) with GUID fallback for log records. The existing user/login CRUD surface is preserved. |
| 4. Seeded lookups | 5 SIM operators (Jio, Airtel, Vodafone Idea, BSNL, MTNL), 3 SIM plans (Prepaid, Postpaid, Corporate Plan), 5 consumable categories, 5 consumable units, 3 spare-part categories, 5 vendor categories - guarded by empty-table checks so they never clobber user data. |
| 5. Data-flow guarantee | Every table keeps a `data_json` column mirroring the record the frontend PUTs, so the frontend's whole-array `amsDbSaveAsync(key)` pattern works unchanged while the typed columns enable real SQL querying/indexing. |

Regression status: `.NET` API builds with **0 warnings / 0 errors** (SDK 10.0.400
installed in sandbox; `libicu` added). All edited JS files pass `node --check`.
API boots, serves the frontend, `/api/health` responds, unauthorized collection
access returns 401, and DB-init failure is handled gracefully. No SQL Server
instance exists in the sandbox, so live CRUD/migration was verified by code-path
analysis + build only; the rewritten `AmsDb.cs` compiles against the same
`Microsoft.Data.SqlClient` surface the API already used.

### 15.10.1 SQL execution-error fixes (user-run `AMS-TEST.sql` reported errors)

When the user first ran the rewritten script in SSMS/sqlcmd it reported a chain
of errors. Root cause analysis and fixes:

| Reported error | Root cause | Fix |
|----------------|-----------|-----|
| `Incorrect syntax near 'plan'` | `plan` is a T-SQL **reserved keyword** used unquoted as a column in `CREATE TABLE dbo.ams_sim_cards` (single broken statement). | Renamed the column to `plan_name` in `database/AMS-TEST.sql` and in `AmsDb.cs` DDL; `TableDef` mapping is now `C("plan_name", "plan")` so persistence is unchanged. Scanned every column name in the script against the reserved-words list - `plan` was the only violation. |
| `Incorrect syntax near '200'` / `'50'` / `'MAX'` / `')'` / `'record_key'` / `'GO'` | Cascade tokens from the same broken `CREATE TABLE ... ams_sim_cards` statement - not 8 separate schema bugs. | Resolved by the `plan_name` rename above. |
| `Column name 'status' does not exist in the target table or view` | `CREATE INDEX` ran against a pre-existing table created before `status` existed (partial/older run); the new DDL defines `status` on `ams_assets`, `ams_employees`, `ams_sim_cards`. | Every `CREATE INDEX` block (assets, employees, consumables, spare_parts, sim_cards) is now guarded by `IF COL_LENGTH(...) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ...)` in both the SQL script and `AmsDb.SchemaIndexesSql`. |
| `Could not locate entry in sysdatabases for database 'AMS-TEST'` | `CREATE DATABASE [AMS-TEST]` failed (e.g. login lacks the permission) but the script still ran `USE [AMS-TEST]`. | Added a `RAISERROR` guard after `CREATE DATABASE` that explains the permission/manual-creation options before the `USE`, so the cryptic error becomes self-explanatory. |
| `plan_name` on an already-created `ams_sim_cards` | A DB from the failed run may already have the old `plan` column. | Added idempotent migration in both the SQL script and `AmsDb.cs`: if `plan_name` is missing it is added; if only `plan` exists it is renamed via `sp_rename` (mirrors the existing `ams_users` profile-column ALTER pattern). |

Status: `.NET` build 0/0, all checks green, API smoke test (no SQL Server) passes
health/static/401 paths. Final proof requires re-running the fixed script in SSMS/sqlcmd.

### 15.10.2 Idempotence hardening (user re-ran a stale copy - index-exists errors)

A second user run reported `The index ... already exists` for 7 indexes **plus the
same `Incorrect syntax near 'plan'` errors** from round 15.10.1. The `plan` error
cannot come from the fixed file (the bare `plan` column was renamed to
`plan_name`), which proves the user executed a **stale copy** of the script
captured before 15.10.1's fixes. Regardless, the script and `AmsDb.cs` were
hardened so re-running over *any* prior partial DB state cannot fail:

| Fix | Detail |
|-----|--------|
| `CREATE INDEX` moved outside table-creation blocks | Each of the 9 indexes is now a standalone statement guarded by `IF OBJECT_ID(...) IS NOT NULL AND COL_LENGTH(...) IS NOT NULL AND NOT EXISTS (sys.indexes ...)`. Creating indexes outside the `IF OBJECT_ID IS NULL` block also lets a pre-existing table *gain* a missing index on re-run, instead of skipping it. |
| Idempotent `status`/`current_site` column `ALTER`s | Old tables missing the typed columns the indexes reference are upgraded with `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD ...` (assets `status`/`current_site`, employees `status`, sim_cards `status`), mirroring the existing `ams_users`/`plan_name` pattern - in both the SQL script and `AmsDb.cs`. |
| Why `plan` errors disappeared | The current script has zero bare `plan` references (only comments + `N'plan'` string literals in the `sp_rename` guard). The stale copy the user ran still had the unquoted `plan` column. |

Result: the fixed script is now safe to run on a fresh DB **and** on any
partially-created DB left by earlier failed runs. `dotnet build` 0/0, structure
balanced (26 `CREATE TABLE`, 32 `BEGIN`/`END`, 72 `GO` batches).

### 15.10.3 Bulk employee import: manager may be added later (two-pass import)

The CSV import previously **skipped** any employee whose reporting manager was
not already in the system, which broke bulk uploads of 200-400+ employees when a
manager appeared later in the same file or joined the company later.

| Change | Detail |
|--------|--------|
| Two-pass import | `amsImportEmployeesFile` (js/employees.js) now adds every valid row in PASS 1 (remembering unresolved manager references) and links managers in PASS 2 once all file employees exist - so a manager that appears *later in the same CSV* is linked. |
| Deferred manager auto-linking | Employees whose manager is still absent keep a `pendingManagerRef` (manager's empId or AMS ID). `amsResolvePendingManagers()` (js/dummy-data.js) fills in `managerAmsId` automatically and is invoked after every employee add/update, after import, and on page init - so a manager that "joins later" links to their reports with no manual editing. |
| No more false skip | Rows with an unknown manager are imported (status Added) with a report note instead of being Skipped/Error. |
| Self-reference guard | An employee can never be linked as their own manager. |

Verified: `node --check` clean on both files, API serves the updated JS, and a
Node simulation confirmed both scenarios (manager later in same file; manager
added next day) link correctly.

### 15.10.4 Manager referenced by full name now resolves

User report: a manager exists in the system, yet the employee "won't add" - e.g.
employee 00757 Ravikumar Rajendra Tiparadi has reporting manager 00589 Rajkumar
Mallikarjun Wagdari, and the CSV `reportsTo` cell holds the manager's **full
name** rather than their empId/AMS ID.

| Change | Detail |
|--------|--------|
| Root cause | `findEmployeeAny` (js/dummy-data.js) only matched `amsId`/`empId`, so a full-name `reportsTo` value never found the manager. |
| Name-aware lookup | `findEmployeeAny` now also matches `getEmployeeFullName(e)` - case-insensitive with whitespace normalized (`replace(/\s+/g," ")`), so first/middle/last records resolve from a full-name reference. |
| CSV template | `reportsTo` instructions now say the cell accepts the manager's empId, AMS ID, **or full name** (e.g. `Rajkumar Mallikarjun Wagdari`). |

Only manager-resolution callers use `findEmployeeAny`, so broadening it to name
matching is safe. Verified with a Node simulation of the exact reported case
(manager 00589 stored as First/Middle/Last; employee 00757 references it by full
name): PASS 1 finds the manager and links `managerAmsId` immediately.

### 15.10.5 Single Full Name field + manager saved as-is on import

User request: store the employee's name as ONE full name everywhere (no more
First/Middle/Last split), and on bulk import save the reporting manager's name
and ID **as typed** without requiring the manager to exist yet.

| Change | Detail |
|--------|--------|
| Full Name everywhere | The Add/Edit Employee form (f-first/f-middle/f-last) and the Asset Master quick-add employee modal (qaEmpFirst/qaEmpLast) are now a single **Full Name** input. Employees store `name`; `getEmployeeFullName`/`getEmployeeInitials` handle both the new `name` and legacy first/middle/last. |
| Auto-migration | `amsMigrateEmployeeNames()` (js/dummy-data.js) runs on load: any legacy record with first/middle/last but no `name` gets `name` built from them (idempotent). |
| CSV single name column | `EMP_CSV_HEADERS` = `empId*, name*, dept*, designation*, reportsTo, managerId, contact, email, status`. Template, Export and Import all use one `name` column (e.g. `Ravikumar Rajendra Tiparadi`). |
| Manager saved as-is | Import writes the manager's name + ID verbatim onto the employee (`managerName`/`managerId`) **without checking that the manager exists** - no row is skipped for a missing manager. If the manager is in the system (matched by empId / AMS ID / full name) `managerAmsId` links immediately; otherwise the raw reference is kept (`pendingManagerRef`) and `amsResolvePendingManagers()` links it once the manager is added. |
| Server full_name | `AmsDb.cs` employees mapper prefers the new `name` field, falling back to first/middle/last, so the SQL `full_name` column stays populated for legacy records. |

Verified: `node --check` clean on employees.js / dummy-data.js / assets.js, a Node
simulation covered all four cases (manager saved as-is when absent, auto-linked
when added later, legacy first/middle/last migration, full-name lookup), and
`dotnet build` succeeds 0 warnings / 0 errors.

---

## Theme reconciliation (already applied in Phase 1)

| Theme        | Origin       |
|--------------|--------------|
| dark-grey    | shared (v3-3 + v4-0 both define) |
| lite         | shared        |
| blue         | shared        |
| forest       | shared        |
| amber        | shared        |
| violet       | v3-3 only     |
| crimson      | v3-3 only     |
| contrast     | v3-3 only     |
| midnight     | v4-0 only     |
| slate-blue   | v4-0 only     |
| purple       | v4-0 only     |

> Result: **11 themes**. Overlapping names keep v4-0's palette (newer).

## Known naming/CSS-variable difference (v3-3 -> v4-0 mapping)

When porting v3-3 CSS, translate its variables to v4-0's set:

| v3-3 variable      | v4-0 variable     |
|--------------------|-------------------|
| `--bg-main`        | `--bg-body`       |
| `--bg-surface`     | `--bg-card`       |
| `--bg-surface-2`   | `--bg-elevated`   |
| `--border-color`   | `--border`        |
| `--text-main`      | `--text-primary`  |
| `--text-muted`     | `--text-secondary` |
| `--accent`         | `--accent` (same) |
| `--accent-2`       | `--accent-hover`  |
| `--danger/success/warning` | same names  |
| `--font-ui`        | v4-0 uses body font stack |
| `--font-data`      | v4-0 uses `--font-mono` if present |
