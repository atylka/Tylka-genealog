(() => {
  const config = window.TYLKA_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey && !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_");
  const loginPanel = document.getElementById("location-login");
  const workspace = document.getElementById("location-workspace");
  const status = document.getElementById("location-status");
  const loginForm = document.getElementById("location-login-form");
  const loginMessage = document.getElementById("location-login-message");
  const list = document.getElementById("location-list");
  const search = document.getElementById("location-search");
  const detail = document.getElementById("location-detail");
  const count = document.getElementById("location-count");
  if (!loginPanel) return;

  const knownPlaces = [
    {name:"Chochołów, Poland",aliases:["chochołów","chocholow"],lat:49.3684,lng:19.8271,context:"Parish research area connected to the early Tylka family line"},
    {name:"Wielogłowy, Poland",aliases:["wielogłowy","wieloglowy"],lat:49.6502,lng:20.6868,context:"Area associated with Michał Tylka burial research and family records"},
    {name:"Pittsburgh, Pennsylvania, USA",aliases:["pittsburgh"],lat:40.4406,lng:-79.9959,context:"Western Pennsylvania migration and family connection"},
    {name:"Mount Pleasant, Pennsylvania, USA",aliases:["mount pleasant","mt. pleasant"],lat:40.1484,lng:-79.5412,context:"Area where Tylka relatives were reportedly living before Bronisław's Ohio settlement"},
    {name:"St. Clairsville, Ohio, USA",aliases:["st. clairsville","saint clairsville"],lat:40.0806,lng:-80.9001,context:"Ohio community associated with Bronisław Tylka after his 1908 immigration"}
  ];
  let client = null, map = null, markerLayer = null, places = [], selected = null;

  const normalize = value => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function setMessage(node,text,isError=false){node.textContent=text;node.classList.toggle("message-error",isError);}
  function escapeText(value){return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function initMap(){
    if(map || !window.L) return;
    map = L.map("family-map",{scrollWheelZoom:false}).setView([48,8],3);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }
  function matchKnown(text){
    const haystack = normalize(text);
    return knownPlaces.find(place=>place.aliases.some(alias=>haystack.includes(normalize(alias))));
  }
  function buildPlaces(records){
    const found = new Map();
    records.forEach(record=>{
      const explicit = (record.location || "").trim();
      const match = explicit ? (knownPlaces.find(p=>normalize(p.name)===normalize(explicit)) || matchKnown(explicit)) : matchKnown([record.title,record.description].join(" "));
      if(!explicit && !match) return;
      const name = explicit || match.name;
      const key = normalize(name);
      if(!found.has(key)){
        const base = match || knownPlaces.find(p=>normalize(p.name)===key);
        found.set(key,{name,lat:base?.lat ?? null,lng:base?.lng ?? null,context:base?.context || "",records:[]});
      }
      found.get(key).records.push(record);
    });
    knownPlaces.forEach(place=>{
      const key=normalize(place.name);
      if(!found.has(key)) found.set(key,{...place,records:[],researchOnly:true});
    });
    return [...found.values()].sort((a,b)=>a.name.localeCompare(b.name));
  }
  function renderList(){
    list.replaceChildren();
    const term=normalize(search.value);
    const visible=places.filter(p=>normalize(p.name).includes(term));
    if(!visible.length){list.innerHTML='<p class="empty-state">No locations match that search.</p>';return;}
    visible.forEach(place=>{
      const button=document.createElement("button");
      button.type="button";button.className="location-item"+(selected && normalize(selected.name)===normalize(place.name)?" is-selected":"");
      const name=document.createElement("strong");name.textContent=place.name;
      const meta=document.createElement("small");meta.textContent=place.records.length+" linked record"+(place.records.length===1?"":"s");
      button.append(name,meta);
      button.addEventListener("click",()=>selectPlace(place));
      list.append(button);
    });
  }
  async function coordinatesFor(place){
    if(Number.isFinite(place.lat)&&Number.isFinite(place.lng)) return [place.lat,place.lng];
    const query=place.name;
    const response=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(query),{headers:{"Accept":"application/json"}});
    if(!response.ok) throw new Error("The map service could not find this place right now.");
    const results=await response.json();
    if(!results.length) throw new Error("No map location found. Try adding a more specific town, region, and country to the record.");
    place.lat=Number(results[0].lat);place.lng=Number(results[0].lon);
    return [place.lat,place.lng];
  }
  async function selectPlace(place){
    selected=place;renderList();detail.innerHTML='<p class="connection-status">Finding location on the map…</p>';
    try{
      initMap();
      const [lat,lng]=await coordinatesFor(place);
      markerLayer.clearLayers();
      const marker=L.marker([lat,lng]).addTo(markerLayer).bindPopup("<strong>"+escapeText(place.name)+"</strong>").openPopup();
      map.setView([lat,lng],Math.max(map.getZoom(),8),{animate:true});
      const heading=document.createElement("h3");heading.textContent=place.name;
      const context=document.createElement("p");context.textContent=place.context || "Location recorded in the family archive.";
      const recordsHeading=document.createElement("p");recordsHeading.className="location-record-heading";recordsHeading.textContent="Associated records";
      detail.replaceChildren(heading,context,recordsHeading);
      if(!place.records.length){const empty=document.createElement("p");empty.className="empty-state";empty.textContent="This is a known family research location. No uploaded record is currently linked to it.";detail.append(empty);}
      place.records.forEach(record=>{
        const card=document.createElement("article");card.className="location-record";
        const title=document.createElement("strong");title.textContent=record.title;
        const category=document.createElement("small");category.textContent=record.category;
        card.append(title,category);
        if(record.description){const note=document.createElement("p");note.textContent=record.description;card.append(note);}
        detail.append(card);
      });
      marker.openPopup();
    }catch(error){detail.textContent=error.message;}
  }
  async function loadRegistry(){
    count.textContent="Loading locations from your private records…";
    const {data,error}=await client.from("archive_records").select("id,title,category,description,location,created_at").order("created_at",{ascending:false});
    if(error){count.textContent="Could not load records: "+error.message;list.textContent="Check that the location registry database update has been run.";return;}
    places=buildPlaces(data||[]);
    count.textContent=places.length+" indexed places · "+(data||[]).length+" private records reviewed";
    renderList();initMap();
    if(places.length) selectPlace(places[0]);
  }
  async function start(){
    if(!configured||!window.supabase){status.textContent="Supabase connection is not configured.";setMessage(loginMessage,"The private location registry needs the configured Supabase project.",true);return;}
    client=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data:{session}}=await client.auth.getSession();
    if(session?.user){loginPanel.hidden=true;workspace.hidden=false;await loadRegistry();}
    else status.textContent="Sign in with your archive owner account to view private locations.";
    client.auth.onAuthStateChange((_event,sessionNow)=>{
      if(sessionNow?.user){loginPanel.hidden=true;workspace.hidden=false;loadRegistry();}
      else{workspace.hidden=true;loginPanel.hidden=false;places=[];list.replaceChildren();}
    });
  }
  loginForm.addEventListener("submit",async event=>{
    event.preventDefault();if(!client)return setMessage(loginMessage,"Supabase is not connected.",true);
    setMessage(loginMessage,"Signing in…");
    const {error}=await client.auth.signInWithPassword({email:document.getElementById("location-email").value.trim(),password:document.getElementById("location-password").value});
    setMessage(loginMessage,error?error.message:"Signed in. Loading the location registry…",!!error);
  });
  search.addEventListener("input",renderList);
  start();
})();