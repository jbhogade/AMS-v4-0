/*==============================================================================
#-------------- Start Code for : LOGIN PAGE (js/login.js) ----------------------
#
#  PURPOSE   : Submits username/password to the AMS-API, stores the JWT session
#              in localStorage ("ams_session"), and redirects to the dashboard.
#
#  BACKEND   : POST /api/auth/login  ->  { token, user }
#              (see server/AMS.API/Controllers/AuthController.cs)
#------------------------------------------------------------------------------*/

(function () {
    "use strict";

    var form = document.getElementById("login-form");
    var msgEl = document.getElementById("login-msg");
    var btn = document.getElementById("login-btn");

    if (typeof initTheme === "function") initTheme();
    if (typeof amsApplyPortalPrefs === "function") amsApplyPortalPrefs();

    /* If a live session already exists, skip the login page entirely. */
    function alreadySignedIn() {
        var session = (typeof amsGetSession === "function") ? amsGetSession() : null;
        return !!(session && session.token);
    }

    if (alreadySignedIn()) {
        window.location.replace("index.html");
        return;
    }

    function setMsg(text, isError) {
        if (!msgEl) return;
        msgEl.textContent = text || "";
        msgEl.className = "login-msg" + (isError ? " error" : "");
    }

    function setBusy(busy) {
        if (btn) {
            btn.disabled = busy;
            btn.textContent = busy ? "Signing in..." : "Sign In";
        }
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        setMsg("");

        var username = (document.getElementById("login-username").value || "").trim();
        var password = document.getElementById("login-password").value || "";

        if (!username || !password) {
            setMsg("Please enter both username and password.", true);
            return;
        }

        setBusy(true);

        amsApiFetch("/api/auth/login", {
            method: "POST",
            body: { username: username, password: password }
        }).then(function (result) {
            if (!result || !result.token) {
                setMsg("Login failed. Check your username and password.", true);
                setBusy(false);
                return;
            }
            amsSetSession({
                token: result.token,
                username: result.username,
                role: result.role,
                name: result.name,
                displayName: result.displayName,
                linkedEmployee: result.linkedEmployee,
                email: result.email,
                contactNo: result.contactNo,
                address: result.address,
                dob: result.dob,
                gender: result.gender
            });
            /* A fresh login should start from the account's real role, not a
               stale role-simulator override left over from earlier testing. */
            try { localStorage.removeItem("ams_viewing_as_role"); } catch (e) { /* storage unavailable */ }
            window.location.replace("index.html");
        }).catch(function (err) {
            var msg = (err && err.message) ? err.message : "Could not reach the server.";
            setMsg(msg, true);
            setBusy(false);
        });
    });
})();
