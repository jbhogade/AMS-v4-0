/* =============================================================================
   PROFILE PAGE (pages/profile.html)
   - Loads the signed-in account's full profile (GET /api/auth/me), falls back
     to the stored session when the API is unreachable.
   - Save profile fields via PUT /api/auth/me and refresh the session.
   - Change password with current-password verification.
   ===========================================================================*/

(function () {
    let profileLoaded = false;

    function initialsOf(name) {
        if (!name) return "OP";
        return name.split(/\s+/).map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase() || "OP";
    }

    function fillForm(profile) {
        const set = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v || "";
        };
        set("pf-displayName", profile.displayName || "");
        set("pf-email", profile.email || "");
        set("pf-contactNo", profile.contactNo || "");
        set("pf-gender", profile.gender || "");
        set("pf-dob", profile.dob || "");
        set("pf-address", profile.address || "");
    }

    function renderSummary(profile) {
        const name = profile.displayName || profile.linkedEmployee || profile.username || "Operator";
        const avatar = document.getElementById("profile-avatar");
        if (avatar) { avatar.textContent = initialsOf(name); }
        const disp = document.getElementById("profile-display");
        if (disp) disp.textContent = name;
        const un = document.getElementById("profile-username");
        if (un) un.textContent = `${profile.username || ""}  -  ${profile.role || ""}`;
    }

    async function loadProfile() {
        let profile = null;
        const sess = amsGetSession();
        try {
            if (sess && sess.token) profile = await amsApiFetch("/api/auth/me");
        } catch (e) {
            profile = null; // offline fallback below
        }
        if (!profile && sess) {
            profile = {
                username: sess.username, role: sess.role,
                displayName: sess.displayName, linkedEmployee: sess.linkedEmployee,
                email: sess.email, contactNo: sess.contactNo,
                address: sess.address, dob: sess.dob, gender: sess.gender,
            };
        }
        if (!profile) profile = { username: "", role: "", displayName: "" };
        renderSummary(profile);
        fillForm(profile);
        profileLoaded = true;
    }

    async function saveProfile() {
        const status = document.getElementById("pf-status");
        if (!profileLoaded) { status.textContent = "Profile not loaded yet."; return; }
        const payload = {
            displayName: document.getElementById("pf-displayName").value.trim(),
            email: document.getElementById("pf-email").value.trim(),
            contactNo: document.getElementById("pf-contactNo").value.trim(),
            gender: document.getElementById("pf-gender").value,
            dob: document.getElementById("pf-dob").value,
            address: document.getElementById("pf-address").value.trim(),
        };
        status.textContent = "Saving...";
        status.style.color = "var(--text-muted)";
        let updated = null;
        let savedLocally = false;
        try {
            updated = await amsApiFetch("/api/auth/me", { method: "PUT", body: payload });
        } catch (e) {
            /* API / database unreachable (static preview, DB down, ...). Keep
               demo mode working by persisting the fields to the local session,
               and say clearly that the change is preview-only. */
            savedLocally = true;
        }
        amsUpdateSession({
            displayName: (updated && updated.displayName) || payload.displayName || null,
            name: (updated && updated.displayName) || payload.displayName || null,
            email: payload.email, contactNo: payload.contactNo,
            address: payload.address, dob: payload.dob, gender: payload.gender,
        });
        renderSummary(updated || amsGetSession() || {});
        status.textContent = savedLocally
            ? "Profile saved locally (database unavailable - changes are preview-only)."
            : "Profile saved.";
        status.style.color = savedLocally ? "var(--warning)" : "var(--success)";
    }

    async function changePassword() {
        const status = document.getElementById("pw-status");
        const current = document.getElementById("pw-current").value;
        const fresh = document.getElementById("pw-new").value;
        const confirm = document.getElementById("pw-confirm").value;
        if (!current || !fresh) { status.textContent = "Current and new passwords are required."; status.style.color = "var(--danger)"; return; }
        if (fresh.length < 6) { status.textContent = "New password must be at least 6 characters."; status.style.color = "var(--danger)"; return; }
        if (fresh !== confirm) { status.textContent = "New password and confirmation do not match."; status.style.color = "var(--danger)"; return; }
        status.textContent = "Updating...";
        status.style.color = "var(--text-muted)";
        try {
            await amsApiFetch("/api/auth/me", { method: "PUT", body: { currentPassword: current, newPassword: fresh } });
            status.textContent = "Password changed.";
            status.style.color = "var(--success)";
            document.getElementById("pw-current").value = "";
            document.getElementById("pw-new").value = "";
            document.getElementById("pw-confirm").value = "";
        } catch (e) {
            /* A raw transport/HTTP failure (API or database unreachable) is not
               a "wrong password" answer - say so instead of "API error 501". */
            const msg = (e && e.message) || "";
            status.textContent = (/^API error/.test(msg) || /Cannot reach/.test(msg))
                ? "Password change requires the AMS-Test API and database to be reachable."
                : (msg || "Password change failed.");
            status.style.color = "var(--danger)";
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        initLayout("profile");
        const saveBtn = document.getElementById("pf-save");
        if (saveBtn) saveBtn.addEventListener("click", saveProfile);
        const pwBtn = document.getElementById("pw-save");
        if (pwBtn) pwBtn.addEventListener("click", changePassword);
        loadProfile();
    });
})();
