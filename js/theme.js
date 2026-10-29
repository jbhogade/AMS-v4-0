/*==============================================================================
#-------------- Start Code for : THEME SWITCHER (theme.js) --------------------
#
#  PURPOSE   : Theme dropdown (color) plus Style dropdown (Plain / Apple).
#              Color palettes live in themes.css. Surface look lives in
#              css/ui-styles.css.
#
#  HOW IT WORKS :
#    - Theme name is saved per signed-in username (ams-theme-by-user).
#    - Style name is saved per signed-in username (ams-ui-style-by-user).
#    - Login page (no session) uses shared ams-theme and ams-ui-style keys.
#    - Nine themes. Removed names map to a kept theme (see THEME_ALIASES).
#    - Default Style is Apple. Also: Plain, macOS, iOS, iPadOS.
#
#  TO ADD A NEW THEME :
#    1. Add the [data-theme="name"] block in css/themes.css
#    2. Add { name: "...", label: "..." } to THEMES below
#    3. It will automatically appear in the dropdown and Settings gallery.
#------------------------------------------------------------------------------*/

/* ---- Available themes (must match the blocks in themes.css) ---------------- */
const THEMES = [
    { name: "dark-grey",  label: "Dark Grey" },
    { name: "midnight",   label: "Midnight"  },
    { name: "slate-blue", label: "Slate Blue" },
    { name: "lite",       label: "Lite"      },
    { name: "forest",     label: "Forest"    },
    { name: "purple",     label: "Purple"    },
    { name: "ice",        label: "Ice"       },
    { name: "dark-gold",  label: "Dark Gold" },
    { name: "contrast",   label: "Contrast"  }
];

const THEME_ALIASES = {
    blue: "dark-grey",
    platinum: "dark-grey",
    obsidian: "midnight",
    teal: "ice",
    emerald: "forest",
    violet: "purple",
    wine: "dark-gold",
    crimson: "contrast",
    "rose-gold": "dark-gold",
    amber: "dark-gold",
    copper: "dark-gold"
};

const THEME_STORAGE_KEY = "ams-theme";
const THEME_BY_USER_KEY = "ams-theme-by-user";
const DEFAULT_THEME = "dark-grey";

function amsThemeUserKey() {
    const sess = (typeof amsGetSession === "function") ? amsGetSession() : null;
    return (sess && sess.username) ? String(sess.username).trim().toLowerCase() : "";
}

function amsReadThemeMap() {
    try { return JSON.parse(localStorage.getItem(THEME_BY_USER_KEY) || "{}") || {}; }
    catch (e) { return {}; }
}

function amsWriteThemeMap(map) {
    try { localStorage.setItem(THEME_BY_USER_KEY, JSON.stringify(map)); } catch (e) { /* storage unavailable */ }
}

function amsNormalizeThemeName(name) {
    if (THEME_ALIASES[name]) return THEME_ALIASES[name];
    return THEMES.some(t => t.name === name) ? name : DEFAULT_THEME;
}

/* ---- Apply a theme by name -------------------------------------------------- */
function applyTheme(themeName) {
    const name = amsNormalizeThemeName(themeName);
    document.documentElement.setAttribute("data-theme", name);
    try { localStorage.setItem(THEME_STORAGE_KEY, name); } catch (e) { /* storage unavailable */ }
    const user = amsThemeUserKey();
    if (user) {
        const map = amsReadThemeMap();
        map[user] = name;
        amsWriteThemeMap(map);
    }
    document.querySelectorAll("#theme-select").forEach(sel => { sel.value = name; });
}

/* ---- Load the saved theme, or fall back to the default ---------------------- */
function loadSavedTheme() {
    const user = amsThemeUserKey();
    if (user) {
        const map = amsReadThemeMap();
        if (map[user]) return amsNormalizeThemeName(map[user]);
        return DEFAULT_THEME;
    }
    let saved = null;
    try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (e) { saved = null; }
    return amsNormalizeThemeName(saved);
}

/* ---- Build the theme dropdown menu options ---------------------------------- */
function buildThemeMenu(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    THEMES.forEach(theme => {
        const option = document.createElement("option");
        option.value = theme.name;
        option.textContent = theme.label;
        select.appendChild(option);
    });

    select.value = loadSavedTheme();

    select.addEventListener("change", function () {
        applyTheme(this.value);
    });
}

/* ---- Appearance Style (Apple default) -------------------------------------- */
const UI_STYLES = [
    { name: "plain",  label: "Plain",  hint: "Solid surfaces." },
    { name: "apple",  label: "Apple",  hint: "Default. macOS on desktop, iOS spacing on narrow screens." },
    { name: "macos",  label: "macOS",  hint: "Quiet desktop chrome. Compact controls." },
    { name: "ios",    label: "iOS",    hint: "Pill buttons, 44px taps, sheet-like modals." },
    { name: "ipados", label: "iPadOS", hint: "Spacious rounded chrome. 44px taps." }
];
const UI_STYLE_STORAGE_KEY = "ams-ui-style";
const UI_STYLE_BY_USER_KEY = "ams-ui-style-by-user";
const DEFAULT_UI_STYLE = "apple";
const UI_STYLE_ALIASES = {
    default: "plain",
    glass: "plain",
    "liquid-glass": "plain",
    glassmorphism: "plain",
    claymorphism: "plain",
    neomorphism: "plain",
    skeuomorphism: "plain",
    minimalism: "plain"
};

function amsReadStyleMap() {
    try { return JSON.parse(localStorage.getItem(UI_STYLE_BY_USER_KEY) || "{}") || {}; }
    catch (e) { return {}; }
}

function amsWriteStyleMap(map) {
    try { localStorage.setItem(UI_STYLE_BY_USER_KEY, JSON.stringify(map)); } catch (e) { /* storage unavailable */ }
}

function amsNormalizeUiStyle(name) {
    if (UI_STYLE_ALIASES[name]) return UI_STYLE_ALIASES[name];
    return UI_STYLES.some(s => s.name === name) ? name : DEFAULT_UI_STYLE;
}

function applyUiStyle(styleName) {
    const name = amsNormalizeUiStyle(styleName);
    document.documentElement.setAttribute("data-ui-style", name);
    try { localStorage.setItem(UI_STYLE_STORAGE_KEY, name); } catch (e) { /* storage unavailable */ }
    const user = amsThemeUserKey();
    if (user) {
        const map = amsReadStyleMap();
        map[user] = name;
        amsWriteStyleMap(map);
    }
    document.querySelectorAll("#style-select").forEach(sel => { sel.value = name; });
}

function loadSavedUiStyle() {
    const user = amsThemeUserKey();
    if (user) {
        const map = amsReadStyleMap();
        if (map[user]) return amsNormalizeUiStyle(map[user]);
        return DEFAULT_UI_STYLE;
    }
    let saved = null;
    try { saved = localStorage.getItem(UI_STYLE_STORAGE_KEY); } catch (e) { saved = null; }
    return amsNormalizeUiStyle(saved);
}

function buildStyleMenu(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    UI_STYLES.forEach(style => {
        const option = document.createElement("option");
        option.value = style.name;
        option.textContent = style.label;
        select.appendChild(option);
    });

    select.value = loadSavedUiStyle();

    select.addEventListener("change", function () {
        applyUiStyle(this.value);
    });
}

/* ---- Initialise theme when the page loads ---------------------------------- */
function initTheme() {
    applyTheme(loadSavedTheme());
    applyUiStyle(loadSavedUiStyle());
}

/*------------------------------------------------------------------------------
#-------------- End of the code : THEME SWITCHER ------------------------------
#------------------------------------------------------------------------------*/
