(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
  const visible = el => !!(el && !el.hidden && el.getAttribute("aria-hidden") !== "true" && el.getClientRects().length);
  const activeModals = () => [...document.querySelectorAll(".site-modal")].filter(el => !el.hidden);
  let lastOpener = null;
  let lastModal = null;

  // Provide a reliable skip link and main landmark even on legacy pages.
  let main = document.querySelector("main");
  if (main && !main.id) main.id = "main-content";
  if (main && !document.querySelector(".skip-link")) {
    const skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = "#" + main.id;
    skip.textContent = "Skip to main content";
    document.body.insertBefore(skip, document.body.firstChild);
  }
  document.querySelectorAll(".primary-nav").forEach(nav => {
    if (!nav.hasAttribute("aria-label")) nav.setAttribute("aria-label", "Main navigation");
  });
  document.querySelectorAll(".primary-nav a").forEach(link => {
    if (new URL(link.href, location.href).pathname === location.pathname) link.setAttribute("aria-current", "page");
  });
  document.querySelectorAll("img:not([alt])").forEach(img => img.alt = "");
  document.querySelectorAll("button:not([type])").forEach(button => button.type = "button");

  // Make dynamic dialogs keyboard-safe: initial focus, focus containment, Escape and return focus.
  document.addEventListener("click", event => {
    const trigger = event.target.closest("button,a,[role='button']");
    if (trigger && !trigger.closest(".site-modal")) lastOpener = trigger;
  }, true);
  const modalObserver = new MutationObserver(() => {
    const modals = activeModals();
    const current = modals[modals.length - 1];
    if (current && current !== lastModal) {
      lastModal = current;
      if (!current.hasAttribute("aria-labelledby") && current.querySelector("h1,h2,h3")) {
        const heading = current.querySelector("h1,h2,h3");
        if (!heading.id) heading.id = "dialog-title-" + Math.random().toString(36).slice(2, 9);
        current.setAttribute("aria-labelledby", heading.id);
      }
      window.setTimeout(() => {
        if (current.hidden) return;
        const target = current.querySelector("[autofocus],.modal-close," + focusableSelector) || current;
        if (!current.hasAttribute("tabindex")) current.tabIndex = -1;
        try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
      }, 0);
    }
    if (!modals.length && lastModal) {
      const closed = lastModal;
      lastModal = null;
      const target = lastOpener && lastOpener.isConnected && !lastOpener.disabled ? lastOpener : null;
      if (target) window.setTimeout(() => target.focus({ preventScroll: true }), 0);
    }
  });
  modalObserver.observe(document.body, {subtree:true, attributes:true, attributeFilter:["hidden"]});
  document.addEventListener("keydown", event => {
    const modals = activeModals();
    const modal = modals[modals.length - 1];
    if (!modal) return;
    if (event.key === "Escape") {
      event.preventDefault();
      const close = modal.querySelector(".modal-close,[data-close-modal]");
      if (close) close.click(); else modal.hidden = true;
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...modal.querySelectorAll(focusableSelector)].filter(visible);
    if (!items.length) { event.preventDefault(); modal.focus(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  }, true);

  // A non-horizontal presentation for the timeline, with the same records and filters.
  const timeline = document.getElementById("chrono-timeline");
  if (timeline && !document.getElementById("chrono-view-toggle")) {
    const toggle = document.createElement("button");
    toggle.id = "chrono-view-toggle";
    toggle.type = "button";
    toggle.className = "small-button chrono-view-toggle";
    toggle.textContent = "Use vertical list view";
    toggle.setAttribute("aria-pressed", "false");
    const hint = document.querySelector(".chrono-scroll-hint");
    if (hint) hint.insertAdjacentElement("afterend", toggle); else timeline.insertAdjacentElement("beforebegin", toggle);
    toggle.addEventListener("click", () => {
      const listMode = !document.querySelector(".chrono-main").classList.contains("chrono-list-mode");
      document.querySelector(".chrono-main").classList.toggle("chrono-list-mode", listMode);
      toggle.setAttribute("aria-pressed", String(listMode));
      toggle.textContent = listMode ? "Use horizontal timeline view" : "Use vertical list view";
      const status = document.getElementById("chrono-count");
      if (status) status.textContent = status.textContent + (listMode ? " · Vertical list view" : " · Horizontal timeline view");
    });
  }

  // A map is a visual aid, not the only way to reach place records.
  const map = document.getElementById("family-map");
  if (map) {
    map.setAttribute("role", "region");
    map.setAttribute("aria-label", "Visual map of family history locations. Use the location index and associated records panels to explore without the map.");
    const caption = map.parentElement && map.parentElement.querySelector(".map-caption");
    if (caption) caption.id = caption.id || "map-accessibility-description";
    if (caption) map.setAttribute("aria-describedby", caption.id);
  }

  // Respect reduced-motion preferences immediately, including if they change mid-session.
  const syncMotion = () => document.documentElement.classList.toggle("system-reduced-motion", reduceMotion.matches);
  syncMotion();
  if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", syncMotion);
  else if (reduceMotion.addListener) reduceMotion.addListener(syncMotion);
})();