/*==============================================================================
#-------------- Start Code for : THEME SWITCHER (theme.js) --------------------
#
#  PURPOSE   : Theme dropdown (color palettes). Palettes live in themes.css.
#              Graphite Teal is the default. Apple / macOS / iOS styles are
#              not used.
#
#  HOW IT WORKS :
#    - Theme name is saved per signed-in username (ams-theme-by-user).
#    - Login page (no session) uses the shared ams-theme key.
#    - Nine themes. Old names map via THEME_ALIASES.
#
#  TO ADD A NEW THEME :
#    1. Add the [data-theme="name"] block in css/themes.css
#    2. Add { name: "...", label: "..." } to THEMES below
#    3. It will automatically appear in the dropdown and Settings gallery.
#------------------------------------------------------------------------------*/

/* ---- Available themes (must match the blocks in themes.css) ---------------- */
const THEMES = [
    { name: "graphite",   label: "Graphite Teal" },
    { name: "midnight",   label: "Midnight"  },
    { name: "slate-blue", label: "Slate Blue" },
    { name: "forest",     label: "Forest"    },
    { name: "plum",       label: "Plum"      },
    { name: "gold",       label: "Dark Gold" },
    { name: "ice",        label: "Ice"       },
    { name: "paper",      label: "Paper"     },
    { name: "contrast",   label: "Contrast"  }
];

const THEME_ALIASES = {
    "dark-grey": "graphite",
    lite: "paper",
    purple: "plum",
    "dark-gold": "gold",
    blue: "graphite",
    platinum: "graphite",
    obsidian: "midnight",
    teal: "ice",
    emerald: "forest",
    violet: "plum",
    wine: "gold",
    crimson: "contrast",
    "rose-gold": "gold",
    amber: "gold",
    copper: "gold"
};

const THEME_STORAGE_KEY = "ams-theme";
const THEME_BY_USER_KEY = "ams-theme-by-user";
const DEFAULT_THEME = "graphite";

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
    document.documentElement.removeAttribute("data-ui-style");
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

/* ---- Initialise theme when the page loads ---------------------------------- */
function initTheme() {
    applyTheme(loadSavedTheme());
}

/*------------------------------------------------------------------------------
#-------------- End of the code : THEME SWITCHER ------------------------------
#------------------------------------------------------------------------------*/
