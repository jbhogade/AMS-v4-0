/*==============================================================================
#-------------- Start Code for : SHARED APP HELPERS (app.js) ------------------
#
#  PURPOSE   : Small shared functions used by EVERY page:
#               1. Sidebar mobile open/close
#               2. Escaping text safely (prevents HTML injection)
#               3. Status -> badge class mapping
#               4. Currency / number formatting
#               5. Page identification (for navigation highlighting)
#
#  Every new page must load this file AFTER theme.js and BEFORE its own script.
#------------------------------------------------------------------------------*/

/* ---- 1) MOBILE SIDEBAR : open / close / overlay click ----------------------- */
function openSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebar-overlay").classList.add("show");
}

function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("show");
}

/* ---- 2) ESCAPE TEXT : safely display user data in the HTML ------------------ */
function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/* Small inline SVG icons for chrome (menu, bell, lock, warn). Stroke uses
   currentColor so Theme still colors them. */
const AMS_UI_ICONS = {
    menu: '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>',
    bell: '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    caret: '<svg class="ui-icon ui-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>',
    lock: '<svg class="ui-icon ui-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    warn: '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    check: '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    box: '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    wrench: '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    rupee: '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 5h12M6 10h12M6 5c4 0 7 2.5 7 6 0 4-3 8-7 8h2"/><path d="M14 10 6 20"/></svg>',
    clock: '<svg class="ui-icon ui-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    dot: '<svg class="ui-icon ui-icon-sm" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>',
    sidebarHide: '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="16 8 12 12 16 16"/></svg>',
    sidebarShow: '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="12 8 16 12 12 16"/></svg>',
};

function amsUiIcon(name) {
    return AMS_UI_ICONS[name] || "";
}

/* ---- 3) STATUS TO BADGE : converts a status string to a badge CSS class ----- */
function badgeClassFor(status) {
    return STATUS_BADGE_CLASS[status] || "badge-grey";
}

/* ---- 4) NUMBER FORMATTING (Indian currency ₹ with lakh/crore counting) ----- */
function amsParseMoney(value) {
    if (value == null || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/[₹,\s]/g, "").trim();
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
}

function formatCurrency(amount) {
    const n = (typeof amsParseMoney === "function") ? amsParseMoney(amount) : Number(amount);
    if (!Number.isFinite(n)) return "₹0";
    return "₹" + new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 2
    }).format(n);
}

/* Indian-style plain number counting (1,00,000 - lakh / 1,00,00,000 - crore).
   Used for any non-currency count that should group digits the Indian way. */
function formatIndianNumber(n) {
    const num = Number(n);
    if (isNaN(num)) return "0";
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(num);
}

/* ---- 5) NAVIGATION : highlight the sidebar link for the current page -------- */
function setActiveNav(pageId) {
    const links = document.querySelectorAll(".sidebar-link");
    links.forEach(link => {
        if (link.dataset.page === pageId) {
            link.classList.add("active");
        }
    });
}

function amsFreezeIsElevatedRole() {
    const role = (typeof amsGetViewingAsRole === "function") ? amsGetViewingAsRole() : "";
    return role === "Super Root" || role === "Supreme Root";
}

function amsFreezeHeaderText(th) {
    return String(th ? th.textContent : "")
        .replace(/[\u2191\u2193\u2195]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function amsFreezeIsHidden(cell) {
    if (!cell) return true;
    if (cell.style.display === "none") return true;
    return window.getComputedStyle(cell).display === "none";
}

function amsFreezeIsNameHeader(text) {
    const t = String(text || "").toLowerCase();
    return t === "name" || t === "employee" || t === "employee name" || t === "item";
}

function amsFreezeIsActionsHeader(th) {
    const t = amsFreezeHeaderText(th).toLowerCase();
    return t === "" || t === "actions" || t === "action";
}

function amsFreezeLeftCount(headCells) {
    const visible = [];
    headCells.forEach((th, idx) => {
        if (!amsFreezeIsHidden(th)) visible.push({ th, idx, text: amsFreezeHeaderText(th) });
    });
    if (visible.length < 3) return 0;
    const nameHit = visible.find(c => amsFreezeIsNameHeader(c.text));
    const namePos = nameHit ? visible.indexOf(nameHit) : -1;
    if (amsFreezeIsElevatedRole() && nameHit && namePos >= 0 && namePos <= 2) {
        return namePos + 1;
    }
    return Math.min(2, visible.length - 1);
}

function amsClearFreezeClasses(table) {
    table.classList.remove("ams-freeze");
    table.querySelectorAll(".ams-freeze-left, .ams-freeze-right, .ams-freeze-edge").forEach(el => {
        el.classList.remove("ams-freeze-left", "ams-freeze-right", "ams-freeze-edge");
        el.style.left = "";
        el.style.top = "";
    });
}

function amsApplyFreezeColumns(table) {
    if (!table || !table.tHead) return;
    const wrap = table.closest(".table-wrap");
    if (!wrap || wrap.closest(".modal, .modal-overlay, .modal-body, details, .card-compact")) return;
    if (wrap.offsetWidth < 8 || wrap.offsetHeight < 8) return;
    const headRow = table.tHead.querySelector("tr:not(.col-filter-row)");
    if (!headRow) return;
    const headCells = [...headRow.children];
    if (headCells.length < 4) {
        amsClearFreezeClasses(table);
        wrap.classList.remove("ams-freeze-wrap");
        wrap.style.maxHeight = "";
        return;
    }

    wrap.classList.add("ams-freeze-wrap");
    const footer = wrap.parentElement ? wrap.parentElement.querySelector(".asset-table-footer") : null;
    const bottomGap = (footer ? footer.offsetHeight : 0) + 20;
    const wrapTop = wrap.getBoundingClientRect().top;
    wrap.style.maxHeight = Math.max(180, Math.floor(window.innerHeight - wrapTop - bottomGap)) + "px";

    amsClearFreezeClasses(table);
    table.classList.add("ams-freeze");

    const leftCount = amsFreezeLeftCount(headCells);
    const leftIdx = [];
    for (let i = 0; i < headCells.length && leftIdx.length < leftCount; i++) {
        if (!amsFreezeIsHidden(headCells[i])) leftIdx.push(i);
    }
    const lastIdx = headCells.length - 1;
    const freezeRight = amsFreezeIsActionsHeader(headCells[lastIdx]);
    const rows = [...table.querySelectorAll("tr")];
    rows.forEach(tr => {
        const cells = [...tr.children];
        if (cells.length === 1 && cells[0].hasAttribute("colspan")) return;
        if (cells.length !== headCells.length) return;
        leftIdx.forEach((idx, n) => {
            const cell = cells[idx];
            if (!cell || amsFreezeIsHidden(cell)) return;
            cell.classList.add("ams-freeze-left");
            if (n === leftIdx.length - 1) cell.classList.add("ams-freeze-edge");
        });
        if (freezeRight) {
            const last = cells[lastIdx];
            if (last) last.classList.add("ams-freeze-right");
        }
    });

    let left = 0;
    leftIdx.forEach(idx => {
        const th = headCells[idx];
        const width = th.getBoundingClientRect().width;
        rows.forEach(tr => {
            const cell = tr.children[idx];
            if (cell && cell.classList.contains("ams-freeze-left")) cell.style.left = left + "px";
        });
        left += width;
    });

    const headRows = [...table.tHead.querySelectorAll("tr")];
    let top = 0;
    headRows.forEach(tr => {
        [...tr.children].forEach(cell => { cell.style.top = top + "px"; });
        top += tr.getBoundingClientRect().height;
    });
}

let AMS_FREEZE_LOCK = false;
function amsRefreshFreezePanes() {
    if (AMS_FREEZE_LOCK) return;
    AMS_FREEZE_LOCK = true;
    try {
        document.querySelectorAll(".card > .table-wrap > table").forEach(table => {
            amsApplyFreezeColumns(table);
        });
    } finally {
        AMS_FREEZE_LOCK = false;
    }
}

/* ---- Initialise shared page behaviour (call on every page) ------------------ */
function initApp() {
    /* Sidebar toggle button (hamburger) */
    const toggle = document.getElementById("sidebar-toggle");
    if (toggle) toggle.addEventListener("click", openSidebar);

    /* Overlay click closes the sidebar */
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) overlay.addEventListener("click", closeSidebar);

    /* Set current year in the sidebar footer */
    const yearEl = document.getElementById("current-year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    amsRefreshFreezePanes();
    setTimeout(amsRefreshFreezePanes, 80);
    window.addEventListener("resize", () => {
        if (amsRefreshFreezePanes._r) cancelAnimationFrame(amsRefreshFreezePanes._r);
        amsRefreshFreezePanes._r = requestAnimationFrame(amsRefreshFreezePanes);
    });
}

/*------------------------------------------------------------------------------
#-------------- End of the code : SHARED APP HELPERS ---------------------------
#------------------------------------------------------------------------------*/
