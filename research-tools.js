/* Tylka Genealogical Log — lightweight research desk enhancements.
   Research annotations are stored locally on this device; archive records remain unchanged. */
(() => {
  "use strict";
  const config = window.TYLKA_SUPABASE_CONFIG || {};
  const KEYS = {
    pins: "tylka_research_pins_v1",
    metadata: "tylka_research_metadata_v1",
    recent: "tylka_research_recent_v1"
  };
  const safeRead = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value ?? fallback; }
    catch (_) { return fallback; }
  };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
  const pins = () => safeRead(KEYS.pins, []);
  const metadata = () => safeRead(KEYS.metadata, {});
  const recent = () => safeRead(KEYS.recent, []);
  const clean = value => String(value || "").trim();
  const keyFor = record => [record.title, record.location].map(clean).join("|").toLocaleLowerCase();
  const recordFromCard = card => {
    const title = clean(card.querySelector("h2,h3,h4,.popup-title")?.textContent) || clean(card.getAttribute("aria-label")).replace(/^Open record:\s*/i, "");
    const text = clean(card.innerText);
    const category = clean(card.querySelector(".record-category")?.textContent || text.split("\n")[0]);
    const locationMatch = text.match(/(?:Location|Place):\s*([^\n]+)/i);
    const image = card.querySelector("img");
    return { title, category, location: locationMatch?.[1] || "", text, image: image?.src || "", key: keyFor({title,category,location:locationMatch?.[1]||""}) };
  };
  const style = document.createElement("style");
  style.textContent = `
    .research-card-tools{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.6rem;align-items:center}
    .research-card-tools button,.research-desk-button{font:inherit;font-size:.82rem;padding:.35rem .55rem;border:1px solid #9c7845;border-radius:4px;background:rgba(83,35,29,.08);color:inherit;cursor:pointer}
    .research-card-tools button[aria-pressed="true"]{background:#64251f;color:#f7e6bd;border-color:#d4b16b}
    .research-desk-button{position:fixed;right:1rem;bottom:1rem;z-index:900;background:#4b211c;color:#f6e6c4;border:1px solid #c5a15c;box-shadow:0 3px 12px rgba(0,0,0,.2)}
    .research-desk-panel{position:fixed;inset:0;z-index:1200;background:rgba(17,10,8,.58);display:grid;place-items:center;padding:1rem}
    .research-desk-panel[hidden]{display:none}
    .research-desk-card{width:min(760px,100%);max-height:min(86vh,900px);overflow:auto;background:var(--paper,#f2e7d0);color:var(--ink,#35241c);border:1px solid #b18a4f;border-radius:7px;padding:1.1rem;box-shadow:0 12px 45px rgba(0,0,0,.35)}
    html[data-theme="dark"] .research-desk-card{background:#2a1c17;color:#f1e2c1;border-color:#9f7840}
    .research-desk-head{display:flex;justify-content:space-between;align-items:center;gap:1rem}
    .research-desk-head h2{margin:.1rem 0 .7rem}
    .research-desk-close{font-size:1.4rem;border:0;background:transparent;color:inherit;cursor:pointer}
    .research-desk-tabs{display:flex;flex-wrap:wrap;gap:.35rem;margin:.6rem 0}
    .research-desk-tabs button[aria-pressed="true"]{background:#64251f;color:#f7e6bd}
    .research-desk-panel input,.research-desk-panel select,.research-desk-panel textarea{box-sizing:border-box;max-width:100%;width:100%;margin:.25rem 0 .65rem;padding:.55rem;border:1px solid #a68a60;border-radius:3px;background:rgba(255,255,255,.65);color:#302219}
    html[data-theme="dark"] .research-desk-panel input,html[data-theme="dark"] .research-desk-panel select,html[data-theme="dark"] .research-desk-panel textarea{background:#1b120f;color:#f1e2c1}
    .research-desk-results{display:grid;gap:.45rem}
    .research-desk-item{border:1px solid rgba(157,120,65,.45);padding:.6rem;border-radius:4px}
    .research-desk-item h3{font-size:1rem;margin:0 0 .25rem}
    .research-desk-item p{margin:.2rem 0;font-size:.9rem}
    .research-desk-actions{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.4rem}
    .research-desk-note{font-size:.82rem;opacity:.8}
    @media(prefers-reduced-motion:no-preference){.research-desk-card{animation:researchDeskIn .14s ease-out}@keyframes researchDeskIn{from{opacity:.7;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}}
    @media(prefers-reduced-motion:reduce){.research-desk-card{animation:none}}
  `;
  document.head.append(style);
  const button = document.createElement("button");
  button.className = "research-desk-button"; button.type = "button"; button.textContent = "Researcher's Desk"; button.setAttribute("aria-haspopup","dialog");
  const overlay = document.createElement("section");
  overlay.className = "research-desk-panel"; overlay.hidden = true; overlay.setAttribute("role","dialog"); overlay.setAttribute("aria-modal","true"); overlay.setAttribute("aria-label","Researcher's Desk");
  overlay.innerHTML = '<div class="research-desk-card"><div class="research-desk-head"><div><p class="eyebrow">Tylka Genealogical Log</p><h2>Researcher\'s Desk</h2></div><button class="research-desk-close" type="button" aria-label="Close">×</button></div><div class="research-desk-tabs" role="tablist"><button type="button" data-tab="search" aria-pressed="true">Search</button><button type="button" data-tab="pinned" aria-pressed="false">Pinned records</button><button type="button" data-tab="recent" aria-pressed="false">Recently viewed</button><button type="button" data-tab="compare" aria-pressed="false">Compare</button><button type="button" data-tab="investigations" aria-pressed="false">Investigations</button></div><div class="research-desk-content"></div><p class="research-desk-note">Pins, research statuses, source notes, and recent history are saved in this browser only.</p></div>';
  document.body.append(button, overlay);
  const content = overlay.querySelector(".research-desk-content");
  let tab = "search", allRecords = [], compareKeys = [];
  const el = (tag, text, cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
  const action = (label, fn) => { const b=el("button",label);b.type="button";b.addEventListener("click",fn);return b; };
  function accessionFor(record) { let hash=2166136261; for(const ch of record.key){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(10).padStart(10,"0").slice(-6); }
  function noteFor(record) { return metadata()[record.key] || {status:"Needs Research", repository:"", sourceUrl:"", archiveRef:"", notes:"", people:""}; }
  function updateMeta(record, patch) { const all=metadata(); all[record.key]={...noteFor(record),...patch,title:record.title,category:record.category,location:record.location};safeWrite(KEYS.metadata,all); }
  function remember(record) { if(!record.title)return;const list=recent().filter(x=>x.key!==record.key);list.unshift({...record,visitedAt:new Date().toISOString()});safeWrite(KEYS.recent,list.slice(0,8)); }
  function togglePin(record) { const list=pins();const exists=list.some(x=>x.key===record.key);safeWrite(KEYS.pins,exists?list.filter(x=>x.key!==record.key):[{...record,pinnedAt:new Date().toISOString()},...list].slice(0,100));renderCards();if(tab==="pinned")renderDesk(); }
  function makeTools(card) {
    if(card.dataset.researchToolsReady==="1")return;
    const record=recordFromCard(card);if(!record.title||!record.key)return;
    card.dataset.researchToolsReady="1";
    const tools=el("div",undefined,"research-card-tools");
    const pin=action(pins().some(x=>x.key===record.key)?"★ Pinned":"☆ Pin",()=>togglePin(record));
    pin.setAttribute("aria-pressed",String(pins().some(x=>x.key===record.key)));
    const status=action("Research status",()=>{openDesk("status",record);});
    const source=action("Source details",()=>{openDesk("source",record);});
    const compare=action("Compare",()=>{const keys=compareKeys.filter(k=>k!==record.key);if(keys.length>=2)keys.shift();compareKeys=[...keys,record.key];renderDesk("compare");overlay.hidden=false;});
    const copy=action("Copy citation",async()=>{const m=noteFor(record);const citation=[record.title,record.category,record.location,m.repository,m.archiveRef,m.sourceUrl].filter(Boolean).join(". ")+ ".";try{await navigator.clipboard.writeText(citation);copy.textContent="Citation copied";}catch(_){window.prompt("Copy this citation:",citation);}});
    const accession=el("span","TYLKA · "+accessionFor(record),"research-accession");
    tools.append(pin,status,source,compare,copy);card.append(accession,tools);
    card.addEventListener("click",event=>{if(event.target.closest(".research-card-tools"))return;remember(record);},{capture:true});
  }
  function renderCards() {
    const selectors=["#home-results","#records-list","#chrono-timeline","#location-record-list","#location-records","#ancestor-grid"];
    selectors.forEach(selector=>document.querySelectorAll(selector+" .record-card,"+selector+" .chrono-record-card,"+selector+" .location-record").forEach(makeTools));
  }
  const observer = new MutationObserver(() => renderCards());
  ["#home-results","#records-list","#chrono-timeline","#location-record-list","#location-records"].forEach(selector=>{const target=document.querySelector(selector);if(target)observer.observe(target,{childList:true,subtree:true});});
  function loadRecords() {
    if(!config.url||!config.anonKey||!window.supabase)return Promise.resolve([]);
    const client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
    return client.from("archive_records").select("id,title,category,description,location,persons_mentioned,file_name,file_path,mime_type,created_at").order("created_at",{ascending:false}).limit(500).then(({data,error})=>{
      if(error)throw error;
      return (data||[]).map(r=>({...r,key:keyFor(r),text:[r.title,r.category,r.description,r.location,r.persons_mentioned,r.file_name].join(" ")}));
    });
  }
  function itemFor(record) {
    const item=el("article",undefined,"research-desk-item");item.append(el("h3",record.title||"Untitled record"));
    item.append(el("p",[record.category,record.location].filter(Boolean).join(" · ")));
    const actions=el("div",undefined,"research-desk-actions");
    actions.append(action(pins().some(x=>x.key===record.key)?"Unpin":"Pin record",()=>togglePin(record)));
    actions.append(action("Research status & notes",()=>openDesk("status",record)));
    actions.append(action("Source citation",()=>openDesk("source",record)));
    actions.append(action(compareKeys.includes(record.key)?"Remove from comparison":"Add to comparison",()=>{compareKeys=compareKeys.filter(k=>k!==record.key);if(!compareKeys.includes(record.key)&&compareKeys.length<2)compareKeys.push(record.key);renderDesk("compare");}));
    item.append(actions);return item;
  }
  function renderSearch() {
    content.replaceChildren();
    const form=el("form");form.addEventListener("submit",e=>e.preventDefault());
    const q=el("input");q.type="search";q.placeholder="Search names, places, dates, transcriptions…";q.setAttribute("aria-label","Search all archive records");
    const results=el("div",undefined,"research-desk-results");form.append(q);content.append(form,results);
    const run=()=>{const term=q.value.trim().toLocaleLowerCase();const matches=allRecords.filter(r=>!term||r.text.toLocaleLowerCase().includes(term)).slice(0,60);results.replaceChildren();if(!matches.length)results.append(el("p","No matching records found.","empty-state"));matches.forEach(r=>results.append(itemFor(r)));};
    q.addEventListener("input",run);run();
    q.focus({preventScroll:true});
  }
  function renderPinned(){content.replaceChildren();const records=pins();if(!records.length){content.append(el("p","No pinned records yet. Use ☆ Pin on a record card to save it here.","empty-state"));return;}const list=el("div",undefined,"research-desk-results");records.forEach(r=>list.append(itemFor(r)));content.append(list);}
  function renderRecent(){content.replaceChildren();const records=recent();if(!records.length){content.append(el("p","Records you open will appear here.","empty-state"));return;}const list=el("div",undefined,"research-desk-results");records.forEach(r=>list.append(itemFor(r)));content.append(list);}
  function renderInvestigations(){content.replaceChildren();const records=allRecords.filter(r=>["Uncertain","Needs Research","Probable"].includes(noteFor(r).status));if(!records.length){content.append(el("p","No active investigations yet. Add a status to a record to track follow-up research.","empty-state"));return;}const list=el("div",undefined,"research-desk-results");records.forEach(r=>list.append(itemFor(r)));content.append(list);}
  function renderCompare(){content.replaceChildren();const records=compareKeys.map(k=>allRecords.find(r=>r.key===k)||pins().find(r=>r.key===k)||recent().find(r=>r.key===k)).filter(Boolean);if(records.length<2){content.append(el("p","Choose up to two records using Compare to see their details side by side.","empty-state"));const list=el("div",undefined,"research-desk-results");allRecords.slice(0,20).forEach(r=>list.append(itemFor(r)));content.append(list);return;}const table=el("table");table.className="research-comparison-table";const fields=[["Title",r=>r.title],["Record type",r=>r.category],["Location",r=>r.location],["Persons mentioned",r=>r.persons_mentioned||noteFor(r).people],["Date / year",r=>{const m=(r.text||r.description||"").match(/\b(?:1[5-9]\d{2}|20\d{2})\b/);return m?m[0]:"Not recorded"}],["Research status",r=>noteFor(r).status],["Repository",r=>noteFor(r).repository],["Archive reference",r=>noteFor(r).archiveRef],["Research notes",r=>noteFor(r).notes]];fields.forEach(([label,get])=>{const row=table.insertRow();row.insertCell().textContent=label;records.forEach(r=>row.insertCell().textContent=get(r)||"—");});content.append(table);}
  function renderEditor(record,mode) {
    content.replaceChildren();const heading=el("h3",record.title||"Record details");content.append(heading);
    const form=el("form");form.addEventListener("submit",e=>e.preventDefault());
    const addField=(labelText,name,value,kind="text")=>{const label=el("label",labelText);let field;if(kind==="textarea"){field=el("textarea");field.rows=3;}else{field=el("input");field.type=kind;}field.name=name;field.value=value||"";label.htmlFor="research-"+name;field.id="research-"+name;form.append(label,field);return field;};
    const current=noteFor(record);
    const status=el("select");status.id="research-status";status.name="status";["Verified","Probable","Uncertain","Needs Research"].forEach(v=>status.add(new Option(v,v)));status.value=current.status||"Needs Research";const label=el("label","Research status");label.htmlFor=status.id;form.append(label,status);
    const people=addField("Associated people (separate names with commas)","people",current.people||record.persons_mentioned||"","text");
    const repository=addField("Repository / collection","repository",current.repository);
    const sourceUrl=addField("Original record URL","sourceUrl",current.sourceUrl,"url");
    const archiveRef=addField("Book, page, entry, film, or archive reference","archiveRef",current.archiveRef);
    const notes=addField("Research notes / evidence explanation","notes",current.notes,"textarea");
    const save=action("Save research details",()=>{updateMeta(record,{status:status.value,people:people.value,repository:repository.value,sourceUrl:sourceUrl.value,archiveRef:archiveRef.value,notes:notes.value,updatedAt:new Date().toISOString()});renderDesk(mode);});
    const citation=action("Copy citation",async()=>{const m=noteFor(record);const text=[record.title||"Untitled record",record.category,record.location,m.repository,m.archiveRef,m.sourceUrl].filter(Boolean).join(". ")+ ".";try{await navigator.clipboard.writeText(text);citation.textContent="Citation copied";}catch(_){window.prompt("Copy this citation:",text);}});
    const back=action("Back to desk",()=>renderDesk(tab));
    const actions=el("div",undefined,"research-desk-actions");actions.append(save,citation,back);form.append(actions);content.append(form);
    if(mode==="source"&&current.sourceUrl){const a=el("a","Open original source");a.href=current.sourceUrl;a.target="_blank";a.rel="noopener noreferrer";content.append(a);}
  }
  function renderDesk(forceTab) {
    if(forceTab)tab=forceTab;overlay.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.tab===tab)));
    if(tab==="search")renderSearch();else if(tab==="pinned")renderPinned();else if(tab==="recent")renderRecent();else if(tab==="compare")renderCompare();else if(tab==="investigations")renderInvestigations();
  }
  function openDesk(mode,record) {
    if(record){remember(record);renderEditor(record,mode==="source"?"source":"status");}
    else renderDesk(mode||"search");
    overlay.hidden=false;
  }
  button.addEventListener("click",()=>openDesk(tab));
  overlay.querySelector(".research-desk-close").addEventListener("click",()=>overlay.hidden=true);
  overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.hidden=true;});
  overlay.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.tab;renderDesk();}));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) overlay.hidden = true;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault(); openDesk("search");
    } else if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey &&
      !event.target?.isContentEditable && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) {
      event.preventDefault();
      const field = document.querySelector("#home-query,#record-search,#chrono-person,#chrono-location,#location-search,#folder-search,input[type=search]");
      if (field && field.getClientRects().length) {
        field.focus({ preventScroll: true });
        if (typeof field.select === "function") field.select();
      } else openDesk("search");
    }
  });
  loadRecords().then(records=>{allRecords=records;renderCards();}).catch(error=>{console.warn("Research desk could not load records",error);});
  renderCards();
})();
