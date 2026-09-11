/*==============================================================================
#-------------- Start Code for : EMBED-MODE DETECTION (embed-mode.js) ----------
#
#  PURPOSE   : Adds the "embed-mode" class to <body> when the page is loaded
#              with ?embed=1 (i.e. inside the System Administrator Master hub's
#              iframe). css/embed-mode.css then hides the sidebar + topbar so
#              only the content area renders inside the frame.
#
#  USED ON   : masters.html, accessories.html, consumables.html, spare-parts.html,
#              company.html  (include right after <body> opens, before layout.js)
#------------------------------------------------------------------------------*/
(function () {
    if (new URLSearchParams(window.location.search).get("embed") === "1") {
        if (document.body) document.body.classList.add("embed-mode");
        else document.addEventListener("DOMContentLoaded", () => document.body.classList.add("embed-mode"));
    }
})();
/*------------------------------------------------------------------------------
#-------------- End of the code : EMBED-MODE DETECTION -------------------------
#------------------------------------------------------------------------------*/
