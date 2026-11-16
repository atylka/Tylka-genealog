(() => {
 const grid=document.getElementById("ancestor-grid"),empty=document.getElementById("ancestor-empty"),count=document.getElementById("ancestor-count"),addButton=document.getElementById("ancestor-add-button");
 const OWNER_ID="7a8cd586-c68f-4078-b61d-a87f3842b07e";
 const HIDDEN_FLAG="__tylka_hidden_ancestor_card__";
 const HIDDEN_ROW_PREFIX="__TYLKA_HIDDEN_ANCESTOR__:";
 const config=window.TYLKA_SUPABASE_CONFIG||{};
 const client=window.supabase&&config.url&&config.anonKey?(window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true}}))):null;
 const esc=value=>String(value||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 let activePerson=null,activeIndex=0,modal=null,addModal=null,isOwner=false,ownerSession=null,portraitColumnAvailable=true,savedPeopleRows=[],currentRecords=[];
 function faceList(person){
  let faces=Array.isArray(person.portraits)?person.portraits:[];
  if(!faces.length&&person.portrait_url)faces=[{url:person.portrait_url,source_title:person.source_title,source_record_id:person.source_record_id,created_at:person.updated_at}];
  return faces.filter(face=>face&&(face.url||face.portrait_url)).map(face=>({...face,url:face.url||face.portrait_url}));
 }
 function extractRecordDate(record){const direct=String(record?.record_date||"").trim();if(direct)return direct;const description=String(record?.description||"");const match=description.match(/^Date on record:\s*([^\r\n]+)/im);return match?match[1].trim():"";}
 function normalizeName(value){return String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[\u200B-\u200D\uFEFF]/g,"").toLocaleLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");}
 function isHiddenCardMarker(person){return Array.isArray(person?.portraits)&&person.portraits.some(item=>item&&item[HIDDEN_FLAG]===true);}
 function isLegacyHiddenCardRow(person){return String(person?.name||"").startsWith(HIDDEN_ROW_PREFIX);}
 function isMissingPortraitsColumn(error){return /column .*portraits.* does not exist|could not find .*portraits.* column|schema cache/i.test(error?.message||"");}
 function yearFrom(value){const raw=String(value||"").trim();const match=raw.match(/(?:^|\D)((?:17|18|19|20)\d{2})(?:\D|$)/);return match?match[1]:"Year not recorded";}
 function recordedDate(value){const raw=String(value||"").trim();if(!raw)return "";const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(iso){const date=new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]));return date.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});}return raw;}
 function recordSubjectName(record){const title=String(record?.title||"").trim();if(!title)return "";const labeled=title.match(/^(?:(?:birth|baptism(?:al)?|death|burial)(?:\s+(?:record|certificate|entry))?\s+(?:of|for))\s+(.+)$/i);const suffix=title.match(/^(.+?)\s+(?:(?:birth|baptism(?:al)?|death|burial)(?:\s+(?:record|certificate|entry))?)$/i);if(labeled||suffix)return normalizeName(labeled?labeled[1]:suffix[1]);const category=String(record?.category||"").toLowerCase().replace(/[^a-z]+/g,"");return /birth|bapt|death|burial/.test(category)?normalizeName(title):"";}
 function personDates(records,people){const dates=new Map();(records||[]).forEach(record=>{const category=String(record.category||"").toLowerCase().replace(/[^a-z]+/g,"");const kind=category.includes("birth")||category.includes("bapt")?"birth":category.includes("death")||category.includes("burial")?"death":null;const raw=extractRecordDate(record),subject=recordSubjectName(record);if(!kind||!raw||!subject)return;const date=recordedDate(raw);(people||[]).forEach(person=>{const name=normalizeName(person.name);if(!name||subject!==name)return;if(!dates.has(name))dates.set(name,{});if(!dates.get(name)[kind])dates.get(name)[kind]=date;});});return dates;}
 function readLabeledValue(description,label){const prefix=label+":";const line=String(description||"").split(/\r?\n/).find(item=>item.trimStart().startsWith(prefix));return line?line.trim().slice(prefix.length).trim():"";}
 function deduplicatePeople(people){
  const merged=new Map();
  (people||[]).forEach(person=>{
   const key=normalizeName(person.name);
   if(!key)return;
   const existing=merged.get(key);
   if(!existing){merged.set(key,{...person,portraits:faceList(person)});return;}
   const combined=[...faceList(existing),...faceList(person)];
   const seen=new Set();
   existing.portraits=combined.filter(face=>{const url=String(face.url||"").trim();if(!url||seen.has(url))return false;seen.add(url);return true;});
   if(!existing.portrait_url)existing.portrait_url=person.portrait_url||existing.portraits[0]?.url||null;
   if(!existing.source_title&&person.source_title)existing.source_title=person.source_title;
   if(!existing.source_record_id&&person.source_record_id)existing.source_record_id=person.source_record_id;
   if(!existing.thumbnail_settings&&person.thumbnail_settings)existing.thumbnail_settings=person.thumbnail_settings;
   existing.record_mentioned_only=Boolean(existing.record_mentioned_only||person.record_mentioned_only);
  });
  return [...merged.values()];
 }
 function isResearchNotesRecord(record){const category=String(record?.category||"").toLowerCase().replace(/[^a-z]+/g,"");return category==="notes"||category==="sources"||category==="source"||category.includes("researchnote")||category.includes("sourcenote");}
 function namesFromRecords(records){
  const names=new Map(),add=value=>{const name=String(value||"").trim().replace(/^["']|["']$/g,"");const key=normalizeName(name);if(!key||key.length<2||/^(unknown|not recorded|none|n a)$/.test(key))return;if(!names.has(key))names.set(key,name);};
  (records||[]).forEach(record=>{
   // Research notes and transcription-only records must never create ancestor cards.
   if(isResearchNotesRecord(record))return;
   const mentioned=record.persons_mentioned;
   if(Array.isArray(mentioned))mentioned.forEach(add);
   else if(typeof mentioned==="string"){let parsed=null;try{parsed=JSON.parse(mentioned);}catch(_){}if(Array.isArray(parsed))parsed.forEach(add);else mentioned.split(/[\n,;]+/).forEach(add);}
   // Only explicitly labeled family fields are read from description.
   // The remaining transcription/notes text is deliberately ignored.
   const description=String(record.description||"");
   const labels=/^(?:Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother|Bride’s father|Bride’s mother|Groom’s father|Groom’s mother)|Bride|Groom):\s*(.+)$/gim;
   for(const match of description.matchAll(labels))add(match[1]);
   const title=String(record.title||"").trim();
   const labeled=title.match(/^(?:birth(?:\s+record)?\s+of|baptism(?:\s+record)?\s+of|death(?:\s+record)?\s+of|burial(?:\s+record)?\s+of)\s+(.+)$/i);
   const suffix=title.match(/^(.+?)\s+(?:birth|baptism|death|burial)(?:\s+record)?$/i);if(labeled)add(labeled[1]);else if(suffix)add(suffix[1]);else if(/birth|bapt|death|burial/i.test(String(record.category||""))&&title)add(title);
  });
  return [...names.values()];
 }
 function archiveRecordImageUrl(record){const path=String(record?.file_path||"").trim();if(!path)return "";const mime=String(record?.mime_type||"").toLowerCase(),image=mime.startsWith("image/")||/\.(?:jpe?g|png|gif|webp|avif|heic|tiff?)$/i.test(path.split("?")[0]);if(!image)return "";try{return client.storage.from("family-archive").getPublicUrl(path).data?.publicUrl||"";}catch(_){return "";}}
 function parseMentionedNames(value){if(Array.isArray(value))return value.map(item=>String(item||"").trim()).filter(Boolean);const raw=String(value||"").trim();if(!raw)return [];try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))return parsed.map(item=>String(item||"").trim()).filter(Boolean);}catch(_){}return raw.split(/[\n,;]+/).map(item=>item.trim()).filter(Boolean);}
 function recordMentionsPerson(record,name){if(isResearchNotesRecord(record))return false;const key=normalizeName(name);if(!key)return false;const mentioned=parseMentionedNames(record?.persons_mentioned);if(mentioned.some(item=>normalizeName(item)===key))return true;const description=String(record?.description||"");const roles=/^(?:Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother|Bride’s father|Bride’s mother|Groom’s father|Groom’s mother)|Bride|Groom):\s*(.+)$/gim;for(const match of description.matchAll(roles)){if(normalizeName(match[1])===key)return true;}for(const label of ["Page name identifications","Face identifications"]){const match=description.match(new RegExp("^"+label+":\\s*(\\[.*\\])\\s*$","im"));if(match){try{const entries=JSON.parse(match[1]);if(Array.isArray(entries)&&entries.some(entry=>normalizeName(entry?.name)===key))return true;}catch(_){}}}return recordSubjectName(record)===key;}
 function personProfiles(records,people){const profiles=new Map((people||[]).map(person=>[normalizeName(person.name),{birth:"",birthPlace:"",death:"",deathPlace:"",parents:[],mothers:[],fathers:[],grandparents:[],spouses:[],children:[],siblings:[],locations:[],sources:[]} ]));const add=(list,value)=>{const name=String(value||"").trim();if(name&&!list.some(item=>normalizeName(item)===normalizeName(name)))list.push(name);};(records||[]).forEach(record=>{if(isResearchNotesRecord(record))return;const category=String(record.category||"").toLowerCase().replace(/[^a-z]+/g,""),isBirth=category.includes("birth")||category.includes("bapt"),isDeath=category.includes("death")||category.includes("burial"),isMarriage=category.includes("marriage"),subject=recordSubjectName(record),raw=extractRecordDate(record),place=String(record.location||"").trim();people.forEach(person=>{const key=normalizeName(person.name),p=profiles.get(key);if(key&&p&&recordMentionsPerson(record,person.name)&&!p.sources.some(item=>String(item.id)===String(record.id))){p.sources.push({id:record.id,title:record.title||"Untitled record",category:record.category||"Record",date:recordedDate(raw),location:place,thumbnailUrl:archiveRecordImageUrl(record),recordId:record.id,record});if(place&&!p.locations.some(item=>normalizeName(item)===normalizeName(place)))p.locations.push(place);}});if((isBirth||isDeath)&&subject&&profiles.has(subject)&&raw){const p=profiles.get(subject);if(isBirth&&!p.birth){p.birth=recordedDate(raw);p.birthPlace=place;}if(isDeath&&!p.death){p.death=recordedDate(raw);p.deathPlace=place;}}if(isBirth&&subject&&profiles.has(subject)){const mother=readLabeledValue(record.description,"Family - Mother"),father=readLabeledValue(record.description,"Family - Father"),child=people.find(person=>normalizeName(person.name)===subject);if(child){const childProfile=profiles.get(subject);add(childProfile.parents,mother);add(childProfile.parents,father);add(childProfile.mothers,mother);add(childProfile.fathers,father);["Mother’s father","Mother’s mother","Father’s father","Father’s mother"].forEach(role=>add(childProfile.grandparents,readLabeledValue(record.description,"Family - "+role)));}if(mother&&profiles.has(normalizeName(mother)))add(profiles.get(normalizeName(mother)).children,child?.name);if(father&&profiles.has(normalizeName(father)))add(profiles.get(normalizeName(father)).children,child?.name);}if(isMarriage){const bride=readLabeledValue(record.description,"Bride"),groom=readLabeledValue(record.description,"Groom");if(bride&&groom){if(profiles.has(normalizeName(bride)))add(profiles.get(normalizeName(bride)).spouses,groom);if(profiles.has(normalizeName(groom)))add(profiles.get(normalizeName(groom)).spouses,bride);}}});
  const entries=[...(people||[])];
  // Complete reciprocal family links so each profile presents the same family relationships.
  entries.forEach(person=>{const profile=profiles.get(normalizeName(person.name));if(!profile)return;
   profile.parents.forEach(parent=>{const parentProfile=profiles.get(normalizeName(parent));if(parentProfile)add(parentProfile.children,person.name);});
   profile.spouses.forEach(spouse=>{const spouseProfile=profiles.get(normalizeName(spouse));if(spouseProfile)add(spouseProfile.spouses,person.name);});
   profile.parents.forEach(parent=>{const parentProfile=profiles.get(normalizeName(parent));if(parentProfile){parentProfile.grandparents.forEach(grandparent=>add(profile.grandparents,grandparent));}});
   entries.forEach(other=>{if(normalizeName(other.name)===normalizeName(person.name))return;const otherProfile=profiles.get(normalizeName(other.name));if(!otherProfile)return;const shared=profile.parents.some(parent=>otherProfile.parents.some(otherParent=>normalizeName(parent)===normalizeName(otherParent)));if(shared){add(profile.siblings,other.name);add(otherProfile.siblings,person.name);}});
  });
  // Parent names may have been collected before their own cards were loaded; keep
  // the explicit maternal/paternal labels and use all known parent links.
  profiles.forEach(profile=>{profile.parents.forEach(parent=>{const pp=profiles.get(normalizeName(parent));if(pp)pp.children.forEach(child=>{if(normalizeName(child)!==normalizeName(parent))add(profile.children,child);});});});
  return profiles;}
 function ensureModal(){
  if(modal)return modal;
  modal=document.createElement("section");modal.className="site-modal ancestor-face-modal";modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label","Ancestor face gallery");
  modal.innerHTML='<div class="modal-card ancestor-face-viewer ancestor-profile-viewer"><button type="button" class="modal-close" aria-label="Close ancestor profile">×</button><div class="ancestor-profile-layout"><section class="ancestor-profile-info"><p class="eyebrow">Ancestor profile</p><h2 class="ancestor-viewer-name"></h2><div class="ancestor-profile-facts"></div><section class="ancestor-profile-sources"><h3>Records mentioning this person</h3><div class="ancestor-profile-source-list"></div></section></section><section class="ancestor-profile-gallery"><h3>Record gallery</h3><p class="ancestor-gallery-empty" hidden>No archive records name this person.</p><div class="ancestor-record-gallery-heading"></div><div class="ancestor-record-viewer-toolbar"><button type="button" class="small-button ancestor-record-zoom-out" aria-label="Zoom out">−</button><button type="button" class="small-button ancestor-record-zoom-reset">Reset view</button><button type="button" class="small-button ancestor-record-zoom-in" aria-label="Zoom in">＋</button><span class="ancestor-record-zoom-level">100%</span><a class="small-button ancestor-record-download" hidden download>Download image</a><a class="small-button ancestor-record-source-link" hidden target="_blank" rel="noopener noreferrer">Image source</a></div><div class="ancestor-record-viewer-stage"><img class="ancestor-record-viewer-image" alt=""></div><p class="ancestor-record-viewer-caption"></p><div class="ancestor-record-gallery-picker"></div></section></div></div>';
  document.body.append(modal);
  const close=()=>{modal.hidden=true;activePerson=null;};
  modal.querySelector(".modal-close").addEventListener("click",close);
  modal.addEventListener("click",event=>{if(event.target===modal)close();});
  modal.querySelector(".ancestor-record-zoom-in").addEventListener("click",()=>zoomRecordViewer(1.25));modal.querySelector(".ancestor-record-zoom-out").addEventListener("click",()=>zoomRecordViewer(1/1.25));modal.querySelector(".ancestor-record-zoom-reset").addEventListener("click",resetRecordViewer);const stage=modal.querySelector(".ancestor-record-viewer-stage");stage.addEventListener("wheel",event=>{event.preventDefault();zoomRecordViewer(event.deltaY<0?1.15:1/1.15);},{passive:false});stage.addEventListener("pointerdown",event=>{if(recordViewerScale<=1)return;recordViewerDragging=true;recordViewerStart={x:event.clientX-recordViewerX,y:event.clientY-recordViewerY};stage.setPointerCapture(event.pointerId);});stage.addEventListener("pointermove",event=>{if(!recordViewerDragging)return;recordViewerX=event.clientX-recordViewerStart.x;recordViewerY=event.clientY-recordViewerStart.y;applyRecordViewerTransform();});stage.addEventListener("pointerup",()=>recordViewerDragging=false);stage.addEventListener("pointercancel",()=>recordViewerDragging=false);document.addEventListener("keydown",event=>{if(!modal.hidden&&event.key==="Escape")close();});
  return modal;
 }
 function navigateToAncestorCard(person){
  const card=[...grid.querySelectorAll(".ancestor-card")].find(item=>String(item.dataset.personId)===String(person.id));
  if(!card){openPerson(person);return;}
  if(modal)modal.hidden=true;activePerson=null;
  card.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});
  card.classList.remove("ancestor-card-navigation-target");
  requestAnimationFrame(()=>{card.classList.add("ancestor-card-navigation-target");const trigger=card.querySelector(".ancestor-card-open");if(trigger)trigger.focus({preventScroll:true});});
  window.setTimeout(()=>card.classList.remove("ancestor-card-navigation-target"),2200);
 }
 function renderProfileFacts(){
  if(!activePerson||!modal)return;
  const p=activePerson.profile||{},facts=modal.querySelector(".ancestor-profile-facts");facts.replaceChildren();
  const addFact=(label,value,interactive=false)=>{if(!value||!value.length)return;const section=document.createElement("section");section.className="ancestor-profile-fact";const heading=document.createElement("h4");heading.textContent=label;section.append(heading);if(interactive&&Array.isArray(value)){const links=document.createElement("div");links.className="ancestor-relationship-links";value.forEach(name=>{const related=(window.__tylkaAncestorPeople||[]).find(item=>normalizeName(item.name)===normalizeName(name));if(related){const button=document.createElement("button");button.type="button";button.className="ancestor-relationship-link";button.textContent=name;button.setAttribute("aria-label","Go to ancestor card for "+related.name);button.addEventListener("click",()=>navigateToAncestorCard(related));links.append(button);}else{const labelNode=document.createElement("span");labelNode.className="ancestor-relationship-unlinked";labelNode.textContent=name;links.append(labelNode);}});section.append(links);}else{const content=document.createElement("p");content.textContent=Array.isArray(value)?value.join(" · "):value;section.append(content);}facts.append(section);};
  addFact("Birth",p.birth? p.birth+(p.birthPlace?" · "+p.birthPlace:""):"");
  addFact("Death",p.death? p.death+(p.deathPlace?" · "+p.deathPlace:""):"");
  addFact("Mother",p.mothers,true);addFact("Father",p.fathers,true);addFact("Grandparents",p.grandparents,true);addFact("Other parents",p.parents.filter(name=>!p.mothers.some(item=>normalizeName(item)===normalizeName(name))&&!p.fathers.some(item=>normalizeName(item)===normalizeName(name))),true);addFact("Spouses",p.spouses,true);addFact("Siblings",p.siblings,true);addFact("Children",p.children,true);addFact("Places documented",p.locations);const sourceList=modal.querySelector(".ancestor-profile-source-list");sourceList.replaceChildren();(p.sources||[]).sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(source=>{const link=document.createElement("button");link.type="button";link.className="ancestor-source-reference";link.addEventListener("click",()=>selectPersonRecord(source.id));const title=document.createElement("strong");title.textContent=source.title;const meta=document.createElement("span");meta.textContent=[source.category,source.date,source.location].filter(Boolean).join(" · ");link.append(title,meta);sourceList.append(link);});if(!(p.sources||[]).length){const note=document.createElement("p");note.className="ancestor-no-sources";note.textContent="No matching archive records have been linked to this profile yet.";sourceList.append(note);}
 }
 let activeRecordItems=[],activeRecordItemIndex=0,recordViewerScale=1,recordViewerX=0,recordViewerY=0,recordViewerDragging=false,recordViewerStart={x:0,y:0};
 function applyRecordViewerTransform(){if(!modal)return;const image=modal.querySelector(".ancestor-record-viewer-image");if(image)image.style.transform="translate("+recordViewerX+"px,"+recordViewerY+"px) scale("+recordViewerScale+")";const level=modal.querySelector(".ancestor-record-zoom-level");if(level)level.textContent=Math.round(recordViewerScale*100)+"%";}
 function resetRecordViewer(){recordViewerScale=1;recordViewerX=0;recordViewerY=0;applyRecordViewerTransform();}
 function zoomRecordViewer(factor){recordViewerScale=Math.max(.5,Math.min(6,recordViewerScale*factor));applyRecordViewerTransform();}
 function personRecordSources(record){let attached=record.source_attachments;if(typeof attached==="string"){try{attached=JSON.parse(attached);}catch(_){attached=[];}}if(!Array.isArray(attached))attached=[];const items=attached.filter(item=>item&&item.file_path).map(item=>({...item,record}));if(record.file_path&&!items.some(item=>item.file_path===record.file_path))items.unshift({file_path:record.file_path,file_name:record.file_name||"Main source",mime_type:record.mime_type||"",role:"main",record});if(!items.length)items.push({record,noFile:true,role:"main",file_name:"No attached scan"});return items;}
 function personSourceUrl(item){if(!item?.file_path||!client)return "";try{return client.storage.from("family-archive").getPublicUrl(item.file_path).data?.publicUrl||"";}catch(_){return "";}}
 function isRecordImage(item){const mime=String(item?.mime_type||"").toLowerCase(),path=String(item?.file_path||"");return mime.startsWith("image/")||/\.(?:jpe?g|png|gif|webp|avif|heic|tiff?)$/i.test(path.split("?")[0]);}
 function selectPersonRecord(recordId){if(!activePerson)return;const profile=activePerson.profile||{},source=(profile.sources||[]).find(item=>String(item.id)===String(recordId));if(!source)return;activeRecordItems=personRecordSources(source.record);activeRecordItemIndex=0;renderPersonRecordPicker();showPersonRecordItem(0);}
 function renderPersonRecordPicker(){if(!modal)return;const picker=modal.querySelector(".ancestor-record-gallery-picker");picker.replaceChildren();activeRecordItems.forEach((item,index)=>{const button=document.createElement("button");button.type="button";button.className="ancestor-record-gallery-thumb"+(index===activeRecordItemIndex?" is-active":"");button.setAttribute("aria-pressed",String(index===activeRecordItemIndex));button.addEventListener("click",()=>showPersonRecordItem(index));const url=personSourceUrl(item);if(url&&isRecordImage(item)){const image=document.createElement("img");image.src=url;image.alt="";button.append(image);}else{const placeholder=document.createElement("span");placeholder.className="ancestor-record-gallery-document";placeholder.textContent=item.noFile?"NO SCAN":"DOCUMENT";button.append(placeholder);}const label=document.createElement("span");label.textContent=(item.role==="main"?"MAIN · ":"SUPPORT · ")+(item.caption||item.file_name||item.record.title||"Source");button.append(label);picker.append(button);});}
 function showPersonRecordItem(index){if(!modal||!activeRecordItems.length)return;activeRecordItemIndex=Math.max(0,Math.min(index,activeRecordItems.length-1));const item=activeRecordItems[activeRecordItemIndex],record=item.record;modal.querySelector(".ancestor-record-gallery-heading").textContent=[record.title||"Untitled record",record.record_date||"",record.location||""].filter(Boolean).join(" · ");const image=modal.querySelector(".ancestor-record-viewer-image"),caption=modal.querySelector(".ancestor-record-viewer-caption"),download=modal.querySelector(".ancestor-record-download"),source=modal.querySelector(".ancestor-record-source-link");resetRecordViewer();image.hidden=true;image.removeAttribute("src");download.hidden=true;source.hidden=true;caption.textContent=(item.role==="main"?"Main source":"Supporting source")+" · "+(item.caption||item.file_name||record.title||"Record");const url=personSourceUrl(item);if(url&&isRecordImage(item)){image.hidden=false;image.src=url;image.alt=(record.title||"Archive record")+" · "+(item.file_name||"Source image");download.href=url;download.download=item.file_name||"record-image";download.hidden=false;image.onerror=()=>{image.hidden=true;caption.textContent="This scan could not be loaded. Check the original archive record.";};}else if(url){caption.textContent+=" · Document source";source.href=url;source.hidden=false;}const sourceLink=String(item.source_url||item.image_source_url||item.source_link||item.source_reference||(item.role==="main"?item.record?.source_reference:"")||"").trim();try{const parsed=new URL(sourceLink);if(["http:","https:"].includes(parsed.protocol)){source.href=parsed.href;source.hidden=false;}}catch(_){}modal.querySelectorAll(".ancestor-record-gallery-thumb").forEach((button,i)=>{button.classList.toggle("is-active",i===activeRecordItemIndex);button.setAttribute("aria-pressed",String(i===activeRecordItemIndex));});}
 function renderPersonRecordGallery(){if(!activePerson||!modal)return;const profile=activePerson.profile||{},sources=(profile.sources||[]).slice().sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));const empty=modal.querySelector(".ancestor-gallery-empty");empty.hidden=Boolean(sources.length);if(!sources.length){modal.querySelector(".ancestor-record-gallery-heading").textContent="";modal.querySelector(".ancestor-record-gallery-picker").replaceChildren();modal.querySelector(".ancestor-record-viewer-image").hidden=true;modal.querySelector(".ancestor-record-viewer-caption").textContent="";return;}selectPersonRecord(sources[0].id);}

 async function setCardThumbnail(url,button){
  if(!activePerson||!client)return;
  button.disabled=true;button.textContent="Saving…";
  let result=await client.from("ancestor_portraits").update({portrait_url:url,thumbnail_settings:{},updated_at:new Date().toISOString()}).eq("id",activePerson.id);
  if(result.error&&/thumbnail_settings/i.test(result.error.message||""))result=await client.from("ancestor_portraits").update({portrait_url:url,updated_at:new Date().toISOString()}).eq("id",activePerson.id);
  if(result.error){button.disabled=false;button.textContent="Could not save — try again";return;}
  activePerson.portrait_url=url;activePerson.thumbnail_settings={};renderThumbnailForActive();button.textContent="Current card thumbnail";showFace(activeIndex);
 }
 function renderCardThumbnail(person){
  if(!person)return;
  const card=[...grid.querySelectorAll(".ancestor-card")].find(item=>item.dataset.personId===String(person.id));
  const trigger=card?.querySelector(".ancestor-card-open");if(!trigger)return;
  const faces=faceList(person),face=faces.find(item=>item.url===person.portrait_url)||faces[0];
  const selectedRecord=currentRecords.find(record=>String(record.id)===String(person.thumbnail_settings?.record_id||"")&&archiveRecordImageUrl(record));
  const url=(selectedRecord&&archiveRecordImageUrl(selectedRecord))||face?.url||person.profile?.recordThumbnailUrl||"";
  let current=trigger.querySelector(".ancestor-portrait,.ancestor-portrait-placeholder");
  if(url){
   if(current?.tagName==="IMG"){current.src=url;current.alt=face&&!selectedRecord?"Profile photo of "+person.name:"Archive record image mentioning "+person.name;}
   else{const image=document.createElement("img");image.className="ancestor-portrait";image.src=url;image.alt=face&&!selectedRecord?"Profile photo of "+person.name:"Archive record image mentioning "+person.name;if(current)current.replaceWith(image);else trigger.prepend(image);current=image;}
  }else if(current?.tagName!=="SPAN"){
   const placeholder=document.createElement("span");placeholder.className="ancestor-portrait-placeholder";placeholder.setAttribute("role","img");placeholder.setAttribute("aria-label","No thumbnail available");if(current)current.replaceWith(placeholder);else trigger.prepend(placeholder);current=placeholder;
  }
  const image=current?.tagName==="IMG"?current:null;
  window.TylkaThumbnailTools?.attachPerson(image,person,currentRecords,card,(nextUrl,settings)=>{
   person.thumbnail_settings=settings;
   let target=trigger.querySelector(".ancestor-portrait");
   if(!target){target=document.createElement("img");target.className="ancestor-portrait";target.alt="Archive record image mentioning "+person.name;const placeholder=trigger.querySelector(".ancestor-portrait-placeholder");if(placeholder)placeholder.replaceWith(target);else trigger.prepend(target);}
   target.src=nextUrl;target.dataset.tylkaPersonThumb=normalizeName(person.name);target.style.objectFit="cover";target.style.objectPosition=(settings.position_x??50)+"% "+(settings.position_y??50)+"%";target.style.transform="scale("+(settings.zoom||1)+")";target.style.transformOrigin="center center";
  },url);
 }
 function renderThumbnailForActive(){renderCardThumbnail(activePerson);}
 function openPerson(person){activePerson=person;const box=ensureModal();box.hidden=false;box.querySelector(".ancestor-viewer-name").textContent=person.name;renderProfileFacts();renderPersonRecordGallery();}
 function ensureAddModal(){
  if(addModal)return addModal;
  addModal=document.createElement("section");addModal.className="site-modal ancestor-add-modal";addModal.hidden=true;addModal.setAttribute("role","dialog");addModal.setAttribute("aria-modal","true");addModal.setAttribute("aria-label","Add ancestor card");
  addModal.innerHTML='<div class="modal-card ancestor-add-card"><button type="button" class="modal-close" aria-label="Close add ancestor form">×</button><p class="eyebrow">Owner workspace</p><h2>Add ancestor card</h2><p class="connection-status">Enter the ancestor’s name. If the person was previously removed, entering the same name restores the card. Existing cards will not be duplicated.</p><form class="ancestor-add-form"><label for="ancestor-new-name">Full name</label><input id="ancestor-new-name" name="name" type="text" maxlength="160" autocomplete="off" required><p class="form-message ancestor-add-status" role="status"></p><div class="ancestor-add-actions"><button class="button button-dark" type="submit">Add ancestor</button><button class="small-button ancestor-add-cancel" type="button">Cancel</button></div></form></div>';
  document.body.append(addModal);
  const close=()=>{addModal.hidden=true;};
  addModal.querySelector(".modal-close").addEventListener("click",close);
  addModal.querySelector(".ancestor-add-cancel").addEventListener("click",close);
  addModal.addEventListener("click",event=>{if(event.target===addModal)close();});
  addModal.querySelector(".ancestor-add-form").addEventListener("submit",async event=>{
   event.preventDefault();
   const form=event.currentTarget,input=form.querySelector("#ancestor-new-name"),status=form.querySelector(".ancestor-add-status"),submit=form.querySelector('button[type="submit"]'),name=input.value.trim();
   if(!isOwner||!ownerSession){status.textContent="Sign in as the owner to manage ancestor cards.";return;}
   if(!name){status.textContent="Enter an ancestor’s name.";return;}
   submit.disabled=true;status.textContent="Saving ancestor card…";
   try{
    const result=await addAncestorCard(name);
    if(result?.already){status.textContent="That ancestor is already in the index.";return;}
    form.reset();addModal.hidden=true;await load();
   }catch(error){status.textContent="Could not add this ancestor: "+(error.message||"Unknown error");}
   finally{submit.disabled=false;}
  });
  return addModal;
 }
 function openAddModal(){
  if(!isOwner)return;
  const box=ensureAddModal();box.hidden=false;box.querySelector("#ancestor-new-name").focus();
 }
 async function insertAncestorRow(name,portraits){
  const values={name,portrait_url:"",updated_at:new Date().toISOString(),created_by:ownerSession.user.id};
  if(portraitColumnAvailable)values.portraits=Array.isArray(portraits)?portraits:[];
  let result=await client.from("ancestor_portraits").insert(values);
  if(result.error&&portraitColumnAvailable&&isMissingPortraitsColumn(result.error)){
   portraitColumnAvailable=false;delete values.portraits;result=await client.from("ancestor_portraits").insert(values);
  }
  if(result.error)throw result.error;
 }
 async function insertLegacyHiddenMarker(name){
  const markerName=HIDDEN_ROW_PREFIX+normalizeName(name);
  if(savedPeopleRows.some(row=>row.name===markerName))return;
  const {error}=await client.from("ancestor_portraits").insert({name:markerName,portrait_url:"",updated_at:new Date().toISOString(),created_by:ownerSession.user.id});
  if(error)throw error;
 }
 async function addAncestorCard(name){
  if(!isOwner||!ownerSession)throw new Error("Owner sign-in is required.");
  const key=normalizeName(name);if(!key)throw new Error("Enter a valid name.");
  const legacyMarkers=savedPeopleRows.filter(row=>isLegacyHiddenCardRow(row)&&normalizeName(String(row.name).slice(HIDDEN_ROW_PREFIX.length))===key);
  const row=savedPeopleRows.find(person=>!isLegacyHiddenCardRow(person)&&normalizeName(person.name)===key);
  const hidden=Boolean(row&&isHiddenCardMarker(row));
  if(row&&!hidden&&!legacyMarkers.length)return {already:true};
  if(row&&hidden&&portraitColumnAvailable){
   const next=(Array.isArray(row.portraits)?row.portraits:[]).filter(item=>!item||item[HIDDEN_FLAG]!==true);
   const {error}=await client.from("ancestor_portraits").update({portraits:next,updated_at:new Date().toISOString()}).eq("id",row.id);
   if(error&&isMissingPortraitsColumn(error)){portraitColumnAvailable=false;await insertLegacyHiddenMarker(name);}
   else if(error)throw error;
  }
  for(const marker of legacyMarkers){const {error}=await client.from("ancestor_portraits").delete().eq("id",marker.id);if(error)throw error;}
  if(!row)await insertAncestorRow(name,[]);
  return {already:false};
 }
 async function hideAncestorCard(person){
  if(!isOwner||!ownerSession)throw new Error("Owner sign-in is required.");
  const key=normalizeName(person.name);
  const row=savedPeopleRows.find(item=>!isLegacyHiddenCardRow(item)&&normalizeName(item.name)===key);
  if(row&&portraitColumnAvailable){
   const current=Array.isArray(row.portraits)?row.portraits:[];
   if(!current.some(item=>item&&item[HIDDEN_FLAG]===true)){
    const {error}=await client.from("ancestor_portraits").update({portraits:[...current,{[HIDDEN_FLAG]:true}],updated_at:new Date().toISOString()}).eq("id",row.id);
    if(error&&isMissingPortraitsColumn(error)){portraitColumnAvailable=false;await insertLegacyHiddenMarker(person.name);}
    else if(error)throw error;
   }
   return;
  }
  if(!row&&portraitColumnAvailable){
   const result=await client.from("ancestor_portraits").insert({name:person.name,portrait_url:"",portraits:[{[HIDDEN_FLAG]:true}],updated_at:new Date().toISOString(),created_by:ownerSession.user.id});
   if(result.error&&isMissingPortraitsColumn(result.error)){portraitColumnAvailable=false;await insertLegacyHiddenMarker(person.name);}
   else if(result.error)throw result.error;
   return;
  }
  await insertLegacyHiddenMarker(person.name);
 }
 async function removeAncestorCard(person,button){
  if(!isOwner)return;
  if(!window.confirm("Remove "+person.name+" from the Ancestors page? This only hides the card. Archive records and saved profile photographs will not be deleted. You can restore the card later with Add ancestor."))return;
  if(button){button.disabled=true;button.textContent="Removing…";}
  try{await hideAncestorCard(person);await load();}
  catch(error){alert("Could not remove this ancestor card: "+(error.message||"Unknown error"));if(button){button.disabled=false;button.textContent="Remove";}}
 }
 async function deletePortrait(index){
  if(!activePerson||!client)return;
  const faces=faceList(activePerson),face=faces[index];if(!face)return;
  if(!window.confirm("Delete this profile photo? This will not remove the face identification from its original record."))return;
  const button=modal?.querySelector(".ancestor-delete-current");if(button)button.disabled=true;
  try{
   const next=faces.filter((_,i)=>i!==index),nextUrl=next[0]?.url||"";
   const values={portraits:next,portrait_url:nextUrl,source_record_id:next[0]?.source_record_id||null,source_title:next[0]?.source_title||null,updated_at:new Date().toISOString()};
   const keepRow=Boolean(activePerson.thumbnail_settings?.record_id);
   const result=!next.length&&!keepRow?await client.from("ancestor_portraits").delete().eq("id",activePerson.id):await client.from("ancestor_portraits").update(values).eq("id",activePerson.id);
   if(result.error)throw result.error;
   try{const pathname=new URL(face.url).pathname,marker="/family-archive/",at=pathname.indexOf(marker);if(at>=0)await client.storage.from("family-archive").remove([decodeURIComponent(pathname.slice(at+marker.length))]);}catch(_){}
   if(!next.length){activePerson={...activePerson,portraits:[],portrait_url:"",source_record_id:null,source_title:null};activeIndex=0;renderCardThumbnail(activePerson);showFace(0);return;}
   activePerson={...activePerson,portraits:next,portrait_url:nextUrl,source_record_id:values.source_record_id,source_title:values.source_title};
   const card=[...grid.querySelectorAll(".ancestor-card")].find(item=>item.dataset.personId===String(activePerson.id));if(card){const img=card.querySelector(".ancestor-portrait");if(img)img.src=nextUrl;const p=card.querySelector(".ancestor-source");if(p)p.textContent=next.length+" saved "+(next.length===1?"photo":"photos");}
   showFace(Math.min(index,next.length-1));
  }catch(error){alert("Could not delete this portrait: "+(error.message||"Unknown error"));if(button)button.disabled=false;}
 }
 function render(people,profiles){
  people=deduplicatePeople(people);people.sort((a,b)=>a.name.localeCompare(b.name));grid.replaceChildren();count.textContent=people.length+" "+(people.length===1?"person":"people");empty.hidden=people.length>0;
  people.forEach(person=>{
   const faces=faceList(person),profile=profiles.get(normalizeName(person.name))||{birth:"",birthPlace:"",death:"",deathPlace:"",parents:[],grandparents:[],spouses:[],children:[],siblings:[],sources:[]};
   profile.recordThumbnailUrl=(profile.sources||[]).find(source=>source.thumbnailUrl)?.thumbnailUrl||"";person.profile=profile;
   const card=document.createElement("article");card.className="ancestor-card ancestor-multi-card";card.dataset.personId=person.id;
   const trigger=document.createElement("button");trigger.type="button";trigger.className="ancestor-card-open";
   trigger.setAttribute("aria-label","Open profile for "+person.name+". Birth: "+(profile.birth||"Not recorded")+". Death: "+(profile.death||"Not recorded"));
   const face=faces.find(item=>item.url===person.portrait_url)||faces[0];
   const selectedRecord=currentRecords.find(record=>String(record.id)===String(person.thumbnail_settings?.record_id||"")&&archiveRecordImageUrl(record));
   const thumbnailUrl=(selectedRecord&&archiveRecordImageUrl(selectedRecord))||face?.url||profile.recordThumbnailUrl;
   let image=null;
   if(thumbnailUrl){image=document.createElement("img");image.className="ancestor-portrait";image.src=thumbnailUrl;image.alt=face&&!selectedRecord?"Profile photo of "+person.name:"Archive record image mentioning "+person.name;image.loading="lazy";trigger.append(image);}
   else{const placeholder=document.createElement("span");placeholder.className="ancestor-portrait-placeholder";placeholder.setAttribute("role","img");placeholder.setAttribute("aria-label","No thumbnail available");trigger.append(placeholder);}
   const body=document.createElement("div");body.className="ancestor-card-body";
   const title=document.createElement("h3");title.textContent=person.name;
   const birth=document.createElement("p");birth.className="ancestor-card-date";birth.textContent="Birth: "+(profile.birth||"Not recorded");
   const death=document.createElement("p");death.className="ancestor-card-date";death.textContent="Death: "+(profile.death||"Not recorded");
   body.append(title,birth,death);trigger.append(body);trigger.addEventListener("click",()=>openPerson(person));const viewButton=document.createElement("button");viewButton.type="button";viewButton.className="ancestor-view-button";viewButton.textContent="View ancestor";viewButton.addEventListener("click",()=>openPerson(person));card.append(trigger,viewButton);if(isOwner){const removeButton=document.createElement("button");removeButton.type="button";removeButton.className="ancestor-remove-card";removeButton.textContent="Remove";removeButton.title="Hide this ancestor card";removeButton.setAttribute("aria-label","Remove "+person.name+" from the Ancestors page");removeButton.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();removeAncestorCard(person,removeButton);});card.append(removeButton);}grid.append(card);
   window.TylkaThumbnailTools?.attachPerson(image,person,currentRecords,card,(nextUrl,settings)=>{
    person.thumbnail_settings=settings;
    let target=trigger.querySelector(".ancestor-portrait");
    if(!target){target=document.createElement("img");target.className="ancestor-portrait";target.alt="Archive record image mentioning "+person.name;const placeholder=trigger.querySelector(".ancestor-portrait-placeholder");if(placeholder)placeholder.replaceWith(target);else trigger.prepend(target);}
    target.src=nextUrl;target.style.objectFit="cover";target.style.objectPosition=(settings.position_x??50)+"% "+(settings.position_y??50)+"%";target.style.transform="scale("+(settings.zoom||1)+")";target.style.transformOrigin="center center";
   },thumbnailUrl||"");
  });
 }
 async function load(){
  if(!client){count.textContent="Archive connection unavailable";return;}
  try{const auth=await client.auth.getSession();ownerSession=auth.data?.session||null;isOwner=ownerSession?.user?.id===OWNER_ID;}catch(error){ownerSession=null;isOwner=false;console.warn("Could not check ancestor owner access:",error);}
  if(addButton)addButton.hidden=!isOwner;
  portraitColumnAvailable=true;
  let {data,error}=await client.from("ancestor_portraits").select("id,name,portrait_url,portraits,thumbnail_settings,source_title,source_record_id,updated_at").order("name");
  if(error&&/thumbnail_settings/i.test(error.message||"")){
   const legacySettings=await client.from("ancestor_portraits").select("id,name,portrait_url,portraits,source_title,source_record_id,updated_at").order("name");
   data=legacySettings.data;error=legacySettings.error;
  }
  // Backward compatibility for older tables without the multiple-photo column.
  if(isMissingPortraitsColumn(error)){
   portraitColumnAvailable=false;
   let legacy=await client.from("ancestor_portraits").select("id,name,portrait_url,source_title,source_record_id,updated_at,thumbnail_settings").order("name");
   if(legacy.error&&/thumbnail_settings/i.test(legacy.error.message||""))legacy=await client.from("ancestor_portraits").select("id,name,portrait_url,source_title,source_record_id,updated_at").order("name");
   data=legacy.data;error=legacy.error;
   if(!error)data=(data||[]).map(person=>({...person,portraits:person.portrait_url?[{url:person.portrait_url,source_title:person.source_title,source_record_id:person.source_record_id}]:[]}));
  }
  if(error){console.error("Ancestor people query failed; continuing with archive-derived names:",error);data=[];count.textContent="Profile photos unavailable — loading names from archive records";}
  savedPeopleRows=data||[];
  const hiddenKeys=new Set();
  savedPeopleRows.forEach(person=>{if(isLegacyHiddenCardRow(person))hiddenKeys.add(normalizeName(String(person.name).slice(HIDDEN_ROW_PREFIX.length)));else if(isHiddenCardMarker(person))hiddenKeys.add(normalizeName(person.name));});
  const people=savedPeopleRows.filter(person=>!isLegacyHiddenCardRow(person)&&!hiddenKeys.has(normalizeName(person.name)));
  window.__tylkaAncestorRows=savedPeopleRows;
  const ids=[...new Set(people.flatMap(person=>faceList(person).map(face=>face.source_record_id).filter(Boolean)))];
  if(ids.length){const {data:sourceRecords}=await client.from("archive_records").select("id,record_date,description").in("id",ids);const sourceDates=new Map((sourceRecords||[]).map(record=>[String(record.id),yearFrom(extractRecordDate(record))]));people.forEach(person=>faceList(person).forEach(face=>{if((!face.source_year||face.source_year==="Year not recorded")&&face.source_record_id&&sourceDates.has(String(face.source_record_id)))face.source_year=sourceDates.get(String(face.source_record_id));}));}
  const {data:lifeRecords,error:lifeError}=await client.from("archive_records").select("id,category,title,location,persons_mentioned,record_date,description,file_path,file_name,mime_type,source_attachments");
  if(lifeError)console.warn("Could not load ancestor life dates:",lifeError.message);
  const records=lifeError?[]:(lifeRecords||[]);currentRecords=records;
  const known=new Set(people.map(person=>normalizeName(person.name)));
  namesFromRecords(records).forEach(name=>{const key=normalizeName(name);if(!hiddenKeys.has(key)&&!known.has(key)){known.add(key);people.push({id:"record-person-"+key.replace(/\s+/g,"-"),name,portrait_url:null,portraits:[],record_mentioned_only:true});}});
  const uniquePeople=deduplicatePeople(people);
  window.__tylkaAncestorPeople=uniquePeople;
  const profiles=personProfiles(records,uniquePeople);
  render(uniquePeople,profiles);
 }
 if(addButton)addButton.addEventListener("click",openAddModal);
 load().catch(error=>{console.error("Ancestor page failed to load:",error);count.textContent="Could not load ancestor cards.";empty.hidden=false;empty.textContent="The ancestor list encountered an error while loading. Please check the browser console.";});document.addEventListener("tylka:auth-changed",load);
})();