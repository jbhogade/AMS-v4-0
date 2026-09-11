/*==============================================================================
#-------------- Start Code for : LOG REPORT LOGIC (log-report.js) ---------------
#
#  PURPOSE   : Powers Log Report - ported from v3-3 (log-report-v1-0.js) to the
#              v4-0 data layer. Enforces the "Viewing As" role gate (Super Root
#              and Supreme Root only), applies the Super Root / Supreme Root
#              visibility split, renders filterable activity-log rows, exports
#              CSV, and clears the log (Supreme Root only).
#
#  v4-0 ADAPTATIONS :
#    - Uses the shared amsEsc()/amsFormatDate()/amsCsvRow()/amsDownloadFile()
#      from js/dummy-data.js (no local copies needed).
#    - Badges map to the v4-0 badge-* classes.
#    - Actor badges use .actor-badge.supreme/.super/.other from role-gate.css.
#    - Role options come from AMS_USER_ROLES and stay in sync with the shared
#      topbar selector via amsGet/SetViewingAsRole.
#------------------------------------------------------------------------------*/

/*-------------- Start Code for SIGNED-IN ROLE (real session role, no simulator) -----*/
let logViewingAsSelect = null;

function amsApplyLogAccessGate() {
    const role = amsGetViewingAsRole();
    const allowed = role === "Super Root" || role === "Supreme Root";
    document.getElementById("accessDeniedCard").style.display = allowed ? "none" : "block";
    document.getElementById("logReportContent").style.display = allowed ? "block" : "none";

    const hint = document.getElementById("viewingAsHint");
    if (role === "Supreme Root") hint.textContent = "Full access - can see every record, including Super Root and Supreme Root.";
    else if (role === "Super Root") hint.textContent = "Can see every record except ones logged while the actor was Supreme Root.";
    else hint.textContent = "This role cannot view Log Report.";

    document.getElementById("btnLogClear").style.display = role === "Supreme Root" ? "inline-block" : "none";

    if (allowed) renderLogTable();
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for FILTER DROPDOWN POPULATION -----------------------*/
function amsPopulateLogFilters() {
    const log = amsGetActivityLog();
    const roles = [...new Set(log.map(e => e.actorRole).filter(Boolean))].sort();
    const pages = [...new Set(log.map(e => e.page).filter(Boolean))].sort();
    document.getElementById("logActorRole").innerHTML = `<option value="">All</option>`
        + roles.map(r => `<option value="${amsEsc(r)}">${amsEsc(r)}</option>`).join("");
    document.getElementById("logPage").innerHTML = `<option value="">All</option>`
        + pages.map(p => `<option value="${amsEsc(p)}">${amsEsc(p)}</option>`).join("");
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for VISIBILITY SPLIT (Super Root / Supreme Root) -----*/
function amsVisibleLogEntries() {
    const viewingAs = amsGetViewingAsRole();
    const log = amsGetActivityLog();
    if (viewingAs === "Supreme Root") return log;
    if (viewingAs === "Super Root") return log.filter(e => e.actorRole !== "Supreme Root");
    return []; /* any other role - access denied, handled separately */
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for RENDER LOG TABLE ---------------------------------*/
function amsLogTableGetters() {
    return {
        time: e => e.time || "",
        actor: e => e.actorRole || "",
        page: e => e.page || "",
        type: e => e.type || "",
        message: e => e.message || "",
    };
}

function amsToolbarFilteredLogs() {
    const search = (document.getElementById("logSearch").value || "").toLowerCase();
    const actorRole = document.getElementById("logActorRole").value;
    const pageFilter = document.getElementById("logPage").value;
    const fromDate = document.getElementById("logFromDate").value;
    const toDate = document.getElementById("logToDate").value;
    return amsVisibleLogEntries().filter(e => {
        if (search && !`${e.message} ${e.page}`.toLowerCase().includes(search)) return false;
        if (actorRole && e.actorRole !== actorRole) return false;
        if (pageFilter && e.page !== pageFilter) return false;
        const entryDate = (e.time || "").slice(0, 10);
        if (fromDate && entryDate < fromDate) return false;
        if (toDate && entryDate > toDate) return false;
        return true;
    });
}

function renderLogTable() {
    const filtered = amsToolbarFilteredLogs();
    const getters = amsLogTableGetters();
    amsSortRegisterRenderer("logTable", renderLogTable);
    const colFiltered = typeof amsFilterRows === "function" ? amsFilterRows("logTable", filtered, getters) : filtered;
    const rows = typeof amsSortRows === "function" ? amsSortRows("logTable", colFiltered, getters) : colFiltered;

    const typeBadge = (type) => {
        const cls = { success: "badge-success", warning: "badge-warning", danger: "badge-danger", info: "badge-grey" }[type] || "badge-grey";
        return `<span class="badge ${cls}">${amsEsc(type || "info")}</span>`;
    };
    const actorBadge = (role) => {
        const cls = role === "Supreme Root" ? "supreme" : role === "Super Root" ? "super" : "other";
        return `<span class="actor-badge ${cls}">${amsEsc(role || "Unknown")}</span>`;
    };

    const th = (key, label) => (typeof amsSortableTh === "function")
        ? amsSortableTh("logTable", key, label)
        : `<th>${label}</th>`;
    document.getElementById("logTable").innerHTML = `
        <thead><tr>${th("time", "Time")}${th("actor", "Actor Role")}${th("page", "Page")}${th("type", "Type")}${th("message", "Message")}</tr>
        ${typeof amsFilterHeadRow === "function" ? amsFilterHeadRow("logTable", ["time", "actor", "page", "type", "message"]) : ""}</thead>
        <tbody>${rows.length ? rows.map(e => `
            <tr>
                <td class="mono">${amsEsc(amsFormatDate((e.time || "").slice(0, 10)))} ${amsEsc((e.time || "").slice(11, 16))}</td>
                <td>${actorBadge(e.actorRole)}</td>
                <td>${amsEsc(e.page)}</td>
                <td>${typeBadge(e.type)}</td>
                <td>${amsEsc(e.message)}</td>
            </tr>`).join("") : `<tr><td colspan="5" style="color:var(--text-muted)">No activity recorded yet, or none match these filters</td></tr>`}</tbody>`;
    if (typeof amsFilterRestoreFocus === "function") amsFilterRestoreFocus("logTable");
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for EXPORT CSV ---------------------------------------*/
function amsExportLogCsv() {
    const header = amsCsvRow(["Time", "Actor Role", "Page", "Type", "Message"]);
    const toolbar = amsToolbarFilteredLogs();
    const source = typeof amsFilterRows === "function"
        ? amsFilterRows("logTable", toolbar, amsLogTableGetters())
        : toolbar;
    const rows = source.map(e => amsCsvRow([e.time, e.actorRole, e.page, e.type, e.message]));
    amsDownloadFile([header, ...rows].join("\n"), "log-report.csv", "text/csv");
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for CLEAR LOG (Supreme Root only) --------------------*/
function amsClearLog() {
    if (amsGetViewingAsRole() !== "Supreme Root") return; /* extra guard - button is hidden otherwise anyway */
    if (!confirm("Clear the entire activity log? This cannot be undone.")) return;
    amsSaveActivityLog([]);
    amsPopulateLogFilters();
    renderLogTable();
    amsNotify("Activity log cleared", "warning");
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for PAGE INIT ----------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
    if (typeof initLayout === "function") initLayout("log");

    logViewingAsSelect = document.getElementById("viewingAsRole");
    if (logViewingAsSelect) logViewingAsSelect.value = amsGetViewingAsRole();

    document.getElementById("logSearch").addEventListener("input", renderLogTable);
    document.getElementById("btnLogFilter").addEventListener("click", renderLogTable);
    const logClear = document.getElementById("btnLogClearFilters");
    if (logClear) logClear.addEventListener("click", () => amsFilterClearAndRender("logTable"));
    document.getElementById("btnLogCsv").addEventListener("click", amsExportLogCsv);
    document.getElementById("btnLogClear").addEventListener("click", amsClearLog);

    amsPopulateLogFilters();
    amsApplyLogAccessGate();
});
/*-------------- End of the code ------------------------------------------------*/
/*==============================================================================
#-------------- End of the code : LOG REPORT LOGIC -------------------------------
#------------------------------------------------------------------------------*/
