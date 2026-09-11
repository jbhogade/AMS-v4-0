/*==============================================================================
#-------------- Start Code for : CONSUMABLE MASTER (consumables.js) -------------
#
#  PURPOSE   : Drives the Consumable Master page. Consumables are the
#              "config + row-actions only" kind of master - the CRUD table,
#              Add/Edit modal, search, import/export/template all come from the
#              generic engine (js/master-table.js) via the AMS_MASTER_CONFIG
#              below. This file adds the three consumable-specific row actions:
#
#                1. Restock        - add stock to ONE consumable row (+ log)
#                2. Used / Assign  - record usage against ONE row (+ log)
#                3. Restock Report / Assign-Used Report - movement log scoped
#                   to whichever consumable row was clicked
#
#  DATA      : Reads + writes AMS_DUMMY_CONSUMABLES / AMS_DUMMY_CONSUMABLE_LOG
#              in dummy-data.js. When SQL Server arrives, replace the data
#              calls with API calls that return the same shapes.
#------------------------------------------------------------------------------*/

/* ---- This page's master config (consumed by js/master-table.js) ------------- */
window.AMS_MASTER_CONFIG = {
    pageTitle: "Consumable Master",
    pageSub: "Manage consumable items and per-site stock levels",
    dataArray: AMS_DUMMY_CONSUMABLES,
    idKey: "consumableId",
    /* Name alone isn't unique - the same item can have a separate stock row per
       Site, so the real identifier is an auto-generated ID, matched on import by
       Name+Site instead. */
    autoIdField: "consumableId",
    autoIdGenerate: () => `CNS-${String(AMS_DUMMY_CONSUMABLES.length + 1).padStart(6, "0")}`,
    importMatchKeys: ["name", "site"],
    fields: [
        { key: "name", label: "Consumable Name", required: true },
        { key: "category", label: "Category", required: true, type: "select",
            optionsFrom: () => amsGetActiveConsumableCategoryNames(),
            quickAdd: { fields: [{ key: "name", label: "New Category Name" }, { key: "description", label: "Description (optional)" }],
                onAdd: (v) => {
                    if (!v.name) { alert("Enter a Category name."); return null; }
                    const added = amsQuickAddConsumableCategory(v.name, v.description);
                    if (!added) { alert("This Category already exists."); return null; }
                    return added;
                } } },
        { key: "unit", label: "Unit of Measure", required: true, type: "select",
            optionsFrom: () => amsGetActiveConsumableUnitNames(),
            quickAdd: { fields: [{ key: "name", label: "New Unit Name" }, { key: "description", label: "Description (optional)" }],
                onAdd: (v) => {
                    if (!v.name) { alert("Enter a Unit name."); return null; }
                    const added = amsQuickAddConsumableUnit(v.name, v.description);
                    if (!added) { alert("This Unit already exists."); return null; }
                    return added;
                } } },
        { key: "site", label: "Site", required: true, type: "select",
            optionsFrom: () => AMS_DUMMY_SITES.filter(s => s.active).map(s => s.name),
            quickAdd: { fields: [{ key: "name", label: "New Site Name" }, { key: "shortform", label: "Shortform (for Asset ID)", upper: true, maxLength: 4 }],
                onAdd: (v) => {
                    if (!v.name || !v.shortform) { alert("Enter both Site Name and Shortform."); return null; }
                    if (AMS_DUMMY_SITES.some(s => s.name.toLowerCase() === v.name.toLowerCase())) { alert("This Site already exists."); return null; }
                    AMS_DUMMY_SITES.push({ name: v.name, shortform: v.shortform.toUpperCase(), address: "", active: true });
                    return v.name;
                } } },
        { key: "qty", label: "Current Stock Quantity", required: true, type: "number", min: 0 },
        { key: "reorderLevel", label: "Reorder Level", required: true, type: "number", min: 0 },
        { key: "restockDate", label: "Last Restocked Date", type: "date" },
        { key: "warrantyDate", label: "Warranty End Date", type: "date" },
        { key: "unitCost", label: "Unit Cost", type: "number", min: 0, step: "0.01", format: (v) => formatCurrency(v) },
        { key: "vendor", label: "Vendor", type: "select", includeBlank: true,
            optionsFrom: () => amsGetActiveVendorNames(),
            quickAdd: { fields: [
                { key: "name", label: "New Vendor Name" },
                { key: "contactPerson", label: "Contact Person" },
                { key: "phone", label: "Phone" },
                { key: "email", label: "Email" },
                { key: "city", label: "City" },
            ],
                onAdd: (v) => {
                    if (!v.name) { alert("Enter a Vendor name."); return null; }
                    if (AMS_DUMMY_VENDORS.some(x => x.name.toLowerCase() === v.name.toLowerCase())) { alert("This Vendor already exists."); return null; }
                    AMS_DUMMY_VENDORS.push({
                        vendorId: "VEN-" + String(++AMS_VENDOR_SEQ).padStart(6, "0"),
                        name: v.name, contactPerson: v.contactPerson, phone: v.phone,
                        email: v.email, city: v.city, category: "All", gstin: "", remarks: "", active: true,
                    });
                    return v.name;
                } } },
        { key: "remarks", label: "Remarks", multiline: true },
    ],
    /* Flags rows at / under their reorder level (same logic the dashboard's
       low-stock widget already uses) */
    rowBadge: (item) => Number(item.qty) <= Number(item.reorderLevel)
        ? `<span class="badge badge-red">Low Stock</span>`
        : `<span class="badge badge-green">OK</span>`,
    rowBadgeLabel: "Stock Status",
    rowActions: [
        { key: "restock", label: "Restock", handler: (item) => amsOpenRestockModal(item) },
        { key: "used", label: "Used / Assign", handler: (item) => amsOpenUsedModal(item) },
        { key: "restockReport", label: "Restock Report", handler: (item) => amsOpenStockReport(item, "Restocked") },
        { key: "usedReport", label: "Assign/Used Report", handler: (item) => amsOpenStockReport(item, "Used") },
    ],
};

/* ---- STATE ------------------------------------------------------------------ */
let amsCurrentStockItem = null;   /* the consumable row being restocked / used  */

/* =============================================================================
   RESTOCK MODAL  (adds stock to ONE specific consumable row)
   ===========================================================================*/
function amsOpenRestockModal(item) {
    amsCurrentStockItem = item;
    document.getElementById("restockItemLabel").textContent = `${item.name} - ${item.site} (Current Qty: ${item.qty})`;
    document.getElementById("restockQty").value = "";
    document.getElementById("restockDate").value = new Date().toISOString().slice(0, 10);
    amsPopulateVendorSelects();
    amsSetVendorSelectValue("restockVendor", item.vendor || "");
    document.getElementById("restockRemarks").value = "";
    document.getElementById("modalRestock").classList.add("open");
}

function amsConfirmRestock() {
    const qty = parseInt(document.getElementById("restockQty").value, 10);
    const date = document.getElementById("restockDate").value;
    const vendor = document.getElementById("restockVendor").value.trim();
    const remarks = document.getElementById("restockRemarks").value.trim();

    if (!qty || qty <= 0) { alert("Enter a valid quantity."); return; }
    if (!date) { alert("Select a Restock/Purchase Date."); return; }

    const item = amsCurrentStockItem;
    item.qty = Number(item.qty) + qty;
    item.restockDate = date;
    if (vendor) item.vendor = vendor;

    AMS_DUMMY_CONSUMABLE_LOG.unshift({
        date, consumableId: item.consumableId, name: item.name, site: item.site,
        type: "Restocked", qty, by: vendor, remarks,
    });

    amsToast(`Restocked: +${qty} x ${item.name} (${item.site})`, "success");
    document.getElementById("modalRestock").classList.remove("open");
    amsDbSaveAsync("consumables");
    amsDbSaveAsync("consumableLog");
    amsRenderMasterTable();
}

/* =============================================================================
   USED / ASSIGN MODAL  (records usage against ONE specific consumable row)
   ===========================================================================*/
function amsOpenUsedModal(item) {
    amsCurrentStockItem = item;
    document.getElementById("usedItemLabel").textContent = `${item.name} - ${item.site} (Current Qty: ${item.qty})`;

    const empSelect = document.getElementById("usedEmployee");
    empSelect.innerHTML = `<option value="">None</option>` +
        DUMMY_EMPLOYEES.filter(e => e.status === "Active")
            .map(e => `<option value="${e.amsId}">${amsEsc(getEmployeeFullName(e))} (${amsEsc(e.department)})</option>`).join("");

    const deptSelect = document.getElementById("usedDepartment");
    deptSelect.innerHTML = `<option value="">None</option>` +
        AMS_DUMMY_DEPARTMENTS.map(d => `<option value="${amsEsc(d.name)}">${amsEsc(d.name)}</option>`).join("");

    document.getElementById("usedQty").value = "";
    document.getElementById("usedDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("usedRemarks").value = "";
    document.getElementById("modalUsed").classList.add("open");
}

function amsConfirmUsed() {
    const qty = parseInt(document.getElementById("usedQty").value, 10);
    const date = document.getElementById("usedDate").value;
    const empId = document.getElementById("usedEmployee").value;
    const dept = document.getElementById("usedDepartment").value;
    const remarks = document.getElementById("usedRemarks").value.trim();

    if (!qty || qty <= 0) { alert("Enter a valid quantity."); return; }
    if (!date) { alert("Select a date."); return; }

    const item = amsCurrentStockItem;
    if (qty > Number(item.qty)) { alert(`Only ${item.qty} in stock - cannot mark ${qty} as used.`); return; }
    item.qty = Number(item.qty) - qty;

    /* Employee (if selected) takes precedence for display; falls back to
       Department-only use; both are independently optional. */
    const emp = empId ? findEmployee(empId) : null;
    const usedByParts = [];
    if (emp) usedByParts.push(`${getEmployeeFullName(emp)} (${emp.department})`);
    if (dept) usedByParts.push(emp ? `Dept: ${dept}` : `${dept} (Department Use)`);

    AMS_DUMMY_CONSUMABLE_LOG.unshift({
        date, consumableId: item.consumableId, name: item.name, site: item.site,
        type: "Used", qty, by: usedByParts.join(", "), remarks,
    });

    amsToast(`Used: ${qty} x ${item.name} (${item.site})`, "info");
    document.getElementById("modalUsed").classList.remove("open");
    amsDbSaveAsync("consumables");
    amsDbSaveAsync("consumableLog");
    amsRenderMasterTable();
}

/* =============================================================================
   RESTOCK / ASSIGN-USED REPORT  (movement log scoped to the clicked row)
   ===========================================================================*/
function amsOpenStockReport(item, type) {
    document.getElementById("stockReportTitle").textContent =
        `${type === "Restocked" ? "Restock Report" : "Assign / Used Report"} - ${item.name} (${item.site})`;
    const entries = AMS_DUMMY_CONSUMABLE_LOG.filter(l => l.type === type && l.consumableId === item.consumableId);

    const rows = entries.length
        ? entries.map(l => `<tr>
            <td class="mono">${amsFormatDate(l.date)}</td>
            <td class="mono">${l.qty}</td>
            <td>${amsEsc(l.by) || "-"}</td>
            <td>${amsEsc(l.remarks) || "-"}</td>
        </tr>`).join("")
        : `<tr><td colspan="4" style="color:var(--text-muted)">No ${type === "Restocked" ? "restock" : "usage"} records yet for this consumable</td></tr>`;

    document.getElementById("stockReportBody").innerHTML = `
        <table class="table">
            <thead><tr><th>Date</th><th>Qty</th><th>${type === "Restocked" ? "Vendor" : "Used By"}</th><th>Remarks</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    document.getElementById("modalStockReport").classList.add("open");
}

/* =============================================================================
   PAGE INIT
   ===========================================================================*/
async function initConsumables() {
    initLayout("consumables");
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();

    document.getElementById("btnConfirmRestock").addEventListener("click", amsConfirmRestock);
    document.getElementById("btnConfirmUsed").addEventListener("click", amsConfirmUsed);
}

document.addEventListener("DOMContentLoaded", () => {
    /* Master table engine wires itself on DOMContentLoaded too - the config
       (window.AMS_MASTER_CONFIG) is already set above, so amsRenderMasterTable
       renders the consumable rows with the row badge + row actions. */
    initConsumables();
});

/*------------------------------------------------------------------------------
#-------------- End of the code : CONSUMABLE MASTER ----------------------------
#------------------------------------------------------------------------------*/
