(() => {
 const config=window.TYLKA_SUPABASE_CONFIG||{}, configured=config.url&&config.anonKey&&!config.url.includes("YOUR_")&&!config.anonKey.includes("YOUR_");
 const login=document.getElementById("home-login"), workspace=document.getElementById("home-search-workspace"), status=document.getElementById("home-status"), form=document.getElementById("home-login-form"), msg=document.getElementById("home-login-message"), results=document.getElementById("home-results"), count=document.getElementById("home-result-count");
 const query=document.getElementById("home-query"), category=document.getElementById("home-category"), location=document.getElementById("home-location");
 const names={births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
 let client,records=[];
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=text||"";return e;};
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
 async function load(){const {data,error}=await client.from("archive_records").select("*").order("created_at",{ascending:false});if(error){count.textContent="Could not load records: "+error.message;return;}records=data||[];render();}
 async function start(){
  if(!configured||!window.supabase){status.textContent="Supabase connection is not configured.";msg.textContent="Connect the private Supabase project to search records.";return;}
  client=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}}=await client.auth.getSession();if(session?.user){login.hidden=true;workspace.hidden=false;await load();}else status.textContent="Sign in with your archive owner account to search records.";
  client.auth.onAuthStateChange((_e,s)=>{login.hidden=!!s?.user;workspace.hidden=!s?.user;if(s?.user)load();else{records=[];results.replaceChildren();}});
 }
 form.addEventListener("submit",async e=>{e.preventDefault();if(!client)return;msg.textContent="Signing in…";const {error}=await client.auth.signInWithPassword({email:document.getElementById("home-email").value.trim(),password:document.getElementById("home-password").value});msg.textContent=error?error.message:"Signed in.";});
 [query,category,location].forEach(el=>el.addEventListener("input",render));start();
})();