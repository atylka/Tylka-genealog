(() => {
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


  // Universal gear settings popup with persistent appearance preferences.
  const themeKey="tylka_theme",sizeKey="tylka_text_size",motionKey="tylka_motion";
  const getPref=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch(_){return fallback;}};
  const setPref=(key,value)=>{try{localStorage.setItem(key,value);}catch(_){}};
  const applyTheme=theme=>{
    document.documentElement.dataset.theme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=theme==="dark"?"#21130f":"#541522";
    document.body.classList.remove("theme-wave-dark","theme-wave-light");
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches&&getPref(motionKey,"full")!=="reduced"){
      const wave=theme==="dark"?"theme-wave-dark":"theme-wave-light";
      void document.body.offsetWidth;
      document.body.classList.add(wave);
      window.setTimeout(()=>document.body.classList.remove(wave),1250);
    }
  };
  const applyFormat=()=>{
    document.documentElement.dataset.textSize=getPref(sizeKey,"normal");
    document.documentElement.dataset.motion=getPref(motionKey,"full");
    document.documentElement.classList.toggle("reduce-motion",getPref(motionKey,"full")==="reduced");
  };
  applyTheme(getPref(themeKey,"light")==="dark"?"dark":"light");applyFormat();
  const pageVeil=document.createElement("div");
  pageVeil.id="tylka-page-veil";pageVeil.setAttribute("aria-hidden","true");
  document.body.append(pageVeil);
  const header=document.querySelector(".site-header");
  if(header){
    const oldToggle=header.querySelector(".menu-toggle");
    const gearButton=oldToggle||document.createElement("button");
    gearButton.className="menu-toggle site-menu-toggle";gearButton.type="button";
    gearButton.innerHTML='<svg class="settings-gear-art" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.75 14.1 4.1l2.45-.25.95 2.27 2.2 1.1-.35 2.45L20.7 12l-1.35 2.1.35 2.45-2.2 1.1-.95 2.27-2.45-.25L12 21.25l-2.1-1.35-2.45.25-.95-2.27-2.2-1.1.35-2.45L3.3 12l1.35-2.1-.35-2.45 2.2-1.1.95-2.27 2.45.25L12 2.75Z"/><circle cx="12" cy="12" r="3.15"/></svg>';
    gearButton.setAttribute("aria-label","Open settings");gearButton.setAttribute("aria-expanded","false");
    if(oldToggle)oldToggle.replaceWith(gearButton);else header.append(gearButton);
    const settingsModal=document.createElement("section");settingsModal.className="site-modal";settingsModal.id="site-settings-modal";settingsModal.hidden=true;settingsModal.setAttribute("role","dialog");settingsModal.setAttribute("aria-modal","true");settingsModal.setAttribute("aria-labelledby","site-settings-title");settingsModal.innerHTML='<div class="modal-card"><button class="modal-close" type="button" aria-label="Close settings">×</button><p class="eyebrow">Display preferences</p><h2 id="site-settings-title">Settings</h2><label for="site-theme-choice">Appearance</label><select id="site-theme-choice"><option value="light">Light mode</option><option value="dark">Dark mode</option></select><label for="site-size-choice">Text size</label><select id="site-size-choice"><option value="normal">Standard</option><option value="large">Large</option></select><label for="site-motion-choice">Animations</label><select id="site-motion-choice"><option value="full">On</option><option value="reduced">Reduced</option></select><p class="file-hint">These settings are saved on this device.</p></div>';
    document.body.append(settingsModal);
    const closeSettings=()=>{settingsModal.hidden=true;gearButton.setAttribute("aria-expanded","false");gearButton.focus();};
    gearButton.addEventListener("click",()=>{const open=!settingsModal.hidden;settingsModal.hidden=open;gearButton.setAttribute("aria-expanded",String(!open));if(!open)settingsModal.querySelector(".modal-close").focus();});
    const close=settingsModal.querySelector(".modal-close");close.addEventListener("click",closeSettings);
    settingsModal.addEventListener("click",e=>{if(e.target===settingsModal)closeSettings();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!settingsModal.hidden)closeSettings();});
    const themeChoice=settingsModal.querySelector("#site-theme-choice"),sizeChoice=settingsModal.querySelector("#site-size-choice"),motionChoice=settingsModal.querySelector("#site-motion-choice");
    themeChoice.value=getPref(themeKey,"light");sizeChoice.value=getPref(sizeKey,"normal");motionChoice.value=getPref(motionKey,"full");
    themeChoice.addEventListener("change",()=>{setPref(themeKey,themeChoice.value);applyTheme(themeChoice.value);});
    sizeChoice.addEventListener("change",()=>{setPref(sizeKey,sizeChoice.value);applyFormat();});
    motionChoice.addEventListener("change",()=>{setPref(motionKey,motionChoice.value);applyFormat();});
  }
  if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches&&getPref(motionKey,"full")!=="reduced"){
    document.body.classList.add("page-enter");requestAnimationFrame(()=>document.body.classList.add("page-enter-active"));
    document.querySelectorAll('a[href]').forEach(link=>{
      const href=link.getAttribute("href")||"";
      if(!href||href.startsWith("#")||link.target==="_blank"||link.hasAttribute("download")||link.origin!==location.origin||!/\.html(?:$|[?#])/.test(href))return;
      link.addEventListener("click",event=>{
        if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.defaultPrevented)return;
        event.preventDefault();
        if(document.body.classList.contains("page-leaving"))return;
        document.body.classList.add("page-leaving","page-leave");
        const veil=document.getElementById("tylka-page-veil");
        if(veil)veil.classList.add("is-active");
        setTimeout(()=>{location.href=link.href;},320);
      });
    });
  }
})();

/* Lightweight scroll helpers. Expensive global ripples and mutation-driven animation scans removed. */
(() => {
 const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches||document.documentElement.classList.contains("reduce-motion");
 const progress=document.createElement("div");progress.className="archive-scroll-progress";progress.setAttribute("aria-hidden","true");document.body.append(progress);
 const top=document.createElement("button");top.type="button";top.className="back-to-top";top.textContent="↑";top.setAttribute("aria-label","Back to top");top.title="Back to top";document.body.append(top);
 top.addEventListener("click",()=>window.scrollTo({top:0,behavior:reduce?"auto":"smooth"}));
 let scheduled=false;
 const updateScroll=()=>{const max=document.documentElement.scrollHeight-window.innerHeight;progress.style.transform="scaleX("+(max>0?window.scrollY/max:0)+")";top.classList.toggle("is-visible",window.scrollY>420);scheduled=false;};
 window.addEventListener("scroll",()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateScroll);}},{passive:true});
 window.addEventListener("resize",updateScroll,{passive:true});updateScroll();
})();
