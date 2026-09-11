/*==============================================================================
#-------------- Start Code for : ASSET DISTRIBUTION PAGE (asset-distribution.js) -
#
#  PURPOSE   : Per-employee asset holdings breakdown - how many assets each
#              employee holds DIRECTLY (personally assigned) vs under their
#              TEAM (held by direct subordinates, or assigned with a
#              subordinate/team actual user recorded on the asset).
#
#  CLASSIFICATION (same rules as the Asset Issue Form):
#    - Direct  = amsOwnedEmployeeAssets()  : custodian has the asset with no
#                subordinate/team holder recorded.
#    - Team    = amsTeamEmployeeAssets()   : a direct subordinate holds it, OR
#                the asset records assignedToSubordinate / assignedSubText.
#------------------------------------------------------------------------------*/

/* ---- Page state ------------------------------------------------------------ */
const DIST_STATE = {
    rows: [],              /* [{ empId, name, dept, designation, directCount, teamCount, total, direct:[], team:[] }] */
    loaded: false,
};

/* The employee currently open in the "View Assets" detail modal (for the
   Download Report button). */
let distDetailEmpId = null;

/* =============================================================================
   1) DATA
   ===========================================================================*/
/* Badge/event classification for a lifecycle record - mirrors the Asset ID
   Record modal, duplicated here because assets.js is not loaded on this page. */
function distHistoryEventType(action) {
    action = String(action || "");
    if (action.indexOf("Transferred") === 0) return { label: "Transfer", cls: "badge-transfer" };
    if (action.indexOf("Reassigned") === 0) return { label: "Reassign", cls: "badge-amber" };
    if (action === "Assigned - New") return { label: "Assign", cls: "badge-green" };
    if (action === "Returned") return { label: "Return", cls: "badge-grey" };
    if (action.indexOf("Replaced by") === 0 || action.indexOf("Replacement") !== -1) return { label: "Replace", cls: "badge-transfer" };
    if (action === "Retired / Scrapped") return { label: "Retire", cls: "badge-red" };
    if (action === "Not Working") return { label: "Fault", cls: "badge-red" };
    return { label: "Other", cls: "badge-grey" };
}

/* The COMPLETE per-employee asset lifecycle: every lifecycle record across all
   assets that references this employee (Assigned / Returned / Reassigned /
   Replaced / Transferred / Retired ...), plus the assets they currently hold
   when no lifecycle entry exists for them (seed/imported data). This is what
   makes Asset Distribution the place where every record is kept. */
function distHistoryMatches(h, amsId) {
    if (!h || !h.empId) return false;
    if (h.empId === amsId) return true;
    const emp = typeof findEmployeeAny === "function" ? findEmployeeAny(h.empId) : null;
    return !!(emp && emp.amsId === amsId);
}

function distScanHistory(list, amsId, records, seen, idOf) {
    (list || []).forEach(item => {
        (item.history || []).forEach(h => {
            if (!distHistoryMatches(h, amsId)) return;
            const evt = distHistoryEventType(h.action);
            const displayId = h.assetIdFull || idOf(item);
            records.push({
                date: h.date || "",
                action: h.action,
                label: evt.label,
                cls: evt.cls,
                assetIdFull: displayId,
                statusLabel: h.statusLabel || item.status || "",
                note: h.note || "",
            });
            seen[displayId] = true;
        });
    });
}

function distEmployeeLifecycle(amsId) {
    const records = [];
    const seen = {}; /* assetIdFull -> true, so a currently-held asset is not added twice */
    distScanHistory(DUMMY_ASSETS, amsId, records, seen, a => amsPrintAssetId(a));
    distScanHistory(DUMMY_MOBILES, amsId, records, seen, a => amsPrintAssetId(a));
    distScanHistory(AMS_DUMMY_SIM_CARDS, amsId, records, seen, s => s.simId);
    const current = [];
    amsOwnedEmployeeHoldings(amsId).forEach(a => current.push({ a, kind: "Direct" }));
    amsTeamEmployeeHoldings(amsId).forEach(a => current.push({ a, kind: "Team" }));
    current.forEach(({ a, kind }) => {
        const id = amsHoldingDisplayId(a);
        if (seen[id]) return;
        records.push({
            date: "",
            action: "Currently held",
            label: kind === "Direct" ? "Direct" : "Team",
            cls: kind === "Direct" ? "badge-green" : "badge-transfer",
            assetIdFull: id,
            statusLabel: a.status || "",
            note: "",
        });
    });
    records.sort((x, y) => String(y.date).localeCompare(String(x.date))); /* newest first */
    return records;
}

function distBuildRows() {
    const employees = amsGetEmployeesForPortal();
    return employees.map(emp => {
        const amsId = emp.amsId || emp.empId;
        const direct = amsOwnedEmployeeHoldings(amsId) || [];
        const team = amsTeamEmployeeHoldings(amsId) || [];
        const records = distEmployeeLifecycle(amsId);
        return {
            empId: emp.empId,              /* internal key = AMS ID (assets link to it) */
            displayId: amsGetEmployeeDisplayId(emp), /* company-issued display ID, shown in UI + exports */
            name: emp.name,
            dept: emp.dept || "",
            designation: emp.designation || "",
            directCount: direct.length,
            teamCount: team.length,
            total: direct.length + team.length,
            recordCount: records.length,
            direct,
            team,
            records,
        };
    });
}

function distFilteredRows() {
    const search = (document.getElementById("distSearch").value || "").toLowerCase();
    const onlyWithAssets = document.getElementById("distOnlyWithAssets").checked;
    return DIST_STATE.rows.filter(r => {
        if (onlyWithAssets && r.total === 0) return false;
        if (search) {
            const hay = `${r.name} ${r.displayId} ${r.empId} ${r.dept} ${r.designation}`.toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });
}

/* =============================================================================
   2) RENDER : summary cards
   ===========================================================================*/
function distRenderSummary() {
    const totalDirect = DIST_STATE.rows.reduce((n, r) => n + r.directCount, 0);
    const totalTeam = DIST_STATE.rows.reduce((n, r) => n + r.teamCount, 0);
    const withAssets = DIST_STATE.rows.filter(r => r.total > 0).length;
    const html = `
        <div class="stat-card"><div class="stat-value">${totalDirect}</div><div class="stat-label">Direct (Personal) Assets</div></div>
        <div class="stat-card"><div class="stat-value">${totalTeam}</div><div class="stat-label">Team / Subordinate Assets</div></div>
        <div class="stat-card"><div class="stat-value">${totalDirect + totalTeam}</div><div class="stat-label">Total Distributed</div></div>
        <div class="stat-card"><div class="stat-value">${withAssets}</div><div class="stat-label">Employees Holding Assets</div></div>
    `;
    document.getElementById("distStockSummary").innerHTML = html;
}

/* =============================================================================
   3) RENDER : distribution table (sortable + filterable)
   ===========================================================================*/
function distRenderTable() {
    const rows = distFilteredRows();

    const getters = {
        empId: r => r.displayId,
        name: r => r.name,
        dept: r => r.dept,
        designation: r => r.designation,
        direct: r => r.directCount,
        team: r => r.teamCount,
        total: r => r.total,
        records: r => r.recordCount,
    };
    const colFiltered = amsFilterRows("distTable", rows, getters);
    const sorted = amsSortRows("distTable", colFiltered, getters);

    const body = sorted.length
        ? sorted.map(r => `<tr>
            <td class="mono-cell">${amsEsc(r.displayId)}</td>
            <td>${amsEsc(r.name)}</td>
            <td>${amsEsc(r.dept)}</td>
            <td>${amsEsc(r.designation) || "-"}</td>
            <td class="mono-cell">${r.directCount}</td>
            <td class="mono-cell">${r.teamCount}</td>
            <td class="mono-cell"><strong>${r.total}</strong></td>
            <td class="mono-cell">${r.recordCount}</td>
            <td class="actions-cell">
                <button class="btn btn-secondary" onclick="distOpenDetail('${amsEsc(r.empId)}')">View Assets</button>
            </td>
        </tr>`).join("")
        : `<tr><td colspan="9" style="color:var(--text-muted);text-align:center;">No employees match the current filters</td></tr>`;

    document.getElementById("distTable").innerHTML = `
        <thead><tr>
            ${amsSortableTh("distTable", "empId", "Emp ID")}
            ${amsSortableTh("distTable", "name", "Employee Name")}
            ${amsSortableTh("distTable", "dept", "Department")}
            ${amsSortableTh("distTable", "designation", "Designation")}
            ${amsSortableTh("distTable", "direct", "Direct")}
            ${amsSortableTh("distTable", "team", "Team")}
            ${amsSortableTh("distTable", "total", "Total")}
            ${amsSortableTh("distTable", "records", "Records")}
            <th></th>
        </tr>${amsFilterHeadRow("distTable", ["empId", "name", "dept", "designation", "direct", "team", "total", "records", ""])}</thead>
        <tbody>${body}</tbody>`;
    if (typeof amsFilterRestoreFocus === "function") amsFilterRestoreFocus("distTable");

    const shownTotal = sorted.reduce((n, r) => n + r.total, 0);
    const shownRecords = sorted.reduce((n, r) => n + r.recordCount, 0);
    document.getElementById("distTableFooter").innerHTML =
        `<span>${sorted.length} employee${sorted.length === 1 ? "" : "s"} &middot; ${shownTotal} asset(s) currently held &middot; ${shownRecords} lifecycle record(s)</span>`;
}

/* =============================================================================
   4) RENDER : per-employee detail modal
   ===========================================================================*/
function distOpenDetail(empId) {
    const r = DIST_STATE.rows.find(x => x.empId === empId);
    if (!r) return;
    distDetailEmpId = empId;
    document.getElementById("distDetailTitle").textContent = `${r.name} (${r.displayId}) - Asset Detail`;

    const row = (a, kindCls, kindLabel) => `<tr>
        <td class="mono-cell">${amsEsc(amsHoldingDisplayId(a))}</td>
        <td>${amsEsc(amsHoldingTypeLabel(a))}</td>
        <td>${amsEsc(amsHoldingMakeModel(a))}</td>
        <td>${amsEsc(a.serialNumber || a.iccid || a.mobileNumber) || "-"}</td>
        <td>${amsEsc(a.status)}</td>
        <td><span class="badge ${kindCls}">${kindLabel}</span></td>
    </tr>`;

    const directRows = r.direct.length
        ? r.direct.map(a => row(a, "badge-green", "Direct")).join("")
        : `<tr><td colspan="6" style="color:var(--text-muted);text-align:center;">No directly held assets</td></tr>`;

    const teamRows = r.team.length
        ? r.team.map(a => row(a, "badge-transfer", "Team")).join("")
        : `<tr><td colspan="6" style="color:var(--text-muted);text-align:center;">No team / subordinate assets</td></tr>`;

    const recRows = r.records.length
        ? r.records.map(rec => `<tr>
            <td class="mono-cell">${rec.date ? amsFormatDate(rec.date) : "-"}</td>
            <td><span class="badge ${rec.cls}">${rec.label}</span></td>
            <td>${amsEsc(rec.action)}${rec.note ? `<div class="form-hint" style="font-size:12px;margin-top:2px;">${amsEsc(rec.note)}</div>` : ""}</td>
            <td class="mono-cell">${amsEsc(rec.assetIdFull) || "-"}</td>
            <td>${amsEsc(rec.statusLabel) || "-"}</td>
        </tr>`).join("")
        : `<tr><td colspan="5" style="color:var(--text-muted);text-align:center;">No lifecycle records for this employee</td></tr>`;

    document.getElementById("distDetailBody").innerHTML = `
        <p class="form-hint" style="margin-bottom:10px;">
            Direct = personally held by the employee. Team = held by the employee's subordinates, or assigned
            to the employee with a subordinate/team member recorded as the actual user. The records below are the
            employee's complete lifecycle - every Assign / Return / Reassign / Replace / Transfer event on record.
            Direct: <strong>${r.directCount}</strong> &middot; Team: <strong>${r.teamCount}</strong> &middot; Held: <strong>${r.total}</strong> &middot; Records: <strong>${r.recordCount}</strong>
        </p>
        <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Direct (Personal Use) - ${r.directCount}</div>
            <div class="table-wrap"><table class="table">
                <thead><tr><th>Asset ID (Full)</th><th>Type</th><th>Make / Model</th><th>Serial</th><th>Status</th><th>Kind</th></tr></thead>
                <tbody>${directRows}</tbody>
            </table></div>
        </div>
        <div class="card" style="margin-bottom:14px;">
            <div class="card-title">Team / Subordinate Use - ${r.teamCount}</div>
            <div class="table-wrap"><table class="table">
                <thead><tr><th>Asset ID (Full)</th><th>Type</th><th>Make / Model</th><th>Serial</th><th>Status</th><th>Kind</th></tr></thead>
                <tbody>${teamRows}</tbody>
            </table></div>
        </div>
        <div class="card">
            <div class="card-title">Complete Lifecycle - All Records (Assign / Return / Reassign / Replace) - ${r.recordCount}</div>
            <div class="table-wrap"><table class="table">
                <thead><tr><th>Date</th><th>Event</th><th>Detail</th><th>Asset ID</th><th>Status</th></tr></thead>
                <tbody>${recRows}</tbody>
            </table></div>
        </div>`;
    amsOpenModal("modalDistDetail");
}

/* =============================================================================
   5) EXPORT
   ===========================================================================*/
function distExportSource() {
    const getters = {
        empId: r => r.displayId,
        name: r => r.name,
        dept: r => r.dept,
        designation: r => r.designation,
        direct: r => r.directCount,
        team: r => r.teamCount,
        total: r => r.total,
        records: r => r.recordCount,
    };
    const rows = distFilteredRows();
    return typeof amsFilterRows === "function" ? amsFilterRows("distTable", rows, getters) : rows;
}

function distExportCsv() {
    const headers = ["Emp ID", "Employee Name", "Department", "Designation", "Direct Assets", "Team Assets", "Total Assets", "Lifecycle Records"];
    const rows = distExportSource().map(r => [r.displayId, r.name, r.dept, r.designation, r.directCount, r.teamCount, r.total, r.recordCount]);
    const csv = [headers.map(amsCsvCell).join(",")].concat(rows.map(r => r.map(amsCsvCell).join(","))).join("\r\n");
    amsDownloadFile(csv, "Asset_Distribution.csv", "text/csv;charset=utf-8;");
}

function distExportXlsx() {
    const headers = ["Emp ID", "Employee Name", "Department", "Designation", "Direct Assets", "Team Assets", "Total Assets", "Lifecycle Records"];
    const rows = distExportSource().map(r => [r.displayId, r.name, r.dept, r.designation, r.directCount, r.teamCount, r.total, r.recordCount]);
    amsExportXlsx("Asset_Distribution", headers, rows);
}

function amsCsvCell(v) {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* Downloads the detail currently shown in the "View Assets" modal as a CSV
   report. Includes the employee's DISPLAY ID, their current Direct + Team
   holdings, and their complete lifecycle records (assign / return / reassign /
   replace). */
function distExportDetail() {
    const r = DIST_STATE.rows.find(x => x.empId === distDetailEmpId);
    if (!r) return;
    const headers = ["Emp ID", "Kind / Event", "Asset ID (Full)", "Make / Model", "Serial Number", "Date", "Status", "Note"];
    const holdingRow = (a, kind) => [
        r.displayId, kind, amsComputeFullId(a), `${a.make || ""} ${a.model || ""}`.trim() || "-", a.serialNumber || "-",
        "(currently held)", a.status || "-", "",
    ];
    const recordRow = (rec) => [
        r.displayId, rec.label, rec.assetIdFull || "-", rec.action, "-",
        rec.date ? amsFormatDate(rec.date) : "-", rec.statusLabel || "-", rec.note || "",
    ];
    const rows = [
        ...r.direct.map(a => holdingRow(a, "Direct")),
        ...r.team.map(a => holdingRow(a, "Team")),
        ...r.records.map(recordRow),
    ];
    if (!rows.length) rows.push([r.displayId, "", "", "", "", "", "", "No assets"]);
    const csv = [headers, ...rows].map(row => row.map(amsCsvCell).join(",")).join("\r\n");
    amsDownloadFile(csv, `Asset_Distribution_${r.displayId}.csv`, "text/csv;charset=utf-8;");
}

/* =============================================================================
   6) PAGE INIT
   ===========================================================================*/
function initAssetDistribution() {
    amsDbEnsureLoaded().then(() => {
        DIST_STATE.rows = distBuildRows();
        DIST_STATE.loaded = true;

        amsSortRegisterRenderer("distTable", distRenderTable);

        document.getElementById("distSearch").addEventListener("input", distRenderTable);
        document.getElementById("distOnlyWithAssets").addEventListener("change", distRenderTable);
        const distClear = document.getElementById("btnDistClearFilters");
        if (distClear) distClear.addEventListener("click", () => amsFilterClearAndRender("distTable"));
        document.getElementById("btnDistCsv").addEventListener("click", distExportCsv);
        document.getElementById("btnDistXlsx").addEventListener("click", distExportXlsx);
        document.getElementById("btnDistDetailCsv").addEventListener("click", distExportDetail);

        distRenderSummary();
        distRenderTable();
    });
}
