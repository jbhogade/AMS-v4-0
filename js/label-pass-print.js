/*==============================================================================
#-------------- Start Code for : LABEL/PASS PRINT MASTER (label-pass-print.js) --
#
#  PURPOSE   : Display ID Number picker (Asset Master by type + Mobiles) and
#              Gate Pass picker (laptops only). Per-section checkboxes, copies,
#              hover details, and Excel download. Print size/text come later.
#------------------------------------------------------------------------------*/

const LPP_TYPE_ORDER = ["Laptop", "Desktop", "Printer", "Scanner"];

function lppEsc(str) {
    return typeof amsEsc === "function" ? amsEsc(str) : String(str == null ? "" : str);
}

function lppNotify(message, type) {
    if (typeof amsToast === "function") amsToast(message, type);
    else if (typeof amsNotify === "function") amsNotify(message, type);
    else alert(message);
}

function lppDisplayId(item) {
    if (!item) return "";
    if (item.isLegacyId) {
        return (typeof amsBaseDisplayId === "function")
            ? (amsBaseDisplayId(item) || "")
            : (item.displayId || item.id || "");
    }
    if (typeof amsComputeFullId === "function") return amsComputeFullId(item) || "";
    return item.id || item.displayId || "";
}

function lppItemKey(item, kind) {
    return kind + ":" + (item.amsAssetId || item.displayId || item.id || "");
}

function lppAssignedEmp(item) {
    if (!item || !item.assignedTo) return null;
    return typeof amsGetEmployeeByAmsId === "function" ? amsGetEmployeeByAmsId(item.assignedTo) : null;
}

function lppAssignedName(item) {
    const emp = lppAssignedEmp(item);
    if (emp && emp.name) return emp.name;
    if (item && item.assignedTo) return String(item.assignedTo);
    return "Unassigned";
}

function lppEmpCode(item) {
    const emp = lppAssignedEmp(item);
    if (!emp) return "";
    if (typeof amsGetEmployeeDisplayId === "function") return amsGetEmployeeDisplayId(emp) || "";
    return emp.empIdCompany || emp.empId || "";
}

function lppSerial(item) {
    return (item && item.serialNumber) ? String(item.serialNumber) : "";
}

function lppCompanyAddress() {
    const c = typeof amsGetCompanyDetails === "function" ? amsGetCompanyDetails() : null;
    return (c && c.address) ? String(c.address).trim() : "";
}

function lppModel(item) {
    return [item.make, item.model].filter(Boolean).join(" ").trim() || "-";
}

function lppName(item) {
    return (item && item.name) ? item.name : "-";
}

function lppTip(item) {
    return "Assigned to: " + lppAssignedName(item)
        + "\nName: " + lppName(item)
        + "\nModel: " + lppModel(item);
}

function lppAssets() {
    return (typeof DUMMY_ASSETS !== "undefined" && Array.isArray(DUMMY_ASSETS)) ? DUMMY_ASSETS : [];
}

function lppMobiles() {
    return (typeof DUMMY_MOBILES !== "undefined" && Array.isArray(DUMMY_MOBILES)) ? DUMMY_MOBILES : [];
}

function lppTypeOrder(types) {
    const found = [];
    LPP_TYPE_ORDER.forEach(pref => {
        const match = types.find(t => String(t).toLowerCase() === pref.toLowerCase());
        if (match) found.push(match);
    });
    types.filter(t => !found.some(f => f.toLowerCase() === String(t).toLowerCase()))
        .sort((a, b) => String(a).localeCompare(String(b)))
        .forEach(t => found.push(t));
    return found;
}

function lppIsLaptop(item) {
    return String(item && item.type || "").toLowerCase() === "laptop";
}

function lppMatchesSearch(item, q) {
    if (!q) return true;
    const hay = [
        lppDisplayId(item),
        item.type, item.category, item.name, item.make, item.model, item.status,
        lppAssignedName(item)
    ].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
}

function lppSectionsForDisplayId(query) {
    const assets = lppAssets().filter(a => lppMatchesSearch(a, query));
    const byType = {};
    assets.forEach(a => {
        const type = a.type || "Other";
        if (!byType[type]) byType[type] = [];
        byType[type].push(a);
    });
    const sections = lppTypeOrder(Object.keys(byType)).map(type => ({
        id: "asset:" + type,
        title: type,
        kind: "asset",
        items: byType[type].slice().sort((a, b) => lppDisplayId(a).localeCompare(lppDisplayId(b)))
    }));
    const mobiles = lppMobiles().filter(m => lppMatchesSearch(m, query))
        .slice()
        .sort((a, b) => lppDisplayId(a).localeCompare(lppDisplayId(b)));
    sections.push({ id: "mobile:Mobiles", title: "Mobiles", kind: "mobile", items: mobiles });
    return sections;
}

function lppSectionsForGatePass(query) {
    const items = lppAssets()
        .filter(lppIsLaptop)
        .filter(a => lppMatchesSearch(a, query))
        .slice()
        .sort((a, b) => lppDisplayId(a).localeCompare(lppDisplayId(b)));
    return [{ id: "asset:Laptop", title: "Laptop", kind: "asset", items: items }];
}

function lppCopiesValue(input) {
    const n = parseInt(input && input.value, 10);
    if (!n || n < 1) return 1;
    return Math.min(99, n);
}

function lppRenderSection(tab, section) {
    const sid = lppEsc(section.id);
    if (!section.items.length) {
        return `<section class="lpp-section" data-lpp-section="${sid}" data-lpp-tab="${lppEsc(tab)}">
            <div class="lpp-section-head">
                <div class="lpp-section-title">${lppEsc(section.title)}
                    <span class="lpp-section-meta">0</span>
                </div>
            </div>
            <div class="lpp-empty">No Display IDs in this section.</div>
        </section>`;
    }
    const tiles = section.items.map(item => {
        const key = lppEsc(lppItemKey(item, section.kind));
        const id = lppEsc(lppDisplayId(item));
        const assigned = lppEsc(lppAssignedName(item));
        const name = lppEsc(lppName(item));
        const model = lppEsc(lppModel(item));
        const serial = lppEsc(lppSerial(item));
        const empCode = lppEsc(lppEmpCode(item));
        const tip = lppEsc(lppTip(item));
        return `<label class="lpp-tile" title="${tip}">
            <input type="checkbox" class="lpp-tile-check" data-lpp-item="${key}"
                data-lpp-id="${id}"
                data-lpp-kind="${lppEsc(section.kind === "mobile" ? "Mobile" : "Asset")}"
                data-lpp-section-title="${lppEsc(section.title)}"
                data-lpp-assigned="${assigned}"
                data-lpp-emp-code="${empCode}"
                data-lpp-serial="${serial}"
                data-lpp-name="${name}"
                data-lpp-model="${model}">
            <span class="lpp-tile-id">${id}</span>
            <span class="lpp-tile-name">${name}</span>
            <span class="lpp-tile-model">${model}</span>
            <span class="lpp-tile-assigned">${assigned}</span>
        </label>`;
    }).join("");
    return `<section class="lpp-section" data-lpp-section="${sid}" data-lpp-kind="${lppEsc(section.kind)}" data-lpp-title="${lppEsc(section.title)}" data-lpp-tab="${lppEsc(tab)}">
        <div class="lpp-section-head">
            <label class="form-checkbox lpp-section-title">
                <input type="checkbox" data-lpp-select-all="${sid}">
                ${lppEsc(section.title)}
                <span class="lpp-section-meta">${section.items.length}</span>
            </label>
            <label class="lpp-copies">Copies
                <input type="number" min="1" max="99" value="1" data-lpp-copies="${sid}">
            </label>
        </div>
        <div class="lpp-tile-grid">${tiles}</div>
    </section>`;
}

function lppMount(tab) {
    const mount = document.getElementById(tab === "gatePass" ? "lppGatePassMount" : "lppDisplayIdMount");
    const searchEl = document.getElementById(tab === "gatePass" ? "lppGatePassSearch" : "lppDisplayIdSearch");
    if (!mount) return;
    const query = ((searchEl && searchEl.value) || "").trim().toLowerCase();
    const sections = tab === "gatePass" ? lppSectionsForGatePass(query) : lppSectionsForDisplayId(query);
    const hasAny = sections.some(s => s.items.length);
    if (!hasAny) {
        mount.innerHTML = `<div class="card"><p class="lpp-empty" style="margin:0;padding:0;">No Display IDs match.</p></div>`;
        lppUpdateCount(tab);
        return;
    }
    mount.innerHTML = sections.map(s => lppRenderSection(tab, s)).join("");
    lppUpdateCount(tab);
}

function lppSelectedRows(tab) {
    const root = document.getElementById(tab === "gatePass" ? "panel-gatePass" : "panel-displayId");
    if (!root) return [];
    const rows = [];
    root.querySelectorAll("[data-lpp-section]").forEach(section => {
        const copies = lppCopiesValue(section.querySelector("[data-lpp-copies]"));
        section.querySelectorAll("[data-lpp-item]:checked").forEach(cb => {
            rows.push({
                displayId: cb.getAttribute("data-lpp-id") || "",
                kind: cb.getAttribute("data-lpp-kind") || "",
                section: cb.getAttribute("data-lpp-section-title") || "",
                assignedTo: cb.getAttribute("data-lpp-assigned") || "",
                empCode: cb.getAttribute("data-lpp-emp-code") || "",
                serial: cb.getAttribute("data-lpp-serial") || "",
                name: cb.getAttribute("data-lpp-name") || "",
                model: cb.getAttribute("data-lpp-model") || "",
                copies: copies
            });
        });
    });
    return rows;
}

function lppUpdateCount(tab) {
    const el = document.getElementById(tab === "gatePass" ? "lppGatePassCount" : "lppDisplayIdCount");
    if (!el) return;
    const n = lppSelectedRows(tab).length;
    el.textContent = n ? (n + " selected") : "None selected";
}

function lppMarkTile(cb) {
    const tile = cb.closest(".lpp-tile");
    if (tile) tile.classList.toggle("is-selected", cb.checked);
}

function lppSyncSelectAll(section) {
    const boxes = [...section.querySelectorAll("[data-lpp-item]")];
    const all = section.querySelector("[data-lpp-select-all]");
    boxes.forEach(lppMarkTile);
    if (!all || !boxes.length) return;
    const checked = boxes.filter(b => b.checked).length;
    all.checked = checked === boxes.length;
    all.indeterminate = checked > 0 && checked < boxes.length;
}

function lppPrintItems(rows) {
    const items = [];
    rows.forEach(r => {
        const copies = Math.max(1, parseInt(r.copies, 10) || 1);
        for (let i = 0; i < copies; i++) items.push(r);
    });
    return items;
}

function lppPrint(tab) {
    const rows = lppSelectedRows(tab);
    if (!rows.length) {
        lppNotify("Select at least one Display ID.", "warning");
        return;
    }
    const isGate = tab === "gatePass";
    const title = isGate ? "Gate Pass" : "Display ID Labels";
    const items = lppPrintItems(rows);
    const address = lppCompanyAddress();
    const win = window.open("", "_blank");
    if (!win) {
        lppNotify("Popup blocked. Allow popups to print.", "warning");
        return;
    }
    if (isGate) {
        const cards = items.map(r => {
            const serial = r.serial || "-";
            const empName = r.assignedTo || "Unassigned";
            const empCode = r.empCode || "-";
            return `<div class="lpp-print-pass">
                <div class="lpp-print-pass-title">Laptop Gate Pass</div>
                <p class="lpp-print-pass-body">The Laptop Serial No. ${lppEsc(serial)}, Asset Code No. ${lppEsc(r.displayId)} is issued to</p>
                <p class="lpp-print-pass-body"><strong>${lppEsc(empName)}</strong> (Employee ID ${lppEsc(empCode)})</p>
                <p class="lpp-print-pass-body">${lppEsc(address || "-")}</p>
                <div class="lpp-print-sign">Stamp &amp; Signature</div>
            </div>`;
        }).join("");
        win.document.write(`<!DOCTYPE html><html><head><title>${lppEsc(title)}</title>
            <style>
                @page { margin: 8mm; }
                body { font-family: "Segoe UI", Arial, sans-serif; color: #111; }
                .lpp-print-sheet { display: flex; flex-wrap: wrap; gap: 10px; }
                .lpp-print-pass {
                    border: 2px solid #111;
                    box-sizing: border-box;
                    padding: 10px 14px 12px;
                    width: 520px;
                    font-size: 13px;
                    line-height: 1.35;
                }
                .lpp-print-pass-title {
                    font-size: 16px;
                    font-weight: 800;
                    text-align: center;
                    margin: 0 0 6px;
                }
                .lpp-print-pass-body { margin: 0; }
                .lpp-print-sign {
                    margin-top: 18px;
                    font-weight: 700;
                    text-align: right;
                }
            </style></head><body>
            <div class="lpp-print-sheet">${cards}</div>
            </body></html>`);
    } else {
        const perPage = 7 * 16;
        const pages = [];
        for (let i = 0; i < items.length; i += perPage) {
            const slice = items.slice(i, i + perPage);
            while (slice.length < perPage) slice.push(null);
            const cells = slice.map(r => r
                ? `<div class="lpp-print-label"><div class="lpp-print-id">${lppEsc(r.displayId)}</div></div>`
                : `<div class="lpp-print-label lpp-print-label-empty"></div>`).join("");
            pages.push(`<div class="lpp-print-sheet">${cells}</div>`);
        }
        win.document.write(`<!DOCTYPE html><html><head><title>${lppEsc(title)}</title>
            <style>
                @page { size: A4 portrait; margin: 0; }
                html, body {
                    margin: 0;
                    padding: 0;
                    width: 210mm;
                    background: #fff;
                    color: #111;
                    font-family: "Segoe UI", Arial, sans-serif;
                }
                .lpp-print-sheet {
                    box-sizing: border-box;
                    width: 210mm;
                    height: 297mm;
                    padding: 7mm 4mm 7mm 6mm;
                    display: grid;
                    grid-template-columns: repeat(7, 26mm);
                    grid-template-rows: repeat(16, 17.6875mm);
                    column-gap: 3mm;
                    row-gap: 0;
                    page-break-after: always;
                }
                .lpp-print-sheet:last-child { page-break-after: auto; }
                .lpp-print-label {
                    box-sizing: border-box;
                    width: 26mm;
                    height: 17.6875mm;
                    border: 0.3mm solid #111;
                    border-radius: 2mm;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    padding: 0.7mm 0.8mm;
                }
                .lpp-print-label-empty {
                    border-color: transparent;
                }
                .lpp-print-id {
                    font-family: Consolas, Menlo, "Courier New", monospace;
                    font-size: 4.8mm;
                    font-weight: 700;
                    line-height: 1.12;
                    text-align: center;
                    white-space: normal;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    max-width: 100%;
                    max-height: 100%;
                }
            </style></head><body>
            ${pages.join("")}
            </body></html>`);
    }
    win.document.close();
    win.focus();
    win.print();
}

function lppDownload(tab) {
    const rows = lppSelectedRows(tab);
    if (!rows.length) {
        lppNotify("Select at least one Display ID.", "warning");
        return;
    }
    if (typeof amsExportXlsx !== "function") {
        lppNotify("Excel download is not available.", "warning");
        return;
    }
    const headers = ["Display ID", "Kind", "Section", "Assigned To", "Name", "Model", "Copies"];
    const data = rows.map(r => [r.displayId, r.kind, r.section, r.assignedTo, r.name, r.model, r.copies]);
    const stamp = new Date().toISOString().slice(0, 10);
    const file = tab === "gatePass" ? ("Gate_Pass_Display_IDs_" + stamp) : ("Display_ID_Labels_" + stamp);
    amsExportXlsx(file, headers, data);
    lppNotify("Download started (" + rows.length + ").", "success");
}

function lppOnPanelClick(e) {
    const panel = e.currentTarget;
    const tab = panel.id === "panel-gatePass" ? "gatePass" : "displayId";
    const selectAll = e.target.closest("[data-lpp-select-all]");
    if (selectAll) {
        const section = selectAll.closest("[data-lpp-section]");
        section.querySelectorAll("[data-lpp-item]").forEach(cb => {
            cb.checked = selectAll.checked;
            lppMarkTile(cb);
        });
        lppUpdateCount(tab);
        return;
    }
    if (e.target.matches("[data-lpp-item]")) {
        lppSyncSelectAll(e.target.closest("[data-lpp-section]"));
        lppUpdateCount(tab);
    }
}

function amsWireLabelPassTabs() {
    document.querySelectorAll("[data-lpp-tab]").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll("[data-lpp-tab]").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".report-panel").forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            const panel = document.getElementById("panel-" + tab.getAttribute("data-lpp-tab"));
            if (panel) panel.classList.add("active");
        });
    });
}

async function initLabelPassPrint() {
    initLayout("label-pass-print");
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();
    if (typeof amsYieldToBrowser === "function") await amsYieldToBrowser();
    amsWireLabelPassTabs();
    lppMount("displayId");
    lppMount("gatePass");

    const displaySearch = document.getElementById("lppDisplayIdSearch");
    const gateSearch = document.getElementById("lppGatePassSearch");
    if (displaySearch) displaySearch.addEventListener("input", () => lppMount("displayId"));
    if (gateSearch) gateSearch.addEventListener("input", () => lppMount("gatePass"));

    document.getElementById("panel-displayId").addEventListener("click", lppOnPanelClick);
    document.getElementById("panel-gatePass").addEventListener("click", lppOnPanelClick);
    document.getElementById("btnLppDisplayPrint").addEventListener("click", () => lppPrint("displayId"));
    document.getElementById("btnLppGatePassPrint").addEventListener("click", () => lppPrint("gatePass"));
    document.getElementById("btnLppDisplayDownload").addEventListener("click", () => lppDownload("displayId"));
    document.getElementById("btnLppGatePassDownload").addEventListener("click", () => lppDownload("gatePass"));
}

document.addEventListener("DOMContentLoaded", initLabelPassPrint);
/*-------------- End of the code ----------------------------------------------*/
/*==============================================================================
#-------------- End of the code : LABEL/PASS PRINT MASTER -----------------------
#------------------------------------------------------------------------------*/
