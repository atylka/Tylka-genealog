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


  // Universal three-line menu, settings, and persistent appearance preferences.
  const themeKey="tylka_theme",sizeKey="tylka_text_size",motionKey="tylka_motion";
  const getPref=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch(_){return fallback;}};
  const setPref=(key,value)=>{try{localStorage.setItem(key,value);}catch(_){}};
  const applyTheme=theme=>{
    document.documentElement.dataset.theme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=theme==="dark"?"#211e1a":"#541522";
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
    const menuButton=oldToggle||document.createElement("button");
    menuButton.className="menu-toggle site-menu-toggle";menuButton.type="button";menuButton.innerHTML='<span aria-hidden="true">☰</span>';menuButton.setAttribute("aria-label","Open site menu");menuButton.setAttribute("aria-expanded","false");
    const panel=document.createElement("div");panel.className="site-menu-panel";panel.id="site-menu-panel";panel.hidden=true;
    const mailbox=document.createElement("button");mailbox.type="button";mailbox.className="site-menu-action";mailbox.id="site-mailbox";mailbox.innerHTML='<span aria-hidden="true">✉</span> Mailbox';panel.append(mailbox);
    const settings=document.createElement("button");settings.type="button";settings.className="site-menu-action";settings.id="site-settings-open";settings.textContent="Settings";panel.append(settings);
    if(oldToggle)oldToggle.replaceWith(menuButton);else header.append(menuButton);
    header.append(panel);
    menuButton.addEventListener("click",()=>{const open=menuButton.getAttribute("aria-expanded")==="true";menuButton.setAttribute("aria-expanded",String(!open));menuButton.setAttribute("aria-label",open?"Open site menu":"Close site menu");panel.hidden=open;});
    panel.addEventListener("click",e=>{if(e.target.closest("a")){panel.hidden=true;menuButton.setAttribute("aria-expanded","false");}});
    document.addEventListener("click",e=>{if(!header.contains(e.target)){panel.hidden=true;menuButton.setAttribute("aria-expanded","false");}});
    const settingsModal=document.createElement("section");settingsModal.className="site-modal";settingsModal.id="site-settings-modal";settingsModal.hidden=true;settingsModal.setAttribute("role","dialog");settingsModal.setAttribute("aria-modal","true");settingsModal.innerHTML='<div class="modal-card"><button class="modal-close" type="button" aria-label="Close settings">×</button><p class="eyebrow">Display preferences</p><h2>Settings</h2><label for="site-theme-choice">Appearance</label><select id="site-theme-choice"><option value="light">Light mode</option><option value="dark">Dark mode</option></select><label for="site-size-choice">Text size</label><select id="site-size-choice"><option value="normal">Standard</option><option value="large">Large</option></select><label for="site-motion-choice">Animations</label><select id="site-motion-choice"><option value="full">On</option><option value="reduced">Reduced</option></select><p class="file-hint">These settings are saved on this device.</p></div>';
    document.body.append(settingsModal);
    const close=settingsModal.querySelector(".modal-close");close.addEventListener("click",()=>settingsModal.hidden=true);settingsModal.addEventListener("click",e=>{if(e.target===settingsModal)settingsModal.hidden=true;});
    const themeChoice=settingsModal.querySelector("#site-theme-choice"),sizeChoice=settingsModal.querySelector("#site-size-choice"),motionChoice=settingsModal.querySelector("#site-motion-choice");
    themeChoice.value=getPref(themeKey,"light");sizeChoice.value=getPref(sizeKey,"normal");motionChoice.value=getPref(motionKey,"full");
    themeChoice.addEventListener("change",()=>{setPref(themeKey,themeChoice.value);applyTheme(themeChoice.value);});
    sizeChoice.addEventListener("change",()=>{setPref(sizeKey,sizeChoice.value);applyFormat();});
    motionChoice.addEventListener("change",()=>{setPref(motionKey,motionChoice.value);applyFormat();});
    settings.addEventListener("click",()=>{panel.hidden=true;menuButton.setAttribute("aria-expanded","false");settingsModal.hidden=false;});
    mailbox.addEventListener("click",()=>{panel.hidden=true;menuButton.setAttribute("aria-expanded","false");document.dispatchEvent(new CustomEvent("tylka:open-mailbox"));});
  }
  if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches&&getPref(motionKey,"full")!=="reduced"){
    document.body.classList.add("page-enter");requestAnimationFrame(()=>document.body.classList.add("page-enter-active"));
    document.querySelectorAll('a[href]').forEach(link=>{
      const href=link.getAttribute("href")||"";
      if(!href||href.startsWith("#")||link.target==="_blank"||link.hasAttribute("download")||link.origin!==location.origin||!/\.html(?:$|[?#])/.test(href))return;
      link.addEventListener("click",event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();document.body.classList.add("page-leave");setTimeout(()=>{location.href=link.href;},150);});
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
