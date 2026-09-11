/*==============================================================================
#-------------- Start Code for : MASTER TABLE ENGINE (master-table.js) ---------
#
#  PURPOSE   : One generic engine that powers EVERY Master Table page
#              (Asset Type Master, Asset Make Master, Asset Category Master,
#              Site Master, Department Master, Designation Master, ...).
#              Each master page just defines a small AMS_MASTER_CONFIG object
#              (see bottom of any pages/masters/*.html) and includes this
#              file - no page needs its own CRUD logic written again.
#
#  HOW TO ADD A NEW MASTER PAGE :
#    1. Copy an existing page under pages/masters/, rename it.
#    2. Define a new AMS_MASTER_CONFIG for the new master (fields, data
#       array, usage-check function).
#    3. Add one entry to NAV_ITEMS in js/layout.js.
#    4. Done - table, Add/Edit modal, search, activate/deactivate,
#       delete-with-usage-guard all come from this file automatically.
#
#  PORTER'S NOTE : Ported from v3-3 (master-table-v1-0.js) into v4-0.
#       - Uses v4-0 theme variables (see css/master-table.css).
#       - Uses amsToast (v4-0) instead of v3-3's amsNotify.
#------------------------------------------------------------------------------*/

/* ---- HELPER: escape text for safe HTML insertion ---------------------------- */
function amsEsc(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

/* ---- STATE ------------------------------------------------------------------ */
/* AMS_MASTER_CONFIG is defined per-page (before this script loads). It looks like:
 * {
 *   pageTitle: "Asset Type Master",
 *   pageSub:   "Manage asset types used across the system",
 *   dataArray: AMS_DUMMY_ASSET_TYPES,   // the actual array object - mutated in place
 *   idKey:     "name",                   // field used as the unique key
 *   fields: [
 *     { key: "name",      label: "Asset Type Name",          required: true },
 *     { key: "shortform", label: "Shortform (for Asset ID)", required: true, upper: true, maxLength: 4 },
 *   ],
 *   usageCount: (item) => AMS_DUMMY_ASSETS.filter(a => a.type === item.name).length,
 * }
 */
const AMS_MT_STATE = { editingKey: null, booted: false };

function amsMtMatchKeys() {
    const cfg = AMS_MASTER_CONFIG;
    return (cfg.importMatchKeys && cfg.importMatchKeys.length) ? cfg.importMatchKeys : null;
}

function amsMtDuplicateOf(values, excludeKey) {
    const cfg = AMS_MASTER_CONFIG;
    const keys = amsMtMatchKeys();
    if (keys) {
        return cfg.dataArray.find(i =>
            i[cfg.idKey] !== excludeKey
            && keys.every(k => String(i[k] || "").toLowerCase() === String(values[k] || "").toLowerCase())
        ) || null;
    }
    const idVal = values[cfg.idKey];
    if (!idVal) return null;
    return cfg.dataArray.find(i =>
        i[cfg.idKey] !== excludeKey
        && String(i[cfg.idKey] || "").toLowerCase() === String(idVal).toLowerCase()
    ) || null;
}

function amsMtDuplicateMessage() {
    const cfg = AMS_MASTER_CONFIG;
    const keys = amsMtMatchKeys();
    if (!keys) return `A record with this ${cfg.idKey} already exists.`;
    const labels = keys.map(k => {
        const field = (cfg.fields || []).find(f => f.key === k);
        return field ? field.label : k;
    });
    return `A record with this ${labels.join(" + ")} already exists.`;
}

/* ---- EXPORT: current records as real .xlsx --------------------------------- */
function amsExportMaster() {
    const cfg = AMS_MASTER_CONFIG;
    const headers = [...cfg.fields.map(f => f.key), ...(cfg.autoIdField ? [cfg.autoIdField] : []), "active"];
    const source = (typeof cfg.rowFilter === "function") ? cfg.dataArray.filter(cfg.rowFilter) : cfg.dataArray;
    const getterMap = {};
    cfg.fields.forEach(f => {
        if (f.hideInTable) return;
        getterMap[f.key] = item => f.type === "date" ? amsFormatDate(item[f.key]) : item[f.key];
    });
    if (cfg.usageCount) getterMap["__usage"] = item => cfg.usageCount(item);
    getterMap["__active"] = item => item.active ? "Active" : "Inactive";
    const filtered = typeof amsFilterRows === "function" ? amsFilterRows("masterTable", source, getterMap) : source;
    const rows = filtered.map(item => [
        ...cfg.fields.map(f => f.type === "date" ? amsFormatDate(item[f.key]) : item[f.key]),
        ...(cfg.autoIdField ? [item[cfg.autoIdField]] : []), item.active ? "true" : "false",
    ]);
    amsExportXlsx(`${cfg.pageTitle.replace(/\s+/g, "_")}_export`, headers, rows);
}

/* ---- TEMPLATE: .xlsx workbook with Instructions + header/example sheet ----- */
function amsDownloadTemplate() {
    const cfg = AMS_MASTER_CONFIG;
    const headers = [...cfg.fields.map(f => f.key + (f.required ? "*" : "")), "active"];
    const sample = cfg.fields.map(f => f.upper ? "EX" : f.type === "date" ? "13-07-2026" : `Example ${f.label}`);
    amsWriteWorkbook(`${cfg.pageTitle.replace(/\s+/g, "_")}_import_template.xlsx`, [
        { name: "Instructions", cols: [{ wch: 80 }], aoa: [
            [`${cfg.pageTitle} Import Template - Instructions`],
            ["Fields marked with * are required."],
            ["Do not delete the header row (row 2)."],
            ['"active" = true/false.'],
        ] },
        { name: "Template", aoa: [headers, [...sample, "true"]] },
    ]);
}

/* ---- IMPORT: bulk upload (upserts by idKey - existing update, new get added) */
function amsHandleImportFile(file) {
    if (typeof amsGuardViewOnlyWrite === "function" && amsGuardViewOnlyWrite()) return;
    const cfg = AMS_MASTER_CONFIG;
    amsReadImportRows(file).then((rows) => {
        rows = rows.filter(r => !(r[0] || "").trim().startsWith("#")); // drop instruction lines
        if (!rows.length) { amsToast("File is empty or unreadable.", "warning"); return; }
        const headers = rows[0].map(h => h.trim().replace(/\*$/, "")); // strip required-marker *
        const results = [];
        const seenKeys = new Set(); // within-file duplicate detection

        const identity = (obj) => cfg.autoIdField && cfg.importMatchKeys
            ? cfg.importMatchKeys.map(k => String(obj[k] || "").toLowerCase()).join("|")
            : String(obj[cfg.idKey] || "").toLowerCase();

        if (typeof amsDbSuspendSaves === "function") amsDbSuspendSaves();
        try {
        for (let i = 1; i < rows.length; i++) {
            const raw = rows[i];
            if (!raw.length || raw.every(c => !c)) continue;
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = raw[idx] !== undefined ? raw[idx].trim() : ""; });
            const line = i + 1;
            const record = obj[cfg.idKey] || obj[cfg.fields[0]?.key] || "(unnamed)";

            let valid = true;
            const missingFields = [];
            cfg.fields.forEach(f => {
                if (f.upper && obj[f.key]) obj[f.key] = obj[f.key].toUpperCase();
                if (f.type === "date" && obj[f.key]) obj[f.key] = amsParseDMY(obj[f.key]);
                if (f.required && !obj[f.key]) { valid = false; missingFields.push(f.label); }
            });
            if (!valid) {
                results.push({ row: line, record, result: "error", reason: "Missing required field(s): " + missingFields.join(", ") });
                continue;
            }
            if (!cfg.autoIdField && !obj[cfg.idKey]) {
                results.push({ row: line, record, result: "error", reason: `Missing identity field "${cfg.idKey}"` });
                continue;
            }

            const key = identity(obj);
            if (seenKeys.has(key)) {
                results.push({ row: line, record, result: "error", reason: `Duplicate "${cfg.idKey || cfg.importMatchKeys[0]}" "${obj[cfg.idKey] || obj[cfg.importMatchKeys[0]]}" already used earlier in this file` });
                continue;
            }
            seenKeys.add(key);

            const active = obj.active === undefined || obj.active === "" ? true : !["false", "0", "no"].includes(String(obj.active).toLowerCase());
            const existing = cfg.autoIdField && cfg.importMatchKeys
                ? cfg.dataArray.find(item => cfg.importMatchKeys.every(k => String(item[k]).toLowerCase() === String(obj[k] || "").toLowerCase()))
                : cfg.dataArray.find(item => String(item[cfg.idKey]).toLowerCase() === obj[cfg.idKey].toLowerCase());
            if (existing) {
                if (typeof cfg.rowFilter === "function" && !cfg.rowFilter(existing)) {
                    results.push({ row: line, record, result: "skipped", reason: "Record is not visible to your role" });
                    continue;
                }
                if (typeof cfg.writeGuard === "function") {
                    const guard = cfg.writeGuard(obj, existing);
                    if (guard && !guard.allowed) {
                        results.push({ row: line, record, result: "skipped", reason: guard.reason || "Not allowed for your role" });
                        continue;
                    }
                }
                cfg.fields.forEach(f => { if (obj[f.key]) existing[f.key] = obj[f.key]; });
                existing.active = active;
                results.push({ row: line, record, result: "updated", reason: "Existing record updated" });
            } else {
                const newItem = { active };
                cfg.fields.forEach(f => { newItem[f.key] = obj[f.key] || ""; });
                if (cfg.autoIdField) newItem[cfg.autoIdField] = cfg.autoIdGenerate(newItem);
                if (typeof cfg.rowFilter === "function" && !cfg.rowFilter(newItem)) {
                    results.push({ row: line, record, result: "skipped", reason: "Record is not visible to your role" });
                    continue;
                }
                if (typeof cfg.writeGuard === "function") {
                    const guard = cfg.writeGuard(newItem, null);
                    if (guard && !guard.allowed) {
                        results.push({ row: line, record, result: "skipped", reason: guard.reason || "Not allowed for your role" });
                        continue;
                    }
                }
                cfg.dataArray.push(newItem);
                results.push({ row: line, record, result: "added", reason: "New record added" });
            }
        }
        } finally {
            if (typeof amsDbResumeSaves === "function") amsDbResumeSaves();
        }

        amsRenderMasterTable();
        const added = results.filter(r => r.result === "added").length;
        const updated = results.filter(r => r.result === "updated").length;
        const skipped = results.filter(r => r.result === "skipped").length;
        const errors = results.filter(r => r.result === "error").length;
        amsDbSaveArray(cfg.dataArray);
        amsToast(`Import complete: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} error(s). See report for details.`, added > 0 ? "success" : "info");
        amsShowImportReport(results);
        document.getElementById("importFileInput").value = "";
    }).catch((err) => {
        amsToast("Could not read import file: " + (err && err.message ? err.message : err), "danger");
    });
}

function amsMtEnsureFilters() {
    const searchBox = document.getElementById("searchBox");
    if (!searchBox) return;
    let bar = document.getElementById("mtFilterBar");
    if (!bar) {
        bar = document.createElement("div");
        bar.id = "mtFilterBar";
        bar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:center;";
        searchBox.insertAdjacentElement("afterend", bar);
    }
    if (bar.querySelector("#mtFilter-active")) return;
    bar.innerHTML = `<select id="mtFilter-active" class="select" style="width:auto;">
        <option value="">All Status</option>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
    </select>
    <button type="button" class="btn btn-secondary btn-clear-filters" id="btnMtClearFilters" title="Clear column filters">Clear filters</button>`;
    document.getElementById("mtFilter-active").addEventListener("change", amsRenderMasterTable);
    document.getElementById("btnMtClearFilters").addEventListener("click", () => amsFilterClearAndRender("masterTable"));
}

/* ---- RENDER: the master table ---------------------------------------------- */
async function amsRenderMasterTable() {
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();
    const cfg = AMS_MASTER_CONFIG;
    const searchTerm = (document.getElementById("searchBox").value || "").toLowerCase();
    amsMtEnsureFilters();

    const source = (typeof cfg.rowFilter === "function") ? cfg.dataArray.filter(cfg.rowFilter) : cfg.dataArray;
    const filtered = source
        .filter(item => {
            const activeFilter = (document.getElementById("mtFilter-active") || {}).value || "";
            if (activeFilter === "true" && !item.active) return false;
            if (activeFilter === "false" && item.active) return false;
            if (!searchTerm) return true;
            return cfg.fields.some(f => String(item[f.key] || "").toLowerCase().includes(searchTerm));
        });

    /* Sortable headers (shared js/sortable.js engine) */
    const getterMap = {};
    cfg.fields.forEach(f => {
        if (f.hideInTable) return;
        getterMap[f.key] = item => f.type === "date" ? amsFormatDate(item[f.key]) : item[f.key];
    });
    if (cfg.usageCount) getterMap["__usage"] = item => cfg.usageCount(item);
    getterMap["__active"] = item => item.active ? "Active" : "Inactive";
    const colFiltered = amsFilterRows("masterTable", filtered, getterMap);
    const sorted = amsSortRows("masterTable", colFiltered, getterMap);

    const rows = sorted
        .map(item => {
            const usage = cfg.usageCount ? cfg.usageCount(item) : 0;
            const guard = cfg.deleteGuard ? cfg.deleteGuard(item) : null;
            const deleteBlocked = usage > 0 || (guard && !guard.allowed);
            const deleteTitle = usage > 0 ? "In use - cannot delete" : ((guard && guard.reason) || "");
            const statusBadge = item.active
                ? `<span class="badge badge-green">Active</span>`
                : `<span class="badge badge-grey">Inactive</span>`;
            const fieldCells = cfg.fields.map(f => {
                if (f.hideInTable) return "";
                let display = f.type === "date" ? amsFormatDate(item[f.key]) : amsEsc(item[f.key]);
                if (f.format) display = f.format(item[f.key], item); // format() owns its own escaping
                return `<td ${f.multiline ? 'style="white-space:pre-line; max-width:220px;"' : ""}>${display}</td>`;
            }).join("");
            const rowBadge = cfg.rowBadge ? cfg.rowBadge(item) : "";

            return `<tr>
                ${fieldCells}
                ${cfg.rowBadge ? `<td>${rowBadge}</td>` : ""}
                ${cfg.usageCount ? `<td class="mono">${usage}</td>` : ""}
                <td>${statusBadge}</td>
                <td class="actions-cell">
                    <button class="actions-trigger" data-actions-for="${amsEsc(item[cfg.idKey])}" title="Actions">Actions ${typeof amsUiIcon === "function" ? amsUiIcon("caret") : ""}</button>
                    <div class="actions-menu" id="menu-${amsEsc(item[cfg.idKey])}">
                        <button data-mt-action="edit" data-key="${amsEsc(item[cfg.idKey])}">Edit</button>
                        <button data-mt-action="toggle" data-key="${amsEsc(item[cfg.idKey])}">${item.active ? "Deactivate" : "Activate"}</button>
                        <button class="danger-item" data-mt-action="delete" data-key="${amsEsc(item[cfg.idKey])}" ${deleteBlocked ? `disabled title="${amsEsc(deleteTitle)}"` : ""}>Delete</button>
                        ${cfg.rowActions ? `<div class="menu-divider"></div>` + cfg.rowActions.map(ra =>
                            `<button data-mt-custom-action="${ra.key}" data-key="${amsEsc(item[cfg.idKey])}">${amsEsc(ra.label)}</button>`).join("") : ""}
                    </div>
                </td>
            </tr>`;
        }).join("");

    const visibleFields = cfg.fields.filter(f => !f.hideInTable);
    const headCells = visibleFields.map(f => amsSortableTh("masterTable", f.key, f.label)).join("");
    const extraColCount = (cfg.rowBadge ? 1 : 0) + (cfg.usageCount ? 1 : 0);
    const filterKeys = visibleFields.map(f => f.key)
        .concat(cfg.rowBadge ? [""] : [])
        .concat(cfg.usageCount ? ["__usage"] : [])
        .concat(["__active", ""]);
    document.getElementById("masterTable").innerHTML = `
        <thead><tr>${headCells}${cfg.rowBadge ? `<th>${amsEsc(cfg.rowBadgeLabel || "Flag")}</th>` : ""}${cfg.usageCount ? amsSortableTh("masterTable", "__usage", "Used By") : ""}${amsSortableTh("masterTable", "__active", "Status")}<th></th></tr>${amsFilterHeadRow("masterTable", filterKeys)}</thead>
        <tbody>${rows || `<tr><td colspan="${visibleFields.length + extraColCount + 2}" style="color:var(--text-muted)">No records found</td></tr>`}</tbody>`;
    if (typeof amsFilterRestoreFocus === "function") amsFilterRestoreFocus("masterTable");
}

/* ---- MODAL open/close ------------------------------------------------------- */
function amsMtOpenModal() { document.getElementById("modalForm").classList.add("open"); }
function amsMtCloseModal() { document.getElementById("modalForm").classList.remove("open"); }

/* ---- BUILD Add/Edit form fields dynamically --------------------------------- */
function amsMtBuildFormFields() {
    const cfg = AMS_MASTER_CONFIG;
    const container = document.getElementById("mtFormFields");
    container.innerHTML = cfg.fields.map(f => {
        let control;
        if (f.type === "select") {
            const opts = f.optionsFrom ? f.optionsFrom() : (f.options || []);
            const optHtml = o => typeof o === "object"
                ? `<option value="${amsEsc(o.value)}">${amsEsc(o.label)}</option>`
                : `<option value="${amsEsc(o)}">${amsEsc(o)}</option>`;
            const selectHtml = `<select id="mt-${f.key}">${f.includeBlank ? '<option value="">(None - optional)</option>' : ""}${opts.map(optHtml).join("")}</select>`;
            control = f.quickAdd
                ? `<div class="select-with-add">
                    ${selectHtml}
                    <button type="button" class="btn-quickadd" data-mt-quickadd="${f.key}" title="Add new">+</button>
                    <div class="quickadd-popover" id="mtQaPopover-${f.key}">
                        ${f.quickAdd.fields.map(qf => {
                            if (qf.type === "select") {
                                const qopts = qf.optionsFrom ? qf.optionsFrom() : (qf.options || []);
                                return `<label class="qa-label">${amsEsc(qf.label)}</label>
                            <select id="mtQa-${f.key}-${qf.key}">${qopts.map(o => `<option value="${amsEsc(o)}">${amsEsc(o)}</option>`).join("")}</select>`;
                            }
                            return `<label class="qa-label">${amsEsc(qf.label)}</label>
                            <input type="text" id="mtQa-${f.key}-${qf.key}" ${qf.maxLength ? `maxlength="${qf.maxLength}"` : ""} ${qf.upper ? 'style="text-transform:uppercase;"' : ""}>`;
                        }).join("")}
                        <div class="qa-actions">
                            <button type="button" class="btn btn-secondary" data-mt-qa-cancel="${f.key}">Cancel</button>
                            <button type="button" class="btn" data-mt-qa-save="${f.key}">Add</button>
                        </div>
                    </div>
                </div>`
                : selectHtml;
        } else if (f.type === "password") {
            control = `<input type="password" id="mt-${f.key}" autocomplete="new-password" placeholder="${f.editOnly ? "Leave blank to keep current password" : ""}">`;
        } else if (f.type === "number") {
            control = `<input type="number" id="mt-${f.key}" ${f.min !== undefined ? `min="${f.min}"` : ""} step="${f.step || "1"}">`;
        } else if (f.type === "date") {
            control = `<input type="date" id="mt-${f.key}">`;
        } else if (f.multiline) {
            control = `<textarea id="mt-${f.key}" rows="3"></textarea>`;
        } else {
            control = `<input type="text" id="mt-${f.key}" ${f.maxLength ? `maxlength="${f.maxLength}"` : ""} ${f.upper ? 'style="text-transform:uppercase;"' : ""}>`;
        }
        return `<div class="form-field"><label>${amsEsc(f.label)} ${f.required ? '<span class="req">*</span>' : ""}</label>${control}</div>`;
    }).join("") + `
        <label class="form-checkbox">
            <input type="checkbox" id="mt-active" checked> Active
        </label>`;
}

/* ---- ADD / EDIT: open + save ------------------------------------------------ */
function amsMtOpenAdd() {
    const cfg = AMS_MASTER_CONFIG;
    AMS_MT_STATE.editingKey = null;
    document.getElementById("mtModalTitle").textContent = `Add ${cfg.pageTitle.replace(" Master", "")}`;
    amsMtBuildFormFields();
    cfg.fields.forEach(f => { document.getElementById(`mt-${f.key}`).value = ""; });
    document.getElementById("mt-active").checked = true;
    amsMtOpenModal();
}

/* Appends a value as an option if a select doesn't already offer it, so
   editing a record never blanks a value that fell out of the master list
   (e.g. a vendor / site that was deactivated after the record was created). */
function amsMtEnsureOption(sel, value) {
    if (!value) return;
    if (!Array.from(sel.options).some(o => o.value === value)) {
        const opt = document.createElement("option");
        opt.value = value; opt.textContent = value;
        sel.appendChild(opt);
    }
}

function amsMtOpenEdit(key) {
    const cfg = AMS_MASTER_CONFIG;
    const item = cfg.dataArray.find(i => i[cfg.idKey] === key);
    AMS_MT_STATE.editingKey = key;
    document.getElementById("mtModalTitle").textContent = `Edit ${cfg.pageTitle.replace(" Master", "")}`;
    amsMtBuildFormFields();
    cfg.fields.forEach(f => {
        const el = document.getElementById(`mt-${f.key}`);
        if (f.type === "select" && item[f.key]) amsMtEnsureOption(el, item[f.key]);
        if (f.type === "password") { el.value = ""; return; } // never render a stored password back
        el.value = item[f.key] || "";
    });
    document.getElementById("mt-active").checked = !!item.active;
    amsMtOpenModal();
}

document.getElementById("mtForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (typeof amsGuardViewOnlyWrite === "function" && amsGuardViewOnlyWrite()) return;
    const cfg = AMS_MASTER_CONFIG;

    const values = {};
    for (const f of cfg.fields) {
        let val = document.getElementById(`mt-${f.key}`).value.trim();
        if (f.upper) val = val.toUpperCase();
        if (f.required && !val && !(f.editOnly && AMS_MT_STATE.editingKey)) { amsToast(`${f.label} is required.`, "warning"); return; }
        values[f.key] = val;
    }
    const active = document.getElementById("mt-active").checked;
    values.active = active;

    if (typeof cfg.writeGuard === "function") {
        const existing = AMS_MT_STATE.editingKey
            ? cfg.dataArray.find(i => i[cfg.idKey] === AMS_MT_STATE.editingKey)
            : null;
        const guard = cfg.writeGuard(values, existing || null);
        if (guard && !guard.allowed) { amsToast(guard.reason || "You don't have permission to save this record.", "warning"); return; }
    }

    if (amsMtDuplicateOf(values, AMS_MT_STATE.editingKey)) {
        amsToast(amsMtDuplicateMessage(), "warning");
        return;
    }
    if (cfg.autoIdField && !AMS_MT_STATE.editingKey) {
        values[cfg.autoIdField] = cfg.autoIdGenerate(values);
    }

    /* Optional page hook: e.g. User Master syncs the login (with password) to
       the ams_users table via the API. If the hook throws, the local record
       is not saved. */
    if (typeof cfg.onBeforeSave === "function") {
        try {
            await cfg.onBeforeSave(values, AMS_MT_STATE.editingKey);
        } catch (err) {
            amsToast(err.message || "Save cancelled.", "danger");
            return;
        }
    }

    if (AMS_MT_STATE.editingKey) {
        const item = cfg.dataArray.find(i => i[cfg.idKey] === AMS_MT_STATE.editingKey);
        delete values.password; // passwords live only in the API (hashed), never in the local copy
        Object.assign(item, values);
        item.active = active;
        amsToast(`${cfg.pageTitle.replace(" Master", "")} updated: ${values[cfg.fields[0].key]}`, "info");
    } else {
        delete values.password; // passwords live only in the API (hashed), never in the local copy
        const rec = { ...values, active };
        cfg.dataArray.push(rec);
        amsToast(`${cfg.pageTitle.replace(" Master", "")} added: ${values[cfg.fields[0].key]}`, "success");
    }

    amsMtCloseModal();
    amsRenderMasterTable();
    amsDbSaveArray(cfg.dataArray);
});

/* ---- TOGGLE active / deactivate --------------------------------------------- */
async function amsMtToggleActive(key) {
    if (typeof amsGuardViewOnlyWrite === "function" && amsGuardViewOnlyWrite()) return;
    const cfg = AMS_MASTER_CONFIG;
    const item = cfg.dataArray.find(i => i[cfg.idKey] === key);
    const newActive = !item.active;
    if (typeof cfg.onBeforeToggle === "function") {
        try {
            const hook = cfg.onBeforeToggle(item, newActive);
            if (hook && typeof hook.then === "function") await hook;
        } catch (err) {
            amsToast(err.message || "Update cancelled.", "danger");
            return;
        }
    }
    item.active = newActive;
    amsToast(`${cfg.pageTitle.replace(" Master", "")} ${item.active ? "activated" : "deactivated"}: ${key}`, item.active ? "success" : "warning");
    amsRenderMasterTable();
    amsDbSaveArray(cfg.dataArray);
}

/* ---- DELETE (blocked if currently in use) ----------------------------------- */
async function amsMtDelete(key) {
    if (typeof amsGuardViewOnlyWrite === "function" && amsGuardViewOnlyWrite()) return;
    const cfg = AMS_MASTER_CONFIG;
    const item = cfg.dataArray.find(i => i[cfg.idKey] === key);
    const usage = cfg.usageCount ? cfg.usageCount(item) : 0;
    if (usage > 0) { amsToast(`Cannot delete - currently used by ${usage} record(s). Deactivate instead.`, "warning"); return; }
    if (cfg.deleteGuard) {
        const guard = cfg.deleteGuard(item);
        if (guard && !guard.allowed) { amsToast(guard.reason || "You don't have permission to delete this record.", "warning"); return; }
    }
    if (!confirm(`Delete "${item[cfg.idKey]}"? This cannot be undone.`)) return;
    if (typeof cfg.onBeforeDelete === "function") {
        const hook = cfg.onBeforeDelete(item);
        if (hook && typeof hook.then === "function") await hook;
    }
    cfg.dataArray.splice(cfg.dataArray.indexOf(item), 1);
    amsToast(`${cfg.pageTitle.replace(" Master", "")} deleted: ${key}`, "danger");
    amsRenderMasterTable();
    amsDbSaveArray(cfg.dataArray);
}

/* ---- ROW ACTION delegation --------------------------------------------------- */
/* Row-menu helpers - prefer the shared viewport-anchored helpers from
   js/layout.js, but fall back to the classic open/close so the menus still
   work even if an older (cached) layout.js is loaded. */
function amsOpenRowMenu(trigger, menu) {
    if (typeof amsDropdownOpen === "function") { amsDropdownOpen(trigger, menu); return; }
    document.querySelectorAll(".actions-menu.open").forEach(m => m.classList.remove("open"));
    menu.classList.add("open");
    /* Viewport-anchored fallback (mirrors amsDropdownOpen): even with a stale
       cached layout.js the menu opens right under its trigger instead of
       floating absolute inside (and being clipped by) the table's scroll
       container. */
    const r = trigger.getBoundingClientRect();
    const mw = menu.offsetWidth || 200;
    const mh = menu.offsetHeight || 320;
    menu.style.position = "fixed";
    menu.style.right = "auto";
    menu.style.top = "auto";
    menu.style.zIndex = "500";
    let left = r.right - mw;
    if (left < 8) left = Math.max(8, r.left);
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) { top = r.top - mh - 6; if (top < 8) top = 8; }
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    menu.style.width = mw + "px";
}
function amsCloseRowMenus() {
    if (typeof amsDropdownClose === "function") { amsDropdownClose(); return; }
    document.querySelectorAll(".actions-menu.open").forEach(m => {
        m.classList.remove("open");
        m.style.position = ""; m.style.left = ""; m.style.top = "";
        m.style.right = ""; m.style.width = ""; m.style.zIndex = "";
    });
}

function amsMtCloseAllRowMenus() {
    amsCloseRowMenus();
}

document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-actions-for]");
    if (trigger) {
        const menu = document.getElementById(`menu-${trigger.getAttribute("data-actions-for")}`);
        const wasOpen = menu.classList.contains("open");
        amsMtCloseAllRowMenus();
        if (!wasOpen) amsOpenRowMenu(trigger, menu);
        return;
    }
    if (!e.target.closest(".actions-menu")) amsMtCloseAllRowMenus();
});

document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mt-action]");
    if (!btn) return;
    amsMtCloseAllRowMenus();
    const action = btn.getAttribute("data-mt-action");
    const key = btn.getAttribute("data-key");
    if (action === "edit") amsMtOpenEdit(key);
    else if (action === "toggle") amsMtToggleActive(key);
    else if (action === "delete") amsMtDelete(key);
});

document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mt-custom-action]");
    if (!btn) return;
    amsMtCloseAllRowMenus();
    const cfg = AMS_MASTER_CONFIG;
    const ra = (cfg.rowActions || []).find(r => r.key === btn.getAttribute("data-mt-custom-action"));
    const item = cfg.dataArray.find(i => i[cfg.idKey] === btn.getAttribute("data-key"));
    if (ra && item) ra.handler(item);
});

document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => document.getElementById(btn.getAttribute("data-close")).classList.remove("open"));
});

/* ---- QUICK-ADD (+) on select fields ------------------------------------------ */
function amsMtCloseAllQuickAdd() {
    document.querySelectorAll(".quickadd-popover.open").forEach(p => p.classList.remove("open"));
}

document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-mt-quickadd]");
    if (trigger) {
        e.stopPropagation();
        const popover = document.getElementById(`mtQaPopover-${trigger.getAttribute("data-mt-quickadd")}`);
        const wasOpen = popover.classList.contains("open");
        amsMtCloseAllQuickAdd();
        if (!wasOpen) popover.classList.add("open");
        return;
    }
    const cancelBtn = e.target.closest("[data-mt-qa-cancel]");
    if (cancelBtn) { amsMtCloseAllQuickAdd(); return; }

    const saveBtn = e.target.closest("[data-mt-qa-save]");
    if (saveBtn) {
        const key = saveBtn.getAttribute("data-mt-qa-save");
        const field = AMS_MASTER_CONFIG.fields.find(f => f.key === key);
        const values = {};
        field.quickAdd.fields.forEach(qf => { values[qf.key] = document.getElementById(`mtQa-${key}-${qf.key}`).value.trim(); });
        const newValue = field.quickAdd.onAdd(values);
        if (!newValue) return; // onAdd already alerted the validation problem

        const opts = field.optionsFrom ? field.optionsFrom() : (field.options || []);
        const select = document.getElementById(`mt-${key}`);
        select.innerHTML = (field.includeBlank ? '<option value="">(None - optional)</option>' : "") +
            opts.map(o => `<option value="${amsEsc(o)}">${amsEsc(o)}</option>`).join("");
        select.value = newValue;

        field.quickAdd.fields.forEach(qf => { document.getElementById(`mtQa-${key}-${qf.key}`).value = ""; });
        amsMtCloseAllQuickAdd();
        return;
    }

    if (!e.target.closest(".quickadd-popover")) amsMtCloseAllQuickAdd();
});

/* ---- PAGE INIT ----------------------------------------------------------------
   Config is often assigned in another DOMContentLoaded listener (inline page
   script). Run after those so AMS_MASTER_CONFIG is in place. */
function amsInitMasterTable() {
    const cfg = window.AMS_MASTER_CONFIG;
    if (!cfg || AMS_MT_STATE.booted) return;
    AMS_MT_STATE.booted = true;
    document.getElementById("pageTitle").textContent = cfg.pageTitle;
    document.getElementById("pageSub").textContent = cfg.pageSub;
    document.getElementById("btnAddMaster").textContent = `+ Add ${cfg.pageTitle.replace(" Master", "")}`;

    amsSortRegisterRenderer("masterTable", amsRenderMasterTable);
    amsRenderMasterTable();
    document.getElementById("searchBox").addEventListener("input", amsRenderMasterTable);
    document.getElementById("btnAddMaster").addEventListener("click", amsMtOpenAdd);

    document.getElementById("btnExport").addEventListener("click", amsExportMaster);
    document.getElementById("btnTemplate").addEventListener("click", amsDownloadTemplate);
    document.getElementById("btnImport").addEventListener("click", () => document.getElementById("importFileInput").click());
    document.getElementById("importFileInput").addEventListener("change", (e) => {
        if (e.target.files[0]) amsHandleImportFile(e.target.files[0]);
    });
}

document.addEventListener("DOMContentLoaded", () => setTimeout(amsInitMasterTable, 0));

/*------------------------------------------------------------------------------
#-------------- End of the code : MASTER TABLE ENGINE --------------------------
#------------------------------------------------------------------------------*/
