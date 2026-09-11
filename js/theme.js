/*==============================================================================
#-------------- Start Code for : THEME SWITCHER (theme.js) --------------------
#
#  PURPOSE   : Handles switching between the 11 color themes in themes.css
#              and the independent UI styles in ui-styles.css.
#
#  HOW IT WORKS :
#    - Theme name is saved in localStorage and applied as data-theme.
#    - Style name is saved separately and applied as data-ui-style.
#    - Theme = color palette. Style = surface look (glass, clay, etc.).
#
#  TO ADD A NEW THEME :
#    1. Add the [data-theme="name"] block in css/themes.css
#    2. Add { name: "...", label: "..." } to THEMES below
#    3. It will automatically appear in the dropdown menu.
#
#  TO ADD A NEW STYLE :
#    1. Add the [data-ui-style="name"] block in css/ui-styles.css
#    2. Add { name, label, hint } to UI_STYLES below
#------------------------------------------------------------------------------*/

/* ---- Available themes (must match the blocks in themes.css) ---------------- */
const THEMES = [
    { name: "dark-grey",  label: "Dark Grey" },
    { name: "midnight",   label: "Midnight"  },
    { name: "slate-blue", label: "Slate Blue" },
    { name: "blue",       label: "Blue"      },
    { name: "lite",       label: "Lite"      },
    { name: "forest",     label: "Forest"    },
    { name: "purple",     label: "Purple"    },
    { name: "amber",      label: "Amber"     },
    { name: "violet",     label: "Violet"    },
    { name: "crimson",    label: "Crimson"   },
    { name: "contrast",   label: "Contrast"  }
];

const THEME_STORAGE_KEY = "ams-theme";   /* localStorage key that stores the theme */

/* ---- Default theme used on the very first visit ---------------------------- */
const DEFAULT_THEME = "dark-grey";

/* ---- Apply a theme by name -------------------------------------------------- */
function applyTheme(themeName) {
    document.documentElement.setAttribute("data-theme", themeName);
    try { localStorage.setItem(THEME_STORAGE_KEY, themeName); } catch (e) { /* storage unavailable */ }
    document.querySelectorAll("#theme-select").forEach(sel => { sel.value = themeName; });
}

/* ---- Load the saved theme, or fall back to the default ---------------------- */
function loadSavedTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (e) { saved = null; }
    return THEMES.some(t => t.name === saved) ? saved : DEFAULT_THEME;
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

    /* Change theme when the user picks a new one from the dropdown */
    select.addEventListener("change", function () {
        applyTheme(this.value);
    });
}

/* ---- Available UI styles (must match the blocks in ui-styles.css) ---------- */
const UI_STYLES = [
    { name: "default",        label: "Default",        hint: "Current solid panels and shadows." },
    { name: "liquid-glass",   label: "Liquid Glass",   hint: "High blur, light edges, more see-through." },
    { name: "glassmorphism",  label: "Glassmorphism",  hint: "Frosted panels with a glass border." },
    { name: "claymorphism",   label: "Claymorphism",   hint: "Soft clay: large radius, plump shadows." },
    { name: "neomorphism",    label: "Neomorphism",    hint: "Extruded surfaces, no hard border." },
    { name: "skeuomorphism",  label: "Skeuomorphism",  hint: "Beveled, physical highlight and drop." },
    { name: "minimalism",     label: "Minimalism",     hint: "Thin border, no shadow, tight corners." }
];

const UI_STYLE_STORAGE_KEY = "ams-ui-style";
const DEFAULT_UI_STYLE = "default";

function applyUiStyle(styleName) {
    const name = UI_STYLES.some(s => s.name === styleName) ? styleName : DEFAULT_UI_STYLE;
    document.documentElement.setAttribute("data-ui-style", name);
    try { localStorage.setItem(UI_STYLE_STORAGE_KEY, name); } catch (e) { /* storage unavailable */ }
    document.querySelectorAll("#style-select").forEach(sel => { sel.value = name; });
}

function loadSavedUiStyle() {
    let saved = null;
    try { saved = localStorage.getItem(UI_STYLE_STORAGE_KEY); } catch (e) { saved = null; }
    return UI_STYLES.some(s => s.name === saved) ? saved : DEFAULT_UI_STYLE;
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

/* ---- Initialise theme + style when the page loads -------------------------- */
function initTheme() {
    applyTheme(loadSavedTheme());
    applyUiStyle(loadSavedUiStyle());
}

/*------------------------------------------------------------------------------
#-------------- End of the code : THEME SWITCHER ------------------------------
#------------------------------------------------------------------------------*/
