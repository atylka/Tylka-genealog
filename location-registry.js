(() => {
  const config = window.TYLKA_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey && !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_");
  const workspace = document.getElementById("location-workspace");
  const list = document.getElementById("location-list");
  const search = document.getElementById("location-search");
  const detail = document.getElementById("location-detail");
  const count = document.getElementById("location-count");
  const personTrigger = document.getElementById("person-location-trigger");
  const personTriggerLabel = document.getElementById("person-location-trigger-label");
  const personMenu = document.getElementById("person-location-menu");
  const personStatus = document.getElementById("person-location-status");
  if (!workspace) return;
  let currentUser = null;

  let client = null, map = null, markerLayer = null, places = [], selected = null, personIndex = new Map(), portraitIndex = new Map();
  const coordinateCache=new Map();
  let selectionSequence=0;

  const normalize = value => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function setMessage(node,text,isError=false){node.textContent=text;node.classList.toggle("message-error",isError);}
  function escapeText(value){return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function initMap(){
    if(map || !window.L) return;
    map = L.map("family-map",{scrollWheelZoom:false,preferCanvas:true,fadeAnimation:true,zoomAnimation:true,markerZoomAnimation:true,zoomSnap:1}).setView([20,0],2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:17,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    // Keep the standard OpenStreetMap tile colors in both site themes; theme changes do not rebuild the layer.
  }

  function splitPeople(value){
    return String(value||"").split(/[\n,;]+/).map(v=>v.replace(/^[-•*\s]+/,"").trim()).filter(Boolean);
  }
  function buildPersonIndex(records){
    const index=new Map();
    records.forEach(record=>{
      splitPeople(record.persons_mentioned).forEach(name=>{
        const key=normalize(name); if(!key)return;
        if(!index.has(key))index.set(key,{name,places:new Map(),records:[]});
        const person=index.get(key); person.records.push(record);
        const placeName=(record.location||"").trim();
        if(placeName){
          const placeKey=normalize(placeName);
          if(!person.places.has(placeKey))person.places.set(placeKey,places.find(p=>normalize(p.name)===placeKey)||{name:placeName,records:[record]});
          else if(!person.places.get(placeKey).records.some(r=>r.id===record.id))person.places.get(placeKey).records.push(record);
        }
      });
    });
    return index;
  }
  function renderPeople(){
    if(!personMenu)return;
    personMenu.replaceChildren();
    const entries=[...personIndex.entries()].sort((a,b)=>a[1].name.localeCompare(b[1].name));
    if(!entries.length){const empty=document.createElement("p");empty.className="empty-state";empty.textContent="No people have been added to saved records yet.";personMenu.append(empty);return;}
    entries.forEach(([key,person])=>{
      const button=document.createElement("button");button.type="button";button.className="person-picker-option";button.setAttribute("role","option");
      const portrait=portraitIndex.get(key);
      if(portrait){const image=document.createElement("img");image.className="person-picker-avatar";image.src=portrait;image.alt="";image.loading="lazy";button.append(image);}
      else{const placeholder=document.createElement("span");placeholder.className="person-picker-avatar person-picker-avatar-empty";placeholder.setAttribute("aria-hidden","true");button.append(placeholder);}
      const name=document.createElement("span");name.className="person-picker-name";name.textContent=person.name;
      const meta=document.createElement("small");meta.textContent=person.places.size+" location"+(person.places.size===1?"":"s");
      const textWrap=document.createElement("span");textWrap.className="person-picker-copy";textWrap.append(name,meta);button.append(textWrap);
      button.addEventListener("click",()=>{personTriggerLabel.textContent=person.name;personTrigger.setAttribute("aria-expanded","false");personMenu.hidden=true;selectPerson(key);});
      personMenu.append(button);
    });
  }
  async function selectPerson(key){
    const person=personIndex.get(key); markerLayer.clearLayers();
    if(!person){if(personStatus)personStatus.textContent="Choose a person to highlight every location linked to their name in the records.";return;}
    const matches=[...person.places.values()];
    selected=null;renderList();detail.replaceChildren();const prompt=document.createElement("p");prompt.className="empty-state";prompt.textContent="Choose one of the highlighted map pins to view this person’s associated records.";detail.append(prompt);
    const routeButton=document.getElementById("build-family-route");if(routeButton)routeButton.disabled=false;
    if(!matches.length){personStatus.textContent=person.name+" is mentioned in "+person.records.length+" record(s), but none has a saved location.";return;}
    personStatus.textContent="Mapping "+matches.length+" location(s) mentioned for "+person.name+"…";
    const plotted=[];
    for(const place of matches){try{plotted.push({place,point:await coordinatesFor(place)});}catch(error){}}
    if(!plotted.length){personStatus.textContent="No mappable locations found for "+person.name+". Add town and country details to the records.";return;}
    const bounds=[];
    plotted.forEach(({place,point})=>{
      const pin=L.circleMarker(point,{radius:9,color:"#f0d18c",weight:3,fillColor:"#741923",fillOpacity:.95}).addTo(markerLayer);
      pin.bindTooltip(escapeText(place.name),{permanent:true,direction:"top",offset:[0,-9],className:"registry-location-label"});
      pin.bindPopup("<strong>"+escapeText(person.name)+"</strong><br>"+escapeText(place.name)+"<br>"+place.records.length+" linked record(s)");
      pin.on("click",()=>selectPlace(place,true)); bounds.push(point);
    });
    map.stop();map.invalidateSize();
    if(bounds.length===1)map.flyTo(bounds[0],12,{animate:true,duration:1.15,easeLinearity:.22});else map.flyToBounds(L.latLngBounds(bounds).pad(.2),{animate:true,duration:1.25,easeLinearity:.22});
    personStatus.textContent=person.name+" appears in "+person.records.length+" record(s) across "+plotted.length+" mapped location(s). Select a pin to review its records.";
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
  function makeLocationPopup(place){
    const popup=document.createElement("div");popup.className="registry-pin-popup";
    const heading=document.createElement("strong");heading.className="registry-pin-popup-title";heading.textContent=place.name;popup.append(heading);
    const strip=document.createElement("div");strip.className="registry-pin-popup-images";
    place.records.slice(0,2).forEach(record=>{
      const tile=document.createElement("div");tile.className="registry-pin-popup-image";
      if(record.file_path&&(record.mime_type||"").startsWith("image/")){
        const img=document.createElement("img");img.src=client.storage.from("family-archive").getPublicUrl(record.file_path).data.publicUrl;img.alt=record.title||"Associated family record";img.loading="lazy";tile.append(img);
      }else{const label=document.createElement("span");label.textContent=(record.category||"Record").slice(0,18);tile.append(label);}
      strip.append(tile);
    });
    if(place.records.length>2){const more=document.createElement("span");more.className="registry-pin-popup-more";more.textContent="+"+(place.records.length-2);strip.append(more);}
    popup.append(strip);return popup;
  }

  async function selectPlace(place,preserveMarkers=false){
    selected=place;const routeButton=document.getElementById("build-family-route");if(routeButton)routeButton.disabled=false;const sequence=++selectionSequence;renderList();detail.innerHTML='<p class="connection-status">Finding location on the map…</p>';
    try{
      initMap();
      const [lat,lng]=await coordinatesFor(place);
      if(sequence!==selectionSequence)return;
      if(!preserveMarkers)markerLayer.clearLayers();
      const pinIcon=L.divIcon({
        className:"registry-pin-icon",
        html:'<span class="registry-map-pin" aria-hidden="true"><span></span></span>',
        iconSize:[34,44],
        iconAnchor:[17,42],
        popupAnchor:[0,-40]
      });
      const marker=L.marker([lat,lng],{icon:pinIcon,zIndexOffset:2000,keyboard:true,title:place.name,alt:"Selected location: "+place.name})
        .addTo(markerLayer)
        .bindPopup(makeLocationPopup(place),{className:"registry-pin-popup-container",autoPan:false})
        .bindTooltip(escapeText(place.name),{permanent:true,direction:"top",offset:[0,-38],className:"registry-location-label"});
      // Fly from the current view to the newly selected place. Popup auto-pan is
      // disabled so opening the preview cannot interrupt the map's travel animation.
      map.stop();
      map.invalidateSize({pan:false,animate:false});
      map.flyTo([lat,lng],13,{animate:true,duration:1.65,easeLinearity:.18});
      marker.openPopup();
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
  async function buildMigrationRoute(){const output=document.getElementById("route-status");const button=document.getElementById("build-family-route");button.disabled=true;output.textContent="Geocoding places and ordering records…";try{initMap();if(!places.length)throw new Error("No saved locations yet. Add a location to at least two family records first.");const ordered=[...places].map(p=>({...p,firstYear:Math.min(...p.records.map(yearOf))})).sort((a,b)=>a.firstYear-b.firstYear);const plotted=[];for(const place of ordered){try{plotted.push({place,point:await coordinatesFor(place)});}catch(_){}}if(plotted.length<2)throw new Error("Add at least two specific locations with town and country details to build a route.");const coords=plotted.map(item=>item.point);markerLayer.clearLayers();const line=L.polyline(coords,{color:"#a32632",weight:4,opacity:.82,dashArray:"8 9"}).addTo(map);plotted.forEach((item,index)=>L.circleMarker(item.point,{radius:7,color:"#741923",fillColor:"#c34443",fillOpacity:1}).addTo(markerLayer).bindPopup("<strong>"+(index+1)+". "+escapeText(item.place.name)+"</strong>"));map.invalidateSize();map.flyToBounds(line.getBounds().pad(.18),{animate:true,duration:1.3,easeLinearity:.22});output.textContent="Journey plotted across "+plotted.length+" places, ordered by the earliest year found in their linked records."}catch(error){output.textContent=error.message;}finally{button.disabled=false;}}
  const routeButton=document.getElementById("build-family-route");if(routeButton){routeButton.disabled=false;routeButton.addEventListener("click",buildMigrationRoute);}

  async function loadRegistry(){
    count.textContent="Loading public family locations…";
    const {data,error}=await client.from("archive_records").select("id,title,category,description,location,persons_mentioned,file_path,file_name,mime_type,created_at").order("created_at",{ascending:false});
    if(error){count.textContent="Could not load records: "+error.message;list.textContent="Check that the location registry database update has been run.";return;}
    places=buildPlaces(data||[]);
    personIndex=buildPersonIndex(data||[]);
    const {data:portraitRows,error:portraitError}=await client.from("ancestor_portraits").select("name,portrait_url,portraits");
    portraitIndex=new Map();
    if(!portraitError)(portraitRows||[]).forEach(row=>{
      const key=normalize(row.name);
      const faces=Array.isArray(row.portraits)?row.portraits:[];
      const firstFace=faces.find(face=>face&&(face.url||face.portrait_url));
      const url=row.portrait_url||(firstFace&&(firstFace.url||firstFace.portrait_url));
      if(key&&url)portraitIndex.set(key,url);
    });
    renderPeople();
    count.textContent=places.length+" indexed places · "+(data||[]).length+" public record descriptions reviewed";
    renderList();initMap();
    const requested=new URLSearchParams(window.location.search).get("place");
    if(requested){const initial=places.find(p=>normalize(p.name)===normalize(requested));if(initial){search.value=requested;renderList();selectPlace(initial);}}
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
  if(personTrigger)personTrigger.addEventListener("click",()=>{
    const opening=personMenu.hidden;personMenu.hidden=!opening;personTrigger.setAttribute("aria-expanded",String(opening));
  });
  document.addEventListener("click",event=>{
    if(personMenu&&!personMenu.hidden&&!personMenu.contains(event.target)&&!personTrigger.contains(event.target)){
      personMenu.hidden=true;personTrigger.setAttribute("aria-expanded","false");
    }
  });
  start();
})();