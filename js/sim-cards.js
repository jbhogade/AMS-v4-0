/*==============================================================================
#-------------- Start Code for : SIM CARD MASTER PAGE LOGIC (sim-cards.js) ------
#
#  PURPOSE   : All logic for the SIM Card Master page - table render, SIM ID
#              generation, Add/Edit, Assign/Reassign/Return, Block, Retire, and
#              the lifecycle history shown inside the View modal. Plus bulk
#              Import / Export / Template. The SIM card record is SEPARATE from
#              the mobile phone (Mobile Master). Assign/Reassign links the SIM
#              to a company mobile (or Personal Mobile) and keeps both records
#              in sync: SIM.linkedMobileId = phone.amsAssetId, phone.simMobileNo
#              = SIM mobile number. Linking an In-Store phone also assigns it
#              to the same employee.
#
#  DATA      : Reads/writes the shared AMS_DUMMY_SIM_CARDS collection
#              (DB-backed via the simCards collection key).
#------------------------------------------------------------------------------*/

/* =============================================================================
   1) IN-MEMORY STATE
   ===========================================================================*/
const SIM_STATE = {
    sims: AMS_DUMMY_SIM_CARDS, /* live reference - the DB-backed collection cache */
    editingId: null,           /* simId currently being edited/acted on (Add modal = null) */
    assignMode: null,          /* "assign" | "reassign" | "edit" - which action opened modalSimAssign */
    qaKind: null,              /* "operator" | "plan" - which quick-add modal is open */
    viewKey: null,             /* simId whose details are open in modalSimView */
    formCounters: {},          /* per-form sequence counters for printed SIM Issue Forms */
};

const SIM_STATUS_BADGE = {
    "In Store": "badge-blue", "Issued": "badge-green", "Blocked": "badge-red", "Retired": "badge-grey",
};

function simEmployeesRef() {
    return (typeof amsGetEmployeesForPortal === "function") ? amsGetEmployeesForPortal() : [];
}

/* =============================================================================
   2) RENDER: SIM CARD TABLE
   ===========================================================================*/
function amsSimSiteNames() {
    const siteNames = (AMS_DUMMY_SITES || []).filter(s => s.active !== false).map(s => s.name);
    const simSites = (SIM_STATE.sims || []).map(s => s.site).filter(Boolean);
    return amsUniqueSorted(siteNames.concat(simSites));
}

function amsPopulateSimSiteSelect(el, allLabel) {
    if (!el) return;
    const prev = el.value;
    const names = amsSimSiteNames();
    const first = allLabel
        ? `<option value="">${amsEsc(allLabel)}</option>`
        : `<option value="">(None)</option>`;
    el.innerHTML = first + names.map(s => `<option value="${amsEsc(s)}">${amsEsc(s)}</option>`).join("");
    if (prev) el.value = prev;
}

function amsPopulateSimFilters() {
    amsPopulateSimSiteSelect(document.getElementById("simSiteFilter"), "All Sites");
}

function amsSimTableGetters() {
    return {
        simId: s => s.simId,
        mobile: s => s.mobileNumber || "",
        operator: s => s.operator || "",
        plan: s => s.plan || "",
        status: s => s.status,
        assigned: s => {
            const e = s.assignedTo ? amsGetEmployeeByAmsId(s.assignedTo) : null;
            return e ? e.name : "";
        },
        site: s => s.site || "",
        usedIn: s => amsSimUsedInLabel(s),
    };
}

function amsToolbarFilteredSims() {
    const searchTerm = (document.getElementById("simSearchBox").value || "").toLowerCase();
    const statusFilterVal = (document.getElementById("simStatusFilter") || {}).value || "";
    const siteFilterVal = (document.getElementById("simSiteFilter") || {}).value || "";
    return SIM_STATE.sims.filter(s => {
        if (statusFilterVal && s.status !== statusFilterVal) return false;
        if (siteFilterVal && (s.site || "") !== siteFilterVal) return false;
        if (!searchTerm) return true;
        return [s.simId, s.mobileNumber, s.operator, s.plan, s.iccid, s.site].some(v => String(v || "").toLowerCase().includes(searchTerm));
    });
}

function renderSimTable() {
    amsPopulateSimFilters();
    const filtered = amsToolbarFilteredSims();
    const getters = amsSimTableGetters();
    const colFiltered = amsFilterRows("simTable", filtered, getters);
    const sortedFiltered = amsSortRows("simTable", colFiltered, getters);

    const rows = sortedFiltered.map(s => {
        const emp = s.assignedTo ? amsGetEmployeeByAmsId(s.assignedTo) : null;
        const usedIn = amsSimUsedInLabel(s);
        return `<tr>
            <td class="mono-cell"><a href="#" class="clickable-id" data-sim-view-key="${amsEsc(s.simId)}">${amsEsc(s.simId)}</a></td>
            <td class="mono-cell">${amsEsc(s.mobileNumber) || "-"}</td>
            <td>${amsEsc(s.operator) || "-"}</td>
            <td>${amsEsc(s.plan) || "-"}</td>
            <td><span class="badge ${SIM_STATUS_BADGE[s.status] || "badge-grey"}">${amsEsc(s.status)}</span></td>
            <td>${emp ? amsEsc(emp.name) : "-"}</td>
            <td>${amsEsc(s.site) || "-"}</td>
            <td>${usedIn && usedIn !== "None" ? amsEsc(usedIn) : "-"}</td>
            <td class="actions-cell">
                <button class="actions-trigger" data-sim-actions-for="${amsEsc(s.simId)}" title="Actions">Actions ${typeof amsUiIcon === "function" ? amsUiIcon("caret") : ""}</button>
                <div class="actions-menu" id="sim-menu-${amsEsc(s.simId)}">
                    <button data-sim-action="view" data-key="${amsEsc(s.simId)}">View</button>
                    <button data-sim-action="edit" data-key="${amsEsc(s.simId)}">Edit</button>
                    <div class="menu-divider"></div>
                    <button data-sim-action="assign" data-key="${amsEsc(s.simId)}" ${(s.assignedTo || s.status === "Retired") ? "disabled" : ""}>Assign</button>
                    <button data-sim-action="editAssign" data-key="${amsEsc(s.simId)}" ${(!s.assignedTo || s.status === "Retired") ? "disabled" : ""}>Edit Assign/Issue</button>
                    <button data-sim-action="reassign" data-key="${amsEsc(s.simId)}" ${(!s.assignedTo || s.status === "Retired") ? "disabled" : ""}>Reassign</button>
                    <button data-sim-action="return" data-key="${amsEsc(s.simId)}" ${(!s.assignedTo || s.status === "Retired") ? "disabled" : ""}>Return</button>
                    <div class="menu-divider"></div>
                    <button data-sim-action="block" data-key="${amsEsc(s.simId)}" ${(s.status === "Blocked" || s.status === "Retired") ? "disabled" : ""}>Block</button>
                    <button class="danger-item" data-sim-action="retire" data-key="${amsEsc(s.simId)}" ${s.status === "Retired" ? "disabled" : ""}>Retire</button>
                    <div class="menu-divider"></div>
                    <button data-sim-action="printIssue" data-key="${amsEsc(s.simId)}" ${(s.status !== "Issued" || !s.assignedTo) ? "disabled" : ""} title="${(s.status !== "Issued" || !s.assignedTo) ? "Only available for currently Issued SIM cards" : "Print this employee's SIM Card Issue Form"}">SIM Card Issue Form</button>
                </div>
            </td>
        </tr>`;
    });

    document.getElementById("simTable").innerHTML = `
        <thead><tr>
            ${amsSortableTh("simTable", "simId", "SIM ID")}
            ${amsSortableTh("simTable", "mobile", "Mobile Number")}
            ${amsSortableTh("simTable", "operator", "Operator")}
            ${amsSortableTh("simTable", "plan", "Plan")}
            ${amsSortableTh("simTable", "status", "Status")}
            ${amsSortableTh("simTable", "assigned", "Assigned To")}
            ${amsSortableTh("simTable", "site", "Site")}
            ${amsSortableTh("simTable", "usedIn", "Used In")}
            <th></th>
        </tr>${amsFilterHeadRow("simTable", ["simId", "mobile", "operator", "plan", "status", "assigned", "site", "usedIn", ""])}</thead>
        <tbody>${rows.join("") || `<tr><td colspan="9" class="empty-note" style="text-align:center;padding:28px;">No SIM cards found</td></tr>`}</tbody>`;
    if (typeof amsFilterRestoreFocus === "function") amsFilterRestoreFocus("simTable");

    const footer = document.getElementById("simTableFooter");
    if (footer) {
        const totalMatches = colFiltered.length;
        footer.innerHTML = totalMatches
            ? `<span>${totalMatches} SIM card${totalMatches === 1 ? "" : "s"}</span>`
            : "";
    }

    renderSimStockSummary();
}

/* =============================================================================
   3) STOCK SUMMARY (Total / In Store / Issued / Blocked+Retired)
   ===========================================================================*/
function renderSimStockSummary() {
    const sims = SIM_STATE.sims;
    const total = sims.length;
    const inStore = sims.filter(s => s.status === "In Store").length;
    const issued = sims.filter(s => s.status === "Issued").length;
    const outOfService = sims.filter(s => s.status === "Blocked" || s.status === "Retired").length;

    const tiles = [
        { label: "Total SIM Cards", value: total, cls: "" },
        { label: "In Store", value: inStore, cls: "accent-success" },
        { label: "Issued", value: issued, cls: "accent-warning" },
        { label: "Blocked / Retired", value: outOfService, cls: outOfService > 0 ? "accent-danger" : "" },
    ];
    document.getElementById("simStockSummary").innerHTML = tiles.map(t => `
        <div class="stat-card ${t.cls}">
            <div class="stat-value">${t.value}</div>
            <div class="stat-label">${t.label}</div>
        </div>`).join("");
}

/* =============================================================================
   4) ACTIONS DROPDOWN OPEN/CLOSE + ROW ACTION DELEGATION
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

function amsSimCloseAllMenus() {
    amsCloseRowMenus();
}

function amsSimWireRowActions() {
    document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-sim-actions-for]");
        if (trigger) {
            const key = trigger.getAttribute("data-sim-actions-for");
            const menu = document.getElementById(`sim-menu-${key}`);
            const wasOpen = menu.classList.contains("open");
            amsSimCloseAllMenus();
            if (!wasOpen) {
                amsOpenRowMenu(trigger, menu);
            }
            return;
        }
        if (!e.target.closest(".actions-menu")) amsSimCloseAllMenus();
    });

    document.addEventListener("click", (e) => {
        const viewLink = e.target.closest("[data-sim-view-key]");
        if (viewLink) { e.preventDefault(); amsSimOpenViewModal(viewLink.getAttribute("data-sim-view-key")); return; }

        const btn = e.target.closest("[data-sim-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-sim-action");
        const key = btn.getAttribute("data-key");
        amsSimCloseAllMenus();

        if (action === "view") amsSimOpenViewModal(key);
        else if (action === "edit") amsSimOpenEditModal(key);
        else if (action === "assign") amsSimOpenAssignModal(key, "assign");
        else if (action === "editAssign") amsSimOpenAssignModal(key, "edit");
        else if (action === "reassign") amsSimOpenAssignModal(key, "reassign");
        else if (action === "return") amsSimReturn(key);
        else if (action === "block") amsSimBlock(key);
        else if (action === "retire") amsSimRetire(key);
        else if (action === "printIssue") amsPrintSimIssueForm(key);
    });
}

/* =============================================================================
   5) MODAL OPEN / CLOSE HELPERS
   ===========================================================================*/
function amsSimOpenModal(id) { document.getElementById(id).classList.add("open"); }
function amsSimCloseModal(id) { document.getElementById(id).classList.remove("open"); }

/* =============================================================================
   6) ADD / EDIT FORM
   ===========================================================================*/
function amsPopulateSimFormSelects() {
    document.getElementById("fSimStatus").innerHTML = AMS_SIM_STATUS_OPTIONS.map(s => `<option value="${amsEsc(s)}">${amsEsc(s)}</option>`).join("");
    document.getElementById("simOperatorList").innerHTML = amsGetActiveSimOperatorNames().map(o => `<option value="${amsEsc(o)}"></option>`).join("");
    document.getElementById("simPlanList").innerHTML = amsGetActiveSimPlanNames().map(p => `<option value="${amsEsc(p)}"></option>`).join("");
    amsPopulateSimSiteSelect(document.getElementById("fSimSite"));
}

function amsSimUpdateIdPreview() {
    document.getElementById("simIdPreview").textContent = SIM_STATE.editingId || amsNextSimId();
}

function amsSimOpenAddModal() {
    SIM_STATE.editingId = null;
    document.getElementById("simFormModalTitle").textContent = "Add SIM Card";
    document.getElementById("simForm").reset();
    amsPopulateSimFormSelects();
    document.getElementById("fSimStatus").value = "In Store";
    amsSimUpdateIdPreview();
    amsSimOpenModal("modalSimForm");
}

function amsSimOpenEditModal(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    SIM_STATE.editingId = key;
    document.getElementById("simFormModalTitle").textContent = "Edit SIM Card";
    amsPopulateSimFormSelects();

    document.getElementById("fSimIccid").value = s.iccid || "";
    document.getElementById("fSimMobile").value = s.mobileNumber || "";
    document.getElementById("fSimOperator").value = s.operator || "";
    document.getElementById("fSimPlan").value = s.plan || "";
    document.getElementById("fSimStatus").value = s.status;
    document.getElementById("fSimSite").value = s.site || "";
    document.getElementById("fSimActivationDate").value = s.activationDate || "";
    amsSetVendorSelectValue("fSimVendor", s.vendor || "");
    document.getElementById("fSimCost").value = s.cost || "";
    document.getElementById("fSimRemarks").value = s.remarks || "";
    amsSimUpdateIdPreview();
    amsSimOpenModal("modalSimForm");
}

function amsSimSubmitForm(e) {
    e.preventDefault();
    if (typeof amsGuardViewOnlyWrite === "function" && amsGuardViewOnlyWrite()) return;
    const mobile = document.getElementById("fSimMobile").value.trim();
    if (!mobile) { alert("Mobile Number is required."); return; }

    const values = {
        iccid: document.getElementById("fSimIccid").value.trim(),
        mobileNumber: mobile,
        operator: document.getElementById("fSimOperator").value.trim(),
        plan: document.getElementById("fSimPlan").value.trim(),
        activationDate: document.getElementById("fSimActivationDate").value,
        vendor: document.getElementById("fSimVendor").value.trim(),
        cost: document.getElementById("fSimCost").value.trim(),
        remarks: document.getElementById("fSimRemarks").value.trim(),
        site: (document.getElementById("fSimSite") || {}).value || "",
    };
    const statusVal = document.getElementById("fSimStatus").value;

    /* A new Operator / Plan typed on the form is registered into its master
       automatically, so it shows up in the SIM Operator / SIM Plan Masters and
       as a suggestion next time (same pattern as departments/designations). */
    if (values.operator) amsEnsureSimOperator(values.operator);
    if (values.plan) amsEnsureSimPlan(values.plan);
    amsPopulateSimFormSelects();

    if (SIM_STATE.editingId) {
        const s = SIM_STATE.sims.find(x => x.simId === SIM_STATE.editingId);
        if (!s) return;
        const prevNumber = s.mobileNumber;
        Object.assign(s, values);
        s.status = statusVal;
        if (statusVal === "Retired") {
            s.assignedTo = null; s.assignedDate = "";
            if (amsSimUnlinkFromMobile(s)) amsDbSaveAsync("mobiles");
        } else if (s.linkedMobileId && !s.personalMobile && prevNumber !== s.mobileNumber) {
            const m = amsSimFindMobileById(s.linkedMobileId);
            if (m && String(m.simMobileNo || "0") === String(prevNumber || "")) {
                m.simMobileNo = s.mobileNumber || "0";
                amsDbSaveAsync("mobiles");
            }
        }
        amsNotify(`SIM card updated: ${s.simId}`, "info");
    } else {
        const simId = amsNextSimId();
        const sim = {
            simId,
            ...values,
            status: statusVal,
            assignedTo: null, assignedDate: "",
            linkedMobileId: null, personalMobile: false,
            history: [{ date: new Date().toISOString().slice(0, 10), action: "Added to Inventory", empId: "", empName: "", empDept: "", remarks: "", statusLabel: statusVal }],
        };
        SIM_STATE.sims.push(sim);
        amsNotify(`SIM card added: ${simId} (${sim.mobileNumber})`, "success");
    }

    amsSimCloseModal("modalSimForm");
    amsDbSaveAsync("simCards");
    renderSimTable();
}

/* =============================================================================
   6a) QUICK ADD OPERATOR / PLAN  (from the "+" buttons on the SIM form)
   ----------------------------------------------------------------------------
   Opens a small modal that adds a new Operator / Plan to its master (with the
   master's detail fields) and fills the form field with the new value. The
   master is persisted to SQL so the new value survives navigation and shows up
   in the SIM Operator / SIM Plan Masters under System Admin.
   ===========================================================================*/
function amsSimOpenQuickAdd(kind) {
    SIM_STATE.qaKind = kind;
    const isOperator = kind === "operator";
    document.getElementById("simQuickAddTitle").textContent = isOperator ? "Add SIM Operator" : "Add SIM Plan";
    document.getElementById("simQaName").value = "";
    document.getElementById("simQaName").placeholder = isOperator ? "e.g. Jio, Airtel..." : "e.g. Prepaid, Postpaid...";
    document.getElementById("simQaField2Label").textContent = isOperator ? "Helpline / Customer Care" : "Plan Type";
    document.getElementById("simQaField2").value = "";
    document.getElementById("simQaField3Label").textContent = isOperator ? "Website" : "Description";
    document.getElementById("simQaField3").value = "";
    amsSimOpenModal("modalSimQuickAdd");
}

function amsSimSaveQuickAdd() {
    const isOperator = SIM_STATE.qaKind === "operator";
    const name = document.getElementById("simQaName").value.trim();
    if (!name) { alert(isOperator ? "Enter an Operator name." : "Enter a Plan name."); return; }
    const field2 = document.getElementById("simQaField2").value.trim();
    const field3 = document.getElementById("simQaField3").value.trim();
    const added = isOperator
        ? amsQuickAddSimOperator(name, field2, field3)
        : amsQuickAddSimPlan(name, field2, field3);
    if (!added) { alert(isOperator ? "This Operator already exists in the master." : "This Plan already exists in the master."); return; }
    (isOperator ? document.getElementById("fSimOperator") : document.getElementById("fSimPlan")).value = added;
    amsPopulateSimFormSelects();
    amsNotify(`${isOperator ? "Operator" : "Plan"} added to master: ${added}`, "success");
    amsSimCloseModal("modalSimQuickAdd");
}

/* =============================================================================
   7) VIEW MODAL (details + lifecycle history)
   ===========================================================================*/
function simHistoryEventType(action) {
    if (action.startsWith("Reassigned")) return { label: "Reassign", cls: "badge-amber" };
    if (action === "Assignment updated") return { label: "Edit Issue", cls: "badge-amber" };
    if (action.startsWith("Assigned")) return { label: "Assign", cls: "badge-green" };
    if (action === "Returned") return { label: "Return", cls: "badge-grey" };
    if (action === "Blocked") return { label: "Block", cls: "badge-red" };
    if (action === "Retired") return { label: "Retire", cls: "badge-red" };
    if (action === "Added to Inventory") return { label: "Added", cls: "badge-green" };
    return { label: "Other", cls: "badge-grey" };
}

function amsSimOpenViewModal(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    SIM_STATE.viewKey = key;
    const emp = s.assignedTo ? amsGetEmployeeByAmsId(s.assignedTo) : null;

    const historyRows = (s.history && s.history.length)
        ? s.history.map(h => {
            const evt = simHistoryEventType(h.action);
            return `<tr>
                <td class="mono-cell">${amsFormatDate(h.date) || "-"}</td>
                <td><span class="badge ${evt.cls}">${evt.label}</span></td>
                <td>${amsEsc(h.action)}</td>
                <td>${amsEsc(h.empName) || "-"}</td>
                <td>${amsEsc(h.empDept) || "-"}</td>
                <td>${amsEsc(h.statusLabel) || "-"}</td>
                <td>${amsEsc(h.remarks) || "-"}</td>
            </tr>`;
        }).join("")
        : `<tr><td colspan="7" class="empty-note" style="text-align:center;">No lifecycle events recorded yet</td></tr>`;

    document.getElementById("simViewModalBody").innerHTML = `
        <div class="detail-row"><span class="detail-label">SIM ID</span><span class="detail-value mono-cell">${amsEsc(s.simId)}</span></div>
        <div class="detail-row"><span class="detail-label">SIM Serial / ICCID</span><span class="detail-value mono-cell">${amsEsc(s.iccid) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Mobile Number</span><span class="detail-value mono-cell">${amsEsc(s.mobileNumber) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Operator</span><span class="detail-value">${amsEsc(s.operator) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Plan</span><span class="detail-value">${amsEsc(s.plan) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${amsEsc(s.status)}</span></div>
        <div class="detail-row"><span class="detail-label">Site</span><span class="detail-value">${amsEsc(s.site) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Activation Date</span><span class="detail-value">${amsFormatDate(s.activationDate) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Assigned To</span><span class="detail-value">${emp ? amsEsc(emp.name) + " (" + amsEsc(amsGetEmployeeDisplayId(emp)) + ")" : "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Used In Mobile</span><span class="detail-value">${amsEsc(amsSimUsedInLabel(s))}</span></div>
        <div class="detail-row"><span class="detail-label">Assignment Date</span><span class="detail-value">${amsFormatDate(s.assignedDate) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Vendor</span><span class="detail-value">${amsEsc(s.vendor) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Cost</span><span class="detail-value">${s.cost ? formatCurrency(s.cost) : "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Remarks</span><span class="detail-value">${amsEsc(s.remarks) || "-"}</span></div>

        <div class="card" style="margin-top:14px;">
            <div class="card-title">Lifecycle History</div>
            <div class="table-wrap"><table class="table">
                <thead><tr><th>Date</th><th>Type</th><th>Action</th><th>Emp Name</th><th>Department</th><th>Status</th><th>Remarks</th></tr></thead>
                <tbody>${historyRows}</tbody>
            </table></div>
        </div>`;
    amsSimOpenModal("modalSimView");
}

/* Downloads the SIM card details + lifecycle history shown in the View modal
   as a CSV report (uses the shared amsCsvRow / amsDownloadFile helpers). */
function amsSimDownloadView() {
    const s = SIM_STATE.sims.find(x => x.simId === SIM_STATE.viewKey);
    if (!s) return;
    const emp = s.assignedTo ? amsGetEmployeeByAmsId(s.assignedTo) : null;

    const rows = [["Field", "Value"]];
    const p = (label, value) => rows.push([label, value == null || value === "" ? "-" : value]);
    p("SIM ID", s.simId);
    p("SIM Serial / ICCID", s.iccid);
    p("Mobile Number", s.mobileNumber);
    p("Operator", s.operator);
    p("Plan", s.plan);
    p("Status", s.status);
    p("Site", s.site || "-");
    p("Activation Date", amsFormatDate(s.activationDate));
    p("Assigned To", emp ? `${emp.name} (${amsGetEmployeeDisplayId(emp)})` : "-");
    p("Used In Mobile", amsSimUsedInLabel(s));
    p("Assignment Date", amsFormatDate(s.assignedDate));
    p("Vendor", s.vendor);
    p("Cost", s.cost ? formatCurrency(s.cost) : "-");
    p("Remarks", s.remarks);

    rows.push([]);
    rows.push(["Date", "Type", "Action", "Emp Name", "Department", "Status", "Remarks"]);
    (s.history || []).forEach(h => rows.push([
        amsFormatDate(h.date) || "-",
        simHistoryEventType(h.action).label,
        h.action,
        h.empName || "-",
        h.empDept || "-",
        h.statusLabel || "-",
        h.remarks || "-",
    ]));

    const csv = rows.map(amsCsvRow).join("\r\n");
    amsDownloadFile(csv, `SIM_${s.simId}.csv`, "text/csv;charset=utf-8;");
}

/* =============================================================================
   8) ASSIGN / REASSIGN
   ===========================================================================*/
function amsSimMobilesRef() {
    return (typeof DUMMY_MOBILES !== "undefined" && Array.isArray(DUMMY_MOBILES)) ? DUMMY_MOBILES : [];
}

function amsSimFindMobileById(mobileId) {
    return typeof amsFindMobileByRef === "function" ? amsFindMobileByRef(mobileId) : null;
}

function amsSimMobileHasLinkedSim(mobile, exceptSimId) {
    if (!mobile) return false;
    const simNo = String(mobile.simMobileNo || "0").trim();
    if (simNo && simNo !== "0") {
        const linked = typeof amsFindSimByMobileNumber === "function" ? amsFindSimByMobileNumber(simNo) : null;
        if (linked && linked.simId !== exceptSimId && linked.status !== "Retired") return true;
    }
    return SIM_STATE.sims.some(s =>
        s.simId !== exceptSimId &&
        s.status !== "Retired" &&
        (typeof amsSimMatchesMobile === "function" ? amsSimMatchesMobile(s, mobile) : (s.linkedMobileId === mobile.id && !s.personalMobile))
    );
}

function amsSimAvailableMobiles(exceptSimId) {
    return amsSimMobilesRef().filter(m => {
        if (m.status === "Retired / Scrapped" || m.status === "Not Working" || m.status === "Replaced") return false;
        return !amsSimMobileHasLinkedSim(m, exceptSimId);
    });
}

function amsSimUsedInLabel(s) {
    if (!s) return "-";
    if (s.personalMobile) return "Personal Mobile";
    if (s.linkedMobileId) {
        const m = amsSimFindMobileById(s.linkedMobileId);
        if (m) {
            const mm = (typeof amsAssetMakeModel === "function") ? amsAssetMakeModel(m) : [m.make, m.model].filter(Boolean).join(" ");
            const id = (typeof amsPrintAssetId === "function") ? amsPrintAssetId(m) : (m.displayId || m.id);
            return `${id}${mm ? " · " + mm : ""}`;
        }
        return s.linkedMobileId;
    }
    return "None";
}

function amsSimUnlinkFromMobile(s) {
    return typeof amsUnlinkSimFromMobile === "function" ? amsUnlinkSimFromMobile(s) : false;
}

function amsSimApplyMobileLink(s, choice, empId, assignDate) {
    return typeof amsSyncSimChoiceToMobile === "function"
        ? amsSyncSimChoiceToMobile(s, choice, empId, assignDate)
        : false;
}

function amsSimPopulateEmpDropdown() {
    const activeEmps = simEmployeesRef().filter(e => e.status === "Active");
    document.getElementById("simAssignEmp").innerHTML =
        `<option value="">(Select employee)</option>` +
        activeEmps.map(e => `<option value="${amsEsc(e.empId)}">${amsEsc(e.name)} (${amsEsc(e.dept)})</option>`).join("");
}

function amsSimPopulateMobileDropdown(sim) {
    const sel = document.getElementById("simAssignMobile");
    if (!sel) return;
    const exceptId = sim ? sim.simId : null;
    const currentMobile = sim && sim.linkedMobileId && !sim.personalMobile ? amsSimFindMobileById(sim.linkedMobileId) : null;
    const currentKey = currentMobile && typeof amsMobileStableId === "function" ? amsMobileStableId(currentMobile) : (sim && sim.linkedMobileId ? sim.linkedMobileId : "");
    const mobiles = amsSimAvailableMobiles(exceptId);
    const opts = [`<option value="">None</option>`, `<option value="__personal__">Personal Mobile</option>`];
    const seen = new Set();
    const optionFor = (m) => {
        const key = typeof amsMobileStableId === "function" ? amsMobileStableId(m) : m.id;
        seen.add(key);
        const mm = (typeof amsAssetMakeModel === "function") ? amsAssetMakeModel(m) : [m.make, m.model].filter(Boolean).join(" ");
        const id = (typeof amsPrintAssetId === "function") ? amsPrintAssetId(m) : (m.displayId || m.id);
        const bits = [id];
        if (mm) bits.push(mm);
        if (m.assignedTo) {
            const emp = typeof amsGetEmployeeByAmsId === "function" ? amsGetEmployeeByAmsId(m.assignedTo) : null;
            if (emp) bits.push(emp.name);
        }
        return `<option value="${amsEsc(key)}">${amsEsc(bits.join(" · "))}</option>`;
    };
    mobiles.forEach(m => opts.push(optionFor(m)));
    if (currentKey && !seen.has(currentKey) && currentMobile) opts.push(optionFor(currentMobile));
    sel.innerHTML = opts.join("");
    if (sim && sim.personalMobile) sel.value = "__personal__";
    else if (currentKey) sel.value = currentKey;
    else sel.value = "";
}

function amsSimLastAssignDate(s) {
    if (!s || !Array.isArray(s.history)) return s && s.assignedDate ? s.assignedDate : "";
    for (let i = s.history.length - 1; i >= 0; i--) {
        const act = String(s.history[i].action || "");
        if (act.indexOf("Assigned") === 0 || act.indexOf("Reassigned") === 0 || act === "Assignment updated") {
            return s.history[i].date || "";
        }
    }
    return s.assignedDate || "";
}

function amsSimOpenAssignModal(key, mode) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    SIM_STATE.editingId = key;
    SIM_STATE.assignMode = mode;
    const titles = { reassign: "Reassign SIM Card", edit: "Edit SIM Issue", assign: "Assign SIM Card" };
    document.getElementById("simAssignModalTitle").textContent = titles[mode] || "Assign SIM Card";
    const confirmBtn = document.getElementById("btnSimConfirmAssign");
    if (confirmBtn) confirmBtn.textContent = mode === "edit" ? "Save Changes" : "Confirm";
    amsSimPopulateEmpDropdown();
    amsSimPopulateMobileDropdown(s);
    document.getElementById("simAssignEmp").value = s.assignedTo || "";
    const dateEl = document.getElementById("simAssignDate");
    if (mode === "edit") dateEl.value = amsSimLastAssignDate(s) || new Date().toISOString().slice(0, 10);
    else dateEl.value = new Date().toISOString().slice(0, 10);
    document.getElementById("simAssignRemarks").value = "";
    amsSimOpenModal("modalSimAssign");
}

function amsSimConfirmAssign() {
    const s = SIM_STATE.sims.find(x => x.simId === SIM_STATE.editingId);
    if (!s) return;
    const empId = document.getElementById("simAssignEmp").value;
    const assignDate = document.getElementById("simAssignDate").value || new Date().toISOString().slice(0, 10);
    const remarks = document.getElementById("simAssignRemarks").value.trim();
    const mobileChoice = (document.getElementById("simAssignMobile") || {}).value || "";
    if (!empId) { alert("Select an employee to assign this SIM card to."); return; }

    const emp = amsGetEmployeeByAmsId(empId);
    s.assignedTo = empId;
    s.assignedDate = assignDate;
    s.status = "Issued";
    const mobilesChanged = amsSimApplyMobileLink(s, mobileChoice, empId, assignDate);
    if (!Array.isArray(s.history)) s.history = [];
    const usedIn = amsSimUsedInLabel(s);
    const histRemarks = [remarks, usedIn && usedIn !== "None" ? `Used in: ${usedIn}` : ""].filter(Boolean).join(" | ");
    const mode = SIM_STATE.assignMode;
    const histAction = mode === "reassign" ? "Reassigned" : (mode === "edit" ? "Assignment updated" : "Assigned");
    s.history.push({
        date: assignDate,
        action: histAction,
        empId: emp ? emp.empId : "", empName: emp ? emp.name : "", empDept: emp ? emp.dept : "",
        remarks: histRemarks, statusLabel: "Issued",
    });
    const verb = mode === "reassign" ? "reassigned" : (mode === "edit" ? "issue updated for" : "assigned");
    amsNotify(`SIM card ${s.simId} ${verb} ${emp ? emp.name : empId}`, "success");

    amsSimCloseModal("modalSimAssign");
    amsDbSaveAsync("simCards");
    if (mobilesChanged) amsDbSaveAsync("mobiles");
    renderSimTable();
}

/* =============================================================================
   8a) PRINT SIM CARD ISSUE FORM (Issued SIMs only)
   ===========================================================================*/
function amsSimGenerateFormNo() {
    if (!SIM_STATE.formCounters) SIM_STATE.formCounters = {};
    const seq = (SIM_STATE.formCounters.SIF = (SIM_STATE.formCounters.SIF || 0) + 1);
    return `SIF-${String(seq).padStart(6, "0")}`;
}

function amsPrintSimIssueForm(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s || s.status !== "Issued" || !s.assignedTo) {
        alert("SIM Card Issue Form is only available for SIM cards currently marked Issued.");
        return;
    }
    if (typeof amsPrintDocument !== "function") {
        alert("Print engine is not loaded.");
        return;
    }
    const emp = amsGetEmployeeByAmsId(s.assignedTo);
    if (!emp) return;

    const empId = emp.amsId || emp.empId;
    const simPrint = typeof amsCollectPrintSimsForEmp === "function"
        ? amsCollectPrintSimsForEmp(empId)
        : { direct: getEmployeeSimCards(empId), subordinate: [] };
    const mobilePrint = typeof amsCollectPrintMobilesForEmp === "function"
        ? amsCollectPrintMobilesForEmp(empId)
        : { direct: [], subordinate: [] };
    const assignmentType = typeof amsAssignmentTypeLabel === "function"
        ? amsAssignmentTypeLabel(simPrint.direct.length + mobilePrint.direct.length, simPrint.subordinate.length + mobilePrint.subordinate.length)
        : "Direct";

    const title = "SIM Card Issue Form";
    const formNo = amsSimGenerateFormNo();
    const today = amsFormatDate(new Date().toISOString().slice(0, 10));
    const managerEmp = emp.reportsTo ? amsGetEmployeeByAmsId(emp.reportsTo) : null;
    const managerName = managerEmp ? managerEmp.name : "-";
    const infoBox = (label, value) => `<div class="pf-box"><div class="pf-box-label">${amsEsc(label)}</div><div class="pf-box-value">${value || "&nbsp;"}</div></div>`;

    const terms = [
        "The employee acknowledges receipt of the above SIM card(s) in working condition, unless otherwise stated.",
        "The SIM card(s) remain company property and must be returned upon request, transfer, or exit.",
        "The employee is responsible for the safekeeping and proper use of the SIM card(s).",
        "Any loss, theft, or misuse must be reported to IT/Admin immediately.",
        "This form must be retained for company records and produced upon SIM return or audit.",
    ];

    const headerHtml = typeof amsBuildPrintHeader === "function"
        ? amsBuildPrintHeader(title, `
        <div class="pf-form-title pf-title-issue">${title.toUpperCase()}</div>
        <div><strong>Form No:</strong> ${formNo}</div>
        <div><strong>Date Generated:</strong> ${today}</div>`, "Asset Management System · IT Infrastructure Department")
        : `<div class="pf-header"><div class="pf-form-title">${title}</div></div>`;

    const simSection = typeof amsBuildPrintSimCardsSectionHtml === "function"
        ? amsBuildPrintSimCardsSectionHtml(simPrint.direct, simPrint.subordinate)
        : "";
    const mobileSection = typeof amsBuildPrintMobilesSectionHtml === "function"
        ? amsBuildPrintMobilesSectionHtml(mobilePrint.direct, mobilePrint.subordinate)
        : "";

    const remarksLines = [];
    (simPrint.direct || []).forEach(row => {
        if (row.remarks) remarksLines.push(`<div><strong>${amsEsc(row.simId)} - Remarks (on record):</strong> ${amsEsc(row.remarks)}</div>`);
    });
    if (!remarksLines.length) remarksLines.push(`<div class="pf-notes-empty">No remarks recorded against the SIM card(s) in the system.</div>`);

    const additionalHtml = `
        <div class="pf-additional-box">
            <div class="pf-additional-content"><span class="pf-notes-empty">(Blank - to be filled in writing by IT / HR / Admin, if applicable)</span></div>
            <div class="pf-additional-sign">
                <span>Name &amp; Signature (IT / HR / Admin): _______________________________</span>
                <span>Date: ________________</span>
            </div>
        </div>`;

    const printContent = `
        <div id="printArea">
            ${headerHtml}

            <div class="pf-section-bar">Issued To</div>
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
            </div>

            ${simSection}
            ${mobileSection}

            <div class="pf-section-bar">Remarks / Notes</div>
            <div class="pf-notes-box">${remarksLines.join("")}</div>

            <div class="pf-section-bar pf-bar-accent">Additional Remarks/Notes (IT/HR/Admin)</div>
            ${additionalHtml}

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
                <span>Internal Ref: ${formNo} &middot; ${simPrint.direct.length} SIM(s) issued &middot; ${simPrint.subordinate.length} team${mobilePrint.direct.length || mobilePrint.subordinate.length ? ` &middot; ${mobilePrint.direct.length} mobile(s), ${mobilePrint.subordinate.length} team` : ""}</span>
            </div>
        </div>`;

    amsPrintDocument(printContent, title, "landscape");
}

/* =============================================================================
   9) RETURN / BLOCK / RETIRE
   ===========================================================================*/
function amsSimReturn(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    const prevEmp = s.assignedTo ? amsGetEmployeeByAmsId(s.assignedTo) : null;
    if (!confirm(`Mark "${s.simId}" as Returned (In Store)?`)) return;

    if (!Array.isArray(s.history)) s.history = [];
    s.history.push({
        date: new Date().toISOString().slice(0, 10), action: "Returned",
        empId: prevEmp ? prevEmp.empId : "", empName: prevEmp ? prevEmp.name : "", empDept: prevEmp ? prevEmp.dept : "",
        remarks: "", statusLabel: "In Store",
    });
    s.assignedTo = null; s.assignedDate = ""; s.status = "In Store";
    const mobilesChanged = amsSimUnlinkFromMobile(s);
    amsNotify(`SIM card returned: ${s.simId}${prevEmp ? ` (from ${prevEmp.name})` : ""}`, "info");
    amsDbSaveAsync("simCards");
    if (mobilesChanged) amsDbSaveAsync("mobiles");
    renderSimTable();
}

function amsSimBlock(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    if (!confirm(`Block "${s.simId}"? The SIM stays on record but is unusable until unblocked.`)) return;

    if (!Array.isArray(s.history)) s.history = [];
    s.history.push({
        date: new Date().toISOString().slice(0, 10), action: "Blocked",
        empId: "", empName: "", empDept: "",
        remarks: "", statusLabel: "Blocked",
    });
    s.status = "Blocked";
    amsNotify(`SIM card blocked: ${s.simId}`, "warning");
    amsDbSaveAsync("simCards");
    renderSimTable();
}

function amsSimRetire(key) {
    const s = SIM_STATE.sims.find(x => x.simId === key);
    if (!s) return;
    if (!confirm(`Retire "${s.simId}"? This normally ends its lifecycle.`)) return;

    if (!Array.isArray(s.history)) s.history = [];
    s.history.push({
        date: new Date().toISOString().slice(0, 10), action: "Retired",
        empId: "", empName: "", empDept: "",
        remarks: "", statusLabel: "Retired",
    });
    s.assignedTo = null; s.assignedDate = ""; s.status = "Retired";
    const mobilesChanged = amsSimUnlinkFromMobile(s);
    amsNotify(`SIM card retired: ${s.simId}`, "info");
    amsDbSaveAsync("simCards");
    if (mobilesChanged) amsDbSaveAsync("mobiles");
    renderSimTable();
}

/* =============================================================================
   10) CSV : TEMPLATE / EXPORT / IMPORT
   ===========================================================================*/
const SIM_CSV_HEADERS = ["simId", "iccid", "mobileNumber*", "operator", "plan", "status", "site", "activationDate", "vendor", "cost", "remarks"];

function amsDownloadSimTemplate() {
    const sample = ["", "8991XXXXX", "9876543210", "Jio", "Postpaid", "In Store", "", "13-07-2026", "", "", "Example row - delete before importing"];
    amsWriteWorkbook("SIM_Cards_import_template.xlsx", [
        { name: "Instructions", cols: [{ wch: 90 }], aoa: [
            ["SIM Card Import Template - Instructions"],
            ["Fields marked with * are required: mobileNumber."],
            ["simId blank = auto-generated."],
            ["status = In Store, Issued, Blocked or Retired (default In Store)."],
            ["site = a Site Master name (optional)."],
            ["activationDate format dd-mm-yyyy."],
        ] },
        { name: "Template", aoa: [SIM_CSV_HEADERS, sample] },
    ]);
}

function amsExportSims() {
    const source = typeof amsFilterRows === "function"
        ? amsFilterRows("simTable", amsToolbarFilteredSims(), amsSimTableGetters())
        : amsToolbarFilteredSims();
    const rows = source.map(s => [
        s.simId, s.iccid || "", s.mobileNumber || "", s.operator || "", s.plan || "",
        s.status, s.site || "", amsFormatDate(s.activationDate), s.vendor || "", s.cost || "", s.remarks || "",
    ]);
    amsExportXlsx("SIM_Cards_export", SIM_CSV_HEADERS, rows);
}

function amsSimShowImportSummary(results) {
    const banner = document.getElementById("simImportBanner");
    if (banner) {
        banner.style.display = "block";
        const added = results.filter(r => r.result === "added").length;
        const updated = results.filter(r => r.result === "updated").length;
        const skipped = results.filter(r => r.result === "skipped").length;
        const errors = results.filter(r => r.result === "error").length;
        banner.textContent =
            `Import complete: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} error(s). Skipped/error reasons are listed in the report.`;
    }
    amsShowImportReport(results);
}

function amsImportSimsFile(file) {
    amsReadImportRows(file).then((rows) => {
        rows = rows.filter(r => !(r[0] || "").trim().startsWith("#")); /* drop instruction/comment lines */
        if (!rows.length) { alert("File is empty or unreadable."); return; }
        const headers = rows[0].map(h => h.trim().replace(/\*$/, "")); /* strip the required-marker * */
        const results = [];
        const seenSimIds = new Set(); /* within-file duplicate detection (simId is the DB natural key) */
        let mobilesChanged = false;

        if (typeof amsDbSuspendSaves === "function") amsDbSuspendSaves();
        try {
        for (let i = 1; i < rows.length; i++) {
            const raw = rows[i];
            if (!raw.length || raw.every(c => !c)) continue;
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = raw[idx] !== undefined ? raw[idx].trim() : ""; });
            const line = i + 1;
            const record = obj.simId || obj.mobileNumber || "(unnamed)";

            if (!obj.mobileNumber) {
                results.push({ row: line, record, result: "error", reason: "Missing required field: mobileNumber" });
                continue;
            }

            /* ---- Within-file duplicate detection on the identity field ---- */
            if (obj.simId) {
                const simKey = obj.simId.toLowerCase();
                if (seenSimIds.has(simKey)) {
                    results.push({ row: line, record, result: "error", reason: `Duplicate simId "${obj.simId}" already used earlier in this file` });
                    continue;
                }
                seenSimIds.add(simKey);
            }

            const status = AMS_SIM_STATUS_OPTIONS.includes(obj.status) ? obj.status : "In Store";

            const existing = obj.simId
                ? SIM_STATE.sims.find(s => s.simId === obj.simId)
                : SIM_STATE.sims.find(s => (s.mobileNumber || "") === obj.mobileNumber);
            if (existing) {
                Object.assign(existing, {
                    iccid: obj.iccid, mobileNumber: obj.mobileNumber, operator: obj.operator, plan: obj.plan,
                    site: obj.site || "",
                    activationDate: obj.activationDate ? amsParseDMY(obj.activationDate) : existing.activationDate,
                    vendor: obj.vendor, cost: obj.cost, remarks: obj.remarks,
                });
                if (status === "Retired") {
                    existing.assignedTo = null; existing.assignedDate = "";
                    if (amsSimUnlinkFromMobile(existing)) mobilesChanged = true;
                }
                existing.status = status;
                results.push({ row: line, record, result: "updated", reason: "Existing SIM card updated" });
            } else {
                const simId = obj.simId || amsNextSimId();
                const sim = {
                    simId,
                    iccid: obj.iccid || "",
                    mobileNumber: obj.mobileNumber,
                    operator: obj.operator || "",
                    plan: obj.plan || "",
                    status,
                    site: obj.site || "",
                    activationDate: obj.activationDate ? amsParseDMY(obj.activationDate) : "",
                    vendor: obj.vendor || "",
                    cost: obj.cost || "",
                    remarks: obj.remarks || "",
                    assignedTo: null, assignedDate: "",
                    linkedMobileId: null, personalMobile: false,
                    history: [{ date: new Date().toISOString().slice(0, 10), action: "Added to Inventory (Import)", empId: "", empName: "", empDept: "", remarks: "", statusLabel: status }],
                };
                SIM_STATE.sims.push(sim);
                results.push({ row: line, record, result: "added", reason: "New SIM card added" });
            }
        }
        } finally {
            if (typeof amsDbResumeSaves === "function") amsDbResumeSaves();
        }

        renderSimTable();
        amsDbSaveAsync("simCards"); /* persist the imported/updated rows (wholesale PUT) */
        if (mobilesChanged) amsDbSaveAsync("mobiles");
        amsSimShowImportSummary(results);
        const fileInput = document.getElementById("simImportFileInput");
        if (fileInput) fileInput.value = "";
    }).catch((err) => {
        alert("Could not read import file: " + (err && err.message ? err.message : err));
    });
}

/* =============================================================================
   11) PAGE INIT
   ===========================================================================*/
async function initSimCards() {
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();
    amsSortRegisterRenderer("simTable", renderSimTable);
    amsPopulateSimFormSelects();
    renderSimTable();

    /* Toolbar */
    document.getElementById("simSearchBox").addEventListener("input", renderSimTable);
    ["simStatusFilter", "simSiteFilter"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", renderSimTable);
    });
    const simClear = document.getElementById("btnSimClearFilters");
    if (simClear) simClear.addEventListener("click", () => amsFilterClearAndRender("simTable"));
    document.getElementById("btnAddSim").addEventListener("click", amsSimOpenAddModal);
    document.getElementById("btnSimExport").addEventListener("click", amsExportSims);
    document.getElementById("btnSimTemplate").addEventListener("click", amsDownloadSimTemplate);
    document.getElementById("btnSimImport").addEventListener("click", () => document.getElementById("simImportFileInput").click());
    document.getElementById("simImportFileInput").addEventListener("change", (e) => {
        if (e.target.files[0]) amsImportSimsFile(e.target.files[0]);
    });

    /* Row actions + dropdowns */
    amsSimWireRowActions();

    /* Add/Edit form */
    document.getElementById("simForm").addEventListener("submit", amsSimSubmitForm);

    /* Quick-add Operator / Plan on the form */
    document.getElementById("btnSimQaOperator").addEventListener("click", () => amsSimOpenQuickAdd("operator"));
    document.getElementById("btnSimQaPlan").addEventListener("click", () => amsSimOpenQuickAdd("plan"));
    document.getElementById("btnSimQaSave").addEventListener("click", amsSimSaveQuickAdd);

    /* Assign/Reassign */
    document.getElementById("btnSimConfirmAssign").addEventListener("click", amsSimConfirmAssign);

    /* Detail report download (View modal) */
    document.getElementById("btnSimViewCsv").addEventListener("click", amsSimDownloadView);

    /* Close buttons inside modals + clicking the dark overlay */
    document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => amsSimCloseModal(btn.getAttribute("data-close"))));
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) amsSimCloseModal(overlay.id);
        });
    });
}

/*------------------------------------------------------------------------------
#-------------- End of the code : SIM CARD MASTER PAGE LOGIC -------------------
#------------------------------------------------------------------------------*/
