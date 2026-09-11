/*==============================================================================
#-------------- Start Code for : PRINT DOCUMENT ENGINE (print-docs.js) ----------
#
#  PURPOSE   : ONE shared engine that opens the standalone A4 print window for
#              the professional printable forms (Asset Issue Form, Asset
#              Handover Form). Every page that prints a form (Asset Master,
#              Employee Master) builds its own "#printArea" HTML content and
#              hands it to amsPrintDocument() - the shared stylesheet below
#              guarantees all forms look identical (white paper, black text,
#              bordered sections, signature lines).
#
#  HOW IT WORKS :
#    - The page builds the inner form HTML using the .pf-* classes documented
#      in the stylesheet below (pf-header, pf-section-bar, pf-box-grid,
#      pf-asset-table, pf-checklist-grid, pf-notes-box, pf-declaration,
#      pf-sign-grid, pf-footer).
#    - amsPrintDocument() opens a blank window, writes a full HTML document
#      with that content + this shared stylesheet, then triggers window.print().
#
#  PORTED FROM : v3-3 print stylesheet (asset/employee masters), unified into
#                one engine for v4-0 so the three forms (Asset page Asset Issue
#                Form, Employee page Assign Report / Exit Report) stay visually
#                consistent. Uses amsGetCompanyDetails() for the letterhead.
#------------------------------------------------------------------------------*/

/* ---- Shared company-letterhead header for every printed form/report ---------
 *  Builds the <div class="pf-header"> block used on the Asset Issue/Handover
 *  forms and every Report Master printout, so the letterhead always looks
 *  identical across the portal. Respects the Report Header Appearance prefs
 *  (amsGetReportHeaderPrefs in dummy-data.js) - a full-width rectangular
 *  banner image, the square logo, company name, slogan and address can each be
 *  shown/hidden. Company name/logo/slogan/banner come from the Company Master
 *  (amsGetCompanyDetails).
 *  title            : report/form title (shown right-aligned)
 *  metaHtml         : the right-hand meta lines (Form No / Date / Generated)
 *  fallbackSubtitle : text used for the address line when no address is set
 * ----------------------------------------------------------------------------*/
function amsBuildPrintHeader(title, metaHtml, fallbackSubtitle) {
    const c = amsGetCompanyDetails();
    const p = amsGetReportHeaderPrefs();
    const fallback = fallbackSubtitle || "Asset Management System";

    const nameHtml = p.showName ? `<div class="pf-company">${amsEsc(c.companyName || "Your Company Name Pvt. Ltd.")}</div>` : "";
    const sloganHtml = (p.showSlogan && c.slogan) ? `<div class="pf-company-tag">${amsEsc(c.slogan)}</div>` : "";
    const subHtml = p.showAddress ? `<div class="pf-company-sub">${amsEsc(c.address || fallback)}</div>` : "";
    const texts = nameHtml + sloganHtml + subHtml;
    const formmetaHtml = metaHtml || `<div class="pf-form-title">${amsEsc(title).toUpperCase()}</div>`;

    if (p.style === "banner" && c.bannerDataUrl) {
        /* Full-width rectangular banner on top (usually already contains the
           logo, name and slogan) - the optional caption block sits below it
           with the title/meta right-aligned. */
        return `
            <div class="pf-header pf-header-banner">
                <div class="pf-banner-wrap">
                    <img src="${c.bannerDataUrl}" class="pf-banner" alt="Company banner">
                </div>
                <div class="pf-header-row">
                    ${texts ? `<div class="pf-banner-caption">${texts}</div>` : ""}
                    <div class="pf-formmeta">${formmetaHtml}</div>
                </div>
            </div>`;
    }

    /* Classic layout - logo (optional) + company text block on the left */
    return `
        <div class="pf-header">
            <div class="pf-company-block">
                ${p.showLogo && c.logoDataUrl ? `<img src="${c.logoDataUrl}" class="pf-logo" alt="Company logo">` : ""}
                ${texts ? `<div>${texts}</div>` : ""}
            </div>
            <div class="pf-formmeta">${formmetaHtml}</div>
        </div>`;
}

/* ---- Opens the standalone A4 print window with the shared .pf-* stylesheet ----
 *  printContent : the inner body HTML of the form (built by the calling page)
 *  pageTitle    : text shown in the browser tab
 *  orientation  : optional - "landscape" adjusts the content padding for wide
 *                 (A4 landscape) layouts; anything else uses portrait padding.
 *                 The @page rule deliberately does NOT force a paper size, so
 *                 the browser's Print Setup keeps the Layout (Portrait /
 *                 Landscape) and paper-size controls enabled for the user.
 * ----------------------------------------------------------------------------*/
function amsPrintDocument(printContent, pageTitle, orientation) {
    const landscape = orientation === "landscape";
    const win = window.open("", "_blank");
    if (!win) {
        alert("Popup blocked. Please allow popups for this site to use the print view.");
        return;
    }
    /* Margin-only @page rule. A `size` keyword here (e.g. A4 landscape) makes
       Chrome grey out / hide the Layout (orientation) and paper-size options in
       the print dialog - so we never set one. */
    const pageRule = "@page { margin: 10mm 12mm; }";
    win.document.write(`
        <html>
        <head>
            <title>${amsEsc(pageTitle)}</title>
            <style>
                /*-------------- Start Code for PRINT-ONLY STYLESHEET (standalone, no theme vars) -----------------*/
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 26px 34px; }

                .pf-header { display: flex; justify-content: space-between; align-items: flex-start;
                    border-bottom: 3px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 16px; }
                .pf-company-block { display: flex; align-items: center; gap: 10px; }
                .pf-logo { width: 42px; height: 42px; object-fit: contain; flex-shrink: 0; }
                .pf-company { font-size: 18px; font-weight: 800; letter-spacing: 0.3px; }
                .pf-company-tag { font-size: 11.5px; color: #444; font-style: italic; margin-top: 1px; }
                .pf-company-sub { font-size: 10.5px; color: #555; margin-top: 2px; }
                /* Rectangular banner letterhead (Report Header Appearance) */
                .pf-header-banner { display: block; }
                .pf-banner-wrap { margin: 0 0 8px; text-align: center; border: 1px solid #ddd; }
                .pf-banner { max-width: 100%; max-height: 110px; object-fit: contain; display: inline-block; }
                .pf-header-banner .pf-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
                .pf-banner-caption { font-size: 11px; color: #555; line-height: 1.5; }
                .pf-banner-caption .pf-company { font-size: 16px; }
                .pf-formmeta { text-align: right; font-size: 11.5px; line-height: 1.6; }
                .pf-form-title { font-size: 15px; font-weight: 800; letter-spacing: 0.6px; margin-bottom: 4px; }
                .pf-title-issue { color: #1a3d6d; }
                .pf-title-handover { color: #c0392b; }

                .pf-section-bar { background: #1a1a1a; color: #fff; font-size: 11px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.6px; padding: 6px 10px; margin: 16px 0 0; }
                .pf-section-bar.pf-bar-accent { background: #c0392b; }

                .pf-box-grid { display: grid; border: 1px solid #999; border-top: none; }
                .pf-box-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
                .pf-box-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
                .pf-box { border-top: 1px solid #999; border-left: 1px solid #999; padding: 6px 10px; }
                .pf-box:first-child { border-left: none; }
                .pf-box-grid.cols-2 .pf-box:nth-child(2n+1),
                .pf-box-grid.cols-3 .pf-box:nth-child(3n+1) { border-left: none; }
                .pf-box-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; color: #666; margin-bottom: 3px; }
                .pf-box-value { font-size: 12.5px; font-weight: 600; color: #111; }
                /* A box that spans every column of a pf-box-grid (e.g. Exit
                   Reason on the Handover Form) and the blank writing line that
                   sits beneath its value. */
                .pf-box-grid .pf-box.pf-box-wide { grid-column: 1 / -1; border-left: none; }
                .pf-box-line { border-bottom: 1px solid #333; height: 22px; margin-top: 2px; }

                table.pf-asset-table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 0; }
                .pf-asset-table th, .pf-asset-table td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
                .pf-asset-table th { background: #f0f0f0; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; }
                .pf-check-inline { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; margin-right: 8px; white-space: nowrap; }

                .pf-checklist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px;
                    border: 1px solid #999; border-top: none; padding: 10px 12px; }
                .pf-check-block { display: flex; align-items: center; gap: 8px; font-size: 11.5px; }
                .pf-acc-asset { color: #555; font-size: 10px; }

                .pf-notes-box { border: 1px solid #999; border-top: none; min-height: 40px; padding: 8px 10px;
                    font-size: 11.5px; line-height: 1.5; color: #1a1a1a; }
                .pf-notes-box strong { font-weight: 700; font-size: inherit; font-style: inherit; font-family: inherit; }
                .pf-notes-empty { color: #999; font-style: italic; }

                /* Additional Remarks/Notes (IT/HR/Admin) - a distinct, boxed
                   section kept separate from the asset "Remarks / Notes". */
                .pf-additional-box {
                    border: 1px solid #999;
                    border-top: none;
                    border-left: 4px solid #c0392b;
                    background: #fdf6ec;
                    min-height: 64px;
                    padding: 10px 12px;
                }
                .pf-additional-content { font-size: 12px; line-height: 1.5; min-height: 36px; white-space: pre-wrap; }
                .pf-additional-sign {
                    display: flex;
                    justify-content: space-between;
                    gap: 16px;
                    margin-top: 16px;
                    padding-top: 8px;
                    border-top: 1px dashed #999;
                    font-size: 10.5px;
                    color: #444;
                }

                .pf-declaration { font-size: 10.5px; color: #333; line-height: 1.55; border: 1px solid #ccc;
                    background: #fafafa; padding: 10px 14px 10px 26px; margin: 16px 0 40px; }
                .pf-declaration li { margin-bottom: 3px; }

                .pf-sign-grid { display: flex; justify-content: space-between; gap: 20px; }
                .pf-sign-box { flex: 1; text-align: center; }
                .pf-sign-line { border-bottom: 1px solid #333; height: 40px; }
                .pf-sign-label { font-size: 11px; color: #444; margin-top: 6px; }

                .pf-footer { display: flex; justify-content: space-between; font-size: 9.5px; color: #888;
                    border-top: 1px solid #ccc; margin-top: 20px; padding-top: 8px; }

                .mono { font-family: 'Consolas', monospace; }
                ${pageRule}
                @media print { body { padding: ${landscape ? "10mm 14mm" : "8mm 12mm"}; } }
                /*-------------- End of the code --------------------------------*/
            </style>
        </head>
        <body>${printContent}</body>
        </html>`);
    win.document.close();
    win.print();
}

/*------------------------------------------------------------------------------
#-------------- End of the code : PRINT DOCUMENT ENGINE ------------------------
#------------------------------------------------------------------------------*/
