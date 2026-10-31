(() => {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".primary-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
    }));
  }
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    reveals.forEach(element => observer.observe(element));
  } else reveals.forEach(element => element.classList.add("is-visible"));

  const search = document.getElementById("folder-search");
  const folders = document.querySelectorAll("#folder-list [data-search]");
  if (search) search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase();
    folders.forEach(folder => {
      const text = (folder.dataset.search + " " + folder.textContent).toLocaleLowerCase();
      folder.classList.toggle("is-hidden", !text.includes(query));
    });
  });

  // Site-wide theme switcher and gentle page transitions.
  const themeKey = "tylka_theme";
  const applyTheme = theme => {
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById("theme-toggle");
    if (button) {
      button.textContent = theme === "dark" ? "☀ Light mode" : "☾ Dark mode";
      button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      button.setAttribute("aria-pressed", String(theme === "dark"));
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#211e1a" : "#cbb99a";
  };
  let savedTheme = "light";
  try { savedTheme = localStorage.getItem(themeKey) || "light"; } catch (_) {}
  applyTheme(savedTheme === "dark" ? "dark" : "light");
  const header = document.querySelector(".site-header");
  if (header && !document.getElementById("theme-toggle")) {
    const themeButton = document.createElement("button");
    themeButton.id = "theme-toggle";
    themeButton.type = "button";
    themeButton.className = "theme-toggle";
    themeButton.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(themeKey, next); } catch (_) {}
    });
    header.append(themeButton);
    applyTheme(savedTheme === "dark" ? "dark" : "light");
  }
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.body.classList.add("page-enter");
    requestAnimationFrame(() => document.body.classList.add("page-enter-active"));
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute("href") || "";
      if (!href || href.startsWith("#") || link.target === "_blank" || link.hasAttribute("download") ||
          link.origin !== location.origin || !/\\.html(?:$|[?#])/.test(href)) return;
      link.addEventListener("click", event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        document.body.classList.add("page-leave");
        setTimeout(() => { location.href = link.href; }, 150);
      });
    });
  }
})();