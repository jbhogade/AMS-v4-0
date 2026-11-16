# Employee Exit status is Exited (AMS-Test + AMS-v4-0)

Confirm Exit stores and displays **Exited**, not Inactive. Same change on AMS-Test and AMS-v4-0.

## Goal

Any employee marked as exited must show **Exited** on the Employee Master (table, View, filter, stats). Report Master Asset Handover Form filters on `status === "Exited"`. Khairul Basar Mollah (00262 / EMP-ELE-000004) can be exited even if all assets were already returned to store. The Handover Form lists only currently held items; an empty list is allowed.

## Non-goals

- Do not add already-returned In Store items onto the Exit snapshot or Handover Form.
- Do not change print layouts, JWT login, money-parse, or Graphite Teal.
- Do not change lookup-master Active/Inactive (`item.active` in `master-table.js`).
- Do not delete `css/ui-styles.css`.

## Status model

Employee `status` values:

| Value | Meaning |
| --- | --- |
| `Active` | Employed |
| `Exited` | Off-boarded via Confirm Exit |

`Inactive` is not a displayed employee status after this change. Existing `Inactive` rows that already have an exit date or exit record are migrated to `Exited` on load.

## Behavior

### Confirm Exit (`exitEmployee` in `js/dummy-data.js`)

- Set `emp.status = "Exited"` (today: `"Inactive"`).
- Keep `exitDate`, `exitReason`, `exitRemarks`.
- Snapshot currently assigned assets / mobiles / SIMs into `AMS_DUMMY_EXIT_RECORDS`, then return those holdings to In Store.
- Do not require holdings. Empty `directAssetsHeld` / mobiles / SIMs is valid.
- Persist employees, assets, mobiles, simCards, exitRecords as today.

### Employee Master (`js/employees.js`, `pages/employees.html`)

- Row is exited when `emp.status === "Exited"` (exit record still required for Exit Report / Reactivate, as today).
- Status filter option: `Exited` (replace `Inactive`).
- Stats strip: label **Exited** (keep element id `stat-inactive`; `getEmployeeSummary().inactive` counts `status === "Exited"` plus leftover `Inactive`).
- Exit modal copy: "mark the employee as **Exited**".
- View profile: "Exited on:" when `status === "Exited"` (and leftover `Inactive` with `exitDate`).
- Reactivate: allowed when `status === "Exited"` or leftover `Inactive`, and an exit record exists. Sets `status = "Active"`.
- CSV template/import: `status = Active or Exited (default Active)`. Import aliases: `Exited` and `Inactive` both save as `Exited`. Export writes `Exited` for exited rows.

### Reports (`js/reports.js`)

Already filters Handover on `emp.status === "Exited"`. After Confirm Exit and migration, those employees appear when they still hold assets. Empty-holdings exited employees stay off the Handover report table (report is "currently held"); the per-employee Exit Report print still uses the exit snapshot.

### Repair (`amsRepairExitedEmployeeHoldings`)

Run for `status === "Exited"` and leftover `status === "Inactive"`. Still only returns holdings still assigned to that employee.

### Load migration

After collections load (same idle/timeout path as `amsRepairExitedEmployeeHoldings`, or immediately before it):

- If `emp.status === "Inactive"` and (`emp.exitDate` or an exit record exists), set `status = "Exited"`.
- If any row changed, `amsDbSaveAsync("employees")` once.

Bare `Inactive` with no exit date and no exit record: leave unchanged (import/legacy). Employee filter only lists Active / Exited; those rows still show under All.

## Files (both repos)

- `js/dummy-data.js` — `exitEmployee`, `reactivateEmployee`, `amsRepairExitedEmployeeHoldings`, `getEmployeeSummary`, load migration.
- `js/employees.js` — actions menu, View, Reactivate guard, CSV import/template text.
- `pages/employees.html` — stats label, status filter, Exit modal copy.

No SQL schema change. `ams_employees.status` is `NVARCHAR(50)`; `data_json` already stores the full record.

## Out of scope for Khairul's empty form

Handover Form remains snapshot-at-exit of currently assigned items only. Assets already In Store with a "User has exited" remark are not pulled back onto the form.
