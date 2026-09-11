/*==============================================================================
#-------------- Start Code for : ROLE ACCESS LOGIC (role-access.js) --------------
#
#  PURPOSE   : Powers Role Access Master - ported from v3-3
#              (role-access-master-v1-0.js) to the v4-0 data layer. Gated to
#              Supreme Root only via the "Viewing As" role simulator. Renders
#              a Role x Page checkbox matrix from AMS_PAGE_REGISTRY (pages +
#              report.* keys) and saves it through amsSaveRoleAccessDefaults()
#              (localStorage), which Access Rights Control Master's
#              amsResolveAllowedPages() then picks up for users with no
#              per-user override.
#
#  v4-0 ADAPTATIONS :
#    - Uses the shared amsEsc() from js/dummy-data.js (no local copy needed).
#    - Badge var names use the v4-0 theme tokens (--border/--bg-elevated).
#    - Role options come from AMS_USER_ROLES and stay in sync with the shared
#      topbar selector via amsGet/SetViewingAsRole.
#------------------------------------------------------------------------------*/

/*-------------- Start Code for GATE: SUPREME ROOT ONLY -------------------------*/
/* Pages whose access is enforced purely by the simulated role itself - their
   checkboxes are shown for transparency but locked, since toggling them here
   wouldn't actually change anything. */
const RAM_LOCKED_KEYS = {
    accessRights: "Always Supreme Root only",
    roleAccess: "Always Supreme Root only",
    log: "Always Super Root + Supreme Root only",
};

function amsIsSupremeRootRAM() {
    return amsGetViewingAsRole() === "Supreme Root";
}

function amsApplyRoleAccessGate() {
    const unlocked = amsIsSupremeRootRAM();
    if (!unlocked) {
        /* This page is exclusive to Supreme Root accounts. Non-Supreme roles
           (including Super Root) are sent back to the dashboard instead of
           being shown an "Access Denied" wall - the entry point (System Admin
           tab) is hidden for them anyway, so this only guards direct-URL
           access. */
        window.location.replace("../index.html");
        return;
    }
    document.getElementById("unlockedView").style.display = "block";
    document.getElementById("lockedView").style.display = "none";
    renderRoleAccessTable();
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for RENDER MATRIX ------------------------------------*/
function ramLevelOptions(selected, locked) {
    const cur = (typeof amsNormalizeAccessLevel === "function")
        ? amsNormalizeAccessLevel(selected)
        : (selected === false ? "none" : (selected === "view" ? "view" : "full"));
    const opts = [
        { v: "none", l: "None" },
        { v: "view", l: "View" },
        { v: "full", l: "Full" },
    ];
    return opts.map(o => `<option value="${o.v}" ${cur === o.v ? "selected" : ""}>${o.l}</option>`).join("");
}

function renderRoleAccessTable() {
    const map = amsGetRoleAccessDefaults();
    const pages = AMS_PAGE_REGISTRY.filter(p => !p.key.startsWith("report."));
    const reports = AMS_PAGE_REGISTRY.filter(p => p.key.startsWith("report."));

    const rowHtml = (p) => {
        const locked = RAM_LOCKED_KEYS[p.key];
        const cells = AMS_USER_ROLES.map(role => {
            const raw = map[role] ? map[role][p.key] : "none";
            return `<td><select class="ram-level ${locked ? "ram-locked-check" : ""}"
                data-role="${amsEsc(role)}" data-page="${p.key}" ${locked ? "disabled" : ""}>${ramLevelOptions(raw)}</select></td>`;
        }).join("");
        return `<tr>
            <td><div class="ram-page-label">${amsEsc(p.label.split(" (")[0])}${locked ? `<span class="ram-page-note">${locked}</span>` : ""}</div></td>
            ${cells}
        </tr>`;
    };

    const sectionRow = (label) => `<tr class="ram-section-row"><td colspan="${AMS_USER_ROLES.length + 1}">${label}</td></tr>`;

    document.getElementById("roleAccessTable").innerHTML = `
        <thead><tr><th>Page</th>${AMS_USER_ROLES.map(r => `<th>${amsEsc(r)}</th>`).join("")}</tr></thead>
        <tbody>
            ${sectionRow("Pages")}
            ${pages.map(rowHtml).join("")}
            ${sectionRow("Reports (Report Master)")}
            ${reports.map(rowHtml).join("")}
        </tbody>`;
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for SAVE / RESET -------------------------------------*/
function amsCollectRoleAccessMap() {
    const map = {};
    AMS_USER_ROLES.forEach(role => { map[role] = {}; });
    document.querySelectorAll(".ram-level").forEach(sel => {
        if (sel.disabled) return;
        const level = (typeof amsNormalizeAccessLevel === "function")
            ? amsNormalizeAccessLevel(sel.value)
            : sel.value;
        map[sel.getAttribute("data-role")][sel.getAttribute("data-page")] = level;
    });
    const defaults = amsDefaultRoleAccessMap();
    Object.keys(RAM_LOCKED_KEYS).forEach(key => {
        AMS_USER_ROLES.forEach(role => {
            map[role][key] = defaults[role] ? defaults[role][key] : "none";
        });
    });
    return map;
}

document.getElementById("btnSaveRoleDefaults").addEventListener("click", () => {
    amsSaveRoleAccessDefaults(amsCollectRoleAccessMap());
    amsNotify("Role Access Master: default page access saved", "success");
});

document.getElementById("btnResetRoleDefaults").addEventListener("click", () => {
    if (!confirm("Reset every role's default page access back to the Recommended matrix (None / View / Full)? This does not affect any per-user overrides in Access Rights Control Master.")) return;
    amsSaveRoleAccessDefaults(amsDefaultRoleAccessMap());
    renderRoleAccessTable();
    amsNotify("Role Access Master: defaults reset", "info");
});
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for PAGE INIT ----------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
    if (typeof initLayout === "function") initLayout("role-access");
    const roleInput = document.getElementById("viewingAsRole");
    if (roleInput) roleInput.value = amsGetViewingAsRole();
    (typeof amsDbEnsureLoaded === "function" ? amsDbEnsureLoaded() : Promise.resolve()).then(() => amsApplyRoleAccessGate());
});
/*-------------- End of the code ------------------------------------------------*/
/*==============================================================================
#-------------- End of the code : ROLE ACCESS LOGIC ------------------------------
#------------------------------------------------------------------------------*/
