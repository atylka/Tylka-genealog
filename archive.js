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
  const isImage = record => (record.mime_type||"").startsWith("image/");
  function makeThumbnail(record) { const wrap=document.createElement("div");wrap.className="record-thumbnail";if(record.file_path&&isImage(record)){const img=document.createElement("img");img.src=publicFileUrl(record.file_path);img.alt="Thumbnail of "+record.title;img.loading="lazy";wrap.append(img);}else{const label=document.createElement("span");label.className="record-thumbnail-placeholder";label.textContent=record.file_path?(record.mime_type==="application/pdf"?"PDF":"FILE"):"No scan";wrap.append(label);}return wrap; }
  const publicFileUrl = path => path ? client.storage.from("family-archive").getPublicUrl(path).data.publicUrl : null;
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
    const filtered=records.filter(r=>(activeFolder==="all"||canonical(r.category)===activeFolder)&&[r.title,r.description,r.file_name,r.location].join(" ").toLowerCase().includes(term));
    if(!filtered.length){const p=document.createElement("p");p.className="empty-state";p.textContent=records.length?"No records match this search.":"No records have been added yet.";recordsList.append(p);return;}
    filtered.forEach(record=>{
      const card=document.createElement("article");card.className="record-card";
      const details=document.createElement("div");
      card.append(makeThumbnail(record));
      card.append(makeThumbnail(record));
      const category=document.createElement("span");category.className="record-category";category.textContent=categoryNames[canonical(record.category)]||record.category;details.append(category);
      const title=document.createElement("h3");title.textContent=record.title;details.append(title);
      if(record.location){const p=document.createElement("p");p.className="record-location";p.append(document.createTextNode("Location: "));const a=document.createElement("a");a.className="record-location-link";a.textContent=record.location;a.href="location-registry.html?place="+encodeURIComponent(record.location);p.append(a);details.append(p);}
      if(record.description){const p=document.createElement("p");p.textContent=record.description;details.append(p);}
      const confidence=readConfidence(record.description);const confidenceBadge=document.createElement("span");confidenceBadge.className="confidence-badge confidence-"+confidence;confidenceBadge.textContent=confidenceLabel(confidence);details.append(confidenceBadge);
      const detailButton=document.createElement("button");detailButton.type="button";detailButton.className="record-detail-trigger";detailButton.textContent="View record details";detailButton.addEventListener("click",()=>openRecordDetail(record));details.append(detailButton);
      const date=document.createElement("small");date.className="record-date";date.textContent=new Date(record.created_at).toLocaleDateString();details.append(date);
      card.append(details);
      const actions=document.createElement("div");actions.className="record-actions";
      if(record.file_path){const view=document.createElement("button");view.type="button";view.className="small-button";view.textContent="View original";view.addEventListener("click",()=>showAttachment(publicFileUrl(record.file_path),record,record.mime_type));actions.append(view);}
      if(currentUser){const del=document.createElement("button");del.type="button";del.className="small-button danger-button";del.textContent="Delete";del.addEventListener("click",async()=>{if(!confirm("Delete this record and its uploaded file?"))return;const {error}=await client.from("archive_records").delete().eq("id",record.id);if(error)return alert(error.message);if(record.file_path)await client.storage.from("family-archive").remove([record.file_path]);await loadRecords();});actions.append(del);}
      card.append(actions);recordsList.append(card);
    });
  }
  function showAttachment(url,record,mimeType){openRecordDetail(record);}

  const confidenceLabels={confirmed:"Confirmed",probable:"Probable",uncertain:"Uncertain",unverified:"Unverified",unassessed:"Not assessed"};
  const readConfidence=description=>{const m=String(description||"").match(/^Research confidence:\s*(confirmed|probable|uncertain|unverified|unassessed)\s*$/im);return m?m[1]:"unassessed";};
  const confidenceLabel=value=>confidenceLabels[value]||confidenceLabels.unassessed;
  let viewerScale=1,viewerX=0,viewerY=0,viewerDragging=false,viewerStart=null;
  function applyViewerTransform(){const image=$("detail-image");if(!image)return;image.style.transform="translate("+viewerX+"px,"+viewerY+"px) scale("+viewerScale+")";$("image-zoom-level").textContent=Math.round(viewerScale*100)+"%";}
  function zoomViewer(factor,originX,originY){const viewport=$("detail-image-viewport");const old=viewerScale;const next=Math.max(.5,Math.min(6,old*factor));if(originX!==undefined){const rect=viewport.getBoundingClientRect(),cx=originX-rect.left-rect.width/2,cy=originY-rect.top-rect.height/2,ratio=next/old;viewerX=cx-(cx-viewerX)*ratio;viewerY=cy-(cy-viewerY)*ratio;}viewerScale=next;applyViewerTransform();}
  function resetViewer(){viewerScale=1;viewerX=0;viewerY=0;applyViewerTransform();}
  function setupViewer(){const viewport=$("detail-image-viewport");if(!viewport||viewport.dataset.ready)return;viewport.dataset.ready="1";viewport.addEventListener("wheel",e=>{if(!$("record-detail-modal")||$("record-detail-modal").hidden)return;e.preventDefault();zoomViewer(e.deltaY<0?1.15:1/1.15,e.clientX,e.clientY);},{passive:false});viewport.addEventListener("pointerdown",e=>{if(viewerScale<=1)return;viewerDragging=true;viewerStart={x:e.clientX-viewerX,y:e.clientY-viewerY};viewport.setPointerCapture(e.pointerId);});viewport.addEventListener("pointermove",e=>{if(!viewerDragging)return;viewerX=e.clientX-viewerStart.x;viewerY=e.clientY-viewerStart.y;applyViewerTransform();});const stop=()=>{viewerDragging=false;};viewport.addEventListener("pointerup",stop);viewport.addEventListener("pointercancel",stop);$("image-zoom-in").addEventListener("click",()=>zoomViewer(1.25));$("image-zoom-out").addEventListener("click",()=>zoomViewer(1/1.25));$("image-zoom-reset").addEventListener("click",resetViewer);}
  async function openRecordDetail(record){window.tylkaActiveDetailRecord=record;$("detail-title").textContent=record.title;$("detail-meta").textContent=[categoryNames[canonical(record.category)]||record.category,record.location||"Location not entered",new Date(record.created_at).toLocaleDateString()].join(" · ");$("detail-description").textContent=(record.description||"No transcription or notes have been added.").replace(/^Research confidence:\s*[^\r\n]+\s*/im,"");const confidence=readConfidence(record.description);$("detail-confidence").textContent="Research confidence: "+confidenceLabel(confidence);$("detail-confidence").className="detail-confidence confidence-"+confidence;if($("detail-confidence-select"))$("detail-confidence-select").value=confidence;if($("save-confidence"))$("save-confidence").hidden=!currentUser;if($("confidence-save-status"))$("confidence-save-status").textContent="";const img=$("detail-image"),fallback=$("detail-file-fallback");img.hidden=true;img.removeAttribute("src");fallback.replaceChildren();resetViewer();setupViewer();if(record.file_path){const url=publicFileUrl(record.file_path);if(isImage(record)){img.src=url;img.alt=record.title+" original scan";img.hidden=false;}else{const link=document.createElement("a");link.href=url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open original PDF or document";fallback.append(link);}}else{fallback.textContent="No attachment is saved for this record.";}showModal("record-detail-modal");}

  if($("save-confidence"))$("save-confidence").addEventListener("click",async()=>{const record=window.tylkaActiveDetailRecord;if(!record||!currentUser)return;const value=$("detail-confidence-select").value;const clean=String(record.description||"").replace(/^Research confidence:\s*(?:confirmed|probable|uncertain|unverified|unassessed)\s*\r?\n?/im,"");const description="Research confidence: "+value+(clean?"\n\n"+clean:"");const button=$("save-confidence");button.disabled=true;$("confidence-save-status").textContent="Saving…";try{const {error}=await client.from("archive_records").update({description}).eq("id",record.id);if(error)throw error;record.description=description;$("detail-confidence").textContent="Research confidence: "+confidenceLabel(value);$("detail-confidence").className="detail-confidence confidence-"+value;$("confidence-save-status").textContent="Saved ✓";renderRecords();}catch(error){$("confidence-save-status").textContent=error.message||"Could not save assessment.";}finally{button.disabled=false;}});
  async function loadRecords(){
    recordsList.textContent="Loading records…";
    const {data,error}=await client.from("archive_records").select("id,title,category,description,location,file_path,file_name,mime_type,created_at").order("created_at",{ascending:false});
    if(error){recordsList.textContent="Could not load records. "+error.message;return;}
    records=data||[];renderRecords();
  }
  async function start(){
    if(!configured||!window.supabase){recordsList.textContent="Archive connection is not configured.";return;}
    client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
    await loadRecords();
    const {data:{session}}=await client.auth.getSession();setOwner(session?.user||null);
    client.auth.onAuthStateChange((_event,s)=>{setOwner(s?.user||null);loadRecords();});
    document.addEventListener("tylka:auth-changed",async()=>{const {data:{session}}=await client.auth.getSession();setOwner(session?.user||null);loadRecords();});
  }
  function setOwner(user){
    currentUser=user?.id==="7a8cd586-c68f-4078-b61d-a87f3842b07e"?user:null;
    user=currentUser;if($("owner-tools"))$("owner-tools").hidden=!user;if(document.body.dataset.page==="upload"&&$("private-archive"))$("private-archive").hidden=!user;
    if($("archive-heading"))$("archive-heading").textContent=user?"Your archive":"Browse records";
    if($("archive-status"))$("archive-status").textContent=user?"Owner mode · private attachments unlocked":"Public visitor view";
    if(recordsList)renderRecords();
  }
  if($("sign-out"))$("sign-out").addEventListener("click",async()=>{await client.auth.signOut();});
  const uploadForm=$("upload-form");
  if(uploadForm)uploadForm.addEventListener("submit",async e=>{
    e.preventDefault();if(!client||!currentUser)return setMessage($("upload-message"),"Sign in to upload records.",true);
    const title=$("record-title").value.trim(),category=$("record-category").value,notes=$("record-description").value.trim(),recordDate=$("record-date").value.trim(),description=[recordDate?"Date on record: "+recordDate:"","Research confidence: "+($("record-confidence")?.value||"unassessed"),notes].filter(Boolean).join(String.fromCharCode(10,10)),location=$("record-location").value.trim(),file=$("record-file").files[0];
    if(!title)return setMessage($("upload-message"),"Enter a record title.",true);
    if(file&&file.size>20*1024*1024)return setMessage($("upload-message"),"Files must be 20 MB or smaller.",true);
    if(file&&!["image/jpeg","image/png","image/webp","image/tiff","application/pdf"].includes(file.type))return setMessage($("upload-message"),"Allowed files: JPG, PNG, WEBP, TIFF, or PDF.",true);
    const button=uploadForm.querySelector('button[type="submit"]');button.disabled=true;setMessage($("upload-message"),"Saving record…");let filePath=null;
    try{
      if(file){const safeName=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100);filePath=currentUser.id+"/"+category+"/"+crypto.randomUUID()+"-"+safeName;const {error}=await client.storage.from("family-archive").upload(filePath,file,{contentType:file.type,upsert:false});if(error)throw error;}
      const {error}=await client.from("archive_records").insert({owner_id:currentUser.id,created_by:(currentUser.user_metadata?.full_name||currentUser.user_metadata?.name||currentUser.email||"Archive owner"),title,category,description,location,file_path:filePath,file_name:file?.name||null,mime_type:file?.type||null,file_size:file?.size||null});
      if(error){if(filePath)await client.storage.from("family-archive").remove([filePath]);throw error;}
      uploadForm.reset();button.textContent="✓ Saved";button.classList.add("upload-form-success");setMessage($("upload-message"),"Record saved to your archive.");await loadRecords();setTimeout(()=>{closeModals();setMessage($("upload-message"),"");button.textContent="Save record";button.classList.remove("upload-form-success");},900);
    }catch(error){setMessage($("upload-message"),error.message||"Upload failed.",true);}finally{button.disabled=false;}
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
  start();
})();