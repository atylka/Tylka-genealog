(() => {
 const grid=document.getElementById("ancestor-grid"),empty=document.getElementById("ancestor-empty"),count=document.getElementById("ancestor-count");
 const config=window.TYLKA_SUPABASE_CONFIG||{};
 const client=window.supabase&&config.url&&config.anonKey?(window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true}}))):null;
 const esc=value=>String(value||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 function render(){
  let people=[];try{people=JSON.parse(localStorage.getItem("tylkaAncestorPortraits")||"[]");}catch(_){}
  people.sort((a,b)=>a.name.localeCompare(b.name));
  grid.replaceChildren();count.textContent=people.length+" "+(people.length===1?"person":"people");empty.hidden=people.length>0;
  people.forEach(person=>{
   const card=document.createElement("article");card.className="ancestor-card";
   const image=document.createElement("img");image.className="ancestor-portrait";image.src=person.portrait_url||person.portrait;image.alt="Portrait of "+person.name;
   const body=document.createElement("div");body.className="ancestor-card-body";
   const title=document.createElement("h3");title.textContent=person.name;
   const source=document.createElement("p");source.className="ancestor-source";source.textContent=person.sourceTitle?"Portrait source: "+person.sourceTitle:"Portrait source not recorded";
   const open=document.createElement("a");open.className="small-button";open.href="archive.html";open.textContent="Open Record Archive";
   body.append(title,source,open);card.append(image,body);grid.append(card);
  });
 }
 async function load(){if(!client){count.textContent="Archive connection unavailable";return;}const {data,error}=await client.from("ancestor_portraits").select("id,name,portrait_url,source_title,updated_at").order("name");if(error){count.textContent="Run the Supabase stability migration to enable shared portraits.";return;}const people=data||[];grid.replaceChildren();count.textContent=people.length+" "+(people.length===1?"person":"people");empty.hidden=people.length>0;people.forEach(person=>{const card=document.createElement("article");card.className="ancestor-card";const image=document.createElement("img");image.className="ancestor-portrait";image.src=person.portrait_url;image.alt="Portrait of "+person.name;const body=document.createElement("div");body.className="ancestor-card-body";const title=document.createElement("h3");title.textContent=person.name;const source=document.createElement("p");source.className="ancestor-source";source.textContent=person.source_title?"Portrait source: "+person.source_title:"Portrait source not recorded";const open=document.createElement("a");open.className="small-button";open.href="archive.html";open.textContent="Open Record Archive";body.append(title,source,open);card.append(image,body);grid.append(card);});}
 load();window.addEventListener("tylka:auth-changed",load);
})();