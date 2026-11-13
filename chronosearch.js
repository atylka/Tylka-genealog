(() => {
 const config=window.TYLKA_SUPABASE_CONFIG||{};
 const names={births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
 const $=id=>document.getElementById(id);let client=null;const publicUrl=path=>client.storage.from("family-archive").getPublicUrl(path).data.publicUrl;
 const chronoPlaceholderImage=()=> "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#d9c6a5"/><rect x="268" y="32" width="264" height="436" fill="#efe3ca" stroke="#8c674b" stroke-width="5"/><rect x="282" y="46" width="236" height="408" fill="none" stroke="#b79a73" stroke-width="2"/><path d="M310 112h180M310 148h180M310 184h180M310 220h180M310 256h180M310 292h180M310 328h180M310 364h180" stroke="#b7a181" stroke-width="4" opacity=".78"/><path d="M310 90h110M310 400h150" stroke="#8f6b52" stroke-width="5" opacity=".7"/><circle cx="472" cy="397" r="23" fill="#8b2730" opacity=".9"/><circle cx="472" cy="397" r="14" fill="none" stroke="#d8ad77" stroke-width="2"/></svg>');
 const isChronoImage=record=>Boolean(record.file_path&&(/^image\/(?!tiff)/i.test(record.mime_type||"")||/\.(?:avif|bmp|gif|jpe?g|png|webp|svg)(?:[?#].*)?$/i.test([record.file_name,record.file_path].filter(Boolean).join(" "))));
 const timeline=$("chrono-timeline"),count=$("chrono-count"),locationInput=$("chrono-location"),personInput=$("chrono-person"),folderInput=$("chrono-folder"),yearInput=$("chrono-year");
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const cleanChronoDescription=value=>{
  return String(value||"").split(/\r?\n/).filter(line=>{
   const s=line.trim();
   if(!s)return false;
   if(/^Chrono thumbnail(?: view)?:/i.test(s))return false;
   if(/^(?:Page name identifications|Face identifications)\s*:/i.test(s))return false;
   if(/^Family\s*-/i.test(s))return false;
   return !/(?:face|name)[\s_-]*(?:identif(?:y|ication|ied|ier)|recognition|detection)[\s_-]*(?:coordinates?|coords?|points?|regions?|boxes?|bounds?)/i.test(s)
    &&!/(?:coordinates?|coords?|bounding[\s_-]*boxes?|normalized[\s_-]*(?:x|y)|face[\s_-]*(?:box|region|landmark)|name[\s_-]*(?:box|region|landmark))/i.test(s)
    &&!/^[\s{}[\](),.:"']*(?:x|y|w|h|left|top|right|bottom)[\s"'=:,.-]*-?\d+(?:\.\d+)?[\s,;)}\]]*$/i.test(s);
  }).join("\n").replace(/date\s+on\s+(?:the\s+)?record\s*:\s*[^\n\r]+/i,"").replace(/\n{3,}/g,"\n\n").trim();
 };
 const chronoCardSummary=record=>{
  const metadata=/^(?:date\s+on\s+(?:the\s+)?record|parish|research confidence|bride|groom|location|persons? mentioned|record type|source(?: title)?|family\s*-?)\s*:/i;
  const lines=cleanChronoDescription(record.description||"").split(/\r?\n/)
   .map(line=>line.trim())
   .filter(line=>line&&!metadata.test(line))
   .map(line=>line.replace(/^(?:notes?|transcription|description|record notes)\s*:\s*/i,"").trim())
   .filter(Boolean);
  let summary=lines.join(" ").replace(/\s+/g," ").trim();
  if(!summary){
   const fallback={births:"Birth and baptism record",deaths:"Death and burial record",marriages:"Marriage record",immigration:"Immigration and naturalization record",photos:"Family photograph",notes:"Family history source or research note"};
   summary=fallback[record.category]||"Family archive record";
  }
  if(summary.length>126){const cut=summary.slice(0,123);const boundary=cut.lastIndexOf(" ");summary=(boundary>82?cut.slice(0,boundary):cut).trimEnd()+"…";}
  return summary;
 };
 const displayPeople=value=>{
  if(Array.isArray(value))return value.map(item=>typeof item==="string"?item:(item?.name||item?.full_name||"")).filter(Boolean).join(", ");
  if(value&&typeof value==="object")return Object.values(value).flat().map(item=>typeof item==="string"?item:(item?.name||item?.full_name||"")).filter(Boolean).join(", ");
  return String(value||"").replace(/^\s*\[|\]\s*$/g,"").replace(/["{}]/g,"").trim();
 };
 const familyValues=record=>{
  const raw=String(record.description||"");
  const read=label=>{const m=raw.match(new RegExp("^Family - "+label+":\\s*([^\\r\\n]+)$","im"));return m?m[1].trim():"";};
  return {mother:read("Mother"),father:read("Father"),maternalGrandfather:read("Mother’s father"),maternalGrandmother:read("Mother’s mother"),paternalGrandfather:read("Father’s father"),paternalGrandmother:read("Father’s mother")};
 };
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
   const yearHeading=node("div","","chrono-year-heading");
   const yearTitle=node("h2",key,"chrono-year-label");
   const recordCount=groups.get(key).length;
   const yearCount=node("span",recordCount+" "+(recordCount===1?"record":"records"),"chrono-year-count");
   yearHeading.append(yearTitle,yearCount);
   yearHeading.setAttribute("aria-label",key+" — "+recordCount+" "+(recordCount===1?"record":"records"));
   column.setAttribute("aria-label","Records from "+key);
   column.append(yearHeading);
   groups.get(key).sort((a,b)=>{const da=parseRecordDate(a),db=parseRecordDate(b);if(da&&db)return da-db;if(da)return -1;if(db)return 1;return (a.title||"").localeCompare(b.title||"");}).forEach(r=>{
    const event=node("div","","chrono-event");
    const heading=node("div","","chrono-record-heading");
    heading.append(node("span",formatRecordDate(r)||"Date not recorded","chrono-record-date"));
    heading.append(node("h3",eventDescription(r),"chrono-record-name"));
    if(r.location)heading.append(node("span",r.location,"chrono-event-location"));
    event.append(heading);
    const card=node("article","","chrono-record-card");card.dataset.recordId=r.id||"";
    const image=document.createElement("img");
    image.className="chrono-record-image";
    image.alt="Scanned family record: "+(r.title||"Untitled record");
    image.loading="lazy";image.decoding="async";
    const placeholder=chronoPlaceholderImage();
    image.src=isChronoImage(r)?publicUrl(r.file_path):placeholder;
    if(!isChronoImage(r))image.classList.add("is-placeholder");
    image.addEventListener("error",()=>{image.src=placeholder;image.classList.add("is-placeholder");},{once:true});
    const summary=chronoCardSummary(r);
    const summaryText=node("p",summary,"chrono-record-summary");
    card.append(image,summaryText);
    card.tabIndex=0;card.setAttribute("role","button");card.setAttribute("aria-label","Open record "+(r.title||"Untitled record")+": "+summary);
    const openArchiveDetail=()=>{window.location.href="archive.html?record="+encodeURIComponent(r.id)+"#record-detail-modal";};
    card.addEventListener("click",openArchiveDetail);
    card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openArchiveDetail();}});
    event.append(card);
    column.append(event);
   });
   timeline.append(column);
  });
 }
 let ownerUser=null,records=[];
 async function start(){
  if(!config.url||!config.anonKey||!window.supabase){count.textContent="The archive connection is not configured.";timeline.replaceChildren(node("p","Could not connect to the family archive.","empty-state"));return;}
  client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));
  const sessionResult=await client.auth.getSession();ownerUser=sessionResult.data?.session?.user||null;
  client.auth.onAuthStateChange((_event,session)=>{ownerUser=session?.user||null;render(records);});
  const {data,error}=await client.from("archive_records").select("id,title,category,description,location,persons_mentioned,record_date,file_name,file_path,mime_type,created_at").order("created_at",{ascending:true});
  if(error){count.textContent="Could not load records: "+error.message;timeline.replaceChildren(node("p","The chronological timeline could not be loaded.","empty-state"));return;}
  // Deduplicate rows by record id so duplicate database results cannot create duplicate cards or thumbnails.
  const seenIds=new Set();
  records=(data||[]).filter(record=>{
   if(!record?.id)return true;
   if(seenIds.has(record.id))return false;
   seenIds.add(record.id);
   return true;
  });
  // ChronoSearch is only for dated records. Keep undated records in the archive and other views,
  // but omit them from this timeline unless a year can be determined from the record metadata.
  records=records.filter(record=>recordYear(record)!==null);
  [...new Set(records.map(recordYear).filter(Boolean))].sort((a,b)=>a-b).forEach(y=>yearInput.append(new Option(String(y),String(y))));
  [locationInput,personInput,folderInput,yearInput].forEach(el=>el.addEventListener(el.tagName==="INPUT"?"input":"change",()=>render(records)));
  $("chrono-reset").addEventListener("click",()=>{locationInput.value="";personInput.value="";folderInput.value="all";yearInput.value="all";render(records);});
  render(records);
 }
 start();
})();