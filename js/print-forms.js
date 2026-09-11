/*==============================================================================
#-------------- Start Code for : PRINT FORMS (print-forms.js) -------------------
#
#  PURPOSE   : Generates the professional Asset Issue Form (Assign Report) and
#              Asset Handover Form (Exit Report) for one employee, and opens
#              them in a NEW BROWSER TAB ready to print / save as PDF.
#
#  HOW IT WORKS :
#    - amsGenerateReport(amsId, type, extraRemarks) is called from the Employee
#      Master page after the print-remarks modal. "assign" builds the ASSET
#      ISSUE FORM for an ACTIVE employee (live data - all assets they currently
#      hold). "exit" builds the ASSET HANDOVER FORM for an EXITED employee and
#      reads the permanent EXIT RECORD snapshot captured at the moment of exit,
#      so the printed form stays accurate regardless of what happens to the
#      assets / org chart afterward.
#    - The document body is written with the shared .pf-* classes and opened
#      via amsPrintDocument() (js/print-docs.js), so it matches the Asset
#      Master's own Asset Issue Form exactly (white paper, black text, company
#      letterhead from amsGetCompanyDetails()).
#------------------------------------------------------------------------------*/

/* ---- Per-form serial numbers (AIF = Asset Issue Form, AHF = Asset Handover) */
const AMS_PRINT_COUNTERS = { AIF: 0, AHF: 0 };

function amsGenerateFormNo(prefix) {
    AMS_PRINT_COUNTERS[prefix] = (AMS_PRINT_COUNTERS[prefix] || 0) + 1;
    return `${prefix}-${String(AMS_PRINT_COUNTERS[prefix]).padStart(6, "0")}`;
}

/* ---- "Remarks / Notes" body: ONLY each asset's stored remarks (added when
       the asset was created in the system). The typed pre-print note is
       rendered separately by amsBuildAdditionalRemarks() below. */
function amsBuildReportRemarks(assetsList) {
    const lines = [];
    assetsList.forEach(oa => {
        const assetLabel = amsPrintAssetId(oa);
        if (oa.remarks) lines.push(`<div><strong>${amsEsc(assetLabel)} - Remarks (on record):</strong> ${amsEsc(oa.remarks)}</div>`);
    });
    if (!lines.length) lines.push(`<div class="pf-notes-empty">No remarks recorded against the asset(s) in the system.</div>`);
    return lines.join("");
}

/* ---- "Additional Remarks/Notes (IT/HR/Admin)" body: the note typed into the
       pre-print modal (or blank space if nothing was typed). Rendered as its
       OWN section, separate from the asset "Remarks / Notes", with a signature
       line so IT/HR/Admin can attest it in writing. */
function amsBuildAdditionalRemarks(extraRemarks) {
    const content = extraRemarks
        ? amsEsc(extraRemarks)
        : `<span class="pf-notes-empty">(Blank - to be filled in writing by IT / HR / Admin, if applicable)</span>`;
    return `
        <div class="pf-additional-box">
            <div class="pf-additional-content">${content}</div>
            <div class="pf-additional-sign">
                <span>Name &amp; Signature (IT / HR / Admin): _______________________________</span>
                <span>Date: ________________</span>
            </div>
        </div>`;
}

/* ---- Assets held by the employee's direct subordinates (for reference) ---- */
function amsSubordinateAssetsDetailed(amsId) {
    const list = [];
    getSubordinates(amsId).forEach(sub => {
        getEmployeeAssets(sub.amsId).forEach(a => list.push({
            ...a, subName: getEmployeeFullName(sub), subEmpId: amsGetEmployeeDisplayId(sub),
        }));
    });
    return list;
}

/* =============================================================================
   MAIN REPORT GENERATOR
   amsId        : the employee's AMS ID
   type         : "assign" (Asset Issue Form) | "exit" (Asset Handover Form)
   extraRemarks : optional note typed into the pre-print modal
   ===========================================================================*/
function amsGenerateReport(amsId, type, extraRemarks) {
    const isIssue = type !== "exit";
    const emp = findEmployee(amsId);
    if (!emp) return;

    /* Exit Report reads the permanent snapshot so it reflects the exact state
       at the moment of exit; Issue Report uses live/current data. */
    const exitRecord = isIssue ? null : getExitRecord(amsId);
    const owned = exitRecord
        ? exitRecord.directAssetsHeld
        : getEmployeeAssets(amsId);

    /* Split the employee's assets into directly-held vs subordinate/team-held,
       and derive the printed "Assignment Type" from that mix. */
    const splitOwned = isIssue ? amsSplitDirectVsSubordinateAssets(owned) : null;
    const directOwned = splitOwned ? splitOwned.direct : owned;
    const subOwned = splitOwned ? splitOwned.subordinate : [];
    const subAssets = isIssue ? amsSubordinateAssetsDetailed(amsId) : [];
    const mobileSimPreview = typeof amsBuildPrintMobileSimHtml === "function"
        ? amsBuildPrintMobileSimHtml(amsId, { withCondition: isIssue, returnedLabel: !isIssue, exitRecord: isIssue ? null : exitRecord })
        : { html: "", mobileDirect: 0, mobileTeam: 0, simDirect: 0, simTeam: 0 };
    const assignmentType = isIssue
        ? amsAssignmentTypeLabel(
            directOwned.length + mobileSimPreview.mobileDirect + mobileSimPreview.simDirect,
            subOwned.length + subAssets.length + mobileSimPreview.mobileTeam + mobileSimPreview.simTeam)
        : "";

    const title = isIssue ? "Asset Issue Form" : "Asset Handover Form";
    const formNo = amsGenerateFormNo(isIssue ? "AIF" : "AHF");
    const today = amsFormatDate(new Date().toISOString().slice(0, 10));
    const managerEmp = emp.managerAmsId ? findEmployee(emp.managerAmsId) : null;
    const managerName = managerEmp ? getEmployeeFullName(managerEmp) : "-";
    const exitDate = exitRecord ? amsFormatDate(exitRecord.exitDate) : today;

    const terms = isIssue ? [
        "The employee acknowledges receipt of the above asset(s) in the condition noted, unless otherwise stated.",
        "The asset(s) remain company property and must be returned upon request, transfer, or exit.",
        "The employee is responsible for the safekeeping and proper use of the asset(s).",
        "Any loss, theft, or damage must be reported to IT/Admin immediately.",
        "This form must be retained for company records and produced upon asset return or audit.",
    ] : [
        "The exiting employee confirms that all company asset(s) listed above have been returned in the condition stated.",
        "The IT/Admin representative confirms physical verification of all returned asset(s).",
        "Any asset(s) lost or found damaged beyond normal wear may be subject to recovery as per company policy.",
        "This form serves as the official record of asset handover and must be retained for audit purposes.",
    ];

    const infoBox = (label, value) => `<div class="pf-box"><div class="pf-box-label">${amsEsc(label)}</div><div class="pf-box-value">${value || "&nbsp;"}</div></div>`;

    const infoBoxesHtml = isIssue ? `
        <div class="pf-box-grid cols-2">
            ${infoBox("Employee ID", amsEsc(amsGetEmployeeDisplayId(emp)))}
            ${infoBox("Full Name", amsEsc(getEmployeeFullName(emp)))}
            ${infoBox("Department", amsEsc(emp.department))}
            ${infoBox("Designation", amsEsc(emp.designation))}
            ${infoBox("Reporting Manager", amsEsc(managerName))}
            ${infoBox("Assignment Type", amsEsc(assignmentType))}
        </div>
        <div class="pf-box-grid cols-3">
            ${infoBox("Date of Issue", today)}
            ${infoBox("Expected Return", "Not Specified")}
            ${infoBox("Issued By", "IT / Admin")}
        </div>` : `
        <div class="pf-box-grid cols-2">
            ${infoBox("Employee ID", amsEsc(amsGetEmployeeDisplayId(emp)))}
            ${infoBox("Full Name", amsEsc(getEmployeeFullName(emp)))}
            ${infoBox("Department", amsEsc(emp.department))}
            ${infoBox("Designation", amsEsc(emp.designation))}
            ${infoBox("Reporting Manager", amsEsc(managerName))}
            ${infoBox("New Incharge / HOD", exitRecord && exitRecord.teamTransferredTo ? amsEsc(exitRecord.teamTransferredTo.name) + " (" + amsEsc(exitRecord.teamTransferredTo.empId) + ")" : "N/A - No team transferred")}
            <div class="pf-box pf-box-wide">
                <div class="pf-box-label">Exit Reason</div>
                <div class="pf-box-value">${exitRecord && (exitRecord.exitReason || exitRecord.exitRemarks) ? amsEsc(exitRecord.exitReason || exitRecord.exitRemarks) : "&nbsp;"}</div>
                <div class="pf-box-line"></div>
            </div>
        </div>
        <div class="pf-box-grid cols-3">
            ${infoBox("Date of Exit", exitDate)}
            ${infoBox("Form Generated", today)}
            ${infoBox("Assets Returned", String(owned.length))}
        </div>`;

    const conditionRow = () => ["Good", "Needs Repair / Service", "Damaged"].map(o => `
        <label class="pf-check-inline"><input type="checkbox" disabled> ${o}</label>`).join("");

    /* Assets issued directly to the employee (ALL assets assigned to them)
       stay in "Assets Issued". Assets whose actual user is a subordinate/team
       member (User master record or free text) show in the "For Reference"
       section instead. */

    const assetTableHtml = `
        <table class="pf-asset-table">
            <thead>
                <tr><th style="width:30px;">#</th><th>Asset ID</th><th>Asset Name / Type</th><th>Site</th><th>${isIssue ? "Physical Condition at Issue" : "Condition at Return"}</th></tr>
            </thead>
            <tbody>
                ${directOwned.length ? directOwned.map((oa, i) => `
                    <tr>
                        <td>${i + 1}</td><td class="mono">${amsEsc(amsPrintAssetId(oa))}</td><td>${amsEsc(oa.type)}${oa.makeModel ? ` (${amsEsc(oa.makeModel)})` : ""}</td><td>${amsEsc(oa.currentSite || oa.site || "-")}</td>
                        <td>${conditionRow()}</td>
                    </tr>`).join("")
                    : `<tr><td colspan="5" style="text-align:center; color:#777;">No assets currently on record for this employee</td></tr>`}
            </tbody>
        </table>`;

    const accessoryItems = isIssue && (typeof amsPrintDirectHoldingsForAccessories === "function")
        ? amsPrintDirectHoldingsForAccessories(amsId, directOwned)
        : directOwned;
    const accessoriesHtml = isIssue && (typeof amsBuildPrintAccessoriesHtml === "function")
        ? amsBuildPrintAccessoriesHtml(accessoryItems)
        : "";

    const mobileSimPrint = mobileSimPreview;

    const subRows = subAssets.map(sa => ({
        id: amsPrintAssetId(sa), type: sa.type, makeModel: sa.makeModel,
        site: sa.currentSite || sa.site, holder: sa.subName, holderId: sa.subEmpId,
    }));
    subOwned.forEach(oa => {
        const holderEmp = oa.assignedToSubordinate ? amsGetEmployeeByAmsId(oa.assignedToSubordinate) : null;
        subRows.push({
            id: amsPrintAssetId(oa), type: oa.type, makeModel: oa.makeModel,
            site: oa.currentSite || oa.site,
            holder: holderEmp ? holderEmp.name : (oa.assignedSubText || amsAssetHolderLabel(oa)),
            holderId: holderEmp ? amsGetEmployeeDisplayId(holderEmp) : "",
        });
    });
    const subordinateHtml = subRows.length ? `
        <div class="pf-section-bar">Assets Currently Assigned to Subordinates (For Reference)</div>
        <table class="pf-asset-table">
            <thead><tr><th style="width:30px;">#</th><th>Asset ID</th><th>Type</th><th>Held By</th><th>Employee ID</th><th>Site</th></tr></thead>
            <tbody>
                ${subRows.map((sa, i) => `
                    <tr><td>${i + 1}</td><td class="mono">${amsEsc(sa.id)}</td><td>${amsEsc(sa.type)}${sa.makeModel ? ` (${amsEsc(sa.makeModel)})` : ""}</td><td>${amsEsc(sa.holder)}</td><td class="mono">${sa.holderId ? amsEsc(sa.holderId) : "-"}</td><td>${amsEsc(sa.site)}</td></tr>`).join("")}
            </tbody>
        </table>` : "";

    const transferHtml = !isIssue && exitRecord && exitRecord.subordinateAssetsTransferred && exitRecord.subordinateAssetsTransferred.length ? `
        <div class="pf-section-bar pf-bar-accent">Subordinate / Team Assets Transferred</div>
        <div class="pf-notes-box">
            <div><strong>New Incharge / HOD:</strong> ${exitRecord.teamTransferredTo ? amsEsc(exitRecord.teamTransferredTo.name) + " (" + amsEsc(exitRecord.teamTransferredTo.empId) + ")" : "-"}</div>
            ${exitRecord.subordinateAssetsTransferred.map(t => `
                <div style="margin-top:6px;"><strong>${amsEsc(t.subName)} (${amsEsc(t.subEmpId)}) - ${amsEsc(t.assetId)}:</strong> ${amsEsc(t.type)}${t.makeModel ? " (" + amsEsc(t.makeModel) + ")" : ""} &middot; ${amsEsc(t.site || "-")}</div>`).join("")}
        </div>` : "";

    const clearanceHtml = !isIssue ? `
        <div class="pf-section-bar pf-bar-accent">Clearance Checklist</div>
        <div class="pf-checklist-grid">
            <label class="pf-check-block"><input type="checkbox" disabled> All listed assets physically returned</label>
            <label class="pf-check-block"><input type="checkbox" disabled> Asset condition verified by IT/Admin</label>
            ${(exitRecord ? exitRecord.facilitiesDisabled : []).map(f => `
                <label class="pf-check-block"><input type="checkbox" disabled> ${amsEsc(f)} revoked</label>`).join("")}
            ${((exitRecord && exitRecord.facilitiesNotApplicable) ? exitRecord.facilitiesNotApplicable : []).map(f => `
                <label class="pf-check-block"><input type="checkbox" disabled> ${amsEsc(f)} - N/A</label>`).join("")}
            <label class="pf-check-block"><input type="checkbox" disabled> Subordinate assets flagged for reassignment (if applicable)</label>
        </div>` : "";

    const headerHtml = amsBuildPrintHeader(title, `
        <div class="pf-form-title ${isIssue ? "pf-title-issue" : "pf-title-handover"}">${title.toUpperCase()}</div>
        <div><strong>Form No:</strong> ${formNo}</div>
        <div><strong>Date Generated:</strong> ${today}</div>`, "Asset Management System · IT Infrastructure Department");

    const printContent = `
        <div id="printArea">
            ${headerHtml}

            <div class="pf-section-bar">${isIssue ? "Issued To" : "Employee Details (Exiting)"}</div>
            ${infoBoxesHtml}

            <div class="pf-section-bar ${isIssue ? "" : "pf-bar-accent"}">${isIssue ? "Assets Issued" : "Assets Returned (Direct Assignment Only)"}</div>
            ${assetTableHtml}

            ${accessoriesHtml}
            ${subordinateHtml}
            ${mobileSimPrint.html}
            ${transferHtml}
            ${clearanceHtml}

            <div class="pf-section-bar">Remarks / Notes</div>
            <div class="pf-notes-box">
                ${amsBuildReportRemarks(directOwned)}
            </div>

            <div class="pf-section-bar pf-bar-accent">Additional Remarks/Notes (IT/HR/Admin)</div>
            ${amsBuildAdditionalRemarks(extraRemarks)}

            <ol class="pf-declaration">
                ${terms.map(t => `<li>${t}</li>`).join("")}
            </ol>

            <div class="pf-sign-grid">
                ${isIssue ? `
                <div class="pf-sign-box">
                    <div class="pf-sign-line"></div>
                    <div class="pf-sign-label">Authorised By<br>Signature &amp; Date</div>
                </div>
                <div class="pf-sign-box">
                    <div class="pf-sign-line"></div>
                    <div class="pf-sign-label">Issued By (IT / Admin)<br>Signature &amp; Date</div>
                </div>
                <div class="pf-sign-box">
                    <div class="pf-sign-line"></div>
                    <div class="pf-sign-label">Employee<br>Signature &amp; Date</div>
                </div>` : `
                <div class="pf-sign-box">
                    <div class="pf-sign-line"></div>
                    <div class="pf-sign-label">Employee<br>Signature &amp; Date</div>
                </div>
                <div class="pf-sign-box">
                    <div class="pf-sign-line"></div>
                    <div class="pf-sign-label">Received By (IT / Admin)<br>Signature &amp; Date</div>
                </div>
                <div class="pf-sign-box">
                    <div class="pf-sign-line"></div>
                    <div class="pf-sign-label">Authorised By<br>Signature &amp; Date</div>
                </div>`}
            </div>

            <div class="pf-footer">
                <span>AMS v4 - Generated electronically</span>
                <span>Internal Ref: ${formNo} &middot; ${directOwned.length} asset(s) ${isIssue ? "issued" : "returned"}${isIssue ? ` &middot; ${directOwned.length} direct, ${subOwned.length + subAssets.length} team` : ""}${mobileSimPrint.mobileDirect || mobileSimPrint.mobileTeam ? ` &middot; ${mobileSimPrint.mobileDirect} mobile(s), ${mobileSimPrint.mobileTeam} team` : ""}${mobileSimPrint.simDirect || mobileSimPrint.simTeam ? ` &middot; ${mobileSimPrint.simDirect} SIM(s), ${mobileSimPrint.simTeam} team` : ""}</span>
            </div>
        </div>
    `;

    /* Landscape orientation suits the multi-column asset table on both the
       Assign Report (Asset Issue Form) and the Exit Report (Handover Form). */
    amsPrintDocument(printContent, title, "landscape");
}

/*------------------------------------------------------------------------------
#-------------- End of the code : PRINT FORMS ---------------------------------
#------------------------------------------------------------------------------*/
