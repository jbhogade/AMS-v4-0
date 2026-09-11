/*==============================================================================
#-------------- Start Code for : UNDER CONSTRUCTION HELPER --------------------
#
#  PURPOSE   : Shows a friendly "page coming soon" panel on pages that have
#              not been built yet (Assets, Consumables, etc.).
#              Once a page is built for real, remove this call from its file.
#------------------------------------------------------------------------------*/

/* ---- Fill the placeholder panel with a build-status message ----------------- */
function renderUnderConstruction(pageTitle) {
    const mount = document.getElementById("construction-content");
    if (!mount) return;

    mount.innerHTML = `
        <div class="page-heading">
            <h1>${escapeHtml(pageTitle)}</h1>
            <p>This page is on the build plan and will be created in the next step.</p>
        </div>
        <div class="card">
            <div class="card-body" style="text-align:center;padding:56px 20px;">
                <div style="color:var(--accent);margin-bottom:12px;">${typeof amsUiIcon === "function" ? amsUiIcon("clock") : ""}</div>
                <h2 style="margin-bottom:8px;">Under Construction</h2>
                <p class="text-secondary" style="max-width:460px;margin:0 auto;">
                    We are building this portal page by page. The Dashboard is live now;
                    this page will be developed next. Please check back later.
                </p>
                <div class="mt-24">
                    <a href="../index.html" class="btn btn-primary">Go to Dashboard</a>
                </div>
            </div>
        </div>
    `;
}

/*------------------------------------------------------------------------------
#-------------- End of the code : UNDER CONSTRUCTION HELPER --------------------
#------------------------------------------------------------------------------*/
