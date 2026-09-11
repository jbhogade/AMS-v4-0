/*==============================================================================
#-------------- Start Code for : DASHBOARD PAGE LOGIC (dashboard.js) ----------
#
#  PURPOSE   : Fills the Dashboard page with dummy data.
#              All data comes from dummy-data.js, NOT from a database yet.
#
#  TO CONNECT SQL SERVER LATER :
#    - Replace the calls like getAssetSummary() with fetch() / AJAX calls
#      to your backend API, returning the exact same shape of data.
#    - The rendering code below stays unchanged.
#------------------------------------------------------------------------------*/

/* ---- Build the 4 KPI cards at the top of the dashboard --------------------- */
function renderKpiCards() {
    const summary = getAssetSummary();

    const icon = (name) => (typeof amsUiIcon === "function" ? amsUiIcon(name) : "");
    const kpis = [
        {
            icon: "blue", iconText: icon("box"),
            value: summary.total,
            label: "Total Assets",
            trend: "12% vs last month", trendClass: "up"
        },
        {
            icon: "green", iconText: icon("check"),
            value: summary.operational,
            label: "Operational",
            trend: "Healthy fleet", trendClass: "up"
        },
        {
            icon: "amber-warn", iconText: icon("wrench"),
            value: summary.maintenance,
            label: "Under Maintenance",
            trend: "Needs attention", trendClass: "down"
        },
        {
            icon: "cyan", iconText: icon("rupee"),
            value: formatCurrency(summary.totalValue),
            label: "Total Asset Value",
            trend: "Book value", trendClass: "up"
        }
    ];

    const grid = document.getElementById("kpi-grid");
    if (!grid) return;

    grid.innerHTML = kpis.map(k => `
        <div class="kpi-card">
            <div class="kpi-icon ${k.icon}">${k.iconText}</div>
            <div>
                <div class="kpi-value">${escapeHtml(k.value)}</div>
                <div class="kpi-label">${escapeHtml(k.label)}</div>
                <div class="kpi-trend ${k.trendClass}">${escapeHtml(k.trend)}</div>
            </div>
        </div>
    `).join("");
}

/* ---- Build the "Assets by Type" horizontal bar chart -----------------------
   The dummy asset set is mostly IT hardware, so grouping by TYPE (Laptop /
   Desktop / Printer / Monitor) gives a meaningful multi-bar breakdown. */
function renderCategoryChart() {
    const data = getAssetsByType();
    const container = document.getElementById("category-chart");
    if (!container) return;

    /* The widest bar is the 100% reference width */
    const max = Math.max(...data.map(d => d.count), 1);

    const barColors = {
        "Laptop": "#22c55e", "Desktop": "#3b82f6", "Printer": "#f59e0b",
        "Monitor": "#06b6d4", "Smartphone": "#8b5cf6", "Basic Keypad Phone": "#6b7280"
    };

    container.innerHTML = data.map(d => {
        const pct = Math.round((d.count / max) * 100);
        const color = barColors[d.name] || "var(--accent)";
        return `
            <div class="chart-bar-row">
                <div class="chart-bar-label">${escapeHtml(d.name)}</div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill" style="width: ${pct}%; background:${color}"></div>
                </div>
                <div class="chart-bar-value">${d.count}</div>
            </div>
        `;
    }).join("");
}

/* ---- Build the asset status donut (SVG ring) -------------------------------
   Each status gets its OWN colour so the ring no longer collapses into a single
   colour for the total. */
function renderStatusRing() {
    const statusData = getAssetsByStatus();
    const container = document.getElementById("status-ring");
    if (!container) return;

    const total = getAssetSummary().total;
    const colors = {
        "Assigned": "#22c55e", "In Store": "#3b82f6", "In Repair": "#f59e0b",
        "Transfer": "#06b6d4", "Not Working": "#ef4444", "Retired / Scrapped": "#ef4444",
        "Replaced": "#9ca3af", "Operational": "#22c55e", "Under Maintenance": "#f59e0b",
        "Out of Service": "#ef4444"
    };

    /* Build the ring by stacking arcs, each arc its own circle stroke-dash */
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    let arcs = "";

    Object.entries(statusData).forEach(([status, count]) => {
        const fraction = count / total;
        const dash = fraction * circumference;
        const color = colors[status] || "#9ca3af";
        arcs += `
            <circle
                r="${radius}"
                cx="85" cy="85"
                fill="none"
                stroke="${color}"
                stroke-width="16"
                stroke-dasharray="${dash} ${circumference - dash}"
                stroke-dashoffset="${offset}"
            />
        `;
        offset -= dash;
    });

    container.innerHTML = `
        <div class="ring-wrap">
            <div class="ring">
                <svg width="170" height="170" viewBox="0 0 170 170">
                    <circle r="${radius}" cx="85" cy="85" fill="none"
                            stroke="var(--bg-elevated)" stroke-width="16" />
                    ${arcs}
                </svg>
                <div class="ring-center">
                    <strong>${total}</strong>
                    <span>Total Assets</span>
                </div>
            </div>
            <div class="ring-legend">
                ${Object.entries(statusData).map(([status, count]) => `
                    <div class="flex items-center gap-8 mb-16" style="margin-bottom:8px;">
                        <span class="badge-dot" style="background:${colors[status] || '#9ca3af'}"></span>
                        <span class="text-secondary" style="font-size:13px;">${escapeHtml(status)}</span>
                        <span class="badge badge-grey">${count}</span>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

/* ---- Build the "Low Stock Alerts" list (2-column grid) ---------------------- */
function renderLowStock() {
    const items = getLowStockItems();
    const container = document.getElementById("low-stock-list");
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<div class="text-muted">All items are above reorder level.</div>`;
        return;
    }

    container.innerHTML = `
        <div class="low-stock-grid">
            ${items.map(item => `
                <div class="activity-item">
                    <div class="activity-icon" style="background:rgba(245,158,11,0.12);color:var(--warning);">${typeof amsUiIcon === "function" ? amsUiIcon("warn") : "!"}</div>
                    <div class="activity-body">
                        <div class="activity-title">${escapeHtml(item.name)}</div>
                        <div class="activity-meta">${escapeHtml(item.type)} &middot; Stock: ${item.stock} unit(s)</div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

/* ---- Build the "Recent Activity" timeline ---------------------------------- */
function renderActivityLog() {
    const container = document.getElementById("activity-list");
    if (!container) return;

    const ic = (name) => (typeof amsUiIcon === "function" ? amsUiIcon(name) : "");
    const iconMap = {
        success: ["green", ic("check")],
        info:    ["blue",  ic("dot")],
        warning: ["amber-warn", ic("warn")],
        danger:  ["red",  ic("warn")]
    };

    /* Real activity from the shared audit log (amsNotify writes to it), not dummy data. */
    const log = (typeof amsGetActivityLog === "function") ? amsGetActivityLog() : [];
    const entries = log.slice(0, 6);

    if (!entries.length) {
        container.innerHTML = `<li class="activity-item"><div class="activity-body"><div class="activity-meta">No activity recorded yet.</div></div></li>`;
        return;
    }

    container.innerHTML = entries.map(item => {
        const icon = iconMap[item.type] || ["grey", ic("dot")];
        const bg = icon[0] === 'green' ? 'rgba(34,197,94,0.12)'
            : icon[0] === 'red' ? 'rgba(239,68,68,0.12)'
            : icon[0] === 'amber-warn' ? 'rgba(245,158,11,0.12)'
            : icon[0] === 'blue' ? 'rgba(59,130,246,0.12)'
            : 'var(--accent-soft)';
        const fg = icon[0] === 'green' ? 'var(--success)'
            : icon[0] === 'red' ? 'var(--danger)'
            : icon[0] === 'amber-warn' ? 'var(--warning)'
            : 'var(--accent)';
        const time = (typeof amsTimeAgo === "function") ? amsTimeAgo(item.time) : (item.time || "");
        return `
            <li class="activity-item">
                <div class="activity-icon" style="background:${bg};color:${fg};">${icon[1]}</div>
                <div class="activity-body">
                    <div class="activity-title">${escapeHtml(item.message || "")}</div>
                    <div class="activity-meta">${escapeHtml(time)} &middot; ${escapeHtml(item.actorRole || "System")}</div>
                </div>
            </li>
        `;
    }).join("");
}

/* ---- Build the "Recent Assets" table --------------------------------------- */
function renderRecentAssets() {
    const container = document.getElementById("recent-assets");
    if (!container) return;

    /* Show the 6 most recently added assets (keeps the dashboard compact) */
    const recent = DUMMY_ASSETS.slice(0, 6);

    container.innerHTML = recent.map(a => `
        <tr>
            <td><strong>${escapeHtml(a.id)}</strong></td>
            <td>${escapeHtml(a.makeModel)}</td>
            <td>${escapeHtml(a.type)}</td>
            <td>${escapeHtml(a.currentSite)}</td>
            <td><span class="badge ${badgeClassFor(a.status)}"><span class="badge-dot"></span>${escapeHtml(a.status)}</span></td>
            <td class="num">${formatCurrency(a.purchaseCost)}</td>
        </tr>
    `).join("");
}

/* ---- Kick off all dashboard rendering -------------------------------------- */
async function initDashboard() {
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();

    /* Personalise the welcome heading with the signed-in user's display name. */
    const welcome = document.getElementById("welcome-greeting");
    if (welcome) {
        const session = (typeof amsGetSession === "function") ? amsGetSession() : null;
        const name = (session && (session.displayName || session.name)) ? (session.displayName || session.name) : "User";
        welcome.textContent = "Welcome back, " + name;
    }

    renderKpiCards();
    renderCategoryChart();
    renderStatusRing();
    renderLowStock();
    renderActivityLog();
    renderRecentAssets();
}

/*------------------------------------------------------------------------------
#-------------- End of the code : DASHBOARD PAGE LOGIC -------------------------
#------------------------------------------------------------------------------*/
