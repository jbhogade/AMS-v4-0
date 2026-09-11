/*==============================================================================
#-------------- Start Code for : SYSTEM ADMIN MASTER (system-admin.js) ----------
#
#  PURPOSE   : All logic for System Administrator Master - a hub page that
#              embeds the "lookup style" master pages (Company, Asset Type,
#              Asset Category, Asset Make, Site, Department, Designation,
#              Accessory) as tabs, each rendered in an iframe with ?embed=1 so
#              the embedded page hides its own sidebar/topbar (see
#              js/embed-mode.js + css/embed-mode.css).
#              These pages are NOT linked from the main sidebar anymore - this
#              hub is their only entry point (per project convention: no page
#              duplicates CRUD logic - reusing the exact same files here, not
#              rebuilding their tables from scratch).
#
#  WHY AN IFRAME (not a rebuilt in-page config): each of these pages already
#              works standalone with its own AMS_MASTER_CONFIG + the shared
#              master-table.js engine (or, for Company Master, its own form).
#              Iframing them means zero duplicated CRUD logic and zero risk of
#              drifting out of sync with the standalone versions.
#------------------------------------------------------------------------------*/

/*-------------- Start Code for TAB -> PAGE MAP --------------------------------*/
const AMS_ADMIN_TABS = {
    company:       "company.html",
    assetType:     "masters.html?type=asset-type",
    assetCategory: "masters.html?type=asset-category",
    assetMake:     "masters.html?type=asset-make",
    site:          "masters.html?type=site",
    department:    "masters.html?type=department",
    designation:   "masters.html?type=designation",
    accessory:     "accessories.html",
    vendors:       "vendors.html",
    simOperator:        "masters.html?type=sim-operator",
    simPlan:            "masters.html?type=sim-plan",
    consumableCategory: "masters.html?type=consumable-category",
    unitOfMeasure:      "masters.html?type=unit-of-measure",
    sparePartCategory:  "masters.html?type=spare-part-category",
    vendorCategory:     "masters.html?type=vendor-category",
    accessRights:  "access-rights.html",
    roleAccess:    "role-access.html",
    log:           "log-report.html",
};
/*-------------- End of the code ----------------------------------------------*/

/*-------------- Start Code for TAB SWITCHING (lazy-loads the iframe - each
   switch re-navigates the iframe, so the embedded page's own dummy-data
   clone is always fresh, consistent with this project's no-shared-backend /
   fresh-clone-per-page-load model) -----------------------------------------*/
function amsLoadAdminTab(tabKey) {
    const page = AMS_ADMIN_TABS[tabKey];
    if (!page) return;
    document.querySelectorAll(".admin-tab").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-admin-tab") === tabKey);
    });
    document.getElementById("adminFrame").src = `${page}${page.includes("?") ? "&" : "?"}embed=1`;
}

async function initSystemAdmin() {
    initLayout("system-admin");
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();

    document.querySelectorAll(".admin-tab").forEach(btn => {
        btn.addEventListener("click", () => amsLoadAdminTab(btn.getAttribute("data-admin-tab")));
    });

    /* Hide tabs the signed-in user cannot use. Role floors still apply
       (Access Rights / Role Access = Supreme Root only, Log = Super Root+),
       and per-user Access Rights assignments apply even to Supreme Root. */
    let firstVisible = null;
    document.querySelectorAll(".admin-tab").forEach(btn => {
        const key = btn.getAttribute("data-admin-tab");
        const allowed = (typeof amsUserCanAccessPage === "function")
            ? amsUserCanAccessPage(key)
            : true;
        btn.style.display = allowed ? "" : "none";
        if (allowed && !firstVisible) firstVisible = key;
    });

    amsLoadAdminTab(firstVisible || "company");
}

document.addEventListener("DOMContentLoaded", initSystemAdmin);
/*-------------- End of the code ----------------------------------------------*/
/*==============================================================================
#-------------- End of the code : SYSTEM ADMIN MASTER ---------------------------
#------------------------------------------------------------------------------*/
