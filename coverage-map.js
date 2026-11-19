(() => {
"use strict";
const $=id=>document.getElementById(id),country=$("coverage-country"),region=$("coverage-region"),canvas=$("coverage-map-canvas"),title=$("coverage-area-title"),count=$("coverage-area-count"),recordBox=$("coverage-area-records"),note=$("coverage-note"),activity=$("home-activity-list"),statsBody=$("coverage-stats-body"),statsTotal=$("coverage-stats-total"),statsHeading=$("coverage-stats-heading");
const config=window.TYLKA_SUPABASE_CONFIG||{},configured=config.url&&config.anonKey&&!config.url.includes("YOUR_")&&!config.anonKey.includes("YOUR_");
const POLAND_URL="https://raw.githubusercontent.com/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy/main/powiaty.json";
const US_URL="https://raw.githubusercontent.com/datasets/geo-admin1-us/main/data/admin1-us.geojson";
let map=null,layer=null,records=[],features=[],selectedFeature=null;
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value||"";if(cls)e.className=cls;return e;};
function loadLeaflet(){
 if(window.L)return Promise.resolve();
 if(window.__tylkaLeafletLoading)return window.__tylkaLeafletLoading;
 window.__tylkaLeafletLoading=new Promise((resolve,reject)=>{
  if(!document.querySelector('link[data-tylka-leaflet]')){const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";link.dataset.tylkaLeaflet="1";document.head.append(link);}
  const script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  script.onload=()=>window.L?resolve():reject(new Error("The map library did not initialize."));
  script.onerror=()=>{script.src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";script.onerror=()=>reject(new Error("The map library could not be downloaded."));script.onload=()=>window.L?resolve():reject(new Error("The map library did not initialize."));};
  document.head.append(script);
 });
 return window.__tylkaLeafletLoading;
}
function initMap(){if(map)return;if(!window.L)throw new Error("The interactive map library is unavailable.");map=window.L.map(canvas,{scrollWheelZoom:false,zoomControl:true,preferCanvas:true}).setView([49.8,20.1],7);layer=window.L.geoJSON(null,{style:styleFeature,onEachFeature}).addTo(map);}
function propValues(p){return Object.entries(p||{}).map(([k,v])=>[norm(k),String(v??"").trim()]).filter(x=>x[1]);}
function featureName(f){const p=f.properties||{};for(const key of ["name","NAME_2","NAME_1","powiat","nazwa","JPT_NAZWA_","name_2","county","state_name"]){if(p[key])return String(p[key]);}const vals=propValues(p).map(x=>x[1]);return vals.find(v=>/powiat/i.test(v))||vals[0]||"Unnamed area";}
function isMalopolskie(f){const vals=propValues(f.properties).map(x=>norm(x[1]));return vals.some(v=>v.includes("malopolskie"));}
function isUsFeature(f){const p=f.properties||{};return norm(p.country||"").includes("united states")||p["ISO3166-1-Alpha-3"]==="USA";}
function recordMatchesArea(r,f){const loc=norm(r.location);if(!loc)return false;const name=norm(featureName(f));const raw=String(featureName(f)||"").replace(/^powiat\s+/i,"");const bare=norm(raw);return (name.length>2&&loc.includes(name))||(bare.length>2&&loc.split(" ").includes(bare));}
function matching(f){return records.filter(r=>recordMatchesArea(r,f));}
function color(n,max){if(!n)return "#d0c8b8";const t=max? n/max:0;return t>.72?"#70202b":t>.42?"#963541":t>.18?"#bd6a62":"#d9a29a";}
function styleFeature(f){const n=matching(f).length,max=Math.max(1,...features.map(x=>matching(x).length));return{color:"#f5ead4",weight:1.25,opacity:1,fillColor:color(n,max),fillOpacity:n?0.9:0.72};}
function onEachFeature(f,l){l.on({mouseover:e=>e.target.setStyle({weight:2.5,color:"#4f2024",fillOpacity:1}),mouseout:e=>layer.resetStyle(e.target),click:()=>selectArea(f)});l.bindTooltip(featureName(f),{sticky:true,className:"coverage-tooltip"});}
function selectArea(f){selectedFeature=f;renderStats();const found=matching(f);title.textContent=featureName(f);count.textContent=found.length+" matching indexed record"+(found.length===1?"":"s");recordBox.replaceChildren();if(!found.length){recordBox.append(text("p","No records could be matched to this administrative-area name. Town-level locations may need a town-to-county match to be counted here."));return;}found.sort((a,b)=>String(a.record_date||"").localeCompare(String(b.record_date||"")));found.slice(0,12).forEach(r=>{const a=text("a",r.title||"Untitled record","coverage-record-link");a.href="archive.html?record="+encodeURIComponent(r.id);const meta=text("small",[r.record_date,r.location].filter(Boolean).join(" · "));const item=document.createElement("div");item.className="coverage-record-item";item.append(a,meta);recordBox.append(item);});if(found.length>12)recordBox.append(text("p","Showing 12 of "+found.length+" matching records."));}
function renderStats(){
 if(!statsBody)return;
 statsBody.replaceChildren();
 const rows=features.map(f=>({feature:f,name:featureName(f),count:matching(f).length})).sort((a,b)=>a.name.localeCompare(b.name));
 let total=0;
 rows.forEach(row=>{
  total+=row.count;
  const tr=document.createElement("tr");
  tr.className="coverage-stats-row"+(selectedFeature===row.feature?" is-selected":"");
  tr.tabIndex=0;tr.setAttribute("role","button");
  tr.setAttribute("aria-label",row.name+": "+row.count.toLocaleString()+" matching records");
  tr.append(text("td",row.name),text("td",row.count.toLocaleString()));
  const choose=()=>{selectArea(row.feature);const target=layer.getLayers().find(l=>l.feature===row.feature);if(target){map.fitBounds(target.getBounds(),{padding:[24,24],maxZoom:9});target.openTooltip();}};
  tr.addEventListener("click",choose);
  tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});
  statsBody.append(tr);
 });
 if(statsTotal)statsTotal.textContent=total.toLocaleString();
}
function fitFeatures(){if(!features.length)return;const bounds=layer.getBounds();if(bounds.isValid())map.fitBounds(bounds,{padding:[16,16],maxZoom:8});}
async function loadFeatures(){await loadLeaflet();initMap();canvas.querySelector(".coverage-loading")?.remove();if(country.value==="US"){note.textContent="United States state shading is based on saved location text that explicitly matches a state name.";region.disabled=true;region.hidden=true;$("coverage-region-label").hidden=true;const res=await fetch(US_URL);if(!res.ok)throw new Error("Could not load United States state boundaries.");const data=await res.json();features=data.features.filter(isUsFeature);}else{region.hidden=false;region.disabled=false;$("coverage-region-label").hidden=false;const res=await fetch(POLAND_URL);if(!res.ok)throw new Error("Could not load Polish county boundaries.");const data=await res.json();features=data.features.filter(isMalopolskie);note.textContent="Małopolskie powiat shading is based on saved location text matching an administrative-area name. Town-only locations are not automatically assigned to a county.";if(!features.length)throw new Error("The Małopolskie county features could not be identified in the boundary data.");}
layer.clearLayers();layer.addData({type:"FeatureCollection",features});layer.setStyle(styleFeature);map.invalidateSize();fitFeatures();if(statsHeading)statsHeading.textContent=country.value==="US"?"United States · States":"Małopolskie · Powiaty";renderStats();title.textContent=country.value==="US"?"Choose a state on the map":"Choose a county on the map";count.textContent="Select an area to inspect matching archive records.";recordBox.replaceChildren(text("p","Select a county or state to see matching records."));}
async function loadRecords(){if(!configured||!window.supabase){note.textContent="The archive connection is not configured; the map can show boundaries but not record coverage.";return;}const client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));records=[];for(let start=0;;start+=1000){const {data,error}=await client.from("archive_records").select("id,title,category,location,record_date,created_at").order("created_at",{ascending:false}).range(start,start+999);if(error)throw error;const batch=data||[];records.push(...batch);if(batch.length<1000)break;}if(activity){activity.replaceChildren();records.slice(0,5).forEach(r=>{const item=document.createElement("article");item.className="activity-log-item";item.append(text("strong",r.title||"Untitled record","activity-log-entry-title"),text("span",[(r.category||"Record"),r.created_at?new Date(r.created_at).toLocaleDateString():""].filter(Boolean).join(" · "),"activity-log-entry-meta"));activity.append(item);});if(!records.length)activity.append(text("p","No records have been added yet.","empty-state"));}}
async function refresh(){try{await loadFeatures();}catch(e){canvas.replaceChildren(text("p","The map could not be displayed: "+e.message,"coverage-loading"));console.error("Tylka coverage map:",e);}}
country.addEventListener("change",refresh);region.addEventListener("change",refresh);
(async()=>{try{await loadRecords();}catch(e){note.textContent="The archive records could not be loaded: "+e.message;}await refresh();})();
})();