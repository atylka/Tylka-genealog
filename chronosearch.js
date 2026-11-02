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
  return String(value||"").replace(/^\s*\[|\]\s*$/g,"").replace(/["{}]/g,"").trim();
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
    event.append(node("div",dateLabel,"chrono-record-date"));
    const card=node("article","","record-card record-card-expanded chrono-record-card");card.dataset.recordId=r.id||"";
    const details=node("div","","chrono-record-details");
    const thumb=node("div","","record-thumbnail chrono-source-preview");
    const imageFile=(r.mime_type||"").startsWith("image/")||/\\.(?:jpe?g|png|webp|tiff?)$/i.test(r.file_name||r.file_path||"");
    if(r.file_path&&imageFile){const img=document.createElement("img");img.src=publicUrl(r.file_path);img.alt="Source scan preview for "+(r.title||"record");img.loading="lazy";thumb.append(img);}
    else thumb.append(node("span",r.file_path?(r.mime_type==="application/pdf"?"PDF":"FILE"):"No scan","record-thumbnail-placeholder"));
    card.append(thumb);
    details.append(node("span",names[r.category]||r.category||"Uncategorized","record-category"));
    details.append(node("h3",r.title||"Untitled record"));
    if(r.location)details.append(node("p","Place: "+r.location,"chrono-record-location"));
    const people=displayPeople(r.persons_mentioned);
    if(people)details.append(node("p","People: "+people,"chrono-record-people"));
    const excerpt=cleanChronoDescription(r.description||"");
    if(excerpt)details.append(node("p",excerpt.length>420?excerpt.slice(0,417)+"…":excerpt,"chrono-record-notes"));
    const sourceLabel=r.file_name||(r.mime_type==="application/pdf"?"PDF document":r.mime_type?.startsWith("image/")?"Image scan":r.file_path?"Attached source":"No digital source attached");
    if(sourceLabel)details.append(node("span",sourceLabel,"chrono-record-source"));
    card.append(details);
    card.tabIndex=0;card.setAttribute("role","button");card.setAttribute("aria-label","Open record "+(r.title||""));const openArchiveDetail=()=>{window.location.href="archive.html?record="+encodeURIComponent(r.id)+"#record-detail-modal";};card.addEventListener("click",openArchiveDetail);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openArchiveDetail();}});event.append(card);column.append(event);
   });
   timeline.append(column);
  });
 }
 async function start(){
  if(!config.url||!config.anonKey||!window.supabase){count.textContent="The archive connection is not configured.";timeline.replaceChildren(node("p","Could not connect to the family archive.","empty-state"));return;}
  client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));
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