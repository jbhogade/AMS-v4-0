/*==============================================================================
#-------------- Start Code for : MASTER CONFIG REGISTRY (master-configs.js) ----
#
#  PURPOSE   : Each lookup master (Asset Type, Asset Make, Asset Category,
#              Site, Department, Designation) is defined here as a small
#              config object. The generic engine (js/master-table.js) turns
#              any one of these into a full CRUD page automatically.
#
#  HOW IT WORKS :
#    - pages/masters.html reads the "type" query parameter, looks it up in
#      AMS_MASTER_CONFIGS below, assigns it to the global AMS_MASTER_CONFIG,
#      and then master-table.js does the rest.
#    - To add a new master: add one entry here + one sidebar link in layout.js.
#
#  CONFIG SHAPE (see master-table.js for the full documentation) :
#    {
#      pageTitle, pageSub, dataArray, idKey,
#      fields: [ { key, label, required?, upper?, maxLength?, type? } ],
#      usageCount: (item) => number of records using this value
#    }
#------------------------------------------------------------------------------*/

/* ---- Registry: master type (query string) -> config ------------------------ */
const AMS_MASTER_CONFIGS = {
    "asset-type": {
        pageTitle: "Asset Type Master",
        pageSub: "Manage asset types, their shortform codes, and which Asset Category each one belongs to",
        dataArray: AMS_DUMMY_ASSET_TYPES,
        idKey: "name",
        fields: [
            { key: "name",      label: "Asset Type Name",          required: true },
            { key: "shortform", label: "Shortform (for Asset ID)", required: true, upper: true, maxLength: 4 },
            { key: "category", label: "Asset Category", required: true, type: "select",
                optionsFrom: () => AMS_DUMMY_ASSET_CATEGORIES.filter(c => c.active).map(c => c.name),
                quickAdd: { fields: [
                    { key: "name", label: "New Category Name" },
                    { key: "usedOn", label: "Used On", type: "select", options: AMS_CATEGORY_USED_ON },
                ],
                    onAdd: (v) => {
                        const added = amsQuickAddCategory(v.name, v.usedOn || "Both");
                        if (!added) { alert("Enter a Category name - or it may already exist."); return null; }
                        return added;
                    } } },
        ],
        usageCount: (item) => DUMMY_ASSETS.filter(a => a.type === item.name).length
            + DUMMY_MOBILES.filter(a => a.type === item.name).length,
    },

    "asset-make": {
        pageTitle: "Asset Make Master",
        pageSub: "Manage brands / makes and which Asset Type each one applies to",
        dataArray: AMS_DUMMY_ASSET_MAKES,
        idKey: "makeCode",
        autoIdField: "makeCode",
        autoIdGenerate: () => amsNextMakeCode(),
        importMatchKeys: ["name", "assetType"],
        fields: [
            { key: "name", label: "Make Name", required: true },
            { key: "assetType", label: "Asset Type", required: true, type: "select",
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
        ],
        usageCount: (item) => {
            const type = item.assetType || "";
            const name = item.name || "";
            const match = (a) => a.type === type && a.make === name;
            return DUMMY_ASSETS.filter(match).length + DUMMY_MOBILES.filter(match).length;
        },
    },

    "asset-category": {
        pageTitle: "Asset Category Master",
        pageSub: "Broader grouping of assets, and whether each category is used on Assets, Mobiles, or Both",
        dataArray: AMS_DUMMY_ASSET_CATEGORIES,
        idKey: "name",
        fields: [
            { key: "name", label: "Category Name", required: true },
            { key: "usedOn", label: "Used On", required: true, type: "select", options: AMS_CATEGORY_USED_ON },
        ],
        usageCount: (item) => DUMMY_ASSETS.filter(a => a.category === item.name).length
            + DUMMY_MOBILES.filter(a => a.category === item.name).length,
    },

    "site": {
        pageTitle: "Site Master",
        pageSub: "Manage locations / sites and their shortform codes for Smart Asset IDs",
        dataArray: AMS_DUMMY_SITES,
        idKey: "name",
        fields: [
            { key: "name",      label: "Site Name",   required: true },
            { key: "shortform", label: "Shortform (for Asset ID)", required: true, upper: true, maxLength: 4 },
            { key: "address",   label: "Address" },
        ],
    },

    "department": {
        pageTitle: "Department Master",
        pageSub: "Manage departments and the shortform used inside AMS Employee IDs",
        dataArray: AMS_DUMMY_DEPARTMENTS,
        idKey: "name",
        fields: [
            { key: "name",      label: "Department Name", required: true },
            { key: "shortform", label: "Shortform (for Employee ID)", required: true, upper: true, maxLength: 4 },
        ],
        /* Blocks delete while any employee belongs to this department */
        usageCount: (item) => DUMMY_EMPLOYEES.filter(e => e.department === item.name).length,
    },

    "designation": {
        pageTitle: "Designation Master",
        pageSub: "Manage employee designations used in the Employee Master dropdown",
        dataArray: AMS_DESIGNATION_OPTIONS,
        idKey: "name",
        fields: [
            { key: "name", label: "Designation Name", required: true },
        ],
        /* Blocks delete while any employee holds this designation */
        usageCount: (item) => DUMMY_EMPLOYEES.filter(e => e.designation === item.name).length,
    },

    "sim-operator": {
        pageTitle: "SIM Operator Master",
        pageSub: "Manage telecom operators (Jio, Airtel, BSNL, ...) available when adding a SIM Card",
        dataArray: AMS_DUMMY_SIM_OPERATORS,
        idKey: "name",
        fields: [
            { key: "name",     label: "Operator Name",       required: true },
            { key: "helpline", label: "Helpline / Customer Care" },
            { key: "website",  label: "Website" },
        ],
        /* Blocks delete while any SIM card uses this operator */
        usageCount: (item) => AMS_DUMMY_SIM_CARDS.filter(s => s.operator === item.name).length,
    },

    "sim-plan": {
        pageTitle: "SIM Plan Master",
        pageSub: "Manage SIM plans (Prepaid, Postpaid, Corporate, ...) available when adding a SIM Card",
        dataArray: AMS_DUMMY_SIM_PLANS,
        idKey: "name",
        fields: [
            { key: "name",        label: "Plan Name",   required: true },
            { key: "planType",    label: "Plan Type" },
            { key: "description", label: "Description", multiline: true },
        ],
        /* Blocks delete while any SIM card uses this plan */
        usageCount: (item) => AMS_DUMMY_SIM_CARDS.filter(s => s.plan === item.name).length,
    },

    "consumable-category": {
        pageTitle: "Consumable Category Master",
        pageSub: "Manage the category options available in the Consumable Master",
        dataArray: AMS_DUMMY_CONSUMABLE_CATEGORIES,
        idKey: "name",
        fields: [
            { key: "name",        label: "Category Name", required: true },
            { key: "description", label: "Description",   multiline: true },
        ],
        /* Blocks delete while any consumable uses this category */
        usageCount: (item) => AMS_DUMMY_CONSUMABLES.filter(c => c.category === item.name).length,
    },

    "unit-of-measure": {
        pageTitle: "Unit of Measure Master",
        pageSub: "Manage the units (Nos, Box, Pack, Ream, Meter, ...) used by the Consumable Master",
        dataArray: AMS_DUMMY_CONSUMABLE_UNITS,
        idKey: "name",
        fields: [
            { key: "name",        label: "Unit Name",  required: true },
            { key: "description", label: "Description" },
        ],
        /* Blocks delete while any consumable uses this unit */
        usageCount: (item) => AMS_DUMMY_CONSUMABLES.filter(c => c.unit === item.name).length,
    },

    "spare-part-category": {
        pageTitle: "Spare Part Category Master",
        pageSub: "Manage the category options available in the Spare Parts Master",
        dataArray: AMS_DUMMY_SPAREPART_CATEGORIES,
        idKey: "name",
        fields: [
            { key: "name",        label: "Category Name", required: true },
            { key: "description", label: "Description",   multiline: true },
        ],
        /* Blocks delete while any spare part uses this category */
        usageCount: (item) => AMS_DUMMY_SPARE_PARTS.filter(p => p.category === item.name).length,
    },

    "vendor-category": {
        pageTitle: "Vendor Category Master",
        pageSub: "Manage the supply categories (Assets, Consumables, Spare Parts, Services, ...) used by the Vendor Master",
        dataArray: AMS_DUMMY_VENDOR_CATEGORIES,
        idKey: "name",
        fields: [
            { key: "name",        label: "Category Name", required: true },
            { key: "description", label: "Description" },
        ],
        /* Blocks delete while any vendor uses this category */
        usageCount: (item) => AMS_DUMMY_VENDORS.filter(v => v.category === item.name).length,
    },
};

/* ---- Resolve the active config from the "type" query parameter ------------- */
function amsResolveMasterConfig() {
    const type = new URLSearchParams(location.search).get("type") || "asset-type";
    return AMS_MASTER_CONFIGS[type] || AMS_MASTER_CONFIGS["asset-type"];
}

/*------------------------------------------------------------------------------
#-------------- End of the code : MASTER CONFIG REGISTRY ----------------------
#------------------------------------------------------------------------------*/
