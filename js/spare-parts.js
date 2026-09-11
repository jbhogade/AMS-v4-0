/*==============================================================================
#-------------- Start Code for : SPARE PARTS MASTER (spare-parts.js) ------------
#
#  PURPOSE   : Drives the Spare Parts Master page. Like the Consumable Master,
#              the CRUD table, Add/Edit modal, search, import/export/template
#              all come from the generic engine (js/master-table.js) via the
#              AMS_MASTER_CONFIG below. This file adds the spare-part-specific
#              row actions:
#
#                1. Restock        - add stock to ONE spare part row (+ log)
#                2. Used / Assign  - record usage against ONE row, optionally
#                                    linked to the asset it was fitted on
#                                    (+ log)
#                3. Restock Report / Assign-Used Report - movement log scoped
#                   to whichever part row was clicked
#
#  DATA      : Reads + writes AMS_DUMMY_SPARE_PARTS / AMS_DUMMY_SPAREPART_LOG
#              in dummy-data.js. When SQL Server arrives, replace the data
#              calls with API calls that return the same shapes.
#------------------------------------------------------------------------------*/

/* ---- This page's master config (consumed by js/master-table.js) ------------- */
window.AMS_MASTER_CONFIG = {
    pageTitle: "Spare Parts Master",
    pageSub: "Manage spare/repair parts for assets and per-site stock levels",
    dataArray: AMS_DUMMY_SPARE_PARTS,
    idKey: "partId",
    /* Name alone isn't unique - the same part can have a separate stock row per
       Site, so the real identifier is an auto-generated ID, matched on import
       by Name+AssetType+Site instead. */
    autoIdField: "partId",
    autoIdGenerate: () => `SP-${String(AMS_DUMMY_SPARE_PARTS.length + 1).padStart(6, "0")}`,
    importMatchKeys: ["name", "assetType", "site"],
    fields: [
        { key: "name", label: "Part Name", required: true },
        { key: "assetType", label: "Compatible Asset Type", required: true, type: "select",
            optionsFrom: () => AMS_DUMMY_ASSET_TYPES.filter(t => t.active).map(t => t.name),
            quickAdd: { fields: [
                { key: "name", label: "New Asset Type Name" },
                { key: "shortform", label: "Shortform (for Asset ID)", upper: true, maxLength: 4 },
                { key: "category", label: "Asset Category", type: "select",
                    optionsFrom: () => AMS_DUMMY_ASSET_CATEGORIES.filter(c => c.active).map(c => c.name) },
            ],
                onAdd: (v) => {
                    const added = amsQuickAddAssetType(v.name, v.shortform, v.category);
                    if (!added) { alert("Enter Asset Type Name, Shortform, and Category - or the Type already exists."); return null; }
                    return added;
                } } },
        { key: "category", label: "Category", required: true, type: "select",
            optionsFrom: () => amsGetActiveSparePartCategoryNames(),
            quickAdd: { fields: [{ key: "name", label: "New Category Name" }, { key: "description", label: "Description (optional)" }],
                onAdd: (v) => {
                    if (!v.name) { alert("Enter a Category name."); return null; }
                    const added = amsQuickAddSparePartCategory(v.name, v.description);
                    if (!added) { alert("This Category already exists."); return null; }
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
let amsCurrentStockItem = null;   /* the spare part row being restocked / used */

/* =============================================================================
   RESTOCK MODAL  (adds stock to ONE specific spare part row)
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

    AMS_DUMMY_SPAREPART_LOG.unshift({
        date, partId: item.partId, name: item.name, site: item.site,
        type: "Restocked", qty, by: vendor, remarks,
    });

    amsToast(`Restocked: +${qty} x ${item.name} (${item.site})`, "success");
    document.getElementById("modalRestock").classList.remove("open");
    amsDbSaveAsync("spareParts");
    amsDbSaveAsync("sparePartLog");
    amsRenderMasterTable();
}

/* =============================================================================
   USED / ASSIGN MODAL  (records usage against ONE row, optionally linked to the
   asset the part was fitted on)
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

    /* Compatible assets (matching this part's Asset Type) listed first, then the
       rest. Value = the PERMANENT AMS Asset ID (survives display-ID changes on
       transfer/reassign); the display ID is snapshotted into the log at the time. */
    const compatible = DUMMY_ASSETS.filter(a => a.type === item.assetType && a.status !== "Retired / Scrapped");
    const others = DUMMY_ASSETS.filter(a => a.type !== item.assetType && a.status !== "Retired / Scrapped");
    const assetOptionHtml = a => `<option value="${amsEsc(a.amsAssetId)}">${amsEsc(a.id)} - ${amsEsc(a.type)} ${amsEsc(a.makeModel)} (${amsEsc(a.site)})</option>`;
    document.getElementById("usedForAsset").innerHTML = `<option value="">Not linked to a specific asset</option>`
        + (compatible.length ? `<optgroup label="Compatible (${amsEsc(item.assetType)})">${compatible.map(assetOptionHtml).join("")}</optgroup>` : "")
        + (others.length ? `<optgroup label="Other Assets">${others.map(assetOptionHtml).join("")}</optgroup>` : "");

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
    const assetBaseId = document.getElementById("usedForAsset").value;
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

    /* assetBaseId is the PERMANENT link (survives the asset's Full ID changing
       later via transfer/reassignment); assetIdSnapshot is what the Full ID
       looked like at the time, kept for an accurate historical record. */
    const linkedAsset = assetBaseId ? DUMMY_ASSETS.find(a => a.amsAssetId === assetBaseId) : null;

    AMS_DUMMY_SPAREPART_LOG.unshift({
        date, partId: item.partId, name: item.name, site: item.site,
        type: "Used", qty, by: usedByParts.join(", "), remarks,
        assetBaseId: assetBaseId || "", assetIdSnapshot: linkedAsset ? linkedAsset.id : "",
    });

    amsToast(`Used: ${qty} x ${item.name}${linkedAsset ? ` for ${linkedAsset.id}` : ""} (${item.site})`, "info");
    document.getElementById("modalUsed").classList.remove("open");
    amsDbSaveAsync("spareParts");
    amsDbSaveAsync("sparePartLog");
    amsRenderMasterTable();
}

/* =============================================================================
   RESTOCK / ASSIGN-USED REPORT  (movement log scoped to the clicked row)
   ===========================================================================*/
function amsOpenStockReport(item, type) {
    document.getElementById("stockReportTitle").textContent =
        `${type === "Restocked" ? "Restock Report" : "Assign / Used Report"} - ${item.name} (${item.site})`;
    const entries = AMS_DUMMY_SPAREPART_LOG.filter(l => l.type === type && l.partId === item.partId);
    const showAssetCol = type === "Used";

    const rows = entries.length
        ? entries.map(l => `<tr>
            <td class="mono">${amsFormatDate(l.date)}</td>
            <td class="mono">${l.qty}</td>
            <td>${amsEsc(l.by) || "-"}</td>
            ${showAssetCol ? `<td class="mono">${amsEsc(l.assetIdSnapshot) || "-"}</td>` : ""}
            <td>${amsEsc(l.remarks) || "-"}</td>
        </tr>`).join("")
        : `<tr><td colspan="${showAssetCol ? 5 : 4}" style="color:var(--text-muted)">No ${type === "Restocked" ? "restock" : "usage"} records yet for this spare part</td></tr>`;

    document.getElementById("stockReportBody").innerHTML = `
        <table class="table">
            <thead><tr><th>Date</th><th>Qty</th><th>${type === "Restocked" ? "Vendor" : "Used By"}</th>${showAssetCol ? "<th>Used For Asset</th>" : ""}<th>Remarks</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    document.getElementById("modalStockReport").classList.add("open");
}

/* =============================================================================
   PAGE INIT
   ===========================================================================*/
async function initSpareParts() {
    initLayout("spare-parts");
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();

    document.getElementById("btnConfirmRestock").addEventListener("click", amsConfirmRestock);
    document.getElementById("btnConfirmUsed").addEventListener("click", amsConfirmUsed);
}

document.addEventListener("DOMContentLoaded", () => {
    /* Master table engine wires itself on DOMContentLoaded too - the config
       (window.AMS_MASTER_CONFIG) is already set above, so amsRenderMasterTable
       renders the spare-part rows with the row badge + row actions. */
    initSpareParts();
});

/*------------------------------------------------------------------------------
#-------------- End of the code : SPARE PARTS MASTER ---------------------------
#------------------------------------------------------------------------------*/
