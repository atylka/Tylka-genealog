(() => {
 const grid=document.getElementById("ancestor-grid"),empty=document.getElementById("ancestor-empty"),count=document.getElementById("ancestor-count");
 const config=window.TYLKA_SUPABASE_CONFIG||{};
 const client=window.supabase&&config.url&&config.anonKey?(window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true}}))):null;
 const esc=value=>String(value||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 let activePerson=null,activeIndex=0,modal=null;
 function faceList(person){
  let faces=Array.isArray(person.portraits)?person.portraits:[];
  if(!faces.length&&person.portrait_url)faces=[{url:person.portrait_url,source_title:person.source_title,source_record_id:person.source_record_id,created_at:person.updated_at}];
  return faces.filter(face=>face&&(face.url||face.portrait_url)).map(face=>({...face,url:face.url||face.portrait_url}));
 }
 function extractRecordDate(record){const direct=String(record?.record_date||"").trim();if(direct)return direct;const description=String(record?.description||"");const match=description.match(/^Date on record:\s*([^\r\n]+)/im);return match?match[1].trim():"";}
 function normalizeName(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
 function yearFrom(value){const raw=String(value||"").trim();const match=raw.match(/(?:^|\D)((?:17|18|19|20)\d{2})(?:\D|$)/);return match?match[1]:"Year not recorded";}
 function recordedDate(value){const raw=String(value||"").trim();if(!raw)return "";const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(iso){const date=new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]));return date.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});}return raw;}
 function recordSubjectName(record){const title=String(record?.title||"").trim();if(!title)return "";const labeled=title.match(/^(?:birth(?:\s+record)?\s+of|baptism(?:\s+record)?\s+of|death(?:\s+record)?\s+of|burial(?:\s+record)?\s+of)\s+(.+)$/i);return normalizeName(labeled?labeled[1]:title);}
 function personDates(records,people){const dates=new Map();(records||[]).forEach(record=>{const category=String(record.category||"").toLowerCase().replace(/[^a-z]+/g,"");const kind=category.includes("birth")||category.includes("bapt")?"birth":category.includes("death")||category.includes("burial")?"death":null;const raw=extractRecordDate(record),subject=recordSubjectName(record);if(!kind||!raw||!subject)return;const date=recordedDate(raw);(people||[]).forEach(person=>{const name=normalizeName(person.name);if(!name||subject!==name)return;if(!dates.has(name))dates.set(name,{});if(!dates.get(name)[kind])dates.get(name)[kind]=date;});});return dates;}
 function readLabeledValue(description,label){const prefix=label+":";const line=String(description||"").split(/\r?\n/).find(item=>item.trimStart().startsWith(prefix));return line?line.trim().slice(prefix.length).trim():"";}
 function personProfiles(records,people){const profiles=new Map((people||[]).map(person=>[normalizeName(person.name),{birth:"",birthPlace:"",death:"",deathPlace:"",parents:[],spouses:[],children:[]} ]));const add=(list,value)=>{const name=String(value||"").trim();if(name&&!list.some(item=>normalizeName(item)===normalizeName(name)))list.push(name);};(records||[]).forEach(record=>{const category=String(record.category||"").toLowerCase().replace(/[^a-z]+/g,""),isBirth=category.includes("birth")||category.includes("bapt"),isDeath=category.includes("death")||category.includes("burial"),isMarriage=category.includes("marriage"),subject=recordSubjectName(record),raw=extractRecordDate(record),place=String(record.location||"").trim();if((isBirth||isDeath)&&subject&&profiles.has(subject)&&raw){const p=profiles.get(subject);if(isBirth&&!p.birth){p.birth=recordedDate(raw);p.birthPlace=place;}if(isDeath&&!p.death){p.death=recordedDate(raw);p.deathPlace=place;}}if(isBirth&&subject&&profiles.has(subject)){const mother=readLabeledValue(record.description,"Family - Mother"),father=readLabeledValue(record.description,"Family - Father"),child=people.find(person=>normalizeName(person.name)===subject);if(child){add(profiles.get(subject).parents,mother);add(profiles.get(subject).parents,father);}if(mother&&profiles.has(normalizeName(mother)))add(profiles.get(normalizeName(mother)).children,child?.name);if(father&&profiles.has(normalizeName(father)))add(profiles.get(normalizeName(father)).children,child?.name);}if(isMarriage){const bride=readLabeledValue(record.description,"Bride"),groom=readLabeledValue(record.description,"Groom");if(bride&&groom){if(profiles.has(normalizeName(bride)))add(profiles.get(normalizeName(bride)).spouses,groom);if(profiles.has(normalizeName(groom)))add(profiles.get(normalizeName(groom)).spouses,bride);}}});return profiles;}
 function ensureModal(){
  if(modal)return modal;
  modal=document.createElement("section");modal.className="site-modal ancestor-face-modal";modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label","Ancestor face gallery");
  modal.innerHTML='<div class="modal-card ancestor-face-viewer"><button type="button" class="modal-close" aria-label="Close profile photos">×</button><p class="eyebrow">Ancestor profile photo gallery</p><h2 class="ancestor-viewer-name"></h2><div class="ancestor-viewer-stage"><button type="button" class="ancestor-face-arrow ancestor-face-prev" aria-label="Previous face">‹</button><img class="ancestor-viewer-image" alt=""><button type="button" class="ancestor-face-arrow ancestor-face-next" aria-label="Next face">›</button></div><p class="ancestor-face-position"></p><p class="ancestor-face-source"></p><div class="ancestor-viewer-actions"><button type="button" class="small-button ancestor-set-thumbnail">Use as card thumbnail</button><button type="button" class="small-button danger-button ancestor-delete-current" aria-label="Delete this ancestor portrait" title="Delete this profile photo"><svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 10v7m4-7v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="ancestor-face-thumbnails"></div></div>';
  document.body.append(modal);
  const close=()=>{modal.hidden=true;activePerson=null;};
  modal.querySelector(".modal-close").addEventListener("click",close);
  modal.addEventListener("click",event=>{if(event.target===modal)close();});
  modal.querySelector(".ancestor-face-prev").addEventListener("click",()=>showFace(activeIndex-1));
  modal.querySelector(".ancestor-face-next").addEventListener("click",()=>showFace(activeIndex+1));
  document.addEventListener("keydown",event=>{if(!modal.hidden&&event.key==="Escape")close();if(!modal.hidden&&event.key==="ArrowLeft")showFace(activeIndex-1);if(!modal.hidden&&event.key==="ArrowRight")showFace(activeIndex+1);});
  return modal;
 }
 function showFace(index){
  if(!activePerson)return;
  const faces=faceList(activePerson);if(!faces.length)return;
  activeIndex=(index+faces.length)%faces.length;
  const face=faces[activeIndex],box=ensureModal();
  box.querySelector(".ancestor-viewer-image").src=face.url;
  box.querySelector(".ancestor-viewer-image").alt="Profile photo "+(activeIndex+1)+" of "+activePerson.name;
  box.querySelector(".ancestor-viewer-name").textContent=activePerson.name;
  box.querySelector(".ancestor-face-position").textContent="Face "+(activeIndex+1)+" of "+faces.length;
  box.querySelector(".ancestor-face-source").textContent="Year: "+(face.source_year||"Year not recorded")+" · "+(face.source_title?"Source: "+face.source_title:"Profile photo source not recorded");
  const thumbButton=box.querySelector(".ancestor-set-thumbnail");
  if(thumbButton){thumbButton.textContent=activePerson.portrait_url===face.url?"Current card thumbnail":"Use as card thumbnail";thumbButton.disabled=activePerson.portrait_url===face.url;thumbButton.onclick=()=>setCardThumbnail(face.url,thumbButton);}
  const deleteButton=box.querySelector(".ancestor-delete-current");
  if(deleteButton){deleteButton.disabled=false;deleteButton.onclick=()=>deletePortrait(activeIndex);}
  box.querySelector(".ancestor-face-prev").disabled=faces.length<2;
  box.querySelector(".ancestor-face-next").disabled=faces.length<2;
  const thumbs=box.querySelector(".ancestor-face-thumbnails");thumbs.replaceChildren();
  faces.forEach((item,i)=>{const button=document.createElement("button");button.type="button";button.className="ancestor-face-thumb"+(i===activeIndex?" is-active":"");button.setAttribute("aria-label","View face "+(i+1));const img=document.createElement("img");img.src=item.url;img.alt="";button.append(img);button.addEventListener("click",()=>showFace(i));thumbs.append(button);});
 }
 async function setCardThumbnail(url,button){
  if(!activePerson||!client)return;
  button.disabled=true;button.textContent="Saving…";
  const {error}=await client.from("ancestor_portraits").update({portrait_url:url,updated_at:new Date().toISOString()}).eq("id",activePerson.id);
  if(error){button.disabled=false;button.textContent="Could not save — try again";return;}
  activePerson.portrait_url=url;renderThumbnailForActive();button.textContent="Current card thumbnail";showFace(activeIndex);
 }
 function renderThumbnailForActive(){
  if(!activePerson)return;
  const card=[...grid.querySelectorAll(".ancestor-card")].find(item=>item.dataset.personId===String(activePerson.id));
  if(card){const image=card.querySelector(".ancestor-portrait");image.src=activePerson.portrait_url||faceList(activePerson)[0].url;}
 }
 function openPerson(person){activePerson=person;ensureModal().hidden=false;showFace(0);}
 async function deletePortrait(index){
  if(!activePerson||!client)return;
  const faces=faceList(activePerson),face=faces[index];if(!face)return;
  if(!window.confirm("Delete this profile photo? This will not remove the face identification from its original record."))return;
  const button=modal?.querySelector(".ancestor-delete-current");if(button)button.disabled=true;
  try{
   const next=faces.filter((_,i)=>i!==index),nextUrl=next[0]?.url||null;
   const values={portraits:next,portrait_url:nextUrl,source_record_id:next[0]?.source_record_id||null,source_title:next[0]?.source_title||null,updated_at:new Date().toISOString()};
   const result=!next.length?await client.from("ancestor_portraits").delete().eq("id",activePerson.id):await client.from("ancestor_portraits").update(values).eq("id",activePerson.id);
   if(result.error)throw result.error;
   try{const pathname=new URL(face.url).pathname,marker="/family-archive/",at=pathname.indexOf(marker);if(at>=0)await client.storage.from("family-archive").remove([decodeURIComponent(pathname.slice(at+marker.length))]);}catch(_){}
   if(!next.length){const card=[...grid.querySelectorAll(".ancestor-card")].find(item=>item.dataset.personId===String(activePerson.id));card?.remove();activePerson=null;modal.hidden=true;count.textContent=grid.querySelectorAll(".ancestor-card").length+" people";empty.hidden=grid.querySelectorAll(".ancestor-card").length>0;return;}
   activePerson={...activePerson,portraits:next,portrait_url:nextUrl,source_record_id:values.source_record_id,source_title:values.source_title};
   const card=[...grid.querySelectorAll(".ancestor-card")].find(item=>item.dataset.personId===String(activePerson.id));if(card){const img=card.querySelector(".ancestor-portrait");if(img)img.src=nextUrl;const p=card.querySelector(".ancestor-source");if(p)p.textContent=next.length+" saved "+(next.length===1?"face":"faces");}
   showFace(Math.min(index,next.length-1));
  }catch(error){alert("Could not delete this portrait: "+(error.message||"Unknown error"));if(button)button.disabled=false;}
 }
 function render(people,profiles){
  people.sort((a,b)=>a.name.localeCompare(b.name));grid.replaceChildren();count.textContent=people.length+" "+(people.length===1?"person":"people");empty.hidden=people.length>0;
  people.forEach(person=>{const faces=faceList(person),p=profiles.get(normalizeName(person.name))||{birth:"",birthPlace:"",death:"",deathPlace:"",parents:[],spouses:[],children:[]},card=document.createElement("article");card.className="ancestor-card ancestor-multi-card ancestor-profile-card";card.dataset.personId=person.id;
   const photo=document.createElement("button");photo.type="button";photo.className="ancestor-profile-photo";photo.disabled=!faces.length;photo.setAttribute("aria-label",faces.length?"View profile photos of "+person.name:"No profile photo for "+person.name);
   if(faces.length){const image=document.createElement("img");image.className="ancestor-portrait";image.src=(faces.find(face=>face.url===person.portrait_url)||faces[0]).url;image.alt="Profile photo of "+person.name;photo.append(image);}else{const placeholder=document.createElement("span");placeholder.className="ancestor-portrait-placeholder";placeholder.textContent="Profile photo not added";photo.append(placeholder);}if(faces.length)photo.addEventListener("click",()=>openPerson(person));
   const body=document.createElement("div");body.className="ancestor-card-body ancestor-profile-body";const title=document.createElement("h3");title.textContent=person.name;body.append(title);
   const life=document.createElement("div");life.className="ancestor-profile-life";const birth=document.createElement("p"),death=document.createElement("p");birth.innerHTML="<strong>Born</strong> · "+esc(p.birth||"Date not recorded")+(p.birthPlace?"<span> · "+esc(p.birthPlace)+"</span>":"");death.innerHTML="<strong>Died</strong> · "+esc(p.death||"Date not recorded")+(p.deathPlace?"<span> · "+esc(p.deathPlace)+"</span>":"");life.append(birth,death);body.append(life);
   const relation=(label,values)=>{if(!values.length)return;const section=document.createElement("section"),heading=document.createElement("h4"),names=document.createElement("p");section.className="ancestor-profile-relations";heading.textContent=label;names.textContent=values.join(" · ");section.append(heading,names);body.append(section);};relation("Parents",p.parents);relation("Spouse",p.spouses);relation("Children",p.children);
   const source=document.createElement("p");source.className="ancestor-source";source.textContent=faces.length?faces.length+" profile "+(faces.length===1?"photo":"photos"):"No profile photo saved";body.append(source);card.append(photo,body);grid.append(card);
  });
 }
 async function load(){
  if(!client){count.textContent="Archive connection unavailable";return;}
  let {data,error}=await client.from("ancestor_portraits").select("id,name,portrait_url,portraits,source_title,source_record_id,updated_at").order("name");
  // Backward compatibility: older Supabase tables may not yet have the
  // multi-portrait JSON column. Load their original single-portrait rows
  // rather than returning early and leaving the entire people grid blank.
  if(error&&/column .*portraits.* does not exist|could not find .*portraits.* column|schema cache/i.test(error.message||"")){
   const legacy=await client.from("ancestor_portraits").select("id,name,portrait_url,source_title,source_record_id,updated_at").order("name");
   data=legacy.data;error=legacy.error;
   if(!error)data=(data||[]).map(person=>({...person,portraits:person.portrait_url?[{url:person.portrait_url,source_title:person.source_title,source_record_id:person.source_record_id}]:[]}));
  }
  if(error){console.error("Ancestor people query failed:",error);count.textContent="Could not load people: "+error.message;empty.hidden=false;empty.textContent="The ancestor list could not be loaded. Check the Supabase ancestor_portraits table permissions and schema.";return;}
  const people=data||[];
  const ids=[...new Set(people.flatMap(person=>faceList(person).map(face=>face.source_record_id).filter(Boolean)))];
  if(ids.length){const {data:sourceRecords}=await client.from("archive_records").select("id,record_date,description").in("id",ids);const sourceDates=new Map((sourceRecords||[]).map(record=>[String(record.id),yearFrom(extractRecordDate(record))]));people.forEach(person=>faceList(person).forEach(face=>{if((!face.source_year||face.source_year==="Year not recorded")&&face.source_record_id&&sourceDates.has(String(face.source_record_id)))face.source_year=sourceDates.get(String(face.source_record_id));}));}
  const {data:lifeRecords,error:lifeError}=await client.from("archive_records").select("category,title,location,persons_mentioned,record_date,description");
  if(lifeError)console.warn("Could not load ancestor life dates:",lifeError.message);
  const profiles=personProfiles(lifeError?[]:lifeRecords,people);
  render(people,profiles);
 }
 load().catch(error=>{console.error("Ancestor page failed to load:",error);count.textContent="Could not load ancestor cards.";empty.hidden=false;empty.textContent="The ancestor list encountered an error while loading. Please check the browser console.";});window.addEventListener("tylka:auth-changed",load);
})();