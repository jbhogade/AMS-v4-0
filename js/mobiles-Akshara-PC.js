/*==============================================================================
#-------------- Start Code for : MOBILE MASTER PAGE LOGIC (mobiles.js) ---------
#
#  PURPOSE   : All logic for Mobile Master - same lifecycle as Asset Master
#              (table, Smart IDs, Add/Edit, Assign/Asset Edit/Return, Transfer,
#              Not Working, Retire / Scrap, Replace, Asset ID Record, Import /
#              Export / Template) against the separate `mobiles` collection.
#
#  PORT NOTE : Cloned from js/assets.js. AST_STATE.assets points at DUMMY_MOBILES
#              so this page never mixes records with Asset Master.
#------------------------------------------------------------------------------*/

/* =============================================================================
   1) IN-MEMORY STATE
   ===========================================================================*/
const AST_STATE = {
    assets: DUMMY_MOBILES, /* live reference - DUMMY_MOBILES is the DB-backed collection cache */
    editingId: null,      /* asset.id currently being edited/acted on (Add modal = null) */
    assignMode: null,     /* "assign" | "edit" - which action opened modalAssign */
    formCounters: {},     /* per-form sequence counters for generated form numbers */
    viewKey: null,        /* asset.id whose details are open in modalView */
    historyKey: null,     /* asset.id whose ID record is open in modalHistory */
    replAwaitingAdd: false, /* true while the Add Asset modal is open from the Replace modal */
    replOldKey: null,       /* asset.id of the asset being replaced while adding from Replace */
    replNewKey: null,       /* asset.id of the asset just added from the Replace modal */
};

/* Asset list renders EVERY matching row at once (like the Employees master) -
   no pagination, no inner scroll frame. The page itself scrolls and the
   footer shows the record count ("Showing X of Y assets"). */

/* Employee view-model (shared with dummy-data.js) - read-only list, resolved by
   AMS ID so asset records link to employees consistently across the portal. */
function AMS_STATE_EMPLOYEES_REF() { return amsGetEmployeesForPortal(); }

/* =============================================================================
   2) ID GENERATORS (new assets only - the shared base/full-ID helpers live in
   dummy-data.js so Reports / Employee Master can reuse them too)
   ===========================================================================*/
function amsGenerateAmsAssetId(typeShort) {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const ts = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${String(now.getFullYear()).slice(2)}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const seq = AST_STATE.assets.filter(a => a.type && amsTypeShort(a.type) === typeShort).length + 1;
    return `AMS-${typeShort}-${ts}-${String(seq).padStart(6, "0")}`;
}

function amsGenerateDisplayId(typeShort) {
    /* max+1 (not count+1): after assets are deleted/retired a count-based
       sequence would reuse an existing ID and collide on the server's natural
       key (record_key), turning every later save into a 500. */
    let maxSeq = 0;
    AST_STATE.assets.forEach(a => {
        if (!a || !a.type || amsTypeShort(a.type) !== typeShort) return;
        const id = String(a.displayId || a.id || "");
        if (id.slice(0, typeShort.length) !== typeShort) return;
        const suffix = id.slice(typeShort.length);
        if (/^\d+$/.test(suffix)) maxSeq = Math.max(maxSeq, parseInt(suffix, 10));
    });
    return `${typeShort}${String(maxSeq + 1).padStart(5, "0")}`;
}

/* =============================================================================
   3) RENDER: ASSET TABLE
   ===========================================================================*/
const AST_STATUS_BADGE = {
    "In Store": "badge-blue", "Assigned": "badge-green", "In Repair": "badge-amber",
    "Transfer": "badge-blue", "Not Working": "badge-red", "Retired / Scrapped": "badge-red", "Replaced": "badge-grey",
};

function renderAssetTable() {
    const searchTerm = (document.getElementById("searchBox").value || "").toLowerCase();
    const statusFilterVal = document.getElementById("statusFilter").value;
    const showAmsId = document.getElementById("superRootToggle").checked;

    const filtered = AST_STATE.assets
        .filter(a => {
            if (statusFilterVal && a.status !== statusFilterVal) return false;
            if (!searchTerm) return true;
            return [a.id, a.type, a.make, a.model, a.serialNumber].some(v => String(v || "").toLowerCase().includes(searchTerm));
        });

    const getters = {
        amsAssetId: a => a.amsAssetId || "",
        id: a => amsComputeFullId(a),
        type: a => a.type,
        make: a => `${a.make} ${a.model || ""}`,
        site: a => a.currentSite || a.site,
        status: a => a.status,
        assigned: a => {
            const e = a.assignedTo ? amsGetEmployeeByAmsId(a.assignedTo) : null;
            return e ? e.name : (a.assignedSubText || "");
        },
        warranty: a => a.warrantyEnd || "",
    };
    const sortedFiltered = amsSortRows("assetTable", filtered, getters);

    const rows = sortedFiltered
        .map(a => {
            const fullId = amsComputeFullId(a);
            if (a.id !== fullId) a.id = fullId; /* keep the canonical id in sync with what's displayed - a stale seed id (e.g. from a department shortform that's since changed) would otherwise show one ID in the table but respond to handlers under a different one */
            const directEmp = a.assignedTo ? amsGetEmployeeByAmsId(a.assignedTo) : null;
            const subEmp = a.assignedToSubordinate ? amsGetEmployeeByAmsId(a.assignedToSubordinate) : null;
            const holderName = a.assignedToSubordinate ? (subEmp ? subEmp.name : a.assignedToSubordinate)
                : (a.assignedSubText ? a.assignedSubText : "");
            const assignedDisplay = directEmp
                ? `${amsEsc(directEmp.name)}${holderName ? ` &rarr; ${amsEsc(holderName)}` : ""}`
                : "-";
            const isTransferred = (a.currentSite || a.site) !== a.purchaseSite;

            return `<tr>
                ${showAmsId ? `<td class="mono-cell">${amsEsc(a.amsAssetId)}</td>` : ""}
                <td class="mono-cell"><a href="#" class="clickable-id" data-view-key="${amsEsc(a.id)}">${amsEsc(fullId)}</a></td>
                <td>${amsEsc(a.type)}</td>
                <td>${amsEsc(a.make)}${a.model ? ` (${amsEsc(a.model)})` : ""}</td>
                <td>${amsEsc(a.currentSite || a.site)}${isTransferred ? ` <span class="badge badge-transfer">Transferred</span>` : ""}</td>
                <td><span class="badge ${AST_STATUS_BADGE[a.status] || "badge-grey"}">${amsEsc(a.status)}</span></td>
                <td>${assignedDisplay}</td>
                <td class="mono-cell">${amsFormatDate(a.warrantyEnd) || "-"}</td>
                <td class="actions-cell">
                    <button class="actions-trigger" data-actions-for="${amsEsc(a.id)}" title="Actions">Actions &#9662;</button>
                    <div class="actions-menu" id="menu-${amsEsc(a.id)}">
                        <button data-action="view" data-key="${amsEsc(a.id)}">View</button>
                        <button data-action="edit" data-key="${amsEsc(a.id)}">Edit</button>
                        <div class="menu-divider"></div>
                        <button data-action="assign" data-key="${amsEsc(a.id)}" ${(a.assignedTo || a.status === "Retired / Scrapped" || a.status === "Not Working") ? "disabled" : ""}>Assign</button>
                        <button data-action="editAssign" data-key="${amsEsc(a.id)}" ${(!a.assignedTo || a.status === "Retired / Scrapped" || a.status === "Not Working") ? "disabled" : ""}>Asset Edit</button>
                        <button data-action="return" data-key="${amsEsc(a.id)}" ${(!a.assignedTo || a.status === "Retired / Scrapped" || a.status === "Not Working") ? "disabled" : ""}>Return</button>
                        <button data-action="transfer" data-key="${amsEsc(a.id)}" ${(a.status === "Retired / Scrapped" || a.status === "Not Working") ? "disabled" : ""}>Transfer</button>
                        <div class="menu-divider"></div>
                        <button data-action="notworking" data-key="${amsEsc(a.id)}" ${a.status === "Retired / Scrapped" ? "disabled" : ""}>Not Working</button>
                        <button data-action="replace" data-key="${amsEsc(a.id)}" ${["Retired / Scrapped", "Replaced", "Not Working"].includes(a.status) ? "disabled" : ""}>Replace</button>
                        <button class="danger-item" data-action="retire" data-key="${amsEsc(a.id)}" ${a.status === "Retired / Scrapped" ? "disabled" : ""}>Retire / Scrap</button>
                        <div class="menu-divider"></div>
                        <button data-action="printIssue" data-key="${amsEsc(a.id)}" ${a.status !== "Assigned" ? "disabled" : ""} title="${a.status !== "Assigned" ? "Only available for currently Assigned assets" : "Print this employee's Asset Issue Form"}">Asset Issue Form</button>
                        <button data-action="history" data-key="${amsEsc(a.id)}">Asset ID Record</button>
                    </div>
                </td>
            </tr>`;
        });

    const headExtra = showAmsId ? amsSortableTh("assetTable", "amsAssetId", "AMS Asset ID") : "";
    const totalMatches = filtered.length;
    document.getElementById("assetTable").innerHTML = `
        <thead><tr>
            ${headExtra}
            ${amsSortableTh("assetTable", "id", "Asset ID")}
            ${amsSortableTh("assetTable", "type", "Type")}
            ${amsSortableTh("assetTable", "make", "Make / Model")}
            ${amsSortableTh("assetTable", "site", "Current Site")}
            ${amsSortableTh("assetTable", "status", "Status")}
            ${amsSortableTh("assetTable", "assigned", "Assigned To")}
            ${amsSortableTh("assetTable", "warranty", "Warranty End")}
            <th></th>
        </tr></thead>
        <tbody>${rows.join("") || `<tr><td colspan="9" class="empty-note" style="text-align:center;padding:28px;">No assets found</td></tr>`}</tbody>`;

    const footer = document.getElementById("assetTableFooter");
    if (footer) {
        footer.innerHTML = totalMatches > 0
            ? `<span>Showing ${totalMatches} of ${totalMatches} assets</span>`
            : "";
    }

    renderAssetStockSummary();
}

/* =============================================================================
   4) STOCK SUMMARY (Total Stock / In Stock / Used - always reflects the FULL
   asset list, ignoring the table's own search/status filter. Lives on Asset
   Master itself, not Dashboard.)
   ===========================================================================*/
/* "In Stock" = unassigned and not Retired/Scrapped or Not Working - the same
   eligibility rule the Assign picker uses elsewhere. In practice that's In Store,
   Replaced-back-to-stock, and any in-transit Transfer asset. */
function amsIsInStockAsset(a) {
    return !a.assignedTo && a.status !== "Retired / Scrapped" && a.status !== "Not Working";
}

function renderAssetStockSummary() {
    const assets = AST_STATE.assets;
    const total = assets.length;
    const isWrittenOff = (a) => a.status === "Retired / Scrapped" || a.status === "Not Working";
    const inStock = assets.filter(amsIsInStockAsset).length;
    const writtenOff = assets.filter(isWrittenOff).length;
    const used = total - inStock - writtenOff; /* Assigned + In Repair - whoever currently holds it */

    const tiles = [
        { label: "Total Stock (Assets)", value: total, cls: "" },
        { label: "In Stock", value: inStock, cls: "accent-success" },
        { label: "Used / In Use", value: used, cls: "accent-warning" },
        { label: "Retired/Scrapped + Not Working", value: writtenOff, cls: writtenOff > 0 ? "accent-danger" : "" },
    ];
    document.getElementById("assetStockSummary").innerHTML = tiles.map(t => `
        <div class="stat-card ${t.cls}">
            <div class="stat-value">${t.value}</div>
            <div class="stat-label">${t.label}</div>
        </div>`).join("");

    const types = [...new Set(assets.map(a => a.type))].sort();
    const pct = (n, total) => total ? Math.max(0, Math.round(n / total * 100)) : 0;
    const typeRows = types.map(type => {
        const items = assets.filter(a => a.type === type);
        const t = items.length;
        const inS = items.filter(amsIsInStockAsset).length;
        const w = items.filter(isWrittenOff).length;
        const u = t - inS - w;
        const bar = `<div class="stock-bar">` +
            `<div class="stock-bar-seg seg-in" style="width:${pct(inS, t)}%" title="In Stock: ${inS}"></div>` +
            `<div class="stock-bar-seg seg-used" style="width:${pct(u, t)}%" title="Used / In Use: ${u}"></div>` +
            `<div class="stock-bar-seg seg-off" style="width:${pct(w, t)}%" title="Retired / Not Working: ${w}"></div>` +
            `</div>`;
        return `<tr><td><strong>${amsEsc(type)}</strong></td><td class="stock-chart-cell">${bar}</td>` +
            `<td class="num">${t}</td><td class="num">${inS}</td><td class="num">${u}</td><td class="num">${w}</td></tr>`;
    }).join("");
    document.getElementById("assetStockByTypeTable").innerHTML = `
        <thead><tr>
            <th>Asset Type</th><th>Stock split (bar = share of total)</th>
            <th>Total</th><th><span class="legend-dot in"></span>In Stock</th>
            <th><span class="legend-dot used"></span>Used</th><th><span class="legend-dot off"></span>Retired / Not Working</th>
        </tr></thead>
        <tbody>${typeRows || `<tr><td colspan="6" class="empty-note" style="text-align:center;padding:14px;">No assets yet</td></tr>`}</tbody>`;
}

/* =============================================================================
   5) ACTIONS DROPDOWN OPEN/CLOSE + ROW ACTION DELEGATION
   ===========================================================================*/
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

function amsCloseAllMenus() {
    amsCloseRowMenus();
}

function amsCloseAllQuickAdd() {
    document.querySelectorAll(".quickadd-popover.open").forEach(p => p.classList.remove("open"));
}

function amsWireRowActions() {
    document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-actions-for]");
        if (trigger) {
            const key = trigger.getAttribute("data-actions-for");
            const menu = document.getElementById(`menu-${key}`);
            const wasOpen = menu.classList.contains("open");
            amsCloseAllMenus();
            if (!wasOpen) {
                amsOpenRowMenu(trigger, menu);
            }
            return;
        }
        if (!e.target.closest(".actions-menu")) amsCloseAllMenus();
    });

    document.addEventListener("click", (e) => {
        const idLink = e.target.closest("[data-view-key]");
        if (idLink) { e.preventDefault(); amsOpenViewModal(idLink.getAttribute("data-view-key")); return; }

        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        const key = btn.getAttribute("data-key");
        amsCloseAllMenus();

        if (action === "view") amsOpenViewModal(key);
        else if (action === "edit") amsOpenEditModal(key);
        else if (action === "assign") amsOpenAssignModal(key, "assign");
        else if (action === "editAssign") amsOpenAssignModal(key, "edit");
        else if (action === "return") amsReturnAsset(key);
        else if (action === "transfer") amsOpenTransferModal(key);
        else if (action === "notworking") amsMarkNotWorking(key);
        else if (action === "replace") amsOpenReplaceModal(key);
        else if (action === "retire") amsRetireAsset(key);
        else if (action === "printIssue") amsPrintAssetIssueForm(key);
        else if (action === "history") amsOpenHistoryModal(key);
    });
}

/* =============================================================================
   6) MODAL OPEN / CLOSE HELPERS (v4-0 .modal-overlay pattern)
   ===========================================================================*/
function amsOpenModal(id) { document.getElementById(id).classList.add("open"); }
function amsCloseModal(id) { document.getElementById(id).classList.remove("open"); }

/* =============================================================================
   7) POPULATE FORM DROPDOWNS (Type / Category / Make / Sites / Status)
   ===========================================================================*/
function amsPopulateAssetDropdowns() {
    document.getElementById("fType").innerHTML = AMS_DUMMY_ASSET_TYPES.filter(t => t.active).map(t => `<option value="${amsEsc(t.name)}">${amsEsc(t.name)}</option>`).join("");
    document.getElementById("fCategory").innerHTML = AMS_DUMMY_ASSET_CATEGORIES.filter(c => c.active).map(c => `<option value="${amsEsc(c.name)}">${amsEsc(c.name)}</option>`).join("");
    document.getElementById("fMake").innerHTML = AMS_DUMMY_ASSET_MAKES.filter(m => m.active).map(m => `<option value="${amsEsc(m.name)}">${amsEsc(m.name)}</option>`).join("");
    const siteOptions = AMS_DUMMY_SITES.filter(s => s.active).map(s => `<option value="${amsEsc(s.name)}">${amsEsc(s.name)}</option>`).join("");
    document.getElementById("fPurchaseSite").innerHTML = siteOptions;
    document.getElementById("fCurrentSite").innerHTML = siteOptions;
    document.getElementById("fStatus").innerHTML = AMS_ASSET_STATUS_OPTIONS.map(s => `<option value="${amsEsc(s)}">${amsEsc(s)}</option>`).join("");
}

/* =============================================================================
   8) AMS ASSET ID PREVIEW (live, in the Add/Edit form)
   ===========================================================================*/
function amsUpdateAssetIdPreview() {
    const typeShort = amsTypeShort(document.getElementById("fType").value);
    const preview = AST_STATE.editingId
        ? AST_STATE.assets.find(a => a.id === AST_STATE.editingId).amsAssetId
        : amsGenerateAmsAssetId(typeShort);
    document.getElementById("amsAssetIdPreview").textContent = preview;
}

/* =============================================================================
   9) QUICK-ADD (+) POPOVERS: Type / Category / Make / Purchase Site / Current Site
      + the Replace modal's own Make / Purchase Site / Current Site versions
   ===========================================================================*/
const AMS_QA_POPOVER_ID = {
    type: "qaPopoverType", category: "qaPopoverCategory", make: "qaPopoverMake", purchaseSite: "qaPopoverPurchaseSite", currentSite: "qaPopoverCurrentSite",
};

function amsWireQuickAddPopovers() {
    document.querySelectorAll("[data-quickadd]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const popover = document.getElementById(AMS_QA_POPOVER_ID[btn.getAttribute("data-quickadd")]);
            if (!popover) return;
            const wasOpen = popover.classList.contains("open");
            amsCloseAllQuickAdd();
            if (!wasOpen) popover.classList.add("open");
        });
    });
    document.querySelectorAll("[data-qa-cancel]").forEach(btn => btn.addEventListener("click", () => amsCloseAllQuickAdd()));
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".quickadd-popover") && !e.target.closest("[data-quickadd]")) amsCloseAllQuickAdd();
    });

    /* ---- Save: new Asset Type ---- */
    const qaTypeSave = document.querySelector('[data-qa-save="type"]');
    if (qaTypeSave) qaTypeSave.addEventListener("click", () => {
        const name = document.getElementById("qaTypeName").value.trim();
        const shortform = document.getElementById("qaTypeShort").value.trim().toUpperCase();
        if (!name || !shortform) { alert("Enter both Asset Type Name and Shortform."); return; }
        if (AMS_DUMMY_ASSET_TYPES.some(t => t.name.toLowerCase() === name.toLowerCase())) { alert("This Asset Type already exists."); return; }
        AMS_DUMMY_ASSET_TYPES.push({ name, shortform, active: true }); /* same array Asset Type Master manages */
        amsDbSaveAsync("assetTypes");
        amsPopulateAssetDropdowns();
        document.getElementById("fType").value = name;
        amsUpdateAssetIdPreview();
        document.getElementById("qaTypeName").value = ""; document.getElementById("qaTypeShort").value = "";
        amsCloseAllQuickAdd();
    });

    /* ---- Save: new Asset Category ---- */
    const qaCategorySave = document.querySelector('[data-qa-save="category"]');
    if (qaCategorySave) qaCategorySave.addEventListener("click", () => {
        const name = document.getElementById("qaCategoryName").value.trim();
        if (!name) { alert("Enter a Category name."); return; }
        if (AMS_DUMMY_ASSET_CATEGORIES.some(c => c.name.toLowerCase() === name.toLowerCase())) { alert("This Category already exists."); return; }
        AMS_DUMMY_ASSET_CATEGORIES.push({ name, active: true });
        amsDbSaveAsync("assetCategories");
        document.getElementById("fCategory").innerHTML = AMS_DUMMY_ASSET_CATEGORIES.filter(c => c.active).map(c => `<option value="${amsEsc(c.name)}">${amsEsc(c.name)}</option>`).join("");
        document.getElementById("fCategory").value = name;
        document.getElementById("qaCategoryName").value = "";
        amsCloseAllQuickAdd();
    });

    /* ---- Save: new Asset Make ---- */
    const qaMakeSave = document.querySelector('[data-qa-save="make"]');
    if (qaMakeSave) qaMakeSave.addEventListener("click", () => {
        const name = document.getElementById("qaMakeName").value.trim();
        if (!name) { alert("Enter a Make/Brand name."); return; }
        if (AMS_DUMMY_ASSET_MAKES.some(m => m.name.toLowerCase() === name.toLowerCase())) { alert("This Make already exists."); return; }
        AMS_DUMMY_ASSET_MAKES.push({ name, active: true }); /* same array Asset Make Master manages */
        amsDbSaveAsync("assetMakes");
        amsPopulateAssetDropdowns();
        document.getElementById("fMake").value = name;
        document.getElementById("qaMakeName").value = "";
        amsCloseAllQuickAdd();
    });

    /* ---- Save: new Site (shared by Purchase Site AND Current Site dropdowns) ---- */
    function amsQuickAddSite(targetFieldId, nameInputId, shortInputId) {
        const name = document.getElementById(nameInputId).value.trim();
        const shortform = document.getElementById(shortInputId).value.trim().toUpperCase();
        if (!name || !shortform) { alert("Enter both Site Name and Shortform."); return; }
        if (AMS_DUMMY_SITES.some(s => s.name.toLowerCase() === name.toLowerCase())) { alert("This Site already exists."); return; }
        AMS_DUMMY_SITES.push({ name, shortform, address: "", active: true }); /* same array Site Master manages */
        amsDbSaveAsync("sites");
        amsPopulateAssetDropdowns(); /* refreshes BOTH Purchase Site and Current Site dropdowns */
        document.getElementById(targetFieldId).value = name;
        document.getElementById(nameInputId).value = ""; document.getElementById(shortInputId).value = "";
        amsCloseAllQuickAdd();
    }
    const qaPurchaseSave = document.querySelector('[data-qa-save="purchaseSite"]');
    if (qaPurchaseSave) qaPurchaseSave.addEventListener("click", () => amsQuickAddSite("fPurchaseSite", "qaPurchaseSiteName", "qaPurchaseSiteShort"));
    const qaCurrentSave = document.querySelector('[data-qa-save="currentSite"]');
    if (qaCurrentSave) qaCurrentSave.addEventListener("click", () => amsQuickAddSite("fCurrentSite", "qaCurrentSiteName", "qaCurrentSiteShort"));
}

/* =============================================================================
   10) ACCESSORIES CHECKLIST RENDERER + QUICK-ADD (Assign/Asset Edit/Replace)
   ===========================================================================*/
function amsRenderAccessoriesChecklist(containerId, assetType, selected) {
    const options = amsGetAccessoryOptions(assetType);
    const container = document.getElementById(containerId);
    if (!container) return;
    const selectedSet = new Set((selected || []).map(v => String(v)));
    container.innerHTML = options.length
        ? options.map((opt, i) => `<label><input type="checkbox" class="acc-check" value="${amsEsc(opt)}" id="${containerId}-${i}"${selectedSet.has(opt) ? " checked" : ""}> ${amsEsc(opt)}</label>`).join("")
        : `<div class="no-accessories">No common accessories defined for this asset type yet - use the + button above to add one</div>`;
}

function amsGetCheckedAccessories(containerId) {
    return [...document.querySelectorAll(`#${containerId} .acc-check:checked`)].map(c => c.value);
}

/* Wires the "+" quick-add button next to an accessories checklist so a missing
   accessory can be added straight into the shared Accessory Master without
   leaving this modal - the new option shows up (pre-checked) immediately. */
function amsWireAccessoryQuickAdd(containerId, getAssetType) {
    const btn = document.querySelector(`[data-acc-quickadd="${containerId}"]`);
    const popover = document.getElementById(`accQaPopover-${containerId}`);
    const input = document.getElementById(`accQaInput-${containerId}`);
    if (!btn || !popover || !input) return;
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = popover.classList.toggle("open");
        if (isOpen) { input.value = ""; input.focus(); }
    });
    const cancelBtn = document.querySelector(`[data-acc-qa-cancel="${containerId}"]`);
    if (cancelBtn) cancelBtn.addEventListener("click", () => popover.classList.remove("open"));
    const saveBtn = document.querySelector(`[data-acc-qa-save="${containerId}"]`);
    if (saveBtn) saveBtn.addEventListener("click", () => {
        const assetType = getAssetType();
        if (!assetType) { alert("Select an Asset Type first."); return; }
        const added = amsQuickAddAccessory(input.value, assetType);
        if (!added) { alert("Enter a name - or it may already be in the list for this Asset Type."); return; }
        popover.classList.remove("open");
        amsRenderAccessoriesChecklist(containerId, assetType);
        const newBox = [...document.querySelectorAll(`#${containerId} .acc-check`)].find(c => c.value === added);
        if (newBox) newBox.checked = true; /* auto-check it - that's presumably why it was just added */
    });
}

function amsWireAccessoryAndDeptQuickAdds() {
    amsWireAccessoryQuickAdd("assignAccessories", () => {
        const a = AST_STATE.assets.find(x => x.id === AST_STATE.editingId);
        return a ? a.type : "";
    });
}

/* =============================================================================
   11) QUICK-ADD EMPLOYEE (inline, replaces v3-3's iframe embed - writes through
   the shared addEmployee() helper so the AMS ID is generated in one place)
   ===========================================================================*/
let AST_QUICKADD_EMP_TARGET = null; /* which select ("assignDirectEmp" / "assignSubEmp") to fill once saved */

function amsOpenAddEmployeeModal(targetSelectId) {
    AST_QUICKADD_EMP_TARGET = targetSelectId;
    /* Fill the department + designation pickers (union of hardcoded seeds + the
       DB-backed masters, so lookups added in either place are offered here) */
    const deptUnion = DEPARTMENTS.map(d => ({ name: d.name, short: d.short }));
    AMS_DUMMY_DEPARTMENTS.forEach(d => {
        if (!deptUnion.some(x => x.name.toLowerCase() === d.name.toLowerCase())) deptUnion.push({ name: d.name, short: d.shortform });
    });
    const desigUnion = DESIGNATIONS.slice();
    AMS_DESIGNATION_OPTIONS.forEach(d => {
        if (!desigUnion.some(x => x.toLowerCase() === d.name.toLowerCase())) desigUnion.push(d.name);
    });
    document.getElementById("qaEmpDept").innerHTML = deptUnion.map(d => `<option value="${amsEsc(d.name)}">${amsEsc(d.name)}</option>`).join("");
    document.getElementById("qaEmpDesigList").innerHTML = desigUnion.map(d => `<option value="${amsEsc(d)}"></option>`).join("");
    document.getElementById("qaEmpName").value = "";
    document.getElementById("qaEmpDesig").value = "";
    hideFormError("quickadd-emp-error");
    amsOpenModal("modalQuickAddEmp");
}

function amsSaveQuickAddEmployee() {
    const data = {
        empId: "EMP-000001", /* placeholder - real IDs come from the Employee Master */
        name: document.getElementById("qaEmpName").value.trim().replace(/\s+/g, " "),
        department: document.getElementById("qaEmpDept").value,
        designation: document.getElementById("qaEmpDesig").value.trim(),
    };
    if (!data.name || !data.designation) {
        showFormError("quickadd-emp-error", "Please fill in Full Name and Designation (Department is pre-selected).");
        return;
    }
    const emp = addEmployee(data);

    /* Refresh both employee dropdowns (rebuilding resets whichever dropdown ISN'T
       the current target, so capture both current values and restore them). */
    const directVal = document.getElementById("assignDirectEmp").value;
    const subVal = document.getElementById("assignSubEmp").value;
    amsPopulateEmpDropdowns();
    document.getElementById("assignDirectEmp").value = AST_QUICKADD_EMP_TARGET === "assignDirectEmp" ? emp.amsId : directVal;
    document.getElementById("assignSubEmp").value = AST_QUICKADD_EMP_TARGET === "assignSubEmp" ? emp.amsId : subVal;

    /* If a free-text "Other" subordinate was typed, picking a real employee now
       replaces it - hide the free-text input again. */
    if (AST_QUICKADD_EMP_TARGET === "assignSubEmp") {
        const subTextEl = document.getElementById("assignSubText");
        if (subTextEl) { subTextEl.value = ""; subTextEl.style.display = "none"; }
    }

    amsCloseModal("modalQuickAddEmp");
    amsNotify(`Employee added: ${getEmployeeFullName(emp)} (${emp.amsId})`, "success");
}

/* =============================================================================
   12) ADD / EDIT ASSET MODAL
   ===========================================================================*/
function amsOpenAddModal() {
    AST_STATE.editingId = null;
    document.getElementById("formModalTitle").textContent = "Add Asset";
    document.getElementById("assetForm").reset();
    amsPopulateAssetDropdowns();
    document.getElementById("fAssetId").value = "";
    document.getElementById("fAssetId").placeholder = amsGenerateDisplayId(amsTypeShort(document.getElementById("fType").value)) + " (leave blank to use this)";
    document.getElementById("fStatus").value = "In Store";
    amsUpdateAssetIdPreview();
    amsOpenModal("modalForm");
}

function amsOpenEditModal(key) {
    const a = AST_STATE.assets.find(x => x.id === key);
    if (!a) return;
    AST_STATE.editingId = key;
    document.getElementById("formModalTitle").textContent = "Edit Asset";
    amsPopulateAssetDropdowns();

    document.getElementById("fAssetId").value = amsBaseDisplayId(a);
    document.getElementById("fType").value = a.type;
    document.getElementById("fCategory").value = a.category || "";
    document.getElementById("fMake").value = a.make;
    document.getElementById("fName").value = a.name || "";
    document.getElementById("fModel").value = a.model || "";
    document.getElementById("fPurchaseSite").value = a.purchaseSite;
    document.getElementById("fCurrentSite").value = a.currentSite || a.site;
    document.getElementById("fSerial").value = a.serialNumber || "";
    document.getElementById("fPurchaseDate").value = a.purchaseDate || "";
    document.getElementById("fWarrantyEnd").value = a.warrantyEnd || "";
    amsSetVendorSelectValue("fVendor", a.vendor || "");
    document.getElementById("fCost").value = a.purchaseCost || "";
    document.getElementById("fRemarks").value = a.remarks || "";
    document.getElementById("fStatus").value = a.status;
    amsUpdateAssetIdPreview();
    amsOpenModal("modalForm");
}

function amsSubmitAssetForm(e) {
    e.preventDefault();
    const typeShort = amsTypeShort(document.getElementById("fType").value);
    let displayId = document.getElementById("fAssetId").value.trim();
    const isLegacyId = !!displayId; /* any manually-entered ID is treated as legacy/custom format */
    if (!displayId) displayId = amsGenerateDisplayId(typeShort);

    const values = {
        type: document.getElementById("fType").value,
        category: document.getElementById("fCategory").value,
        make: document.getElementById("fMake").value,
        name: document.getElementById("fName").value.trim(),
        model: document.getElementById("fModel").value.trim(),
        purchaseSite: document.getElementById("fPurchaseSite").value,
        currentSite: document.getElementById("fCurrentSite").value,
        serialNumber: document.getElementById("fSerial").value.trim(),
        purchaseDate: document.getElementById("fPurchaseDate").value,
        warrantyEnd: document.getElementById("fWarrantyEnd").value,
        vendor: document.getElementById("fVendor").value.trim(),
        purchaseCost: document.getElementById("fCost").value.trim(),
        remarks: document.getElementById("fRemarks").value.trim(),
    };
    const statusVal = document.getElementById("fStatus").value;

    if (AST_STATE.editingId) {
        const a = AST_STATE.assets.find(x => x.id === AST_STATE.editingId);
        if (!a) return;
        Object.assign(a, values);
        a.site = values.currentSite; /* keep legacy alias in sync */
        a.status = statusVal;
        if (["Transfer", "Not Working", "Retired / Scrapped", "Replaced"].includes(statusVal)) {
             a.assignedTo = null; a.assignedToSubordinate = null; a.assignedSubText = null; a.assignedDepartment = null; a.assignedDeptText = null; a.usageNote = null; a.dept = "";
        }
        a.id = amsComputeFullId(a); /* site/status/assignment may have changed - recompute display */
        amsNotify(`Asset updated: ${a.id}`, "info");
    } else {
        const asset = {
            amsAssetId: amsGenerateAmsAssetId(typeShort),
            displayId, isLegacyId, id: displayId,
            ...values, site: values.currentSite,
            status: statusVal, dept: "", assignedTo: null, assignedToSubordinate: null,
            history: [{ date: new Date().toISOString().slice(0, 10), action: "Added to Inventory", empId: "", empName: "", empDept: "", assetIdFull: displayId, statusLabel: statusVal }],
        };
        AST_STATE.assets.push(asset);
        if (AST_STATE.replAwaitingAdd) AST_STATE.replNewKey = asset.id;
        amsNotify(`Asset added: ${displayId} (${asset.type})`, "success");
    }

    amsCloseModal("modalForm");
    amsDbSaveAsync("mobiles");
    renderAssetTable();
    if (AST_STATE.replAwaitingAdd) amsResumeReplaceAfterAdd();
}

/* =============================================================================
   13) VIEW ASSET MODAL
   ===========================================================================*/
function amsOpenViewModal(key) {
    const a = AST_STATE.assets.find(x => x.id === key);
    if (!a) return;
    AST_STATE.viewKey = key;
    const showAmsId = document.getElementById("superRootToggle").checked;
    const directEmp = a.assignedTo ? amsGetEmployeeByAmsId(a.assignedTo) : null;
    const subEmp = a.assignedToSubordinate ? amsGetEmployeeByAmsId(a.assignedToSubordinate) : null;

    document.getElementById("viewModalBody").innerHTML = `
        ${showAmsId ? `<div class="detail-row"><span class="detail-label">AMS Asset ID</span><span class="detail-value mono-cell">${amsEsc(a.amsAssetId)}</span></div>` : ""}
        <div class="detail-row"><span class="detail-label">Asset ID (Full)</span><span class="detail-value mono-cell">${amsEsc(amsComputeFullId(a))}</span></div>
        <div class="detail-row"><span class="detail-label">Type / Make / Model</span><span class="detail-value">${amsEsc(a.type)} - ${amsEsc(a.make)} ${amsEsc(a.model)}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${amsEsc(a.category) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Asset Name</span><span class="detail-value">${amsEsc(a.name) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Serial Number</span><span class="detail-value mono-cell">${amsEsc(a.serialNumber) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Purchase Site</span><span class="detail-value">${amsEsc(a.purchaseSite)}</span></div>
        <div class="detail-row"><span class="detail-label">Current Site</span><span class="detail-value">${amsEsc(a.currentSite || a.site)}</span></div>
        <div class="detail-row"><span class="detail-label">Purchase Date</span><span class="detail-value">${amsFormatDate(a.purchaseDate) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Issue Date</span><span class="detail-value">${amsFormatDate(a.issueDate) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Warranty End</span><span class="detail-value">${amsFormatDate(a.warrantyEnd) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${amsEsc(a.status)}</span></div>
        <div class="detail-row"><span class="detail-label">Assigned To (Direct)</span><span class="detail-value">${directEmp ? amsEsc(directEmp.name) + " (" + amsEsc(directEmp.empId) + ")" : "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Assigned To (Subordinate)</span><span class="detail-value">${subEmp ? amsEsc(subEmp.name) + " (" + amsEsc(subEmp.empId) + ")" : (a.assignedSubText ? amsEsc(a.assignedSubText) : "-")}</span></div>
        <div class="detail-row"><span class="detail-label">Vendor</span><span class="detail-value">${amsEsc(a.vendor) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Purchase Cost</span><span class="detail-value">${a.purchaseCost ? formatCurrency(a.purchaseCost) : "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Remarks</span><span class="detail-value">${amsEsc(a.remarks) || "-"}</span></div>
        ${a.replacesReason ? `<div class="detail-row"><span class="detail-label">Replacement Reason</span><span class="detail-value">${amsEsc(a.replacesReason)}${a.replacesNote ? ` - ${amsEsc(a.replacesNote)}` : ""}</span></div>` : ""}
        ${a.replacesPurchaseDate ? `<div class="detail-row"><span class="detail-label">Old Asset Purchase Date</span><span class="detail-value">${amsFormatDate(a.replacesPurchaseDate)}</span></div>` : ""}
        <div class="detail-row"><span class="detail-label">Accessories Issued</span><span class="detail-value">${(a.accessories && a.accessories.length) ? amsEsc(a.accessories.join(", ")) : "-"}</span></div>
        ${a.replacesAssetId ? `<div class="detail-row"><span class="detail-label">Replaces (Old Asset)</span><span class="detail-value mono-cell">${amsEsc(a.replacesAssetId)}</span></div>` : ""}
        ${a.replacedByAssetId ? `<div class="detail-row"><span class="detail-label">Replaced By (New Asset)</span><span class="detail-value mono-cell">${amsEsc(a.replacedByAssetId)}</span></div>` : ""}
        ${amsSparePartsUsedHtml(a)}
    `;
    amsOpenModal("modalView");
}

/* Cross-links to the shared Spare Parts usage log - matched on the asset's
   permanent Display ID so the link survives the Full Asset ID changing later. */
function amsSparePartsUsedHtml(a) {
    if (typeof AMS_DUMMY_SPAREPART_LOG === "undefined") return "";
    const base = amsBaseDisplayId(a);
    const entries = AMS_DUMMY_SPAREPART_LOG.filter(l => l.type === "Used" && l.assetBaseId === base);
    if (!entries.length) return "";
    const rows = entries.map(l => `<tr><td class="mono-cell">${amsFormatDate(l.date)}</td><td>${amsEsc(l.name)}</td><td class="mono-cell">${l.qty}</td><td>${amsEsc(l.by) || "-"}</td></tr>`).join("");
    return `
        <div class="card" style="margin-top:14px;">
            <div class="card-title">Spare Parts Used on This Asset</div>
            <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Part</th><th>Qty</th><th>By</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>`;
}

/* Downloads the asset details currently shown in the "View" modal as CSV. */
function amsDownloadAssetView() {
    const a = AST_STATE.assets.find(x => x.id === AST_STATE.viewKey);
    if (!a) return;
    const directEmp = a.assignedTo ? amsGetEmployeeByAmsId(a.assignedTo) : null;
    const subEmp = a.assignedToSubordinate ? amsGetEmployeeByAmsId(a.assignedToSubordinate) : null;
    const rows = [
        ["Field", "Value"],
        ["AMS Asset ID", a.amsAssetId || "-"],
        ["Asset ID (Full)", amsComputeFullId(a)],
        ["Type / Make / Model", `${a.type} - ${a.make} ${a.model || ""}`.trim()],
        ["Category", a.category || "-"],
        ["Asset Name", a.name || "-"],
        ["Serial Number", a.serialNumber || "-"],
        ["Purchase Site", a.purchaseSite || "-"],
        ["Current Site", a.currentSite || a.site || "-"],
        ["Purchase Date", amsFormatDate(a.purchaseDate) || "-"],
        ["Issue Date", amsFormatDate(a.issueDate) || "-"],
        ["Warranty End", amsFormatDate(a.warrantyEnd) || "-"],
        ["Status", a.status || "-"],
        ["Assigned To (Direct)", directEmp ? `${directEmp.name} (${directEmp.empId})` : "-"],
        ["Assigned To (Subordinate)", subEmp ? `${subEmp.name} (${subEmp.empId})` : (a.assignedSubText || "-")],
        ["Vendor", a.vendor || "-"],
        ["Purchase Cost", a.purchaseCost ? formatCurrency(a.purchaseCost) : "-"],
        ["Remarks", a.remarks || "-"],
    ];
    const csv = rows.map(amsCsvRow).join("\r\n");
    amsDownloadFile(csv, `Asset_${a.id}.csv`, "text/csv;charset=utf-8;");
}

/* Downloads the "Asset ID Record" (lifecycle history) currently shown as CSV. */
function amsDownloadAssetHistory() {
    const a = AST_STATE.assets.find(x => x.id === AST_STATE.historyKey);
    if (!a) return;
    const headers = ["Date", "Type", "Action", "Emp Code", "Emp Name", "Department", "Asset ID (Full)", "Status", "Accessories"];
    const rows = a.history.map(h => [
        amsFormatDate(h.date) || "-",
        amsHistoryEventType(h.action).label,
        h.action,
        h.empId || "-",
        h.empName || "-",
        h.empDept || "-",
        h.assetIdFull || "-",
        h.statusLabel || "-",
        h.accessories || "-",
    ]);
    const csv = [amsCsvRow(headers)].concat(rows.map(r => amsCsvRow(r))).join("\r\n");
    amsDownloadFile(csv, `Asset_ID_Record_${a.id}.csv`, "text/csv;charset=utf-8;");
}

/* =============================================================================
   14) ASSIGN / ASSET EDIT MODAL
   ===========================================================================*/
function amsPopulateEmpDropdowns() {
    const activeEmps = AMS_STATE_EMPLOYEES_REF().filter(e => e.status === "Active");
    const opts = (includeBlank) => (includeBlank ? `<option value="">None</option>` : "")
        + activeEmps.map(e => `<option value="${amsEsc(e.empId)}">${amsEsc(e.name)} (${amsEsc(e.dept)})</option>`).join("")
        + `<option value="__other__">Other / Not in User Master...</option>`;
    document.getElementById("assignDirectEmp").innerHTML = activeEmps
        .map(e => `<option value="${amsEsc(e.empId)}">${amsEsc(e.name)} (${amsEsc(e.dept)})</option>`).join("");
    document.getElementById("assignSubEmp").innerHTML = opts(true);
}

function amsLastAssignDate(a) {
    if (!a || !a.history || !a.history.length) return "";
    for (let i = a.history.length - 1; i >= 0; i--) {
        const act = String(a.history[i].action || "");
        if (act.indexOf("Assigned") === 0 || act.indexOf("Reassigned") === 0 || act.indexOf("Assignment updated") === 0) {
            return a.history[i].date || "";
        }
    }
    return "";
}

function amsOpenAssignModal(key, mode) {
    const a = AST_STATE.assets.find(x => x.id === key);
    if (!a) return;
    AST_STATE.editingId = key;
    AST_STATE.assignMode = mode;
    document.getElementById("assignModalTitle").textContent = mode === "edit" ? "Edit Asset Assignment" : "Assign Asset";
    const confirmBtn = document.getElementById("btnConfirmAssign");
    if (confirmBtn) confirmBtn.textContent = mode === "edit" ? "Save Changes" : "Confirm";
    amsPopulateEmpDropdowns();
    document.getElementById("assignDirectEmp").value = a.assignedTo || "";
    document.getElementById("assignSubEmp").value = a.assignedToSubordinate || (a.assignedSubText ? "__other__" : "");
    document.getElementById("assignSubText").value = a.assignedSubText || "";
    document.getElementById("assignSubText").style.display = a.assignedSubText ? "block" : "none";
    const dateEl = document.getElementById("assignDate");
    if (mode === "edit") dateEl.value = amsLastAssignDate(a) || new Date().toISOString().slice(0, 10);
    else dateEl.value = new Date().toISOString().slice(0, 10);
    amsRenderAccessoriesChecklist("assignAccessories", a.type, mode === "edit" ? (a.accessories || []) : []);

    amsOpenModal("modalAssign");
}

/* Shows/hides the free-text "Other" inputs in the Assign modal when the matching
   select switches to "Other / Not in the Master..." and back. */
function amsWireAssignOtherToggles() {
    const subSelect = document.getElementById("assignSubEmp");
    const subText = document.getElementById("assignSubText");
    if (subSelect && subText) {
        subSelect.addEventListener("change", () => {
            subText.style.display = subSelect.value === "__other__" ? "block" : "none";
            if (subSelect.value !== "__other__") subText.value = "";
        });
    }
}

function amsConfirmAssign() {
    const a = AST_STATE.assets.find(x => x.id === AST_STATE.editingId);
    if (!a) return;
    const directId = document.getElementById("assignDirectEmp").value;
    const subId = document.getElementById("assignSubEmp").value;
    const subTextEl = document.getElementById("assignSubText");
    const subText = (subId === "__other__" && subTextEl) ? subTextEl.value.trim() : "";
    const assignedSub = subId && subId !== "__other__" ? subId : (subText ? "__other__" : null);
    const assignDate = document.getElementById("assignDate").value || new Date().toISOString().slice(0, 10);
    if (!directId) { alert("Select a Direct Employee to assign this asset to."); return; }

    const directEmp = amsGetEmployeeByAmsId(directId);
    a.assignedTo = directId;
    a.assignedToSubordinate = subId && subId !== "__other__" ? subId : null;
    a.assignedSubText = subText || null;
    a.status = "Assigned";
    a.dept = directEmp ? directEmp.dept : ""; /* keep legacy convenience field in sync */
    a.id = amsComputeFullId(a);

    const accessories = amsGetCheckedAccessories("assignAccessories");
    a.accessories = accessories;

    const isEdit = AST_STATE.assignMode === "edit";
    a.history.push({
        date: assignDate,
        action: isEdit ? "Assignment updated" : "Assigned - New",
        empId: directEmp ? directEmp.empId : "", empName: directEmp ? directEmp.name : "", empDept: directEmp ? directEmp.dept : "",
        assetIdFull: a.id, statusLabel: "Assigned",
        accessories: accessories.length ? accessories.join(", ") : "",
    });

    const holderBits = [];
    if (assignedSub) holderBits.push(assignedSub === "__other__" ? subText : (amsGetEmployeeByAmsId(assignedSub) || {}).name || assignedSub);
    const holderNote = holderBits.length ? ` (${holderBits.join(" / ")})` : "";
    amsNotify(`Asset ${a.id} ${isEdit ? "assignment updated for" : "assigned to"} ${directEmp ? directEmp.name : directId}${holderNote}`, "success");

    amsCloseModal("modalAssign");
    amsDbSaveAsync("mobiles");
    renderAssetTable();
}

/* =============================================================================
   15) RETURN ASSET
   ===========================================================================*/
function amsReturnAsset(key) {
    const a = AST_STATE.assets.find(x => x.id === key);
    if (!a) return;
    const prevEmp = a.assignedTo ? amsGetEmployeeByAmsId(a.assignedTo) : null;
    if (!confirm(`Mark "${amsComputeFullId(a)}" as Returned (In Store)?`)) return;

    a.history.push({
        date: new Date().toISOString().slice(0, 10), action: "Returned",
        empId: prevEmp ? prevEmp.empId : "", empName: prevEmp ? prevEmp.name : "", empDept: prevEmp ? prevEmp.dept : "",
        assetIdFull: amsBaseDisplayId(a), statusLabel: "In Store",
    });

    a.assignedTo = null; a.assignedToSubordinate = null; a.assignedSubText = null; a.assignedDepartment = null; a.assignedDeptText = null; a.usageNote = null; a.dept = ""; a.status = "In Store";
    a.id = amsComputeFullId(a); /* reverts to base display id */
    amsNotify(`Asset returned: ${a.id}${prevEmp ? ` (from ${prevEmp.name})` : ""}`, "info");
    amsDbSaveAsync("mobiles");
    renderAssetTable();
}

/* =============================================================================
   16) TRANSFER ASSET (change Current Site)
   ===========================================================================*/
function amsOpenTransferModal(key) {
    AST_STATE.editingId = key;
    document.getElementById("transferSite").innerHTML = AMS_DUMMY_SITES.filter(s => s.active).map(s => `<option value="${amsEsc(s.name)}">${amsEsc(s.name)}</option>`).join("");
    document.getElementById("transferStatus").innerHTML = AMS_ASSET_STATUS_OPTIONS.map(s => `<option value="${amsEsc(s)}">${amsEsc(s)}</option>`).join("");
    document.getElementById("transferStatus").value = "Transfer"; /* suggested default - user can change it */
    document.getElementById("transferDate").value = new Date().toISOString().slice(0, 10); /* suggested default - user can pick any date */
    amsOpenModal("modalTransfer");
}

function amsConfirmTransfer() {
    const a = AST_STATE.assets.find(x => x.id === AST_STATE.editingId);
    if (!a) return;
    const newSite = document.getElementById("transferSite").value;
    const newStatus = document.getElementById("transferStatus").value;
    const transferDate = document.getElementById("transferDate").value || new Date().toISOString().slice(0, 10);
    if (newSite === (a.currentSite || a.site)) { alert("Already at this site."); return; }

    a.currentSite = newSite; a.site = newSite;
    a.status = newStatus;
    const emp = a.assignedTo ? amsGetEmployeeByAmsId(a.assignedTo) : null; /* captured before clearing, for the history log */
    if (["Transfer", "Not Working", "Retired / Scrapped", "Replaced"].includes(newStatus)) {
        a.assignedTo = null; a.assignedToSubordinate = null; a.assignedSubText = null; a.assignedDepartment = null; a.assignedDeptText = null; a.usageNote = null; a.dept = "";
    }
    a.id = amsComputeFullId(a);

    a.history.push({
        date: transferDate, action: `Transferred to ${newSite}`,
        empId: emp ? emp.empId : "", empName: emp ? emp.name : "", empDept: emp ? emp.dept : "",
        assetIdFull: a.id, statusLabel: newStatus,
    });
    amsNotify(`Asset transferred: ${a.id} moved to ${newSite}`, "info");

    amsCloseModal("modalTransfer");
    amsDbSaveAsync("mobiles");
    renderAssetTable();
}

/* =============================================================================
   17) NOT WORKING + RETIRE / SCRAP
   ===========================================================================*/
function amsMarkNotWorking(key) {
    const a = AST_STATE.assets.find(x => x.id === key);
    if (!a) return;
    if (!confirm(`Mark "${amsComputeFullId(a)}" as Not Working?`)) return;
    const emp = a.assignedTo ? amsGetEmployeeByAmsId(a.assignedTo) : null;
    a.status = "Not Working";
    a.assignedTo = null; a.assignedToSubordinate = null; a.assignedSubText = null; a.assignedDepartment = null; a.assignedDeptText = null; a.usageNote = null; a.dept = "";
    a.id = amsComputeFullId(a);
    a.history.push({
        date: new Date().toISOString().slice(0, 10), action: "Not Working",
        empId: emp ? emp.empId : "", empName: emp ? emp.name : "", empDept: emp ? emp.dept : "",
        assetIdFull: a.id, statusLabel: "Not Working",
    });
    amsNotify(`Asset marked Not Working: ${a.id}`, "warning");
    amsDbSaveAsync("mobiles");
    renderAssetTable();
}

function amsRetireAsset(key) {
    const a = AST_STATE.assets.find(x => x.id === key);
    if (!a) return;
    if (!confirm(`Retire / Scrap "${amsComputeFullId(a)}"? This is normally the end of its lifecycle.`)) return;
    const emp = a.assignedTo ? amsGetEmployeeByAmsId(a.assignedTo) : null;
    a.status = "Retired / Scrapped";
    a.assignedTo = null; a.assignedToSubordinate = null; a.assignedSubText = null; a.assignedDepartment = null; a.assignedDeptText = null; a.usageNote = null; a.dept = "";
    a.id = amsComputeFullId(a);
    a.history.push({
        date: new Date().toISOString().slice(0, 10), action: "Retired / Scrapped",
        empId: emp ? emp.empId : "", empName: emp ? emp.name : "", empDept: emp ? emp.dept : "",
        assetIdFull: a.id, statusLabel: "Retired / Scrapped",
    });
    amsNotify(`Asset retired/scrapped: ${a.id}`, "danger");
    amsDbSaveAsync("mobiles");
    renderAssetTable();
}

/* =============================================================================
   18) REPLACE ASSET (new asset created, old one marked Replaced, both linked)
   ===========================================================================*/
function amsOpenReplaceModal(key) {
    const old = AST_STATE.assets.find(x => x.id === key);
    if (!old) return;
    AST_STATE.editingId = key;
    AST_STATE.replAwaitingAdd = false;
    AST_STATE.replOldKey = null;
    AST_STATE.replNewKey = null;
    document.getElementById("replaceOldAssetLabel").textContent = `${amsComputeFullId(old)} (${old.type} - ${old.make} ${old.model || ""})`;

    document.getElementById("replType").innerHTML = AMS_DUMMY_ASSET_TYPES.filter(t => t.active).map(t => `<option value="${amsEsc(t.name)}">${amsEsc(t.name)}</option>`).join("");
    document.getElementById("replType").value = old.type; /* same type by default - switchable if unavailable */
    document.getElementById("replTypeHint").textContent = "Only In-Store (unassigned) assets of this type are listed below. Change the type to browse other In-Store assets.";

    amsPopulateReplaceSource();

    document.getElementById("replIssueDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("replReason").value = "";
    document.getElementById("replNote").value = "";

    amsOpenModal("modalReplace");
}

/* Lists In-Store (unassigned) assets of the currently selected type for the
   Replace modal. The old asset being replaced is never offered as its own
   replacement. */
function amsPopulateReplaceSource() {
    const sel = document.getElementById("replSourceAsset");
    if (!sel) return;
    const type = document.getElementById("replType").value;
    const prev = sel.value;
    const candidates = AST_STATE.assets.filter(a =>
        a.id !== AST_STATE.editingId &&
        !a.assignedTo &&
        a.status === "In Store" &&
        a.type === type
    ).sort((x, y) => String(amsComputeFullId(x)).localeCompare(String(amsComputeFullId(y))));
    sel.innerHTML = candidates.length
        ? candidates.map(a => {
            const detail = [a.make, a.model].filter(Boolean).join(" ");
            const serial = a.serialNumber ? ` - ${a.serialNumber}` : "";
            return `<option value="${amsEsc(a.id)}">${amsEsc(amsComputeFullId(a))} - ${amsEsc(detail)}${amsEsc(serial)}</option>`;
        }).join("")
        : `<option value="">(No In-Store assets of this type - change type or add a new asset)</option>`;
    if (candidates.some(a => a.id === prev)) sel.value = prev;
    amsUpdateReplaceSelected();
}

/* Refreshes the read-only summary box showing the currently selected
   replacement asset's details. */
function amsUpdateReplaceSelected() {
    const info = document.getElementById("replSelectedInfo");
    if (!info) return;
    const id = document.getElementById("replSourceAsset").value;
    const a = id ? AST_STATE.assets.find(x => x.id === id) : null;
    if (!a) {
        info.innerHTML = `<div class="selected-asset-box"><span class="form-hint">No replacement asset selected yet.</span></div>`;
        return;
    }
    const acc = (a.accessories && a.accessories.length) ? a.accessories.join(", ") : "-";
    info.innerHTML = `<div class="selected-asset-box">
        <strong>${amsEsc(amsComputeFullId(a))}</strong> &mdash; ${amsEsc(a.type)} ${amsEsc(a.make)} ${amsEsc(a.model) || ""}
        <div class="form-hint">Serial: ${amsEsc(a.serialNumber) || "-"} &middot; Site: ${amsEsc(a.currentSite || a.site)} &middot;
        Purchase: ${amsFormatDate(a.purchaseDate) || "-"} &middot; Accessories: ${amsEsc(acc)}</div>
    </div>`;
}

/* Opens the standard Add Asset modal from inside the Replace modal. When the new
   asset is saved it is re-selected in the Replace modal so the user can complete
   the replacement. */
function amsOpenReplaceAddAsset() {
    AST_STATE.replOldKey = AST_STATE.editingId;
    AST_STATE.replAwaitingAdd = true;
    amsOpenAddModal();
}

/* After a new asset is added from the Replace modal, re-opens the Replace modal
   with the freshly added asset pre-selected as the replacement. */
function amsResumeReplaceAfterAdd() {
    const oldKey = AST_STATE.replOldKey;
    const newKey = AST_STATE.replNewKey;
    AST_STATE.replAwaitingAdd = false;
    AST_STATE.replOldKey = null;
    AST_STATE.replNewKey = null;
    if (!oldKey) return;
    amsOpenReplaceModal(oldKey);
    const sel = document.getElementById("replSourceAsset");
    if (sel && newKey) { sel.value = newKey; amsUpdateReplaceSelected(); }
    amsNotify("Asset added - select it to complete the replacement.", "info");
}

function amsSubmitReplaceForm(e) {
    e.preventDefault();
    const old = AST_STATE.assets.find(x => x.id === AST_STATE.editingId);
    if (!old) return;
    const srcId = document.getElementById("replSourceAsset").value;
    if (!srcId) {
        alert("Select an In-Store asset to use as the replacement - or click + (Add Asset) to create one first.");
        return;
    }
    const newAsset = AST_STATE.assets.find(x => x.id === srcId);
    if (!newAsset || newAsset.assignedTo || newAsset.status !== "In Store") {
        alert("That asset is no longer In-Store. Pick another In-Store asset (or add one).");
        return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const issueDate = document.getElementById("replIssueDate").value || today;
    const replacesReason = document.getElementById("replReason").value;
    const replacesNote = document.getElementById("replNote").value.trim();
    const replDetail = `Reason: ${replacesReason}${replacesNote ? ` - ${replacesNote}` : ""}`;
    const oldEmp = old.assignedTo ? amsGetEmployeeByAmsId(old.assignedTo) : null;

    /* ---- The selected In-Store asset takes over the old asset's assignment ---- */
    newAsset.assignedTo = old.assignedTo || null;
    newAsset.assignedToSubordinate = old.assignedToSubordinate || null;
    newAsset.assignedSubText = old.assignedSubText || null;
    newAsset.assignedDepartment = old.assignedDepartment || null;
    newAsset.assignedDeptText = old.assignedDeptText || null;
    newAsset.usageNote = old.usageNote || null;
    newAsset.dept = old.dept || "";
    newAsset.status = old.assignedTo ? "Assigned" : "In Store";
    newAsset.replacesAssetId = amsBaseDisplayId(old);
    newAsset.replacesReason = replacesReason;
    newAsset.replacesNote = replacesNote;
    newAsset.replacesPurchaseDate = old.purchaseDate || "";
    newAsset.id = amsComputeFullId(newAsset);

    newAsset.history.push({
        date: issueDate, action: `Assigned (Replacement for ${amsBaseDisplayId(old)})`,
        empId: old.assignedTo || "", empName: oldEmp ? oldEmp.name : "", empDept: old.dept || "", assetIdFull: newAsset.id, statusLabel: newAsset.status,
        accessories: (newAsset.accessories && newAsset.accessories.length) ? newAsset.accessories.join(", ") : "",
        note: replDetail,
    });

    /* ---- Mark the old asset Replaced, clear its assignment, link to the new asset ---- */
    const oldPrevEmp = old.assignedTo ? amsGetEmployeeByAmsId(old.assignedTo) : null;
    old.status = "Replaced";
    old.assignedTo = null; old.assignedToSubordinate = null; old.assignedDepartment = null; old.assignedDeptText = null; old.usageNote = null; old.dept = "";
    old.replacedByAssetId = amsBaseDisplayId(newAsset);
    old.id = amsComputeFullId(old);
    old.history.push({
        date: today, action: `Replaced by ${amsBaseDisplayId(newAsset)}`, note: replDetail,
        empId: oldPrevEmp ? oldPrevEmp.empId : "", empName: oldPrevEmp ? oldPrevEmp.name : "", empDept: oldPrevEmp ? oldPrevEmp.dept : "",
        assetIdFull: old.id, statusLabel: "Replaced",
    });
    amsNotify(`Asset replaced: ${amsBaseDisplayId(old)} \u2192 ${amsComputeFullId(newAsset)}`, "warning");

    amsCloseModal("modalReplace");
    amsDbSaveAsync("mobiles");
    renderAssetTable();
}

/* =============================================================================
   19) ASSET ID RECORD (lifecycle history popup)
   ===========================================================================*/
function amsHistoryEventType(action) {
    if (action.indexOf("Transferred") === 0) return { label: "Transfer", cls: "badge-transfer" };
    if (action.indexOf("Reassigned") === 0) return { label: "Reassign", cls: "badge-amber" };
    if (action === "Assignment updated") return { label: "Asset Edit", cls: "badge-amber" };
    if (action === "Assigned - New") return { label: "Assign", cls: "badge-green" };
    if (action === "Returned") return { label: "Return", cls: "badge-grey" };
    if (action.indexOf("Replaced by") === 0 || action.indexOf("Replacement") !== -1) return { label: "Replace", cls: "badge-transfer" };
    if (action === "Retired / Scrapped") return { label: "Retire", cls: "badge-red" };
    if (action === "Not Working") return { label: "Fault", cls: "badge-red" };
    return { label: "Other", cls: "badge-grey" };
}

function amsOpenHistoryModal(key) {
    const a = AST_STATE.assets.find(x => x.id === key);
    if (!a) return;
    AST_STATE.historyKey = key;
    const rows = a.history.length
        ? a.history.map(h => {
            const evt = amsHistoryEventType(h.action);
            return `<tr>
                <td class="mono-cell">${amsFormatDate(h.date)}</td>
                <td><span class="badge ${evt.cls}">${evt.label}</span></td>
                <td>${amsEsc(h.action)}${h.note ? `<div class="form-hint" style="font-size:12px;margin-top:2px;">${amsEsc(h.note)}</div>` : ""}</td>
                <td class="mono-cell">${amsEsc(h.empId) || "-"}</td>
                <td>${amsEsc(h.empName) || "-"}</td>
                <td>${amsEsc(h.empDept) || "-"}</td>
                <td class="mono-cell">${amsEsc(h.assetIdFull)}</td>
                <td>${amsEsc(h.statusLabel)}</td>
                <td>${amsEsc(h.accessories) || "-"}</td>
            </tr>`;
        }).join("")
        : `<tr><td colspan="9" class="empty-note" style="text-align:center;">No lifecycle events recorded yet</td></tr>`;

    document.getElementById("historyModalBody").innerHTML = `
        <p class="form-hint" style="margin-bottom:10px;">
            Full record from creation to end-of-life for <strong>${amsEsc(amsComputeFullId(a))}</strong> - every assign, reassign, return, transfer, and status change (${a.history.length} event${a.history.length === 1 ? "" : "s"}).
        </p>
        <div class="table-wrap"><table class="table">
            <thead><tr><th>Date</th><th>Type</th><th>Action</th><th>Emp Code</th><th>Emp Name</th><th>Department</th><th>Asset ID (Full)</th><th>Status</th><th>Accessories</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;
    amsOpenModal("modalHistory");
}

/* =============================================================================
   20) PRINT ASSET ISSUE FORM (per-row, Assigned assets only - self-contained
   so the admin never navigates away from the Asset Master page)
   ===========================================================================*/
function amsOwnedAssetsForEmp(empId) {
    return AST_STATE.assets.filter(a => a.assignedTo === empId && (a.status === "Assigned" || a.status === "In Repair"));
}

function amsSubordinateAssetsForEmpDetailed(empId) {
    const directReports = AMS_STATE_EMPLOYEES_REF().filter(e => e.reportsTo === empId);
    let list = [];
    directReports.forEach(r => {
        amsOwnedAssetsForEmp(r.empId).forEach(a => list.push({
            ...a, subName: r.name, subEmpId: amsGetEmployeeDisplayId(r),
        }));
    });
    return list;
}

function amsGenerateAssetFormNo() {
    const seq = (AST_STATE.formCounters.AIF = (AST_STATE.formCounters.AIF || 0) + 1);
    return `AIF-${String(seq).padStart(6, "0")}`;
}

/* Builds the "Remarks / Notes" section body: ONLY each asset's own stored
   Remarks. The typed pre-print note is rendered separately by
   amsBuildAdditionalRemarksHtml() below. */
function amsBuildRemarksLinesHtml(assetsList) {
    const lines = [];
    assetsList.forEach(oa => {
        if (oa.remarks) lines.push(`<div><strong>${amsEsc(amsPrintAssetId(oa))} - Remarks (on record):</strong> ${amsEsc(oa.remarks)}</div>`);
    });
    if (!lines.length) lines.push(`<div class="pf-notes-empty">No remarks recorded against the asset(s) in the system.</div>`);
    return lines.join("");
}

/* Builds the separate "Additional Remarks/Notes (IT/HR/Admin)" section: the
   note typed into the pre-print modal (or blank space if nothing was typed),
   with a signature line for the IT/HR/Admin representative. */
function amsBuildAdditionalRemarksHtml(extraRemarks) {
    const content = extraRemarks
        ? amsEsc(extraRemarks)
        : `<span class="pf-notes-empty">(Blank - to be filled in writing by IT / HR / Admin, if applicable)</span>`;
    return `
        <div class="pf-additional-box">
            <div class="pf-additional-content">${content}</div>
            <div class="pf-additional-sign">
                <span>Name &amp; Signature (IT / HR / Admin): _______________________________</span>
                <span>Date: ________________</span>
            </div>
        </div>`;
}

function amsPrintAssetIssueForm(key) {
    const a = AST_STATE.assets.find(x => x.id === key);
    if (!a || a.status !== "Assigned" || !a.assignedTo) {
        alert("Asset Issue Form is only available for assets currently marked Assigned.");
        return;
    }
    const emp = amsGetEmployeeByAmsId(a.assignedTo);
    if (!emp) return;
    amsGenerateAssetIssueFormPrint(key, "");
}

function amsGenerateAssetIssueFormPrint(key, extraRemarks) {
    const a = AST_STATE.assets.find(x => x.id === key);
    if (!a || a.status !== "Assigned" || !a.assignedTo) {
        alert("Asset Issue Form is only available for assets currently marked Assigned.");
        return;
    }
    const emp = amsGetEmployeeByAmsId(a.assignedTo);
    if (!emp) return;
    const owned = amsOwnedAssetsForEmp(emp.empId);
    const subAssets = amsSubordinateAssetsForEmpDetailed(emp.empId);

    /* Assets issued directly to the employee (assigned to them with no
       subordinate/team actual user) stay in "Assets Issued". Assets whose actual
       user is a subordinate/team member (User master record or free text) show
       in the "For Reference" section instead, since they are not personally held
       by the employee. */
    const splitOwned = amsSplitDirectVsSubordinateAssets(owned);
    const directOwned = splitOwned.direct;
    const subOwned = splitOwned.subordinate;
    const assignmentType = amsAssignmentTypeLabel(directOwned.length, subOwned.length + subAssets.length);

    const title = "Asset Issue Form";
    const formNo = amsGenerateAssetFormNo();
    const today = amsFormatDate(new Date().toISOString().slice(0, 10));
    const managerEmp = emp.reportsTo ? amsGetEmployeeByAmsId(emp.reportsTo) : null;
    const managerName = managerEmp ? managerEmp.name : "-";

    const terms = [
        "The employee acknowledges receipt of the above asset(s) in the condition noted, unless otherwise stated.",
        "The asset(s) remain company property and must be returned upon request, transfer, or exit.",
        "The employee is responsible for the safekeeping and proper use of the asset(s).",
        "Any loss, theft, or damage must be reported to IT/Admin immediately.",
        "This form must be retained for company records and produced upon asset return or audit.",
    ];

    const conditionRow = () => ["Good", "Needs Repair / Service", "Damaged"].map(o => `
        <label class="pf-check-inline"><input type="checkbox" disabled> ${o}</label>`).join("");
    const infoBox = (label, value) => `<div class="pf-box"><div class="pf-box-label">${amsEsc(label)}</div><div class="pf-box-value">${value || "&nbsp;"}</div></div>`;

    const infoBoxesHtml = `
        <div class="pf-box-grid cols-2">
            ${infoBox("Employee ID", amsEsc(amsGetEmployeeDisplayId(emp)))}
            ${infoBox("Full Name", amsEsc(emp.name))}
            ${infoBox("Department", amsEsc(emp.dept))}
            ${infoBox("Designation", amsEsc(emp.designation))}
            ${infoBox("Reporting Manager", amsEsc(managerName))}
            ${infoBox("Assignment Type", amsEsc(assignmentType))}
        </div>
        <div class="pf-box-grid cols-3">
            ${infoBox("Date of Issue", today)}
            ${infoBox("Expected Return", "Not Specified")}
            ${infoBox("Issued By", "IT / Admin")}
        </div>`;

    const assetTableHtml = `
        <table class="pf-asset-table">
            <thead>
                <tr><th style="width:30px;">#</th><th>Asset ID</th><th>Asset Name / Type</th><th>Site</th><th>Physical Condition at Issue</th></tr>
            </thead>
            <tbody>
                ${directOwned.length ? directOwned.map((oa, i) => `
                    <tr>
                        <td>${i + 1}</td><td class="mono">${amsPrintAssetId(oa)}</td><td>${oa.type}${oa.makeModel ? ` (${amsEsc(oa.makeModel)})` : ""}</td><td>${oa.currentSite || oa.site}</td>
                        <td>${conditionRow()}</td>
                    </tr>`).join("")
                    : `<tr><td colspan="5" style="text-align:center; color:#777;">No assets currently on record for this employee</td></tr>`}
            </tbody>
        </table>`;

    const accessoriesHtml = (typeof amsBuildPrintAccessoriesHtml === "function")
        ? amsBuildPrintAccessoriesHtml(directOwned)
        : `<div class="pf-section-bar">Accessories / Items Included</div>
        <div class="pf-checklist-grid">
            <label class="pf-check-block"><input type="checkbox" disabled> Power Adaptor / Charger</label>
            <label class="pf-check-block"><input type="checkbox" disabled> Carrying Bag / Case</label>
            <label class="pf-check-block"><input type="checkbox" disabled> Mouse / Keyboard (if applicable)</label>
            <label class="pf-check-block"><input type="checkbox" disabled> Original Box / Documentation</label>
            <label class="pf-check-block" style="grid-column:1 / -1;">Other: ________________________________</label>
        </div>`;

    const subRows = subAssets.map(sa => ({
        id: amsPrintAssetId(sa), type: sa.type, makeModel: sa.makeModel,
        site: sa.currentSite || sa.site, holder: sa.subName, holderId: sa.subEmpId,
    }));
    subOwned.forEach(oa => {
        const holderEmp = oa.assignedToSubordinate ? amsGetEmployeeByAmsId(oa.assignedToSubordinate) : null;
        subRows.push({
            id: amsPrintAssetId(oa), type: oa.type, makeModel: oa.makeModel,
            site: oa.currentSite || oa.site,
            holder: holderEmp ? holderEmp.name : (oa.assignedSubText || amsAssetHolderLabel(oa)),
            holderId: holderEmp ? amsGetEmployeeDisplayId(holderEmp) : "",
        });
    });
    const subordinateHtml = subRows.length ? `
        <div class="pf-section-bar">Assets Currently Assigned to Subordinates (For Reference)</div>
        <table class="pf-asset-table">
            <thead><tr><th style="width:30px;">#</th><th>Asset ID</th><th>Type</th><th>Held By</th><th>Employee ID</th><th>Site</th></tr></thead>
            <tbody>
                ${subRows.map((sa, i) => `
                    <tr><td>${i + 1}</td><td class="mono">${sa.id}</td><td>${sa.type}${sa.makeModel ? ` (${amsEsc(sa.makeModel)})` : ""}</td><td>${sa.holder}</td><td class="mono">${sa.holderId ? amsEsc(sa.holderId) : "-"}</td><td>${sa.site}</td></tr>`).join("")}
            </tbody>
        </table>` : "";

    const headerHtml = amsBuildPrintHeader(title, `
        <div class="pf-form-title pf-title-issue">${title.toUpperCase()}</div>
        <div><strong>Form No:</strong> ${formNo}</div>
        <div><strong>Date Generated:</strong> ${today}</div>`, "Asset Management System · IT Infrastructure Department");

    const printContent = `
        <div id="printArea">
            ${headerHtml}

            <div class="pf-section-bar">Issued To</div>
            ${infoBoxesHtml}

            <div class="pf-section-bar">Assets Issued</div>
            ${assetTableHtml}

            ${accessoriesHtml}
            ${subordinateHtml}

            <div class="pf-section-bar">Remarks / Notes</div>
            <div class="pf-notes-box">
                ${amsBuildRemarksLinesHtml(directOwned)}
            </div>

            <div class="pf-section-bar pf-bar-accent">Additional Remarks/Notes (IT/HR/Admin)</div>
            ${amsBuildAdditionalRemarksHtml(extraRemarks)}

            <ol class="pf-declaration">
                ${terms.map(t => `<li>${t}</li>`).join("")}
            </ol>

            <div class="pf-sign-grid">
                <div class="pf-sign-box">
                    <div class="pf-sign-line"></div>
                    <div class="pf-sign-label">Authorised By<br>Signature &amp; Date</div>
                </div>
                <div class="pf-sign-box">
                    <div class="pf-sign-line"></div>
                    <div class="pf-sign-label">Issued By (IT / Admin)<br>Signature &amp; Date</div>
                </div>
                <div class="pf-sign-box">
                    <div class="pf-sign-line"></div>
                    <div class="pf-sign-label">Employee<br>Signature &amp; Date</div>
                </div>
            </div>

            <div class="pf-footer">
                <span>AMS v4 - Generated electronically</span>
                <span>Internal Ref: ${formNo} &middot; ${directOwned.length} asset(s) issued &middot; ${directOwned.length} direct, ${subOwned.length + subAssets.length} team</span>
            </div>
        </div>
    `;

    /* ---- Open the print window directly (shared engine from js/print-docs.js) ----
       Landscape orientation gives the multi-column asset table room to breathe. */
    amsPrintDocument(printContent, title, "landscape");
}

/* =============================================================================
   21) IMPORT / EXPORT / TEMPLATE (bulk upload + download - Asset Master's own
   version, since its fields differ from the generic Master Table engine)
   ===========================================================================*/
const AST_EXPORT_HEADERS = [
    "displayId", "amsAssetId", "type", "category", "make", "model", "name", "serialNumber",
    "purchaseSite", "currentSite", "purchaseDate", "warrantyEnd", "status",
    "assignedToEmpId", "assignedToSubordinateEmpId", "vendor", "purchaseCost", "remarks",
    "replacesAssetId", "replacedByAssetId", "fullAssetId",
];
/* Import template deliberately excludes amsAssetId and fullAssetId - both are ALWAYS
   auto-generated by the system and must never be typed in manually. */
const AST_IMPORT_HEADERS = [
    "displayId", "type*", "category*", "make*", "model", "name", "serialNumber",
    "purchaseSite*", "currentSite*", "purchaseDate*", "warrantyEnd", "status",
    "assignedToEmpId", "assignedToSubordinateEmpId", "vendor", "purchaseCost", "remarks",
];

function amsExportAssets() {
    const rows = AST_STATE.assets.map(a => [
        amsBaseDisplayId(a), a.amsAssetId, a.type, a.category || "", a.make, a.model || "", a.name || "", a.serialNumber || "",
        a.purchaseSite, a.currentSite || a.site, amsFormatDate(a.purchaseDate), amsFormatDate(a.warrantyEnd), a.status,
        a.assignedTo || "", a.assignedToSubordinate || "", a.vendor || "", a.purchaseCost || "", a.remarks || "",
        a.replacesAssetId || "", a.replacedByAssetId || "", amsComputeFullId(a),
    ]);
    amsExportXlsx("Asset_Master_export", AST_EXPORT_HEADERS, rows);
}

function amsDownloadAssetTemplate() {
    if (typeof XLSX === "undefined") {
        alert("Excel export library not loaded. Check js/vendor/xlsx.full.min.js is present.");
        return;
    }
    const sample = [
        "LT00099", "Laptop", "IT Hardware", "Dell", "Latitude 5430", "", "SN-EXAMPLE-001",
        "Mumbai HO", "Mumbai HO", "13-07-2026", "13-07-2028", "In Store",
        "", "", "Dell India Pvt Ltd", "65000", "Example row - delete before importing",
    ];
    const wb = XLSX.utils.book_new();
    const instr = XLSX.utils.aoa_to_sheet([
        ["Asset Master Import Template - Instructions"],
        ["Fields marked with * are required."],
        ["AMS Asset ID and Full Asset ID are always auto-generated - do not add them."],
        ["displayId blank = auto-generated, or type an existing legacy ID."],
        ["Dates use DD-MM-YYYY format."],
    ]);
    instr["!cols"] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(wb, instr, "Instructions");
    const tpl = XLSX.utils.aoa_to_sheet([AST_IMPORT_HEADERS, sample]);
    XLSX.utils.book_append_sheet(wb, tpl, "Template");
    XLSX.writeFile(wb, "Asset_Master_import_template.xlsx");
}

function amsShowImportSummary(results) {
    const banner = document.getElementById("importSummaryBanner");
    if (!banner) return;
    banner.style.display = "block";
    const added = results.filter(r => r.result === "added").length;
    const updated = results.filter(r => r.result === "updated").length;
    const skipped = results.filter(r => r.result === "skipped").length;
    const errors = results.filter(r => r.result === "error").length;
    banner.textContent = `Import complete: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} error(s). Skipped/error reasons are listed in the report.`;
    amsShowImportReport(results);
}

function amsImportAssetsFile(file) {
    amsReadImportRows(file).then((rows) => {
        rows = rows.filter(r => !(r[0] || "").trim().startsWith("#")); /* drop instruction/comment lines */
        if (!rows.length) { alert("File is empty or unreadable."); return; }
        const headers = rows[0].map(h => h.trim().replace(/\*$/, "")); /* strip the required-marker * before matching */
        const results = [];
        const seenDisplayIds = new Set(); /* within-file duplicate detection */

        for (let i = 1; i < rows.length; i++) {
            const raw = rows[i];
            if (!raw.length || raw.every(c => !c)) continue;
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = raw[idx] !== undefined ? raw[idx].trim() : ""; });
            const line = i + 1;
            const record = obj.displayId || obj.type || "(unnamed)";

            /* ---- Reference validation (same lookup tables as the Add form) ---- */
            const typeValid = obj.type && AMS_DUMMY_ASSET_TYPES.some(t => t.name === obj.type);
            const siteValid = obj.currentSite && AMS_DUMMY_SITES.some(s => s.name === obj.currentSite);
            const categoryValid = obj.category && AMS_DUMMY_ASSET_CATEGORIES.some(c => c.name === obj.category);
            if (!typeValid || !siteValid || !categoryValid) {
                const bad = [];
                if (!typeValid) bad.push(`Type "${obj.type}" not in Asset Type Master`);
                if (!categoryValid) bad.push(`Category "${obj.category}" not in Category Master`);
                if (!siteValid) bad.push(`Current Site "${obj.currentSite}" not in Site Master`);
                results.push({ row: line, record, result: "skipped", reason: bad.join("; ") });
                continue;
            }

            /* ---- Within-file duplicate detection on the identity field ---- */
            const identity = (obj.displayId || "").toLowerCase();
            if (identity && seenDisplayIds.has(identity)) {
                results.push({ row: line, record, result: "error", reason: `Duplicate displayId "${obj.displayId}" already used earlier in this file` });
                continue;
            }
            if (identity) seenDisplayIds.add(identity);

            const purchaseDate = obj.purchaseDate ? amsParseDMY(obj.purchaseDate) : "";
            const warrantyEnd = obj.warrantyEnd ? amsParseDMY(obj.warrantyEnd) : "";
            const status = AMS_ASSET_STATUS_OPTIONS.includes(obj.status) ? obj.status : "In Store";

            const existing = obj.displayId ? AST_STATE.assets.find(a => amsBaseDisplayId(a) === obj.displayId) : null;
            if (existing) {
                Object.assign(existing, {
                    type: obj.type, category: obj.category || existing.category, make: obj.make || existing.make, model: obj.model, name: obj.name,
                    serialNumber: obj.serialNumber, purchaseSite: obj.purchaseSite || existing.purchaseSite,
                    currentSite: obj.currentSite, site: obj.currentSite,
                    purchaseDate: purchaseDate || existing.purchaseDate, warrantyEnd: warrantyEnd || existing.warrantyEnd,
                    status, vendor: obj.vendor, purchaseCost: obj.purchaseCost, remarks: obj.remarks,
                });
                if (obj.assignedToEmpId && AMS_STATE_EMPLOYEES_REF().some(emp => emp.empId === obj.assignedToEmpId)) existing.assignedTo = obj.assignedToEmpId;
                if (["Transfer", "Not Working", "Retired / Scrapped", "Replaced"].includes(status)) { existing.assignedTo = null; existing.assignedToSubordinate = null; existing.assignedSubText = null; existing.assignedDepartment = null; existing.assignedDeptText = null; existing.dept = ""; }
                existing.id = amsComputeFullId(existing);
                results.push({ row: line, record, result: "updated", reason: "Existing asset updated" });
            } else {
                const typeShort = amsTypeShort(obj.type);
                const displayId = obj.displayId || amsGenerateDisplayId(typeShort);
                const asset = {
                    amsAssetId: amsGenerateAmsAssetId(typeShort), displayId, isLegacyId: !!obj.displayId, id: displayId,
                    type: obj.type, category: obj.category || "", make: obj.make, model: obj.model || "", name: obj.name || "", serialNumber: obj.serialNumber || "",
                    purchaseSite: obj.purchaseSite || obj.currentSite, currentSite: obj.currentSite, site: obj.currentSite,
                    purchaseDate, warrantyEnd, status, dept: "", assignedTo: null, assignedToSubordinate: null,
                    vendor: obj.vendor || "", purchaseCost: obj.purchaseCost || "", remarks: obj.remarks || "",
                    history: [{ date: new Date().toISOString().slice(0, 10), action: "Added to Inventory (Import)", empId: "", empName: "", empDept: "", assetIdFull: displayId, statusLabel: status }],
                };
                AST_STATE.assets.push(asset);
                results.push({ row: line, record, result: "added", reason: "New asset added" });
            }
        }

        renderAssetTable();
        amsDbSaveAsync("mobiles"); /* persist the imported/updated rows (wholesale PUT) */
        amsShowImportSummary(results);
        const fileInput = document.getElementById("assetImportFileInput");
        if (fileInput) fileInput.value = "";
    }).catch((err) => {
        alert("Could not read import file: " + (err && err.message ? err.message : err));
    });
}

/* =============================================================================
   22) SMALL SHARED FORM HELPERS (same pattern as employees.js)
   ===========================================================================*/
function showFormError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
}

function hideFormError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
}

/* =============================================================================
   23) PAGE INIT
   ===========================================================================*/
async function initMobiles() {
    /* Initial render (waits for the DB-backed collections to load first) */
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();
    amsSortRegisterRenderer("assetTable", renderAssetTable);
    renderAssetTable();

    /* Toolbar */
    document.getElementById("searchBox").addEventListener("input", renderAssetTable);
    document.getElementById("statusFilter").addEventListener("change", renderAssetTable);
    document.getElementById("superRootToggle").addEventListener("change", renderAssetTable);

    document.getElementById("btnAddAsset").addEventListener("click", amsOpenAddModal);
    document.getElementById("btnAssetExport").addEventListener("click", amsExportAssets);
    document.getElementById("btnAssetTemplate").addEventListener("click", amsDownloadAssetTemplate);
    document.getElementById("btnAssetImport").addEventListener("click", () => document.getElementById("assetImportFileInput").click());
    document.getElementById("assetImportFileInput").addEventListener("change", (e) => {
        if (e.target.files[0]) amsImportAssetsFile(e.target.files[0]);
    });

    /* Detail report downloads (View + Asset ID Record modals) */
    document.getElementById("btnViewCsv").addEventListener("click", amsDownloadAssetView);
    document.getElementById("btnHistoryCsv").addEventListener("click", amsDownloadAssetHistory);

    /* Row actions + dropdowns */
    amsWireRowActions();
    amsWireQuickAddPopovers();
    amsWireAccessoryAndDeptQuickAdds();

    /* Add/Edit form */
    document.getElementById("fType").addEventListener("change", amsUpdateAssetIdPreview);
    document.getElementById("assetForm").addEventListener("submit", amsSubmitAssetForm);

    /* Assign / Asset Edit */
    document.getElementById("btnConfirmAssign").addEventListener("click", amsConfirmAssign);
    amsWireAssignOtherToggles();

    /* Transfer */
    document.getElementById("btnConfirmTransfer").addEventListener("click", amsConfirmTransfer);

    /* Replace */
    document.getElementById("replType").addEventListener("change", amsPopulateReplaceSource);
    document.getElementById("replSourceAsset").addEventListener("change", amsUpdateReplaceSelected);
    document.getElementById("btnReplaceAddAsset").addEventListener("click", amsOpenReplaceAddAsset);
    document.getElementById("replaceForm").addEventListener("submit", amsSubmitReplaceForm);

    /* Quick-add employee (inline, from the Assign modal) */
    document.querySelectorAll("[data-open-add-employee]").forEach(btn => {
        btn.addEventListener("click", () => amsOpenAddEmployeeModal(btn.getAttribute("data-open-add-employee")));
    });
    document.getElementById("qaEmpSave").addEventListener("click", amsSaveQuickAddEmployee);

    /* Close buttons inside modals + clicking the dark overlay */
    document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => amsCloseModal(btn.getAttribute("data-close"))));
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) amsCloseModal(overlay.id);
        });
    });
}

/*------------------------------------------------------------------------------
#-------------- End of the code : MOBILE MASTER PAGE LOGIC ---------------------
#------------------------------------------------------------------------------*/
