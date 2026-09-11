/*==============================================================================
#-------------- Start Code for : COMPANY MASTER (company.js) --------------------
#
#  PURPOSE   : All logic for Company Master - a single-record settings form
#              (Company Name, Address, Logo, HR/Admin contact, Head/Main
#              In-Charge title + contact), NOT a list like the other masters.
#              Once saved, Company Name/Logo/Address fill the print-form
#              letterheads on Asset Issue / Asset Handover forms (read via
#              amsGetCompanyDetails() in dummy-data.js).
#
#  DATA      : Reads + writes AMS_DUMMY_COMPANY_DETAILS via
#              amsGetCompanyDetails() / amsSaveCompanyDetails() in
#              dummy-data.js (localStorage-backed like theme/notifications).
#------------------------------------------------------------------------------*/

/*-------------- Start Code for STATE + LOAD EXISTING VALUES ------------------*/
let CM_STATE = {
    logoDataUrl: amsGetCompanyDetails().logoDataUrl || "",
    bannerDataUrl: amsGetCompanyDetails().bannerDataUrl || "",
};

function amsRenderLogoPreview() {
    const el = document.getElementById("logoPreview");
    el.innerHTML = CM_STATE.logoDataUrl
        ? `<img src="${CM_STATE.logoDataUrl}" alt="Company logo preview">`
        : "No logo set";
}

function amsRenderBannerPreview() {
    const el = document.getElementById("bannerPreview");
    el.innerHTML = CM_STATE.bannerDataUrl
        ? `<img src="${CM_STATE.bannerDataUrl}" alt="Company banner preview">`
        : "No banner set";
}

function amsLoadCompanyForm() {
    const existing = amsGetCompanyDetails();
    document.getElementById("cName").value = existing.companyName || "";
    document.getElementById("cAddress").value = existing.address || "";
    document.getElementById("cSlogan").value = existing.slogan || "";
    document.getElementById("cHrAdminContact").value = existing.hrAdminContact || "";
    document.getElementById("cHeadTitle").value = existing.headTitle || "";
    document.getElementById("cHeadContact").value = existing.headContact || "";
    amsRenderLogoPreview();
    amsRenderBannerPreview();
}
/*-------------- End of the code ----------------------------------------------*/

/*-------------- Start Code for LOGO / BANNER UPLOAD + REMOVE -----------------*/
function amsWireImageUpload(chooseBtnId, fileInputId, removeBtnId, setFn) {
    document.getElementById(chooseBtnId).addEventListener("click", () => document.getElementById(fileInputId).click());

    document.getElementById(fileInputId).addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { alert("Please choose an image file."); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setFn(String(ev.target.result));
        };
        reader.readAsDataURL(file);
    });

    document.getElementById(removeBtnId).addEventListener("click", () => {
        setFn("");
        document.getElementById(fileInputId).value = "";
    });
}

function amsWireImageControls() {
    amsWireImageUpload("btnChooseLogo", "logoFileInput", "btnRemoveLogo", (url) => {
        CM_STATE.logoDataUrl = url;
        amsRenderLogoPreview();
    });
    amsWireImageUpload("btnChooseBanner", "bannerFileInput", "btnRemoveBanner", (url) => {
        CM_STATE.bannerDataUrl = url;
        amsRenderBannerPreview();
    });
}
/*-------------- End of the code ----------------------------------------------*/

/*-------------- Start Code for SAVE -------------------------------------------*/
function amsWireCompanySave() {
    document.getElementById("companyForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const companyName = document.getElementById("cName").value.trim();
        if (!companyName) { alert("Company Name is required."); return; }

        amsSaveCompanyDetails({
            companyName,
            address: document.getElementById("cAddress").value.trim(),
            slogan: document.getElementById("cSlogan").value.trim(),
            logoDataUrl: CM_STATE.logoDataUrl,
            bannerDataUrl: CM_STATE.bannerDataUrl,
            hrAdminContact: document.getElementById("cHrAdminContact").value.trim(),
            headTitle: document.getElementById("cHeadTitle").value.trim(),
            headContact: document.getElementById("cHeadContact").value.trim(),
        });

        amsToast(`Company details saved: ${companyName}`, "success");
    });
}
/*-------------- End of the code ----------------------------------------------*/

/*-------------- Start Code for PAGE INIT --------------------------------------*/
async function initCompany() {
    initLayout("company");
    if (typeof amsDbEnsureLoaded === "function") await amsDbEnsureLoaded();
    amsLoadCompanyForm();
    amsWireImageControls();
    amsWireCompanySave();
}

document.addEventListener("DOMContentLoaded", initCompany);
/*-------------- End of the code ----------------------------------------------*/
/*==============================================================================
#-------------- End of the code : COMPANY MASTER --------------------------------
#------------------------------------------------------------------------------*/
