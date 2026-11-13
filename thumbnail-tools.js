(() => {
  const OWNER_ID="7a8cd586-c68f-4078-b61d-a87f3842b07e";
  const config=window.TYLKA_SUPABASE_CONFIG||{};
  if(!config.url||!config.anonKey||!window.supabase)return;
  const client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
  let owner=null,modal=null,active=null;
  const normalize=value=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
  const parseNames=value=>{
    if(Array.isArray(value))return value.map(item=>typeof item==="string"?item:(item?.name||item?.full_name||"")).filter(Boolean);
    const raw=String(value||"").trim();if(!raw)return [];
    try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))return parsed.map(item=>typeof item==="string"?item:(item?.name||item?.full_name||"")).filter(Boolean);}catch(_){}
    return raw.split(/[\n,;]+/).map(item=>item.trim()).filter(Boolean);
  };
  const isImageRecord=record=>Boolean(record?.file_path&&((record.mime_type||"").toLowerCase().startsWith("image/")||/\.(?:avif|bmp|gif|jpe?g|png|webp|svg|tiff?)(?:[?#].*)?$/i.test([record.file_name,record.file_path].filter(Boolean).join(" "))));
  const publicUrl=record=>record?.file_path?client.storage.from("family-archive").getPublicUrl(record.file_path).data?.publicUrl||"": "";
  const isNotes=record=>/^(?:notes?|sources?)$/i.test(String(record?.category||"").trim())||/(?:research|source)[\s_-]*notes?/i.test(String(record?.category||""));
  function subjectName(record){
    const title=String(record?.title||"").trim();
    const match=title.match(/^(?:(?:birth|baptism|death|burial)(?:\s+(?:record|certificate|entry))?\s+(?:of|for))\s+(.+)$/i)||title.match(/^(.+?)\s+(?:birth|baptism|death|burial)(?:\s+(?:record|certificate|entry))?$/i);
    if(match)return match[1];
    const category=String(record?.category||"").toLowerCase();
    return /birth|bapt|death|burial/.test(category)?title:"";
  }
  function recordMentions(record,name){
    const key=normalize(name);if(!key||!record||isNotes(record))return false;
    if(parseNames(record.persons_mentioned).some(item=>normalize(item)===key))return true;
    const description=String(record.description||"");
    const labels=/^(?:Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother|Bride’s father|Bride’s mother|Groom’s father|Groom’s mother)|Bride|Groom):\s*(.+)$/gim;
    for(const match of description.matchAll(labels))if(normalize(match[1])===key)return true;
    return normalize(subjectName(record))===key;
  }
  function peopleIn(record){
    const names=parseNames(record?.persons_mentioned);
    const description=String(record?.description||"");
    const labels=/^(?:Family - (?:Mother|Father|Mother’s father|Mother’s mother|Father’s father|Father’s mother|Bride’s father|Bride’s mother|Groom’s father|Groom’s mother)|Bride|Groom):\s*(.+)$/gim;
    for(const match of description.matchAll(labels))names.push(match[1]);
    const subject=subjectName(record);if(subject)names.push(subject);
    return [...new Map(names.map(name=>[normalize(name),String(name).trim()])).values()].filter(Boolean);
  }
  function cleanSettings(value){
    const s=value&&typeof value==="object"?value:{};
    return {
      record_id:String(s.record_id||""),
      zoom:Math.min(3,Math.max(.75,Number(s.zoom)||1)),
      position_x:Math.min(100,Math.max(0,Number.isFinite(Number(s.position_x))?Number(s.position_x):50)),
      position_y:Math.min(100,Math.max(0,Number.isFinite(Number(s.position_y))?Number(s.position_y):50))
    };
  }
  function findSource(settings,records,fallback){
    const s=cleanSettings(settings);
    const selected=s.record_id?(records||[]).find(record=>String(record.id)===s.record_id&&isImageRecord(record)):null;
    return selected||fallback||null;
  }
  function styleImage(image,url,settings){
    if(!image||!url)return;
    const s=cleanSettings(settings);
    image.src=url;
    image.style.objectFit="cover";
    image.style.objectPosition=s.position_x+"% "+s.position_y+"%";
    image.style.transform="scale("+s.zoom+")";
    image.style.transformOrigin="center center";
  }
  function applyRecordImage(image,target,records){
    const settings=cleanSettings(target?.thumbnail_settings);
    const source=findSource(settings,records,target);
    if(source)styleImage(image,publicUrl(source),settings);
  }
  function applyPersonImage(image,person,records,fallbackUrl){
    if(!image)return;
    const settings=cleanSettings(person?.thumbnail_settings);
    const source=settings.record_id?findSource(settings,records,null):null;
    if(source)styleImage(image,publicUrl(source),settings);
    else if(fallbackUrl){
      image.src=fallbackUrl;
      image.style.objectFit="cover";
      image.style.objectPosition=settings.position_x+"% "+settings.position_y+"%";
      image.style.transform="scale("+settings.zoom+")";
      image.style.transformOrigin="center center";
    }
  }
  function candidatesFor(kind,target,records){
    const all=(records||[]).filter(isImageRecord);
    if(kind==="person")return all.filter(record=>recordMentions(record,target.name));
    const names=peopleIn(target);
    if(!names.length)return all.filter(record=>String(record.id)===String(target.id));
    return all.filter(record=>String(record.id)===String(target.id)||names.some(name=>recordMentions(record,name)));
  }
  function recordLabel(record){
    const parts=[record.title||"Untitled record",record.category||"Record",record.record_date||"",record.location||""].filter(Boolean);
    return parts.join(" · ");
  }
  function ensureModal(){
    if(modal)return modal;
    modal=document.createElement("section");
    modal.className="site-modal tylka-thumbnail-modal";
    modal.hidden=true;
    modal.setAttribute("role","dialog");
    modal.setAttribute("aria-modal","true");
    modal.setAttribute("aria-labelledby","tylka-thumb-title");
    modal.innerHTML='<div class="modal-card"><button type="button" class="modal-close" aria-label="Close thumbnail editor">×</button><p class="eyebrow">Owner tools</p><h2 id="tylka-thumb-title">Edit thumbnail</h2><p class="tylka-thumb-intro"></p><label for="tylka-thumb-source">Choose a record image</label><select id="tylka-thumb-source"></select><div class="tylka-thumb-preview"><img id="tylka-thumb-preview-image" alt="Selected record thumbnail preview"></div><div class="tylka-thumb-slider"><label for="tylka-thumb-zoom">Zoom <output id="tylka-thumb-zoom-value">100%</output></label><input id="tylka-thumb-zoom" type="range" min="0.75" max="3" step="0.05" value="1"></div><div class="tylka-thumb-slider"><label for="tylka-thumb-x">Horizontal focus <output id="tylka-thumb-x-value">50%</output></label><input id="tylka-thumb-x" type="range" min="0" max="100" step="1" value="50"></div><div class="tylka-thumb-slider"><label for="tylka-thumb-y">Vertical focus <output id="tylka-thumb-y-value">50%</output></label><input id="tylka-thumb-y" type="range" min="0" max="100" step="1" value="50"></div><p class="connection-status tylka-thumb-status" role="status"></p><div class="tylka-thumb-actions"><button type="button" class="button button-dark" id="tylka-thumb-save">Save thumbnail</button><button type="button" class="small-button" id="tylka-thumb-cancel">Cancel</button></div></div>';
    document.body.append(modal);
    const close=()=>{modal.hidden=true;active=null;};
    modal.querySelector(".modal-close").addEventListener("click",close);
    modal.querySelector("#tylka-thumb-cancel").addEventListener("click",close);
    modal.addEventListener("click",event=>{if(event.target===modal)close();});
    document.addEventListener("keydown",event=>{if(!modal.hidden&&event.key==="Escape")close();});
    ["#tylka-thumb-source","#tylka-thumb-zoom","#tylka-thumb-x","#tylka-thumb-y"].forEach(selector=>modal.querySelector(selector).addEventListener("input",updatePreview));
    modal.querySelector("#tylka-thumb-save").addEventListener("click",saveThumbnail);
    return modal;
  }
  function selectedCandidate(){
    if(!active)return null;
    const id=modal.querySelector("#tylka-thumb-source").value;
    return active.candidates.find(record=>String(record.id)===id)||null;
  }
  function currentSettings(){
    return cleanSettings({
      record_id:modal.querySelector("#tylka-thumb-source").value,
      zoom:modal.querySelector("#tylka-thumb-zoom").value,
      position_x:modal.querySelector("#tylka-thumb-x").value,
      position_y:modal.querySelector("#tylka-thumb-y").value
    });
  }
  function updatePreview(){
    if(!active||!modal)return;
    const source=selectedCandidate(),settings=currentSettings();
    const preview=modal.querySelector("#tylka-thumb-preview-image");
    if(source){styleImage(preview,publicUrl(source),settings);preview.alt="Preview of "+(source.title||"selected family record");}
    else{preview.removeAttribute("src");}
    modal.querySelector("#tylka-thumb-zoom-value").textContent=Math.round(settings.zoom*100)+"%";
    modal.querySelector("#tylka-thumb-x-value").textContent=settings.position_x+"%";
    modal.querySelector("#tylka-thumb-y-value").textContent=settings.position_y+"%";
  }
  function openEditor(kind,target,records,image,host,onUpdate,fallbackUrl){
    if(!owner){document.dispatchEvent(new CustomEvent("tylka:open-owner-sign-in"));return;}
    const box=ensureModal();
    const list=candidatesFor(kind,target,records);
    active={kind,target,records:records||[],image,host,onUpdate,fallbackUrl,candidates:list};
    box.querySelector("#tylka-thumb-title").textContent=kind==="person"?"Edit "+target.name+"'s thumbnail":"Edit record thumbnail";
    box.querySelector(".tylka-thumb-intro").textContent=kind==="person"?"Choose an image from a record that mentions "+target.name+". The original scan will remain unchanged.":"Choose an image from a record that mentions someone named in this record. The original scan will remain unchanged.";
    const select=box.querySelector("#tylka-thumb-source");
    select.replaceChildren();
    list.forEach(record=>select.add(new Option(recordLabel(record),String(record.id))));
    const settings=cleanSettings(target.thumbnail_settings);
    const selected=list.some(record=>String(record.id)===settings.record_id)?settings.record_id:(list.some(record=>String(record.id)===String(target.id))?String(target.id):String(list[0]?.id||""));
    select.value=selected;
    box.querySelector("#tylka-thumb-zoom").value=String(settings.zoom);
    box.querySelector("#tylka-thumb-x").value=String(settings.position_x);
    box.querySelector("#tylka-thumb-y").value=String(settings.position_y);
    const status=box.querySelector(".tylka-thumb-status");
    status.textContent=list.length?"Adjust the crop, then save. This changes the thumbnail only.":"No image-bearing records mention this person yet.";
    box.querySelector("#tylka-thumb-save").disabled=!list.length;
    select.disabled=!list.length;
    box.hidden=false;
    updatePreview();
    box.querySelector("#tylka-thumb-source").focus();
  }
  async function saveThumbnail(){
    if(!active||!owner)return;
    const source=selectedCandidate(),settings=currentSettings(),button=modal.querySelector("#tylka-thumb-save"),status=modal.querySelector(".tylka-thumb-status");
    if(!source){status.textContent="Choose a record image first.";return;}
    button.disabled=true;status.textContent="Saving thumbnail settings…";
    try{
      if(active.kind==="record"){
        const result=await client.from("archive_records").update({thumbnail_settings:settings}).eq("id",active.target.id);
        if(result.error)throw result.error;
        active.target.thumbnail_settings=settings;
      }else{
        const lookup=await client.from("ancestor_portraits").select("id").ilike("name",active.target.name).limit(1);
        if(lookup.error)throw lookup.error;
        const existing=lookup.data?.[0];
        const values={thumbnail_settings:settings,updated_at:new Date().toISOString()};
        const result=existing
          ?await client.from("ancestor_portraits").update(values).eq("id",existing.id)
          :await client.from("ancestor_portraits").insert({name:active.target.name,portrait_url:"",created_by:owner.id,...values});
        if(result.error)throw result.error;
        active.target.thumbnail_settings=settings;
      }
      const url=publicUrl(source);
      if(active.kind==="record"){
        document.querySelectorAll("img[data-tylka-record-thumb]").forEach(image=>{
          if(image.dataset.tylkaRecordThumb===String(active.target.id))styleImage(image,url,settings);
        });
      }else{
        const key=normalize(active.target.name);
        document.querySelectorAll("img[data-tylka-person-thumb]").forEach(image=>{
          if(image.dataset.tylkaPersonThumb===key)styleImage(image,url,settings);
        });
        if(active.onUpdate)active.onUpdate(url,settings,source);
      }
      status.textContent="Thumbnail saved.";
      button.textContent="Saved";
      document.dispatchEvent(new CustomEvent("tylka:thumbnail-updated",{detail:{kind:active.kind,id:active.target.id||null,name:active.target.name||null,settings}}));
    }catch(error){
      const message=String(error?.message||"Could not save thumbnail.");
      status.textContent=/thumbnail_settings/i.test(message)
        ?"The thumbnail settings column is missing. Run supabase/migrations/20261113_editable_thumbnails.sql in the Supabase SQL Editor, then reload."
        :message;
      button.disabled=false;
    }
  }
  function addControl(kind,target,records,image,host,onUpdate,fallbackUrl){
    if(!host)return;
    host.classList.add("tylka-thumb-host");
    if(kind==="person")host.classList.add("tylka-person-thumb-host");
    if(image){
      if(kind==="record"){
        image.dataset.tylkaRecordThumb=String(target.id);
        applyRecordImage(image,target,records);
      }else{
        image.dataset.tylkaPersonThumb=normalize(target.name);
        applyPersonImage(image,target,records,fallbackUrl);
      }
    }
    let button=[...host.querySelectorAll(".tylka-thumb-edit")].find(item=>item.dataset.thumbKind===kind);
    if(!button){
      button=document.createElement("button");
      button.type="button";
      button.className="tylka-thumb-edit";
      button.dataset.thumbKind=kind;
      button.textContent="Edit thumbnail";
      button.addEventListener("click",event=>{
        event.preventDefault();event.stopPropagation();
        const current=button._tylkaOpen;
        if(current)current();
      });
      host.append(button);
    }
    button.hidden=!owner;
    button._tylkaOpen=()=>openEditor(kind,target,records,image,host,onUpdate,fallbackUrl);
  }
  function attachRecord(image,record,records,host){
    if(!image||!record||!record.id||!isImageRecord(record))return;
    addControl("record",record,records,image,host||image.parentElement,null,"");
  }
  function attachPerson(image,person,records,host,onUpdate,fallbackUrl){
    if(!person?.name||!host)return;
    addControl("person",person,records,image,host,onUpdate,fallbackUrl||"");
  }
  async function refreshOwner(){
    try{const result=await client.auth.getSession();owner=result.data?.session?.user?.id===OWNER_ID?result.data.session.user:null;}
    catch(_){owner=null;}
    document.querySelectorAll(".tylka-thumb-edit").forEach(button=>button.hidden=!owner);
  }
  client.auth.onAuthStateChange((_event,session)=>{
    owner=session?.user?.id===OWNER_ID?session.user:null;
    document.querySelectorAll(".tylka-thumb-edit").forEach(button=>button.hidden=!owner);
  });
  document.addEventListener("tylka:auth-changed",refreshOwner);
  refreshOwner();
  window.TylkaThumbnailTools={attachRecord,attachPerson,isImageRecord,recordMentionsPerson,publicUrl};
})();