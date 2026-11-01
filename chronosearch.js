(() => {
 const config=window.TYLKA_SUPABASE_CONFIG||{};
 const names={births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
 const $=id=>document.getElementById(id);let client=null;const publicUrl=path=>client.storage.from("family-archive").getPublicUrl(path).data.publicUrl;
 const timeline=$("chrono-timeline"),count=$("chrono-count"),locationInput=$("chrono-location"),personInput=$("chrono-person"),folderInput=$("chrono-folder"),yearInput=$("chrono-year");
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const findYear=value=>{const match=String(value||"").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);return match?Number(match[1]):null;};
 function recordYear(record){
  const description=record.description||"";
  const labeled=description.match(/date\s+on\s+(?:the\s+)?record\s*:\s*([^\n\r]+)/i);
  return findYear(labeled?.[1])||findYear(record.title)||findYear(description);
 }
 function showRecordPopup(r){let modal=document.getElementById("chrono-record-popup");if(!modal){modal=node("section","","site-modal chrono-record-popup");modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.innerHTML=`<div class="modal-card modal-wide"><button type="button" class="modal-close" aria-label="Close">×</button><p class="eyebrow">Record detail</p><h2 class="popup-title"></h2><p class="popup-meta"></p><div class="popup-image"></div><pre class="popup-description"></pre><button type="button" class="small-button popup-download">Download record image</button></div>`;document.body.append(modal);modal.addEventListener("click",e=>{if(e.target===modal||e.target.closest(".modal-close"))modal.hidden=true;});}modal.querySelector(".popup-title").textContent=r.title||"Untitled record";modal.querySelector(".popup-meta").textContent=[names[r.category]||r.category,r.location||"Location not entered"].filter(Boolean).join(" · ");modal.querySelector(".popup-description").textContent=r.description||"No transcription or notes have been added.";const box=modal.querySelector(".popup-image");box.replaceChildren();const download=modal.querySelector(".popup-download");download.hidden=!(r.file_path&&(r.mime_type||"").startsWith("image/"));download.onclick=async()=>{const url=publicUrl(r.file_path);try{const response=await fetch(url);const blob=await response.blob();const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=r.file_name||"record-image";a.click();URL.revokeObjectURL(a.href);}catch{window.open(url,"_self");}};if(r.file_path&&(r.mime_type||"").startsWith("image/")){const img=node("img");img.src=publicUrl(r.file_path);img.alt=r.title||"Record image";img.style.cssText="max-width:100%;max-height:65vh;object-fit:contain";box.append(img);}else if(r.file_path){box.append(node("p","This attachment is not an image preview."));}modal.hidden=false;}
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
    const card=node("article","","chrono-record-card");card.dataset.recordId=r.id||"";
    if(r.file_path){const thumb=node("div","","record-thumbnail");if((r.mime_type||"").startsWith("image/")){const img=document.createElement("img");img.src=publicUrl(r.file_path);img.alt="Thumbnail of "+r.title;img.loading="lazy";thumb.append(img);}else thumb.append(node("span",r.mime_type==="application/pdf"?"PDF":"FILE","record-thumbnail-placeholder"));card.append(thumb);}
    card.append(node("span",names[r.category]||r.category||"Uncategorized","record-category"));
    card.append(node("h3",r.title||"Untitled record"));
    if(r.location)card.append(node("p","⌖ "+r.location,"chrono-record-location"));
    const dateLabel=(r.description||"").match(/date\s+on\s+(?:the\s+)?record\s*:\s*([^\n\r]+)/i);
    if(dateLabel)card.append(node("p","Date: "+dateLabel[1].trim(),"chrono-record-date"));
    if(r.description){const excerpt=r.description.replace(/date\s+on\s+(?:the\s+)?record\s*:\s*[^\n\r]+/i,"").trim();if(excerpt)card.append(node("p",excerpt.length>220?excerpt.slice(0,217)+"…":excerpt,"chrono-record-notes"));}
    if(r.file_name)card.append(node("small",r.file_name,"record-filename"));
    const thumbnails=card.querySelectorAll(".record-thumbnail");thumbnails.forEach((thumb,index)=>{if(index>0)thumb.remove();});
    card.tabIndex=0;card.setAttribute("role","button");card.setAttribute("aria-label","Open record "+(r.title||""));card.addEventListener("click",()=>showRecordPopup(r));card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();showRecordPopup(r);}});column.append(card);
   });
   timeline.append(column);
  });
 }
 async function start(){
  if(!config.url||!config.anonKey||!window.supabase){count.textContent="The archive connection is not configured.";timeline.replaceChildren(node("p","Could not connect to the family archive.","empty-state"));return;}
  client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));
  const {data,error}=await client.from("archive_records").select("id,title,category,description,location,file_name,file_path,mime_type,created_at").order("created_at",{ascending:true});
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