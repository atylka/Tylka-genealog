(() => {
  const config = window.TYLKA_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey && !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_");
  const workspace = document.getElementById("location-workspace");
  const list = document.getElementById("location-list");
  const search = document.getElementById("location-search");
  const detail = document.getElementById("location-detail");
  const count = document.getElementById("location-count");
  if (!workspace) return;
  let currentUser = null;

  let client = null, map = null, markerLayer = null, places = [], selected = null;
  const coordinateCache=new Map();
  let selectionSequence=0;

  const normalize = value => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function setMessage(node,text,isError=false){node.textContent=text;node.classList.toggle("message-error",isError);}
  function escapeText(value){return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function initMap(){
    if(map || !window.L) return;
    map = L.map("family-map",{scrollWheelZoom:false,preferCanvas:true,fadeAnimation:false,zoomAnimation:false,markerZoomAnimation:false,zoomSnap:1}).setView([48,8],3);
    L.tileLayer(document.documentElement.dataset.theme==="dark"||document.body.dataset.theme==="dark"?"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png":"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:17,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }
  function buildPlaces(records){
    const found=new Map();
    records.forEach(record=>{
      const name=(record.location||"").trim();
      if(!name)return;
      const key=normalize(name);
      if(!found.has(key))found.set(key,{name,lat:null,lng:null,context:name,records:[]});
      found.get(key).records.push(record);
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
    const key=normalize(place.name);
    if(coordinateCache.has(key))return coordinateCache.get(key);
    const request=(async()=>{
      const response=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(place.name),{headers:{"Accept":"application/json","Accept-Language":"en"}});
      if(!response.ok)throw new Error("The map service could not find this place right now.");
      const results=await response.json();
      if(!results.length)throw new Error("No map location found. Try adding a more specific town, region, and country to the record.");
      place.lat=Number(results[0].lat);place.lng=Number(results[0].lon);
      return [place.lat,place.lng];
    })();
    coordinateCache.set(key,request);
    try{return await request;}catch(error){coordinateCache.delete(key);throw error;}
  }
  async function selectPlace(place){
    selected=place;const sequence=++selectionSequence;renderList();detail.innerHTML='<p class="connection-status">Finding location on the map…</p>';
    try{
      initMap();
      const [lat,lng]=await coordinatesFor(place);
      if(sequence!==selectionSequence)return;
      markerLayer.clearLayers();
      const pinIcon=L.divIcon({
        className:"registry-pin-icon",
        html:'<span class="registry-map-pin" aria-hidden="true"><span></span></span>',
        iconSize:[34,44],
        iconAnchor:[17,42],
        popupAnchor:[0,-40]
      });
      const marker=L.marker([lat,lng],{icon:pinIcon,zIndexOffset:2000,keyboard:true,title:place.name,alt:"Selected location: "+place.name})
        .addTo(markerLayer)
        .bindPopup("<strong>"+escapeText(place.name)+"</strong>")
        .bindTooltip(escapeText(place.name),{permanent:true,direction:"top",offset:[0,-38],className:"registry-location-label"})
        .openPopup();
      map.stop();
      map.invalidateSize();
      map.setView([lat,lng],13,{animate:false});
      marker.setZIndexOffset(2000);
      const heading=document.createElement("h3");heading.textContent=place.name;
      const context=document.createElement("p");context.textContent=place.context || "Location recorded in the family archive.";
      const recordsHeading=document.createElement("p");recordsHeading.className="location-record-heading";recordsHeading.textContent="Associated records";
      detail.replaceChildren(heading,context,recordsHeading);
      place.records.forEach((record,index)=>{
        const card=document.createElement("details");card.className="location-record";
        const summary=document.createElement("summary");summary.className="location-record-bar";
        const title=document.createElement("strong");title.textContent=record.title || "Untitled record";
        const category=document.createElement("small");category.textContent=record.category || "Family record";
        const chevron=document.createElement("span");chevron.className="location-record-chevron";chevron.setAttribute("aria-hidden","true");chevron.textContent="＋";
        const labels=document.createElement("span");labels.className="location-record-labels";labels.append(title,category);
        summary.append(labels,chevron);card.append(summary);
        const body=document.createElement("div");body.className="location-record-body";
        if(record.description){const note=document.createElement("p");note.textContent=record.description;body.append(note);}
        if(record.file_path && record.mime_type && record.mime_type.startsWith("image/")){
          const preview=document.createElement("div");preview.className="record-preview";
          const image=document.createElement("img");image.alt="Preview of "+record.title;image.loading="lazy";image.decoding="async";image.dataset.pendingSrc=client.storage.from("family-archive").getPublicUrl(record.file_path).data.publicUrl;preview.append(image);body.append(preview);
          card.addEventListener("toggle",()=>{if(card.open&&image.dataset.pendingSrc){image.src=image.dataset.pendingSrc;delete image.dataset.pendingSrc;}},{once:false});
        }
        if(record.file_path){
          const openButton=document.createElement("button");openButton.type="button";openButton.className="small-button";openButton.textContent="View record details";openButton.addEventListener("click",()=>{const modal=document.getElementById("location-record-popup");if(!modal)return;modal.querySelector(".popup-title").textContent=record.title||"Untitled record";modal.querySelector(".popup-description").textContent=record.description||"No transcription or notes have been added.";const img=modal.querySelector(".popup-image");img.replaceChildren();if(record.file_path&&(record.mime_type||"").startsWith("image/")){const picture=document.createElement("img");picture.src=client.storage.from("family-archive").getPublicUrl(record.file_path).data.publicUrl;picture.alt=record.title||"Record image";picture.style.maxWidth="100%";img.append(picture);}const download=modal.querySelector(".popup-download");download.hidden=!(record.file_path&&(record.mime_type||"").startsWith("image/"));download.onclick=()=>{const a=document.createElement("a");a.href=client.storage.from("family-archive").getPublicUrl(record.file_path).data.publicUrl;a.download=record.file_name||"record-image";a.click();};modal.hidden=false;});body.append(openButton);
        }
        card.append(body);detail.append(card);
      });
      marker.openPopup();
    }catch(error){if(sequence===selectionSequence)detail.textContent=error.message;}
  }

  const yearOf=record=>{const text=[record.title,record.description].join(" ");const m=text.match(/(?:18|19|20)\d{2}/);return m?Number(m[0]):9999;};
  async function buildMigrationRoute(){const output=document.getElementById("route-status");const button=document.getElementById("build-family-route");button.disabled=true;output.textContent="Geocoding places and ordering records…";try{const ordered=[...places].map(p=>({...p,firstYear:Math.min(...p.records.map(yearOf))})).sort((a,b)=>a.firstYear-b.firstYear);const plotted=[];for(const place of ordered){try{plotted.push({place,point:await coordinatesFor(place)});}catch(_){}}if(plotted.length<2)throw new Error("Add at least two specific locations with town and country details to build a route.");const coords=plotted.map(item=>item.point);markerLayer.clearLayers();const line=L.polyline(coords,{color:"#a32632",weight:4,opacity:.82,dashArray:"8 9"}).addTo(map);plotted.forEach((item,index)=>L.circleMarker(item.point,{radius:7,color:"#741923",fillColor:"#c34443",fillOpacity:1}).addTo(markerLayer).bindPopup("<strong>"+(index+1)+". "+escapeText(item.place.name)+"</strong>"));map.fitBounds(line.getBounds().pad(.18),{animate:true});output.textContent="Journey plotted across "+plotted.length+" places, ordered by the earliest year found in their linked records."}catch(error){output.textContent=error.message;}finally{button.disabled=false;}}
  const routeButton=document.getElementById("build-family-route");if(routeButton)routeButton.addEventListener("click",buildMigrationRoute);

  async function loadRegistry(){
    count.textContent="Loading public family locations…";
    const {data,error}=await client.from("archive_records").select("id,title,category,description,location,file_path,file_name,mime_type,created_at").order("created_at",{ascending:false});
    if(error){count.textContent="Could not load records: "+error.message;list.textContent="Check that the location registry database update has been run.";return;}
    places=buildPlaces(data||[]);
    count.textContent=places.length+" indexed places · "+(data||[]).length+" public record descriptions reviewed";
    renderList();initMap();
    if(places.length){const requested=new URLSearchParams(window.location.search).get("place");const initial=(requested&&places.find(p=>normalize(p.name)===normalize(requested)))||places[0];if(requested)search.value=requested;renderList();selectPlace(initial);}
  }
  async function start(){
    if(!configured||!window.supabase){count.textContent="Supabase connection is not configured.";list.textContent="The public location registry could not connect.";return;}
    client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
    const {data:{session}}=await client.auth.getSession();currentUser=session?.user?.id==="7a8cd586-c68f-4078-b61d-a87f3842b07e"?session.user:null;await loadRegistry();
    client.auth.onAuthStateChange((_event,s)=>{currentUser=s?.user?.id==="7a8cd586-c68f-4078-b61d-a87f3842b07e"?s.user:null;loadRegistry();});
    // The Supabase auth listener above already refreshes owner state.
    // Avoid a duplicate location query when site-ui broadcasts the same event.
  }
  search.addEventListener("input",renderList);
  start();
})();