(() => {
 const config=window.TYLKA_SUPABASE_CONFIG||{};
 const names={births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
 const $=id=>document.getElementById(id);let client=null;const publicUrl=path=>client.storage.from("family-archive").getPublicUrl(path).data.publicUrl;
 const timeline=$("chrono-timeline"),count=$("chrono-count"),locationInput=$("chrono-location"),personInput=$("chrono-person"),folderInput=$("chrono-folder"),yearInput=$("chrono-year");
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const dateText=record=>{const description=record.description||"";const labeled=description.match(/date\s+on\s+(?:the\s+)?record\s*:\s*([^\n\r]+)/i);return String(labeled?.[1]||record.record_date||"").trim();};
 function parseRecordDate(record){
  const raw=dateText(record);if(!raw)return null;
  // ISO dates are unambiguous; text dates use the browser's locale parser.
  let match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(match){const d=new Date(+match[1],+match[2]-1,+match[3]);return d.getFullYear()===+match[1]&&d.getMonth()===+match[2]-1&&d.getDate()===+match[3]?d:null;}
  match=raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if(match){const a=+match[1],b=+match[2],y=+match[3],month=a>12?b:a,day=a>12?a:b;if(month<1||month>12||day<1||day>31)return null;const d=new Date(y,month-1,day);return d.getFullYear()===y&&d.getMonth()===month-1&&d.getDate()===day?d:null;}
  const parsed=new Date(raw);return Number.isNaN(parsed.getTime())?null:parsed;
 }
 const findYear=value=>{const match=String(value||"").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);return match?Number(match[1]):null;};
 function recordYear(record){return parseRecordDate(record)?.getFullYear()||findYear(dateText(record))||findYear(record.title)||findYear(record.description);}
 function formatRecordDate(record){const raw=dateText(record),date=parseRecordDate(record);return date?new Intl.DateTimeFormat("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()))):raw;}

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
   const header=node("header","","chrono-year-heading");header.append(node("h2",key),node("span",groups.get(key).length+" record"+(groups.get(key).length===1?"":"s")));column.append(header);
   groups.get(key).sort((a,b)=>{const da=parseRecordDate(a),db=parseRecordDate(b);if(da&&db)return da-db;if(da)return -1;if(db)return 1;return (a.title||"").localeCompare(b.title||"");}).forEach(r=>{
    const dateLabel=formatRecordDate(r);
    if(dateLabel)column.append(node("div",dateLabel,"chrono-record-date"));
    const card=node("article","","record-card record-card-expanded chrono-record-card");card.dataset.recordId=r.id||"";
    const details=node("div","","chrono-record-details");
    const thumb=node("div","","record-thumbnail");
    if(r.file_path&&(r.mime_type||"").startsWith("image/")){const img=document.createElement("img");img.src=publicUrl(r.file_path);img.alt="Thumbnail of "+r.title;img.loading="lazy";thumb.append(img);}
    else thumb.append(node("span",r.file_path?(r.mime_type==="application/pdf"?"PDF":"FILE"):"No scan","record-thumbnail-placeholder"));
    card.append(thumb);
    details.append(node("span",names[r.category]||r.category||"Uncategorized","record-category"));
    details.append(node("h3",r.title||"Untitled record"));
    if(r.location)details.append(node("p","Location: "+r.location,"chrono-record-location"));
    if(r.description){const excerpt=r.description.replace(/date\s+on\s+(?:the\s+)?record\s*:\s*[^\n\r]+/i,"").trim();if(excerpt)details.append(node("p",excerpt.length>180?excerpt.slice(0,177)+"…":excerpt,"chrono-record-notes"));}
    card.append(details);
    card.tabIndex=0;card.setAttribute("role","button");card.setAttribute("aria-label","Open record "+(r.title||""));const openArchiveDetail=()=>{window.location.href="archive.html?record="+encodeURIComponent(r.id);};card.addEventListener("click",openArchiveDetail);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openArchiveDetail();}});column.append(card);
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