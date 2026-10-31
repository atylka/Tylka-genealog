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
})();