(() => {
  const config = window.TYLKA_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey && !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_");
  const $ = id => document.getElementById(id);
  const recordsList = $("records-list"), recordSearch = $("record-search");
  const categoryNames = {births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
  let client = null, currentUser = null, records = [], activeFolder = "all", catalogFieldsAvailable = true;
  const canonical = value => { const key=String(value||"").toLowerCase().trim().replace(/[ &-]+/g,"_"); const aliases={research_notes:"notes",sources:"notes",source_notes:"notes",family_photos:"photos",photographs:"photos",birth:"births",baptism:"births",burials:"deaths",death:"deaths",marriage:"marriages",naturalization:"immigration"}; return aliases[key]||key; };
  const setMessage = (node,text,error=false) => { if(node){node.textContent=text;node.classList.toggle("message-error",error);} };
  const publicFileUrl = path => path ? client.storage.from("family-archive").getPublicUrl(path).data.publicUrl : null;
  const filePrefixes={births:"log_bapt",deaths:"log_death",marriages:"log_marriage",immigration:"log_immig",photos:"log_photo",notes:"log_note"};
  function nextSiteFileName(category,keep){const prefix=filePrefixes[canonical(category)]||"log_record";if(keep&&/^log_[a-z]+_\d+\.[a-z0-9]+$/i.test(keep))return keep;let max=0;records.forEach(r=>{const m=String(r.file_name||"").match(new RegExp("^"+prefix+"_(\\d+)(?:\\.[a-z0-9]+)?$","i"));if(m)max=Math.max(max,Number(m[1]));});return prefix+"_"+(max+1);}
  const isImage = record => (String(record?.mime_type||"").toLowerCase().startsWith("image/")||/\.(?:jpe?g|png|webp|tiff?|gif|bmp|avif)$/i.test(String(record?.file_name||record?.file_path||"")));
  function makeThumbnail(record) { const wrap=document.createElement("div");wrap.className="record-thumbnail";if(record.file_path&&isImage(record)){const img=document.createElement("img");img.src=publicFileUrl(record.file_path);img.alt="Thumbnail of "+record.title;img.loading="lazy";wrap.append(img);window.TylkaThumbnailTools?.attachRecord(img,record,records,wrap);}else{const label=document.createElement("span");label.className="record-thumbnail-placeholder";label.textContent=record.file_path?(record.mime_type==="application/pdf"?"PDF":"FILE"):"No scan";wrap.append(label);}return wrap; }

  const showModal = id => { const node=$(id); if(node) node.hidden=false; };
  function recordUrlKey(record){
    const base=String(record?.file_name||record?.title||"record").replace(/\.[a-z0-9]{1,8}$/i,"");
    const slug=base.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"record";
    return slug+"--"+encodeURIComponent(String(record.id));
  }
  function updateRecordUrl(record){
    const url=new URL(window.location.href);
    if(record)url.searchParams.set("record",recordUrlKey(record));
    else url.searchParams.delete("record");
    window.history.replaceState({recordId:record?String(record.id):null},"",url.pathname+url.search+url.hash);
  }
  const closeModals = () => {
    const wasRecordOpen=!$("record-detail-modal")?.hidden;
    document.querySelectorAll(".site-modal").forEach(node=>node.hidden=true);
    if(wasRecordOpen)updateRecordUrl(null);
  };
  document.querySelectorAll("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModals));
  document.querySelectorAll(".site-modal").forEach(modal=>modal.addEventListener("click",e=>{if(e.target===modal)closeModals();}));
  const addRecordButton=$("open-add-record");
  if(addRecordButton)addRecordButton.addEventListener("click",()=>{if(!currentUser){document.dispatchEvent(new CustomEvent("tylka:open-owner-sign-in"));return;}editingRecordId=null;uploadForm?.reset();$("record-person-rows")?.replaceChildren();$("record-witness-rows")?.replaceChildren();$("record-source-entries")?.replaceChildren();$("add-record-title").textContent="Add a record";const saveButton=uploadForm?.querySelector("button[type=submit]");if(saveButton)saveButton.textContent="Save record";updateMarriageFields();setMessage($("upload-message"),"");showModal("add-record-modal");});
  function renderRecords() {
    recordsList.classList.toggle("all-records-view",activeFolder==="all");
    recordsList.replaceChildren();
    const term=(recordSearch?.value||"").trim().toLowerCase();
    const filtered=records.filter(r=>(activeFolder==="all"||canonical(r.category)===activeFolder)&&[r.title,r.description,r.file_name,r.location,r.persons_mentioned,r.accession_number,r.collection_name,r.record_type,r.source_reference].join(" ").toLowerCase().includes(term));
    if(!filtered.length){const p=document.createElement("p");p.className="empty-state";p.textContent=records.length?"No records match this search.":"No records have been added yet.";recordsList.append(p);return;}
    const wrap=document.createElement("div");wrap.className="geneteka-results-wrap";
    const table=document.createElement("table");table.className="geneteka-results-table";
    const thead=document.createElement("thead"),trh=document.createElement("tr");
    ["Date","Record / name","People mentioned","Location","Scan",...(currentUser?["Actions"]:[])].forEach(label=>{const th=document.createElement("th");th.scope="col";th.textContent=label;trh.append(th);});
    thead.append(trh);table.append(thead);const tbody=document.createElement("tbody");
    filtered.forEach(record=>{
      const tr=document.createElement("tr");tr.className="geneteka-record-row";tr.tabIndex=0;tr.setAttribute("role","button");tr.setAttribute("aria-label","Open record: "+(record.title||"Untitled record"));
      const open=()=>openRecordDetail(record);tr.addEventListener("click",e=>{if(e.target.closest("button,a"))return;open();});tr.addEventListener("keydown",e=>{if(e.target!==tr)return;if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
      const date=document.createElement("td");date.className="archive-result-date";date.textContent=record.record_date||record.registration_date||"—";tr.append(date);
      const title=document.createElement("td");title.className="archive-result-title";const name=document.createElement("strong");name.textContent=record.title||"Untitled record";title.append(name);const cat=document.createElement("small");cat.textContent=categoryNames[canonical(record.category)]||record.category||"";title.append(cat);if(record.accession_number){const accession=document.createElement("small");accession.textContent=record.accession_number;title.append(accession);}tr.append(title);
      const people=document.createElement("td");let personText=record.persons_mentioned||"";if(Array.isArray(personText))personText=personText.join(", ");if(typeof personText==="object"&&personText!==null)personText=JSON.stringify(personText);personText=String(personText).replace(/\s+/g," ").trim();if(!personText)personText=readFamilyRelationships(record).map(x=>x[1]).join(", ");people.textContent=personText||"—";tr.append(people);
      const place=document.createElement("td");place.textContent=record.location||"—";tr.append(place);
      const scan=document.createElement("td");scan.className="archive-result-scan";if(record.file_path&&isImage(record)){scan.append(makeThumbnail(record));}else if(record.file_path){const label=document.createElement("span");label.className="archive-scan-label";label.textContent=(record.mime_type==="application/pdf"?"PDF":"File");scan.append(label);}else scan.textContent="—";tr.append(scan);
      if(currentUser){const actions=document.createElement("td");actions.className="archive-result-actions";const edit=document.createElement("button");edit.type="button";edit.className="small-button";edit.textContent="Edit";edit.addEventListener("click",e=>{e.stopPropagation();beginEditRecord(record);});const del=document.createElement("button");del.type="button";del.className="small-button danger-button";del.textContent="Delete";del.addEventListener("click",async e=>{e.stopPropagation();if(!confirm("Delete this record and its uploaded file?"))return;const {error}=await client.from("archive_records").delete().eq("id",record.id);if(error)return alert(error.message);if(record.file_path)await client.storage.from("family-archive").remove([record.file_path]);await loadRecords();});actions.append(edit,del);tr.append(actions);}
      tbody.append(tr);
    });
    table.append(tbody);wrap.append(table);recordsList.append(wrap);
  }
  function showAttachment(url,record,mimeType){openRecordDetail(record);}

  const confidenceLabels={confirmed:"Confirmed",probable:"Probable",uncertain:"Uncertain",unverified:"Unverified",unassessed:"Not assessed"};
  const readConfidence=description=>{const m=String(description||"").match(/^Research confidence:\s*(confirmed|probable|uncertain|unverified|unassessed)\s*$/im);return m?m[1]:"unassessed";};
  const confidenceLabel=value=>confidenceLabels[value]||confidenceLabels.unassessed;
  let viewerScale=1,viewerX=0,viewerY=0,viewerDragging=false,viewerStart=null;
  function applyViewerTransform(){const image=$("detail-image");if(!image)return;const transform="translate("+viewerX+"px,"+viewerY+"px) scale("+viewerScale+")";image.style.transform=transform;const overlay=$("page-name-overlay");if(overlay)overlay.style.transform=transform;$("image-zoom-level").textContent=Math.round(viewerScale*100)+"%";}
  function zoomViewer(factor,originX,originY){const viewport=$("detail-image-viewport");const old=viewerScale;const next=Math.max(.5,Math.min(6,old*factor));if(originX!==undefined){const rect=viewport.getBoundingClientRect(),cx=originX-rect.left-rect.width/2,cy=originY-rect.top-rect.height/2,ratio=next/old;viewerX=cx-(cx-viewerX)*ratio;viewerY=cy-(cy-viewerY)*ratio;}viewerScale=next;applyViewerTransform();}
  function resetViewer(){viewerScale=1;viewerX=0;viewerY=0;applyViewerTransform();}
  function setupViewer(){const viewport=$("detail-image-viewport");if(!viewport||viewport.dataset.ready)return;viewport.dataset.ready="1";viewport.addEventListener("wheel",e=>{if(!$("record-detail-modal")||$("record-detail-modal").hidden)return;e.preventDefault();zoomViewer(e.deltaY<0?1.15:1/1.15,e.clientX,e.clientY);},{passive:false});viewport.addEventListener("pointerdown",e=>{if(viewerScale<=1)return;viewerDragging=true;viewerStart={x:e.clientX-viewerX,y:e.clientY-viewerY};viewport.setPointerCapture(e.pointerId);});viewport.addEventListener("pointermove",e=>{if(!viewerDragging)return;viewerX=e.clientX-viewerStart.x;viewerY=e.clientY-viewerStart.y;applyViewerTransform();});const stop=()=>{viewerDragging=false;};viewport.addEventListener("pointerup",stop);viewport.addEventListener("pointercancel",stop);$("image-zoom-in").addEventListener("click",()=>zoomViewer(1.25));$("image-zoom-out").addEventListener("click",()=>zoomViewer(1/1.25));$("image-zoom-reset").addEventListener("click",resetViewer);}
  function readFamilyRelationships(record){
    const labels={"Bride":"Bride","Groom":"Groom","Bride’s father":"Bride’s father","Bride’s mother":"Bride’s mother","Groom’s father":"Groom’s father","Groom’s mother":"Groom’s mother","Mother":"Mother","Father":"Father","Mother’s father":"Mother’s father","Mother’s mother":"Mother’s mother","Father’s father":"Father’s father","Father’s mother":"Father’s mother"};
    const values=[];
    Object.entries(labels).forEach(([stored,label])=>{
      const pattern=stored==="Bride"||stored==="Groom"?"^"+stored+":\\s*([^\\r\\n]+)$":"^Family - "+stored+":\\s*([^\\r\\n]+)$";
      const match=String(record.description||"").match(new RegExp(pattern,"im"));
      if(match&&match[1].trim())values.push([label,match[1].trim()]);
    });
    return values;
  }
  function readTranscriptionNotes(record){
    return String(record?.description||"").split(/\r?\n/).filter(line=>! /^\s*(?:Date on record|Document language|Transcription status|Translation status|Registration date|Record number|Age at event|Alternate spellings|Record participant|Person relationship|Cause of death|Parish|House number|Page number|Page entry|Source|Research confidence|Bride|Groom|Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother|Bride’s father|Bride’s mother|Groom’s father|Groom’s mother)|Page name identifications|Face identifications):/i.test(line)).join("\n").trim();
  }
  let activePageNameHighlight=null,activeFaceHighlight=null;
  function readFaceIdentifications(record){const m=String(record?.description||"").match(/^Face identifications:\s*(\[.*\])\s*$/im);if(!m)return[];try{const a=JSON.parse(m[1]);return Array.isArray(a)?a.filter(x=>x&&typeof x.name==="string"&&x.rect):[];}catch(_){return[];}}
  function writeRecordMetadata(record,label,value){const raw=String(record?.description||""),line=label+": "+JSON.stringify(value),pattern=new RegExp("^"+label+":\\s*[^\\r\\n]*","im");return pattern.test(raw)?raw.replace(pattern,line):(raw.trim()?raw.trim()+String.fromCharCode(10,10):"")+line;}
  function highlightPageName(index){activePageNameHighlight=Number.isInteger(index)?index:null;activeFaceHighlight=null;drawPageNameOverlay(window.tylkaActiveDetailRecord);}
  function highlightFace(index){activeFaceHighlight=Number.isInteger(index)?index:null;activePageNameHighlight=null;drawPageNameOverlay(window.tylkaActiveDetailRecord);}
  function renderPageNameList(record){
    const section=$("detail-family-information"),list=$("page-name-list"),familyList=$("detail-family-list"),otherNames=$("other-page-names");
    if(!section||!list||!familyList)return;
    familyList.replaceChildren();list.replaceChildren();activePageNameHighlight=null;activeFaceHighlight=null;
    const family=readFamilyRelationships(record),pageNames=readPageNames(record),matchedPageNameIndexes=new Set();
    const category=canonical(record.category),isMarriage=category==="marriages",isBirth=category==="births";
    if(isBirth&&String(record.title||"").trim()){
      const subjectName=String(record.title).trim(),matchIndex=pageNames.findIndex(entry=>entry.name.trim().toLocaleLowerCase()===subjectName.toLocaleLowerCase());
      if(matchIndex>=0)matchedPageNameIndexes.add(matchIndex);
      const wrapper=document.createElement("section"),heading=document.createElement("h4"),grid=document.createElement("div"),card=document.createElement("div"),label=document.createElement("span"),value=document.createElement("strong"),actions=document.createElement("div");
      wrapper.className="identified-family-group identified-birth-subject";heading.textContent="Person born / baptized";grid.className="identified-family-grid";card.className="identified-family-card";label.textContent="Baptized / born person";value.textContent=subjectName;actions.className="identified-name-actions";card.append(label,value);card.tabIndex=0;card.setAttribute("role","group");card.setAttribute("aria-label","Person born / baptized: "+subjectName);
      card.addEventListener("mouseenter",()=>highlightPageName(matchIndex));card.addEventListener("mouseleave",()=>highlightPageName(null));card.addEventListener("focus",()=>highlightPageName(matchIndex));card.addEventListener("blur",()=>highlightPageName(null));
      if(currentUser){const box=document.createElement("button");box.type="button";box.className="small-button";box.textContent=matchIndex>=0?"Rebox":"Box name";box.addEventListener("click",()=>matchIndex>=0?editPageName(matchIndex):openPageNameTool(subjectName));actions.append(box);if(matchIndex>=0){const remove=document.createElement("button");remove.type="button";remove.className="small-button danger-button";remove.textContent="Remove box";remove.addEventListener("click",()=>removePageName(matchIndex));actions.append(remove);}}
      card.append(actions);grid.append(card);wrapper.append(heading,grid);familyList.append(wrapper);
    }
    const groups=isMarriage?[{title:"Bride & groom",roles:["Bride","Groom"]},{title:"Bride’s parents",roles:["Bride’s father","Bride’s mother"]},{title:"Groom’s parents",roles:["Groom’s father","Groom’s mother"]}]:[{title:"Parents",roles:["Mother","Father"]},{title:"Grandparents",roles:["Mother’s father","Mother’s mother","Father’s father","Father’s mother"]}];
    groups.forEach(group=>{
      const entries=family.filter(([role])=>group.roles.includes(role));
      if(!entries.length)return;
      const wrapper=document.createElement("section"),heading=document.createElement("h4"),grid=document.createElement("div");
      wrapper.className="identified-family-group";heading.textContent=group.title;grid.className="identified-family-grid";wrapper.append(heading,grid);
      entries.forEach(([role,name])=>{
        const card=document.createElement("div"),label=document.createElement("span"),value=document.createElement("strong"),actions=document.createElement("div");
        const matchIndex=pageNames.findIndex(entry=>entry.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase());if(matchIndex>=0)matchedPageNameIndexes.add(matchIndex);
        card.className="identified-family-card";label.textContent=role;value.textContent=name;actions.className="identified-name-actions";
        card.append(label,value);
        card.tabIndex=0;card.setAttribute("role","group");card.setAttribute("aria-label",role+": "+name);
        card.addEventListener("mouseenter",()=>highlightPageName(matchIndex));
        card.addEventListener("mouseleave",()=>highlightPageName(null));
        card.addEventListener("focus",()=>highlightPageName(matchIndex));
        card.addEventListener("blur",()=>highlightPageName(null));
        if(currentUser){
          const box=document.createElement("button");box.type="button";box.className="small-button";box.textContent=matchIndex>=0?"Rebox":"Box name";
          box.addEventListener("click",()=>matchIndex>=0?editPageName(matchIndex):openPageNameTool(name));
          actions.append(box);
          if(matchIndex>=0){const remove=document.createElement("button");remove.type="button";remove.className="small-button danger-button";remove.textContent="Remove box";remove.addEventListener("click",()=>removePageName(matchIndex));actions.append(remove);}
        }
        card.append(actions);grid.append(card);
      });
      familyList.append(wrapper);
    });
    const other=pageNames.map((entry,index)=>({entry,index})).filter(({index})=>!matchedPageNameIndexes.has(index));
    other.forEach(({entry,index})=>{
      const li=document.createElement("li"),label=document.createElement("span"),actions=document.createElement("div");
      li.className="identified-name-row";label.textContent=entry.name;actions.className="identified-name-actions";
      li.addEventListener("mouseenter",()=>highlightPageName(index));li.addEventListener("mouseleave",()=>highlightPageName(null));
      if(currentUser){
        const edit=document.createElement("button");edit.type="button";edit.className="small-button";edit.textContent="Rebox";edit.addEventListener("click",()=>editPageName(index));
        const remove=document.createElement("button");remove.type="button";remove.className="small-button danger-button";remove.textContent="Remove box";remove.addEventListener("click",()=>removePageName(index));
        actions.append(edit,remove);
      }
      li.append(label,actions);list.append(li);
    });
    if(otherNames)otherNames.hidden=!other.length;
    section.hidden=!family.length&&!pageNames.length&&!(isBirth&&String(record.title||"").trim());
    renderFaceIdentificationList(record);
    drawPageNameOverlay(record);
  }
  function renderFaceIdentificationList(record){const section=$("detail-face-identifications"),list=$("face-identification-list");if(!section||!list)return;list.replaceChildren();const faces=readFaceIdentifications(record);faces.forEach((entry,index)=>{const item=document.createElement("li"),name=document.createElement("span"),actions=document.createElement("div");item.className="identified-name-row";name.textContent=entry.name;actions.className="identified-name-actions";item.addEventListener("mouseenter",()=>highlightFace(index));item.addEventListener("mouseleave",()=>highlightFace(null));item.addEventListener("focus",()=>highlightFace(index));item.addEventListener("blur",()=>highlightFace(null));item.tabIndex=0;item.append(name);if(currentUser){const remove=document.createElement("button");remove.type="button";remove.className="small-button danger-button";remove.textContent="Remove";remove.addEventListener("click",async()=>{const next=readFaceIdentifications(record).filter((_,i)=>i!==index);const description=writeRecordMetadata(record,"Face identifications",next);const {error}=await client.from("archive_records").update({description}).eq("id",record.id);if(error)return alert(error.message);record.description=description;renderFaceIdentificationList(record);drawPageNameOverlay(record);});actions.append(remove);}if(currentUser)item.append(actions);list.append(item);});section.hidden=!faces.length;}
  async function openRecordDetail(record){
    updateRecordUrl(record);
    window.tylkaActiveDetailRecord=record;
    $("detail-edit-record").hidden=!currentUser;
    $("detail-title").textContent=record.title;
    const folderType=categoryNames[canonical(record.category)]||record.category||"Unclassified";
    const folderBadge=$("detail-folder-type");if(folderBadge)folderBadge.textContent=folderType;
    const meta=[];
    if(record.accession_number)meta.push("Accession: "+record.accession_number);
    const detailRaw=String(record.description||""),pageNumberMatch=detailRaw.match(/^Page number:\s*([^\r\n]+)$/im),pageEntryMatch=detailRaw.match(/^Page entry:\s*([^\r\n]+)$/im),sourceLineMatch=detailRaw.match(/^Source:\s*([^\r\n]+)$/im);
    const causeOfDeathMatch=detailRaw.match(/^Cause of death:\s*([^\r\n]+)$/im);if(causeOfDeathMatch)meta.push("Cause of death: "+causeOfDeathMatch[1].trim());
    if(record.collection_name)meta.push("Collection: "+record.collection_name);
    if(record.record_type)meta.push("Record type: "+record.record_type);
    if(record.record_language)meta.push("Language: "+record.record_language);
    if(record.repository)meta.push("Repository: "+record.repository);
    if(record.source_reference)meta.push("Source reference: "+record.source_reference);
    if(record.transcription_status)meta.push("Transcription: "+record.transcription_status.replace(/_/g," "));
    if(record.translation_status)meta.push("Translation: "+record.translation_status.replace(/_/g," "));
    if(record.provenance)meta.push("Provenance: "+record.provenance);
    if(record.preservation_notes)meta.push("Preservation: "+record.preservation_notes);
    const personRelations=[...String(record.description||"").matchAll(/^Person relationship:\s*(.*?)\s*\|\s*(.*?)\s*$/gim)];personRelations.forEach(match=>meta.push(match[1].trim()+" — "+match[2].trim()));const participantRelations=[...String(record.description||"").matchAll(/^Record participant:\s*(.*?)\s*\|\s*(.*?)\s*$/gim)];participantRelations.forEach(match=>meta.push(match[1].trim()+" — "+match[2].trim()));
    const detailMeta=$("detail-meta");detailMeta.textContent=meta.join(" · ");
    $("detail-download-actions")?.querySelectorAll(".detail-image-source-button").forEach(button=>button.remove());
    const keyFacts=$("detail-key-facts");if(keyFacts){keyFacts.replaceChildren();const facts=[["Event date",record.record_date],["Location",record.location],["Page number",pageNumberMatch?.[1]?.trim()],["Page entry",pageEntryMatch?.[1]?.trim()],["Record / act number",detailRaw.match(/^Record number:\s*([^\r\n]+)$/im)?.[1]],["Age at event",detailRaw.match(/^Age at event:\s*([^\r\n]+)$/im)?.[1]],["Parish / registry",detailRaw.match(/^Parish:\s*([^\r\n]+)$/im)?.[1]],["Registration date",detailRaw.match(/^Registration date:\s*([^\r\n]+)$/im)?.[1]],["Alternate spellings",detailRaw.match(/^Alternate spellings:\s*([^\r\n]+)$/im)?.[1]]];facts.push(["Original language",record.record_language||detailRaw.match(/^Document language:\s*([^\r\n]+)$/im)?.[1]]);facts.push(["Transcription status",record.transcription_status||detailRaw.match(/^Transcription status:\s*([^\r\n]+)$/im)?.[1]?.replace(/_/g," ")]);facts.push(["Translation status",record.translation_status||detailRaw.match(/^Translation status:\s*([^\r\n]+)$/im)?.[1]?.replace(/_/g," ")]);facts.splice(0,facts.length,...facts.filter(item=>item[1]));facts.forEach(([label,value])=>{const item=document.createElement("div");item.className="detail-key-fact";const strong=document.createElement("strong");strong.textContent=label;const span=document.createElement("span");span.textContent=value;item.append(strong,span);keyFacts.append(item);});keyFacts.hidden=!facts.length;}
    const transcriptionNotes=readTranscriptionNotes(record);$("detail-description").textContent=transcriptionNotes;$("detail-transcription-panel").hidden=!transcriptionNotes;
    const peopleSection=$("detail-people-mentioned"),peopleList=$("detail-people-list");const identifiedNames=[...readPageNames(record).map(entry=>entry.name),...readFaceIdentifications(record).map(entry=>entry.name)];const personNames=[...new Map([...String(record.persons_mentioned||"").split(/[,;]+/),...identifiedNames].map(name=>String(name||"").trim()).filter(Boolean).map(name=>[name.toLocaleLowerCase(),name])).values()];if(peopleSection&&peopleList){peopleList.replaceChildren();personNames.forEach(name=>{const span=document.createElement("span");span.className="detail-person-chip";span.textContent=name;peopleList.append(span);});peopleSection.hidden=!personNames.length;}const relatedSection=$("detail-related-records"),relatedList=$("detail-related-list");if(relatedSection&&relatedList){relatedList.replaceChildren();const names=personNames.map(name=>name.toLocaleLowerCase());const related=records.filter(other=>other.id!==record.id&&String(other.persons_mentioned||"").split(/[,;]+/).some(n=>names.includes(n.trim().toLowerCase())));related.forEach(other=>{const button=document.createElement("button");button.type="button";button.className="related-record-link";button.textContent=(other.record_date?other.record_date+" · ":"")+(other.title||"Untitled record");button.addEventListener("click",()=>openRecordDetail(other));relatedList.append(button);});relatedSection.hidden=!related.length;}
    const sourceValue=String(record.source_reference||sourceLineMatch?.[1]||"").trim();let legacySourceUrl="";try{const candidate=new URL(sourceValue);if(candidate.protocol==="http:"||candidate.protocol==="https:")legacySourceUrl=candidate.href;}catch(_){}if(sourceValue&&!legacySourceUrl){meta.push("Source: "+sourceValue);detailMeta.textContent=meta.join(" · ");}
    renderPageNameList(record);
    const confidence=readConfidence(record.description);
    $("detail-confidence").textContent="Research confidence: "+confidenceLabel(confidence);
    $("detail-confidence").className="detail-confidence confidence-"+confidence;
    if($("detail-confidence-select"))$("detail-confidence-select").value=confidence;
    if($("confidence-editor"))$("confidence-editor").hidden=!currentUser;
    if($("save-confidence"))$("save-confidence").hidden=!currentUser;
    if($("confidence-save-status"))$("confidence-save-status").textContent="";
    const img=$("detail-image"),fallback=$("detail-file-fallback"),download=$("download-record-image");
    const nameOverlay=$("page-name-overlay");
    if(nameOverlay){nameOverlay.width=0;nameOverlay.height=0;}
    fallback.replaceChildren();img.hidden=true;img.removeAttribute("src");resetViewer();setupViewer();
    let attached=record.source_attachments;
    if(typeof attached==="string"){try{attached=JSON.parse(attached);}catch(_){attached=[];}}
    if(!Array.isArray(attached))attached=[];
    const sourceItems=attached.filter(item=>item&&item.file_path).map(item=>({...item}));
    if(record.file_path&&!sourceItems.some(source=>source.file_path===record.file_path))sourceItems.unshift({file_path:record.file_path,file_name:record.file_name||"Main source",mime_type:record.mime_type||"",role:"main"});
    sourceItems.forEach(item=>{if(!item.role)item.role=item.file_path===record.file_path?"main":"supporting";});
    sourceItems.sort((a,b)=>(a.role==="main"?-1:0)-(b.role==="main"?-1:0));
    const imageItems=sourceItems.filter(item=>isImage(item));
    let activeSource=null,activeSourceIndex=-1;
    const clearImageOverlay=()=>{if(nameOverlay){const context=nameOverlay.getContext("2d");if(context)context.clearRect(0,0,nameOverlay.width,nameOverlay.height);nameOverlay.width=0;nameOverlay.height=0;}};
    const activateSource=(item,index)=>{
      activeSource=item;activeSourceIndex=index;resetViewer();clearImageOverlay();
      const imageCaption=$("detail-image-caption");
      if(!isImage(item)){
        $("detail-download-actions")?.querySelectorAll(".detail-image-source-button").forEach(button=>button.remove());
        img.hidden=true;img.removeAttribute("src");
        if(imageCaption){imageCaption.textContent="";imageCaption.hidden=true;}
        fallback.textContent="This source is a document file. Use its source link in the gallery to open it.";
        if(download)download.hidden=true;
        syncFaceButton();
        gallery.querySelectorAll(".detail-source-image-button").forEach((button,i)=>button.setAttribute("aria-pressed",String(i===index)));
        return;
      }
      fallback.replaceChildren();
      if(imageCaption){
        const role=item.role==="main"?"Main source":"Supporting source";
        imageCaption.textContent=role+" · "+String(item.caption||item.file_name||"Record image");
        imageCaption.hidden=false;
      }
      img.crossOrigin="anonymous";img.onload=()=>{if(index===0){syncFaceButton();drawPageNameOverlay(record);}else{syncFaceButton();clearImageOverlay();}};img.onerror=()=>{setMessage($("face-crop-status"),"This image could not be loaded. Check that the uploaded file is still available.",true);syncFaceButton();};img.src=publicFileUrl(item.file_path);img.alt=(item.file_name||"Record source")+" · "+record.title;img.hidden=false;
      const actionHost=$("detail-download-actions");actionHost?.querySelectorAll(".detail-image-source-button").forEach(button=>button.remove());let imageSourceUrl="";const candidateSource=String(item.source_url||(item.role==="main"?legacySourceUrl:"")||"").trim();try{const parsedSource=new URL(candidateSource);if(parsedSource.protocol==="http:"||parsedSource.protocol==="https:")imageSourceUrl=parsedSource.href;}catch(_){}if(imageSourceUrl&&actionHost){const sourceButton=document.createElement("a");sourceButton.className="small-button detail-image-source-button";sourceButton.href=imageSourceUrl;sourceButton.target="_blank";sourceButton.rel="noopener noreferrer";sourceButton.textContent="Image Source";actionHost.append(sourceButton);}if(download){download.hidden=false;download.onclick=async()=>{const url=publicFileUrl(item.file_path);try{const response=await fetch(url);if(!response.ok)throw new Error("Download unavailable");const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);const link=document.createElement("a");link.href=objectUrl;link.download=item.file_name||"record-image";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);}catch{const link=document.createElement("a");link.href=url;link.download=item.file_name||"record-image";link.click();}};}
      gallery.querySelectorAll(".detail-source-image-button").forEach((button,i)=>button.setAttribute("aria-pressed",String(i===index)));
    };
    let gallery=$("detail-source-attachments");if(!gallery){gallery=document.createElement("div");gallery.id="detail-source-attachments";gallery.className="detail-source-attachments";const source=$("detail-file-fallback");source.parentNode.insertBefore(gallery,source.nextSibling);}gallery.replaceChildren();
    if(sourceItems.length){
      const heading=document.createElement("h4");heading.textContent="Source gallery · "+imageItems.length+" image"+(imageItems.length===1?"":"s")+(sourceItems.length>imageItems.length?" and "+(sourceItems.length-imageItems.length)+" document source"+(sourceItems.length-imageItems.length===1?"":"s"):"");gallery.append(heading);
      const grid=document.createElement("div");grid.className="detail-source-gallery";
      sourceItems.forEach((item,index)=>{
        const itemName=String(item.file_name||"Source "+(index+1)),url=publicFileUrl(item.file_path);
        if(isImage(item)){
          const button=document.createElement("button");button.type="button";button.className="detail-source-image-button";button.setAttribute("aria-label","View source image "+(index+1)+": "+itemName);button.setAttribute("aria-pressed","false");button.addEventListener("click",()=>activateSource(item,index));
          const thumb=document.createElement("img");thumb.className="detail-source-image";thumb.src=url;thumb.alt=itemName;thumb.loading="lazy";thumb.onerror=()=>{thumb.alt=itemName+" could not be previewed";thumb.classList.add("is-unavailable");};
          button.append(thumb);grid.append(button);
        }else{
          const link=document.createElement("a");link.className="detail-source-attachment";link.href=url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=(item.role==="main"?"MAIN SOURCE · ":"SUPPORTING SOURCE · ")+(item.caption||itemName)+(String(item.mime_type||"").toLowerCase()==="application/pdf"?" · PDF":" · Open source");grid.append(link);if(item.role==="supporting"&&item.research_notes){const notes=document.createElement("small");notes.className="source-gallery-research-notes";notes.textContent="Research notes: "+item.research_notes;grid.append(notes);}
        }
      });
      gallery.append(grid);
    }
    const initialImage=imageItems[0];
    if(initialImage){const initialIndex=sourceItems.indexOf(initialImage);activateSource(initialImage,initialIndex);}
    else if(sourceItems.length){fallback.textContent="No image is attached to this record. Open a document source from the gallery above.";if(download)download.hidden=true;}
    else{fallback.textContent="No attachment is saved for this record.";if(download)download.hidden=true;}
    showModal("record-detail-modal");
  }

  $("detail-edit-record")?.addEventListener("click",()=>{const record=window.tylkaActiveDetailRecord;if(record&&currentUser)beginEditRecord(record);});
  if($("save-confidence"))$("save-confidence").addEventListener("click",async()=>{const record=window.tylkaActiveDetailRecord;if(!record||!currentUser)return;const value=$("detail-confidence-select").value;const clean=String(record.description||"").replace(/^Research confidence:\s*(?:confirmed|probable|uncertain|unverified|unassessed)\s*\r?\n?/im,"").replace(/^Person relationship:\s*[^\r\n]*\s*/gim,"").replace(/^Record participant:\s*[^\r\n]*\s*/gim,"");const description="Research confidence: "+value+(clean?"\n\n"+clean:"");const button=$("save-confidence");button.disabled=true;$("confidence-save-status").textContent="Saving…";try{const {error}=await client.from("archive_records").update({description}).eq("id",record.id);if(error)throw error;record.description=description;$("detail-confidence").textContent="Research confidence: "+confidenceLabel(value);$("detail-confidence").className="detail-confidence confidence-"+value;$("confidence-save-status").textContent="Saved ✓";renderRecords();}catch(error){$("confidence-save-status").textContent=error.message||"Could not save assessment.";}finally{button.disabled=false;}});
  async function loadRecords(){
    recordsList.textContent="Loading records…";
    const full="id,title,category,description,location,persons_mentioned,record_date,accession_number,collection_name,record_type,record_language,repository,source_reference,provenance,transcription_status,translation_status,preservation_notes,file_path,file_name,mime_type,created_at,thumbnail_settings,source_attachments";
    const fullNoThumb=full.replace(",thumbnail_settings","");
    const fullCore=fullNoThumb.replace(",source_attachments","");
    const minimal="id,title,category,description,location,persons_mentioned,record_date,file_path,file_name,mime_type,created_at,thumbnail_settings,source_attachments";
    const minimalNoThumb=minimal.replace(",thumbnail_settings","");
    const minimalCore=minimalNoThumb.replace(",source_attachments","");
    const select=fields=>client.from("archive_records").select(fields).order("created_at",{ascending:false});
    let result=await select(full);
    if(result.error&&/thumbnail_settings/i.test(result.error.message||""))result=await select(fullNoThumb);
    if(result.error&&/source_attachments/i.test(result.error.message||""))result=await select(fullCore);
    if(result.error&&/(?:column .* does not exist|schema cache)/i.test(result.error.message||"")){
      catalogFieldsAvailable=false;
      document.querySelectorAll(".archive-catalog-field").forEach(field=>field.hidden=true);
      result=await select(minimal);
      if(result.error&&/thumbnail_settings/i.test(result.error.message||""))result=await select(minimalNoThumb);
      if(result.error&&/source_attachments/i.test(result.error.message||""))result=await select(minimalCore);
    }
    if(result.error){recordsList.textContent="Could not load records. "+result.error.message;return;}
    records=result.data||[];renderRecords();
  }
  async function start(){
    if(!configured||!window.supabase){recordsList.textContent="Archive connection is not configured.";return;}
    client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
    await loadRecords();
    const {data:{session}}=await client.auth.getSession();setOwner(session?.user||null);
    const requestedRecordKey=new URLSearchParams(window.location.search).get("record");
    if(requestedRecordKey){
      const separator=requestedRecordKey.lastIndexOf("--");
      const requestedRecordId=separator>=0?requestedRecordKey.slice(separator+2):requestedRecordKey;
      const requestedRecord=records.find(record=>String(record.id)===requestedRecordId);
      if(requestedRecord)await openRecordDetail(requestedRecord);
      else setMessage(recordsList,"That record could not be found in the public archive.",true);
    }
    client.auth.onAuthStateChange((_event,s)=>{setOwner(s?.user||null);loadRecords();});
    // The Supabase auth listener above already handles sign-in changes.
    // Avoid a second fetch from the shared site-ui auth event.
  }
  function setOwner(user){
    currentUser=user?.id==="7a8cd586-c68f-4078-b61d-a87f3842b07e"?user:null;
    user=currentUser;if($("open-add-record"))$("open-add-record").hidden=!user;if($("owner-tools"))$("owner-tools").hidden=!user;if(document.body.dataset.page==="upload"&&$("private-archive"))$("private-archive").hidden=!user;
    if($("archive-heading"))$("archive-heading").textContent=user?"Your archive":"Browse records";
    if($("archive-status"))$("archive-status").textContent=user?"Owner mode · private attachments unlocked":"Public visitor view";
    if($("confidence-editor"))$("confidence-editor").hidden=!user;
    if(recordsList)renderRecords();
    // Refresh the portrait action after the asynchronous owner session check completes.
    syncFaceButton();
  }
  if($("sign-out"))$("sign-out").addEventListener("click",async()=>{await client.auth.signOut();});
  let editingRecordId=null;
  function beginEditRecord(record){
    if(!currentUser)return;
    editingRecordId=record.id;
    const raw=String(record.description||"");
    const dateMatch=raw.match(/^Date on record:\s*([^\r\n]+)$/im),languageMatch=raw.match(/^Document language:\s*([^\r\n]+)$/im),transcriptionStatusMatch=raw.match(/^Transcription status:\s*([^\r\n]+)$/im),translationStatusMatch=raw.match(/^Translation status:\s*([^\r\n]+)$/im),registrationDateMatch=raw.match(/^Registration date:\s*([^\r\n]+)$/im),recordNumberMatch=raw.match(/^Record number:\s*([^\r\n]+)$/im),ageMatch=raw.match(/^Age at event:\s*([^\r\n]+)$/im),alternateSpellingsMatch=raw.match(/^Alternate spellings:\s*([^\r\n]+)$/im),causeMatch=raw.match(/^Cause of death:\s*([^\r\n]+)$/im),parishMatch=raw.match(/^Parish:\s*([^\r\n]*)$/im),houseMatch=raw.match(/^House number:\s*([^\r\n]*)$/im),pageNumberMatch=raw.match(/^Page number:\s*([^\r\n]*)$/im),pageEntryMatch=raw.match(/^Page entry:\s*([^\r\n]*)$/im),sourceMatch=raw.match(/^Source:\s*([^\r\n]*)$/im);
    const confidence=readConfidence(raw);
    const brideMatch=raw.match(/^Bride:\s*([^\r\n]*)$/im),groomMatch=raw.match(/^Groom:\s*([^\r\n]*)$/im);
    const familyFields={"mother":"Mother","father":"Father","maternal-grandfather":"Mother’s father","maternal-grandmother":"Mother’s mother","paternal-grandfather":"Father’s father","paternal-grandmother":"Father’s mother","bride-father":"Bride’s father","bride-mother":"Bride’s mother","groom-father":"Groom’s father","groom-mother":"Groom’s mother"};
    Object.entries(familyFields).forEach(([id,label])=>{const match=raw.match(new RegExp("^Family - "+label+":\\s*([^\\r\\n]*)$","im"));const field=$("record-"+id);if(field)field.value=match?match[1].trim():"";});
    ["mother","father"].forEach(label=>{const match=raw.match(new RegExp("^Family - "+(label==="mother"?"Mother":"Father")+":\\s*([^\\r\\n]*)$","im"));const field=$("record-us-"+label);if(field)field.value=match?match[1].trim():"";});
    const notes=raw.replace(/^Document language:\s*[^\r\n]*\s*/im,"").replace(/^Transcription status:\s*[^\r\n]*\s*/im,"").replace(/^Translation status:\s*[^\r\n]*\s*/im,"").replace(/^Registration date:\s*[^\r\n]*\s*/im,"").replace(/^Record number:\s*[^\r\n]*\s*/im,"").replace(/^Age at event:\s*[^\r\n]*\s*/im,"").replace(/^Alternate spellings:\s*[^\r\n]*\s*/im,"").replace(/^Record participant:\s*[^\r\n]*\s*/gim,"").replace(/^Cause of death:\s*[^\r\n]*\s*/im,"").replace(/^Parish:\s*[^\r\n]*\s*/im,"").replace(/^House number:\s*[^\r\n]*\s*/im,"").replace(/^Page number:\s*[^\r\n]*\s*/im,"").replace(/^Page entry:\s*[^\r\n]*\s*/im,"").replace(/^Source:\s*[^\r\n]*\s*/im,"").replace(/^Page name identifications:\s*[^\r\n]+\s*/im,"").replace(/^Face identifications:\s*[^\r\n]+\s*/im,"").replace(/^Date on record:\s*[^\r\n]+\s*/im,"").replace(/^Research confidence:\s*(?:confirmed|probable|uncertain|unverified|unassessed)\s*\r?\n?/im,"").replace(/^Bride:\s*[^\r\n]*\s*/im,"").replace(/^Groom:\s*[^\r\n]*\s*/im,"").replace(/^Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother|Bride’s father|Bride’s mother|Groom’s father|Groom’s mother):\s*[^\r\n]*\s*/gim,"").trim();
    $("record-bride").value=brideMatch?brideMatch[1].trim():"";
    $("record-groom").value=groomMatch?groomMatch[1].trim():"";
    updateMarriageFields();
    $("record-title").value=record.title||"";
    if($("record-accession-number"))$("record-accession-number").value=record.accession_number||"";
    if($("record-collection"))$("record-collection").value=record.collection_name||"";
    if($("record-type"))$("record-type").value=record.record_type||"";
    if($("record-language"))$("record-language").value=record.record_language||"";
    if($("record-repository"))$("record-repository").value=record.repository||"";
    if($("record-source-reference"))$("record-source-reference").value=record.source_reference||"";
    if($("record-provenance"))$("record-provenance").value=record.provenance||"";
    if($("record-transcription-status"))$("record-transcription-status").value=record.transcription_status||"not_assessed";
    if($("record-translation-status"))$("record-translation-status").value=record.translation_status||"not_assessed";
    if($("record-preservation-notes"))$("record-preservation-notes").value=record.preservation_notes||"";
    $("record-category").value=canonical(record.category)||"notes";updateMarriageFields();if($("record-cause-of-death"))$("record-cause-of-death").value=causeMatch?causeMatch[1].trim():"";
    $("record-date").value=record.record_date|| (dateMatch?dateMatch[1].trim():"");if($("record-language"))$("record-language").value=record.record_language|| (languageMatch?languageMatch[1].trim():"");if($("record-transcription-status"))$("record-transcription-status").value=record.transcription_status|| (transcriptionStatusMatch?transcriptionStatusMatch[1].trim():"not_assessed");if($("record-translation-status"))$("record-translation-status").value=record.translation_status|| (translationStatusMatch?translationStatusMatch[1].trim():"not_assessed");if($("record-registration-date"))$("record-registration-date").value=registrationDateMatch?registrationDateMatch[1].trim():"";if($("record-number"))$("record-number").value=recordNumberMatch?recordNumberMatch[1].trim():"";if($("record-age-at-event"))$("record-age-at-event").value=ageMatch?ageMatch[1].trim():"";if($("record-alternate-spellings"))$("record-alternate-spellings").value=alternateSpellingsMatch?alternateSpellingsMatch[1].trim():"";
    $("record-location").value=record.location||"";if($("record-parish"))$("record-parish").value=parishMatch?parishMatch[1].trim():"";if($("record-house-number"))$("record-house-number").value=houseMatch?houseMatch[1].trim():"";if($("record-page-number"))$("record-page-number").value=pageNumberMatch?pageNumberMatch[1].trim():"";if($("record-page-entry"))$("record-page-entry").value=pageEntryMatch?pageEntryMatch[1].trim():"";if($("record-source-reference"))$("record-source-reference").value=sourceMatch?sourceMatch[1].trim():(record.source_reference||"");
    populatePersonRows(record);populateWitnessRows(record);renderSourceEntryEditor(record);
    updateMarriageFields();
    $("record-confidence").value=confidence;
    $("record-description").value=notes;
    $("record-files").value="";if($("record-files"))$("record-files").value="";
    $("add-record-title").textContent="Edit record";
    uploadForm.querySelector('button[type="submit"]').textContent="Save changes";
    $("upload-message").textContent="Existing source files are kept. Choose additional files below to attach more sources or images.";
    closeModals();showModal("add-record-modal");
  }

  function addWitnessRow(person={},focusName=false){
    const host=$("record-witness-rows");if(!host)return;
    const row=document.createElement("div");row.className="record-person-row witness-person-row";
    const name=document.createElement("input");name.type="text";name.maxLength=180;name.placeholder="Full name";name.className="record-witness-name";name.value=person.name||"";name.setAttribute("aria-label","Participant full name");
    const role=document.createElement("select");role.className="record-witness-role";role.setAttribute("aria-label","Participant role");
    [["Witness","Witness"],["Godparent","Godparent"],["Informant","Informant"],["Priest / officiant","Priest / officiant"],["Registrar","Registrar"],["Other","Other"]].forEach(([v,l])=>{const o=document.createElement("option");o.value=v;o.textContent=l;role.append(o);});
    role.value=["Witness","Godparent","Informant","Priest / officiant","Registrar","Other"].includes(person.relation)?(person.relation||"Witness"):"Other";
    const custom=document.createElement("input");custom.type="text";custom.maxLength=120;custom.placeholder="Describe role";custom.className="record-witness-custom";custom.value=person.custom||(role.value==="Other"?person.relation||"":"");custom.hidden=role.value!=="Other";
    role.addEventListener("change",()=>{custom.hidden=role.value!=="Other";if(role.value==="Other")custom.focus();});
    const remove=document.createElement("button");remove.type="button";remove.className="remove-person-button";remove.textContent="−";remove.setAttribute("aria-label","Remove participant");remove.addEventListener("click",()=>row.remove());
    row.append(name,role,custom,remove);host.append(row);if(focusName)name.focus();
  }
  function readWitnessRows(){return [...document.querySelectorAll("#record-witness-rows .witness-person-row")].map(row=>{const name=row.querySelector(".record-witness-name").value.trim(),role=row.querySelector(".record-witness-role").value,custom=row.querySelector(".record-witness-custom").value.trim();return name?{name,relation:role==="Other"?(custom||"Other"):role}:null;}).filter(Boolean);}
  function populateWitnessRows(record){const host=$("record-witness-rows");if(!host)return;host.replaceChildren();const raw=String(record?.description||"");[...raw.matchAll(/^Record participant:\s*(.*?)\s*\|\s*(.*?)\s*$/gim)].forEach(m=>addWitnessRow({name:m[1].trim(),relation:m[2].trim()}));}
  $("add-record-witness")?.addEventListener("click",()=>addWitnessRow({},true));
  function addPersonRow(person={},focusName=false){
    const host=$("record-person-rows");if(!host)return;
    const row=document.createElement("div");row.className="record-person-row";
    const name=document.createElement("input");name.type="text";name.maxLength=180;name.placeholder="Person's full name";name.className="record-person-name";name.value=person.name||"";name.setAttribute("aria-label","Person's full name");
    const relation=document.createElement("select");relation.className="record-person-relation";relation.setAttribute("aria-label","Relationship");
    [["","Choose relationship"],["Husband","Husband"],["Wife","Wife"],["Mother","Mother"],["Father","Father"],["Other","Other"]].forEach(([value,label])=>{const option=document.createElement("option");option.value=value;option.textContent=label;relation.append(option);});
    relation.value=["Husband","Wife","Mother","Father","Other"].includes(person.relation)?person.relation:"";
    const custom=document.createElement("input");custom.type="text";custom.maxLength=120;custom.placeholder="Type relationship";custom.className="record-person-custom-relation";custom.setAttribute("aria-label","Custom relationship");custom.value=person.custom||"";custom.hidden=relation.value!=="Other";
    if(person.relation&&!["Husband","Wife","Mother","Father","Other"].includes(person.relation)){relation.value="Other";custom.value=person.relation;custom.hidden=false;}
    relation.addEventListener("change",()=>{custom.hidden=relation.value!=="Other";if(relation.value==="Other")custom.focus();});
    const remove=document.createElement("button");remove.type="button";remove.className="remove-person-button";remove.textContent="−";remove.title="Remove person";remove.setAttribute("aria-label","Remove person");remove.addEventListener("click",()=>row.remove());
    row.append(name,relation,custom,remove);host.append(row);if(focusName)name.focus();
  }
  function readPersonRows(){
    return [...document.querySelectorAll("#record-person-rows .record-person-row")].map(row=>{
      const name=row.querySelector(".record-person-name").value.trim(),choice=row.querySelector(".record-person-relation").value,custom=row.querySelector(".record-person-custom-relation").value.trim();
      return name?{name,relation:choice==="Other"?(custom||"Other"):choice,custom:choice==="Other"?custom:""}:null;
    }).filter(Boolean);
  }
  function populatePersonRows(record){
    const host=$("record-person-rows");if(!host)return;host.replaceChildren();
    const raw=String(record?.description||""),relations=[...raw.matchAll(/^Person relationship:\\s*(.*?)\\s*\\|\\s*(.*?)\\s*$/gim)].map(match=>({name:match[1].trim(),relation:match[2].trim()}));
    const names=[...new Set(String(record?.persons_mentioned||"").split(/[\\n,;]+/).map(name=>name.trim()).filter(Boolean))];
    names.forEach(name=>{const relation=relations.find(item=>item.name.toLowerCase()===name.toLowerCase());addPersonRow(relation?{name,relation:relation.relation}:{name});});
  }
  $("add-record-person")?.addEventListener("click",()=>addPersonRow({},true));
  function updateMarriageTitle(){
    const bride=$("record-bride").value.trim(),groom=$("record-groom").value.trim();
    $("record-title").value=bride&&groom?groom+" + "+bride:"";
  }
  const areaSelect=$("record-area-select");
  if(areaSelect){
    const polandAreas=["Bochnia","Brzesko","Chrzanów","Dąbrowa Tarnowska","Gorlice","Kraków County","Limanowa","Miechów","Myślenice","Nowy Sącz County","Nowy Targ","Olkusz","Oświęcim","Proszowice","Sucha Beskidzka","Tarnów County","Tatra County","Wadowice","Wieliczka","Kraków (city)","Nowy Sącz (city)","Tarnów (city)"],usStates=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"];
    function fillAreas(){const loc=$("record-location")?.value||"";const isUS=/(?:united states|\\busa\\b|\\bu\\.s\\.?\\b)/i.test(loc);areaSelect.replaceChildren();const blank=document.createElement("option");blank.value="";blank.textContent="Choose an area…";areaSelect.append(blank);const list=isUS?usStates:polandAreas;list.forEach(name=>{const opt=document.createElement("option");opt.value=name+(isUS?", United States":", Małopolskie, Poland");opt.textContent=name;areaSelect.append(opt);});}
    fillAreas();areaSelect.addEventListener("change",()=>{const chosen=areaSelect.value;if(!chosen)return;const input=$("record-location");const existing=input.value.trim();const place=chosen;input.value=existing?(existing.toLowerCase().includes(place.toLowerCase())?existing:existing+", "+place):place;areaSelect.value="";});
  }
  function updateMarriageFields(){
    const location=$("record-location")?.value||"",isPoland=/(?:poland|polska|rzeczpospolita)/i.test(location),isUnitedStates=/(?:united states|united states of america|\busa\b|\bu\.s\.a\.?\b)/i.test(location);
    const isPolishBirth=$("record-category")?.value==="births"&&isPoland,isUSBirth=$("record-category")?.value==="births"&&isUnitedStates&&!isPoland,isPolishMarriage=$("record-category")?.value==="marriages"&&isPoland,parishField=$("record-parish-field");if(parishField)parishField.hidden=false;
    const familySection=$("polish-birth-family-section"),usBirthSection=$("us-birth-family-section"),marriageFamilySection=$("polish-marriage-family-section"),generalPeople=$("general-persons-section");
    const registerFields=$("polish-register-fields");if(registerFields)registerFields.hidden=!isPoland;const houseField=$("polish-house-number-field");if(houseField)houseField.hidden=!isPolishBirth;
    if(familySection)familySection.hidden=!isPolishBirth;
    if(usBirthSection)usBirthSection.hidden=!isUSBirth;
    if(marriageFamilySection)marriageFamilySection.hidden=!isPolishMarriage;
    if(generalPeople)generalPeople.hidden=isPolishBirth||isUSBirth||isPolishMarriage;
    const isDeath=$("record-category")?.value==="deaths",causeField=$("record-cause-of-death-field");if(causeField)causeField.hidden=!isDeath;
    const isMarriage=$("record-category")?.value==="marriages";
    const section=$("marriage-parties-section");
    const titleField=$("record-title-field");
    if(section)section.hidden=!isMarriage;
    if(titleField)titleField.hidden=isMarriage;
    $("record-bride").required=isMarriage;
    $("record-groom").required=isMarriage;
    $("record-title").readOnly=isMarriage;
    $("record-title").required=!isMarriage;
    $("record-title").placeholder=isMarriage?"Automatically set from groom + bride":"e.g. Michał Tylka baptism record";
    if(isMarriage)updateMarriageTitle();
  }
  $("record-category")?.addEventListener("change",updateMarriageFields);
  $("record-location")?.addEventListener("input",updateMarriageFields);
  $("record-bride")?.addEventListener("input",updateMarriageTitle);
  $("record-groom")?.addEventListener("input",updateMarriageTitle);
  updateMarriageFields();

  function addSourceEntryRow(entry={},fileIndex=null){
    const host=$("record-source-entries");if(!host)return;
    const row=document.createElement("div");row.className="record-source-entry-row";
    if(entry.file_path)row.dataset.filePath=entry.file_path;
    if(fileIndex!==null){row.dataset.fileIndex=String(fileIndex);row.dataset.newFile="true";}
    row.dataset.fileName=entry.file_name||"";
    const heading=document.createElement("strong");heading.className="source-entry-file-name";heading.textContent=row.dataset.fileName||"New attachment";
    const role=document.createElement("select");role.className="source-entry-role";role.setAttribute("aria-label","Source role");
    [["main","Main source"],["supporting","Alternate supporting source"]].forEach(([v,l])=>{const o=document.createElement("option");o.value=v;o.textContent=l;role.append(o);});
    role.value=entry.role==="supporting"?"supporting":"main";
    const caption=document.createElement("input");caption.type="text";caption.maxLength=180;caption.className="source-entry-caption";caption.placeholder="Caption (original scan, translation, supporting record…)";caption.value=entry.caption||"";
    const sourceLink=document.createElement("input");sourceLink.type="url";sourceLink.maxLength=2000;sourceLink.className="source-entry-url";sourceLink.placeholder="Direct image / scan source link (optional)";sourceLink.value=entry.source_url||"";
    const notes=document.createElement("textarea");notes.rows=2;notes.maxLength=2000;notes.className="source-entry-notes";notes.placeholder="Research notes: explain what this supporting source contributes";notes.value=entry.research_notes||"";notes.hidden=role.value!=="supporting";
    role.addEventListener("change",()=>{if(role.value==="main"){document.querySelectorAll("#record-source-entries .source-entry-role").forEach(other=>{if(other!==role)other.value="supporting";});document.querySelectorAll("#record-source-entries .record-source-entry-row").forEach(other=>{const otherRole=other.querySelector(".source-entry-role"),otherNotes=other.querySelector(".source-entry-notes");otherNotes.hidden=otherRole.value==="main";});}notes.hidden=role.value!=="supporting";});
    const remove=document.createElement("button");remove.type="button";remove.className="small-button danger-button source-entry-remove";remove.textContent="Remove";remove.addEventListener("click",()=>row.remove());
    row.append(heading,role,caption,sourceLink,notes,remove);host.append(row);
  }
  function renderSourceEntryEditor(record){
    const host=$("record-source-entries");if(!host)return;host.replaceChildren();
    let entries=record?.source_attachments;if(typeof entries==="string"){try{entries=JSON.parse(entries);}catch(_){entries=[];}}
    if(!Array.isArray(entries))entries=[];
    if(record?.file_path&&!entries.some(item=>item?.file_path===record.file_path))entries.unshift({file_path:record.file_path,file_name:record.file_name||"Main source",mime_type:record.mime_type||"",role:"main"});
    const seen=new Set();entries.forEach(item=>{if(!item?.file_path||seen.has(item.file_path))return;seen.add(item.file_path);addSourceEntryRow({...item,role:item.role||(item.file_path===record?.file_path?"main":"supporting")});});
  }
  function readSourceEntryRows(){return [...document.querySelectorAll("#record-source-entries .record-source-entry-row")].map(row=>({filePath:row.dataset.filePath||"",fileIndex:row.dataset.fileIndex!==undefined?Number(row.dataset.fileIndex):null,fileName:row.dataset.fileName||"",role:row.querySelector(".source-entry-role").value,caption:row.querySelector(".source-entry-caption").value.trim(),researchNotes:row.querySelector(".source-entry-notes").value.trim(),sourceUrl:row.querySelector(".source-entry-url").value.trim()}));}
  $("record-files")?.addEventListener("change",()=>{
    const host=$("record-source-entries");if(!host)return;host.querySelectorAll("[data-new-file]").forEach(row=>row.remove());
    [...$("record-files").files].forEach((file,index)=>addSourceEntryRow({file_name:file.name,role:host.children.length?"supporting":"main"},index));
    const roles=[...host.querySelectorAll(".source-entry-role")];if(roles.length>1&&roles.some((role,index)=>index>0&&role.value==="main"))roles.slice(1).forEach(role=>role.value="supporting");
  });
  const uploadForm=$("upload-form");
  if(uploadForm)uploadForm.addEventListener("submit",async e=>{
    e.preventDefault();if(!client||!currentUser)return setMessage($("upload-message"),"Sign in to edit records.",true);
    const category=$("record-category").value,location=$("record-location").value.trim(),registrationDate=$("record-registration-date")?.value.trim()||"",recordNumber=$("record-number")?.value.trim()||"",ageAtEvent=$("record-age-at-event")?.value.trim()||"",alternateSpellings=$("record-alternate-spellings")?.value.trim()||"",isPoland=/(?:poland|polska|rzeczpospolita)/i.test(location),isUnitedStates=/(?:united states|united states of america|\busa\b|\bu\.s\.a\.?\b)/i.test(location),isPolishBirth=category==="births"&&isPoland,isUSBirth=category==="births"&&isUnitedStates&&!isPoland,isPolishMarriage=category==="marriages"&&isPoland,bride=$("record-bride").value.trim(),groom=$("record-groom").value.trim(),title=category==="marriages"?(groom+" + "+bride):$("record-title").value.trim(),familyFields={"mother":"Mother","father":"Father","maternal-grandfather":"Mother’s father","maternal-grandmother":"Mother’s mother","paternal-grandfather":"Father’s father","paternal-grandmother":"Father’s mother","bride-father":"Bride’s father","bride-mother":"Bride’s mother","groom-father":"Groom’s father","groom-mother":"Groom’s mother","us-mother":"Mother","us-father":"Father"},birthKeys=["mother","father","maternal-grandfather","maternal-grandmother","paternal-grandfather","paternal-grandmother"],usBirthKeys=["us-mother","us-father"],marriageKeys=["bride-father","bride-mother","groom-father","groom-mother"],familyKeys=isPolishBirth?birthKeys:isUSBirth?usBirthKeys:isPolishMarriage?marriageKeys:[],familyNames=familyKeys.map(id=>$("record-"+id).value.trim()),personsSource=(isPolishBirth||isUSBirth||isPolishMarriage)?familyNames:readPersonRows().map(person=>person.name),personRelationships=(isPolishBirth||isUSBirth||isPolishMarriage)?[]:readPersonRows().filter(person=>person.relation).map(person=>"Person relationship: "+person.name+" | "+person.relation),personsMentioned=[...new Set([bride,groom,...personsSource,...readWitnessRows().map(person=>person.name)].filter(Boolean))].join(", "),witnessMetadata=readWitnessRows().map(person=>"Record participant: "+person.name+" | "+person.relation),notes=$("record-description").value.trim(),recordDate=$("record-date").value.trim(),description=[$("record-language")?.value.trim()?"Document language: "+$("record-language").value.trim():"",$("record-transcription-status")?.value?"Transcription status: "+$("record-transcription-status").value:"",$("record-translation-status")?.value?"Translation status: "+$("record-translation-status").value:"",registrationDate?"Registration date: "+registrationDate:"",recordNumber?"Record number: "+recordNumber:"",ageAtEvent?"Age at event: "+ageAtEvent:"",alternateSpellings?"Alternate spellings: "+alternateSpellings:"",recordDate?"Date on record: "+recordDate:"",category==="deaths"&&$("record-cause-of-death")?.value.trim()?"Cause of death: "+$("record-cause-of-death").value.trim():"",$("record-parish")?.value.trim()?"Parish: "+$("record-parish").value.trim():"",isPolishBirth&&$("record-house-number")?.value.trim()?"House number: "+$("record-house-number").value.trim():"",isPoland&&$("record-page-number")?.value.trim()?"Page number: "+$("record-page-number").value.trim():"",isPoland&&$("record-page-entry")?.value.trim()?"Page entry: "+$("record-page-entry").value.trim():"",$("record-source-reference")?.value.trim()?"Source: "+$("record-source-reference").value.trim():"",category==="marriages"?"Bride: "+bride:"",category==="marriages"?"Groom: "+groom:"",...familyKeys.map(id=>{const value=$("record-"+id).value.trim();return value?"Family - "+familyFields[id]+": "+value:"";}),"Research confidence: "+($("record-confidence")?.value||"unassessed"),...personRelationships,...witnessMetadata,notes,...(editingRecordId&&records.find(r=>r.id===editingRecordId)?["Page name identifications","Face identifications"].map(label=>{const rawDescription=String(records.find(r=>r.id===editingRecordId).description||"");const match=rawDescription.match(new RegExp("^"+label+":\\s*([^\\r\\n]+)$","im"));return match?label+": "+match[1]:"";}):[])].filter(Boolean).join(String.fromCharCode(10,10)),files=[...($("record-files")?.files||[])];
    if(!title)return setMessage($("upload-message"),"Enter a record title.",true);
    if(category==="marriages"&&(!bride||!groom))return setMessage($("upload-message"),"Enter both the bride and groom for this marriage record.",true);
    const allowedExtensions=/\.(?:jpe?g|png|webp|tiff?)$/i;
    const allowedMimeTypes=["image/jpeg","image/png","image/webp","image/tiff","application/pdf"];
    const oversizedFile=files.find(item=>item.size>20*1024*1024);
    if(oversizedFile)return setMessage($("upload-message"),"“"+oversizedFile.name+"” is larger than 20 MB. Each file must be 20 MB or smaller.",true);
    const invalidFile=files.find(item=>!(allowedMimeTypes.includes(item.type)||(item.type===""&&allowedExtensions.test(item.name))));
    if(invalidFile)return setMessage($("upload-message"),"“"+invalidFile.name+"” is not a supported file. Allowed files: JPG, PNG, WEBP, TIFF, or PDF.",true);
    const button=uploadForm.querySelector('button[type="submit"]');button.disabled=true;setMessage($("upload-message"),editingRecordId?"Updating record…":"Saving record…");const uploadedPaths=[];
    try{
      const existing=editingRecordId?records.find(r=>r.id===editingRecordId):null;
      const addedAttachments=[];
      for(const item of files){const path=currentUser.id+"/"+category+"/"+crypto.randomUUID()+"-"+item.name.replace(/[^a-zA-Z0-9._-]/g,"_");const {error}=await client.storage.from("family-archive").upload(path,item,{contentType:item.type,upsert:false});if(error)throw error;uploadedPaths.push(path);addedAttachments.push({file_path:path,file_name:item.name,mime_type:item.type,file_size:item.size,created_at:new Date().toISOString()});}
      const values={title,category,description,location,persons_mentioned:personsMentioned,record_date:recordDate||null};
      if(catalogFieldsAvailable)Object.assign(values,{collection_name:$("record-collection").value.trim()||null,record_type:$("record-type").value.trim()||null,record_language:$("record-language").value.trim()||null,repository:$("record-repository").value.trim()||null,source_reference:$("record-source-reference").value.trim()||null,provenance:$("record-provenance").value.trim()||null,transcription_status:$("record-transcription-status").value,translation_status:$("record-translation-status").value,preservation_notes:$("record-preservation-notes").value.trim()||null});
      const previousAttachments=Array.isArray(existing?.source_attachments)?existing.source_attachments:(existing?.source_attachments&&typeof existing.source_attachments==="string"?JSON.parse(existing.source_attachments):[]);
      const sourceRows=readSourceEntryRows();
      let finalAttachments=sourceRows.map(row=>{const uploaded=row.fileIndex!==null?addedAttachments[row.fileIndex]:null;const prior=row.filePath?previousAttachments.find(item=>item.file_path===row.filePath):null;const item=uploaded||prior||{};return {...item,file_path:uploaded?.file_path||row.filePath,file_name:uploaded?.file_name||row.fileName||item.file_name||"Source",role:row.role,caption:row.caption,source_url:row.sourceUrl,research_notes:row.role==="supporting"?row.researchNotes:""};}).filter(item=>item.file_path);
      if(finalAttachments.length&&!finalAttachments.some(item=>item.role==="main"))finalAttachments[0].role="main";
      finalAttachments=finalAttachments.map(item=>({...item,role:item.role==="main"?"main":"supporting",research_notes:item.role==="main"?"":item.research_notes}));
      const mainSource=finalAttachments.find(item=>item.role==="main")||null;
      values.source_attachments=finalAttachments;
      if(mainSource)Object.assign(values,{file_path:mainSource.file_path,file_name:mainSource.file_name,mime_type:mainSource.mime_type||null,file_size:mainSource.file_size||null});
      else Object.assign(values,{file_path:null,file_name:null,mime_type:null,file_size:null});
      let result;
      if(editingRecordId)result=await client.from("archive_records").update(values).eq("id",editingRecordId);
      else result=await client.from("archive_records").insert({owner_id:currentUser.id,created_by:(currentUser.user_metadata?.full_name||currentUser.user_metadata?.name||currentUser.email||"Archive owner"),...values,file_path:values.file_path||null,file_name:values.file_name||null,mime_type:values.mime_type||null,file_size:values.file_size||null});
      if(result.error)throw result.error;
      editingRecordId=null;uploadForm.reset();$("record-person-rows")?.replaceChildren();$("record-witness-rows")?.replaceChildren();$("record-source-entries")?.replaceChildren();updateMarriageFields();$("add-record-title").textContent="Add a record";button.textContent="✓ Saved";button.classList.add("upload-form-success");setMessage($("upload-message"),"Record saved.");await loadRecords();
      setTimeout(()=>{closeModals();setMessage($("upload-message"),"");button.textContent="Save record";button.classList.remove("upload-form-success");},900);
    }catch(error){if(uploadedPaths.length)await client.storage.from("family-archive").remove(uploadedPaths);setMessage($("upload-message"),error.message||"Save failed.",true);}finally{button.disabled=false;}
  });
    const folderContainer=document.querySelector(".archive-folders");
  if(folderContainer){
    const requestedFolder=canonical(new URLSearchParams(window.location.search).get("folder")||"all");
    if(["all","births","deaths","marriages","immigration","photos","notes"].includes(requestedFolder)){
      activeFolder=requestedFolder;
      folderContainer.querySelectorAll(".archive-folder").forEach(item=>{const active=canonical(item.dataset.folder||"all")===activeFolder;item.classList.toggle("is-active",active);item.setAttribute("aria-pressed",String(active));if(active&&$("folder-heading"))$("folder-heading").textContent=item.textContent.trim();});
    }
  }
  if(folderContainer)folderContainer.addEventListener("click",e=>{const button=e.target.closest(".archive-folder");if(!button)return;activeFolder=canonical(button.dataset.folder||"all");folderContainer.querySelectorAll(".archive-folder").forEach(item=>{item.classList.toggle("is-active",item===button);item.setAttribute("aria-pressed",String(item===button));});$("folder-heading").textContent=button.textContent.trim();if(recordSearch)recordSearch.value="";renderRecords();});
  if(recordSearch)recordSearch.addEventListener("input",renderRecords);

  // Manual name markers for scanned record pages; labels and normalized boxes are stored with the record.
  const pageCanvas=$("page-name-canvas"),pageCtx=pageCanvas?.getContext("2d");
  let pageSourceImage=null,pageSelection=null,pageDragStart=null,pageNameEditingIndex=null;
  function readPageNames(record){const m=String(record?.description||"").match(/^Page name identifications:\s*(\[.*\])\s*$/im);if(!m)return[];try{const a=JSON.parse(m[1]);return Array.isArray(a)?a.filter(x=>x&&typeof x.name==="string"&&x.rect):[];}catch(_){return[];}}
  function drawPageNameOverlay(record){
 const overlay=$("page-name-overlay"),image=$("detail-image"),viewport=$("detail-image-viewport");if(!overlay||!image||!viewport)return;
 const width=image.naturalWidth||0,height=image.naturalHeight||0;if(!width||!height){overlay.width=overlay.height=0;return;}
 const fit=Math.min(viewport.clientWidth/width,viewport.clientHeight/height),displayWidth=width*fit,displayHeight=height*fit;
 overlay.width=width;overlay.height=height;overlay.style.width=displayWidth+"px";overlay.style.height=displayHeight+"px";overlay.style.left=((viewport.clientWidth-displayWidth)/2)+"px";overlay.style.top=((viewport.clientHeight-displayHeight)/2)+"px";
 const ctx=overlay.getContext("2d");ctx.clearRect(0,0,width,height);const page=readPageNames(record),faces=readFaceIdentifications(record),all=[...page,...faces],scale=Math.max(1,width/1100);
 all.forEach(entry=>{const r=entry.rect;if(!r||![r.x,r.y,r.w,r.h].every(Number.isFinite))return;const x=r.x*width,y=r.y*height,w=r.w*width,h=r.h*height,pad=7*scale,tagH=Math.max(25,28*scale);ctx.save();ctx.lineWidth=Math.max(2,2.2*scale);ctx.strokeStyle="rgba(255,190,35,.96)";ctx.fillStyle="rgba(255,215,75,.13)";ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.font="600 "+Math.max(15,18*scale)+"px Arial,sans-serif";const tagW=Math.min(width-x,ctx.measureText(entry.name).width+pad*2),tagY=Math.max(0,y-tagH);ctx.fillStyle="rgba(255,196,45,.98)";ctx.strokeStyle="rgba(125,83,15,.95)";ctx.lineWidth=Math.max(1,1.5*scale);ctx.fillRect(x,tagY,tagW,tagH);ctx.strokeRect(x,tagY,tagW,tagH);ctx.fillStyle="#38260b";ctx.textBaseline="middle";ctx.fillText(entry.name,x+pad,tagY+tagH/2,Math.max(10,tagW-pad*2));ctx.restore();});
 const selected=activeFaceHighlight!==null?faces[activeFaceHighlight]:activePageNameHighlight!==null?page[activePageNameHighlight]:null;if(selected?.rect){const r=selected.rect;ctx.save();ctx.lineWidth=Math.max(4,4*scale);ctx.strokeStyle="#fff5a0";ctx.shadowColor="#ffcb32";ctx.shadowBlur=18*scale;ctx.strokeRect(r.x*width,r.y*height,r.w*width,r.h*height);ctx.restore();}
 applyViewerTransform();
 }
  function drawPageCanvas(){if(!pageCtx||!pageSourceImage)return;pageCtx.clearRect(0,0,pageCanvas.width,pageCanvas.height);pageCtx.drawImage(pageSourceImage,0,0,pageCanvas.width,pageCanvas.height);if(pageSelection){pageCtx.save();pageCtx.fillStyle="rgba(93,53,31,.22)";pageCtx.fillRect(0,0,pageCanvas.width,pageCanvas.height);pageCtx.clearRect(pageSelection.x,pageSelection.y,pageSelection.w,pageSelection.h);pageCtx.drawImage(pageSourceImage,pageSelection.x,pageSelection.y,pageSelection.w,pageSelection.h,pageSelection.x,pageSelection.y,pageSelection.w,pageSelection.h);pageCtx.strokeStyle="#f2c66c";pageCtx.lineWidth=Math.max(3,pageCanvas.width/500);pageCtx.strokeRect(pageSelection.x,pageSelection.y,pageSelection.w,pageSelection.h);pageCtx.restore();}}
  function pageCanvasPoint(e){const r=pageCanvas.getBoundingClientRect();return{x:Math.max(0,Math.min(pageCanvas.width,(e.clientX-r.left)*pageCanvas.width/r.width)),y:Math.max(0,Math.min(pageCanvas.height,(e.clientY-r.top)*pageCanvas.height/r.height))};}
  function openPageNameTool(prefillName=""){const image=$("detail-image"),record=window.tylkaActiveDetailRecord;if(!currentUser)return setMessage($("page-name-status"),"Sign in as the archive owner to identify names.",true);if(!record||!isImage(record)||!record.file_path)return setMessage($("page-name-status"),"Open a record with an attached page-scan image first.",true);if(!image?.complete||!image.naturalWidth)return setMessage($("page-name-status"),"The scan is still loading. Try again in a moment.",true);pageSourceImage=image;pageCanvas.width=image.naturalWidth;pageCanvas.height=image.naturalHeight;pageSelection=null;pageNameEditingIndex=null;pageCanvas.style.width="";pageCanvas.style.height="";drawPageCanvas();$("page-person-name").value=typeof prefillName==="string"?prefillName:"";$("save-page-name").textContent="Save identified name";setMessage($("page-name-status"),"");showModal("page-name-modal");fitSelectionCanvas(pageCanvas);}
  $("mark-page-name")?.addEventListener("click",()=>openPageNameTool());
  pageCanvas?.addEventListener("pointerdown",e=>{if(!pageSourceImage)return;e.preventDefault();try{pageCanvas.setPointerCapture(e.pointerId);}catch(_){}pageDragStart=pageCanvasPoint(e);pageSelection={x:pageDragStart.x,y:pageDragStart.y,w:1,h:1};drawPageCanvas();});
  pageCanvas?.addEventListener("pointermove",e=>{if(!pageDragStart)return;e.preventDefault();const p=pageCanvasPoint(e);pageSelection={x:Math.min(p.x,pageDragStart.x),y:Math.min(p.y,pageDragStart.y),w:Math.abs(p.x-pageDragStart.x),h:Math.abs(p.y-pageDragStart.y)};drawPageCanvas();});
  const finishPageDrag=e=>{if(e)e.preventDefault();pageDragStart=null;};pageCanvas?.addEventListener("pointerup",finishPageDrag);pageCanvas?.addEventListener("pointercancel",finishPageDrag);pageCanvas?.addEventListener("lostpointercapture",finishPageDrag);
  $("page-name-reset")?.addEventListener("click",()=>{pageSelection=null;drawPageCanvas();setMessage($("page-name-status"),"Selection cleared.");});
  async function savePageNames(entries){const record=window.tylkaActiveDetailRecord;if(!record||!currentUser)throw new Error("Sign in as the archive owner first.");const clean=String(record.description||"").replace(/^Page name identifications:\s*[^\r\n]+\s*/im,"").trim();const description=(clean?clean+"\n\n":"")+"Page name identifications: "+JSON.stringify(entries);const {error}=await client.from("archive_records").update({description}).eq("id",record.id);if(error)throw error;record.description=description;const i=records.findIndex(x=>x.id===record.id);if(i>=0)records[i].description=description;renderPageNameList(record);}
  $("save-page-name")?.addEventListener("click",async()=>{const name=$("page-person-name").value.trim();if(!name)return setMessage($("page-name-status"),"Enter the person's name.",true);if(!pageSelection||pageSelection.w<8||pageSelection.h<5)return setMessage($("page-name-status"),"Draw a box around the name first.",true);const button=$("save-page-name");button.disabled=true;setMessage($("page-name-status"),"Saving identification…");try{const entries=readPageNames(window.tylkaActiveDetailRecord);const value={name,rect:{x:pageSelection.x/pageCanvas.width,y:pageSelection.y/pageCanvas.height,w:pageSelection.w/pageCanvas.width,h:pageSelection.h/pageCanvas.height},created_at:new Date().toISOString()};if(pageNameEditingIndex===null)entries.push(value);else entries[pageNameEditingIndex]=value;await savePageNames(entries);pageSelection=null;pageNameEditingIndex=null;drawPageCanvas();$("page-person-name").value="";$("save-page-name").textContent="Save identified name";setMessage($("page-name-status"),"Name saved to this record. You can identify another name on the same page.");}catch(error){setMessage($("page-name-status"),error.message||"Could not save this name.",true);}finally{button.disabled=false;}});
  function editPageName(index){if(!currentUser)return;const entries=readPageNames(window.tylkaActiveDetailRecord),entry=entries[index];if(!entry)return;pageNameEditingIndex=index;pageSourceImage=$("detail-image");pageCanvas.width=pageSourceImage.naturalWidth;pageCanvas.height=pageSourceImage.naturalHeight;pageCanvas.style.width="";pageCanvas.style.height="";pageSelection={x:entry.rect.x*pageCanvas.width,y:entry.rect.y*pageCanvas.height,w:entry.rect.w*pageCanvas.width,h:entry.rect.h*pageCanvas.height};drawPageCanvas();$("page-person-name").value=entry.name;$("save-page-name").textContent="Save changes";setMessage($("page-name-status"),"Adjust the box or change the name, then save.");showModal("page-name-modal");fitSelectionCanvas(pageCanvas);}
  async function removePageName(index){if(!currentUser)return;try{const entries=readPageNames(window.tylkaActiveDetailRecord);entries.splice(index,1);await savePageNames(entries);}catch(error){setMessage($("page-name-status"),error.message||"Could not remove the name.",true);}}
  function syncPageNameButton(){const record=window.tylkaActiveDetailRecord,button=$("mark-page-name");if(button)button.hidden=!(currentUser&&record&&isImage(record)&&!!record.file_path);}
  const pageNameObserver=new MutationObserver(syncPageNameButton);const pageDetailModal=$("record-detail-modal");if(pageDetailModal)pageNameObserver.observe(pageDetailModal,{attributes:true,attributeFilter:["hidden"]});syncPageNameButton();

  // Manual face selection and portrait profiles (kept in this browser's local storage).
  const faceCanvas=$("face-crop-canvas"), faceCtx=faceCanvas?.getContext("2d");
  let faceSelection=null, faceDragStart=null, faceSourceImage=null;
  function drawFaceCanvas(){
    if(!faceCtx||!faceSourceImage)return;
    faceCtx.clearRect(0,0,faceCanvas.width,faceCanvas.height);
    faceCtx.drawImage(faceSourceImage,0,0,faceCanvas.width,faceCanvas.height);
    if(faceSelection){faceCtx.save();faceCtx.fillStyle="rgba(93,53,31,.18)";faceCtx.fillRect(0,0,faceCanvas.width,faceCanvas.height);faceCtx.clearRect(faceSelection.x,faceSelection.y,faceSelection.w,faceSelection.h);faceCtx.drawImage(faceSourceImage,faceSelection.x,faceSelection.y,faceSelection.w,faceSelection.h,faceSelection.x,faceSelection.y,faceSelection.w,faceSelection.h);faceCtx.strokeStyle="#fff";faceCtx.lineWidth=Math.max(3,faceCanvas.width/500);faceCtx.strokeRect(faceSelection.x,faceSelection.y,faceSelection.w,faceSelection.h);faceCtx.restore();}
  }
  function canvasPoint(event){const r=faceCanvas.getBoundingClientRect();return{x:Math.max(0,Math.min(faceCanvas.width,(event.clientX-r.left)*faceCanvas.width/r.width)),y:Math.max(0,Math.min(faceCanvas.height,(event.clientY-r.top)*faceCanvas.height/r.height))};}
  function fitSelectionCanvas(canvas){if(!canvas)return;requestAnimationFrame(()=>{const wrap=canvas.parentElement;if(!wrap||!canvas.width||!canvas.height)return;const maxW=Math.max(1,wrap.clientWidth-16),maxH=Math.max(1,window.innerHeight*.52),scale=Math.min(1,maxW/canvas.width,maxH/canvas.height);canvas.style.width=(canvas.width*scale)+"px";canvas.style.height=(canvas.height*scale)+"px";canvas.style.maxWidth="none";canvas.style.maxHeight="none";});}
  function openFaceCrop(){
    const record=window.tylkaActiveDetailRecord, image=$("detail-image");
    if(!currentUser){setMessage($("face-crop-status"),"Sign in as the archive owner to add an ancestor portrait.",true);return;}
    if(!record||!isImage(record)||!record.file_path){setMessage($("face-crop-status"),"Open a record with an attached photograph first.",true);return;}
    if(!image||!image.complete||!image.naturalWidth){setMessage($("face-crop-status"),"The photograph is still loading. Wait a moment, then press Identify face again.",true);return;}
    faceSourceImage=image;faceCanvas.width=image.naturalWidth;faceCanvas.height=image.naturalHeight;faceSelection=null;faceCanvas.style.width="";faceCanvas.style.height="";drawFaceCanvas();$("face-person-name").value="";setMessage($("face-crop-status"),"");showModal("face-crop-modal");fitSelectionCanvas(faceCanvas);
  }
  $("mark-face")?.addEventListener("click",openFaceCrop);
  faceCanvas?.addEventListener("pointerdown",event=>{if(!faceSourceImage)return;event.preventDefault();try{faceCanvas.setPointerCapture(event.pointerId);}catch(_){}faceDragStart=canvasPoint(event);faceSelection={x:faceDragStart.x,y:faceDragStart.y,w:1,h:1};drawFaceCanvas();});
  faceCanvas?.addEventListener("pointermove",event=>{if(!faceDragStart)return;event.preventDefault();const p=canvasPoint(event);faceSelection={x:Math.min(p.x,faceDragStart.x),y:Math.min(p.y,faceDragStart.y),w:Math.abs(p.x-faceDragStart.x),h:Math.abs(p.y-faceDragStart.y)};drawFaceCanvas();});
  function finishFaceDrag(event){if(event)event.preventDefault();faceDragStart=null;}
  faceCanvas?.addEventListener("pointerup",finishFaceDrag);faceCanvas?.addEventListener("pointercancel",finishFaceDrag);faceCanvas?.addEventListener("lostpointercapture",finishFaceDrag);
  $("face-crop-reset")?.addEventListener("click",()=>{faceSelection=null;drawFaceCanvas();setMessage($("face-crop-status"),"Selection cleared.");});
  function selectedFaceCropBlob(){
    return new Promise((resolve,reject)=>{
      if(!faceSelection||faceSelection.w<12||faceSelection.h<12)return reject(new Error("Drag a box around the face first."));
      const side=Math.min(Math.max(faceSelection.w,faceSelection.h),faceCanvas.width,faceCanvas.height),cx=faceSelection.x+faceSelection.w/2,cy=faceSelection.y+faceSelection.h/2;
      const sx=Math.max(0,Math.min(faceCanvas.width-side,cx-side/2)),sy=Math.max(0,Math.min(faceCanvas.height-side,cy-side/2));
      const output=document.createElement("canvas");output.width=512;output.height=512;
      output.getContext("2d").drawImage(faceSourceImage,sx,sy,side,side,0,0,512,512);
      output.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not prepare the portrait image.")),"image/jpeg",.88);
    });
  }
  $("save-face-portrait")?.addEventListener("click",async()=>{
    const name=$("face-person-name").value.trim(),record=window.tylkaActiveDetailRecord;
    if(!name)return setMessage($("face-crop-status"),"Enter the person's name.",true);
    if(!faceSelection||faceSelection.w<12||faceSelection.h<12)return setMessage($("face-crop-status"),"Drag a box around the face first.",true);
    if(!client||!currentUser)return setMessage($("face-crop-status"),"Sign in as the archive owner before saving identifications.",true);
    const button=$("save-face-portrait");button.disabled=true;setMessage($("face-crop-status"),"Saving face identification to this record…");
    try{
      const entries=readFaceIdentifications(record);
      entries.push({name,rect:{x:faceSelection.x/faceCanvas.width,y:faceSelection.y/faceCanvas.height,w:faceSelection.w/faceCanvas.width,h:faceSelection.h/faceCanvas.height}});
      const description=writeRecordMetadata(record,"Face identifications",entries);
      const {error}=await client.from("archive_records").update({description}).eq("id",record.id);if(error)throw error;
      record.description=description;renderFaceIdentificationList(record);drawPageNameOverlay(record);
      setMessage($("face-crop-status"),"Face identification saved to this record only. Use the separate portrait action only if you want a portrait in Ancestors.");
      setTimeout(()=>{closeModals();},900);
    }catch(error){setMessage($("face-crop-status"),error.message||"Could not save this face identification.",true);}
    finally{button.disabled=false;}
  });
  $("save-ancestor-portrait")?.addEventListener("click",async()=>{
    const name=$("face-person-name").value.trim(),record=window.tylkaActiveDetailRecord;
    if(!name)return setMessage($("face-crop-status"),"Enter the ancestor's name.",true);
    if(!faceSelection||faceSelection.w<12||faceSelection.h<12)return setMessage($("face-crop-status"),"Drag a box around the face first.",true);
    if(!client||!currentUser)return setMessage($("face-crop-status"),"Sign in as the archive owner before saving portraits.",true);
    const button=$("save-ancestor-portrait");button.disabled=true;setMessage($("face-crop-status"),"Saving separate ancestor portrait…");
    try{
      const blob=await selectedFaceCropBlob(),path=currentUser.id+"/ancestor-portraits/"+crypto.randomUUID()+".jpg";
      const uploaded=await client.storage.from("family-archive").upload(path,blob,{contentType:"image/jpeg",upsert:false});if(uploaded.error)throw uploaded.error;
      const portraitUrl=client.storage.from("family-archive").getPublicUrl(path).data.publicUrl;
      const {data:rows,error:lookupError}=await client.from("ancestor_portraits").select("id,name,portrait_url,portraits,source_title,source_record_id,updated_at").ilike("name",name);if(lookupError)throw lookupError;
      const existing=rows?.find(person=>person.name.toLocaleLowerCase()===name.toLocaleLowerCase());
      const rawDate=String(record?.record_date||"").trim()||((String(record?.description||"").match(/^Date on record:\s*([^\r\n]+)/im)||[])[1]||"");
      const year=(rawDate.match(/(?:17|18|19|20)\d{2}/)||[])[0]||null;
      const face={url:portraitUrl,source_record_id:record.id,source_title:record.title,source_year:year,created_at:new Date().toISOString()};
      const prior=Array.isArray(existing?.portraits)?existing.portraits:(existing?.portrait_url?[{url:existing.portrait_url,source_record_id:existing.source_record_id,source_title:existing.source_title,source_year:year,created_at:existing.updated_at}]:[]);
      const values={name,portrait_url:existing?.portrait_url||portraitUrl,portraits:[...prior,face],source_record_id:existing?.source_record_id||record.id,source_title:existing?.source_title||record.title,updated_at:new Date().toISOString(),created_by:currentUser.id};
      const result=existing?await client.from("ancestor_portraits").update(values).eq("id",existing.id):await client.from("ancestor_portraits").insert(values);if(result.error)throw result.error;
      setMessage($("face-crop-status"),"Ancestor portrait saved separately. It was not added as a face identification on the record.");setTimeout(()=>{closeModals();},900);
    }catch(error){setMessage($("face-crop-status"),error.message||"Could not save the ancestor portrait.",true);}
    finally{button.disabled=false;}
  });
  function syncFaceButton(){const record=window.tylkaActiveDetailRecord;syncPageNameButton();const button=$("mark-face");if(button)button.hidden=!(currentUser&&record&&isImage(record)&&!!record.file_path);}
  const activeDetailObserver=new MutationObserver(syncFaceButton);
  const detailModal=$("record-detail-modal");if(detailModal)activeDetailObserver.observe(detailModal,{attributes:true,attributeFilter:["hidden"]});
  syncFaceButton();

  start();
})();