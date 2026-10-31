(() => {
  const config = window.TYLKA_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey && !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_");
  const $ = id => document.getElementById(id);
  const loginPanel = $("login-panel"), loginForm = $("login-form"), loginToggle = $("owner-login-toggle");
  const loginMessage = $("login-message"), recordsList = $("records-list"), recordSearch = $("record-search");
  const categoryNames = {births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
  let client = null, currentUser = null, records = [], activeFolder = "all", selectedRecord = null, pollHandle = null;
  const pendingKey = "tylka_pending_attachment_request";
  const visitorTokensKey = "tylka_access_request_tokens";
  const functionCall = async body => {
    const {data,error} = await client.functions.invoke("record-access",{body});
    if (error) throw new Error(error.message || "The access service could not be reached.");
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const canonical = value => { const key=String(value||"").toLowerCase().trim().replace(/[ &-]+/g,"_"); const aliases={research_notes:"notes",sources:"notes",source_notes:"notes",family_photos:"photos",photographs:"photos",birth:"births",baptism:"births",burials:"deaths",death:"deaths",marriage:"marriages",naturalization:"immigration"}; return aliases[key]||key; };
  const setMessage = (node,text,error=false) => { if(node){node.textContent=text;node.classList.toggle("message-error",error);} };
  const showModal = id => { const node=$(id); if(node) node.hidden=false; };
  const closeModals = () => document.querySelectorAll(".site-modal").forEach(node=>node.hidden=true);
  document.querySelectorAll("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModals));
  document.querySelectorAll(".site-modal").forEach(modal=>modal.addEventListener("click",e=>{if(e.target===modal)closeModals();}));
  if(loginToggle) loginToggle.addEventListener("click",()=>{loginPanel.hidden=!loginPanel.hidden;});
  const addRecordButton=$("open-add-record");
  if(addRecordButton)addRecordButton.addEventListener("click",()=>{if(!currentUser){if(loginPanel)loginPanel.hidden=false;loginPanel?.scrollIntoView({behavior:"smooth",block:"center"});return;}setMessage($("upload-message"),"");showModal("add-record-modal");});
  function renderRecords() {
    recordsList.replaceChildren();
    const term=(recordSearch?.value||"").trim().toLowerCase();
    const filtered=records.filter(r=>(activeFolder==="all"||canonical(r.category)===activeFolder)&&[r.title,r.description,r.file_name,r.location].join(" ").toLowerCase().includes(term));
    if(!filtered.length){const p=document.createElement("p");p.className="empty-state";p.textContent=records.length?"No records match this search.":"No records have been added yet.";recordsList.append(p);return;}
    filtered.forEach(record=>{
      const card=document.createElement("article");card.className="record-card";
      const details=document.createElement("div");
      const category=document.createElement("span");category.className="record-category";category.textContent=categoryNames[canonical(record.category)]||record.category;details.append(category);
      const title=document.createElement("h3");title.textContent=record.title;details.append(title);
      if(record.location){const p=document.createElement("p");p.className="record-location";p.append(document.createTextNode("Location: "));const a=document.createElement("a");a.className="record-location-link";a.textContent=record.location;a.href="location-registry.html?place="+encodeURIComponent(record.location);p.append(a);details.append(p);}
      if(record.description){const p=document.createElement("p");p.textContent=record.description;details.append(p);}
      const confidence=readConfidence(record.description);const confidenceBadge=document.createElement("span");confidenceBadge.className="confidence-badge confidence-"+confidence;confidenceBadge.textContent=confidenceLabel(confidence);details.append(confidenceBadge);\n      const detailButton=document.createElement("button");detailButton.type="button";detailButton.className="record-detail-trigger";detailButton.textContent="View record details";detailButton.addEventListener("click",()=>openRecordDetail(record));details.append(detailButton);\n      const date=document.createElement("small");date.className="record-date";date.textContent=new Date(record.created_at).toLocaleDateString();details.append(date);
      card.append(details);
      const actions=document.createElement("div");actions.className="record-actions";
      if(record.file_path){
        const view=document.createElement("button");view.type="button";view.className="small-button";
        if(currentUser){view.textContent="Open attachment";view.addEventListener("click",async()=>{const {data,error}=await client.storage.from("family-archive").createSignedUrl(record.file_path,180);if(error)return alert("Could not open file: "+error.message);showAttachment(data.signedUrl,record,record.mime_type);});}
        else {view.textContent="Request to view";view.addEventListener("click",()=>openRequest(record));}
        actions.append(view);
      }
      if(currentUser){const del=document.createElement("button");del.type="button";del.className="small-button danger-button";del.textContent="Delete";del.addEventListener("click",async()=>{if(!confirm("Delete this record and its uploaded file?"))return;const {error}=await client.from("archive_records").delete().eq("id",record.id);if(error)return alert(error.message);if(record.file_path)await client.storage.from("family-archive").remove([record.file_path]);await loadRecords();});actions.append(del);}
      card.append(actions);recordsList.append(card);
    });
  }
  function showAttachment(url,record,mimeType,heading="Attachment ready"){const modal=$("access-notice");$("access-notice-title").textContent=heading;$("access-notice-text").textContent=record.title+" is ready to view.";const preview=$("approved-preview");preview.replaceChildren();if((mimeType||record.mime_type||"").startsWith("image/")){const img=document.createElement("img");img.src=url;img.alt=record.title;img.className="approved-zoom-image";preview.append(img);}else{const frame=document.createElement("iframe");frame.src=url;frame.title=record.title;preview.append(frame);}showModal("access-notice");}

  const confidenceLabels={confirmed:"Confirmed",probable:"Probable",uncertain:"Uncertain",unverified:"Unverified",unassessed:"Not assessed"};
  const readConfidence=description=>{const m=String(description||"").match(/^Research confidence:\s*(confirmed|probable|uncertain|unverified|unassessed)\s*$/im);return m?m[1]:"unassessed";};
  const confidenceLabel=value=>confidenceLabels[value]||confidenceLabels.unassessed;
  let viewerScale=1,viewerX=0,viewerY=0,viewerDragging=false,viewerStart=null;
  function applyViewerTransform(){const image=$("detail-image");if(!image)return;image.style.transform="translate("+viewerX+"px,"+viewerY+"px) scale("+viewerScale+")";$("image-zoom-level").textContent=Math.round(viewerScale*100)+"%";}
  function zoomViewer(factor,originX,originY){const viewport=$("detail-image-viewport");const old=viewerScale;const next=Math.max(.5,Math.min(6,old*factor));if(originX!==undefined){const rect=viewport.getBoundingClientRect(),cx=originX-rect.left-rect.width/2,cy=originY-rect.top-rect.height/2,ratio=next/old;viewerX=cx-(cx-viewerX)*ratio;viewerY=cy-(cy-viewerY)*ratio;}viewerScale=next;applyViewerTransform();}
  function resetViewer(){viewerScale=1;viewerX=0;viewerY=0;applyViewerTransform();}
  function setupViewer(){const viewport=$("detail-image-viewport");if(!viewport||viewport.dataset.ready)return;viewport.dataset.ready="1";viewport.addEventListener("wheel",e=>{if(!$("record-detail-modal")||$("record-detail-modal").hidden)return;e.preventDefault();zoomViewer(e.deltaY<0?1.15:1/1.15,e.clientX,e.clientY);},{passive:false});viewport.addEventListener("pointerdown",e=>{if(viewerScale<=1)return;viewerDragging=true;viewerStart={x:e.clientX-viewerX,y:e.clientY-viewerY};viewport.setPointerCapture(e.pointerId);});viewport.addEventListener("pointermove",e=>{if(!viewerDragging)return;viewerX=e.clientX-viewerStart.x;viewerY=e.clientY-viewerStart.y;applyViewerTransform();});const stop=()=>{viewerDragging=false;};viewport.addEventListener("pointerup",stop);viewport.addEventListener("pointercancel",stop);$("image-zoom-in").addEventListener("click",()=>zoomViewer(1.25));$("image-zoom-out").addEventListener("click",()=>zoomViewer(1/1.25));$("image-zoom-reset").addEventListener("click",resetViewer);}
  async function openRecordDetail(record){$("detail-title").textContent=record.title;$("detail-meta").textContent=[categoryNames[canonical(record.category)]||record.category,record.location||"Location not entered",new Date(record.created_at).toLocaleDateString()].join(" · ");$("detail-description").textContent=(record.description||"No transcription or notes have been added.").replace(/^Research confidence:\s*[^\r\n]+\s*/im,"");const confidence=readConfidence(record.description);$("detail-confidence").textContent="Research confidence: "+confidenceLabel(confidence);$("detail-confidence").className="detail-confidence confidence-"+confidence;const img=$("detail-image"),fallback=$("detail-file-fallback");img.hidden=true;img.removeAttribute("src");fallback.replaceChildren();resetViewer();setupViewer();if(record.file_path){const {data,error}=await client.storage.from("family-archive").createSignedUrl(record.file_path,300);if(error){fallback.textContent="The original attachment could not be loaded."; }else if((record.mime_type||"").startsWith("image/")){img.src=data.signedUrl;img.alt=record.title+" original scan";img.hidden=false;}else{const link=document.createElement("a");link.href=data.signedUrl;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open original PDF or document";fallback.append(link);}}else{fallback.textContent="No attachment is saved for this record.";}showModal("record-detail-modal");}
\n  function openRequest(record){selectedRecord=record;$("request-record-title").textContent=record.title;$("visitor-name").value="";setMessage($("request-message"),"");showModal("request-modal");}
  async function loadRecords(){
    recordsList.textContent="Loading records…";
    const {data,error}=await client.from("archive_records").select("id,title,category,description,location,file_path,file_name,mime_type,created_at").order("created_at",{ascending:false});
    if(error){recordsList.textContent="Could not load records. "+error.message;return;}
    records=data||[];renderRecords();
  }
  async function checkPendingRequest(){
    let saved;try{saved=JSON.parse(localStorage.getItem(pendingKey)||"null");}catch(_){saved=null;}
    if(!saved?.requestToken)return;
    try{
      const result=await functionCall({action:"status",requestToken:saved.requestToken});
      if(result.status==="approved"){
        clearInterval(pollHandle);localStorage.removeItem(pendingKey);
        $("access-notice-title").textContent="Access granted";
        $("access-notice-text").textContent="The archive owner approved your request for “"+(result.title||"this attachment")+"”. You can view it here.";
        showAttachment(result.signedUrl,{title:result.title||"Approved attachment",mime_type:result.mimeType},result.mimeType,"Access granted");
        showModal("access-notice");
      }else if(result.status==="denied"){
        clearInterval(pollHandle);localStorage.removeItem(pendingKey);
        $("access-notice-title").textContent="Request denied";
        $("access-notice-text").textContent="The archive owner did not approve this attachment request.";
        $("approved-preview").replaceChildren();showModal("access-notice");
      }
    }catch(_){/* Retry while the visitor remains on the page. */}
  }
  async function refreshInbox(){
    const result=await functionCall({action:"inbox"});
    const list=$("inbox-list");list.replaceChildren();
    const requests=result.requests||[];
    const pending=requests.filter(r=>r.status==="pending").length;
    $("inbox-count").textContent=String(pending);
    if(!requests.length){const p=document.createElement("p");p.className="empty-state";p.textContent="No access requests yet.";list.append(p);return;}
    requests.forEach(req=>{
      const row=document.createElement("article");row.className="inbox-item";
      const title=document.createElement("h3");title.textContent=(req.archive_records?.title||"Archive attachment");row.append(title);
      const info=document.createElement("p");info.textContent=req.visitor_name+" · "+new Date(req.created_at).toLocaleString();row.append(info);
      const state=document.createElement("small");state.className="record-category";state.textContent=req.status;row.append(state);
      if(req.status==="pending"){
        const controls=document.createElement("div");controls.className="record-actions";
        for(const decision of ["approved","denied"]){const button=document.createElement("button");button.type="button";button.className="small-button";button.textContent=decision==="approved"?"Accept":"Deny";button.addEventListener("click",async()=>{button.disabled=true;try{await functionCall({action:"decide",requestId:req.id,decision});await refreshInbox();}catch(error){alert(error.message);button.disabled=false;}});controls.append(button);}
        row.append(controls);
      }
      list.append(row);
    });
  }
  async function start(){
    if(!configured||!window.supabase){recordsList.textContent="Archive connection is not configured.";return;}
    client=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    await loadRecords();
    const {data:{session}}=await client.auth.getSession();setOwner(session?.user||null);
    client.auth.onAuthStateChange((_event,s)=>{setOwner(s?.user||null);loadRecords();});
    checkPendingRequest();pollHandle=setInterval(checkPendingRequest,5000);
    setInterval(()=>{if(currentUser)refreshInbox().catch(()=>{});},30000);
  }
  function setOwner(user){
    currentUser=user;if($("owner-tools"))$("owner-tools").hidden=!user;if(loginToggle)loginToggle.hidden=!!user;if(document.body.dataset.page==="upload"&&$("private-archive"))$("private-archive").hidden=!user;
    if($("archive-heading"))$("archive-heading").textContent=user?"Your archive":"Browse records";
    if($("archive-status"))$("archive-status").textContent=user?"Owner mode · private attachments unlocked":"Public visitor view";
    if(user){if(loginPanel)loginPanel.hidden=true;if($("owner-tools"))refreshInbox().catch(()=>{});}else if(document.body.dataset.page==="upload"&&loginPanel){loginPanel.hidden=false;}if(recordsList)renderRecords();
  }
  if(loginForm)loginForm.addEventListener("submit",async e=>{e.preventDefault();if(!client)return;setMessage(loginMessage,"Signing in…");const {error}=await client.auth.signInWithPassword({email:$("login-email").value.trim(),password:$("login-password").value});setMessage(loginMessage,error?error.message:"Signed in.",!!error);});
  if($("sign-out"))$("sign-out").addEventListener("click",async()=>{await client.auth.signOut();});
  if($("inbox-button"))$("inbox-button").addEventListener("click",async()=>{try{await refreshInbox();showModal("inbox-modal");}catch(error){alert(error.message);}});
  if($("request-form"))$("request-form").addEventListener("submit",async e=>{
    e.preventDefault();if(!selectedRecord)return;
    const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;setMessage($("request-message"),"Sending request…");
    try{const result=await functionCall({action:"request",recordId:selectedRecord.id,name:$("visitor-name").value.trim()});localStorage.setItem(pendingKey,JSON.stringify({requestId:result.requestId,requestToken:result.requestToken}));
      let saved=[];try{saved=JSON.parse(localStorage.getItem(visitorTokensKey)||"[]");}catch(_){}
      saved.push({requestId:result.requestId,requestToken:result.requestToken,title:selectedRecord.title});try{localStorage.setItem(visitorTokensKey,JSON.stringify(saved.slice(-50)));}catch(_){}
      document.dispatchEvent(new CustomEvent("tylka:save-request",{detail:{requestId:result.requestId,requestToken:result.requestToken,title:selectedRecord.title}}));
      setMessage($("request-message"),"Request sent. You can check its status in the site mailbox.");button.textContent="Request sent";}
    catch(error){setMessage($("request-message"),error.message,true);button.disabled=false;}
  });

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
      uploadForm.reset();setMessage($("upload-message"),"Record saved to your archive.");await loadRecords();setTimeout(()=>{closeModals();setMessage($("upload-message"),"");},700);
    }catch(error){setMessage($("upload-message"),error.message||"Upload failed.",true);}finally{button.disabled=false;}
  });

  const folderContainer=document.querySelector(".archive-folders");
  if(folderContainer)folderContainer.addEventListener("click",e=>{const button=e.target.closest(".archive-folder");if(!button)return;activeFolder=canonical(button.dataset.folder||"all");folderContainer.querySelectorAll(".archive-folder").forEach(item=>{item.classList.toggle("is-active",item===button);item.setAttribute("aria-pressed",String(item===button));});$("folder-heading").textContent=button.textContent.trim();if(recordSearch)recordSearch.value="";renderRecords();});
  if(recordSearch)recordSearch.addEventListener("input",renderRecords);
  start();
})();