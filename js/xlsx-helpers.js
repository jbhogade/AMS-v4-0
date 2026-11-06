/*==============================================================================
#-------------- Start Code for : REAL XLSX HELPERS (xlsx-helpers.js) -----------
#
#  PURPOSE   : Native .xlsx support for every Import / Export / Template flow in
#              the app, powered by the vendored SheetJS build
#              (js/vendor/xlsx.full.min.js). Replaces the old "HTML table as
#              .xls" trick and CSV-only imports.
#
#  EXPORT    : amsExportXlsx(filename, headers, rows)  -> downloads .xlsx
#              amsExportTableToXlsx(filename, tableEl)  -> DOM table -> .xlsx
#              Data sheets are written as Excel tables (autofilter, frozen
#              header, auto column widths). Templates stay plain unless
#              sheet.table is set.
#  IMPORT    : amsReadImportRows(file) -> Promise<2D array of strings>, the same
#              shape amsParseCsv() produces, so every existing import handler
#              works for BOTH .csv and .xlsx with a one-line change.
#  LOAD      : SheetJS is lazy-loaded on first Import / Export / Template via
#              amsEnsureXlsx(). CSV import does not load it.
#------------------------------------------------------------------------------*/

let AMS_XLSX_LOADING = null;

function amsXlsxScriptSrc() {
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src || "";
        if (/xlsx-helpers\.js/i.test(src)) {
            return src.replace(/xlsx-helpers\.js.*$/i, "vendor/xlsx.full.min.js");
        }
    }
    const path = location.pathname || "";
    if (/\/pages(\/|$)/.test(path)) return "../js/vendor/xlsx.full.min.js";
    return "js/vendor/xlsx.full.min.js";
}

function amsEnsureXlsx() {
    if (typeof XLSX !== "undefined") return Promise.resolve();
    if (AMS_XLSX_LOADING) return AMS_XLSX_LOADING;
    AMS_XLSX_LOADING = new Promise((resolve, reject) => {
        const el = document.createElement("script");
        el.src = amsXlsxScriptSrc();
        el.async = true;
        el.onload = () => {
            if (typeof XLSX === "undefined") {
                AMS_XLSX_LOADING = null;
                reject(new Error("Excel library loaded but XLSX is undefined."));
                return;
            }
            resolve();
        };
        el.onerror = () => {
            AMS_XLSX_LOADING = null;
            reject(new Error("Excel export library not loaded. Check js/vendor/xlsx.full.min.js is present."));
        };
        document.head.appendChild(el);
    });
    return AMS_XLSX_LOADING;
}

function amsXlsxMissingAlert(err) {
    const msg = (err && err.message) ? err.message : "Excel export library not loaded. Check js/vendor/xlsx.full.min.js is present.";
    if (typeof amsToast === "function") amsToast(msg, "warning");
    else alert(msg);
}

function amsXlsxColWidth(value) {
    const s = value == null ? "" : String(value);
    return Math.min(60, Math.max(8, s.length + 2));
}

function amsXlsxAutosizeCols(aoa) {
    const colCount = (aoa || []).reduce((m, r) => Math.max(m, (r || []).length), 0);
    const cols = [];
    for (let c = 0; c < colCount; c++) {
        let w = 10;
        for (let r = 0; r < aoa.length; r++) {
            w = Math.max(w, amsXlsxColWidth(aoa[r] && aoa[r][c]));
        }
        cols.push({ wch: w });
    }
    return cols;
}

function amsApplyExcelTableFormat(ws, aoa, opts) {
    opts = opts || {};
    const rows = aoa || [];
    if (!rows.length) return;
    const headerRow = opts.headerRow || 0;
    const colCount = Math.max(1, rows.reduce((m, r) => Math.max(m, (r || []).length), 0));
    const lastRow = Math.max(headerRow, rows.length - 1);
    const range = { s: { r: headerRow, c: 0 }, e: { r: lastRow, c: colCount - 1 } };
    const ref = XLSX.utils.encode_range(range);
    ws["!autofilter"] = { ref: ref };
    ws["!views"] = [{
        state: "frozen",
        ySplit: headerRow + 1,
        topLeftCell: XLSX.utils.encode_cell({ r: headerRow + 1, c: 0 }),
        activeCell: XLSX.utils.encode_cell({ r: headerRow + 1, c: 0 }),
    }];
    const tableName = String(opts.tableName || "AMSTable").replace(/[^A-Za-z0-9_]/g, "") || "AMSTable";
    ws["!tables"] = [{ name: tableName, displayName: tableName, ref: ref, headerRow: true, totalsRow: false }];
    if (!ws["!cols"]) ws["!cols"] = amsXlsxAutosizeCols(rows);
}

function amsWriteWorkbook(filename, sheets) {
    return amsEnsureXlsx().then(() => {
        const wb = XLSX.utils.book_new();
        (sheets || []).forEach((sheet, idx) => {
            const aoa = sheet.aoa || [];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            if (sheet.cols) ws["!cols"] = sheet.cols;
            if (sheet.table) amsApplyExcelTableFormat(ws, aoa, {
                headerRow: sheet.headerRow || 0,
                tableName: sheet.tableName || ("AMSTable" + (idx + 1)),
            });
            XLSX.utils.book_append_sheet(wb, ws, sheet.name || "Sheet1");
        });
        XLSX.writeFile(wb, filename);
    }).catch(amsXlsxMissingAlert);
}

/* Downloads a real .xlsx workbook from column headers + 2D row array. */
function amsExportXlsx(filename, headers, rows) {
    return amsWriteWorkbook(`${filename}.xlsx`, [{
        name: "Report",
        aoa: [headers].concat(rows || []),
        table: true,
        tableName: "AMSReport",
    }]);
}

/* Exports a rendered DOM <table> as a real .xlsx workbook. */
function amsExportTableToXlsx(filename, tableEl) {
    const rows = (typeof amsTableDataRows === "function" ? amsTableDataRows(tableEl) : [...tableEl.querySelectorAll("tr")])
        .map(tr => [...tr.children].map(cell => cell.textContent.trim()));
    if (!rows.length) return;
    return amsExportXlsx(filename, rows[0], rows.slice(1));
}

/* Templates put an Instructions sheet first. Prefer "Template", then the first
   sheet that is not named Instructions, then sheet 0. */
function amsPickImportSheet(wb) {
    const names = wb.SheetNames || [];
    const preferred = names.find(n => /^template$/i.test(n))
        || names.find(n => !/^instructions?$/i.test(n))
        || names[0];
    return wb.Sheets[preferred];
}

function amsReadExcelArrayBuffer(buf) {
    const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
    const ws = amsPickImportSheet(wb);
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, dateNF: "dd-mm-yyyy" });
    return aoa
        .map(row => row.map(c => {
            if (c == null || c === "") return "";
            if (c instanceof Date && !isNaN(c.getTime())) {
                const pad = n => String(n).padStart(2, "0");
                return `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`;
            }
            return String(c);
        }))
        .filter(row => row.some(c => String(c).trim() !== ""));
}

/* Reads an uploaded file and resolves to a 2D array of strings (header row
   first), whether the file is CSV or Excel (.xlsx / legacy .xls). Empty rows
   are dropped, matching amsParseCsv() behaviour so downstream handlers that
   already expect an array-of-arrays can process both formats unchanged. */
function amsReadImportRows(file) {
    const lower = (file.name || "").toLowerCase();
    const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");

    if (isExcel) {
        return amsEnsureXlsx().then(() => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = (e) => {
                try { resolve(amsReadExcelArrayBuffer(e.target.result)); }
                catch (err) { reject(err); }
            };
            reader.readAsArrayBuffer(file);
        }));
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = (e) => resolve(amsParseCsv(String(e.target.result)));
        reader.readAsText(file);
    });
}
