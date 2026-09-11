/*==============================================================================
#-------------- Start Code for : DUMMY DATA (dummy-data.js) -------------------
#
#  PURPOSE   : Provides sample / test data for the whole portal because we
#              are NOT connected to SQL Server yet.
#
#  HOW TO USE IN FUTURE (SQL SERVER MIGRATION) :
#    - Every data source below is a plain JavaScript array / object.
#    - When you connect SQL Server, replace each section with an AJAX / fetch
#      call that reads the same shape of data from your backend API.
#    - KEEP the property names identical so the pages that consume this data
#      do NOT need to change.
#
#  FILE MAP :
#    1. SHARED HELPERS  - date formatting, toast, CSV helpers (from v3-3)
#    2. NOTIFICATIONS   - toast + bell + activity log (from v3-3)
#    3. IDENTITY        - "Viewing As" role simulator (from v3-3)
#    4. ACCESSORIES     - accessory master (from v3-3)
#    5. LOOKUP MASTERS  - categories, makes, types, sites, departments
#    6. ASSETS          - full lifecycle model with Smart Asset IDs (from v3-3)
#    7. CONSUMABLES     - stock with restock/used log (from v3-3)
#    8. SPARE PARTS     - stock with restock/used log (from v3-3)
#    9. EMPLOYEE MASTER - employees, departments & assignment helpers
#   10. ROLES & USERS   - roles, user accounts, page registry, role access
#   11. COMPANY         - single company record for print letterheads
#   12. EXIT RECORDS    - snapshot of employee exits
#   13. ACTIVITY LOG    - recent events for the dashboard timeline
#   14. STATUS COLORS   - maps status text to a CSS badge class
#   15. SUMMARY HELPERS - simple count/total functions used by pages
#------------------------------------------------------------------------------*/

/* =============================================================================
   1) SHARED HELPERS  (used by every page)
   ===========================================================================*/

/* =============================================================================
   DATABASE / API LAYER  (AMS-TEST)
   -----------------------------------------------------------------------------
   The AMS-Test portal is backed by the SQL Server database "AMS-TEST" reached
   through the ASP.NET Core API (server\AMS.API). Business data is stored as
   JSON documents in the dbo.ams_collections table; this layer loads every
   collection into the global arrays below at startup and PUTs a collection
   back to the API whenever the in-memory data changes. SQL Server is the
   single source of truth - the arrays are just a live cache of the documents.

   AUTH : the portal is gated by login.html. A successful login returns a JWT
   stored under "ams_session" in localStorage; every API call sends it as a
   Bearer token. layout.js redirects to login.html when the session is missing
   or expired.
   ===========================================================================*/

const AMS_API_BASE = "";
const AMS_SESSION_KEY = "ams_session";

/* ---- session --------------------------------------------------------------- */
function amsGetSession() {
    try { return JSON.parse(localStorage.getItem(AMS_SESSION_KEY) || "null"); }
    catch (e) { return null; }
}
function amsSetSession(s) {
    try { localStorage.setItem(AMS_SESSION_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}
function amsClearSession() {
    try { localStorage.removeItem(AMS_SESSION_KEY); } catch (e) { /* storage unavailable */ }
}

/* Merge a partial update (e.g. new profile fields) into the stored session. */
function amsUpdateSession(partial) {
    const sess = amsGetSession() || {};
    Object.assign(sess, partial);
    amsSetSession(sess);
    return sess;
}

/* Log the current user out and return to the login page. */
function amsLogout() {
    try { localStorage.removeItem(AMS_VIEWING_AS_STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    amsClearSession();
    amsLoginRedirect();
}
function amsLoginRedirect() {
    const isPages = /\/pages\//.test(window.location.pathname);
    window.location.replace((isPages ? "../" : "") + "login.html");
}

/* ---- core API client ------------------------------------------------------- */
async function amsApiFetch(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers || {});
    const sess = amsGetSession();
    if (sess && sess.token) opts.headers["Authorization"] = "Bearer " + sess.token;
    if (opts.body !== undefined && typeof opts.body !== "string") {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(opts.body);
    }
    let res;
    try {
        res = await fetch(AMS_API_BASE + path, opts);
    } catch (e) {
        throw new Error("Cannot reach the AMS-Test API. Start server\\AMS.API (dotnet run) and refresh.");
    }
    if (res.status === 401) {
        amsClearSession();
        amsLoginRedirect();
        throw new Error("Session expired. Redirecting to login.");
    }
    if (!res.ok) {
        let msg = "API error " + res.status;
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) { /* non-JSON error */ }
        throw new Error(msg);
    }
    const text = await res.text();
    try { return text ? JSON.parse(text) : null; } catch (e) { return text; }
}
function amsApiGet(path)   { return amsApiFetch(path, { method: "GET" }); }
function amsApiPut(path, body)   { return amsApiFetch(path, { method: "PUT", body }); }
function amsApiDelete(path) { return amsApiFetch(path, { method: "DELETE" }); }

/* ---- runtime copies of the DB documents (loaded from the API at startup) ---- */
let AMS_ROLE_ACCESS_DEFAULTS = {};
let AMS_REPORT_HEADER_PREFS  = {};

/* ---- collection registry: DB key -> the in-memory global that holds it ------ */
const AMS_COLLECTIONS = {
    assets:          () => DUMMY_ASSETS,
    employees:       () => DUMMY_EMPLOYEES,
    assetTypes:      () => AMS_DUMMY_ASSET_TYPES,
    assetMakes:      () => AMS_DUMMY_ASSET_MAKES,
    assetCategories: () => AMS_DUMMY_ASSET_CATEGORIES,
    sites:           () => AMS_DUMMY_SITES,
    departments:     () => AMS_DUMMY_DEPARTMENTS,
    designations:    () => AMS_DESIGNATION_OPTIONS,
    vendors:         () => AMS_DUMMY_VENDORS,
    consumables:     () => AMS_DUMMY_CONSUMABLES,
    consumableLog:   () => AMS_DUMMY_CONSUMABLE_LOG,
    spareParts:      () => AMS_DUMMY_SPARE_PARTS,
    sparePartLog:    () => AMS_DUMMY_SPAREPART_LOG,
    accessories:     () => AMS_DUMMY_ACCESSORIES,
    mobiles:         () => DUMMY_MOBILES,
    simCards:        () => AMS_DUMMY_SIM_CARDS,
    simOperators:    () => AMS_DUMMY_SIM_OPERATORS,
    simPlans:        () => AMS_DUMMY_SIM_PLANS,
    consumableCategories: () => AMS_DUMMY_CONSUMABLE_CATEGORIES,
    consumableUnits: () => AMS_DUMMY_CONSUMABLE_UNITS,
    sparePartCategories: () => AMS_DUMMY_SPAREPART_CATEGORIES,
    vendorCategories: () => AMS_DUMMY_VENDOR_CATEGORIES,
    users:           () => AMS_DUMMY_USERS,
    exitRecords:     () => AMS_DUMMY_EXIT_RECORDS,
};

/* ---- document (object) collections: stored as a single JSON object ---------- */
const AMS_DOC_COLLECTIONS = {
    company:     () => AMS_DUMMY_COMPANY_DETAILS,
    roleAccess:  () => AMS_ROLE_ACCESS_DEFAULTS,
    reportPrefs: () => AMS_REPORT_HEADER_PREFS,
};

let AMS_DB_LOADING = null;   /* idempotent load promise */
let AMS_DB_READY   = false;

async function amsDbLoadAll() {
    if (AMS_DB_READY) return;
    if (AMS_DB_LOADING) return AMS_DB_LOADING;
    AMS_DB_LOADING = (async () => {
        await Promise.all(Object.keys(AMS_COLLECTIONS).map(async key => {
            let items = [];
            try { items = await amsApiGet("/api/collection/" + key); }
            catch (e) { console.warn("[amsDb] load " + key + " failed: " + e.message); }
            const arr = AMS_COLLECTIONS[key]();
            arr.length = 0;
            if (Array.isArray(items)) arr.push.apply(arr, items);
        }));
        await Promise.all(Object.keys(AMS_DOC_COLLECTIONS).map(async key => {
            let doc = null;
            try { doc = await amsApiGet("/api/collection/" + key); }
            catch (e) { console.warn("[amsDb] load " + key + " failed: " + e.message); }
            const target = AMS_DOC_COLLECTIONS[key]();
            if (doc && typeof doc === "object") Object.assign(target, doc);
        }));
        const accMax = AMS_DUMMY_ACCESSORIES.reduce((m, a) =>
            Math.max(m, parseInt(String(a.accCode || "0").replace(/\D/g, ""), 10) || 0), 0);
        if (accMax >= AMS_ACC_SEQ) AMS_ACC_SEQ = accMax + 1;
        const venMax = AMS_DUMMY_VENDORS.reduce((m, v) =>
            Math.max(m, parseInt(String(v.vendorId || "0").replace(/\D/g, ""), 10) || 0), 0);
        if (venMax >= AMS_VENDOR_SEQ) AMS_VENDOR_SEQ = venMax + 1;
        const makesBackfilled = amsBackfillAssetMakeCodes();
        amsMigrateEmployeeNames();
        await amsMergeLoginUsersIntoProfiles();
        AMS_DB_READY = true;
        if (typeof amsMigrateRoleAccessDocument === "function") amsMigrateRoleAccessDocument();
        if (makesBackfilled) amsDbSaveAsync("assetMakes");
    })();
    return AMS_DB_LOADING;
}
function amsDbEnsureLoaded() { return amsDbLoadAll(); }
function amsDbIsReady() { return AMS_DB_READY; }

function amsWritesBlocked() {
    if (typeof amsUserCanWriteCurrentPage !== "function") return false;
    return !amsUserCanWriteCurrentPage();
}

/* Persist an array collection back to SQL Server (wholesale replace). */
async function amsDbSave(key) {
    if (amsWritesBlocked()) return;
    const getter = AMS_COLLECTIONS[key];
    if (!getter) return;
    try { await amsApiPut("/api/collection/" + key, getter()); }
    catch (e) { amsToast("Save failed: " + e.message, "danger"); throw e; }
}

/* Persist a document collection (object) back to SQL Server. */
async function amsDbSaveDoc(key) {
    if (amsWritesBlocked() && key !== "roleAccess") return;
    const getter = AMS_DOC_COLLECTIONS[key];
    if (!getter) return;
    try { await amsApiPut("/api/collection/" + key, getter()); }
    catch (e) { amsToast("Save failed: " + e.message, "danger"); throw e; }
}

/* Persist whichever collection owns the given array reference (used by the
   master-table engine and other generic mutators that don't know the key). */
function amsDbKeyForArray(arr) {
    if (!arr) return null;
    for (const key of Object.keys(AMS_COLLECTIONS)) {
        if (AMS_COLLECTIONS[key]() === arr) return key;
    }
    return null;
}
async function amsDbSaveArray(arr) {
    const key = amsDbKeyForArray(arr);
    if (key) await amsDbSave(key);
}

/* Convenience: fire-and-forget save (keeps the UI responsive; errors still
   surface through amsDbSave's toast). */
/* Bulk import (and similar batch mutators) suspend fire-and-forget PUTs so
   overlapping wholesale replaces cannot wipe rows added earlier in the same
   pass. Callers MUST persist once after resume. */
let AMS_DB_SAVE_SUSPEND = 0;
function amsDbSuspendSaves() { AMS_DB_SAVE_SUSPEND += 1; }
function amsDbResumeSaves() { if (AMS_DB_SAVE_SUSPEND > 0) AMS_DB_SAVE_SUSPEND -= 1; }
function amsDbSavesSuspended() { return AMS_DB_SAVE_SUSPEND > 0; }

function amsDbSaveAsync(key) {
    if (!amsDbIsReady() || AMS_DB_SAVE_SUSPEND > 0) return;
    amsDbSave(key).catch(() => {});
}
function amsDbSaveDocAsync(key) {
    if (!amsDbIsReady() || AMS_DB_SAVE_SUSPEND > 0) return;
    amsDbSaveDoc(key).catch(() => {});
}

/* Converts stored ISO date (yyyy-mm-dd) to dd-mm-yyyy for display in the UI */
function amsFormatDate(iso) {
    if (!iso) return "";
    const parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
}

/* Reverse of amsFormatDate: dd-mm-yyyy (e.g. from CSV import) back to ISO */
function amsParseDMY(dmy) {
    if (!dmy) return "";
    const parts = String(dmy).trim().split("-");
    if (parts.length !== 3) return dmy;
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/* Toast notification - types: info | success | warning | danger */
function amsToast(message, type) {
    type = type || "info";
    /* Settings > Notifications can turn popups off (history still records) */
    if (!amsGetToastEnabled()) return;
    let container = document.getElementById("amsToastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "amsToastContainer";
        container.className = "ams-toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `ams-toast ams-toast-${type}`;
    toast.textContent = message;
    toast.addEventListener("click", () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    });
    container.appendChild(toast);
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
    raf(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

/* Escapes a value for safe CSV output */
function amsCsvRow(arr) {
    return arr.map(v => {
        v = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(",");
}

/* Parses CSV text into an array of arrays (handles quoted fields) */
function amsParseCsv(text) {
    const rows = []; let row = [], field = "", inQuotes = false;
    text = text.replace(/\r\n/g, "\n");
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
            else field += c;
        } else {
            if (c === '"') inQuotes = true;
            else if (c === ",") { row.push(field); field = ""; }
            else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
            else field += c;
        }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r[0] !== undefined && r[0] !== ""));
}

/* Triggers a browser download for text content (CSV / TXT export) */
function amsDownloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* Shows the shared "Import report" modal after a bulk CSV import.
   results: [ { row, record, result, reason } ] where result is one of
   "added" | "updated" | "skipped" | "error". Rows skipped because of a missing
   Department / Designation carry `missingDept` / `missingDesig` tags so a
   Supreme Root user can add those lookups right from the report. The modal is
   built on the fly (no page markup needed) using only theme-variable styles. */
function amsShowImportReport(results) {
    document.getElementById("amsImportReportOverlay")?.remove();

    const count = r => results.filter(x => x.result === r).length;
    const added = count("added"), updated = count("updated");
    const skipped = count("skipped"), errors = count("error");
    const total = results.length;

    const chip = (label, value, cls) => `
        <span class="badge ${cls}" style="font-size:12px; padding:6px 10px; display:inline-flex; align-items:center; gap:6px;">
            ${label}: <strong>${value}</strong>
        </span>`;

    const rowsHtml = results.length
        ? results.map(r => `
            <tr>
                <td class="mono">${amsEsc(r.row)}</td>
                <td>${amsEsc(r.record || "-")}</td>
                <td>
                    ${r.result === "added" ? `<span class="badge badge-green">Added</span>`
                        : r.result === "updated" ? `<span class="badge badge-blue">Updated</span>`
                        : r.result === "skipped" ? `<span class="badge badge-amber">Skipped</span>`
                        : `<span class="badge badge-red">Error</span>`}
                </td>
                <td>${amsEsc(r.reason || "")}</td>
            </tr>`).join("")
        : `<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No rows were read from the file.</td></tr>`;

    /* ---- Missing lookups quick-add (Supreme Root only) ---- */
    const isSupreme = typeof amsGetViewingAsRole === "function" && amsGetViewingAsRole() === "Supreme Root";
    const missingDepts = [...new Set(results.filter(r => r.missingDept).map(r => r.missingDept).filter(Boolean))];
    const missingDesigs = [...new Set(results.filter(r => r.missingDesig).map(r => r.missingDesig).filter(Boolean))];
    let lookupsHtml = "";
    if (isSupreme && (missingDepts.length || missingDesigs.length)) {
        const deptChips = missingDepts.map(d => `
            <span class="badge badge-amber lookup-chip" style="padding:5px 10px; display:inline-flex; align-items:center; gap:8px;"
                  data-missing-dept="${amsEsc(d)}">
                Department: <strong>${amsEsc(d)}</strong>
                <button class="btn btn-primary" style="padding:3px 10px; font-size:12px;" data-add-dept="${amsEsc(d)}">Add</button>
            </span>`).join("");
        const desigChips = missingDesigs.map(d => `
            <span class="badge badge-amber lookup-chip" style="padding:5px 10px; display:inline-flex; align-items:center; gap:8px;"
                  data-missing-desig="${amsEsc(d)}">
                Designation: <strong>${amsEsc(d)}</strong>
                <button class="btn btn-primary" style="padding:3px 10px; font-size:12px;" data-add-desig="${amsEsc(d)}">Add</button>
            </span>`).join("");
        lookupsHtml = `
            <div style="border:1px solid var(--border); border-radius:8px; padding:10px 12px; margin-bottom:12px; background:var(--bg-elevated);">
                <div style="font-weight:700; margin-bottom:6px;">Missing lookups from this file (Supreme Root)</div>
                <div style="color:var(--text-secondary); font-size:12px; margin-bottom:8px;">
                    The import file uses ${missingDepts.length + missingDesigs.length} lookup(s) not in the masters yet.
                    Add them here, then re-import the file to add the skipped rows.
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;" id="amsMissingLookups">
                    ${deptChips}${desigChips}
                </div>
            </div>`;
    }

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "amsImportReportOverlay";
    overlay.style.display = "flex";
    overlay.innerHTML = `
        <div class="modal" style="width:720px; max-width:92vw;">
            <div class="modal-header">
                <h3>Import Report</h3>
                <button class="modal-close" data-ams-close-import-report>&times;</button>
            </div>
            <div class="modal-body">
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
                    ${chip("Total rows", total, "badge-grey")}
                    ${chip("Added", added, "badge-green")}
                    ${chip("Updated", updated, "badge-blue")}
                    ${chip("Skipped", skipped, "badge-amber")}
                    ${chip("Errors", errors, "badge-red")}
                </div>
                ${lookupsHtml}
                <div style="border:1px solid var(--border); border-radius:8px;">
                    <table class="table" style="margin:0;">
                        <thead>
                            <tr><th style="width:56px;">Row</th><th>Record</th><th style="width:110px;">Result</th><th>Reason</th></tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="ams-download-import-report">Download Report</button>
                <button class="btn btn-primary" data-ams-close-import-report>Done</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    /* ---- Wire: close + download report ---- */
    overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay || ev.target.closest("[data-ams-close-import-report]")) {
            overlay.remove();
        }
    });
    const dlBtn = document.getElementById("ams-download-import-report");
    if (dlBtn) dlBtn.addEventListener("click", () => {
        const lines = [["Row", "Record", "Result", "Reason"],
            ...results.map(r => [r.row, r.record, r.result, r.reason])];
        amsDownloadFile(lines.map(amsCsvRow).join("\r\n"), "Import_Report.csv", "text/csv");
    });

    /* ---- Wire: quick-add missing Department / Designation ---- */
    overlay.addEventListener("click", (ev) => {
        const addDeptBtn = ev.target.closest("[data-add-dept]");
        if (addDeptBtn) { amsQuickAddDeptFromReport(addDeptBtn.getAttribute("data-add-dept"), addDeptBtn); return; }
        const addDesigBtn = ev.target.closest("[data-add-desig]");
        if (addDesigBtn) { amsQuickAddDesigFromReport(addDesigBtn.getAttribute("data-add-desig"), addDesigBtn); return; }
        const saveDept = ev.target.closest("[data-save-dept]");
        if (saveDept) {
            const wrap = saveDept.closest("[data-dept-editor]");
            const short = wrap.querySelector("[data-dept-short]").value.trim().toUpperCase();
            const name = saveDept.getAttribute("data-save-dept");
            if (!short) { amsToast("Shortform is required for the department.", "warning"); return; }
            if (amsDeptKnown(name)) { amsToast("Department already exists.", "warning"); return; }
            amsEnsureDepartment(name, short); /* adds to BOTH masters + persists */
            amsToast(`Department "${name}" added to the Department Master.`, "success");
            const chip = wrap.closest(".lookup-chip");
            if (chip) chip.outerHTML = `<span class="badge badge-green" style="padding:5px 10px;">Department: <strong>${amsEsc(name)}</strong> - added</span>`;
        }
    });
}

/* Inline editor for adding a missing Department straight from the Import Report */
function amsQuickAddDeptFromReport(name, btn) {
    if (amsDeptKnown(name)) {
        btn.outerHTML = `<span class="badge badge-green">Added</span>`;
        return;
    }
    const suggestion = (name.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "NEW").toUpperCase();
    btn.closest(".lookup-chip").outerHTML = `
        <span class="badge badge-amber lookup-chip" style="padding:5px 10px; display:inline-flex; align-items:center; gap:8px;" data-dept-editor="${amsEsc(name)}">
            Department: <strong>${amsEsc(name)}</strong>
            <input type="text" value="${amsEsc(suggestion)}" maxlength="4" style="width:60px; padding:3px 6px; font-size:12px;" data-dept-short title="Shortform used inside AMS Employee IDs (max 4 letters)">
            <button class="btn btn-primary" style="padding:3px 10px; font-size:12px;" data-save-dept="${amsEsc(name)}">Save</button>
        </span>`;
}

/* Adds a missing Designation straight from the Import Report (no extra data needed) */
function amsQuickAddDesigFromReport(name, btn) {
    if (amsDesigKnown(name)) {
        btn.outerHTML = `<span class="badge badge-green">Added</span>`;
        return;
    }
    amsEnsureDesignation(name); /* adds to BOTH masters + persists */
    amsToast(`Designation "${name}" added to the Designation Master.`, "success");
    btn.closest(".lookup-chip").outerHTML = `<span class="badge badge-green" style="padding:5px 10px;">Designation: <strong>${amsEsc(name)}</strong> - added</span>`;
}

/* Escapes text for safe HTML insertion */
function amsEsc(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

/* Unique, trimmed, case-insensitive values for toolbar filter dropdowns. */
function amsUniqueSorted(values) {
    const seen = {};
    const out = [];
    (values || []).forEach(v => {
        const s = String(v == null ? "" : v).trim();
        if (!s) return;
        const k = s.toLowerCase();
        if (seen[k]) return;
        seen[k] = true;
        out.push(s);
    });
    out.sort((a, b) => a.localeCompare(b));
    return out;
}

/* Rebuilds a <select> while keeping the current value when it is still valid. */
function amsFillSelectOptions(selectEl, allLabel, values) {
    if (!selectEl) return;
    const prev = selectEl.value;
    const list = values || [];
    selectEl.innerHTML = `<option value="">${amsEsc(allLabel)}</option>` +
        list.map(v => `<option value="${amsEsc(v)}">${amsEsc(v)}</option>`).join("");
    if (prev && (prev === "" || list.indexOf(prev) !== -1)) selectEl.value = prev;
}

/* Company Employee ID for a history / report row. Stored empId may be the
   hidden AMS ID (portal view-model) or the company ID; never show AMS IDs
   except on Supreme Root-only screens. */
function amsHistoryEmpDisplayId(h) {
    if (!h) return "";
    const raw = h.empId || h.empCode || "";
    if (!raw) return "";
    const emp = (typeof findEmployeeAny === "function" && findEmployeeAny(raw))
        || (typeof amsGetEmployeeByAmsId === "function" && amsGetEmployeeByAmsId(raw))
        || null;
    return emp ? amsGetEmployeeDisplayId(emp) : raw;
}

/* =============================================================================
   2) NOTIFICATIONS  (toast + persistent bell + append-only activity log)
   ===========================================================================*/

const AMS_NOTIF_STORAGE_KEY = "ams_notifications";
const AMS_NOTIF_MAX = 50;

function amsGetNotifications() {
    try { return JSON.parse(localStorage.getItem(AMS_NOTIF_STORAGE_KEY)) || []; }
    catch (e) { return []; }
}
function amsSaveNotifications(list) {
    try { localStorage.setItem(AMS_NOTIF_STORAGE_KEY, JSON.stringify(list.slice(0, AMS_NOTIF_MAX))); } catch (e) { /* storage full */ }
}

/* Separate from the bell on purpose - the bell's "Clear All" must never erase
   the permanent audit trail Log Report reads from. Append-only from amsNotify(). */
const AMS_LOG_STORAGE_KEY = "ams_activity_log";
const AMS_LOG_MAX = 1000;

function amsGetActivityLog() {
    try { return JSON.parse(localStorage.getItem(AMS_LOG_STORAGE_KEY)) || []; }
    catch (e) { return []; }
}
function amsSaveActivityLog(list) {
    try { localStorage.setItem(AMS_LOG_STORAGE_KEY, JSON.stringify(list.slice(0, AMS_LOG_MAX))); } catch (e) { /* storage full */ }
}

function amsTimeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

/* Call this from ANY page to notify: amsNotify("message", "success") */
function amsNotify(message, type) {
    type = type || "info";
    const entry = {
        message, type, time: new Date().toISOString(),
        actorRole: (typeof amsGetViewingAsRole === "function") ? amsGetViewingAsRole() : "Standard User",
        page: document.title.replace(/^.* - /, "") || location.pathname,
    };
    const list = amsGetNotifications();
    list.unshift(entry);
    amsSaveNotifications(list);
    const log = amsGetActivityLog();
    log.unshift(entry);
    amsSaveActivityLog(log);
    amsToast(message, type);
    amsRenderBell();
}

function amsRenderBell() {
    const list = amsGetNotifications();
    const badge = document.getElementById("notifBellBadge");
    if (badge) {
        if (list.length) { badge.textContent = list.length > 9 ? "9+" : list.length; badge.style.display = "flex"; }
        else badge.style.display = "none";
    }
    const panel = document.getElementById("notifBellList");
    if (!panel) return;
    panel.innerHTML = list.length
        ? list.map(n => `
            <div class="notif-item">
              <span class="notif-dot notif-${n.type}"></span>
              <div>
                <div class="notif-msg">${amsEsc(n.message)}</div>
                <div class="notif-time">${amsTimeAgo(n.time)}</div>
              </div>
            </div>`).join("")
        : `<div class="notif-empty">No notifications yet</div>`;
}

function amsInitBell() {
    const trigger = document.getElementById("notifBellTrigger");
    const panel = document.getElementById("notifBellPanel");
    if (!trigger || !panel) return;
    amsRenderBell();
    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        panel.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#notifBellPanel") && !e.target.closest("#notifBellTrigger")) panel.classList.remove("open");
    });
    const clearBtn = document.getElementById("notifClearAll");
    if (clearBtn) clearBtn.addEventListener("click", () => { amsSaveNotifications([]); amsRenderBell(); });
    window.addEventListener("storage", (e) => { if (e.key === AMS_NOTIF_STORAGE_KEY) amsRenderBell(); });
}

/* =============================================================================
   3) IDENTITY  ("Viewing As" role simulator - localStorage-backed so the role
      stays consistent across pages, like theme choice)
   ===========================================================================*/

const AMS_VIEWING_AS_STORAGE_KEY = "ams_viewing_as_role";

/* The "Viewing As" role simulator was removed in favour of the logged-in
   account. amsGetViewingAsRole() now resolves to the real session role so
   existing page code (role guards, hints) keeps working unchanged. */
function amsGetViewingAsRole() {
    try {
        const session = amsGetSession();
        if (session && session.role) return session.role;
        return "Standard User";
    }
    catch (e) { return "Standard User"; }
}
function amsSetViewingAsRole(role) {
    /* Compatibility stub - role is always the real session role now. */
    if (role) { try { localStorage.removeItem(AMS_VIEWING_AS_STORAGE_KEY); } catch (e) { /* ignore */ } }
}

/* =============================================================================
   4) ACCESSORIES  (common / supportive accessories, linked to an Asset Type)
   ===========================================================================*/

let AMS_ACC_SEQ = 24;
const AMS_DUMMY_ACCESSORIES = [];


/* Options for the Assign/Reassign/Replace checklist - active accessories for an Asset Type */
function amsGetAccessoryOptions(assetType) {
    return AMS_DUMMY_ACCESSORIES.filter(a => a.assetType === assetType && a.active).map(a => a.name);
}

/* Quick-add from the checklist "+" - adds straight to the shared master list */
function amsQuickAddAccessory(name, assetType) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_ACCESSORIES.some(a => a.assetType === assetType && a.name.toLowerCase() === trimmed.toLowerCase())) {
        return null;
    }
    AMS_ACC_SEQ += 1;
    AMS_DUMMY_ACCESSORIES.push({ accCode: `ACC-${String(AMS_ACC_SEQ).padStart(6, "0")}`, name: trimmed, assetType, site: "", active: true });
    amsDbSaveAsync("accessories");
    return trimmed;
}

let AMS_MAKE_SEQ = 0;

function amsNextMakeCode() {
    AMS_MAKE_SEQ += 1;
    return `MAKE-${String(AMS_MAKE_SEQ).padStart(6, "0")}`;
}

function amsBackfillAssetMakeCodes() {
    const makeMax = AMS_DUMMY_ASSET_MAKES.reduce((m, item) =>
        Math.max(m, parseInt(String(item.makeCode || "0").replace(/\D/g, ""), 10) || 0), 0);
    if (makeMax >= AMS_MAKE_SEQ) AMS_MAKE_SEQ = makeMax;
    let assigned = false;
    AMS_DUMMY_ASSET_MAKES.forEach(item => {
        if (!item.makeCode) {
            item.makeCode = amsNextMakeCode();
            assigned = true;
        }
        if (item.assetType == null) item.assetType = "";
    });
    return assigned;
}

function amsGetMakeOptions(assetType) {
    if (!assetType) return [];
    return AMS_DUMMY_ASSET_MAKES.filter(m => m.assetType === assetType && m.active).map(m => m.name);
}

function amsFillMakeSelect(selectEl, assetType, selected) {
    if (!selectEl) return;
    const options = amsGetMakeOptions(assetType);
    const keep = (selected || "").trim();
    const names = options.slice();
    if (keep && !names.some(n => n === keep)) names.unshift(keep);
    selectEl.innerHTML = names.map(n => `<option value="${amsEsc(n)}">${amsEsc(n)}</option>`).join("");
    if (keep) selectEl.value = keep;
}

function amsQuickAddMake(name, assetType) {
    const trimmed = (name || "").trim();
    const type = (assetType || "").trim();
    if (!trimmed || !type) return null;
    if (AMS_DUMMY_ASSET_MAKES.some(m =>
        String(m.assetType || "").toLowerCase() === type.toLowerCase()
        && String(m.name || "").toLowerCase() === trimmed.toLowerCase()
    )) {
        return null;
    }
    AMS_DUMMY_ASSET_MAKES.push({ makeCode: amsNextMakeCode(), name: trimmed, assetType: type, active: true });
    amsDbSaveAsync("assetMakes");
    return trimmed;
}

const AMS_CATEGORY_USED_ON = ["Assets", "Mobiles", "Both"];

function amsCategoryUsedOn(categoryName) {
    const c = AMS_DUMMY_ASSET_CATEGORIES.find(x => x.name === categoryName);
    return (c && c.usedOn) ? c.usedOn : "";
}

function amsCategoryMatchesPage(categoryName, pageKind) {
    const used = amsCategoryUsedOn(categoryName);
    if (!used) return false;
    if (used === "Both") return true;
    return used === pageKind;
}

function amsGetCategoryOptions(pageKind) {
    return AMS_DUMMY_ASSET_CATEGORIES.filter(c => c.active && amsCategoryMatchesPage(c.name, pageKind)).map(c => c.name);
}

function amsGetTypeOptions(pageKind, categoryName) {
    return AMS_DUMMY_ASSET_TYPES.filter(t => {
        if (!t.active || !t.category) return false;
        if (!amsCategoryMatchesPage(t.category, pageKind)) return false;
        if (categoryName && t.category !== categoryName) return false;
        return true;
    }).map(t => t.name);
}

function amsTypeBelongsToPage(typeName, pageKind) {
    const t = AMS_DUMMY_ASSET_TYPES.find(x => x.name === typeName);
    if (!t || !t.category) return false;
    return amsCategoryMatchesPage(t.category, pageKind);
}

function amsFillNamedSelect(selectEl, names, selected) {
    if (!selectEl) return;
    const keep = (selected || "").trim();
    const list = names.slice();
    if (keep && !list.some(n => n === keep)) list.unshift(keep);
    selectEl.innerHTML = list.map(n => `<option value="${amsEsc(n)}">${amsEsc(n)}</option>`).join("");
    if (keep) selectEl.value = keep;
}

function amsFillCategorySelect(selectEl, pageKind, selected) {
    amsFillNamedSelect(selectEl, amsGetCategoryOptions(pageKind), selected);
}

function amsFillTypeSelect(selectEl, pageKind, categoryName, selected) {
    amsFillNamedSelect(selectEl, amsGetTypeOptions(pageKind, categoryName), selected);
}

function amsQuickAddCategory(name, usedOn) {
    const trimmed = (name || "").trim();
    const used = (usedOn || "").trim();
    if (!trimmed || !used) return null;
    if (AMS_DUMMY_ASSET_CATEGORIES.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return null;
    AMS_DUMMY_ASSET_CATEGORIES.push({ name: trimmed, usedOn: used, active: true });
    amsDbSaveAsync("assetCategories");
    return trimmed;
}

function amsQuickAddAssetType(name, shortform, category) {
    const trimmed = (name || "").trim();
    const short = (shortform || "").trim().toUpperCase();
    const cat = (category || "").trim();
    if (!trimmed || !short || !cat) return null;
    if (AMS_DUMMY_ASSET_TYPES.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) return null;
    AMS_DUMMY_ASSET_TYPES.push({ name: trimmed, shortform: short, category: cat, active: true });
    amsDbSaveAsync("assetTypes");
    return trimmed;
}

/* Quick-add department from "Assign to Department +" */
function amsQuickAddDepartment(name, shortform) {
    const trimmedName = (name || "").trim();
    const trimmedShort = (shortform || "").trim().toUpperCase();
    if (!trimmedName || !trimmedShort) return null;
    if (AMS_DUMMY_DEPARTMENTS.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) return null;
    AMS_DUMMY_DEPARTMENTS.push({ name: trimmedName, shortform: trimmedShort, active: true });
    amsDbSaveAsync("departments");
    return trimmedName;
}

/* Quick-add designation (used by the "+" button next to the Designation field) */
function amsQuickAddDesignation(name) {
    const trimmedName = (name || "").trim();
    if (!trimmedName) return null;
    if (AMS_DESIGNATION_OPTIONS.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) return null;
    AMS_DESIGNATION_OPTIONS.push({ name: trimmedName, active: true });
    amsDbSaveAsync("designations");
    return trimmedName;
}

/* =============================================================================
   5) LOOKUP MASTERS  (fed to the generic master-table engine)
   ===========================================================================*/
const AMS_DUMMY_ASSET_CATEGORIES = [];
const AMS_DUMMY_ASSET_MAKES = [];


/* shortform matches the prefix used in Smart Asset IDs (e.g. LT00007HOIT -> LT = Laptop) */
const AMS_DUMMY_ASSET_TYPES = [];


/* shortform matches the site-code segment in Smart Asset IDs (e.g. LT00007HOIT -> HO = Mumbai HO) */
const AMS_DUMMY_SITES = [];


/* shortform is used inside the auto-generated AMS Employee ID: EMP-<shortform>-000001 */
const AMS_DUMMY_DEPARTMENTS = [];
const AMS_DESIGNATION_OPTIONS = [];


/* =============================================================================
   5a-2) UNIFIED DEPARTMENT / DESIGNATION LOOKUP HELPERS
   -----------------------------------------------------------------------------
   Departments & designations live in TWO parallel sources:
     - DEPARTMENTS / DESIGNATIONS  : hardcoded seeds used by the Employee form
                                     dropdowns, AMS Employee ID shortforms and
                                     the bulk-import reference check
     - AMS_DUMMY_DEPARTMENTS / AMS_DESIGNATION_OPTIONS : DB-backed arrays used
                                     by the Department/Designation Masters and
                                     the asset/report dropdowns
   These helpers keep BOTH in sync and persist to SQL Server, so a department
   or designation created ANYWHERE (Employee form, bulk import, Import Report
   quick-add) shows up in the Masters and survives navigation.
   ===========================================================================*/

/* Is this department known in EITHER master source? */
function amsDeptKnown(name) {
    const n = (name || "").trim().toLowerCase();
    if (!n) return false;
    if (DEPARTMENTS.some(d => d.name.toLowerCase() === n)) return true;
    return AMS_DUMMY_DEPARTMENTS.some(d => d.name.toLowerCase() === n);
}

/* Is this designation known in EITHER master source? (blank is always ok) */
function amsDesigKnown(name) {
    const n = (name || "").trim().toLowerCase();
    if (!n) return true;
    if (DESIGNATIONS.some(d => d.toLowerCase() === n)) return true;
    return AMS_DESIGNATION_OPTIONS.some(d => (d.name || "").toLowerCase() === n);
}

/* Ensures a department exists in BOTH masters (+ persists to SQL). Returns the
   shortform in use (derived from the masters, or the caller's value, or a best
   guess from the name). No-op if the department is already present. */
function amsEnsureDepartment(name, shortform) {
    const trimmedName = (name || "").trim();
    if (!trimmedName) return "";
    const trimmedShort = (shortform || "").trim().toUpperCase();
    const dbRec = AMS_DUMMY_DEPARTMENTS.find(d => d.name.toLowerCase() === trimmedName.toLowerCase());
    const seedRec = DEPARTMENTS.find(d => d.name.toLowerCase() === trimmedName.toLowerCase());
    const short = trimmedShort
        || (dbRec && dbRec.shortform)
        || (seedRec && seedRec.short)
        || (trimmedName.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "NEW").toUpperCase();
    if (!seedRec) DEPARTMENTS.push({ name: trimmedName, short });
    if (!dbRec) {
        AMS_DUMMY_DEPARTMENTS.push({ name: trimmedName, shortform: short, active: true });
        amsDbSaveAsync("departments");
    }
    return short;
}

/* Ensures a designation exists in BOTH masters (+ persists to SQL). Returns
   true if it was newly added to the DB-backed master. */
function amsEnsureDesignation(name) {
    const trimmedName = (name || "").trim();
    if (!trimmedName) return false;
    if (!DESIGNATIONS.some(d => d.toLowerCase() === trimmedName.toLowerCase())) {
        DESIGNATIONS.push(trimmedName);
    }
    if (AMS_DESIGNATION_OPTIONS.some(d => (d.name || "").toLowerCase() === trimmedName.toLowerCase())) return false;
    AMS_DESIGNATION_OPTIONS.push({ name: trimmedName, active: true });
    amsDbSaveAsync("designations");
    return true;
}


/* =============================================================================
   5b) ASSET ID HELPERS  (Smart Asset ID model - shared by Asset Master, Employee
   Master and Reports. Lookup shortforms come from the masters above.)
   ===========================================================================*/

/* shortform segment for an Asset Type (e.g. "Laptop" -> "LT") */
function amsTypeShort(typeName) { return (AMS_DUMMY_ASSET_TYPES.find(t => t.name === typeName) || {}).shortform || ""; }

/* shortform segment for a Site (e.g. "Mumbai HO" -> "HO") */
function amsSiteShort(siteName) { return (AMS_DUMMY_SITES.find(s => s.name === siteName) || {}).shortform || ""; }

/* shortform segment for a Department (e.g. "IT" -> "IT") */
function amsDeptShort(deptName) { return (AMS_DUMMY_DEPARTMENTS.find(d => d.name === deptName) || {}).shortform || ""; }

/* Base Display ID - the permanent type+sequence part (e.g. "LT00007") that does
   NOT change when the asset is assigned/transferred. Works even for records that
   have no explicit displayId field (older dummy entries). */
function amsBaseDisplayId(asset) {
    if (asset.displayId) return asset.displayId;
    const m = String(asset.id || "").match(/^[A-Za-z]+\d+/);
    return m ? m[0] : asset.id;
}

/* Employee view-model used by pages that work with asset assignments. Asset
   records link to employees via their AMS ID (empId mirror below), so the Smart
   Asset ID suffix resolves to the assignee's department. */
function amsGetEmployeeByAmsId(amsId) {
    const e = findEmployee(amsId);
    if (!e) return null;
    return {
        amsId: e.amsId,
        empId: e.amsId,            /* view: mirrors the AMS ID that assets store in assignedTo */
        empIdCompany: e.empId,     /* the company-issued ID, kept for reference */
        name: getEmployeeFullName(e),
        dept: e.department,
        designation: e.designation,
        contact: e.contact,
        email: e.email,
        status: e.status,
        reportsTo: e.managerAmsId,
        site: e.site || "",
    };
}

/* All employees in the view-model shape (includes exited/inactive, as the
   Asset Master must still resolve history rows that reference them) */
function amsGetEmployeesForPortal() {
    return DUMMY_EMPLOYEES.map(e => amsGetEmployeeByAmsId(e.amsId));
}

/* FULL Smart Asset ID = Base Display ID + CurrentSite + Assignee's Dept, only
   once the asset is Assigned. Unassigned assets stay on their base/short form.
   LEGACY assets (manually-typed / imported display IDs, isLegacyId) keep their
   original ID exactly - no site/department suffix is ever appended to them. */
function amsComputeFullId(asset) {
    const base = amsBaseDisplayId(asset);
    if (asset.isLegacyId) return base; /* legacy/custom IDs stay unchanged */
    if (!asset.assignedTo) return base; /* unassigned - base/short form only */
    const emp = amsGetEmployeeByAmsId(asset.assignedTo);
    const siteShort = amsSiteShort(asset.currentSite || asset.site);
    /* Assign to Department (optional) overrides the employee's own department for
       this suffix - e.g. a shared printer physically sitting in Sales, even if the
       Direct Employee responsible for it is from IT, should show as belonging to
       Sales, not IT. */
    const deptShort = amsDeptShort(asset.assignedDepartment || (emp ? emp.dept : ""));
    return `${base}${siteShort}${deptShort}`;
}

/* Asset ID to display on a printed form. Uses the COMPUTED full ID so an
   assigned asset always prints with its department suffix (base + site + dept),
   even if the stored id is an older base+site form. For snapshot records (exit
   reports) that have no live assignment, falls back to the stored id. */
function amsPrintAssetId(oa) {
    if (!oa) return "";
    const stored = oa.id || oa.assetId || "";
    if (oa.assignedTo || (typeof oa.id === "string" && oa.id && (oa.displayId || oa.currentSite || oa.site))) {
        const full = amsComputeFullId(oa);
        if (full) return full;
    }
    return stored;
}

/* =============================================================================
   6) ASSETS  (full lifecycle model with Smart Asset IDs - from v3-3)
   ===========================================================================*/

/* Status options. "Transfer" = in-transit between sites. "Not Working" = needs repair.
   "Retired / Scrapped" = permanently out of service. */
const AMS_ASSET_STATUS_OPTIONS = [
    "In Store", "Assigned", "In Repair", "Transfer", "Not Working", "Retired / Scrapped", "Replaced",
];
const DUMMY_ASSETS = [];
const DUMMY_MOBILES = [];


/* =============================================================================
   7) CONSUMABLES  (per-site stock with Restock/Used movement log)
   ===========================================================================*/

/* Consumable Category Master - DB-backed (consumableCategories collection).
   Previously a hardcoded string list; now records with a description, managed
   from System Admin > Consumable Category Master. */
const AMS_DUMMY_CONSUMABLE_CATEGORIES = [
    { name: "Printer Supplies", description: "", active: true },
    { name: "Cables",           description: "", active: true },
    { name: "Peripherals",      description: "", active: true },
    { name: "Stationery",       description: "", active: true },
    { name: "IT Accessories",   description: "", active: true },
];

/* Unit of Measure Master - DB-backed (consumableUnits collection). */
const AMS_DUMMY_CONSUMABLE_UNITS = [
    { name: "Nos",   description: "Number of pieces", active: true },
    { name: "Box",   description: "", active: true },
    { name: "Pack",  description: "", active: true },
    { name: "Ream",  description: "", active: true },
    { name: "Meter", description: "", active: true },
];

function amsGetActiveConsumableCategoryNames() {
    return AMS_DUMMY_CONSUMABLE_CATEGORIES.filter(c => c.active).map(c => c.name);
}
function amsGetActiveConsumableUnitNames() {
    return AMS_DUMMY_CONSUMABLE_UNITS.filter(u => u.active).map(u => u.name);
}

/* Quick-add helpers used by the Consumable Master "+" buttons. Return the new
   name on success, or null when it already exists (caller alerts). */
function amsQuickAddConsumableCategory(name, description) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_CONSUMABLE_CATEGORIES.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return null;
    AMS_DUMMY_CONSUMABLE_CATEGORIES.push({ name: trimmed, description: (description || "").trim(), active: true });
    amsDbSaveAsync("consumableCategories");
    return trimmed;
}
function amsQuickAddConsumableUnit(name, description) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_CONSUMABLE_UNITS.some(u => u.name.toLowerCase() === trimmed.toLowerCase())) return null;
    AMS_DUMMY_CONSUMABLE_UNITS.push({ name: trimmed, description: (description || "").trim(), active: true });
    amsDbSaveAsync("consumableUnits");
    return trimmed;
}

const AMS_DUMMY_CONSUMABLES = [];
const AMS_DUMMY_CONSUMABLE_LOG = [];


/* =============================================================================
   8) SPARE PARTS  (per-site stock with Restock/Used movement log)
   ===========================================================================*/

/* Spare Part Category Master - DB-backed (sparePartCategories collection).
   Previously a hardcoded string list; now records managed from System Admin >
   Spare Part Category Master. */
const AMS_DUMMY_SPAREPART_CATEGORIES = [
    { name: "Internal Component", description: "", active: true },
    { name: "Toner / Ink",        description: "", active: true },
    { name: "Mechanical Part",    description: "", active: true },
];

function amsGetActiveSparePartCategoryNames() {
    return AMS_DUMMY_SPAREPART_CATEGORIES.filter(c => c.active).map(c => c.name);
}
function amsQuickAddSparePartCategory(name, description) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_SPAREPART_CATEGORIES.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return null;
    AMS_DUMMY_SPAREPART_CATEGORIES.push({ name: trimmed, description: (description || "").trim(), active: true });
    amsDbSaveAsync("sparePartCategories");
    return trimmed;
}

const AMS_DUMMY_SPARE_PARTS = [];
const AMS_DUMMY_SPAREPART_LOG = [];


/* =============================================================================
   8a) SIM CARD MASTER  (mobile SIM cards issued to employees)
   ----------------------------------------------------------------------------
   A SIM card and a mobile phone are issued together to some users. The phone
   is tracked in Mobile Master (`DUMMY_MOBILES`); this collection stores the
   separate SIM record. Assigning either side keeps both in sync: the SIM's
   `linkedMobileId` is the phone's stable `amsAssetId`, and the phone's
   `simMobileNo` is the SIM mobile number. Rendered by pages/sim-cards.html
   + js/sim-cards.js in the same style as the Asset Master.
   ===========================================================================*/

const AMS_SIM_STATUS_OPTIONS = ["In Store", "Issued", "Blocked", "Retired"];

/* SIM Operator Master - DB-backed (simOperators collection). Previously a
   hardcoded string list (AMS_SIM_OPERATOR_OPTIONS) that could not be extended;
   now each operator is a record with details and can be added / edited /
   deactivated from the SIM Operator Master (System Admin > SIM Operator Master).
   The in-memory defaults below match the original hardcoded list so the form
   works even before the API is reachable; the DB is the source of truth. */
const AMS_DUMMY_SIM_OPERATORS = [
    { name: "Jio",           helpline: "198", website: "https://www.jio.com",  active: true },
    { name: "Airtel",        helpline: "198", website: "https://www.airtel.in", active: true },
    { name: "Vodafone Idea", helpline: "199", website: "https://www.myvi.in",  active: true },
    { name: "BSNL",          helpline: "1503", website: "https://www.bsnl.co.in", active: true },
    { name: "MTNL",          helpline: "1503", website: "https://www.mtnl.co.in", active: true },
];

/* SIM Plan Master - DB-backed (simPlans collection). Feeds the Plan datalist on
   the SIM Card form. */
const AMS_DUMMY_SIM_PLANS = [
    { name: "Prepaid",       planType: "Prepaid",  description: "", active: true },
    { name: "Postpaid",      planType: "Postpaid", description: "", active: true },
    { name: "Corporate Plan",planType: "Corporate",description: "", active: true },
];

const AMS_DUMMY_SIM_CARDS = [];

/* Active operator / plan names for the SIM Card form datalists */
function amsGetActiveSimOperatorNames() {
    return AMS_DUMMY_SIM_OPERATORS.filter(o => o.active).map(o => o.name);
}
function amsGetActiveSimPlanNames() {
    return AMS_DUMMY_SIM_PLANS.filter(p => p.active).map(p => p.name);
}

/* Ensures an operator exists in the SIM Operator Master (+ persists to SQL).
   Called when a SIM card is saved with an operator typed on the form that is not
   in the master yet - the new operator is registered automatically so it shows
   up in the master and as a suggestion next time. */
function amsEnsureSimOperator(name, helpline, website) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_SIM_OPERATORS.some(o => o.name.toLowerCase() === trimmed.toLowerCase())) return trimmed;
    AMS_DUMMY_SIM_OPERATORS.push({ name: trimmed, helpline: (helpline || "").trim(), website: (website || "").trim(), active: true });
    amsDbSaveAsync("simOperators");
    return trimmed;
}

/* Ensures a plan exists in the SIM Plan Master (+ persists to SQL). */
function amsEnsureSimPlan(name, planType, description) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_SIM_PLANS.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return trimmed;
    AMS_DUMMY_SIM_PLANS.push({ name: trimmed, planType: (planType || "").trim(), description: (description || "").trim(), active: true });
    amsDbSaveAsync("simPlans");
    return trimmed;
}

/* Quick-add from the SIM Card form "+" buttons - adds an operator / plan to its
   master (with details) and returns the name to fill into the form, or null if
   it already exists (validation handled by the caller's alert). */
function amsQuickAddSimOperator(name, helpline, website) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_SIM_OPERATORS.some(o => o.name.toLowerCase() === trimmed.toLowerCase())) return null;
    AMS_DUMMY_SIM_OPERATORS.push({ name: trimmed, helpline: (helpline || "").trim(), website: (website || "").trim(), active: true });
    amsDbSaveAsync("simOperators");
    return trimmed;
}
function amsQuickAddSimPlan(name, planType, description) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_SIM_PLANS.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return null;
    AMS_DUMMY_SIM_PLANS.push({ name: trimmed, planType: (planType || "").trim(), description: (description || "").trim(), active: true });
    amsDbSaveAsync("simPlans");
    return trimmed;
}

/* Next auto-generated SIM display ID (SIM-000001, SIM-000002, ...) */
function amsNextSimId() {
    const maxSeq = AMS_DUMMY_SIM_CARDS.reduce((m, s) => {
        const n = parseInt(String(s.simId || "0").replace(/\D/g, ""), 10);
        return isNaN(n) ? m : Math.max(m, n);
    }, 0);
    return "SIM-" + String(maxSeq + 1).padStart(6, "0");
}

/* Stable key for a mobile record. Display `id` changes on assign/transfer
   (Smart Asset ID suffix), so SIM.linkedMobileId must store amsAssetId. */
function amsMobileStableId(m) {
    if (!m) return "";
    return m.amsAssetId || m.id || "";
}

function amsFindMobileByRef(ref) {
    if (!ref) return null;
    const list = (typeof DUMMY_MOBILES !== "undefined" && Array.isArray(DUMMY_MOBILES)) ? DUMMY_MOBILES : [];
    return list.find(m => m.amsAssetId === ref)
        || list.find(m => m.id === ref)
        || list.find(m => m.displayId === ref)
        || null;
}

function amsFindSimByMobileNumber(num) {
    const n = String(num || "").trim();
    if (!n || n === "0") return null;
    return AMS_DUMMY_SIM_CARDS.find(s => String(s.mobileNumber || "").trim() === n) || null;
}

function amsSimMatchesMobile(s, m) {
    if (!s || !m || s.personalMobile) return false;
    const sid = s.linkedMobileId;
    if (!sid) return false;
    return sid === m.amsAssetId || sid === m.id || sid === m.displayId;
}

function amsUnlinkSimFromMobile(s) {
    if (!s) return false;
    let changed = false;
    if (s.linkedMobileId && !s.personalMobile) {
        const m = amsFindMobileByRef(s.linkedMobileId);
        if (m && String(m.simMobileNo || "0") === String(s.mobileNumber || "")) {
            m.simMobileNo = "0";
            changed = true;
        }
    }
    s.linkedMobileId = null;
    s.personalMobile = false;
    return changed;
}

function amsLinkSimToMobile(s, m) {
    if (!s || !m) return false;
    amsUnlinkSimFromMobile(s);
    AMS_DUMMY_SIM_CARDS.forEach(other => {
        if (other === s || other.personalMobile) return;
        if (amsSimMatchesMobile(other, m)) {
            other.linkedMobileId = null;
            other.personalMobile = false;
        }
    });
    s.personalMobile = false;
    s.linkedMobileId = amsMobileStableId(m);
    m.simMobileNo = s.mobileNumber || "0";
    return true;
}

function amsIssueSimToEmployee(s, empId, assignDate, remarks) {
    if (!s || !empId || s.status === "Retired") return false;
    const already = s.assignedTo === empId && s.status === "Issued";
    const emp = typeof amsGetEmployeeByAmsId === "function" ? amsGetEmployeeByAmsId(empId) : null;
    s.assignedTo = empId;
    s.assignedDate = assignDate || s.assignedDate || new Date().toISOString().slice(0, 10);
    s.status = "Issued";
    if (!already) {
        if (!Array.isArray(s.history)) s.history = [];
        s.history.push({
            date: s.assignedDate,
            action: "Assigned",
            empId: emp ? emp.empId : "",
            empName: emp ? emp.name : "",
            empDept: emp ? emp.dept : "",
            remarks: remarks || "Linked from Mobile Master",
            statusLabel: "Issued",
        });
    }
    return true;
}

function amsIssueMobileToEmployee(m, empId, assignDate, remarks) {
    if (!m || !empId) return false;
    if (["Retired / Scrapped", "Not Working", "Replaced"].includes(m.status)) return false;
    if (m.assignedTo && m.assignedTo !== empId) return false;
    const already = m.assignedTo === empId && m.status === "Assigned";
    const emp = typeof amsGetEmployeeByAmsId === "function" ? amsGetEmployeeByAmsId(empId) : null;
    m.assignedTo = empId;
    m.status = "Assigned";
    m.dept = emp ? emp.dept : (m.dept || "");
    if (typeof amsComputeFullId === "function") m.id = amsComputeFullId(m);
    if (!already) {
        if (!Array.isArray(m.history)) m.history = [];
        m.history.push({
            date: assignDate || new Date().toISOString().slice(0, 10),
            action: "Assigned - New",
            empId: emp ? emp.empId : "",
            empName: emp ? emp.name : "",
            empDept: emp ? emp.dept : "",
            assetIdFull: m.id,
            statusLabel: "Assigned",
            note: remarks || "Linked from SIM Card Master",
        });
    }
    return true;
}

/* Mobile Master picked a SIM number (Add/Edit or Assign). Mirrors the link
   onto the SIM card and issues it to the same employee when the phone is assigned. */
function amsSyncMobileToSimNumber(mobile, simNumber, empId, assignDate) {
    if (!mobile) return false;
    const num = String(simNumber == null ? (mobile.simMobileNo || "0") : simNumber).trim() || "0";
    let simsChanged = false;
    AMS_DUMMY_SIM_CARDS.forEach(s => {
        if (s.personalMobile) return;
        if (amsSimMatchesMobile(s, mobile) && String(s.mobileNumber || "").trim() !== num) {
            s.linkedMobileId = null;
            simsChanged = true;
        }
    });
    mobile.simMobileNo = num;
    if (num === "0") return simsChanged;
    const s = amsFindSimByMobileNumber(num);
    if (!s || s.status === "Retired") return simsChanged;
    if (s.linkedMobileId && !s.personalMobile) {
        const prev = amsFindMobileByRef(s.linkedMobileId);
        if (prev && prev !== mobile && String(prev.simMobileNo || "0") === String(s.mobileNumber || "")) {
            prev.simMobileNo = "0";
        }
    }
    s.linkedMobileId = amsMobileStableId(mobile);
    s.personalMobile = false;
    simsChanged = true;
    const emp = empId || mobile.assignedTo;
    if (emp && s.status !== "Blocked" && (!s.assignedTo || s.assignedTo === emp)) {
        amsIssueSimToEmployee(s, emp, assignDate, "Linked from Mobile Master");
    }
    return simsChanged;
}

/* SIM Master Assign/Reassign Used In. choice is "", "__personal__", or a
   stable mobile id. Also assigns an In-Store phone to the same employee. */
function amsSyncSimChoiceToMobile(s, choice, empId, assignDate) {
    if (!s) return false;
    if (choice === "__personal__") {
        const changed = amsUnlinkSimFromMobile(s);
        s.personalMobile = true;
        s.linkedMobileId = null;
        return changed;
    }
    if (!choice) return amsUnlinkSimFromMobile(s);
    const m = amsFindMobileByRef(choice);
    if (!m) {
        amsUnlinkSimFromMobile(s);
        return true;
    }
    amsLinkSimToMobile(s, m);
    if (empId) amsIssueMobileToEmployee(m, empId, assignDate, "Linked from SIM Card Master");
    return true;
}

function amsUnlinkMobileSim(mobile, returnSim) {
    if (!mobile) return false;
    const empId = mobile.assignedTo;
    const num = String(mobile.simMobileNo || "0").trim();
    let simsChanged = false;
    AMS_DUMMY_SIM_CARDS.forEach(s => {
        const sameNumber = num && num !== "0" && String(s.mobileNumber || "").trim() === num && !s.personalMobile;
        const matched = amsSimMatchesMobile(s, mobile)
            || (sameNumber && (!s.linkedMobileId || amsSimMatchesMobile(s, mobile)));
        if (!matched) return;
        if (returnSim && empId && s.assignedTo === empId && s.status !== "Retired") {
            if (!Array.isArray(s.history)) s.history = [];
            const emp = typeof amsGetEmployeeByAmsId === "function" ? amsGetEmployeeByAmsId(empId) : null;
            s.history.push({
                date: new Date().toISOString().slice(0, 10),
                action: "Returned",
                empId: emp ? emp.empId : "",
                empName: emp ? emp.name : "",
                empDept: emp ? emp.dept : "",
                remarks: "Returned with linked mobile",
                statusLabel: "In Store",
            });
            s.assignedTo = null;
            s.assignedDate = "";
            s.status = "In Store";
        }
        s.linkedMobileId = null;
        s.personalMobile = false;
        simsChanged = true;
    });
    if (num && num !== "0") mobile.simMobileNo = "0";
    return simsChanged;
}


/* =============================================================================
   8b) VENDOR MASTER  (suppliers behind Assets / Consumables / Spare Parts)
   ---------------------------------------------------------------------------
   A config-only master driven by the generic engine (js/master-table.js).
   The vendor names seeded here are the ones already referenced across the
   portal data (assets, consumables, spare parts) so every existing record
   links back to a vendor. amsGetActiveVendorNames() feeds the vendor
   datalists on the Asset / Consumable / Spare Parts forms.
   ===========================================================================*/

let AMS_VENDOR_SEQ = 12;

/* Vendor Category Master - DB-backed (vendorCategories collection). Feeds the
   "Supplies" dropdown on the Vendor Master form. Previously a hardcoded string
   list; now managed from System Admin > Vendor Category Master. */
const AMS_DUMMY_VENDOR_CATEGORIES = [
    { name: "Assets",       description: "Supplies assets / capital equipment", active: true },
    { name: "Consumables",  description: "Supplies consumable items",           active: true },
    { name: "Spare Parts",  description: "Supplies spare / repair parts",       active: true },
    { name: "Services",     description: "Provides services (AMC, repair, etc.)", active: true },
    { name: "All",          description: "General supplier - multiple categories", active: true },
];

function amsGetActiveVendorCategoryNames() {
    return AMS_DUMMY_VENDOR_CATEGORIES.filter(c => c.active).map(c => c.name);
}
function amsQuickAddVendorCategory(name, description) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    if (AMS_DUMMY_VENDOR_CATEGORIES.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return null;
    AMS_DUMMY_VENDOR_CATEGORIES.push({ name: trimmed, description: (description || "").trim(), active: true });
    amsDbSaveAsync("vendorCategories");
    return trimmed;
}

const AMS_DUMMY_VENDORS = [];


/* Live vendor names for the Asset / Consumable / Spare Parts vendor fields */
function amsGetActiveVendorNames() {
    return AMS_DUMMY_VENDORS.filter(v => v.active).map(v => v.name);
}

/* Refills every <select class="ams-vendor-select"> (the "pick a Vendor" fields
   on the Asset / Consumable / Spare Parts forms) with the active vendor list.
   Keeps the currently-selected value, and if it is no longer in the master it
   is preserved as an extra option so old records still show their vendor. */
function amsPopulateVendorSelects() {
    const names = amsGetActiveVendorNames();
    document.querySelectorAll("select.ams-vendor-select").forEach(sel => {
        const current = sel.value;
        sel.innerHTML = `<option value="">(None - optional)</option>` +
            names.map(n => `<option value="${amsEsc(n)}">${amsEsc(n)}</option>`).join("");
        if (current && !names.some(n => n === current)) {
            const opt = document.createElement("option");
            opt.value = current; opt.textContent = current;
            sel.appendChild(opt);
        }
        if (current) sel.value = current;
    });
}

/* Sets a vendor select to a given vendor name, adding it as an option first if
   it is not in the current master list (so old records never show blank). */
function amsSetVendorSelectValue(selId, value) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    if (value && !Array.from(sel.options).some(o => o.value === value)) {
        const opt = document.createElement("option");
        opt.value = value; opt.textContent = value;
        sel.appendChild(opt);
    }
    sel.value = value || "";
}

/* ---- Vendor quick-add (+) : one shared popover, dropped next to whichever
   vendor select's "+" was clicked. Used by the Asset / Consumable / Spare
   Parts forms. ---- */
let amsVendorQaTarget = null;

function amsCloseVendorQa() {
    document.querySelectorAll("#amsQaPopoverVendor.open").forEach(p => p.classList.remove("open"));
}

function amsWireVendorQuickAdds() {
    /* Build the shared popover once */
    let popover = document.getElementById("amsQaPopoverVendor");
    if (!popover) {
        popover = document.createElement("div");
        popover.className = "quickadd-popover";
        popover.id = "amsQaPopoverVendor";
        popover.innerHTML = `
            <label class="qa-label">New Vendor Name *</label>
            <input type="text" id="amsQaVendorName" class="input" placeholder="e.g. Tech Solutions India">
            <label class="qa-label">Contact Person</label>
            <input type="text" id="amsQaVendorContact" class="input" placeholder="Optional">
            <label class="qa-label">Phone</label>
            <input type="text" id="amsQaVendorPhone" class="input" placeholder="Optional">
            <label class="qa-label">Email</label>
            <input type="text" id="amsQaVendorEmail" class="input" placeholder="Optional">
            <label class="qa-label">City</label>
            <input type="text" id="amsQaVendorCity" class="input" placeholder="Optional">
            <div class="qa-actions" style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px;">
                <button type="button" class="btn btn-secondary" data-ams-qa-vendor-cancel>Cancel</button>
                <button type="button" class="btn btn-primary" id="amsQaVendorSave">Add</button>
            </div>`;
        document.body.appendChild(popover);
    }

    document.querySelectorAll("[data-quickadd-vendor]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            amsVendorQaTarget = btn.getAttribute("data-quickadd-vendor");
            const host = btn.closest(".select-with-add") || btn.parentElement;
            host.appendChild(popover);
            const wasOpen = popover.classList.contains("open");
            amsCloseVendorQa();
            if (!wasOpen) popover.classList.add("open");
        });
    });

    document.querySelectorAll("[data-ams-qa-vendor-cancel]").forEach(btn => btn.addEventListener("click", amsCloseVendorQa));
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#amsQaPopoverVendor") && !e.target.closest("[data-quickadd-vendor]")) amsCloseVendorQa();
    });

    const saveBtn = document.getElementById("amsQaVendorSave");
    if (saveBtn) saveBtn.addEventListener("click", () => {
        const name = document.getElementById("amsQaVendorName").value.trim();
        if (!name) { alert("Enter a Vendor name."); return; }
        if (AMS_DUMMY_VENDORS.some(v => v.name.toLowerCase() === name.toLowerCase())) { alert("This Vendor already exists."); return; }
        AMS_DUMMY_VENDORS.push({
            vendorId: "VEN-" + String(++AMS_VENDOR_SEQ).padStart(6, "0"),
            name,
            contactPerson: document.getElementById("amsQaVendorContact").value.trim(),
            phone: document.getElementById("amsQaVendorPhone").value.trim(),
            email: document.getElementById("amsQaVendorEmail").value.trim(),
            city: document.getElementById("amsQaVendorCity").value.trim(),
            category: "All", gstin: "", remarks: "", active: true,
        });
        amsPopulateVendorSelects();
        if (amsVendorQaTarget && document.getElementById(amsVendorQaTarget)) {
            document.getElementById(amsVendorQaTarget).value = name;
        }
        ["amsQaVendorName", "amsQaVendorContact", "amsQaVendorPhone", "amsQaVendorEmail", "amsQaVendorCity"]
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        amsCloseVendorQa();
        amsNotify(`Vendor "${name}" added.`, "success");
    });
}

/* =============================================================================
   9) EMPLOYEE MASTER  (people, departments, hierarchy & assignments)
   ===========================================================================*/

/* ---- Departments and their short-forms (used inside the AMS Employee ID) --- */
const DEPARTMENTS = [
    { name: "Production", short: "PRD" },
    { name: "IT",         short: "IT"  },
    { name: "Facilities", short: "FAC" },
    { name: "Admin",      short: "ADM" },
    { name: "Logistics",  short: "LOG" },
    { name: "Finance",    short: "FIN" },
    { name: "HR",         short: "HR"  }
];

/* ---- Suggested designations (shown in the Add/Edit form as suggestions) ---- */
const DESIGNATIONS = [
    "Managing Director", "General Manager", "Department Manager",
    "Supervisor", "Engineer", "Technician", "Support Engineer",
    "Accountant", "HR Executive", "Machine Operator", "Security Guard"
];

/* Hidden AMS IDs (employee AMS ID, AMS Asset ID) are knowledge-only for
   Supreme Root. Other roles always see company / display IDs. */
function amsIsSupremeRoot() {
    const role = (typeof amsGetViewingAsRole === "function") ? amsGetViewingAsRole() : "";
    return role === "Supreme Root";
}

/* ---- Credential levels (legacy names kept for older imports) ----- */
const CREDENTIAL_LEVELS = [
    { name: "Standard User",  amsVisible: false },
    { name: "Administrator",  amsVisible: false },
    { name: "Super Root",     amsVisible: false },
    { name: "Supreme Root",   amsVisible: true  }
];

/* ---- Facilities checked / disabled during employee exit or handover --------- */
const FACILITIES_CHECKLIST = [
    { key: "email",  label: "Email Login",            revokedOnExit: true },
    { key: "erp",    label: "ERP Login",              revokedOnExit: true },
    { key: "vpn",    label: "VPN Access",             revokedOnExit: true },
    { key: "card",   label: "Building Access Card",   revokedOnExit: true },
    { key: "phone",  label: "Phone / Extension",      revokedOnExit: true },
    { key: "share",  label: "Shared Drive / Mail Group", revokedOnExit: true }
];

/* ---- Employee records -------------------------------------------------------
 *  amsId      : AUTO-GENERATED (EMP-<DeptShort>-000001) - hidden from normal users
 *  empId      : the ID given by the company (e.g. 00609, D00001). Default EMP-000001.
 *  managerAmsId : reports-to relationship (used to compute subordinate assets)
 * ---------------------------------------------------------------------------*/
const DUMMY_EMPLOYEES = [];


/* ---- Employee helper functions ---------------------------------------------- */

/* Returns the short-form for a department name (falls back to GEN) */
function getDeptShort(departmentName) {
    const dept = DEPARTMENTS.find(d => d.name === departmentName);
    return dept ? dept.short : "GEN";
}

/* Returns the employee's COMPANY-ISSUED (display) ID - e.g. "00339" - never the
   hidden internal AMS ID ("EMP-INS-000001"). Accepts both the raw employee
   record (empId = company ID) and the portal view-model from
   amsGetEmployeeByAmsId (which mirrors the AMS ID into empId and keeps the
   company ID in empIdCompany), so printed forms always show the display ID. */
function amsGetEmployeeDisplayId(emp) {
    if (!emp) return "";
    if (emp.empIdCompany) return emp.empIdCompany;
    return emp.empId || emp.amsId || "";
}

/* Auto-generates the next AMS ID for a department, e.g. EMP-IT-000004.
   Uses the highest existing sequence number for that department so IDs stay
   unique even when records have been removed (leaving gaps). */
function generateAmsId(departmentName) {
    const short = getDeptShort(departmentName);
    const prefix = "EMP-" + short + "-";
    let maxSeq = 0;
    DUMMY_EMPLOYEES.forEach(e => {
        if (e.amsId && e.amsId.indexOf(prefix) === 0) {
            const seq = parseInt(e.amsId.slice(prefix.length), 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
    });
    return prefix + String(maxSeq + 1).padStart(6, "0");
}

/* Combines first + middle + last into a display name. Newer records store a
   single `name` field (full name, exactly as typed); older records still use
   firstName/middleName/lastName and are migrated to `name` on load. */
function getEmployeeFullName(emp) {
    if (emp && emp.name) return emp.name;
    return [emp && emp.firstName, emp && emp.middleName, emp && emp.lastName].filter(Boolean).join(" ");
}

/* Returns the initials of an employee (for the avatar). With the single full
   name format the initials come from the first and last word of the name. */
function getEmployeeInitials(emp) {
    if (emp && emp.name) {
        const parts = String(emp.name).trim().split(/\s+/);
        const first = parts[0] || "";
        const last = parts.length > 1 ? parts[parts.length - 1] : "";
        return (first[0] || "") + (last[0] || "");
    }
    return ((emp && emp.firstName[0]) || "") + ((emp && emp.lastName[0]) || "");
}

/* Migrates legacy First/Middle/Last records to the single full-name `name`
   field (idempotent - records that already have `name` are left alone). */
function amsMigrateEmployeeNames() {
    let changed = false;
    DUMMY_EMPLOYEES.forEach(e => {
        if (!e.name && (e.firstName || e.lastName)) {
            e.name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(" ");
            changed = true;
        }
    });
    if (changed) amsDbSaveAsync("employees");
}

/* All employees, optionally filtered by status */
function getEmployees(statusFilter) {
    if (!statusFilter || statusFilter === "All") return DUMMY_EMPLOYEES;
    return DUMMY_EMPLOYEES.filter(e => e.status === statusFilter);
}

/* Finds one employee by AMS ID */
function findEmployee(amsId) {
    return DUMMY_EMPLOYEES.find(e => e.amsId === amsId);
}

/* Finds one employee by AMS ID OR company ID */
function findEmployeeAny(identifier) {
    if (!identifier) return null;
    const id = String(identifier).trim().toLowerCase().replace(/\s+/g, " ");
    return DUMMY_EMPLOYEES.find(e => {
        if (e.amsId && e.amsId.toLowerCase().replace(/\s+/g, " ") === id) return true;
        if (e.empId && e.empId.toLowerCase().replace(/\s+/g, " ") === id) return true;
        /* Match by name too (case-insensitive, whitespace-tolerant) so a CSV
           that references the reporting manager by FULL NAME still resolves,
           even though records store First / Middle / Last separately. */
        const name = getEmployeeFullName(e).toLowerCase().replace(/\s+/g, " ");
        if (name === id) return true;
        return false;
    });
}

/* Adds a new employee and returns the record with its generated AMS ID.
   Also registers the employee's department/designation in BOTH lookup masters
   (and persists) so they show up in the Department / Designation Masters even
   when the employee was bulk-imported with a lookup that only existed in one
   master source. */
function addEmployee(data) {
    amsEnsureDepartment(data.department, data.deptShort || "");
    amsEnsureDesignation(data.designation);
    const emp = {
        amsId: generateAmsId(data.department),
        empId: data.empId || "EMP-000001",
        name: data.name || "",
        firstName: data.firstName || "",
        middleName: data.middleName || "",
        lastName: data.lastName || "",
        department: data.department,
        designation: data.designation,
        contact: data.contact || "",
        email: data.email || "",
        managerAmsId: data.managerAmsId || null,
        /* As-typed reporting manager reference from a bulk import (kept verbatim
           even when the manager record does not exist yet). */
        managerName: data.managerName || "",
        managerId: data.managerId || "",
        site: data.site || "",
        status: "Active",
        exitDate: null
    };
    DUMMY_EMPLOYEES.push(emp);
    amsDbSaveAsync("employees");
    amsResolvePendingManagers();
    return emp;
}

/* Updates the editable fields of an existing employee */
function updateEmployee(amsId, data) {
    const emp = findEmployee(amsId);
    if (!emp) return null;
    emp.empId = data.empId || "EMP-000001";
    emp.name = data.name || "";
    emp.firstName = data.firstName || "";
    emp.middleName = data.middleName || "";
    emp.lastName = data.lastName || "";
    emp.department = data.department;
    emp.designation = data.designation;
    emp.contact = data.contact || "";
    emp.email = data.email || "";
    emp.managerAmsId = data.managerAmsId || null;
    emp.site = data.site || "";
    amsDbSaveAsync("employees");
    amsResolvePendingManagers();
    return emp;
}

/* Auto-links employees whose reporting manager did not exist yet when they were
   added/imported. Such employees keep a pendingManagerRef (the manager's full
   name, company Employee ID or AMS ID) until a matching employee record exists;
   once it does, managerAmsId is filled in here. Called after every employee
   mutation + on page init, so a manager that "joined later" links to their
   reports automatically. Returns true if any link was made (so callers can
   re-render/save if needed). */
function amsResolvePendingManagers() {
    let changed = false;
    DUMMY_EMPLOYEES.forEach(emp => {
        if (!emp.pendingManagerRef || emp.managerAmsId) return;
        const mgr = findEmployeeAny(emp.pendingManagerRef);
        if (mgr && mgr.amsId !== emp.amsId) {
            emp.managerAmsId = mgr.amsId;
            emp.managerName = getEmployeeFullName(mgr);
            emp.managerId = emp.managerId || mgr.empId;
            delete emp.pendingManagerRef;
            changed = true;
        }
    });
    if (changed) amsDbSaveAsync("employees");
    return changed;
}

/* Marks an employee as exited: releases their assets back to the store. The
   assets held + facilities disabled at the moment of exit are snapshotted into
   AMS_DUMMY_EXIT_RECORDS so the printed Handover Form stays accurate even after
   the assets have been released back to the store / the org chart has changed.

   exitReason         : selected Reason of Exit (Resignation, Retirement, etc.)
   teamInchargeAmsId  : optional - the new Incharge/HOD who takes over the
                        exiting employee's direct subordinates. Their managerAmsId
                        is re-pointed to this person so the team's asset records
                        continue under the new incharge, and the transfer is
                        snapshotted for the printed Handover Form. */
function exitEmployee(amsId, exitDate, remarks, facilitiesDisabled, exitReason, teamInchargeAmsId, facilitiesNotApplicable) {
    const emp = findEmployee(amsId);
    if (!emp) return null;
    emp.status = "Inactive";
    emp.exitDate = exitDate || new Date().toISOString().slice(0, 10);
    emp.exitRemarks = remarks || "";
    emp.exitReason = exitReason || "";

    /* Snapshot the direct assets / mobiles / SIMs held at exit (before releasing them) */
    const directAssetsHeld = DUMMY_ASSETS
        .filter(a => a.assignedTo === amsId)
        .map(a => ({
            id: a.id, assetId: a.id, type: a.type, makeModel: amsAssetMakeModel(a),
            site: a.currentSite || a.site, currentSite: a.currentSite || a.site,
            assignedDepartment: a.assignedDepartment,
            remarks: a.remarks, usageNote: a.usageNote,
            assignedTo: a.assignedTo, displayId: a.displayId,
        }));
    const directMobilesHeld = DUMMY_MOBILES
        .filter(a => a.assignedTo === amsId)
        .map(a => ({
            id: a.id, displayId: a.displayId, type: a.type, make: a.make, model: a.model,
            makeModel: amsAssetMakeModel(a),
            imei1: a.imei1, imei2: a.imei2, batteryNo: a.batteryNo, chargerNo: a.chargerNo,
            simMobileNo: a.simMobileNo || "0",
            site: a.currentSite || a.site, currentSite: a.currentSite || a.site,
            remarks: a.remarks, status: a.status, assignedTo: a.assignedTo,
            assignedToSubordinate: a.assignedToSubordinate, assignedSubText: a.assignedSubText,
        }));
    const directSimCardsHeld = AMS_DUMMY_SIM_CARDS
        .filter(s => s.assignedTo === amsId)
        .map(s => ({
            simId: s.simId, mobileNumber: s.mobileNumber, operator: s.operator,
            plan: s.plan, status: s.status, assignedTo: s.assignedTo,
            linkedMobileId: s.linkedMobileId || null, personalMobile: !!s.personalMobile,
        }));

    const disabled = Array.isArray(facilitiesDisabled) ? facilitiesDisabled.map(String) : [];
    const notApplicable = Array.isArray(facilitiesNotApplicable) ? facilitiesNotApplicable.map(String) : [];

    /* ---- Subordinate / team transfer to the new Incharge / HOD ----
       Direct subordinates (still active) get their reporting line re-pointed to
       the chosen incharge so their asset records continue under them. */
    const subordinates = getSubordinates(amsId);
    const incharge = teamInchargeAmsId && teamInchargeAmsId !== amsId ? findEmployee(teamInchargeAmsId) : null;

    let teamTransferredTo = null;
    const subordinateAssetsTransferred = [];
    if (incharge) {
        subordinates.forEach(sub => { sub.managerAmsId = incharge.amsId; });
        teamTransferredTo = {
            amsId: incharge.amsId,
            empId: incharge.empId,
            name: getEmployeeFullName(incharge),
            department: incharge.department,
            designation: incharge.designation,
        };
        subordinates.forEach(sub => {
            getEmployeeAssets(sub.amsId).forEach(a => {
                subordinateAssetsTransferred.push({
                    subAmsId: sub.amsId, subName: getEmployeeFullName(sub), subEmpId: amsGetEmployeeDisplayId(sub),
                    assetId: a.id, type: a.type, makeModel: amsAssetMakeModel(a),
                    site: a.currentSite || a.site, status: a.status, kind: "asset",
                });
            });
            getEmployeeMobiles(sub.amsId).forEach(a => {
                subordinateAssetsTransferred.push({
                    subAmsId: sub.amsId, subName: getEmployeeFullName(sub), subEmpId: amsGetEmployeeDisplayId(sub),
                    assetId: a.id, type: a.type, makeModel: amsAssetMakeModel(a),
                    site: a.currentSite || a.site, status: a.status, kind: "mobile",
                    imei1: a.imei1, simMobileNo: a.simMobileNo,
                });
            });
            getEmployeeSimCards(sub.amsId).forEach(s => {
                subordinateAssetsTransferred.push({
                    subAmsId: sub.amsId, subName: getEmployeeFullName(sub), subEmpId: amsGetEmployeeDisplayId(sub),
                    assetId: s.simId, type: "SIM Card", makeModel: [s.operator, s.plan].filter(Boolean).join(" / "),
                    site: s.mobileNumber || "-", status: s.status, kind: "sim",
                });
            });
        });
    }

    const subordinateMobilesHeld = [];
    const subordinateSimCardsHeld = [];
    getSubordinates(amsId).forEach(sub => {
        getEmployeeMobiles(sub.amsId).forEach(a => subordinateMobilesHeld.push({
            ...a, id: a.id, holder: getEmployeeFullName(sub), holderId: amsGetEmployeeDisplayId(sub),
            site: a.currentSite || a.site, subName: getEmployeeFullName(sub), subEmpId: amsGetEmployeeDisplayId(sub),
        }));
        getEmployeeSimCards(sub.amsId).forEach(s => subordinateSimCardsHeld.push({
            ...s, holder: getEmployeeFullName(sub), holderId: amsGetEmployeeDisplayId(sub),
            subName: getEmployeeFullName(sub), subEmpId: amsGetEmployeeDisplayId(sub),
        }));
    });

    AMS_DUMMY_EXIT_RECORDS.push({
        exitId: amsGenerateExitId(),
        amsId,
        empId: emp.empId,
        empName: getEmployeeFullName(emp),
        empDept: emp.department,
        empDesignation: emp.designation,
        exitDate: emp.exitDate,
        exitReason: emp.exitReason,
        exitRemarks: emp.exitRemarks,
        facilitiesDisabled: disabled,
        facilitiesNotApplicable: notApplicable,
        directAssetsHeld,
        directMobilesHeld,
        directSimCardsHeld,
        subordinateMobilesHeld,
        subordinateSimCardsHeld,
        teamTransferredTo,
        subordinateAssetsTransferred,
    });

    DUMMY_ASSETS.forEach(a => {
        if (a.assignedTo === amsId) a.assignedTo = null;
    });
    DUMMY_MOBILES.forEach(a => {
        if (a.assignedTo === amsId) {
            a.assignedTo = null; a.assignedToSubordinate = null; a.assignedSubText = null;
            a.status = "In Store";
        }
    });
    AMS_DUMMY_SIM_CARDS.forEach(s => {
        if (s.assignedTo === amsId) {
            s.assignedTo = null; s.assignedDate = ""; s.status = "In Store";
            if (s.linkedMobileId && !s.personalMobile) {
                const m = amsFindMobileByRef(s.linkedMobileId);
                if (m && String(m.simMobileNo || "0") === String(s.mobileNumber || "")) m.simMobileNo = "0";
            }
            s.linkedMobileId = null;
            s.personalMobile = false;
        }
    });
    amsDbSaveAsync("employees");
    amsDbSaveAsync("assets");
    amsDbSaveAsync("mobiles");
    amsDbSaveAsync("simCards");
    amsDbSaveAsync("exitRecords");
    return emp;
}

/* Returns the permanent exit record (snapshot) for an employee, if one exists */
function getExitRecord(amsId) {
    return AMS_DUMMY_EXIT_RECORDS.find(r => r.amsId === amsId);
}

/* Direct subordinates of an employee (via managerAmsId) */
function getSubordinates(amsId) {
    return DUMMY_EMPLOYEES.filter(e => e.managerAmsId === amsId && e.status === "Active");
}

/* Assets directly assigned to an employee */
function getEmployeeAssets(amsId) {
    return DUMMY_ASSETS.filter(a => a.assignedTo === amsId);
}

/* Mobiles directly assigned to an employee (Mobile Master collection) */
function getEmployeeMobiles(amsId) {
    return DUMMY_MOBILES.filter(a => a.assignedTo === amsId);
}

/* SIM cards currently assigned to an employee */
function getEmployeeSimCards(amsId) {
    return AMS_DUMMY_SIM_CARDS.filter(s => s.assignedTo === amsId);
}

function amsSimPrintUsedIn(s) {
    if (!s) return "None";
    if (s.personalMobile) return "Personal Mobile";
    if (!s.linkedMobileId) return "None";
    const m = amsFindMobileByRef(s.linkedMobileId);
    return m && typeof amsPrintAssetId === "function" ? amsPrintAssetId(m) : s.linkedMobileId;
}

/* Assets owned by an employee's subordinates (the whole team) */
function getSubordinateAssets(amsId) {
    const subIds = getSubordinates(amsId).map(s => s.amsId);
    return DUMMY_ASSETS.filter(a => subIds.includes(a.assignedTo));
}

/* Mobiles owned by an employee's direct subordinates */
function getSubordinateMobiles(amsId) {
    const subIds = getSubordinates(amsId).map(s => s.amsId);
    return DUMMY_MOBILES.filter(a => subIds.includes(a.assignedTo));
}

/* SIM cards owned by an employee's direct subordinates */
function getSubordinateSimCards(amsId) {
    const subIds = getSubordinates(amsId).map(s => s.amsId);
    return AMS_DUMMY_SIM_CARDS.filter(s => subIds.includes(s.assignedTo));
}

/* Assets not assigned to anyone yet */
function getUnassignedAssets() {
    return DUMMY_ASSETS.filter(a => !a.assignedTo);
}

/* Assigns an asset to an employee */
function assignAsset(assetId, amsId) {
    const asset = DUMMY_ASSETS.find(a => a.id === assetId);
    if (asset) asset.assignedTo = amsId;
    amsDbSaveAsync("assets");
}

/* Reassigns an asset from its current owner to another employee */
function reassignAsset(assetId, toAmsId) {
    assignAsset(assetId, toAmsId);
}

/* =============================================================================
   ASSET HOLDER HELPERS  (shared by Asset Master + print forms)
   An asset is always assigned to a Direct Employee (the custodian) and MAY
   additionally record the ACTUAL USER:
     - as a record from the User master (assignedToSubordinate) - a FORMAL
       sub-record of the same assignment. The asset is still directly issued to
       the employee, so the printed Asset Issue Form lists it under
       "Assets Issued".
     - as FREE TEXT typed into the Assign modal for a party NOT present in the
       User master (assignedSubText). Those assets are NOT directly issued to
       the employee - the real holder is an outsider - so the print routes them
       to the "Assets Currently Assigned to Subordinates (For Reference)"
       section instead of "Assets Issued".
   ===========================================================================*/

/* True when the asset is NOT personally held by the custodian: its actual user
   is a subordinate/team member - either a record from the User master
   (assignedToSubordinate) or free text typed into the Assign modal
   (assignedSubText, not in the User master). Such assets are counted under the
   employee's TEAM (not Owned) and are moved out of "Assets Issued" into the
   "For Reference" section of the printed Asset Issue Form. */
function amsAssetIsDeptOrSub(a) {
    return !!(a && (a.assignedToSubordinate || a.assignedSubText));
}

/* Human-readable label for the actual holder (subordinate/free-text user) of
   an asset. */
function amsAssetHolderLabel(a) {
    if (!a) return "";
    if (a.assignedToSubordinate) {
        const emp = amsGetEmployeeByAmsId(a.assignedToSubordinate);
        return emp ? `${emp.name} (${amsGetEmployeeDisplayId(emp)})` : a.assignedToSubordinate;
    }
    if (a.assignedSubText) return a.assignedSubText;
    return "";
}

/* Splits an employee's currently-held assets into (a) assets issued directly to
   them and (b) assets whose actual user is a subordinate/team member (User
   master record or free text). Only the latter feed the "For Reference" section
   of the printed Asset Issue Form; the former stay in "Assets Issued". */
function amsSplitDirectVsSubordinateAssets(assets) {
    const direct = [];
    const subordinate = [];
    (assets || []).forEach(a => {
        if (amsAssetIsDeptOrSub(a)) subordinate.push(a);
        else direct.push(a);
    });
    return { direct, subordinate };
}

/* Assets an employee PERSONALLY holds (Owned): directly assigned to them with
   no subordinate/team actual user recorded on the asset. */
function amsOwnedEmployeeAssets(amsId) {
    return getEmployeeAssets(amsId).filter(a => !amsAssetIsDeptOrSub(a));
}

/* Assets counted under the employee's TEAM: assets their direct subordinates
   hold, PLUS assets the employee is custodian of but whose actual user is a
   subordinate/team member (User master record or free-text holder). */
function amsTeamEmployeeAssets(amsId) {
    const team = getSubordinateAssets(amsId).slice();
    getEmployeeAssets(amsId).forEach(a => { if (amsAssetIsDeptOrSub(a)) team.push(a); });
    return team;
}

/* Owned / Team lists that include assigned Mobiles and SIM cards so Employee
   Master counters, distribution, and reports count every held device. */
function amsOwnedEmployeeHoldings(amsId) {
    const assets = amsOwnedEmployeeAssets(amsId);
    const mobiles = getEmployeeMobiles(amsId).filter(a => !amsAssetIsDeptOrSub(a));
    const sims = getEmployeeSimCards(amsId);
    return assets.concat(mobiles, sims);
}

function amsTeamEmployeeHoldings(amsId) {
    const team = amsTeamEmployeeAssets(amsId).slice();
    getSubordinateMobiles(amsId).forEach(a => team.push(a));
    getEmployeeMobiles(amsId).forEach(a => { if (amsAssetIsDeptOrSub(a)) team.push(a); });
    getSubordinateSimCards(amsId).forEach(s => team.push(s));
    return team;
}

function amsHoldingDisplayId(item) {
    if (!item) return "";
    if (item.simId) return item.simId;
    return (typeof amsPrintAssetId === "function") ? amsPrintAssetId(item) : (item.id || item.assetId || "");
}

function amsHoldingMakeModel(item) {
    if (!item) return "";
    if (item.simId) return [item.operator, item.plan, item.mobileNumber].filter(Boolean).join(" / ");
    return (typeof amsAssetMakeModel === "function") ? amsAssetMakeModel(item) : (item.makeModel || "");
}

function amsHoldingTypeLabel(item) {
    if (!item) return "";
    if (item.simId) return "SIM Card";
    return item.type || "";
}

/* Printed "Assignment Type" label for an Asset Issue Form, based on the mix of
   assets shown on the form. */
function amsAssignmentTypeLabel(directCount, teamCount) {
    if (directCount > 0 && teamCount > 0) return "Both (Direct + Team Use)";
    if (teamCount > 0) return "Subordinate/Team Use";
    return "Direct (Personal Use)";
}

/* Builds the "Accessories / Items Included" section of a printed form.
   Uses only items issued DIRECTLY to the employee (assets, mobiles, SIMs).
   Lists unique Accessory Master options for those item types (plus recorded
   accessories even if no longer in the master), pre-checking issued ones.
   If nothing is issued, the section is omitted (no default checklist). */
function amsBuildPrintAccessoriesHtml(items) {
    const list = (items || []).filter(oa => oa);
    if (!list.length) return "";

    const types = [];
    list.forEach(oa => { if (oa.type && !types.includes(oa.type)) types.push(oa.type); });

    const masterOptions = [];
    types.forEach(t => {
        amsGetAccessoryOptions(t).forEach(name => {
            if (!masterOptions.includes(name)) masterOptions.push(name);
        });
    });

    const issued = [];
    list.forEach(oa => {
        (Array.isArray(oa.accessories) ? oa.accessories : []).forEach(name => {
            if (name && !issued.includes(name)) issued.push(name);
        });
    });

    const rows = [];
    masterOptions.forEach(name => {
        const checked = issued.includes(name) ? "checked" : "";
        rows.push(`<label class="pf-check-block"><input type="checkbox" ${checked}> ${amsEsc(name)}</label>`);
    });
    issued.forEach(name => {
        if (!masterOptions.includes(name)) {
            rows.push(`<label class="pf-check-block"><input type="checkbox" checked> ${amsEsc(name)}</label>`);
        }
    });
    if (!rows.length) return "";
    rows.push(`<label class="pf-check-block" style="grid-column:1 / -1;">Other: ________________________________</label>`);
    return `
        <div class="pf-section-bar">Accessories / Items Included</div>
        <div class="pf-checklist-grid">
            ${rows.join("")}
        </div>`;
}

function amsPrintDirectHoldingsForAccessories(amsId, extraAssets) {
    const assets = extraAssets || [];
    const mobiles = (typeof amsCollectPrintMobilesForEmp === "function")
        ? (amsCollectPrintMobilesForEmp(amsId).direct || [])
        : [];
    const sims = (typeof amsCollectPrintSimsForEmp === "function")
        ? (amsCollectPrintSimsForEmp(amsId).direct || [])
        : [];
    return assets.concat(mobiles, sims);
}

function amsAssetMakeModel(oa) {
    if (!oa) return "";
    if (oa.makeModel) return oa.makeModel;
    return [oa.make, oa.model].filter(Boolean).join(" ").trim();
}

function amsCollectPrintMobilesForEmp(amsId) {
    const split = amsSplitDirectVsSubordinateAssets(getEmployeeMobiles(amsId));
    const subordinate = [];
    getSubordinates(amsId).forEach(sub => {
        getEmployeeMobiles(sub.amsId).forEach(a => subordinate.push({
            ...a,
            id: amsPrintAssetId(a),
            holder: getEmployeeFullName(sub),
            holderId: amsGetEmployeeDisplayId(sub),
            site: a.currentSite || a.site,
        }));
    });
    split.subordinate.forEach(oa => {
        const holderEmp = oa.assignedToSubordinate ? amsGetEmployeeByAmsId(oa.assignedToSubordinate) : null;
        subordinate.push({
            ...oa,
            id: amsPrintAssetId(oa),
            holder: holderEmp ? holderEmp.name : (oa.assignedSubText || amsAssetHolderLabel(oa)),
            holderId: holderEmp ? amsGetEmployeeDisplayId(holderEmp) : "",
            site: oa.currentSite || oa.site,
        });
    });
    return { direct: split.direct, subordinate };
}

function amsCollectPrintSimsForEmp(amsId) {
    const subordinate = [];
    getSubordinates(amsId).forEach(sub => {
        getEmployeeSimCards(sub.amsId).forEach(s => subordinate.push({
            ...s,
            holder: getEmployeeFullName(sub),
            holderId: amsGetEmployeeDisplayId(sub),
        }));
    });
    return { direct: getEmployeeSimCards(amsId), subordinate };
}

function amsBuildPrintMobilesSectionHtml(directList, subList, opts) {
    const withCondition = !!(opts && opts.withCondition);
    const conditionRow = () => ["Good", "Needs Repair / Service", "Damaged"].map(o =>
        `<label class="pf-check-inline"><input type="checkbox" disabled> ${o}</label>`).join("");
    const typeLabel = m => {
        const mm = amsAssetMakeModel(m);
        return `${amsEsc(m.type || "-")}${mm ? ` (${amsEsc(mm)})` : ""}`;
    };
    const mobileNo = m => (m.simMobileNo && m.simMobileNo !== "0") ? m.simMobileNo : "-";
    let html = "";
    const mobileTitle = (opts && opts.returnedLabel) ? "Mobiles Returned" : "Mobiles Issued";
    if (directList && directList.length) {
        html += `
        <div class="pf-section-bar">${mobileTitle}</div>
        <table class="pf-asset-table">
            <thead>
                <tr>
                    <th style="width:30px;">#</th><th>Mobile ID</th><th>Type / Make / Model</th>
                    <th>IMEI No 1</th><th>IMEI No 2</th><th>Battery No</th><th>Charger No</th>
                    <th>Mobile No</th><th>Site</th>${withCondition ? "<th>Physical Condition at Issue</th>" : ""}
                </tr>
            </thead>
            <tbody>
                ${directList.map((m, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td class="mono">${amsEsc(amsPrintAssetId(m))}</td>
                        <td>${typeLabel(m)}</td>
                        <td class="mono">${amsEsc(m.imei1 || "-")}</td>
                        <td class="mono">${amsEsc(m.imei2 || "-")}</td>
                        <td class="mono">${amsEsc(m.batteryNo || "-")}</td>
                        <td class="mono">${amsEsc(m.chargerNo || "-")}</td>
                        <td class="mono">${amsEsc(mobileNo(m))}</td>
                        <td>${amsEsc(m.currentSite || m.site || "-")}</td>
                        ${withCondition ? `<td>${conditionRow()}</td>` : ""}
                    </tr>`).join("")}
            </tbody>
        </table>`;
    }
    if (subList && subList.length) {
        html += `
        <div class="pf-section-bar">Mobiles Currently Assigned to Subordinates (For Reference)</div>
        <table class="pf-asset-table">
            <thead>
                <tr>
                    <th style="width:30px;">#</th><th>Mobile ID</th><th>Type / Make / Model</th>
                    <th>IMEI No 1</th><th>Mobile No</th><th>Held By</th><th>Employee ID</th><th>Site</th>
                </tr>
            </thead>
            <tbody>
                ${subList.map((m, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td class="mono">${amsEsc(m.id || amsPrintAssetId(m))}</td>
                        <td>${typeLabel(m)}</td>
                        <td class="mono">${amsEsc(m.imei1 || "-")}</td>
                        <td class="mono">${amsEsc(mobileNo(m))}</td>
                        <td>${amsEsc(m.holder || m.subName || "-")}</td>
                        <td class="mono">${m.holderId || m.subEmpId ? amsEsc(m.holderId || m.subEmpId) : "-"}</td>
                        <td>${amsEsc(m.site || m.currentSite || "-")}</td>
                    </tr>`).join("")}
            </tbody>
        </table>`;
    }
    return html;
}

function amsBuildPrintSimCardsSectionHtml(directList, subList, opts) {
    const simTitle = (opts && opts.returnedLabel) ? "SIM Cards Returned" : "SIM Cards Issued";
    let html = "";
    if (directList && directList.length) {
        html += `
        <div class="pf-section-bar">${simTitle}</div>
        <table class="pf-asset-table">
            <thead>
                <tr>
                    <th style="width:30px;">#</th><th>SIM ID</th><th>Mobile Number</th>
                    <th>Operator</th><th>Plan</th><th>Site</th><th>Used In</th><th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${directList.map((s, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td class="mono">${amsEsc(s.simId || "-")}</td>
                        <td class="mono">${amsEsc(s.mobileNumber || "-")}</td>
                        <td>${amsEsc(s.operator || "-")}</td>
                        <td>${amsEsc(s.plan || "-")}</td>
                        <td>${amsEsc(s.site || "-")}</td>
                        <td>${amsEsc(amsSimPrintUsedIn(s))}</td>
                        <td>${amsEsc(s.status || "-")}</td>
                    </tr>`).join("")}
            </tbody>
        </table>`;
    }
    if (subList && subList.length) {
        html += `
        <div class="pf-section-bar">SIM Cards Currently Assigned to Subordinates (For Reference)</div>
        <table class="pf-asset-table">
            <thead>
                <tr>
                    <th style="width:30px;">#</th><th>SIM ID</th><th>Mobile Number</th>
                    <th>Operator</th><th>Plan</th><th>Site</th><th>Held By</th><th>Employee ID</th>
                </tr>
            </thead>
            <tbody>
                ${subList.map((s, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td class="mono">${amsEsc(s.simId || "-")}</td>
                        <td class="mono">${amsEsc(s.mobileNumber || "-")}</td>
                        <td>${amsEsc(s.operator || "-")}</td>
                        <td>${amsEsc(s.plan || "-")}</td>
                        <td>${amsEsc(s.site || "-")}</td>
                        <td>${amsEsc(s.holder || s.subName || "-")}</td>
                        <td class="mono">${s.holderId || s.subEmpId ? amsEsc(s.holderId || s.subEmpId) : "-"}</td>
                    </tr>`).join("")}
            </tbody>
        </table>`;
    }
    return html;
}

function amsBuildPrintMobileSimHtml(amsId, opts) {
    const exitRecord = opts && opts.exitRecord;
    const mobiles = exitRecord
        ? { direct: exitRecord.directMobilesHeld || [], subordinate: exitRecord.subordinateMobilesHeld || [] }
        : amsCollectPrintMobilesForEmp(amsId);
    const sims = exitRecord
        ? { direct: exitRecord.directSimCardsHeld || [], subordinate: exitRecord.subordinateSimCardsHeld || [] }
        : amsCollectPrintSimsForEmp(amsId);
    return {
        html: amsBuildPrintMobilesSectionHtml(mobiles.direct, mobiles.subordinate, opts)
            + amsBuildPrintSimCardsSectionHtml(sims.direct, sims.subordinate, opts),
        mobileDirect: mobiles.direct.length,
        mobileTeam: mobiles.subordinate.length,
        simDirect: sims.direct.length,
        simTeam: sims.subordinate.length,
    };
}

/* =============================================================================
   10) ROLES & USERS  (roles, user accounts, page registry, role access defaults)
   ===========================================================================*/

const AMS_USER_ROLES = ["Standard User", "Viewer (Read-Only)", "Admin", "Super Root", "Supreme Root"];

const AMS_PAGE_REGISTRY = [
    { key: "dashboard",     label: "Dashboard" },
    { key: "employee",      label: "Employee Master" },
    { key: "asset",         label: "Asset Master" },
    { key: "mobile",        label: "Mobile Master" },
    { key: "reports",       label: "Report Master (page access)" },
    { key: "assetType",     label: "Asset Type Master" },
    { key: "assetMake",     label: "Asset Make Master" },
    { key: "assetCategory", label: "Asset Category Master" },
    { key: "site",          label: "Site Master" },
    { key: "consumable",    label: "Consumable Master" },
    { key: "spareParts",    label: "Spare Parts Master" },
    { key: "department",    label: "Department Master" },
    { key: "designation",   label: "Designation Master" },
    { key: "systemAdmin",   label: "System Administrator Master (hub)" },
    { key: "accessory",     label: "Accessory Master" },
    { key: "simCards",      label: "SIM Card Master" },
    { key: "vendors",       label: "Vendor Master" },
    { key: "assetDistribution", label: "Asset Distribution" },
    { key: "settings",      label: "Settings" },
    { key: "simOperator",   label: "SIM Operator Master" },
    { key: "simPlan",       label: "SIM Plan Master" },
    { key: "consumableCategory", label: "Consumable Category Master" },
    { key: "unitOfMeasure", label: "Unit of Measure Master" },
    { key: "sparePartCategory", label: "Spare Part Category Master" },
    { key: "vendorCategory", label: "Vendor Category Master" },
    { key: "company",       label: "Company Master" },
    { key: "userMaster",    label: "User Master" },
    { key: "accessRights",  label: "Access Rights Control Master (Supreme Root only)" },
    { key: "roleAccess",    label: "Role Access Master (Supreme Root only)" },
    { key: "log",           label: "Log Report (Super Root and Supreme Root only)" },
    { key: "report.assetLifecycle",     label: "Report: Asset Lifecycle" },
    { key: "report.assetIssue",         label: "Report: Asset Issue Form" },
    { key: "report.assetHandover",      label: "Report: Asset Handover Form" },
    { key: "report.consumableRestock",  label: "Report: Consumable Restock" },
    { key: "report.consumableUsed",     label: "Report: Consumable Used" },
    { key: "report.sparePartsRestock",  label: "Report: Spare Parts Restock" },
    { key: "report.sparePartsUsed",     label: "Report: Spare Parts Used" },
    { key: "report.assetDistribution",  label: "Report: Asset Distribution" },
];
const AMS_DUMMY_USERS = [];


/* Role Access defaults - what a role can see when a user has no per-user override.
   Levels: "none" | "view" | "full" (legacy true/false still accepted).
   Supreme-Root-exclusive pages (accessRights, roleAccess, log) are enforced in code too.
   Matrix matches docs/AMS-Role-Access-Matrix.xlsx Recommended sheet. */
const AMS_ROLE_ACCESS_STORAGE_KEY = "ams_role_access_defaults";
const AMS_ACCESS_NONE = "none";
const AMS_ACCESS_VIEW = "view";
const AMS_ACCESS_FULL = "full";

const AMS_ROLE_ACCESS_RECOMMENDED = {
    dashboard:              { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    employee:               { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    asset:                  { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    mobile:                 { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    simCards:               { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    consumable:             { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    spareParts:             { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    accessory:              { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    assetDistribution:      { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    vendors:                { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    reports:                { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    settings:               { "Standard User": "full", "Viewer (Read-Only)": "full", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    systemAdmin:            { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    userMaster:             { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    company:                { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "none", "Super Root": "full", "Supreme Root": "full" },
    assetType:              { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    assetMake:              { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    assetCategory:          { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    site:                   { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    department:             { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    designation:            { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    simOperator:            { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    simPlan:                { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    consumableCategory:     { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    unitOfMeasure:          { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    sparePartCategory:      { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    vendorCategory:         { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    accessRights:           { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "none", "Super Root": "none", "Supreme Root": "full" },
    roleAccess:             { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "none", "Super Root": "none", "Supreme Root": "full" },
    log:                    { "Standard User": "none", "Viewer (Read-Only)": "none", "Admin": "none", "Super Root": "full", "Supreme Root": "full" },
    "report.assetLifecycle":    { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    "report.assetIssue":        { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    "report.assetHandover":     { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    "report.consumableRestock": { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    "report.consumableUsed":    { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    "report.sparePartsRestock": { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    "report.sparePartsUsed":    { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
    "report.assetDistribution": { "Standard User": "full", "Viewer (Read-Only)": "view", "Admin": "full", "Super Root": "full", "Supreme Root": "full" },
};

function amsNormalizeAccessLevel(value) {
    if (value === AMS_ACCESS_NONE || value === false || value === "false" || value === 0 || value === "0" || value === "N" || value === "NO") return AMS_ACCESS_NONE;
    if (value === AMS_ACCESS_VIEW || value === "VIEW" || value === "read") return AMS_ACCESS_VIEW;
    if (value === AMS_ACCESS_FULL || value === true || value === "true" || value === 1 || value === "1" || value === "Y" || value === "YES") return AMS_ACCESS_FULL;
    if (value == null || value === "") return AMS_ACCESS_NONE;
    return AMS_ACCESS_FULL;
}

function amsDefaultRoleAccessMap() {
    const map = {};
    AMS_USER_ROLES.forEach(role => { map[role] = {}; });
    AMS_PAGE_REGISTRY.forEach(p => {
        const rec = AMS_ROLE_ACCESS_RECOMMENDED[p.key] || {};
        AMS_USER_ROLES.forEach(role => {
            let level = rec[role] || AMS_ACCESS_NONE;
            if (p.key === "accessRights" || p.key === "roleAccess") {
                level = role === "Supreme Root" ? AMS_ACCESS_FULL : AMS_ACCESS_NONE;
            }
            if (p.key === "log") {
                level = (role === "Super Root" || role === "Supreme Root") ? AMS_ACCESS_FULL : AMS_ACCESS_NONE;
            }
            map[role][p.key] = level;
        });
    });
    return map;
}

function amsRoleAccessMapLooksLegacy(map) {
    if (!map || typeof map !== "object") return true;
    const roles = Object.keys(map);
    if (!roles.length) return true;
    for (let i = 0; i < roles.length; i++) {
        const pages = map[roles[i]];
        if (!pages || typeof pages !== "object") continue;
        const keys = Object.keys(pages);
        for (let j = 0; j < keys.length; j++) {
            const v = pages[keys[j]];
            if (v === true || v === false) return true;
        }
    }
    return false;
}

function amsMigrateRoleAccessDocument() {
    const current = AMS_ROLE_ACCESS_DEFAULTS;
    if (!amsRoleAccessMapLooksLegacy(current)) return;
    const next = amsDefaultRoleAccessMap();
    Object.keys(AMS_ROLE_ACCESS_DEFAULTS).forEach(k => delete AMS_ROLE_ACCESS_DEFAULTS[k]);
    Object.assign(AMS_ROLE_ACCESS_DEFAULTS, next);
    try { localStorage.setItem(AMS_ROLE_ACCESS_STORAGE_KEY, JSON.stringify(next)); } catch (e) { /* storage full */ }
    amsDbSaveDocAsync("roleAccess");
}

function amsGetRoleAccessDefaults() {
    if (AMS_ROLE_ACCESS_DEFAULTS && Object.keys(AMS_ROLE_ACCESS_DEFAULTS).length) return AMS_ROLE_ACCESS_DEFAULTS;
    try {
        const raw = localStorage.getItem(AMS_ROLE_ACCESS_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupt storage - fall back to defaults */ }
    return amsDefaultRoleAccessMap();
}

function amsAccessLevelForUserPage(user, registryKey) {
    if (!registryKey) return AMS_ACCESS_FULL;
    const role = (user && user.role) || ((typeof amsGetViewingAsRole === "function") ? amsGetViewingAsRole() : "Standard User");
    if (registryKey === "accessRights" || registryKey === "roleAccess") {
        if (role !== "Supreme Root") return AMS_ACCESS_NONE;
    }
    if (registryKey === "log") {
        if (role !== "Supreme Root" && role !== "Super Root") return AMS_ACCESS_NONE;
    }
    if (user && user.allowedPages !== null && user.allowedPages !== undefined) {
        if (Array.isArray(user.allowedPages)) {
            return user.allowedPages.indexOf(registryKey) !== -1 ? AMS_ACCESS_FULL : AMS_ACCESS_NONE;
        }
        if (typeof user.allowedPages === "object") {
            return amsNormalizeAccessLevel(user.allowedPages[registryKey]);
        }
    }
    const roleMap = amsGetRoleAccessDefaults()[role] || {};
    return amsNormalizeAccessLevel(roleMap[registryKey]);
}
function amsSaveRoleAccessDefaults(map) {
    Object.assign(AMS_ROLE_ACCESS_DEFAULTS, map);
    try { localStorage.setItem(AMS_ROLE_ACCESS_STORAGE_KEY, JSON.stringify(map)); } catch (e) { /* storage full */ }
    amsDbSaveDocAsync("roleAccess");
}

/* Nav / hub page id -> Access Rights registry key. Pages with no mapping stay visible. */
const AMS_NAV_TO_REGISTRY = {
    dashboard: "dashboard",
    employees: "employee",
    assets: "asset",
    mobiles: "mobile",
    "asset-distribution": "assetDistribution",
    consumables: "consumable",
    "spare-parts": "spareParts",
    accessories: "accessory",
    "sim-cards": "simCards",
    vendors: "vendors",
    reports: "reports",
    "system-admin": "systemAdmin",
    settings: "settings",
    "user-master": "userMaster",
    company: "company",
    "access-rights": "accessRights",
    "role-access": "roleAccess",
    log: "log",
    "master-asset-type": "assetType",
    "master-asset-make": "assetMake",
    "master-asset-category": "assetCategory",
    "master-site": "site",
    "master-department": "department",
    "master-designation": "designation",
    "master-sim-operator": "simOperator",
    "master-sim-plan": "simPlan",
    "master-consumable-category": "consumableCategory",
    "master-unit-of-measure": "unitOfMeasure",
    "master-spare-part-category": "sparePartCategory",
    "master-vendor-category": "vendorCategory",
};

function amsGetCurrentUserRecord() {
    const sess = (typeof amsGetSession === "function") ? amsGetSession() : null;
    if (!sess || !sess.username) return null;
    return AMS_DUMMY_USERS.find(u => u.username === sess.username) || null;
}

function amsEnsureSessionUserProfile() {
    const sess = (typeof amsGetSession === "function") ? amsGetSession() : null;
    if (!sess || !sess.username) return;
    if (AMS_DUMMY_USERS.some(u => u.username === sess.username)) return;
    AMS_DUMMY_USERS.push({
        username: sess.username,
        role: sess.role || "Standard User",
        displayName: sess.displayName || sess.name || sess.username,
        linkedEmployee: sess.linkedEmployee || "",
        email: sess.email || "",
        remarks: "",
        active: true,
        allowedPages: null,
    });
}

async function amsMergeLoginUsersIntoProfiles() {
    amsEnsureSessionUserProfile();
    try {
        const list = await amsApiGet("/api/auth/users");
        if (!Array.isArray(list)) return;
        list.forEach(u => {
            if (!u || !u.username) return;
            const existing = AMS_DUMMY_USERS.find(x => x.username === u.username);
            if (existing) {
                if (u.role) existing.role = u.role;
                if (u.displayName && !existing.displayName) existing.displayName = u.displayName;
                if (u.email && !existing.email) existing.email = u.email;
                if (u.linkedEmployee && !existing.linkedEmployee) existing.linkedEmployee = u.linkedEmployee;
                if (existing.active === undefined) existing.active = u.active !== false;
            } else {
                AMS_DUMMY_USERS.push({
                    username: u.username,
                    role: u.role || "Standard User",
                    displayName: u.displayName || u.username,
                    linkedEmployee: u.linkedEmployee || "",
                    email: u.email || "",
                    remarks: u.remarks || "",
                    active: u.active !== false,
                    allowedPages: null,
                });
            }
        });
    } catch (e) { /* Standard User cannot list accounts - session stub is enough */ }
}

function amsResolveAllowedPages(user) {
    if (!user) return AMS_PAGE_REGISTRY.map(p => p.key);
    return AMS_PAGE_REGISTRY.filter(p => amsAccessLevelForUserPage(user, p.key) !== AMS_ACCESS_NONE).map(p => p.key);
}

function amsUserCanAccessPage(registryKey) {
    if (!registryKey) return true;
    const role = (typeof amsGetViewingAsRole === "function") ? amsGetViewingAsRole() : "Standard User";
    const user = amsGetCurrentUserRecord() || { username: "", role: role, allowedPages: null };
    return amsAccessLevelForUserPage(user, registryKey) !== AMS_ACCESS_NONE;
}

function amsUserCanAccessNavPage(pageId) {
    const key = AMS_NAV_TO_REGISTRY[pageId];
    if (!key) return true;
    return amsUserCanAccessPage(key);
}

function amsCurrentPageRegistryKey() {
    if (typeof AMS_NAV_TO_REGISTRY !== "object") return "";
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const file = path.split("/").pop() || "";
    if (file === "" || file === "index.html") return "dashboard";
    const pageId = file.replace(/\.html$/, "");
    if (pageId === "masters") {
        const type = new URLSearchParams(window.location.search).get("type") || "";
        return AMS_NAV_TO_REGISTRY["master-" + type] || "";
    }
    return AMS_NAV_TO_REGISTRY[pageId] || "";
}

function amsUserCanWriteCurrentPage() {
    const key = amsCurrentPageRegistryKey();
    if (!key) return true;
    const role = (typeof amsGetViewingAsRole === "function") ? amsGetViewingAsRole() : "Standard User";
    const user = amsGetCurrentUserRecord() || { username: "", role: role, allowedPages: null };
    return amsAccessLevelForUserPage(user, key) === AMS_ACCESS_FULL;
}

function amsGuardViewOnlyWrite() {
    if (amsUserCanWriteCurrentPage()) return false;
    if (typeof amsToast === "function") amsToast("View only - you cannot change records on this page.", "warning");
    return true;
}

function amsApplyViewOnlyChrome() {
    if (typeof amsUserCanWriteCurrentPage !== "function") return;
    if (amsUserCanWriteCurrentPage()) return;
    document.body.classList.add("ams-view-only");
    const heading = document.querySelector(".page-heading");
    if (heading && !document.getElementById("amsViewOnlyBanner")) {
        const banner = document.createElement("p");
        banner.id = "amsViewOnlyBanner";
        banner.className = "form-hint";
        banner.textContent = "View only - you can open records on this page but cannot save, import, or delete.";
        heading.appendChild(banner);
    }
}

/* =============================================================================
   11) COMPANY  (single record used to fill print-form letterheads)
   ===========================================================================*/

const AMS_DUMMY_COMPANY_DETAILS = {};

/* localStorage-backed (like theme/notifications) so a saved name/logo shows on
   print letterheads generated from other pages/tabs. */
const AMS_COMPANY_STORAGE_KEY = "ams_company_details";

function amsGetCompanyDetails() {
    try {
        const raw = localStorage.getItem(AMS_COMPANY_STORAGE_KEY);
        if (raw) return Object.assign({}, AMS_DUMMY_COMPANY_DETAILS, JSON.parse(raw));
    } catch (e) { /* corrupt/unavailable storage - fall back to defaults */ }
    return AMS_DUMMY_COMPANY_DETAILS;
}

function amsSaveCompanyDetails(details) {
    try { localStorage.setItem(AMS_COMPANY_STORAGE_KEY, JSON.stringify(details)); } catch (e) { /* storage full */ }
    Object.assign(AMS_DUMMY_COMPANY_DETAILS, details);
    amsDbSaveDocAsync("company");
}

/* =============================================================================
   11.5) PORTAL PREFERENCES  (Settings page - localStorage-backed so the choices
         apply on every page, like theme/company/notifications)
   ===========================================================================*/

const AMS_PORTAL_NAME_STORAGE_KEY = "ams_portal_name";
const AMS_FONT_SIZE_STORAGE_KEY   = "ams_font_size";
const AMS_PAGE_SIZE_STORAGE_KEY   = "ams_page_size";
const AMS_TOAST_STORAGE_KEY       = "ams_toast_enabled";

const AMS_FONT_SIZE_OPTIONS = ["sm", "md", "lg"];   /* sm=14, md=16 (default), lg=18 */

function amsGetPortalName() {
    try { return localStorage.getItem(AMS_PORTAL_NAME_STORAGE_KEY) || "Asset Manager"; }
    catch (e) { return "Asset Manager"; }
}
function amsSavePortalName(name) {
    try { localStorage.setItem(AMS_PORTAL_NAME_STORAGE_KEY, name); } catch (e) { /* storage full */ }
}

function amsGetFontSize() {
    try {
        const v = localStorage.getItem(AMS_FONT_SIZE_STORAGE_KEY);
        return AMS_FONT_SIZE_OPTIONS.indexOf(v) > -1 ? v : "md";
    } catch (e) { return "md"; }
}
function amsSaveFontSize(size) {
    try { localStorage.setItem(AMS_FONT_SIZE_STORAGE_KEY, size); } catch (e) { /* storage full */ }
}

function amsGetDefaultPageSize() {
    try {
        const n = parseInt(localStorage.getItem(AMS_PAGE_SIZE_STORAGE_KEY), 10);
        return [10, 20, 50, 100].indexOf(n) > -1 ? n : 20;
    } catch (e) { return 20; }
}
function amsSaveDefaultPageSize(n) {
    try { localStorage.setItem(AMS_PAGE_SIZE_STORAGE_KEY, String(n)); } catch (e) { /* storage full */ }
}

function amsGetToastEnabled() {
    try { return localStorage.getItem(AMS_TOAST_STORAGE_KEY) !== "false"; }
    catch (e) { return true; }
}
function amsSaveToastEnabled(enabled) {
    try { localStorage.setItem(AMS_TOAST_STORAGE_KEY, enabled ? "true" : "false"); } catch (e) { /* storage full */ }
}

/* Applies the saved non-theme preferences on every page (called from layout.js
   initLayout). Font size uses an attribute + CSS in main.css. */
function amsApplyPortalPrefs() {
    if (document.documentElement) document.documentElement.setAttribute("data-font-size", amsGetFontSize());
}

/* =============================================================================
   11.6) REPORT HEADER APPEARANCE  (Reports page - what the company letterhead
         shows when printing any report/form, e.g. rectangular banner image,
         logo, company name, slogan, address). localStorage-backed so the choice
         applies to every print across the portal.
   ===========================================================================*/

const AMS_REPORT_HEADER_STORAGE_KEY = "ams_report_header_prefs";

const AMS_REPORT_HEADER_DEFAULTS = {
    style: "classic",      /* "classic" (logo + name block) | "banner" (rectangular image on top) */
    showLogo: true,
    showName: true,
    showSlogan: true,
    showAddress: true,
};

function amsGetReportHeaderPrefs() {
    const merged = Object.assign({}, AMS_REPORT_HEADER_DEFAULTS, AMS_REPORT_HEADER_PREFS);
    try {
        const raw = localStorage.getItem(AMS_REPORT_HEADER_STORAGE_KEY);
        if (raw) return Object.assign(merged, JSON.parse(raw));
    } catch (e) { /* corrupt/unavailable storage - fall back to defaults */ }
    return merged;
}

function amsSaveReportHeaderPrefs(prefs) {
    Object.assign(AMS_REPORT_HEADER_PREFS, prefs);
    try { localStorage.setItem(AMS_REPORT_HEADER_STORAGE_KEY, JSON.stringify(prefs)); } catch (e) { /* storage full */ }
    amsDbSaveDocAsync("reportPrefs");
}

/* Wipes every localStorage-backed demo preference + data (Settings > Data).
   The in-memory seed arrays are untouched, so a page reload brings the demo
   data back exactly as shipped. */
function amsResetDemoData() {
    ["ams-theme", "ams-ui-style", "ams-sidebar-show", "ams_notifications", "ams_activity_log", "ams_viewing_as_role",
     "ams_role_access_defaults", "ams_company_details",
     AMS_PORTAL_NAME_STORAGE_KEY, AMS_FONT_SIZE_STORAGE_KEY,
     AMS_PAGE_SIZE_STORAGE_KEY, AMS_TOAST_STORAGE_KEY,
     AMS_REPORT_HEADER_STORAGE_KEY].forEach(key => {
        try { localStorage.removeItem(key); } catch (e) { /* storage unavailable */ }
    });

    /* Runtime doc globals hold whatever was loaded from the DB this page-session;
       reset them too so "restore demo defaults" takes effect immediately without
       a reload. */
    Object.keys(AMS_REPORT_HEADER_PREFS).forEach(k => delete AMS_REPORT_HEADER_PREFS[k]);
    Object.keys(AMS_ROLE_ACCESS_DEFAULTS).forEach(k => delete AMS_ROLE_ACCESS_DEFAULTS[k]);
    Object.keys(AMS_DUMMY_COMPANY_DETAILS).forEach(k => delete AMS_DUMMY_COMPANY_DETAILS[k]);
}

/* =============================================================================
   12) EXIT RECORDS  (snapshot of employee exits, for printable Handover Forms)
   ===========================================================================*/

/* PLANNED DB TABLE: "ExitRecords". Until then an in-memory array (fresh clone
   per page load, same as every other array here). */
const AMS_DUMMY_EXIT_RECORDS = [];


function amsGenerateExitId() {
    const n = AMS_DUMMY_EXIT_RECORDS.length + 1;
    return `EXIT-${String(n).padStart(6, "0")}`;
}

const AMS_EXIT_FACILITIES_CHECKLIST = [
    "Email Login",
    "ERP Login",
    "Access Card / Biometric",
    "VPN Access",
];

/* =============================================================================
   13) STATUS COLORS  (maps a status string to a badge CSS class)
   ===========================================================================*/

const STATUS_BADGE_CLASS = {
    "Operational":       "badge-green",
    "Under Maintenance": "badge-amber",
    "Out of Service":    "badge-red",
    "In Stock":          "badge-green",
    "Out of Stock":      "badge-red",
    "Low Stock":         "badge-amber",
    "Active":            "badge-green",
    "Inactive":          "badge-red",
    "Assigned":          "badge-green",
    "In Store":          "badge-blue",
    "In Repair":         "badge-amber",
    "Transfer":          "badge-blue",
    "Not Working":       "badge-red",
    "Retired / Scrapped": "badge-red",
    "Replaced":          "badge-grey",
    "Exited":            "badge-red"
};

/* =============================================================================
   14) SUMMARY HELPERS  (small functions every page can reuse)
   ===========================================================================*/

function getAssetSummary() {
    const total = DUMMY_ASSETS.length;
    const operational = DUMMY_ASSETS.filter(a => a.status === "Assigned" || a.status === "In Store").length;
    const maintenance = DUMMY_ASSETS.filter(a => a.status === "In Repair" || a.status === "Not Working").length;
    const outOfService = DUMMY_ASSETS.filter(a => a.status === "Retired / Scrapped").length;
    const totalValue = DUMMY_ASSETS.reduce((sum, a) => sum + (a.purchaseCost || 0), 0);
    return { total, operational, maintenance, outOfService, totalValue };
}

/* Items whose stock is at or below their reorder level need attention */
function getLowStockItems() {
    const lowConsumables = AMS_DUMMY_CONSUMABLES
        .filter(c => c.qty <= c.reorderLevel)
        .map(c => ({ id: c.consumableId, name: c.name, stock: c.qty, type: "Consumable" }));

    const lowSpareParts = AMS_DUMMY_SPARE_PARTS
        .filter(p => p.qty <= p.reorderLevel)
        .map(p => ({ id: p.partId, name: p.name, stock: p.qty, type: "Spare Part" }));

    return [...lowConsumables, ...lowSpareParts];
}

function getConsumableSummary() {
    const total = AMS_DUMMY_CONSUMABLES.length;
    const totalUnits = AMS_DUMMY_CONSUMABLES.reduce((sum, c) => sum + c.qty, 0);
    const lowStock = AMS_DUMMY_CONSUMABLES.filter(c => c.qty <= c.reorderLevel).length;
    return { total, totalUnits, lowStock };
}

function getSparePartSummary() {
    const total = AMS_DUMMY_SPARE_PARTS.length;
    const totalUnits = AMS_DUMMY_SPARE_PARTS.reduce((sum, p) => sum + p.qty, 0);
    const lowStock = AMS_DUMMY_SPARE_PARTS.filter(p => p.qty <= p.reorderLevel).length;
    return { total, totalUnits, lowStock };
}

/* Chart data: assets grouped by category, for the dashboard bar chart */
function getAssetsByCategory() {
    const groups = {};
    DUMMY_ASSETS.forEach(a => {
        groups[a.category] = (groups[a.category] || 0) + 1;
    });
    return Object.entries(groups)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}

/* Chart data: assets grouped by TYPE, for the dashboard bar chart. The dummy
   set is mostly IT hardware, so this breakdown (Laptop/Desktop/Printer/
   Monitor) gives a meaningful multi-bar chart. */
function getAssetsByType() {
    const groups = {};
    DUMMY_ASSETS.forEach(a => {
        groups[a.type] = (groups[a.type] || 0) + 1;
    });
    return Object.entries(groups)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}

/* Chart data: donut ring showing asset status distribution */
function getAssetsByStatus() {
    const groups = {};
    DUMMY_ASSETS.forEach(a => {
        groups[a.status] = (groups[a.status] || 0) + 1;
    });
    return groups;
}

/* Employee counts by status - used if a page needs a head-count summary */
function getEmployeeSummary() {
    const active = DUMMY_EMPLOYEES.filter(e => e.status === "Active").length;
    const inactive = DUMMY_EMPLOYEES.length - active;
    const assignedAssets = DUMMY_ASSETS.filter(a => a.assignedTo).length
        + DUMMY_MOBILES.filter(a => a.assignedTo).length
        + AMS_DUMMY_SIM_CARDS.filter(s => s.assignedTo).length;
    return { total: DUMMY_EMPLOYEES.length, active, inactive, assignedAssets };
}

/*------------------------------------------------------------------------------
#-------------- End of the code : DUMMY DATA ---------------------------------
#------------------------------------------------------------------------------*/
