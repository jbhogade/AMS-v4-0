/*==============================================================================
#-------------- Start Code for : SETTINGS (settings.js) -------------------------
#
#  PURPOSE   : Drives the Settings page - a portal preferences hub:
#
#                1. Appearance  - theme gallery (11 themes with live CSS-var
#                   previews), style gallery (surface look), font size (sm / md / lg)
#                2. General     - portal name (sidebar brand), default list
#                   page size, currency display note
#                3. Notifications - toast popup toggle, clear the notification
#                   bell history, clear the permanent activity log
#                4. Data        - "Viewing As" role shortcut + Reset Demo Data
#
#  PERSISTENCE: every choice is localStorage-backed via the shared helpers in
#               js/dummy-data.js (portal name, font size, page size, toast
#               toggle) and js/theme.js (theme + style), so the choices apply on every
#               page, not just here.
#------------------------------------------------------------------------------*/

/*-------------- Start Code for TAB SWITCHING --------------------------------*/
function initSettingsTabs() {
    document.querySelectorAll(".settings-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".settings-tab").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".settings-pane").forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            const pane = document.getElementById(btn.dataset.settingsTab);
            if (pane) pane.classList.add("active");
        });
    });
}
/*-------------- End of the code ----------------------------------------------*/

/*-------------- Start Code for APPEARANCE TAB --------------------------------*/
/* Theme gallery - each card carries its own data-theme attribute, so the CSS
   variables inside the card resolve to THAT theme's palette (themes.css uses
   plain [data-theme=...] selectors), giving a live preview without iframes. */
function renderThemeGallery() {
    const grid = document.getElementById("themeGallery");
    if (!grid) return;
    grid.innerHTML = THEMES.map(t => `
        <button type="button" class="theme-card" data-theme-card="${amsEsc(t.name)}" data-theme="${amsEsc(t.name)}" title="Apply ${amsEsc(t.label)}">
            <span class="theme-swatch" aria-hidden="true">
                <span class="sw-bg"></span>
                <span class="sw-elevated"></span>
                <span class="sw-accent"></span>
                <span class="sw-text"></span>
            </span>
            <span class="theme-card-name">${amsEsc(t.label)}</span>
        </button>`).join("");
    grid.querySelectorAll("[data-theme-card]").forEach(card => {
        card.addEventListener("click", () => {
            const name = card.getAttribute("data-theme-card");
            applyTheme(name);
            grid.querySelectorAll(".theme-card").forEach(c =>
                c.classList.toggle("selected", c === card));
            const label = card.querySelector(".theme-card-name").textContent;
            amsNotify(`Theme changed to ${label}`, "success");
        });
    });
}

function markSelectedTheme() {
    const current = loadSavedTheme();
    document.querySelectorAll("[data-theme-card]").forEach(card =>
        card.classList.toggle("selected", card.getAttribute("data-theme-card") === current));
}

function renderStyleGallery() {
    const grid = document.getElementById("styleGallery");
    if (!grid || typeof UI_STYLES === "undefined") return;
    grid.innerHTML = UI_STYLES.map(s => `
        <button type="button" class="style-card" data-style-card="${amsEsc(s.name)}" title="Apply ${amsEsc(s.label)}">
            <span class="style-card-name">${amsEsc(s.label)}</span>
            <span class="style-card-hint">${amsEsc(s.hint || "")}</span>
        </button>`).join("");
    grid.querySelectorAll("[data-style-card]").forEach(card => {
        card.addEventListener("click", () => {
            const name = card.getAttribute("data-style-card");
            applyUiStyle(name);
            grid.querySelectorAll(".style-card").forEach(c =>
                c.classList.toggle("selected", c === card));
            const label = card.querySelector(".style-card-name").textContent;
            amsNotify(`Style changed to ${label}`, "success");
        });
    });
}

function markSelectedStyle() {
    const current = loadSavedUiStyle();
    document.querySelectorAll("[data-style-card]").forEach(card =>
        card.classList.toggle("selected", card.getAttribute("data-style-card") === current));
}

function renderFontSize() {
    const current = amsGetFontSize();
    document.querySelectorAll("[data-font-size-opt]").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.fontSizeOpt === current));
}

function initFontSize() {
    document.querySelectorAll("[data-font-size-opt]").forEach(btn => {
        btn.addEventListener("click", () => {
            amsSaveFontSize(btn.dataset.fontSizeOpt);
            amsApplyPortalPrefs();
            renderFontSize();
            amsNotify("Font size updated to " + btn.textContent.trim(), "success");
        });
    });
}
/*-------------- End of the code ----------------------------------------------*/

/*-------------- Start Code for GENERAL TAB ----------------------------------*/
function loadGeneralTab() {
    const name = document.getElementById("settingsPortalName");
    if (name) name.value = amsGetPortalName();

    const pageSize = document.getElementById("settingsPageSize");
    if (pageSize) pageSize.value = String(amsGetDefaultPageSize());

    const currency = document.getElementById("settingsCurrencyExample");
    if (currency) currency.textContent = formatCurrency(1234567.89) + "  /  " + formatIndianNumber(1234567.89);
}

function initGeneralTab() {
    const form = document.getElementById("settingsGeneralForm");
    if (form) form.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("settingsPortalName").value.trim();
        if (!name) { alert("Portal name cannot be empty."); return; }
        amsSavePortalName(name);
        /* Reflect it in this page's already-rendered sidebar brand immediately */
        const brand = document.querySelector(".sidebar-brand-name");
        if (brand) brand.textContent = name;
        amsNotify(`Portal name saved: ${name}`, "success");
    });

    const pageSize = document.getElementById("settingsPageSize");
    if (pageSize) pageSize.addEventListener("change", () => {
        amsSaveDefaultPageSize(parseInt(pageSize.value, 10));
        amsNotify(`Default list page size set to ${pageSize.value}`, "success");
    });
}
/*-------------- End of the code ----------------------------------------------*/

/*-------------- Start Code for NOTIFICATIONS TAB -----------------------------*/
function renderNotificationCounts() {
    const n = amsGetNotifications().length;
    const l = amsGetActivityLog().length;
    const bell = document.getElementById("settingsNotifCount");
    const log = document.getElementById("settingsLogCount");
    if (bell) bell.textContent = String(n);
    if (log) log.textContent = String(l);
}

function initNotificationsTab() {
    const toastToggle = document.getElementById("settingsToastEnabled");
    if (toastToggle) {
        toastToggle.checked = amsGetToastEnabled();
        toastToggle.addEventListener("change", () => {
            amsSaveToastEnabled(toastToggle.checked);
            amsNotify(toastToggle.checked ? "Toast popups enabled" : "Toast popups disabled", "info");
        });
    }

    const clearNotif = document.getElementById("btnClearNotifications");
    if (clearNotif) clearNotif.addEventListener("click", () => {
        if (!confirm("Clear all notifications from the bell?")) return;
        amsSaveNotifications([]);
        if (typeof amsRenderBell === "function") amsRenderBell();
        renderNotificationCounts();
        /* amsToast (popup only) so the clear itself does not re-add a record */
        amsToast("Notifications cleared", "info");
    });

    const clearLog = document.getElementById("btnClearActivityLog");
    if (clearLog) clearLog.addEventListener("click", () => {
        if (!confirm("Clear the permanent activity log? This cannot be undone.")) return;
        amsSaveActivityLog([]);
        renderNotificationCounts();
        amsToast("Activity log cleared", "info");
    });
}
/*-------------- End of the code ----------------------------------------------*/

/*-------------- Start Code for DATA TAB -------------------------------------*/
function initDataTab() {
    const roleInput = document.getElementById("settingsSignedInRole");
    if (roleInput) roleInput.value = amsGetViewingAsRole();

    const resetBtn = document.getElementById("btnResetDemoData");
    if (resetBtn) resetBtn.addEventListener("click", () => {
        if (!confirm("Reset all demo data and preferences? Theme, company details, notifications, activity log, portal settings and preferences will be restored to defaults.")) return;
        amsResetDemoData();
        location.reload();
    });
}
/*-------------- End of the code ----------------------------------------------*/

/*-------------- Start Code for PAGE INIT -------------------------------------*/
function initSettings() {
    initLayout("settings");
    initSettingsTabs();
    renderThemeGallery();
    markSelectedTheme();
    renderStyleGallery();
    markSelectedStyle();
    renderFontSize();
    initFontSize();
    loadGeneralTab();
    initGeneralTab();
    initNotificationsTab();
    renderNotificationCounts();
    initDataTab();
}

document.addEventListener("DOMContentLoaded", initSettings);
/*-------------- End of the code ----------------------------------------------*/
/*==============================================================================
#-------------- End of the code : SETTINGS -------------------------------------
#------------------------------------------------------------------------------*/
