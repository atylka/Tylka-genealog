(() => {
 const config=window.TYLKA_SUPABASE_CONFIG||{};
 const names={births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
 const $=id=>document.getElementById(id);let client=null;const publicUrl=path=>client.storage.from("family-archive").getPublicUrl(path).data.publicUrl;
 const timeline=$("chrono-timeline"),count=$("chrono-count"),locationInput=$("chrono-location"),personInput=$("chrono-person"),folderInput=$("chrono-folder"),yearInput=$("chrono-year");
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const cleanChronoDescription=value=>{
  return String(value||"").split(/\r?\n/).filter(line=>{
   const s=line.trim();
   if(!s)return false;
   return !/(?:face|name)[\s_-]*(?:identif(?:y|ication|ied|ier)|recognition|detection)[\s_-]*(?:coordinates?|coords?|points?|regions?|boxes?|bounds?)/i.test(s)
    &&!/(?:coordinates?|coords?|bounding[\s_-]*boxes?|normalized[\s_-]*(?:x|y)|face[\s_-]*(?:box|region|landmark)|name[\s_-]*(?:box|region|landmark))/i.test(s)
    &&!/^[\s{}[\](),.:;"']*(?:x|y|w|h|left|top|right|bottom)[\s"'=:,.-]*-?\d+(?:\.\d+)?[\s,;)}\]]*$/i.test(s);
  }).join("\n").replace(/date\s+on\s+(?:the\s+)?record\s*:\s*[^\n\r]+/i,"").replace(/\n{3,}/g,"\n\n").trim();
 };
 const displayPeople=value=>{
  if(Array.isArray(value))return value.map(item=>typeof item==="string"?item:(item?.name||item?.full_name||"")).filter(Boolean).join(", ");
  if(value&&typeof value==="object")return Object.values(value).flat().map(item=>typeof item==="string"?item:(item?.name||item?.full_name||"")).filter(Boolean).join(", ");
  return String(value||"").replace(/^\\s*\\[|\\]\\s*$/g,"").replace(/["{}]/g,"").trim();
 };
 const familyValues=record=>{
  const raw=String(record.description||"");
  const read=label=>{const m=raw.match(new RegExp("^Family - "+label+":\\s*([^\\r\\n]+)$","im"));return m?m[1].trim():"";};
  return {mother:read("Mother"),father:read("Father"),maternalGrandfather:read("Mother’s father"),maternalGrandmother:read("Mother’s mother"),paternalGrandfather:read("Father’s father"),paternalGrandmother:read("Father’s mother")};
 };
 const chronoThumbPath=record=>{const m=String(record.description||"").match(/^Chrono thumbnail:\\s*([^\\r\\n]+)$/im);return m?m[1].trim():"";};
 const withChronoThumb=(record,path)=>{const raw=String(record.description||"").replace(/^Chrono thumbnail:\\s*[^\\r\\n]*\\s*$/im,"").trim();return (raw?raw+"\\n\\n":"")+"Chrono thumbnail: "+path;};
 const withoutChronoThumb=record=>String(record.description||"").replace(/^Chrono thumbnail:\\s*[^\\r\\n]*\\s*$/im,"").replace(/\\n{3,}/g,"\\n\\n").trim();
 const appendInfoBox=(parent,label,value,cls="")=>{
  if(!value)return;
  const box=node("div","",("chrono-info-box "+cls).trim());
  box.append(node("span",label,"chrono-info-label"),node("p",value,"chrono-info-value"));
  parent.append(box);
 };
 const dateText=record=>{const description=record.description||"";const labeled=description.match(/date\s+on\s+(?:the\s+)?record\s*:\s*([^\n\r]+)/i);return String(labeled?.[1]||record.record_date||"").trim();};
 function parseRecordDate(record){
  const raw=dateText(record);if(!raw)return null;
  if(/^\d{4}$/.test(raw))return null;
  let match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[Tt ]\d{2}:\d{2})/);
  if(match){const y=+match[1],m=+match[2],day=+match[3],d=new Date(y,m-1,day);return d.getFullYear()===y&&d.getMonth()===m-1&&d.getDate()===day?d:null;}
  match=raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if(match){const a=+match[1],b=+match[2],y=+match[3],month=a>12?b:a,day=a>12?a:b;if(month<1||month>12||day<1||day>31)return null;const d=new Date(y,month-1,day);return d.getFullYear()===y&&d.getMonth()===month-1&&d.getDate()===day?d:null;}
  const parsed=new Date(raw);return Number.isNaN(parsed.getTime())?null:new Date(parsed.getUTCFullYear(),parsed.getUTCMonth(),parsed.getUTCDate());
 }
 const eventDescription=record=>{
  const title=String(record.title||"Untitled record").trim();
  const category=record.category||"";
  if(category==="births")return /^birth\b/i.test(title)?title:"Birth of "+title;
  if(category==="deaths")return /^(death|burial)\b/i.test(title)?title:"Death of "+title;
  if(category==="marriages"){
   if(/\bmarriage\b/i.test(title))return title;
   return "Marriage between "+title;
  }
  if(category==="immigration")return /\b(immigration|naturalization|arrival)\b/i.test(title)?title:"Immigration of "+title;
  if(category==="photos")return "Family photograph: "+title;
  return title;
 };
 const findYear=value=>{const match=String(value||"").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);return match?Number(match[1]):null;};
 function recordYear(record){return parseRecordDate(record)?.getFullYear()||findYear(dateText(record))||findYear(record.title)||findYear(record.description);}
 function formatRecordDate(record){const raw=dateText(record),yearOnly=raw.match(/^(\d{4})$/),date=parseRecordDate(record);if(yearOnly)return yearOnly[1];return date?new Intl.DateTimeFormat("en-US",{month:"long",day:"numeric",year:"numeric"}).format(date):raw;}

 function render(records){
  const loc=locationInput.value.trim().toLocaleLowerCase(),person=personInput.value.trim().toLocaleLowerCase(),folder=folderInput.value,year=yearInput.value;
  const filtered=records.filter(r=>{
   const text=[r.title,r.description,r.file_name,r.persons_mentioned].join(" ").toLocaleLowerCase();
   return (!loc||(r.location||"").toLocaleLowerCase().includes(loc))&&(!person||text.includes(person))&&(folder==="all"||r.category===folder)&&(year==="all"||String(recordYear(r)||"undated")===year);
  });
  count.textContent=filtered.length+" of "+records.length+" records · "+new Set(filtered.map(recordYear).filter(Boolean)).size+" years represented";
  timeline.replaceChildren();
  if(!filtered.length){timeline.append(node("p",records.length?"No records match these filters.":"No records have been added yet.","empty-state"));return;}
  const groups=new Map();
  filtered.forEach(r=>{const y=recordYear(r);const key=y===null?"Undated":String(y);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
  const keys=[...groups.keys()].sort((a,b)=>a==="Undated"?1:b==="Undated"?-1:Number(a)-Number(b));
  keys.forEach(key=>{
   const column=node("section","","chrono-year-column");
   column.dataset.year=key;
   groups.get(key).sort((a,b)=>{const da=parseRecordDate(a),db=parseRecordDate(b);if(da&&db)return da-db;if(da)return -1;if(db)return 1;return (a.title||"").localeCompare(b.title||"");}).forEach(r=>{
    const event=node("div","","chrono-event");
    const dateLabel=formatRecordDate(r)||"Date not recorded";
    const dateLocation=node("div","","chrono-event-meta");
    dateLocation.append(node("span",dateLabel,"chrono-record-date"));
    if(r.location)dateLocation.append(node("span",r.location,"chrono-event-location"));
    event.append(dateLocation);
    event.append(node("p",eventDescription(r),"chrono-event-description"));
    const card=node("article","","record-card record-card-expanded chrono-record-card");card.dataset.recordId=r.id||"";
    const details=node("div","","chrono-record-details");
    const customThumb=chronoThumbPath(r);
    const imageFile=!!customThumb||!!r.file_path&&((r.mime_type||"").startsWith("image/")||/\\.(?:jpe?g|png|webp|gif|tiff?)$/i.test(r.file_name||r.file_path||""));
    if(imageFile){
     const thumb=node("div","","record-thumbnail chrono-source-preview");
     const img=document.createElement("img");img.src=publicUrl(customThumb||r.file_path);img.alt="Chronological card thumbnail for "+(r.title||"record");img.loading="lazy";thumb.append(img);card.append(thumb);
    }else card.classList.add("chrono-no-thumbnail");
    const info=node("div","","chrono-card-info");
    const family=familyValues(r);
    const hasFamily=Object.values(family).some(Boolean);
    if(hasFamily){
     const familyPanel=node("section","","chrono-family-panel");
     familyPanel.append(node("h4","Parents","chrono-panel-title"));
     const parents=node("div","","chrono-family-grid");
     appendInfoBox(parents,"Father",family.father);
     appendInfoBox(parents,"Mother",family.mother);
     if(parents.childElementCount)familyPanel.append(parents);
     details.append(familyPanel);
    }
    if(r.category==="photos"){
     const people=displayPeople(r.persons_mentioned);
     if(people){const peopleBox=node("div","","chrono-info-box chrono-photo-people");peopleBox.append(node("span","People","chrono-info-label"),node("p",people,"chrono-info-value"));details.append(peopleBox);}
    }
    const excerpt=cleanChronoDescription(r.description||"").split(/\\r?\\n/).filter(line=>!/^\\s*(?:Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother)|Date on record|Parish|Research confidence):/i.test(line)).join("\\n").trim();
    if(excerpt)appendInfoBox(details,"Record notes",excerpt.length>420?excerpt.slice(0,417)+"…":excerpt,"chrono-notes-box");
    info.append(details);card.append(info);
    if(ownerUser){
     const controls=node("div","","chrono-thumbnail-controls");
     const edit=node("button","Edit thumbnail","small-button chrono-thumbnail-edit");edit.type="button";
     const picker=document.createElement("input");picker.type="file";picker.accept="image/*";picker.hidden=true;picker.setAttribute("aria-label","Choose a custom ChronoSearch thumbnail");
     edit.addEventListener("click",e=>{e.stopPropagation();picker.click();});
     picker.addEventListener("click",e=>e.stopPropagation());
     picker.addEventListener("change",async e=>{
      e.stopPropagation();const file=picker.files?.[0];if(!file)return;
      if(!file.type.startsWith("image/")){alert("Choose an image file.");picker.value="";return;}
      edit.disabled=true;edit.textContent="Saving…";
      const path=ownerUser.id+"/chrono-thumbnails/"+String(r.id||crypto.randomUUID())+"-"+Date.now()+"."+((file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg");
      try{
       const uploaded=await client.storage.from("family-archive").upload(path,file,{contentType:file.type,upsert:true});if(uploaded.error)throw uploaded.error;
       const description=withChronoThumb(r,path);
       const saved=await client.from("archive_records").update({description}).eq("id",r.id);if(saved.error){await client.storage.from("family-archive").remove([path]);throw saved.error;}
       const oldPath=customThumb;r.description=description;if(oldPath&&oldPath!==path)await client.storage.from("family-archive").remove([oldPath]);render(records);
      }catch(error){alert("Could not update this thumbnail: "+(error.message||"Unknown error."));}
      finally{edit.disabled=false;edit.textContent="Edit thumbnail";picker.value="";}
     });
     controls.append(edit,picker);
     if(customThumb){const reset=node("button","Use record scan","small-button chrono-thumbnail-reset");reset.type="button";reset.addEventListener("click",async e=>{e.stopPropagation();if(!confirm("Restore the original record scan as this card’s thumbnail?"))return;reset.disabled=true;try{const saved=await client.from("archive_records").update({description:withoutChronoThumb(r)}).eq("id",r.id);if(saved.error)throw saved.error;r.description=withoutChronoThumb(r);await client.storage.from("family-archive").remove([customThumb]);render(records);}catch(error){alert("Could not restore the original thumbnail: "+(error.message||"Unknown error."));reset.disabled=false;}});controls.append(reset);}
     controls.addEventListener("click",e=>e.stopPropagation());card.append(controls);
    }
    card.tabIndex=0;card.setAttribute("role","button");card.setAttribute("aria-label","Open record "+(r.title||""));const openArchiveDetail=()=>{window.location.href="archive.html?record="+encodeURIComponent(r.id)+"#record-detail-modal";};card.addEventListener("click",openArchiveDetail);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openArchiveDetail();}});event.append(card);column.append(event);
   });
   timeline.append(column);
  });
 }
 let ownerUser=null;
 async function start(){
  if(!config.url||!config.anonKey||!window.supabase){count.textContent="The archive connection is not configured.";timeline.replaceChildren(node("p","Could not connect to the family archive.","empty-state"));return;}
  client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));
  const sessionResult=await client.auth.getSession();ownerUser=sessionResult.data?.session?.user||null;
  client.auth.onAuthStateChange((_event,session)=>{ownerUser=session?.user||null;render(records);});
  const {data,error}=await client.from("archive_records").select("id,title,category,description,location,persons_mentioned,record_date,file_name,file_path,mime_type,created_at").order("created_at",{ascending:true});
  if(error){count.textContent="Could not load records: "+error.message;timeline.replaceChildren(node("p","The chronological timeline could not be loaded.","empty-state"));return;}
  // Deduplicate rows by record id so duplicate database results cannot create duplicate cards or thumbnails.
  const seenIds=new Set();
  const records=(data||[]).filter(record=>{
   if(!record?.id)return true;
   if(seenIds.has(record.id))return false;
   seenIds.add(record.id);
   return true;
  });
  [...new Set(records.map(recordYear).filter(Boolean))].sort((a,b)=>a-b).forEach(y=>yearInput.append(new Option(String(y),String(y))));
  if(records.some(r=>recordYear(r)===null))yearInput.append(new Option("Undated","undated"));
  [locationInput,personInput,folderInput,yearInput].forEach(el=>el.addEventListener(el.tagName==="INPUT"?"input":"change",()=>render(records)));
  $("chrono-reset").addEventListener("click",()=>{locationInput.value="";personInput.value="";folderInput.value="all";yearInput.value="all";render(records);});
  render(records);
 }
 start();
})();