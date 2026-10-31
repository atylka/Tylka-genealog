(() => {
 const config=window.TYLKA_SUPABASE_CONFIG||{};
 const names={births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
 const $=id=>document.getElementById(id);
 const timeline=$("chrono-timeline"),count=$("chrono-count"),locationInput=$("chrono-location"),personInput=$("chrono-person"),folderInput=$("chrono-folder"),yearInput=$("chrono-year");
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const findYear=value=>{const match=String(value||"").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);return match?Number(match[1]):null;};
 function recordYear(record){
  const description=record.description||"";
  const labeled=description.match(/date\s+on\s+(?:the\s+)?record\s*:\s*([^\n\r]+)/i);
  return findYear(labeled?.[1])||findYear(record.title)||findYear(description);
 }
 function render(records){
  const loc=locationInput.value.trim().toLocaleLowerCase(),person=personInput.value.trim().toLocaleLowerCase(),folder=folderInput.value,year=yearInput.value;
  const filtered=records.filter(r=>{
   const text=[r.title,r.description,r.file_name].join(" ").toLocaleLowerCase();
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
   groups.get(key).sort((a,b)=>(a.title||"").localeCompare(b.title||"")).forEach(r=>{
    const card=node("article","","chrono-record-card");
    card.append(node("span",names[r.category]||r.category||"Uncategorized","record-category"));
    card.append(node("h3",r.title||"Untitled record"));
    if(r.location)card.append(node("p","⌖ "+r.location,"chrono-record-location"));
    const dateLabel=(r.description||"").match(/date\s+on\s+(?:the\s+)?record\s*:\s*([^\n\r]+)/i);
    if(dateLabel)card.append(node("p","Date: "+dateLabel[1].trim(),"chrono-record-date"));
    if(r.description){const excerpt=r.description.replace(/date\s+on\s+(?:the\s+)?record\s*:\s*[^\n\r]+/i,"").trim();if(excerpt)card.append(node("p",excerpt.length>220?excerpt.slice(0,217)+"…":excerpt,"chrono-record-notes"));}
    if(r.file_name)card.append(node("small",r.file_name,"record-filename"));
    column.append(card);
   });
   timeline.append(column);
  });
 }
 async function start(){
  if(!config.url||!config.anonKey||!window.supabase){count.textContent="The archive connection is not configured.";timeline.replaceChildren(node("p","Could not connect to the family archive.","empty-state"));return;}
  const client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));
  const {data,error}=await client.from("archive_records").select("id,title,category,description,location,file_name,created_at").order("created_at",{ascending:true});
  if(error){count.textContent="Could not load records: "+error.message;timeline.replaceChildren(node("p","The chronological timeline could not be loaded.","empty-state"));return;}
  const records=data||[];
  [...new Set(records.map(recordYear).filter(Boolean))].sort((a,b)=>a-b).forEach(y=>yearInput.append(new Option(String(y),String(y))));
  if(records.some(r=>recordYear(r)===null))yearInput.append(new Option("Undated","undated"));
  [locationInput,personInput,folderInput,yearInput].forEach(el=>el.addEventListener(el.tagName==="INPUT"?"input":"change",()=>render(records)));
  $("chrono-reset").addEventListener("click",()=>{locationInput.value="";personInput.value="";folderInput.value="all";yearInput.value="all";render(records);});
  render(records);
 }
 start();
})();