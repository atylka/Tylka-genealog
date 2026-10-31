(() => {
 const config=window.TYLKA_SUPABASE_CONFIG||{}, configured=config.url&&config.anonKey&&!config.url.includes("YOUR_")&&!config.anonKey.includes("YOUR_");
 const login=document.getElementById("home-login"), workspace=document.getElementById("home-search-workspace"), status=document.getElementById("home-status"), form=document.getElementById("home-login-form"), msg=document.getElementById("home-login-message"), results=document.getElementById("home-results"), count=document.getElementById("home-result-count");
 const query=document.getElementById("home-query"), category=document.getElementById("home-category"), location=document.getElementById("home-location");
 const activitySection=document.getElementById("home-activity-log"), activityList=document.getElementById("home-activity-list");
 const names={births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
 let client,records=[],activeUser=null;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=text||"";return e;};
 function renderLog(){
  if(!activityList)return;
  activityList.replaceChildren();
  if(!records.length){activityList.append(node("p","No records have been added yet.","empty-state"));return;}
  records.forEach(r=>{
   const item=node("article","","activity-log-item");
   const details=node("div","","activity-log-record");
   const folder=names[r.category]||r.category||"Uncategorized";
   const stamp=new Date(r.created_at);
   const who=r.created_by||"Archive owner";
   const timeText=stamp.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})+", "+stamp.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"});
   details.append(node("p",timeText+" — "+who+" added “"+(r.title||"Untitled record")+"” to “"+folder+"”.","activity-log-entry"));
   item.append(details);activityList.append(item);
  });
 }
 function render(){
  const q=query.value.trim().toLowerCase(),loc=location.value.trim().toLowerCase(),cat=category.value;
  const found=records.filter(r=>(cat==="all"||r.category===cat)&&(!loc||(r.location||"").toLowerCase().includes(loc))&&[r.title,r.description,r.file_name,r.location].join(" ").toLowerCase().includes(q));
  count.textContent=found.length+" matching record"+(found.length===1?"":"s")+" · "+records.length+" total records";
  results.replaceChildren();
  if(!found.length){results.append(node("p",records.length?"No records match those filters.":"No records have been added yet.","empty-state"));return;}
  found.forEach(r=>{
   const card=node("article","","record-card record-card-expanded"),body=node("div");
   body.append(node("span",names[r.category]||r.category,"record-category"),node("h3",r.title));
   if(r.location)body.append(node("p","Location: "+r.location,"record-location"));
   if(r.description)body.append(node("p",r.description));
   if(r.file_name)body.append(node("small",r.file_name,"record-filename"));
   body.append(node("small",new Date(r.created_at).toLocaleString(),"record-date"));card.append(body);
   if(r.file_path&&r.mime_type&&r.mime_type.startsWith("image/")){
    const media=node("div","","record-preview");const img=document.createElement("img");img.alt="Preview of "+r.title;img.loading="lazy";media.append(img);card.append(media);
    client.storage.from("family-archive").createSignedUrl(r.file_path,300).then(({data})=>{if(data?.signedUrl)img.src=data.signedUrl;});
   }
   if(r.file_path){const actions=node("div","","record-actions"),a=node("a","View original file","small-button");a.href="#";a.addEventListener("click",async e=>{e.preventDefault();const {data,error}=await client.storage.from("family-archive").createSignedUrl(r.file_path,60);if(error)return alert("Could not open file: "+error.message);window.open(data.signedUrl,"_blank","noopener,noreferrer");});actions.append(a);card.append(actions);}
   results.append(card);
  });
 }
 async function load(){const {data,error}=await client.from("archive_records").select("*").order("created_at",{ascending:false});if(error){count.textContent="Could not load records: "+error.message;if(activityList)activityList.textContent="Could not load the archive log: "+error.message;return;}records=data||[];render();renderLog();}
 const bannerTitle=document.getElementById("brand-banner-title"),bannerSubtitle=document.getElementById("brand-banner-subtitle"),editBanner=document.getElementById("edit-brand-banner"),bannerModal=document.getElementById("banner-editor"),bannerForm=document.getElementById("banner-editor-form");
 const bannerDefaults={title:"Tylka Genealogical Log",subtitle:"A living archive of names, places, photographs, and family records.",fade:"black",image_url:""};
 const bannerImageInput=document.getElementById("banner-background-input"),bannerFadeInput=document.getElementById("banner-fade-input");
 let bannerSettings={...bannerDefaults};
 function applyBanner(saved){bannerSettings={...bannerDefaults,...saved};if(bannerTitle)bannerTitle.textContent=bannerSettings.title||bannerDefaults.title;if(bannerSubtitle)bannerSubtitle.textContent=bannerSettings.subtitle||bannerDefaults.subtitle;const banner=document.querySelector(".brand-banner");if(banner){banner.dataset.fade=bannerSettings.fade||"black";banner.style.setProperty("--banner-image",bannerSettings.image_url?'url("'+bannerSettings.image_url.replace(/["\\\\]/g,"\\\\$&")+'")':"none");banner.classList.toggle("has-background-image",!!bannerSettings.image_url);}}
 async function loadBanner(){applyBanner(bannerDefaults);if(!window.supabase||!config.url||!config.anonKey)return;try{const publicClient=window.supabase.createClient(config.url,config.anonKey);const {data,error}=await publicClient.from("site_settings").select("banner_title,banner_subtitle,banner_fade,banner_image_url").eq("id","home").maybeSingle();if(error)throw error;if(data)applyBanner({title:data.banner_title,subtitle:data.banner_subtitle,fade:data.banner_fade,image_url:data.banner_image_url||""});}catch(error){console.warn("Could not load shared banner settings:",error.message);}}
 loadBanner();
 if(editBanner&&bannerModal){editBanner.addEventListener("click",()=>{document.getElementById("banner-title-input").value=bannerTitle.textContent;document.getElementById("banner-subtitle-input").value=bannerSubtitle.textContent;if(bannerFadeInput)bannerFadeInput.value=bannerSettings.fade||"black";if(bannerImageInput)bannerImageInput.value="";bannerModal.hidden=false;});document.getElementById("close-banner-editor").addEventListener("click",()=>bannerModal.hidden=true);bannerModal.addEventListener("click",e=>{if(e.target===bannerModal)bannerModal.hidden=true;});
  bannerForm.addEventListener("submit",async e=>{e.preventDefault();const message=document.getElementById("banner-editor-message");if(!client||!activeUser){message.textContent="Sign in as the archive owner to save banner changes.";return;}message.textContent="Saving banner to the shared archive…";let imageUrl=bannerSettings.image_url||"";const file=bannerImageInput?.files?.[0];if(file){if(!file.type.startsWith("image/")){message.textContent="Please choose an image file.";return;}try{const compressed=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("Could not read image."));reader.onload=()=>{const source=new Image();source.onerror=()=>reject(new Error("Could not process image."));source.onload=()=>{const max=1800,scale=Math.min(1,max/Math.max(source.width,source.height)),canvas=document.createElement("canvas");canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);canvas.getContext("2d").drawImage(source,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not compress image.")),"image/jpeg",.84);};source.src=reader.result;};reader.readAsDataURL(file);});const path=activeUser.id+"/banner-background.jpg";const {error:uploadError}=await client.storage.from("banner-images").upload(path,compressed,{contentType:"image/jpeg",upsert:true,cacheControl:"3600"});if(uploadError)throw uploadError;const {data:publicData}=client.storage.from("banner-images").getPublicUrl(path);imageUrl=publicData.publicUrl;}catch(error){message.textContent="Image upload failed: "+error.message;return;}}
  const payload={id:"home",banner_title:document.getElementById("banner-title-input").value.trim(),banner_subtitle:document.getElementById("banner-subtitle-input").value.trim(),banner_fade:bannerFadeInput?.value||"black",banner_image_url:imageUrl,updated_by:activeUser.id,updated_at:new Date().toISOString()};const {error}=await client.from("site_settings").upsert(payload,{onConflict:"id"});if(error){message.textContent="Could not save shared banner: "+error.message;return;}applyBanner({title:payload.banner_title,subtitle:payload.banner_subtitle,fade:payload.banner_fade,image_url:imageUrl});message.textContent="Banner saved to the shared archive. It will appear on every device.";bannerModal.hidden=true;});}
 async function start(){
  if(!configured||!window.supabase){status.textContent="Supabase connection is not configured.";msg.textContent="Connect the private Supabase project to search records.";return;}
  client=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}}=await client.auth.getSession();activeUser=session?.user||null;
  if(activeUser){login.hidden=true;workspace.hidden=false;if(activitySection)activitySection.hidden=false;if(editBanner)editBanner.hidden=false;await load();}else status.textContent="Sign in with your archive owner account to search records and view the log.";
  client.auth.onAuthStateChange((_e,s)=>{activeUser=s?.user||null;login.hidden=!!activeUser;workspace.hidden=!activeUser;if(editBanner)editBanner.hidden=!activeUser;if(activitySection)activitySection.hidden=!activeUser;if(activeUser)load();else{records=[];results.replaceChildren();if(activityList)activityList.replaceChildren();}});
 }
 if(form)form.addEventListener("submit",async e=>{e.preventDefault();if(!client)return;msg.textContent="Signing in…";const {error}=await client.auth.signInWithPassword({email:document.getElementById("home-email").value.trim(),password:document.getElementById("home-password").value});msg.textContent=error?error.message:"Signed in.";});
 [query,category,location].filter(Boolean).forEach(el=>el.addEventListener("input",render));start();
})();