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
 function extractRecordDate(record){const direct=String(record?.record_date||"").trim();if(direct)return direct;const description=String(record?.description||"");const match=description.match(/^Date on record:\\s*([^\\r\\n]+)/im);return match?match[1].trim():"";}
 function yearFrom(value){const match=String(value||"").match(/(?:17|18|19|20)\\d{2}/);return match?match[0]:"Year not recorded";}
 function normalizeName(value){return String(value||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLocaleLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
 function recordedDate(value){const raw=String(value||"").trim();if(!raw)return "";const iso=raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);if(iso){const date=new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]));return date.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});}return raw;}
 function personDates(records){const dates=new Map();(records||[]).forEach(record=>{const category=String(record.category||"").toLowerCase().replace(/[^a-z]+/g,"");const kind=category.includes("birth")||category.includes("bapt")?"birth":category.includes("death")||category.includes("burial")?"death":null;const raw=extractRecordDate(record);if(!kind||!raw)return;const date=recordedDate(raw);String(record.persons_mentioned||"").split(/[\\n,;|]+/).map(name=>normalizeName(name.replace(/^[-•*]+\\s*/,""))).filter(Boolean).forEach(name=>{if(!dates.has(name))dates.set(name,{});if(!dates.get(name)[kind])dates.get(name)[kind]=date;});});return dates;}
 function ensureModal(){
  if(modal)return modal;
  modal=document.createElement("section");modal.className="site-modal ancestor-face-modal";modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label","Ancestor face gallery");
  modal.innerHTML='<div class="modal-card ancestor-face-viewer"><button type="button" class="modal-close" aria-label="Close portraits">×</button><p class="eyebrow">Ancestor portrait collection</p><h2 class="ancestor-viewer-name"></h2><div class="ancestor-viewer-stage"><button type="button" class="ancestor-face-arrow ancestor-face-prev" aria-label="Previous face">‹</button><img class="ancestor-viewer-image" alt=""><button type="button" class="ancestor-face-arrow ancestor-face-next" aria-label="Next face">›</button></div><p class="ancestor-face-position"></p><p class="ancestor-face-source"></p><div class="ancestor-face-thumbnails"></div></div>';
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
  box.querySelector(".ancestor-viewer-image").alt="Portrait "+(activeIndex+1)+" of "+activePerson.name;
  box.querySelector(".ancestor-viewer-name").textContent=activePerson.name;
  box.querySelector(".ancestor-face-position").textContent="Face "+(activeIndex+1)+" of "+faces.length;
  box.querySelector(".ancestor-face-source").textContent="Year: "+(face.source_year||"Year not recorded")+" · "+(face.source_title?"Source: "+face.source_title:"Portrait source not recorded");
  const thumbButton=box.querySelector(".ancestor-set-thumbnail");
  thumbButton.textContent=activePerson.portrait_url===face.url?"Current card thumbnail":"Use as card thumbnail";
  thumbButton.disabled=activePerson.portrait_url===face.url;
  thumbButton.onclick=()=>setCardThumbnail(face.url,thumbButton);
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
 function render(people,dates){
  people.sort((a,b)=>a.name.localeCompare(b.name));
  grid.replaceChildren();count.textContent=people.length+" "+(people.length===1?"person":"people");empty.hidden=people.length>0;
  people.forEach(person=>{
   const faces=faceList(person);if(!faces.length)return;
   const card=document.createElement("article");card.className="ancestor-card ancestor-multi-card";card.dataset.personId=person.id;
   const trigger=document.createElement("button");trigger.type="button";trigger.className="ancestor-card-open";trigger.setAttribute("aria-label","View all "+faces.length+" portraits of "+person.name);
   const image=document.createElement("img");image.className="ancestor-portrait";image.src=(faces.find(face=>face.url===person.portrait_url)||faces[0]).url;image.alt="Portrait of "+person.name;
   const body=document.createElement("div");body.className="ancestor-card-body";
   const title=document.createElement("h3");title.textContent=person.name;
   const source=document.createElement("p");source.className="ancestor-source";source.textContent=faces.length+" saved "+(faces.length===1?"face":"faces");
   const life=document.createElement("p");life.className="ancestor-life-dates";const personDate=dates.get(normalizeName(person.name))||{};const dateParts=[];if(personDate.birth)dateParts.push("Born: "+personDate.birth);if(personDate.death)dateParts.push("Died: "+personDate.death);life.textContent=dateParts.join(" · ");life.hidden=!dateParts.length;
   const open=document.createElement("span");open.className="small-button";open.textContent="View all faces";
   body.append(title,source,life,open);trigger.append(image,body);trigger.addEventListener("click",()=>openPerson(person));card.append(trigger);grid.append(card);
  });
 }
 async function load(){
  if(!client){count.textContent="Archive connection unavailable";return;}
  const {data,error}=await client.from("ancestor_portraits").select("id,name,portrait_url,portraits,source_title,source_record_id,updated_at").order("name");
  if(error){count.textContent=error.message.includes("portraits")?"Run the multiple-face portraits migration in Supabase.":"Could not load shared portraits.";return;}
  const people=data||[];
  const ids=[...new Set(people.flatMap(person=>faceList(person).map(face=>face.source_record_id).filter(Boolean)))];
  if(ids.length){const {data:sourceRecords}=await client.from("archive_records").select("id,record_date,description").in("id",ids);const sourceDates=new Map((sourceRecords||[]).map(record=>[String(record.id),yearFrom(extractRecordDate(record))]));people.forEach(person=>faceList(person).forEach(face=>{if((!face.source_year||face.source_year==="Year not recorded")&&face.source_record_id&&sourceDates.has(String(face.source_record_id)))face.source_year=sourceDates.get(String(face.source_record_id));}));}
  const {data:lifeRecords,error:lifeError}=await client.from("archive_records").select("category,persons_mentioned,record_date,description");
  if(lifeError)console.warn("Could not load ancestor life dates:",lifeError.message);
  const lifeDates=personDates(lifeError?[]:lifeRecords);
  render(people,lifeDates);
 }
 load();window.addEventListener("tylka:auth-changed",load);
})();