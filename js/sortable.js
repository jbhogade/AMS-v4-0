/*==============================================================================
#-------------- Start Code for : SHARED SORTABLE TABLE HELPER (sortable.js) ----
#
#  PURPOSE   : Click-to-sort column headers for every record table in the app.
#              One shared, tiny engine so all pages get identical behaviour.
#
#  USAGE     : 1. Register the page's renderer:
#                  amsSortRegisterRenderer("assetTable", renderAssetTable);
#               2. Build the table header with amsSortableTh(tableId, key, label);
#               3. In the renderer, sort the row array before rendering:
#                  rows = amsSortRows("assetTable", rows, getterMap);
#              getterMap maps each sort key to a fn(row)->comparable value.
#
#  BEHAVIOUR : First click on a column sorts ascending; second click reverses;
#              clicking another column resets to ascending on that column.
#              Numeric getters compare numerically; everything else compares
#              case-insensitively with numeric-aware collation.
#
#  FILTERS   : Excel-style type-in row per data column (contains; numbers
#              also accept = > < >= <= != and n-m). After toolbar filters:
#                  rows = amsFilterRows(tableId, rows, getterMap);
#                  rows = amsSortRows(tableId, rows, getterMap);
#              Paint the type-in row with amsFilterHeadRow(tableId, keys).
#------------------------------------------------------------------------------*/

/* ---- Per-table sort state: { key, dir } ----------------------------------- */
const AMS_SORT = {};
const AMS_SORT_RENDERERS = {};

function amsSortRegisterRenderer(tableId, renderer) {
    AMS_SORT_RENDERERS[tableId] = renderer;
}

/* Toggle sort state for a column and re-render the owning table. */
function amsSortToggle(tableId, key) {
    const st = AMS_SORT[tableId] || (AMS_SORT[tableId] = { key: null, dir: "asc" });
    if (st.key === key) {
        st.dir = st.dir === "asc" ? "desc" : "asc";
    } else {
        st.key = key;
        st.dir = "asc";
    }
    const renderer = AMS_SORT_RENDERERS[tableId];
    if (typeof renderer === "function") renderer();
}

/* Builds a clickable header cell for a sortable column. Optional htmlId is
   added to the <th> so pages can still target it by id (e.g. show/hide). */
function amsSortableTh(tableId, key, label, htmlId) {
    const st = AMS_SORT[tableId] || {};
    const active = st.key === key;
    const arrow = active ? (st.dir === "asc" ? " \u2191" : " \u2193") : " \u2195";
    const idAttr = htmlId ? ` id="${amsEsc(htmlId)}"` : "";
    return `<th${idAttr} class="sortable ${active ? "sort-active" : ""}" title="Sort by ${amsEsc(label)}" onclick="amsSortToggle('${amsEsc(tableId)}','${amsEsc(key)}')">${amsEsc(label)}<span class="sort-arrow">${arrow}</span></th>`;
}

/* Applies the table's current sort to a row array using a getter map. Null /
   undefined values always sort last regardless of direction. */
function amsSortRows(tableId, rows, getterMap) {
    const st = AMS_SORT[tableId];
    if (!st || !st.key || !getterMap[st.key]) return rows;
    const getter = getterMap[st.key];
    const dir = st.dir === "desc" ? -1 : 1;
    const sorted = rows.slice().sort((a, b) => {
        const va = getter(a);
        const vb = getter(b);
        const aNull = va == null || va === "";
        const bNull = vb == null || vb === "";
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        const cmp = (typeof va === "number" && typeof vb === "number")
            ? va - vb
            : String(va).toLowerCase().localeCompare(String(vb).toLowerCase(), undefined, { numeric: true });
        return cmp * dir;
    });
    return sorted;
}

/* Resets any applied sort on a table (e.g. when its filter changes and the
   current column is meaningless). */
function amsSortReset(tableId) {
    delete AMS_SORT[tableId];
}

/* ---- Excel-style column filters ------------------------------------------- */
const AMS_FILTER = {};
let AMS_FILTER_FOCUS = null;

function amsFilterState(tableId) {
    return AMS_FILTER[tableId] || (AMS_FILTER[tableId] = { text: {} });
}

function amsFilterHasAny(tableId) {
    const st = AMS_FILTER[tableId];
    if (!st) return false;
    return Object.keys(st.text).some(k => (st.text[k] || "").trim());
}

function amsParseNumericFilter(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    const range = t.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/);
    if (range) return { op: "range", a: Number(range[1]), b: Number(range[2]) };
    const cmp = t.match(/^(>=|<=|!=|=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
    if (cmp) return { op: cmp[1], n: Number(cmp[2]) };
    return { op: "contains", raw: t };
}

function amsFilterValueMatches(value, text) {
    const isBlank = value == null || value === "";
    const display = isBlank ? "" : String(value);
    const t = String(text || "").trim();
    if (!t) return true;
    if (typeof value === "number") {
        const parsed = amsParseNumericFilter(t);
        if (parsed && parsed.op !== "contains") {
            if (parsed.op === "range") {
                const lo = Math.min(parsed.a, parsed.b);
                const hi = Math.max(parsed.a, parsed.b);
                return value >= lo && value <= hi;
            }
            if (parsed.op === ">=") return value >= parsed.n;
            if (parsed.op === "<=") return value <= parsed.n;
            if (parsed.op === ">") return value > parsed.n;
            if (parsed.op === "<") return value < parsed.n;
            if (parsed.op === "=") return value === parsed.n;
            if (parsed.op === "!=") return value !== parsed.n;
        }
    }
    if (isBlank) return false;
    return display.toLowerCase().includes(t.toLowerCase());
}

function amsFilterRows(tableId, rows, getterMap) {
    const st = AMS_FILTER[tableId];
    if (!st) return rows;
    const keys = Object.keys(getterMap || {});
    return (rows || []).filter(row => {
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const text = st.text[key] || "";
            if (!text.trim()) continue;
            const getter = getterMap[key];
            const val = getter ? getter(row) : "";
            if (!amsFilterValueMatches(val, text)) return false;
        }
        return true;
    });
}

function amsFilterHeadRow(tableId, keys) {
    const st = amsFilterState(tableId);
    const cells = (keys || []).map(k => {
        if (!k) return `<th class="col-filter-cell"></th>`;
        const spec = typeof k === "string" ? { key: k } : k;
        const idAttr = spec.htmlId ? ` id="${amsEsc(spec.htmlId)}"` : "";
        const val = st.text[spec.key] || "";
        return `<th class="col-filter-cell"${idAttr}><input type="text" class="input col-filter-input" data-col-filter-table="${amsEsc(tableId)}" data-col-filter-key="${amsEsc(spec.key)}" value="${amsEsc(val)}" placeholder="Filter" oninput="amsColFilterText(this)" onclick="event.stopPropagation()"></th>`;
    }).join("");
    return `<tr class="col-filter-row">${cells}</tr>`;
}

let AMS_FILTER_DEBOUNCE = {};
const AMS_FILTER_DEBOUNCE_MS = 150;

function amsColFilterText(input) {
    const tableId = input.getAttribute("data-col-filter-table");
    const key = input.getAttribute("data-col-filter-key");
    const st = amsFilterState(tableId);
    st.text[key] = input.value;
    AMS_FILTER_FOCUS = { tableId, key, pos: input.selectionStart };
    const prev = AMS_FILTER_DEBOUNCE[tableId];
    if (prev) clearTimeout(prev);
    AMS_FILTER_DEBOUNCE[tableId] = setTimeout(() => {
        delete AMS_FILTER_DEBOUNCE[tableId];
        const renderer = AMS_SORT_RENDERERS[tableId];
        if (typeof renderer === "function") renderer();
    }, AMS_FILTER_DEBOUNCE_MS);
}

function amsFilterRestoreFocus(tableId) {
    const pending = AMS_FILTER_FOCUS;
    if (!pending || pending.tableId !== tableId) return;
    const el = document.querySelector(`input.col-filter-input[data-col-filter-table="${tableId}"][data-col-filter-key="${pending.key}"]`);
    if (!el) return;
    el.focus();
    if (typeof el.setSelectionRange === "function") {
        const pos = pending.pos == null ? el.value.length : pending.pos;
        try { el.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
    }
}

function amsFilterClear(tableId) {
    AMS_FILTER[tableId] = { text: {} };
    AMS_FILTER_FOCUS = null;
}

function amsFilterClearAndRender(tableId) {
    if (AMS_FILTER_DEBOUNCE[tableId]) {
        clearTimeout(AMS_FILTER_DEBOUNCE[tableId]);
        delete AMS_FILTER_DEBOUNCE[tableId];
    }
    amsFilterClear(tableId);
    const renderer = AMS_SORT_RENDERERS[tableId];
    if (typeof renderer === "function") renderer();
}

function amsTableDataRows(tableEl) {
    if (!tableEl) return [];
    return [...tableEl.querySelectorAll("tr")].filter(tr => !tr.classList.contains("col-filter-row"));
}
