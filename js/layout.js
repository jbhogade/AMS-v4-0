/*==============================================================================
#-------------- Start Code for : SHARED LAYOUT (layout.js) --------------------
#
#  PURPOSE   : Renders the SIDEBAR and TOP HEADER BAR on every page from ONE
#              single source of truth (the NAV_ITEMS list below).
#
#  WHY : So you never have to duplicate navigation HTML across pages.
#        To add a page to the menu, just add one entry to NAV_ITEMS.
#
#  TO ADD A NEW PAGE :
#    1. Add { page, label, href, icon } to the NAV_ITEMS array below.
#    2. Create pages/<name>.html that includes #sidebar-mount and #topbar-mount.
#    3. Call initLayout() at the end of that page's script.
#
#  TO RENAME OR REORDER MENU ITEMS : edit NAV_ITEMS here, that is all.
#------------------------------------------------------------------------------*/

/* ---- Icon SVGs (each returns a 20x20 svg string) --------------------------- */
const ICONS = {
    dashboard:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
    assets:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    consumables:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
    spareParts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    accessories:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-9 7-9-7"/><path d="m21 9-9 7-9-7 9-7z"/><path d="m3 16 9-7 9 7"/><path d="M12 2v20"/></svg>',
    simCards:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7v5h5v-5z"/><path d="M12 12h5v5h-5z"/><path d="M7 16v1"/></svg>',
    vendors:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    reports:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    settings:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    systemAdmin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    people:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
};

/* ---- Navigation menu definition (single source of truth) ------------------- */
const NAV_ITEMS = [
    { page: "dashboard",   label: "Dashboard",   href: "../index.html",       icon: ICONS.dashboard,   section: "Main" },
    { page: "employees",   label: "Employees",   href: "../pages/employees.html",   icon: ICONS.people,  section: "People" },
    { page: "assets",      label: "Assets",      href: "../pages/assets.html",      icon: ICONS.assets,      section: "Inventory" },
    { page: "mobiles",     label: "Mobiles",     href: "../pages/mobiles.html",     icon: ICONS.simCards,    section: "Inventory" },
    { page: "asset-distribution", label: "Asset Distribution", href: "../pages/asset-distribution.html", icon: ICONS.assets, section: "Inventory" },
    { page: "consumables", label: "Consumables", href: "../pages/consumables.html", icon: ICONS.consumables, section: "Inventory" },
    { page: "spare-parts", label: "Spare Parts", href: "../pages/spare-parts.html", icon: ICONS.spareParts,  section: "Inventory" },
    { page: "accessories", label: "Accessories", href: "../pages/accessories.html", icon: ICONS.accessories, section: "Inventory" },
    { page: "sim-cards",   label: "SIM Cards",   href: "../pages/sim-cards.html",   icon: ICONS.simCards,   section: "Inventory" },
    { page: "vendors",     label: "Vendors",     href: "../pages/vendors.html",     icon: ICONS.vendors,     section: "Admin" },
    { page: "reports",     label: "Reports",     href: "../pages/reports.html",     icon: ICONS.reports,     section: "Admin" },
    { page: "system-admin",label: "System Admin", href: "../pages/system-admin.html", icon: ICONS.systemAdmin, section: "Admin" },
    { page: "settings",    label: "Settings",    href: "../pages/settings.html",    icon: ICONS.settings,    section: "Admin" },
    { page: "user-master", label: "User Master", href: "../pages/user-master.html", icon: ICONS.people,    section: "Admin" }
];

/* ---- Page title mapping (used by the top header bar) ----------------------- */
const PAGE_TITLES = {
    "dashboard":   { title: "Dashboard",       sub: "Overview of your inventory" },
    "employees":   { title: "Employees",       sub: "Employee master, assets & handover records" },
    "assets":      { title: "Assets",          sub: "Equipment, machinery & company items" },
    "mobiles":     { title: "Mobiles",         sub: "Mobile phones & handheld devices" },
    "consumables": { title: "Consumables",     sub: "Items consumed during operations" },
    "spare-parts": { title: "Spare Parts",     sub: "Replacement components in stores" },
    "accessories": { title: "Accessories",     sub: "Attachments & add-ons for assets" },
    "sim-cards":   { title: "SIM Cards",       sub: "Mobile SIM cards issued to employees" },
    "vendors":     { title: "Vendors",         sub: "Suppliers and their contacts" },
    "reports":     { title: "Reports",         sub: "Insights and exports" },
    "system-admin":{ title: "System Admin",    sub: "Lookup masters hub" },
    "company":     { title: "Company Master",  sub: "Company details for print letterheads" },
    "user-master": { title: "User Master",     sub: "System login accounts and roles" },
    "settings":    { title: "Settings",        sub: "Portal configuration" },
    "master-asset-type":      { title: "Asset Type Master",      sub: "Asset types & Smart Asset ID shortforms" },
    "master-asset-make":      { title: "Asset Make Master",      sub: "Brands / makes for assets" },
    "master-asset-category":  { title: "Asset Category Master",  sub: "Broad asset groupings" },
    "master-site":            { title: "Site Master",            sub: "Locations & Smart Asset ID site codes" },
    "master-department":      { title: "Department Master",      sub: "Departments & Employee ID shortforms" },
    "master-designation":     { title: "Designation Master",     sub: "Employee designations" },
    "master-sim-operator":        { title: "SIM Operator Master",        sub: "Telecom operators used on SIM Card records" },
    "master-sim-plan":            { title: "SIM Plan Master",            sub: "SIM plans used on SIM Card records" },
    "master-consumable-category": { title: "Consumable Category Master", sub: "Categories used by the Consumable Master" },
    "master-unit-of-measure":     { title: "Unit of Measure Master",     sub: "Units used by the Consumable Master" },
    "master-spare-part-category": { title: "Spare Part Category Master", sub: "Categories used by the Spare Parts Master" },
    "master-vendor-category":     { title: "Vendor Category Master",     sub: "Supply categories used by the Vendor Master" },
    "access-rights": { title: "Access Rights Control Master", sub: "Per-user page access (Supreme Root)" },
    "role-access":   { title: "Role Access Master",           sub: "Default page access per role (Supreme Root)" },
    "log":           { title: "Log Report",                   sub: "Activity audit trail (Super Root + Supreme Root)" }
};

/* ---- Render the sidebar into #sidebar-mount -------------------------------- */
function renderSidebar(currentPage) {
    const mount = document.getElementById("sidebar-mount");
    if (!mount) return;

    let sectionsHtml = "";
    let lastSection = "";

    NAV_ITEMS.forEach(item => {
        if (typeof amsUserCanAccessNavPage === "function" && !amsUserCanAccessNavPage(item.page)) return;

        /* Add a section label when the section changes */
        if (item.section !== lastSection) {
            sectionsHtml += `<div class="sidebar-nav-label">${escapeHtml(item.section)}</div>`;
            lastSection = item.section;
        }

        const active = item.page === currentPage ? "active" : "";
        sectionsHtml += `
            <a class="sidebar-link ${active}" href="${item.href}" data-page="${item.page}" title="${escapeHtml(item.label)}">
                <span class="icon">${item.icon}</span>
                <span class="sidebar-link-label">${escapeHtml(item.label)}</span>
            </a>
        `;
    });

    mount.innerHTML = `
        <div class="sidebar-brand">
            <div class="sidebar-logo">AM</div>
            <div class="sidebar-brand-text">
                <div class="sidebar-brand-name">${escapeHtml((typeof amsGetPortalName === "function") ? amsGetPortalName() : "Asset Manager")}</div>
                <div class="sidebar-brand-sub">Management Portal v4.0</div>
            </div>
        </div>
        <nav class="sidebar-nav">
            ${sectionsHtml}
        </nav>
        <div class="sidebar-footer">
            &copy; <span id="current-year">2026</span> Your Company Name
        </div>
    `;
}

/* ---- Render the top header bar into #topbar-mount -------------------------- */
function renderTopbar(currentPage) {
    const mount = document.getElementById("topbar-mount");
    if (!mount) return;

    const pageInfo = PAGE_TITLES[currentPage] || { title: "Portal", sub: "" };

    mount.innerHTML = `
        <button class="topbar-toggle" id="sidebar-toggle" aria-label="Open menu">${typeof amsUiIcon === "function" ? amsUiIcon("menu") : "Menu"}</button>
        <button type="button" class="sidebar-desk-toggle" id="sidebar-desk-toggle" aria-label="Hide sidebar">${typeof amsUiIcon === "function" ? amsUiIcon("sidebarHide") : "Hide"}</button>
        <div>
            <div class="topbar-title">${escapeHtml(pageInfo.title)}</div>
            <div class="topbar-breadcrumb">Home &rsaquo; ${escapeHtml(pageInfo.title)} ${pageInfo.sub ? '&rsaquo; ' + escapeHtml(pageInfo.sub) : ''}</div>
        </div>
        <div class="topbar-spacer"></div>
        <div class="notif-bell-wrap">
            <button class="notif-bell-trigger" id="notifBellTrigger" title="Notifications">${typeof amsUiIcon === "function" ? amsUiIcon("bell") : "Alerts"}</button>
            <span class="notif-bell-badge" id="notifBellBadge"></span>
            <div class="notif-bell-panel" id="notifBellPanel">
                <div class="notif-bell-header">
                    <span>Notifications</span>
                    <button id="notifClearAll">Clear All</button>
                </div>
                <div id="notifBellList"></div>
            </div>
        </div>
        <select class="select" id="theme-select" aria-label="Theme" style="width:auto;padding:8px 10px;font-size:13px;"></select>
        <select class="select" id="style-select" aria-label="Style" style="width:auto;padding:8px 10px;font-size:13px;"></select>
        ${(function () {
            const session = (typeof amsGetSession === "function") ? amsGetSession() : null;
            const name = (session && (session.displayName || session.name)) ? (session.displayName || session.name) : "Operator";
            const initials = name.split(/\s+/).map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase() || "OP";
            return `<div class="user-chip-wrap">
                <div class="user-chip" id="user-chip" title="Account menu">
                    <div class="user-avatar">${escapeHtml(initials)}</div>
                    <span class="user-chip-name">${escapeHtml(name)}</span>
                    <span class="user-chip-caret">${typeof amsUiIcon === "function" ? amsUiIcon("caret") : ""}</span>
                </div>
                <div class="user-chip-menu" id="user-chip-menu">
                    <a class="user-chip-menu-item" href="../pages/profile.html">My Profile</a>
                    <button type="button" class="user-chip-menu-item" id="user-chip-logout">Logout</button>
                </div>
            </div>`;
        })()}
    `;

    /* Wire up the theme and style dropdowns that were just created */
    buildThemeMenu("theme-select");
    buildStyleMenu("style-select");

    /* User chip dropdown: My Profile / Logout */
    const chip = document.getElementById("user-chip");
    const chipMenu = document.getElementById("user-chip-menu");
    if (chip && chipMenu) {
        chip.addEventListener("click", function (e) {
            e.stopPropagation();
            chipMenu.classList.toggle("open");
        });
        document.addEventListener("click", function (e) {
            if (!e.target.closest(".user-chip-wrap")) chipMenu.classList.remove("open");
        });
        const logoutBtn = document.getElementById("user-chip-logout");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", function () {
                if (typeof amsLogout === "function") amsLogout();
            });
        }
    }

    /* Sidebar overlay lives outside the sidebar element, created here */
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) overlay.classList.remove("show");
}

/* ---- Desktop sidebar: icon-only rail, overlay peek, persist-show pin --------
   Collapsed = 64px icons so lists get width. Hover/focus peeks labels over
   the page without shifting .app-main. Pin Show (localStorage ams-sidebar-show)
   keeps names visible. Mobile drawer (#sidebar-toggle) is unchanged. */
const AMS_SIDEBAR_SHOW_KEY = "ams-sidebar-show";

function amsSidebarIsPinnedShow() {
    try { return localStorage.getItem(AMS_SIDEBAR_SHOW_KEY) === "1"; }
    catch (e) { return false; }
}

function amsSidebarSetPinnedShow(on) {
    try {
        if (on) localStorage.setItem(AMS_SIDEBAR_SHOW_KEY, "1");
        else localStorage.removeItem(AMS_SIDEBAR_SHOW_KEY);
    } catch (e) { /* storage unavailable */ }
}

function amsApplySidebarMode() {
    const pinned = amsSidebarIsPinnedShow();
    document.body.classList.toggle("sidebar-collapsed", !pinned);
    document.body.classList.toggle("sidebar-pinned", pinned);
    document.body.classList.remove("sidebar-peek");
    const btn = document.getElementById("sidebar-desk-toggle");
    if (!btn) return;
    const show = !pinned;
    btn.setAttribute("aria-label", show ? "Show sidebar" : "Hide sidebar");
    btn.title = show ? "Show sidebar names" : "Hide sidebar (icons only)";
    btn.innerHTML = (typeof amsUiIcon === "function")
        ? amsUiIcon(show ? "sidebarShow" : "sidebarHide")
        : (show ? "Show" : "Hide");
}

function amsInitDesktopSidebar() {
    amsApplySidebarMode();
    const btn = document.getElementById("sidebar-desk-toggle");
    if (btn && !btn.dataset.bound) {
        btn.dataset.bound = "1";
        btn.addEventListener("click", function () {
            amsSidebarSetPinnedShow(!amsSidebarIsPinnedShow());
            amsApplySidebarMode();
        });
    }
    const sidebar = document.getElementById("sidebar");
    if (sidebar && !sidebar.dataset.peekBound) {
        sidebar.dataset.peekBound = "1";
        sidebar.addEventListener("mouseenter", function () {
            if (document.body.classList.contains("sidebar-collapsed")) {
                document.body.classList.add("sidebar-peek");
            }
        });
        sidebar.addEventListener("mouseleave", function () {
            document.body.classList.remove("sidebar-peek");
        });
        sidebar.addEventListener("focusin", function () {
            if (document.body.classList.contains("sidebar-collapsed")) {
                document.body.classList.add("sidebar-peek");
            }
        });
        sidebar.addEventListener("focusout", function (e) {
            if (!sidebar.contains(e.relatedTarget)) {
                document.body.classList.remove("sidebar-peek");
            }
        });
    }
}

/* ---- Session gate: no live login session -> redirect to the login page ----- */
function amsRequireSession() {
    if (typeof amsGetSession !== "function") return true;
    const session = amsGetSession();
    if (session && session.token) return true;
    const path = window.location.pathname;
    if (path.indexOf("login.html") !== -1) return true;
    window.location.replace("../login.html");
    return false;
}

/* ---- Initialise the whole layout ------------------------------------------- */
function amsLayoutRedirectIfDenied(currentPage) {
    if (!currentPage || currentPage === "login" || currentPage === "profile") return;
    if (typeof amsUserCanAccessNavPage !== "function") return;
    if (amsUserCanAccessNavPage(currentPage)) return;
    const fallback = NAV_ITEMS.find(i => i.page !== currentPage && amsUserCanAccessNavPage(i.page));
    if (fallback) window.location.replace(fallback.href);
}

function initLayout(currentPage) {
    if (!amsRequireSession()) return;
    initTheme();
    if (typeof amsApplyPortalPrefs === "function") amsApplyPortalPrefs();

    /* Ensure the sidebar overlay div exists once */
    if (!document.getElementById("sidebar-overlay")) {
        const overlay = document.createElement("div");
        overlay.id = "sidebar-overlay";
        overlay.className = "sidebar-overlay";
        document.body.appendChild(overlay);
    }

    renderSidebar(currentPage);
    renderTopbar(currentPage);
    initApp();               /* binds sidebar toggle / overlay / year   */
    amsInitDesktopSidebar();
    setActiveNav(currentPage);

    /* Notification bell (needs the topbar to already be rendered) */
    if (typeof amsInitBell === "function") amsInitBell();

    /* Page access (including Supreme Root per-user assignments) is on the
       user profile loaded from SQL. Re-apply the sidebar once that lands. */
    if (typeof amsDbEnsureLoaded === "function") {
        amsDbEnsureLoaded().then(() => {
            if (typeof amsEnsureSessionUserProfile === "function") amsEnsureSessionUserProfile();
            amsLayoutRedirectIfDenied(currentPage);
            renderSidebar(currentPage);
            setActiveNav(currentPage);
            if (typeof amsApplyViewOnlyChrome === "function") amsApplyViewOnlyChrome();
        });
    }
}

/* =============================================================================
   SHARED ROW-ACTIONS DROPDOWN (viewport-anchored)
   -----------------------------------------------------------------------------
   The old pattern lifted a row menu's scroll container from overflow:auto to
   overflow:visible while the menu was open. That made the scrollbar vanish
   (the whole table reflowed a few px wider) and - on capped-height wraps like
   the Assets list - let every row spill out over the footer/summary below, a
   sudden, jarring change in appearance. Instead, menus are now anchored to the
   trigger with position:fixed and clamped to the viewport, so opening one never
   touches the table's layout at all.
   ----------------------------------------------------------------------------*/
function amsDropdownOpen(trigger, menu) {
    amsDropdownClose();
    const r = trigger.getBoundingClientRect();
    menu.classList.add("open");
    menu.style.position = "fixed";
    menu.style.right = "auto";
    menu.style.top = "auto";
    menu.style.zIndex = "500";
    menu.style.left = "-9999px";                 /* measure off-screen first   */
    const mw = menu.offsetWidth || 200;
    const mh = menu.offsetHeight || 320;
    let left = r.right - mw;                     /* keep the menu right-aligned */
    if (left < 8) left = Math.max(8, r.left);
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) {     /* flip upward when it would  */
        top = r.top - mh - 6;                    /* overflow the bottom edge   */
        if (top < 8) top = 8;
    }
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    menu.style.width = mw + "px";
}

/* Closes every open actions menu and restores its inline overrides so the next
   open measures the natural size again. */
function amsDropdownClose() {
    document.querySelectorAll(".actions-menu.open").forEach(m => {
        m.classList.remove("open");
        m.style.position = ""; m.style.left = ""; m.style.top = "";
        m.style.right = ""; m.style.width = ""; m.style.zIndex = "";
    });
    document.querySelectorAll(".row-actions.open").forEach(el => el.classList.remove("open"));
}

/* A fixed-position menu would float detached if the PAGE scrolls or the window
   resizes while it is open, so close it whenever either happens. (Deliberately
   non-capturing: scrolling the table wrap itself does NOT dismiss the menu.) */
["scroll", "resize"].forEach(evt =>
    window.addEventListener(evt, () => amsDropdownClose(), { passive: true }));

/* =============================================================================
   SHARED MODAL HELPERS
   -----------------------------------------------------------------------------
   Generic modal open/close used by every page. Previously amsOpenModal lived
   only in js/assets.js, so pages that did NOT load assets.js (e.g. Asset
   Distribution) threw ReferenceError when a button tried to open a modal.
   Keeping them here, loaded on every page, makes modal open/close work
   everywhere. Pages may still bind their own [data-close] handlers for extra
   behaviour; this shared delegation guarantees basic open/close always work.
   ============================================================================*/

function amsOpenModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("open");
}

function amsCloseModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("open");
}

document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-close]");
    if (!btn) return;
    const id = btn.getAttribute("data-close");
    if (id) amsCloseModal(id);
});

/*------------------------------------------------------------------------------
#-------------- End of the code : SHARED LAYOUT -------------------------------
#------------------------------------------------------------------------------*/
