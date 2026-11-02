(() => {
 const config=window.TYLKA_SUPABASE_CONFIG||{},ok=config.url&&config.anonKey&&!config.url.includes("YOUR_")&&!config.anonKey.includes("YOUR_");
 const $=id=>document.getElementById(id),results=$("home-results"),count=$("home-result-count"),query=$("home-query"),category=$("home-category"),location=$("home-location"),activity=$("home-activity-list");
 const names={births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};let records=[],client=null;const HOME_INITIAL_RENDER_LIMIT=24,HOME_ACTIVITY_LIMIT=5;let showAllResults=false;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text||"";if(cls)e.className=cls;return e;};const publicUrl=path=>client.storage.from("family-archive").getPublicUrl(path).data.publicUrl;
 function ensureDetailModal(){
  let modal=document.getElementById("home-record-detail-modal");if(modal)return modal;
  modal=document.createElement("section");modal.id="home-record-detail-modal";modal.className="site-modal record-detail-modal";modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","home-detail-title");
  const panel=node("div","","modal-card modal-wide record-detail-card home-record-detail-card");
  const close=node("button","×","modal-close");close.type="button";close.setAttribute("aria-label","Close record");close.addEventListener("click",()=>modal.hidden=true);
  const eyebrow=node("p","Record detail","eyebrow"),title=node("h2","","");title.id="home-detail-title";
  const meta=node("div","","detail-meta");meta.id="home-detail-meta";
  const confidence=node("div","","detail-confidence");confidence.id="home-detail-confidence";
  const grid=node("div","","record-detail-grid");
  const source=node("section","","detail-source");source.append(node("h3","Original source"));
  const toolbar=node("div","","image-viewer-toolbar home-image-viewer-toolbar");
  const zoomOut=node("span","−","small-button"),reset=node("span","Fit to view","small-button"),zoomIn=node("span","+","small-button");toolbar.append(zoomOut,reset,zoomIn);
  const viewport=node("div","","detail-image-viewport");viewport.id="home-detail-viewport";
  const img=document.createElement("img");img.id="home-detail-image";img.alt="Original record scan";viewport.append(img);
  const fallback=node("div","","detail-file-fallback");fallback.id="home-detail-fallback";
  source.append(toolbar,viewport,node("p","Original document attached to this record.","image-viewer-hint"),fallback);
  const right=node("div","","detail-right-column");
  const notes=node("section","","detail-transcription");notes.id="home-detail-transcription-panel";notes.hidden=true;notes.append(node("h3","Transcription & research notes"));
  const description=node("pre","","");description.id="home-detail-description";notes.append(description);
  const family=node("section","","detail-family-information");family.id="home-detail-family-information";family.hidden=true;family.append(node("h3","Identified family & names"));
  const familyList=node("div","","");familyList.id="home-detail-family-list";family.append(familyList);
  const faces=node("section","","detail-family-information detail-face-identifications");faces.id="home-detail-face-identifications";faces.hidden=true;faces.append(node("h3","People identified in photograph"));
  const faceList=node("ul","","combined-identified-names");faceList.id="home-detail-face-list";faces.append(faceList);
  right.append(notes,family,faces);grid.append(source,right);panel.append(close,eyebrow,title,meta,confidence,grid);
  modal.append(panel);modal.addEventListener("click",e=>{if(e.target===modal)modal.hidden=true;});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)modal.hidden=true;});
  document.body.append(modal);return modal;
 }
 function openRecord(record){
  const modal=ensureDetailModal(),panel=modal.querySelector(".home-record-detail-card");
  modal.querySelector("#home-detail-title").textContent=record.title||"Untitled record";
  modal.querySelector("#home-detail-meta").textContent=[names[record.category]||record.category,record.record_date||record.event_date||"Date not entered",record.location||"Location not entered"].join(" · ");
  const img=modal.querySelector("#home-detail-image"),fallback=modal.querySelector("#home-detail-fallback"),viewport=modal.querySelector("#home-detail-viewport");
  img.hidden=true;img.removeAttribute("src");fallback.replaceChildren();viewport.style.display="";
  if(record.file_path){
   const url=publicUrl(record.file_path);
   if((record.mime_type||"").startsWith("image/")){img.src=url;img.alt=(record.title||"Record")+" original scan";img.hidden=false;}
   else if(record.mime_type==="application/pdf"){const frame=document.createElement("iframe");frame.src=url;frame.title="Original PDF for "+record.title;frame.style.cssText="width:100%;height:60vh;border:0";fallback.append(frame);}
   else{const link=node("a","Open original attachment","text-link");link.href=url;link.target="_blank";link.rel="noopener noreferrer";fallback.append(link);}
  }else fallback.append(node("p","No attachment is saved for this record.","empty-state"));
  const raw=String(record.description||"");
  const notes=raw.split(/\r?\n/).filter(line=>!/^\s*(?:Date on record|Parish|Research confidence|Bride|Groom|Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother|Bride’s father|Bride’s mother|Groom’s father|Groom’s mother)|Page name identifications|Face identifications):/i.test(line)).join("\n").trim();
  const notesPanel=modal.querySelector("#home-detail-transcription-panel");modal.querySelector("#home-detail-description").textContent=notes;notesPanel.hidden=!notes;
  const family=modal.querySelector("#home-detail-family-information"),familyList=modal.querySelector("#home-detail-family-list");familyList.replaceChildren();
  const familyEntries=[...raw.matchAll(/^Family - ([^:\r\n]+):\s*(.+)$/gim)].map(m=>({role:m[1].trim(),name:m[2].trim()}));
  const birthSubject=record.category==="births"&&record.title?{role:"Baptized / born person",name:record.title}:null;
  const bride=raw.match(/^Bride:\s*(.+)$/im),groom=raw.match(/^Groom:\s*(.+)$/im);
  const entries=[...(birthSubject?[birthSubject]:[]),...(bride?[{role:"Bride",name:bride[1].trim()}]:[]),...(groom?[{role:"Groom",name:groom[1].trim()}]:[]),...familyEntries];
  if(entries.length){const list=node("ul","","combined-identified-names");entries.forEach(entry=>{const li=node("li","","");li.append(node("strong",entry.role+": "),document.createTextNode(entry.name));list.append(li);});familyList.append(list);}family.hidden=!entries.length;
  const facePanel=modal.querySelector("#home-detail-face-identifications"),faceList=modal.querySelector("#home-detail-face-list");faceList.replaceChildren();const fm=raw.match(/^Face identifications:\s*(\[.*\])\s*$/im);let faceEntries=[];if(fm){try{faceEntries=JSON.parse(fm[1]);}catch(_){}}faceEntries.filter(x=>x&&x.name).forEach(x=>faceList.append(node("li",x.name)));facePanel.hidden=!faceEntries.length;
  modal.querySelector("#home-detail-confidence").textContent=(raw.match(/^Research confidence:\s*(.+)$/im)||[])[1]||"";
  const oldLink=panel.querySelector(".home-open-attachment");if(oldLink)oldLink.remove();
  if(record.file_path){const link=node("a","Open original attachment in new tab","text-link home-open-attachment");link.href=publicUrl(record.file_path);link.target="_blank";link.rel="noopener noreferrer";panel.append(link);}
  modal.hidden=false;
 }
 function recordYear(record){
  const raw=String(record.record_date||record.event_date||"");
  return (raw.match(/(?:17|18|19|20)\\d{2}/)||[])[0]||"Year unknown";
 }
 function recordSummary(record){
  const raw=String(record.description||"");
  const lines=raw.split(/\\r?\\n/).filter(line=>line.trim()&&!/^\\s*(?:Date on record|Parish|Research confidence|Bride|Groom|Family - |Page name identifications|Face identifications):/i.test(line));
  let summary=lines.join(" ").replace(/\\s+/g," ").trim();
  if(!summary)summary=String(record.persons_mentioned||"").trim();
  if(!summary)return "No summary or transcription has been added yet.";
  return summary.length>155?summary.slice(0,152).replace(/\\s+\\S*$/,"")+"…":summary;
 }
 function render(){const q=query.value.trim().toLowerCase(),loc=location.value.trim().toLowerCase(),cat=category.value,found=records.filter(r=>(cat==="all"||r.category===cat)&&(!loc||(r.location||"").toLowerCase().includes(loc))&&[r.title,r.description,r.file_name,r.location,r.persons_mentioned].join(" ").toLowerCase().includes(q));const visible=showAllResults?found:found.slice(0,HOME_INITIAL_RENDER_LIMIT);count.textContent=found.length+" matching records · "+records.length+" total records"+(found.length>visible.length?" · showing "+visible.length:"");results.replaceChildren();results.classList.add("home-search-record-grid");if(!found.length){results.append(node("p",records.length?"No records match those filters.":"No records have been added yet.","empty-state"));return;}visible.forEach(r=>{const card=node("article","","record-card record-card-expanded home-search-record-card");card.tabIndex=0;card.setAttribute("role","link");card.setAttribute("aria-label","Open full record details for "+(r.title||"Untitled record"));const openArchiveDetail=()=>{window.location.href="archive.html?record="+encodeURIComponent(r.id);};card.addEventListener("click",e=>{if(e.target.closest("a,button"))return;openArchiveDetail();});card.addEventListener("keydown",e=>{if(e.target!==card)return;if(e.key==="Enter"||e.key===" "){e.preventDefault();openArchiveDetail();}});const hasScan=!!(r.file_path&&(r.mime_type||"").startsWith("image/"));if(hasScan){const thumb=node("div","","record-thumbnail");const img=document.createElement("img");img.src=publicUrl(r.file_path);img.alt="Thumbnail of "+(r.title||"record");img.loading="lazy";img.decoding="async";thumb.append(img);card.classList.add("has-scan");card.append(thumb);}else{card.classList.add("no-scan");}const details=node("div","","home-search-record-details");const kind=node("span",(names[r.category]||r.category),"record-category");const title=node("h3",r.title||"Untitled record");const view=node("button","View record details","small-button record-view-button");view.type="button";view.addEventListener("click",openArchiveDetail);details.append(kind,title,view);if(r.location){const place=node("p","Location: "+r.location,"record-location");details.append(place);}if(r.record_date){details.append(node("p","Record date: "+r.record_date,"record-date"));}card.append(details);results.append(card);});if(found.length>visible.length){const more=node("button","Show "+(found.length-visible.length)+" more records","small-button home-show-more");more.type="button";more.addEventListener("click",()=>{showAllResults=true;render();});results.append(more);} }
 async function load(){if(!ok||!window.supabase){count.textContent="Archive connection is not configured.";return;}client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));const {data,error}=await client.from("archive_records").select("id,title,category,description,location,persons_mentioned,file_name,file_path,mime_type,record_date,created_at").order("created_at",{ascending:false}).limit(300);if(error){count.textContent="Could not load public records: "+error.message;results.replaceChildren(node("p","The public archive could not be loaded.","empty-state"));return;}records=data||[];render();if(activity){activity.replaceChildren();if(!records.length)activity.append(node("p","No records have been added yet.","empty-state"));records.slice(0,5).forEach(r=>{const item=node("article","","activity-log-item");item.append(node("strong",r.title||"Untitled record","activity-log-entry-title"),node("span",(names[r.category]||r.category||"Uncategorized")+" · "+(r.created_at?new Date(r.created_at).toLocaleDateString():"Date unavailable"),"activity-log-entry-meta"));activity.append(item);});}}
 [query,category,location].filter(Boolean).forEach(el=>el.addEventListener(el.tagName==="INPUT"?"input":"change",()=>{showAllResults=false;render();}));load();
})();