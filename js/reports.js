/*==============================================================================
#-------------- Start Code for : REPORTS PAGE LOGIC (reports.js) ----------------
#
#  PURPOSE   : Powers every tab on Report Master - ported from v3-3
#              (reports-master-v1-0.js) and adapted to the v4-0 data model.
#
#  DATA SOURCE: reads DUMMY_ASSETS[].history[], DUMMY_EMPLOYEES,
#               AMS_DUMMY_CONSUMABLE_LOG, and AMS_DUMMY_SPAREPART_LOG - the
#               same seed data every page starts from. Since there's no shared
#               backend/storage yet, edits made during a session on another
#               page live only in that page's own memory and are lost on
#               navigation - so this report reflects the SEED data, not live
#               changes from a separate page session. This resolves naturally
#               once SQL Server integration replaces the dummy data layer.
#
#  v4-0 ADAPTATIONS :
#    - Assets now live in DUMMY_ASSETS (not AMS_DUMMY_ASSETS); the display ID
#      is the asset's own `id` field, and employees are joined via amsId.
#    - History action strings written by js/assets.js include "Assigned - New",
#      "Reassigned", "Returned", "Transferred to ...", "Replaced by ...",
#      "Retired / Scrapped", "Not Working", "Added to Inventory (...)"; the
#      classifier below maps them all to report event types.
#    - Asset Issue / Handover rows deep-link straight into the shared print
#      engine (js/print-forms.js amsGenerateReport) instead of navigating to
#      another page.
#    - Print goes through js/print-docs.js (company letterhead), badges use the
#      v4-0 badge-* classes, colors are var(--...) only.
#------------------------------------------------------------------------------*/

/*-------------- Start Code for TAB SWITCHING ----------------------------------*/
function amsWireReportTabs() {
    document.querySelectorAll(".report-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".report-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".report-panel").forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(`panel-${tab.getAttribute("data-report")}`).classList.add("active");
        });
    });
}

function amsApplyReportTabAccess() {
    if (typeof amsUserCanAccessPage !== "function") return;
    let firstVisible = null;
    document.querySelectorAll(".report-tab").forEach(tab => {
        const key = "report." + tab.getAttribute("data-report");
        const allowed = amsUserCanAccessPage(key);
        tab.style.display = allowed ? "" : "none";
        const panel = document.getElementById(`panel-${tab.getAttribute("data-report")}`);
        if (panel && !allowed) panel.classList.remove("active");
        if (allowed && !firstVisible) firstVisible = tab;
    });
    const active = document.querySelector(".report-tab.active");
    const activeHidden = active && active.style.display === "none";
    if (firstVisible && (!active || activeHidden)) {
        firstVisible.click();
    }
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for POPULATE SHARED DROPDOWNS (Sites, Departments, Types) -----*/
function amsPopulateSiteFilters() {
    const opts = `<option value="">All</option>` + AMS_DUMMY_SITES.map(s => `<option value="${amsEsc(s.name)}">${amsEsc(s.name)}</option>`).join("");
    ["alSite", "crSite", "cuSite", "srSite", "suSite", "issueSite", "handoverSite"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
}

function amsPopulateIssueHandoverExtraFilters() {
    const deptOpts = `<option value="">All</option>` + AMS_DUMMY_DEPARTMENTS.map(d => `<option value="${amsEsc(d.name)}">${amsEsc(d.name)}</option>`).join("");
    const typeOpts = `<option value="">All</option>` + AMS_DUMMY_ASSET_TYPES.filter(t => t.active).map(t => `<option value="${amsEsc(t.name)}">${amsEsc(t.name)}</option>`).join("");
    ["issueDept", "handoverDept"].forEach(id => { document.getElementById(id).innerHTML = deptOpts; });
    ["issueAssetType", "handoverAssetType"].forEach(id => { document.getElementById(id).innerHTML = typeOpts; });
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for EVENT TYPE CLASSIFICATION (matches the action
   strings written by js/assets.js into asset history) ---------------------------*/
function amsClassifyEvent(action) {
    const a = String(action || "");
    if (a.startsWith("Transferred")) return "Transfer";
    if (a === "Reassigned") return "Reassign";
    if (a === "Assign" || a === "Assigned - New") return "Assign";
    if (a === "Return" || a === "Returned") return "Return";
    if (a.startsWith("Replaced by") || a.startsWith("Added to Inventory (Replacement")) return "Replace";
    if (a === "Retired / Scrapped") return "Retire";
    if (a === "Not Working") return "Fault";
    return "Other";
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for ASSET LIFECYCLE REPORT --------------------------*/
function amsFlattenAssetHistory() {
    const mapItem = (a, typeFallback) => (a.history || []).map(h => ({
        ...h,
        empId: amsHistoryEmpDisplayId(h),
        assetDisplayId: (typeof amsPrintAssetId === "function" ? amsPrintAssetId(a) : (a.id || a.simId || a.amsAssetId || "")),
        assetType: a.type || typeFallback || "",
        assetSite: a.currentSite || a.site || "",
    }));
    return DUMMY_ASSETS.flatMap(a => mapItem(a))
        .concat((typeof DUMMY_MOBILES !== "undefined" ? DUMMY_MOBILES : []).flatMap(a => mapItem(a)))
        .concat((typeof AMS_DUMMY_SIM_CARDS !== "undefined" ? AMS_DUMMY_SIM_CARDS : []).flatMap(s => mapItem(s, "SIM Card")));
}

function amsRenderAssetLifecycleReport() {
    const eventType = document.getElementById("alEventType").value;
    const site = document.getElementById("alSite").value;
    const fromDate = document.getElementById("alFromDate").value;
    const toDate = document.getElementById("alToDate").value;

    let entries = amsFlattenAssetHistory();
    if (eventType) entries = entries.filter(e => amsClassifyEvent(e.action) === eventType);
    if (site) entries = entries.filter(e => e.assetSite === site);
    if (fromDate) entries = entries.filter(e => e.date >= fromDate);
    if (toDate) entries = entries.filter(e => e.date <= toDate);
    entries = [...entries].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    amsSortRegisterRenderer("alTable", amsRenderAssetLifecycleReport);
    const getters = {
        date: e => e.date,
        type: e => amsClassifyEvent(e.action),
        action: e => e.action,
        asset: e => e.assetDisplayId,
        assetType: e => e.assetType,
        empName: e => e.empName || "",
        empDept: e => e.empDept || "",
        status: e => e.statusLabel,
    };
    entries = amsFilterRows("alTable", entries, getters);
    entries = amsSortRows("alTable", entries, getters);

    const rows = entries.length ? entries.map(e => `<tr>
        <td class="mono">${amsFormatDate(e.date)}</td>
        <td><span class="badge badge-grey">${amsEsc(amsClassifyEvent(e.action))}</span></td>
        <td>${amsEsc(e.action)}</td>
        <td class="mono">${amsEsc(e.assetDisplayId)}</td>
        <td>${amsEsc(e.assetType)}</td>
        <td>${amsEsc(e.empName) || "-"}</td>
        <td>${amsEsc(e.empDept) || "-"}</td>
        <td>${amsEsc(e.statusLabel)}</td>
    </tr>`).join("") : `<tr><td colspan="8" style="color:var(--text-secondary)">No events match these filters</td></tr>`;

    document.getElementById("alTable").innerHTML = `
        <thead><tr>
            ${amsSortableTh("alTable", "date", "Date")}
            ${amsSortableTh("alTable", "type", "Type")}
            ${amsSortableTh("alTable", "action", "Action")}
            ${amsSortableTh("alTable", "asset", "Asset ID")}
            ${amsSortableTh("alTable", "assetType", "Asset Type")}
            ${amsSortableTh("alTable", "empName", "Employee")}
            ${amsSortableTh("alTable", "empDept", "Department")}
            ${amsSortableTh("alTable", "status", "Status")}
        </tr>${amsFilterHeadRow("alTable", ["date", "type", "action", "asset", "assetType", "empName", "empDept", "status"])}</thead>
        <tbody>${rows}</tbody>`;
    if (typeof amsFilterRestoreFocus === "function") amsFilterRestoreFocus("alTable");
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for ASSET ISSUE / HANDOVER RECORD TABLES (click-to-print) -----*/
function amsRenderIssueHandoverTable(tableId, reportType, searchId, siteId, fromId, toId, deptId, typeId) {
    const wantExited = reportType === "exit";
    const searchTerm = searchId ? (document.getElementById(searchId).value || "").toLowerCase() : "";
    const site = siteId ? document.getElementById(siteId).value : "";
    const fromDate = fromId ? document.getElementById(fromId).value : "";
    const toDate = toId ? document.getElementById(toId).value : "";
    const dept = deptId ? document.getElementById(deptId).value : "";
    const assetType = typeId ? document.getElementById(typeId).value : "";

    /* One row per currently-assigned asset (Assigned or In Repair still counts as
       "currently held"). Issue Form -> only Active employees; Handover Form ->
       only Exited employees (that's the whole point of a handover). */
    const rowData = [];
    DUMMY_ASSETS
        .filter(a => a.assignedTo && (a.status === "Assigned" || a.status === "In Repair"))
        .forEach(a => {
            const emp = amsGetEmployeeByAmsId(a.assignedTo);
            if (!emp) return;
            const isExited = emp.status === "Exited";
            if (wantExited !== isExited) return;
            if (searchTerm && ![emp.name, amsGetEmployeeDisplayId(emp), emp.dept, amsPrintAssetId(a)].some(v => String(v).toLowerCase().includes(searchTerm))) return;
            const assetSite = a.currentSite || a.site;
            if (site && assetSite !== site) return;
            if (dept && emp.dept !== dept) return;
            if (assetType && a.type !== assetType) return;
            /* "Last activity date" = this asset's most recent history entry - for
               Issue Form that's typically the last Assign/Reassign; for Handover
               it's whatever happened last (Assign, Transfer, etc.). */
            const lastDate = (a.history && a.history.length) ? a.history[a.history.length - 1].date : "";
            if (fromDate && (!lastDate || lastDate < fromDate)) return;
            if (toDate && (!lastDate || lastDate > toDate)) return;
            rowData.push({ a, emp, isExited, assetSite });
        });

    amsSortRegisterRenderer(tableId, () => amsRenderIssueHandoverTable(tableId, reportType, searchId, siteId, fromId, toId, deptId, typeId));
    const getters = {
        empCode: r => amsGetEmployeeDisplayId(r.emp),
        empName: r => r.emp.name,
        status: r => r.isExited ? "Exited" : "Active",
        dept: r => r.emp.dept,
        assetId: r => amsPrintAssetId(r.a),
        assetType: r => r.a.type,
        site: r => r.assetSite,
    };
    const colFiltered = amsFilterRows(tableId, rowData, getters);
    const sorted = amsSortRows(tableId, colFiltered, getters);

    const rows = sorted.map(r => {
        const statusBadge = r.isExited ? `<span class="badge badge-red">Exited</span>` : `<span class="badge badge-green">Active</span>`;
        const rowStyle = r.isExited ? ' style="background:color-mix(in srgb, var(--danger) 10%, transparent);"' : "";
        return `<tr${rowStyle}>
            <td class="mono">${amsEsc(amsGetEmployeeDisplayId(r.emp))}</td>
            <td><a href="#" class="clickable-id" data-report-emp="${amsEsc(r.emp.amsId)}" data-report-type="${reportType}">${amsEsc(r.emp.name)}</a></td>
            <td>${statusBadge}</td>
            <td>${amsEsc(r.emp.dept)}</td>
            <td class="mono"><a href="#" class="clickable-id" data-report-emp="${amsEsc(r.emp.amsId)}" data-report-type="${reportType}">${amsEsc(amsPrintAssetId(r.a))}</a></td>
            <td>${amsEsc(r.a.type)}</td>
            <td>${amsEsc(r.assetSite)}</td>
        </tr>`;
    }).join("");

    document.getElementById(tableId).innerHTML = `
        <thead><tr>
            ${amsSortableTh(tableId, "empCode", "Emp Code")}
            ${amsSortableTh(tableId, "empName", "Employee Name")}
            ${amsSortableTh(tableId, "status", "Status")}
            ${amsSortableTh(tableId, "dept", "Department")}
            ${amsSortableTh(tableId, "assetId", "Asset ID")}
            ${amsSortableTh(tableId, "assetType", "Asset Type")}
            ${amsSortableTh(tableId, "site", "Site")}
        </tr>${amsFilterHeadRow(tableId, ["empCode", "empName", "status", "dept", "assetId", "assetType", "site"])}</thead>
        <tbody>${rows || `<tr><td colspan="7" style="color:var(--text-secondary)">No ${wantExited ? "exited" : "active"} employees with currently held assets match these filters</td></tr>`}</tbody>`;
    if (typeof amsFilterRestoreFocus === "function") amsFilterRestoreFocus(tableId);
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for CONSUMABLE / SPARE PARTS REPORTS (all items) -----*/
function amsRenderStockLogReport(logArray, type, siteId, fromId, toId, tableId) {
    const site = document.getElementById(siteId).value;
    const fromDate = document.getElementById(fromId).value;
    const toDate = document.getElementById(toId).value;

    let entries = logArray.filter(l => l.type === type);
    if (site) entries = entries.filter(l => l.site === site);
    if (fromDate) entries = entries.filter(l => l.date >= fromDate);
    if (toDate) entries = entries.filter(l => l.date <= toDate);
    entries = [...entries].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const showAsset = type === "Used" && entries.some(l => "assetIdSnapshot" in l);
    amsSortRegisterRenderer(tableId, () => amsRenderStockLogReport(logArray, type, siteId, fromId, toId, tableId));
    const getters = {
        date: l => l.date,
        item: l => l.name,
        site: l => l.site,
        qty: l => l.qty,
        by: l => l.by || "",
        asset: l => l.assetIdSnapshot || "",
        remarks: l => l.remarks || "",
    };
    entries = amsFilterRows(tableId, entries, getters);
    entries = amsSortRows(tableId, entries, getters);

    const rows = entries.length ? entries.map(l => `<tr>
        <td class="mono">${amsFormatDate(l.date)}</td>
        <td>${amsEsc(l.name)}</td>
        <td>${amsEsc(l.site)}</td>
        <td class="mono">${l.qty}</td>
        <td>${amsEsc(l.by) || "-"}</td>
        ${showAsset ? `<td class="mono">${amsEsc(l.assetIdSnapshot) || "-"}</td>` : ""}
        <td>${amsEsc(l.remarks) || "-"}</td>
    </tr>`).join("") : `<tr><td colspan="${showAsset ? 7 : 6}" style="color:var(--text-secondary)">No records match these filters</td></tr>`;

    document.getElementById(tableId).innerHTML = `
        <thead><tr>
            ${amsSortableTh(tableId, "date", "Date")}
            ${amsSortableTh(tableId, "item", "Item")}
            ${amsSortableTh(tableId, "site", "Site")}
            ${amsSortableTh(tableId, "qty", "Qty")}
            ${amsSortableTh(tableId, "by", type === "Restocked" ? "Vendor" : "Used By")}
            ${showAsset ? amsSortableTh(tableId, "asset", "Used For Asset") : ""}
            ${amsSortableTh(tableId, "remarks", "Remarks")}
        </tr>${amsFilterHeadRow(tableId, ["date", "item", "site", "qty", "by"].concat(showAsset ? ["asset"] : []).concat(["remarks"]))}</thead>
        <tbody>${rows}</tbody>`;
    if (typeof amsFilterRestoreFocus === "function") amsFilterRestoreFocus(tableId);
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for GENERIC EXPORT: CSV + EXCEL (any report table) ---*/
function amsTableToRows(tableEl) {
    const trs = typeof amsTableDataRows === "function" ? amsTableDataRows(tableEl) : [...tableEl.querySelectorAll("tr")];
    return trs.map(tr => [...tr.children].map(cell => cell.textContent.trim()));
}

function amsExportTableToCsv(filename, tableEl) {
    const rows = amsTableToRows(tableEl);
    amsDownloadFile(rows.map(amsCsvRow).join("\r\n"), `${filename}.csv`, "text/csv");
}

/* Excel export - real .xlsx via the shared SheetJS helper (js/xlsx-helpers.js).
   Kept as a wrapper so every existing "Export Excel" button keeps working. */
function amsExportTableToExcel(filename, tableEl) {
    amsExportTableToXlsx(filename, tableEl);
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for GENERIC PRINT (company letterhead via print-docs.js) -----*/
function amsPrintReport(title, tableEl) {
    const today = amsFormatDate(new Date().toISOString().slice(0, 10));
    const clone = tableEl.cloneNode(true);
    clone.querySelectorAll(".col-filter-row").forEach(tr => tr.remove());
    const headerHtml = amsBuildPrintHeader(title, `
        <div class="pf-form-title">${amsEsc(title).toUpperCase()}</div>
        <div><strong>Generated:</strong> ${today}</div>`, "Asset Management System · Report Master");
    const content = `
        ${headerHtml}
        <table class="pf-asset-table">${clone.innerHTML}</table>
        <div class="pf-footer"><span>AMS v4 - Generated electronically from Report Master</span></div>`;
    /* Hard-copy records for filing are printed on A4 portrait. */
    amsPrintDocument(content, title, "portrait");
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for REPORT APPEARANCE (header editor) --------------*/
/* Renders a live on-screen preview of the chosen print letterhead, so users can
   see what will show on reports before printing. Mirrors amsBuildPrintHeader()
   from js/print-docs.js (which the actual print window uses). */
function amsRenderReportHeaderPreview() {
    const box = document.getElementById("reportHeaderPreview");
    if (!box) return;
    const c = amsGetCompanyDetails();
    const p = amsGetReportHeaderPrefs();

    const nameHtml = p.showName ? `<div class="rp-name">${amsEsc(c.companyName || "Your Company Name Pvt. Ltd.")}</div>` : "";
    const sloganHtml = (p.showSlogan && c.slogan) ? `<div class="rp-slogan">${amsEsc(c.slogan)}</div>` : "";
    const subHtml = p.showAddress ? `<div class="rp-sub">${amsEsc(c.address || "Asset Management System")}</div>` : "";
    const texts = nameHtml + sloganHtml + subHtml;

    let inner;
    if (p.style === "banner" && c.bannerDataUrl) {
        inner = `<div class="rp-banner"><img src="${c.bannerDataUrl}" alt="Banner preview"></div>` +
            (texts ? `<div class="rp-caption">${texts}</div>` : "");
    } else if (p.style === "banner") {
        inner = `<span class="rp-empty">Banner style selected - upload a rectangular banner in Company Master to see it here. Showing classic header meanwhile.</span>`;
    } else {
        inner = `<div class="rp-block">
            ${p.showLogo && c.logoDataUrl ? `<img class="rp-logo" src="${c.logoDataUrl}" alt="Logo preview">` : ""}
            <div>${texts || `<span class="rp-empty">All company text is hidden for printing.</span>`}</div>
        </div>`;
    }
    box.innerHTML = inner;
}

function amsLoadReportAppearance() {
    const prefs = amsGetReportHeaderPrefs();
    const radio = document.querySelector(`input[name="rpStyle"][value="${amsEsc(prefs.style)}"]`);
    if (radio) radio.checked = true;
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    };
    setCheck("rpShowLogo", prefs.showLogo);
    setCheck("rpShowName", prefs.showName);
    setCheck("rpShowSlogan", prefs.showSlogan);
    setCheck("rpShowAddress", prefs.showAddress);
    amsRenderReportHeaderPreview();
}

function amsWireReportAppearance() {
    const toggle = document.getElementById("btnReportAppearance");
    const panel = document.getElementById("reportAppearancePanel");
    if (toggle && panel) {
        toggle.addEventListener("click", () => {
            const open = panel.classList.toggle("open");
            toggle.textContent = open ? "Hide Report Appearance" : "Report Appearance";
        });
    }

    document.querySelectorAll('input[name="rpStyle"]').forEach(r => {
        r.addEventListener("change", () => {
            const prefs = amsGetReportHeaderPrefs();
            prefs.style = r.value;
            amsSaveReportHeaderPrefs(prefs);
            amsRenderReportHeaderPreview();
            amsNotify("Report header style updated", "success");
        });
    });

    const prefsCheckboxes = [
        ["rpShowLogo", "showLogo"],
        ["rpShowName", "showName"],
        ["rpShowSlogan", "showSlogan"],
        ["rpShowAddress", "showAddress"],
    ];
    prefsCheckboxes.forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", () => {
            const prefs = amsGetReportHeaderPrefs();
            prefs[key] = el.checked;
            amsSaveReportHeaderPrefs(prefs);
            amsRenderReportHeaderPreview();
            amsNotify("Report header appearance updated", "success");
        });
    });
    amsLoadReportAppearance();
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for WIRE UP ALL EXPORT / PRINT / FILTER BUTTONS ------*/
function amsWireReportButtons() {
    /* Asset Lifecycle */
    document.getElementById("btnAlFilter").addEventListener("click", amsRenderAssetLifecycleReport);
    document.getElementById("btnAlPrint").addEventListener("click", () => amsPrintReport("Asset Lifecycle Report", document.getElementById("alTable")));
    document.getElementById("btnAlCsv").addEventListener("click", () => amsExportTableToCsv("Asset_Lifecycle_Report", document.getElementById("alTable")));
    document.getElementById("btnAlXls").addEventListener("click", () => amsExportTableToExcel("Asset_Lifecycle_Report", document.getElementById("alTable")));

    /* Asset Issue / Handover */
    document.getElementById("issueSearch").addEventListener("input", () => amsRenderIssueHandoverTable("issueTable", "assign", "issueSearch", "issueSite", "issueFromDate", "issueToDate", "issueDept", "issueAssetType"));
    document.getElementById("handoverSearch").addEventListener("input", () => amsRenderIssueHandoverTable("handoverTable", "exit", "handoverSearch", "handoverSite", "handoverFromDate", "handoverToDate", "handoverDept", "handoverAssetType"));
    document.getElementById("btnIssueFilter").addEventListener("click", () => amsRenderIssueHandoverTable("issueTable", "assign", "issueSearch", "issueSite", "issueFromDate", "issueToDate", "issueDept", "issueAssetType"));
    document.getElementById("btnHandoverFilter").addEventListener("click", () => amsRenderIssueHandoverTable("handoverTable", "exit", "handoverSearch", "handoverSite", "handoverFromDate", "handoverToDate", "handoverDept", "handoverAssetType"));
    document.getElementById("btnIssuePrint").addEventListener("click", () => amsPrintReport("Asset Issue Form - All", document.getElementById("issueTable")));
    document.getElementById("btnHandoverPrint").addEventListener("click", () => amsPrintReport("Asset Handover Form - All", document.getElementById("handoverTable")));
    document.getElementById("btnIssueCsv").addEventListener("click", () => amsExportTableToCsv("Asset_Issue_Form_Records", document.getElementById("issueTable")));
    document.getElementById("btnIssueXls").addEventListener("click", () => amsExportTableToExcel("Asset_Issue_Form_Records", document.getElementById("issueTable")));
    document.getElementById("btnHandoverCsv").addEventListener("click", () => amsExportTableToCsv("Asset_Handover_Form_Records", document.getElementById("handoverTable")));
    document.getElementById("btnHandoverXls").addEventListener("click", () => amsExportTableToExcel("Asset_Handover_Form_Records", document.getElementById("handoverTable")));

    /* Consumable / Spare Parts stock log reports */
    document.getElementById("btnCrFilter").addEventListener("click", () => amsRenderStockLogReport(AMS_DUMMY_CONSUMABLE_LOG, "Restocked", "crSite", "crFromDate", "crToDate", "crTable"));
    document.getElementById("btnCuFilter").addEventListener("click", () => amsRenderStockLogReport(AMS_DUMMY_CONSUMABLE_LOG, "Used", "cuSite", "cuFromDate", "cuToDate", "cuTable"));
    document.getElementById("btnSrFilter").addEventListener("click", () => amsRenderStockLogReport(AMS_DUMMY_SPAREPART_LOG, "Restocked", "srSite", "srFromDate", "srToDate", "srTable"));
    document.getElementById("btnSuFilter").addEventListener("click", () => amsRenderStockLogReport(AMS_DUMMY_SPAREPART_LOG, "Used", "suSite", "suFromDate", "suToDate", "suTable"));

    document.getElementById("btnCrPrint").addEventListener("click", () => amsPrintReport("Consumable Restock Report", document.getElementById("crTable")));
    document.getElementById("btnCuPrint").addEventListener("click", () => amsPrintReport("Consumable Used Report", document.getElementById("cuTable")));
    document.getElementById("btnSrPrint").addEventListener("click", () => amsPrintReport("Spare Parts Restock Report", document.getElementById("srTable")));
    document.getElementById("btnSuPrint").addEventListener("click", () => amsPrintReport("Spare Parts Used Report", document.getElementById("suTable")));

    document.getElementById("btnCrCsv").addEventListener("click", () => amsExportTableToCsv("Consumable_Restock_Report", document.getElementById("crTable")));
    document.getElementById("btnCrXls").addEventListener("click", () => amsExportTableToExcel("Consumable_Restock_Report", document.getElementById("crTable")));
    document.getElementById("btnCuCsv").addEventListener("click", () => amsExportTableToCsv("Consumable_Used_Report", document.getElementById("cuTable")));
    document.getElementById("btnCuXls").addEventListener("click", () => amsExportTableToExcel("Consumable_Used_Report", document.getElementById("cuTable")));

    document.getElementById("btnSrCsv").addEventListener("click", () => amsExportTableToCsv("Spare_Parts_Restock_Report", document.getElementById("srTable")));
    document.getElementById("btnSrXls").addEventListener("click", () => amsExportTableToExcel("Spare_Parts_Restock_Report", document.getElementById("srTable")));
    document.getElementById("btnSuCsv").addEventListener("click", () => amsExportTableToCsv("Spare_Parts_Used_Report", document.getElementById("suTable")));
    document.getElementById("btnSuXls").addEventListener("click", () => amsExportTableToExcel("Spare_Parts_Used_Report", document.getElementById("suTable")));

    document.querySelectorAll("[data-clear-filters]").forEach(btn => {
        btn.addEventListener("click", () => {
            if (typeof amsFilterClearAndRender === "function") amsFilterClearAndRender(btn.getAttribute("data-clear-filters"));
        });
    });

    /* Asset Distribution report */
    document.getElementById("btnDistReportFilter").addEventListener("click", amsRenderAssetDistributionReport);
    document.getElementById("distReportSearch").addEventListener("input", amsRenderAssetDistributionReport);
    document.getElementById("btnDistReportCsv").addEventListener("click", () => amsExportTableToCsv("Asset_Distribution_Report", document.getElementById("distReportTable")));
    document.getElementById("btnDistReportXls").addEventListener("click", () => amsExportTableToXlsx("Asset_Distribution_Report", document.getElementById("distReportTable")));

    /* Click-to-print deep-links on Issue / Handover rows */
    document.addEventListener("click", (e) => {
        const link = e.target.closest("[data-report-emp]");
        if (!link) return;
        e.preventDefault();
        if (typeof amsGenerateReport === "function") {
            amsGenerateReport(link.getAttribute("data-report-emp"), link.getAttribute("data-report-type"));
        }
    });
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for ASSET DISTRIBUTION REPORT -----------------------*/
function amsBuildDistReportRows() {
    return (amsGetEmployeesForPortal() || []).map(emp => {
        const amsId = emp.amsId || emp.empId;
        const direct = amsOwnedEmployeeHoldings(amsId) || [];
        const team = amsTeamEmployeeHoldings(amsId) || [];
        return {
            empId: amsGetEmployeeDisplayId(emp), name: emp.name, dept: emp.dept || "", designation: emp.designation || "",
            directCount: direct.length, teamCount: team.length, total: direct.length + team.length,
        };
    });
}

function amsDistReportFiltered() {
    const search = (document.getElementById("distReportSearch").value || "").toLowerCase();
    return amsBuildDistReportRows().filter(r => {
        if (search) {
            const hay = `${r.name} ${r.empId} ${r.dept}`.toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });
}

function amsRenderAssetDistributionReport() {
    amsSortRegisterRenderer("distReportTable", amsRenderAssetDistributionReport);
    const getters = {
        empId: r => r.empId, name: r => r.name, dept: r => r.dept, designation: r => r.designation,
        direct: r => r.directCount, team: r => r.teamCount, total: r => r.total,
    };
    const colFiltered = amsFilterRows("distReportTable", amsDistReportFiltered(), getters);
    const rows = amsSortRows("distReportTable", colFiltered, getters);
    const body = rows.length
        ? rows.map(r => `<tr>
            <td class="mono">${amsEsc(r.empId)}</td>
            <td>${amsEsc(r.name)}</td>
            <td>${amsEsc(r.dept)}</td>
            <td>${amsEsc(r.designation) || "-"}</td>
            <td class="mono">${r.directCount}</td>
            <td class="mono">${r.teamCount}</td>
            <td class="mono"><strong>${r.total}</strong></td>
        </tr>`).join("")
        : `<tr><td colspan="7" style="color:var(--text-muted);text-align:center;">No employees match the current filters</td></tr>`;

    document.getElementById("distReportTable").innerHTML = `
        <thead><tr>
            ${amsSortableTh("distReportTable", "empId", "Emp ID")}
            ${amsSortableTh("distReportTable", "name", "Employee Name")}
            ${amsSortableTh("distReportTable", "dept", "Department")}
            ${amsSortableTh("distReportTable", "designation", "Designation")}
            ${amsSortableTh("distReportTable", "direct", "Direct")}
            ${amsSortableTh("distReportTable", "team", "Team")}
            ${amsSortableTh("distReportTable", "total", "Total")}
        </tr>${amsFilterHeadRow("distReportTable", ["empId", "name", "dept", "designation", "direct", "team", "total"])}</thead>
        <tbody>${body}</tbody>`;
    if (typeof amsFilterRestoreFocus === "function") amsFilterRestoreFocus("distReportTable");
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for PAGE INIT ---------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
    if (typeof initLayout === "function") initLayout("reports");
    amsWireReportTabs();
    amsWireReportAppearance();
    amsWireReportButtons();
    (typeof amsDbEnsureLoaded === "function" ? amsDbEnsureLoaded() : Promise.resolve()).then(() => {
        amsApplyReportTabAccess();
        amsPopulateSiteFilters();
        amsPopulateIssueHandoverExtraFilters();
        amsRenderAssetLifecycleReport();
        amsRenderIssueHandoverTable("issueTable", "assign", "issueSearch", "issueSite", "issueFromDate", "issueToDate", "issueDept", "issueAssetType");
        amsRenderIssueHandoverTable("handoverTable", "exit", "handoverSearch", "handoverSite", "handoverFromDate", "handoverToDate", "handoverDept", "handoverAssetType");
        amsRenderStockLogReport(AMS_DUMMY_CONSUMABLE_LOG, "Restocked", "crSite", "crFromDate", "crToDate", "crTable");
        amsRenderStockLogReport(AMS_DUMMY_CONSUMABLE_LOG, "Used", "cuSite", "cuFromDate", "cuToDate", "cuTable");
        amsRenderStockLogReport(AMS_DUMMY_SPAREPART_LOG, "Restocked", "srSite", "srFromDate", "srToDate", "srTable");
        amsRenderStockLogReport(AMS_DUMMY_SPAREPART_LOG, "Used", "suSite", "suFromDate", "suToDate", "suTable");
        amsRenderAssetDistributionReport();
    });
});
/*-------------- End of the code ------------------------------------------------*/
/*==============================================================================
#-------------- End of the code : REPORTS PAGE LOGIC ----------------------------
#------------------------------------------------------------------------------*/
