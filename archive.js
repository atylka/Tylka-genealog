(() => {
  const config = window.TYLKA_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey && !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_");
  const $ = id => document.getElementById(id);
  const recordsList = $("records-list"), recordSearch = $("record-search");
  const categoryNames = {births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
  let client = null, currentUser = null, records = [], activeFolder = "all";
  const canonical = value => { const key=String(value||"").toLowerCase().trim().replace(/[ &-]+/g,"_"); const aliases={research_notes:"notes",sources:"notes",source_notes:"notes",family_photos:"photos",photographs:"photos",birth:"births",baptism:"births",burials:"deaths",death:"deaths",marriage:"marriages",naturalization:"immigration"}; return aliases[key]||key; };
  const setMessage = (node,text,error=false) => { if(node){node.textContent=text;node.classList.toggle("message-error",error);} };
  const publicFileUrl = path => path ? client.storage.from("family-archive").getPublicUrl(path).data.publicUrl : null;
  const filePrefixes={births:"log_bapt",deaths:"log_death",marriages:"log_marriage",immigration:"log_immig",photos:"log_photo",notes:"log_note"};
  function nextSiteFileName(category,keep){const prefix=filePrefixes[canonical(category)]||"log_record";if(keep&&/^log_[a-z]+_\d+\.[a-z0-9]+$/i.test(keep))return keep;let max=0;records.forEach(r=>{const m=String(r.file_name||"").match(new RegExp("^"+prefix+"_(\\d+)(?:\\.[a-z0-9]+)?$","i"));if(m)max=Math.max(max,Number(m[1]));});return prefix+"_"+(max+1);}
  const isImage = record => (record.mime_type||"").startsWith("image/");
  function makeThumbnail(record) { const wrap=document.createElement("div");wrap.className="record-thumbnail";if(record.file_path&&isImage(record)){const img=document.createElement("img");img.src=publicFileUrl(record.file_path);img.alt="Thumbnail of "+record.title;img.loading="lazy";wrap.append(img);}else{const label=document.createElement("span");label.className="record-thumbnail-placeholder";label.textContent=record.file_path?(record.mime_type==="application/pdf"?"PDF":"FILE"):"No scan";wrap.append(label);}return wrap; }

  const showModal = id => { const node=$(id); if(node) node.hidden=false; };
  const closeModals = () => document.querySelectorAll(".site-modal").forEach(node=>node.hidden=true);
  document.querySelectorAll("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModals));
  document.querySelectorAll(".site-modal").forEach(modal=>modal.addEventListener("click",e=>{if(e.target===modal)closeModals();}));
  const addRecordButton=$("open-add-record");
  if(addRecordButton)addRecordButton.addEventListener("click",()=>{if(!currentUser){document.dispatchEvent(new CustomEvent("tylka:open-owner-sign-in"));return;}setMessage($("upload-message"),"");showModal("add-record-modal");});
  function renderRecords() {
    recordsList.replaceChildren();
    const term=(recordSearch?.value||"").trim().toLowerCase();
    const personFilter=$("person-filter")?.value||"";const filtered=records.filter(r=>(activeFolder==="all"||canonical(r.category)===activeFolder)&&[r.title,r.description,r.file_name,r.location,r.persons_mentioned].join(" ").toLowerCase().includes(term)&&(!personFilter||String(r.persons_mentioned||"").split(/[\\n,;]+/).some(n=>n.trim().toLocaleLowerCase()===personFilter)));
    if(!filtered.length){const p=document.createElement("p");p.className="empty-state";p.textContent=records.length?"No records match this search.":"No records have been added yet.";recordsList.append(p);return;}
    filtered.forEach(record=>{
      const card=document.createElement("article");card.className="record-card record-card-expanded";
      const details=document.createElement("div");
      card.append(makeThumbnail(record));
      const category=document.createElement("span");category.className="record-category";category.textContent=categoryNames[canonical(record.category)]||record.category;details.append(category);
      const title=document.createElement("h3");title.textContent=record.title||"Untitled record";details.append(title);const view=document.createElement("button");view.type="button";view.className="small-button record-view-button";view.textContent="View record details";view.setAttribute("aria-label","View record details: "+(record.title||"Untitled record"));view.addEventListener("click",()=>openRecordDetail(record));details.append(view);
      if(record.location){const p=document.createElement("p");p.className="record-location";p.append(document.createTextNode("Location: "));const a=document.createElement("a");a.className="record-location-link";a.textContent=record.location;a.href="location-registry.html?place="+encodeURIComponent(record.location);p.append(a);details.append(p);}
      if(record.record_date){const date=document.createElement("p");date.className="record-date";date.textContent="Record date: "+record.record_date;details.append(date);}
      const confidence=readConfidence(record.description);if(confidence!=="unassessed"){const confidenceBadge=document.createElement("span");confidenceBadge.className="confidence-badge confidence-"+confidence;confidenceBadge.textContent="Research: "+confidenceLabel(confidence);details.append(confidenceBadge);}
      card.append(details);
      const actions=document.createElement("div");actions.className="record-actions";
      if(currentUser){const edit=document.createElement("button");edit.type="button";edit.className="small-button";edit.textContent="Edit";edit.addEventListener("click",()=>beginEditRecord(record));actions.append(edit);const del=document.createElement("button");del.type="button";del.className="small-button danger-button";del.textContent="Delete";del.addEventListener("click",async()=>{if(!confirm("Delete this record and its uploaded file?"))return;const {error}=await client.from("archive_records").delete().eq("id",record.id);if(error)return alert(error.message);if(record.file_path)await client.storage.from("family-archive").remove([record.file_path]);await loadRecords();});actions.append(del);}
      card.append(actions);recordsList.append(card);
    });
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
    const labels={"Mother":"Mother","Father":"Father","Mother’s father":"Mother’s father","Mother’s mother":"Mother’s mother","Father’s father":"Father’s father","Father’s mother":"Father’s mother"};
    const values=[];
    Object.entries(labels).forEach(([stored,label])=>{
      const match=String(record.description||"").match(new RegExp("^Family - "+stored+":\\s*([^\\r\\n]+)$","im"));
      if(match&&match[1].trim())values.push([label,match[1].trim()]);
    });
    return values;
  }
  function readTranscriptionNotes(record){
    return String(record?.description||"").split(/\r?\n/).filter(line=>! /^\s*(?:Date on record|Research confidence|Bride|Groom|Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother)|Page name identifications):/i.test(line)).join("\n").trim();
  }
  let activePageNameHighlight=null;
  function highlightPageName(index){
    activePageNameHighlight=Number.isInteger(index)?index:null;
    drawPageNameOverlay(window.tylkaActiveDetailRecord);
  }
  function renderPageNameList(record){
    const section=$("detail-family-information"),list=$("page-name-list"),familyList=$("detail-family-list"),otherNames=$("other-page-names");
    if(!section||!list||!familyList)return;
    familyList.replaceChildren();list.replaceChildren();activePageNameHighlight=null;
    const family=readFamilyRelationships(record),pageNames=readPageNames(record),matchedPageNameIndexes=new Set();
    const groups=[{title:"Parents",roles:["Mother","Father"]},{title:"Grandparents",roles:["Mother’s father","Mother’s mother","Father’s father","Father’s mother"]}];
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
    section.hidden=!family.length&&!pageNames.length;
    drawPageNameOverlay(record);
  }
  async function openRecordDetail(record){
    window.tylkaActiveDetailRecord=record;
    $("detail-edit-record").hidden=!currentUser;
    $("detail-title").textContent=record.title;
    const meta=[categoryNames[canonical(record.category)]||record.category];
    if(record.record_date)meta.push("Record date: "+record.record_date);
    if(record.location)meta.push(record.location);
    $("detail-meta").textContent=meta.join(" · ");
    const transcriptionNotes=readTranscriptionNotes(record);$("detail-description").textContent=transcriptionNotes;$("detail-transcription-panel").hidden=!transcriptionNotes;
    renderPageNameList(record);
    const confidence=readConfidence(record.description);
    $("detail-confidence").textContent="Research confidence: "+confidenceLabel(confidence);
    $("detail-confidence").className="detail-confidence confidence-"+confidence;
    if($("detail-confidence-select"))$("detail-confidence-select").value=confidence;
    if($("confidence-editor"))$("confidence-editor").hidden=!currentUser;
    if($("save-confidence"))$("save-confidence").hidden=!currentUser;
    if($("confidence-save-status"))$("confidence-save-status").textContent="";
    const img=$("detail-image"),fallback=$("detail-file-fallback"),download=$("download-record-image");
    if(download){download.hidden=!(record.file_path&&isImage(record));download.onclick=async()=>{if(!record.file_path)return;const url=publicFileUrl(record.file_path);try{const response=await fetch(url);if(!response.ok)throw new Error("Download unavailable");const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);const link=document.createElement("a");link.href=objectUrl;link.download=record.file_name||nextSiteFileName(record.category);document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);}catch{const link=document.createElement("a");link.href=url;link.download=record.file_name||"record-image";link.click();}};}
    img.hidden=true;img.removeAttribute("src");
    const nameOverlay=$("page-name-overlay");if(nameOverlay){nameOverlay.width=0;nameOverlay.height=0;}
    fallback.replaceChildren();resetViewer();setupViewer();
    if(record.file_path){const url=publicFileUrl(record.file_path);if(isImage(record)){img.crossOrigin="anonymous";img.onload=()=>{syncFaceButton();drawPageNameOverlay(record);};img.onerror=()=>{setMessage($("face-crop-status"),"The image could not be loaded for portrait editing. Try reopening the record.",true);syncFaceButton();};img.src=url;img.alt=record.title+" original scan";img.hidden=false;}else{fallback.textContent="This attachment is a document file and cannot be previewed as an image.";}}
    else{fallback.textContent="No attachment is saved for this record.";}
    showModal("record-detail-modal");
  }

  $("detail-edit-record")?.addEventListener("click",()=>{const record=window.tylkaActiveDetailRecord;if(record&&currentUser)beginEditRecord(record);});
  if($("save-confidence"))$("save-confidence").addEventListener("click",async()=>{const record=window.tylkaActiveDetailRecord;if(!record||!currentUser)return;const value=$("detail-confidence-select").value;const clean=String(record.description||"").replace(/^Research confidence:\s*(?:confirmed|probable|uncertain|unverified|unassessed)\s*\r?\n?/im,"");const description="Research confidence: "+value+(clean?"\n\n"+clean:"");const button=$("save-confidence");button.disabled=true;$("confidence-save-status").textContent="Saving…";try{const {error}=await client.from("archive_records").update({description}).eq("id",record.id);if(error)throw error;record.description=description;$("detail-confidence").textContent="Research confidence: "+confidenceLabel(value);$("detail-confidence").className="detail-confidence confidence-"+value;$("confidence-save-status").textContent="Saved ✓";renderRecords();}catch(error){$("confidence-save-status").textContent=error.message||"Could not save assessment.";}finally{button.disabled=false;}});
  function populatePersonFilter(){const select=$("person-filter");if(!select)return;const selected=select.value;const people=new Map();records.forEach(record=>String(record.persons_mentioned||"").split(/[\\n,;]+/).map(name=>name.trim()).filter(Boolean).forEach(name=>people.set(name.toLocaleLowerCase(),name)));select.replaceChildren(new Option("All people",""));[...people.values()].sort((a,b)=>a.localeCompare(b)).forEach(name=>select.add(new Option(name,name.toLocaleLowerCase())));if([...select.options].some(option=>option.value===selected))select.value=selected;}
  async function loadRecords(){
    recordsList.textContent="Loading records…";
    const {data,error}=await client.from("archive_records").select("id,title,category,description,location,persons_mentioned,record_date,file_path,file_name,mime_type,created_at").order("created_at",{ascending:false});
    if(error){recordsList.textContent="Could not load records. "+error.message;return;}
    records=data||[];populatePersonFilter();renderRecords();
  }
  async function start(){
    if(!configured||!window.supabase){recordsList.textContent="Archive connection is not configured.";return;}
    client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
    await loadRecords();
    const {data:{session}}=await client.auth.getSession();setOwner(session?.user||null);
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
    const dateMatch=raw.match(/^Date on record:\s*([^\r\n]+)$/im);
    const confidence=readConfidence(raw);
    const brideMatch=raw.match(/^Bride:\s*([^\r\n]*)$/im),groomMatch=raw.match(/^Groom:\s*([^\r\n]*)$/im);
    const familyFields={"mother":"Mother","father":"Father","maternal-grandfather":"Mother’s father","maternal-grandmother":"Mother’s mother","paternal-grandfather":"Father’s father","paternal-grandmother":"Father’s mother"};
    Object.entries(familyFields).forEach(([id,label])=>{const match=raw.match(new RegExp("^Family - "+label+":\\s*([^\\r\\n]*)$","im"));$("record-"+id).value=match?match[1].trim():"";});
    const notes=raw.replace(/^Page name identifications:\s*[^\r\n]+\s*/im,"").replace(/^Date on record:\s*[^\r\n]+\s*/im,"").replace(/^Research confidence:\s*(?:confirmed|probable|uncertain|unverified|unassessed)\s*\r?\n?/im,"").replace(/^Bride:\s*[^\r\n]*\s*/im,"").replace(/^Groom:\s*[^\r\n]*\s*/im,"").replace(/^Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother):\s*[^\r\n]*\s*/gim,"").trim();
    $("record-bride").value=brideMatch?brideMatch[1].trim():"";
    $("record-groom").value=groomMatch?groomMatch[1].trim():"";
    updateMarriageFields();
    $("record-title").value=record.title||"";
    $("record-category").value=canonical(record.category)||"notes";updateMarriageFields();
    $("record-date").value=record.record_date|| (dateMatch?dateMatch[1].trim():"");
    $("record-location").value=record.location||"";
    $("record-persons").value=record.persons_mentioned||"";
    updateMarriageFields();
    $("record-confidence").value=confidence;
    $("record-description").value=notes;
    $("record-file").value="";
    $("add-record-title").textContent="Edit record";
    uploadForm.querySelector('button[type="submit"]').textContent="Save changes";
    $("upload-message").textContent=record.file_name?"Current attachment: "+record.file_name+" (choose a new file to replace it).":"No attachment currently saved.";
    closeModals();showModal("add-record-modal");
  }
  function updateMarriageTitle(){
    const bride=$("record-bride").value.trim(),groom=$("record-groom").value.trim();
    $("record-title").value=bride&&groom?groom+" + "+bride:"";
  }
  function updateMarriageFields(){
    const isPolishBirth=$("record-category")?.value==="births"&&/(?:poland|polska|rzeczpospolita)/i.test($("record-location")?.value||"");
    const familySection=$("polish-birth-family-section"),generalPeople=$("general-persons-section");
    if(familySection)familySection.hidden=!isPolishBirth;
    if(generalPeople)generalPeople.hidden=isPolishBirth;
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
  const uploadForm=$("upload-form");
  if(uploadForm)uploadForm.addEventListener("submit",async e=>{
    e.preventDefault();if(!client||!currentUser)return setMessage($("upload-message"),"Sign in to edit records.",true);
    const category=$("record-category").value,location=$("record-location").value.trim(),isPolishBirth=category==="births"&&/(?:poland|polska|rzeczpospolita)/i.test(location),bride=$("record-bride").value.trim(),groom=$("record-groom").value.trim(),title=category==="marriages"?(groom+" + "+bride):$("record-title").value.trim(),familyFields={"mother":"Mother","father":"Father","maternal-grandfather":"Mother’s father","maternal-grandmother":"Mother’s mother","paternal-grandfather":"Father’s father","paternal-grandmother":"Father’s mother"},familyNames=Object.keys(familyFields).map(id=>$("record-"+id).value.trim()),personsSource=isPolishBirth?familyNames:$("record-persons").value.split(/[\n,;]+/).map(name=>name.trim()),personsMentioned=[...new Set([bride,groom,...personsSource].filter(Boolean))].join(", "),notes=$("record-description").value.trim(),recordDate=$("record-date").value.trim(),description=[recordDate?"Date on record: "+recordDate:"",category==="marriages"?"Bride: "+bride:"",category==="marriages"?"Groom: "+groom:"",...(isPolishBirth?Object.entries(familyFields).map(([id,label])=>{const value=$("record-"+id).value.trim();return value?"Family - "+label+": "+value:"";}):[]),"Research confidence: "+($("record-confidence")?.value||"unassessed"),notes].filter(Boolean).join(String.fromCharCode(10,10)),file=$("record-file").files[0];
    if(!title)return setMessage($("upload-message"),"Enter a record title.",true);
    if(category==="marriages"&&(!bride||!groom))return setMessage($("upload-message"),"Enter both the bride and groom for this marriage record.",true);
    if(file&&file.size>20*1024*1024)return setMessage($("upload-message"),"Files must be 20 MB or smaller.",true);
    if(file&&!["image/jpeg","image/png","image/webp","image/tiff","application/pdf"].includes(file.type))return setMessage($("upload-message"),"Allowed files: JPG, PNG, WEBP, TIFF, or PDF.",true);
    const button=uploadForm.querySelector('button[type="submit"]');button.disabled=true;setMessage($("upload-message"),editingRecordId?"Updating record…":"Saving record…");let newFilePath=null;
    try{
      const existing=editingRecordId?records.find(r=>r.id===editingRecordId):null;
      if(file){const siteName=nextSiteFileName(category,editingRecordId?records.find(r=>r.id===editingRecordId)?.file_name:null);newFilePath=currentUser.id+"/"+category+"/"+crypto.randomUUID()+"-"+siteName;const {error}=await client.storage.from("family-archive").upload(newFilePath,file,{contentType:file.type,upsert:false});if(error)throw error;}
      const values={title,category,description,location,persons_mentioned:personsMentioned,record_date:recordDate||null};
      if(file){values.file_path=newFilePath;values.file_name=nextSiteFileName(category,editingRecordId?records.find(r=>r.id===editingRecordId)?.file_name:null);values.mime_type=file.type;values.file_size=file.size;}
      let result;
      if(editingRecordId)result=await client.from("archive_records").update(values).eq("id",editingRecordId);
      else result=await client.from("archive_records").insert({owner_id:currentUser.id,created_by:(currentUser.user_metadata?.full_name||currentUser.user_metadata?.name||currentUser.email||"Archive owner"),...values,file_path:newFilePath,file_name:file?.name||null,mime_type:file?.type||null,file_size:file?.size||null});
      if(result.error){if(newFilePath)await client.storage.from("family-archive").remove([newFilePath]);throw result.error;}
      if(editingRecordId&&file&&existing?.file_path)await client.storage.from("family-archive").remove([existing.file_path]);
      editingRecordId=null;uploadForm.reset();updateMarriageFields();$("add-record-title").textContent="Add a record";button.textContent="✓ Saved";button.classList.add("upload-form-success");setMessage($("upload-message"),"Record saved.");await loadRecords();
      setTimeout(()=>{closeModals();setMessage($("upload-message"),"");button.textContent="Save record";button.classList.remove("upload-form-success");},900);
    }catch(error){setMessage($("upload-message"),error.message||"Save failed.",true);}finally{button.disabled=false;}
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
  if(recordSearch)recordSearch.addEventListener("input",renderRecords);if($("person-filter"))$("person-filter").addEventListener("change",renderRecords);

  // Manual name markers for scanned record pages; labels and normalized boxes are stored with the record.
  const pageCanvas=$("page-name-canvas"),pageCtx=pageCanvas?.getContext("2d");
  let pageSourceImage=null,pageSelection=null,pageDragStart=null,pageNameEditingIndex=null;
  function readPageNames(record){const m=String(record?.description||"").match(/^Page name identifications:\s*(\[.*\])\s*$/im);if(!m)return[];try{const a=JSON.parse(m[1]);return Array.isArray(a)?a.filter(x=>x&&typeof x.name==="string"&&x.rect):[];}catch(_){return[];}}
  function drawPageNameOverlay(record){const overlay=$("page-name-overlay"),image=$("detail-image"),viewport=$("detail-image-viewport");if(!overlay||!image||!viewport)return;const width=image.naturalWidth||0,height=image.naturalHeight||0;if(!width||!height){overlay.width=overlay.height=0;return;}const fit=Math.min(viewport.clientWidth/width,viewport.clientHeight/height),displayWidth=width*fit,displayHeight=height*fit;overlay.width=width;overlay.height=height;overlay.style.width=displayWidth+"px";overlay.style.height=displayHeight+"px";overlay.style.left=((viewport.clientWidth-displayWidth)/2)+"px";overlay.style.top=((viewport.clientHeight-displayHeight)/2)+"px";const ctx=overlay.getContext("2d");ctx.clearRect(0,0,width,height);if(activePageNameHighlight!==null){const entry=readPageNames(record)[activePageNameHighlight];if(entry){const r=entry.rect,x=r.x*width,y=r.y*height,w=r.w*width,h=r.h*height,scale=Math.max(1,width/1100);ctx.save();ctx.fillStyle="rgba(255,220,70,.58)";ctx.strokeStyle="rgba(255,174,0,1)";ctx.lineWidth=Math.max(4,5*scale);ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.font="600 "+Math.max(15,18*scale)+"px Arial,sans-serif";const label=entry.name,pad=7*scale,tagH=Math.max(25,28*scale),tagW=Math.min(width-x,ctx.measureText(label).width+pad*2),tagY=Math.max(0,y-tagH);ctx.fillStyle="rgba(255,196,45,1)";ctx.strokeStyle="rgba(125,83,15,.95)";ctx.lineWidth=Math.max(1,1.5*scale);ctx.fillRect(x,tagY,tagW,tagH);ctx.strokeRect(x,tagY,tagW,tagH);ctx.fillStyle="#38260b";ctx.textBaseline="middle";ctx.fillText(label,x+pad,tagY+tagH/2,Math.max(10,tagW-pad*2));ctx.restore();}}applyViewerTransform();}
  function drawPageCanvas(){if(!pageCtx||!pageSourceImage)return;pageCtx.clearRect(0,0,pageCanvas.width,pageCanvas.height);pageCtx.drawImage(pageSourceImage,0,0,pageCanvas.width,pageCanvas.height);if(pageSelection){pageCtx.save();pageCtx.fillStyle="rgba(93,53,31,.22)";pageCtx.fillRect(0,0,pageCanvas.width,pageCanvas.height);pageCtx.clearRect(pageSelection.x,pageSelection.y,pageSelection.w,pageSelection.h);pageCtx.drawImage(pageSourceImage,pageSelection.x,pageSelection.y,pageSelection.w,pageSelection.h,pageSelection.x,pageSelection.y,pageSelection.w,pageSelection.h);pageCtx.strokeStyle="#f2c66c";pageCtx.lineWidth=Math.max(3,pageCanvas.width/500);pageCtx.strokeRect(pageSelection.x,pageSelection.y,pageSelection.w,pageSelection.h);pageCtx.restore();}}
  function pageCanvasPoint(e){const r=pageCanvas.getBoundingClientRect();return{x:Math.max(0,Math.min(pageCanvas.width,(e.clientX-r.left)*pageCanvas.width/r.width)),y:Math.max(0,Math.min(pageCanvas.height,(e.clientY-r.top)*pageCanvas.height/r.height))};}
  function openPageNameTool(prefillName=""){const image=$("detail-image"),record=window.tylkaActiveDetailRecord;if(!currentUser)return setMessage($("page-name-status"),"Sign in as the archive owner to identify names.",true);if(!record||!isImage(record)||!record.file_path)return setMessage($("page-name-status"),"Open a record with an attached page-scan image first.",true);if(!image?.complete||!image.naturalWidth)return setMessage($("page-name-status"),"The scan is still loading. Try again in a moment.",true);pageSourceImage=image;pageCanvas.width=image.naturalWidth;pageCanvas.height=image.naturalHeight;pageSelection=null;pageNameEditingIndex=null;drawPageCanvas();$("page-person-name").value=typeof prefillName==="string"?prefillName:"";$("save-page-name").textContent="Save identified name";setMessage($("page-name-status"),"");showModal("page-name-modal");}
  $("mark-page-name")?.addEventListener("click",()=>openPageNameTool());
  pageCanvas?.addEventListener("pointerdown",e=>{if(!pageSourceImage)return;e.preventDefault();try{pageCanvas.setPointerCapture(e.pointerId);}catch(_){}pageDragStart=pageCanvasPoint(e);pageSelection={x:pageDragStart.x,y:pageDragStart.y,w:1,h:1};drawPageCanvas();});
  pageCanvas?.addEventListener("pointermove",e=>{if(!pageDragStart)return;e.preventDefault();const p=pageCanvasPoint(e);pageSelection={x:Math.min(p.x,pageDragStart.x),y:Math.min(p.y,pageDragStart.y),w:Math.abs(p.x-pageDragStart.x),h:Math.abs(p.y-pageDragStart.y)};drawPageCanvas();});
  const finishPageDrag=e=>{if(e)e.preventDefault();pageDragStart=null;};pageCanvas?.addEventListener("pointerup",finishPageDrag);pageCanvas?.addEventListener("pointercancel",finishPageDrag);pageCanvas?.addEventListener("lostpointercapture",finishPageDrag);
  $("page-name-reset")?.addEventListener("click",()=>{pageSelection=null;drawPageCanvas();setMessage($("page-name-status"),"Selection cleared.");});
  async function savePageNames(entries){const record=window.tylkaActiveDetailRecord;if(!record||!currentUser)throw new Error("Sign in as the archive owner first.");const clean=String(record.description||"").replace(/^Page name identifications:\s*[^\r\n]+\s*/im,"").trim();const description=(clean?clean+"\n\n":"")+"Page name identifications: "+JSON.stringify(entries);const {error}=await client.from("archive_records").update({description}).eq("id",record.id);if(error)throw error;record.description=description;const i=records.findIndex(x=>x.id===record.id);if(i>=0)records[i].description=description;renderPageNameList(record);}
  $("save-page-name")?.addEventListener("click",async()=>{const name=$("page-person-name").value.trim();if(!name)return setMessage($("page-name-status"),"Enter the person's name.",true);if(!pageSelection||pageSelection.w<8||pageSelection.h<5)return setMessage($("page-name-status"),"Draw a box around the name first.",true);const button=$("save-page-name");button.disabled=true;setMessage($("page-name-status"),"Saving identification…");try{const entries=readPageNames(window.tylkaActiveDetailRecord);const value={name,rect:{x:pageSelection.x/pageCanvas.width,y:pageSelection.y/pageCanvas.height,w:pageSelection.w/pageCanvas.width,h:pageSelection.h/pageCanvas.height},created_at:new Date().toISOString()};if(pageNameEditingIndex===null)entries.push(value);else entries[pageNameEditingIndex]=value;await savePageNames(entries);pageSelection=null;pageNameEditingIndex=null;drawPageCanvas();$("page-person-name").value="";$("save-page-name").textContent="Save identified name";setMessage($("page-name-status"),"Name saved to this record. You can identify another name on the same page.");}catch(error){setMessage($("page-name-status"),error.message||"Could not save this name.",true);}finally{button.disabled=false;}});
  function editPageName(index){if(!currentUser)return;const entries=readPageNames(window.tylkaActiveDetailRecord),entry=entries[index];if(!entry)return;pageNameEditingIndex=index;pageSourceImage=$("detail-image");pageCanvas.width=pageSourceImage.naturalWidth;pageCanvas.height=pageSourceImage.naturalHeight;pageSelection={x:entry.rect.x*pageCanvas.width,y:entry.rect.y*pageCanvas.height,w:entry.rect.w*pageCanvas.width,h:entry.rect.h*pageCanvas.height};drawPageCanvas();$("page-person-name").value=entry.name;$("save-page-name").textContent="Save changes";setMessage($("page-name-status"),"Adjust the box or change the name, then save.");showModal("page-name-modal");}
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
  function openFaceCrop(){
    const record=window.tylkaActiveDetailRecord, image=$("detail-image");
    if(!currentUser){setMessage($("face-crop-status"),"Sign in as the archive owner to add an ancestor portrait.",true);return;}
    if(!record||!isImage(record)||!record.file_path){setMessage($("face-crop-status"),"Open a record with an attached photograph first.",true);return;}
    if(!image||!image.complete||!image.naturalWidth){setMessage($("face-crop-status"),"The photograph is still loading. Wait a moment, then press Identify face again.",true);return;}
    faceSourceImage=image;faceCanvas.width=image.naturalWidth;faceCanvas.height=image.naturalHeight;faceSelection=null;drawFaceCanvas();$("face-person-name").value="";setMessage($("face-crop-status"),"");showModal("face-crop-modal");
  }
  $("mark-face")?.addEventListener("click",openFaceCrop);
  faceCanvas?.addEventListener("pointerdown",event=>{if(!faceSourceImage)return;event.preventDefault();try{faceCanvas.setPointerCapture(event.pointerId);}catch(_){}faceDragStart=canvasPoint(event);faceSelection={x:faceDragStart.x,y:faceDragStart.y,w:1,h:1};drawFaceCanvas();});
  faceCanvas?.addEventListener("pointermove",event=>{if(!faceDragStart)return;event.preventDefault();const p=canvasPoint(event);faceSelection={x:Math.min(p.x,faceDragStart.x),y:Math.min(p.y,faceDragStart.y),w:Math.abs(p.x-faceDragStart.x),h:Math.abs(p.y-faceDragStart.y)};drawFaceCanvas();});
  function finishFaceDrag(event){if(event)event.preventDefault();faceDragStart=null;}
  faceCanvas?.addEventListener("pointerup",finishFaceDrag);faceCanvas?.addEventListener("pointercancel",finishFaceDrag);faceCanvas?.addEventListener("lostpointercapture",finishFaceDrag);
  $("face-crop-reset")?.addEventListener("click",()=>{faceSelection=null;drawFaceCanvas();setMessage($("face-crop-status"),"Selection cleared.");});
  $("save-face-portrait")?.addEventListener("click",async()=>{
    const name=$("face-person-name").value.trim();
    if(!name)return setMessage($("face-crop-status"),"Enter the ancestor's name.",true);
    if(!faceSelection||faceSelection.w<12||faceSelection.h<12)return setMessage($("face-crop-status"),"Drag a box around the face first.",true);
    if(!client||!currentUser)return setMessage($("face-crop-status"),"Sign in as the archive owner before saving portraits.",true);
    const side=Math.min(Math.max(faceSelection.w,faceSelection.h),faceCanvas.width,faceCanvas.height),cx=faceSelection.x+faceSelection.w/2,cy=faceSelection.y+faceSelection.h/2;
    const sx=Math.max(0,Math.min(faceCanvas.width-side,cx-side/2)),sy=Math.max(0,Math.min(faceCanvas.height-side,cy-side/2));
    const output=document.createElement("canvas");output.width=512;output.height=512;
    output.getContext("2d").drawImage(faceSourceImage,sx,sy,side,side,0,0,512,512);
    const button=$("save-face-portrait");button.disabled=true;setMessage($("face-crop-status"),"Saving portrait to the shared archive…");
    try{
      const blob=await new Promise((resolve,reject)=>output.toBlob(value=>value?resolve(value):reject(new Error("Could not prepare the portrait image.")),"image/jpeg",.88));
      const path=currentUser.id+"/ancestor-portraits/"+crypto.randomUUID()+".jpg";
      const uploaded=await client.storage.from("family-archive").upload(path,blob,{contentType:"image/jpeg",upsert:false});
      if(uploaded.error)throw uploaded.error;
      const portraitUrl=client.storage.from("family-archive").getPublicUrl(path).data.publicUrl;
      const {data:existingRows,error:lookupError}=await client.from("ancestor_portraits").select("id,name,portrait_url,portraits,source_title,source_record_id,updated_at").ilike("name",name);
      if(lookupError)throw lookupError;
      const existing=existingRows?.find(person=>person.name.toLocaleLowerCase()===name.toLocaleLowerCase());
      const face={url:portraitUrl,source_record_id:window.tylkaActiveDetailRecord.id,source_title:window.tylkaActiveDetailRecord.title,source_year:(String(window.tylkaActiveDetailRecord.record_date||"").match(/(?:18|19|20)\d{2}/)||[])[0]||null,created_at:new Date().toISOString()};
      const prior=Array.isArray(existing?.portraits)?existing.portraits:(existing?.portrait_url?[{url:existing.portrait_url,source_record_id:existing.source_record_id,source_title:existing.source_title,created_at:existing.updated_at}]:[]);
      const values={name,portrait_url:existing?.portrait_url||portraitUrl,portraits:[...prior,face],source_record_id:existing?.source_record_id||window.tylkaActiveDetailRecord.id,source_title:existing?.source_title||window.tylkaActiveDetailRecord.title,updated_at:new Date().toISOString(),created_by:currentUser.id};
      const result=existing?await client.from("ancestor_portraits").update(values).eq("id",existing.id):await client.from("ancestor_portraits").insert(values);
      if(result.error)throw result.error;
      setMessage($("face-crop-status"),"Portrait saved to the shared archive. It will be available on other devices.");setTimeout(()=>{closeModals();},700);
    }catch(error){setMessage($("face-crop-status"),error.message||"Could not save portrait. Run the supplied Supabase migration and check storage permissions.",true);}
    finally{button.disabled=false;}
  });
  function syncFaceButton(){const record=window.tylkaActiveDetailRecord;syncPageNameButton();const button=$("mark-face");if(button)button.hidden=!(currentUser&&record&&isImage(record)&&!!record.file_path);}
  const activeDetailObserver=new MutationObserver(syncFaceButton);
  const detailModal=$("record-detail-modal");if(detailModal)activeDetailObserver.observe(detailModal,{attributes:true,attributeFilter:["hidden"]});
  syncFaceButton();

  start();
})();