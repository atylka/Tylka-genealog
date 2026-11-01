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
  const header=document.querySelector(".site-header");
  if(header){
    const oldToggle=header.querySelector(".menu-toggle");
    const gearButton=oldToggle||document.createElement("button");
    gearButton.className="menu-toggle site-menu-toggle";gearButton.type="button";
    gearButton.innerHTML='<span aria-hidden="true">⚙</span>';
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
        setTimeout(()=>{location.href=link.href;},880);
      });
    });
  }
})();

/* Advanced micro-interactions and accessibility helpers */
(() => {
 const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches||document.documentElement.classList.contains("reduce-motion");
 const progress=document.createElement("div");progress.className="archive-scroll-progress";progress.setAttribute("aria-hidden","true");document.body.append(progress);
 const top=document.createElement("button");top.type="button";top.className="back-to-top";top.textContent="↑";top.setAttribute("aria-label","Back to top");top.title="Back to top";document.body.append(top);
 top.addEventListener("click",()=>window.scrollTo({top:0,behavior:reduce?"auto":"smooth"}));
 let scheduled=false;
 const updateScroll=()=>{const max=document.documentElement.scrollHeight-window.innerHeight;progress.style.transform="scaleX("+(max>0?window.scrollY/max:0)+")";top.classList.toggle("is-visible",window.scrollY>420);scheduled=false;};
 window.addEventListener("scroll",()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateScroll);}},{passive:true});window.addEventListener("resize",updateScroll,{passive:true});updateScroll();
 if(!reduce&&"IntersectionObserver"in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("motion-visible");observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:"0px 0px -35px 0px"});
  document.querySelectorAll("main>section,main .record-card,main .activity-log-item,main .chrono-year-column,main .location-item,main .paper-card,main .archive-folder").forEach((el,i)=>{if(i<80){el.classList.add("motion-reveal");observer.observe(el);}});
 }
 if(!reduce){
  document.addEventListener("pointerdown",event=>{
   const target=event.target.closest("button,.button,.small-button,.archive-folder,.location-item,.primary-nav a");
   if(!target||target.disabled)return;
   const rect=target.getBoundingClientRect(),size=Math.max(rect.width,rect.height)*.8;
   const ripple=document.createElement("span");ripple.className="motion-ripple";ripple.style.width=size+"px";ripple.style.height=size+"px";
   ripple.style.left=(event.clientX-rect.left-size/2)+"px";ripple.style.top=(event.clientY-rect.top-size/2)+"px";
   if(getComputedStyle(target).position==="static")target.style.position="relative";
   target.style.overflow="hidden";target.append(ripple);ripple.addEventListener("animationend",()=>ripple.remove(),{once:true});
  },{passive:true});
 }
})();


/* Dynamic motion observer: animate records and controls added after data loads */
(() => {
 const root=document.documentElement;
 const prefers=window.matchMedia("(prefers-reduced-motion: reduce)");
 const reduced=()=>prefers.matches||root.classList.contains("reduce-motion");
 if(reduced())return;
 const seen=new WeakSet();
 const classify=el=>{
  if(!(el instanceof Element)||seen.has(el))return;
  if(el.matches(".record-card,.activity-log-item,.inbox-item,.chrono-record-card,.location-item,.archive-folder,.paper-card,.generation,.folio-card,.archive-folders,.archive-folder-content,.location-sidebar,.map-panel,.home-search-box,.chrono-filter-panel,.notice,.empty-state,.record-preview,.detail-source,.detail-transcription")){
   seen.add(el);el.classList.add("motion-reveal");
   const type=el.matches(".folio-card,.brand-banner,.archive-folders")?"motion-paper":el.matches(".monogram,.record-category,.folder-number")?"motion-stamp":"motion-ink";
   el.classList.add(type);
   requestAnimationFrame(()=>{if(el.isConnected)el.classList.add("motion-visible");});
  }
 };
 const scan=node=>{
  if(!(node instanceof Element))return;
  classify(node);node.querySelectorAll(".record-card,.activity-log-item,.inbox-item,.chrono-record-card,.location-item,.archive-folder,.paper-card,.generation,.folio-card,.archive-folders,.archive-folder-content,.location-sidebar,.map-panel,.home-search-box,.chrono-filter-panel,.notice,.empty-state,.record-preview,.detail-source,.detail-transcription").forEach(classify);
 };
 scan(document.body);
 const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)scan(node);})));
 observer.observe(document.body,{childList:true,subtree:true});
 const focusable="button,a,input,select,textarea,[role=button]";
 document.addEventListener("focusin",event=>{const el=event.target.closest(focusable);if(el&&!el.disabled)el.classList.add("motion-focused");});
 document.addEventListener("focusout",event=>{const el=event.target.closest(focusable);if(el)el.classList.remove("motion-focused");});
 document.addEventListener("click",event=>{
  const button=event.target.closest("button,.button,.small-button");
  if(button&&!button.disabled){button.classList.remove("motion-clicked");void button.offsetWidth;button.classList.add("motion-clicked");}
 });
 const updateMotion=()=>{if(reduced()){observer.disconnect();document.querySelectorAll(".motion-reveal").forEach(el=>{el.style.opacity="1";el.style.transform="none";el.style.filter="none";});}};
 prefers.addEventListener?.("change",updateMotion);
})();
