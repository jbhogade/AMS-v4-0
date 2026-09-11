/*==============================================================================
#-------------- Start Code for : ACCESS RIGHTS LOGIC (access-rights.js) ----------
#
#  PURPOSE   : Powers Access Rights Control Master - ported from v3-3
#              (access-rights-v1-0.js) to the v4-0 data layer. Gated to
#              Supreme Root only via the "Viewing As" role simulator (no real
#              login yet, so this is enforced client-side for now). Lets a
#              Supreme Root set which pages (AMS_PAGE_REGISTRY) each user can
#              access, stored on AMS_DUMMY_USERS[].allowedPages.
#
#  v4-0 ADAPTATIONS :
#    - Badges use the v4-0 badge-* classes (badge-grey/red/amber).
#    - Modal uses the shared .modal-overlay.open pattern (css/main.css).
#    - Options for the role simulator are built from AMS_USER_ROLES and stay
#      in sync with the shared topbar selector via amsGet/SetViewingAsRole.
#------------------------------------------------------------------------------*/

/*-------------- Start Code for GATE: SUPREME ROOT ONLY -------------------------*/
function amsIsSupremeRoot() {
    return amsGetViewingAsRole() === "Supreme Root";
}

function amsApplyAccessGate() {
    const unlocked = amsIsSupremeRoot();
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
    renderAccessTable();
}

function amsWireAccessGate() {
    const roleInput = document.getElementById("viewingAsRole");
    if (roleInput) roleInput.value = amsGetViewingAsRole();
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for RENDER: USER ACCESS TABLE ------------------------*/
function renderAccessTable() {
    const searchTerm = (document.getElementById("searchBox").value || "").toLowerCase();
    const total = AMS_PAGE_REGISTRY.length;

    const users = AMS_DUMMY_USERS
        .filter(u => !searchTerm || u.username.toLowerCase().includes(searchTerm) || u.role.toLowerCase().includes(searchTerm));
    const getters = {
        username: u => u.username,
        role: u => u.role,
        access: u => {
            const isDefault = u.allowedPages === null || u.allowedPages === undefined;
            const granted = amsResolveAllowedPages(u).length;
            return isDefault ? `${granted} Role Default` : `${granted} Custom`;
        },
    };
    if (typeof amsSortRegisterRenderer === "function") amsSortRegisterRenderer("accessTable", renderAccessTable);
    const colFiltered = typeof amsFilterRows === "function" ? amsFilterRows("accessTable", users, getters) : users;
    const sorted = typeof amsSortRows === "function" ? amsSortRows("accessTable", colFiltered, getters) : colFiltered;
    const rows = sorted.map(u => {
            const isDefault = u.allowedPages === null || u.allowedPages === undefined;
            const effective = amsResolveAllowedPages(u);
            const granted = effective.length;
            const summary = isDefault
                ? `<span class="badge badge-grey">${granted} / ${total} pages (Role Default)</span>`
                : `<span class="badge ${granted === 0 ? "badge-red" : "badge-grey"}">${granted} / ${total} pages (Custom)</span>`;
            const roleCls = (u.role === "Supreme Root" || u.role === "Super Root") ? "badge-red" : u.role === "Admin" ? "badge-amber" : "badge-grey";

            return `<tr>
                <td class="mono">${amsEsc(u.username)}</td>
                <td><span class="badge ${roleCls}">${amsEsc(u.role)}</span></td>
                <td>${summary}</td>
                <td class="row-actions">
                    <button data-edit-access="${amsEsc(u.username)}">Edit Access</button>
                </td>
            </tr>`;
        }).join("");

    const th = (key, label) => (typeof amsSortableTh === "function")
        ? amsSortableTh("accessTable", key, label)
        : `<th>${label}</th>`;
    document.getElementById("accessTable").innerHTML = `
        <thead><tr>${th("username", "Username")}${th("role", "Role")}${th("access", "Access")}<th></th></tr>
        ${typeof amsFilterHeadRow === "function" ? amsFilterHeadRow("accessTable", ["username", "role", "access", ""]) : ""}</thead>
        <tbody>${rows || `<tr><td colspan="4" style="color:var(--text-muted)">No users found</td></tr>`}</tbody>`;
    if (typeof amsFilterRestoreFocus === "function") amsFilterRestoreFocus("accessTable");
}
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for EDIT ACCESS MODAL -------------------------------*/
let amsEditingUsername = null;

document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit-access]");
    if (!btn) return;
    amsEditingUsername = btn.getAttribute("data-edit-access");
    const user = AMS_DUMMY_USERS.find(u => u.username === amsEditingUsername);
    if (!user) return;
    document.getElementById("editAccessUsername").textContent = amsEditingUsername;

    const currentlyAllowed = amsResolveAllowedPages(user);

    const pages = AMS_PAGE_REGISTRY.filter(p => !p.key.startsWith("report."));
    const reports = AMS_PAGE_REGISTRY.filter(p => p.key.startsWith("report."));
    const checkboxHtml = p => `
        <label>
            <input type="checkbox" class="access-page-check" value="${amsEsc(p.key)}" ${currentlyAllowed.includes(p.key) ? "checked" : ""}>
            ${amsEsc(p.label)}
        </label>`;

    document.getElementById("accessChecklist").innerHTML = `
        <div class="checklist-section">Pages</div>
        ${pages.map(checkboxHtml).join("")}
        <div class="checklist-section">Reports (Report Master)</div>
        ${reports.map(checkboxHtml).join("")}
    `;

    document.getElementById("modalEditAccess").classList.add("open");
});

document.getElementById("btnSelectAllAccess").addEventListener("click", () => {
    document.querySelectorAll(".access-page-check").forEach(c => c.checked = true);
});
document.getElementById("btnClearAllAccess").addEventListener("click", () => {
    document.querySelectorAll(".access-page-check").forEach(c => c.checked = false);
});

document.getElementById("btnSaveAccess").addEventListener("click", () => {
    const user = AMS_DUMMY_USERS.find(u => u.username === amsEditingUsername);
    if (!user) return;
    const checked = [...document.querySelectorAll(".access-page-check:checked")].map(c => c.value);
    user.allowedPages = checked;
    amsDbSaveAsync("users");

    amsNotify(`Access rights updated for ${amsEditingUsername}: ${checked.length} / ${AMS_PAGE_REGISTRY.length} pages`, "warning");
    document.getElementById("modalEditAccess").classList.remove("open");
    renderAccessTable();
});
/*-------------- End of the code ------------------------------------------------*/

/*-------------- Start Code for PAGE INIT ----------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
    if (typeof initLayout === "function") initLayout("access-rights");

    document.querySelectorAll("[data-close]").forEach(btn => {
        btn.addEventListener("click", () => document.getElementById(btn.getAttribute("data-close")).classList.remove("open"));
    });

    document.getElementById("searchBox").addEventListener("input", renderAccessTable);
    const accessClear = document.getElementById("btnAccessClearFilters");
    if (accessClear) accessClear.addEventListener("click", () => amsFilterClearAndRender("accessTable"));

    amsWireAccessGate();
    (typeof amsDbEnsureLoaded === "function" ? amsDbEnsureLoaded() : Promise.resolve()).then(() => amsApplyAccessGate());
});
/*-------------- End of the code ------------------------------------------------*/
/*==============================================================================
#-------------- End of the code : ACCESS RIGHTS LOGIC ----------------------------
#------------------------------------------------------------------------------*/
