/*==============================================================================
#-------------- Start Code for : THEME SWITCHER (theme.js) --------------------
#
#  PURPOSE   : One Theme dropdown. Color palettes live in themes.css.
#              Surface look is always frosted glass (css/ui-styles.css).
#
#  HOW IT WORKS :
#    - Theme name is saved per signed-in username (ams-theme-by-user).
#    - Login page (no session) uses the shared ams-theme key.
#    - Glass is always on. There is no separate Style control.
#
#  TO ADD A NEW THEME :
#    1. Add the [data-theme="name"] block in css/themes.css
#    2. Add { name: "...", label: "..." } to THEMES below
#    3. It will automatically appear in the dropdown and Settings gallery.
#------------------------------------------------------------------------------*/

/* ---- Available themes (must match the blocks in themes.css) ---------------- */
const THEMES = [
    { name: "platinum",   label: "Platinum"  },
    { name: "dark-gold",  label: "Dark Gold" },
    { name: "midnight",   label: "Midnight"  },
    { name: "obsidian",   label: "Obsidian"  },
    { name: "dark-grey",  label: "Dark Grey" },
    { name: "slate-blue", label: "Slate Blue" },
    { name: "ice",        label: "Ice"       },
    { name: "teal",       label: "Teal"      },
    { name: "forest",     label: "Forest"    },
    { name: "emerald",    label: "Emerald"   },
    { name: "purple",     label: "Purple"    },
    { name: "violet",     label: "Violet"    },
    { name: "wine",       label: "Wine"      },
    { name: "crimson",    label: "Crimson"   },
    { name: "rose-gold",  label: "Rose Gold" },
    { name: "amber",      label: "Amber"     },
    { name: "copper",     label: "Copper"    },
    { name: "lite",       label: "Lite"      },
    { name: "contrast",   label: "Contrast"  }
];

const THEME_STORAGE_KEY = "ams-theme";
const THEME_BY_USER_KEY = "ams-theme-by-user";
const DEFAULT_THEME = "platinum";

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
    if (name === "blue") return DEFAULT_THEME;
    return THEMES.some(t => t.name === name) ? name : DEFAULT_THEME;
}

/* ---- Apply a theme by name -------------------------------------------------- */
function applyTheme(themeName) {
    const name = amsNormalizeThemeName(themeName);
    document.documentElement.setAttribute("data-theme", name);
    document.documentElement.setAttribute("data-ui-style", "glass");
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

/* ---- Style API kept as a no-op so older pages do not break ----------------- */
const UI_STYLES = [
    { name: "glass", label: "Glass", hint: "Frosted glass. Always on." }
];
const UI_STYLE_STORAGE_KEY = "ams-ui-style";
const DEFAULT_UI_STYLE = "glass";

function applyUiStyle() {
    document.documentElement.setAttribute("data-ui-style", "glass");
    try { localStorage.setItem(UI_STYLE_STORAGE_KEY, "glass"); } catch (e) { /* storage unavailable */ }
}

function loadSavedUiStyle() {
    return "glass";
}

function buildStyleMenu() {
    /* Style dropdown removed: Theme is the only appearance control. */
}

/* ---- Initialise theme when the page loads ---------------------------------- */
function initTheme() {
    applyTheme(loadSavedTheme());
    applyUiStyle();
}

/*------------------------------------------------------------------------------
#-------------- End of the code : THEME SWITCHER ------------------------------
#------------------------------------------------------------------------------*/
