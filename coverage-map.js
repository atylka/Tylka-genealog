(() => {
"use strict";
const $=id=>document.getElementById(id),country=$("coverage-country"),region=$("coverage-region"),canvas=$("coverage-map-canvas"),title=$("coverage-area-title"),count=$("coverage-area-count"),recordBox=$("coverage-area-records"),note=$("coverage-note"),activity=$("home-activity-list"),statsBody=$("coverage-stats-body"),statsTotal=$("coverage-stats-total"),statsHeading=$("coverage-stats-heading");
const config=window.TYLKA_SUPABASE_CONFIG||{},configured=config.url&&config.anonKey&&!config.url.includes("YOUR_")&&!config.anonKey.includes("YOUR_");
const POLAND_URL="https://raw.githubusercontent.com/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy/main/powiaty.json";
const US_URL="https://raw.githubusercontent.com/datasets/geo-admin1-us/main/data/admin1-us.geojson";
let records=[],features=[],selectedFeature=null,mapSvg=null,areaPaths=new Map();
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value||"";if(cls)e.className=cls;return e;};
function propValues(p){return Object.entries(p||{}).map(([k,v])=>[norm(k),String(v??"").trim()]).filter(x=>x[1]);}
function featureName(f){const p=f.properties||{};for(const key of ["JPT_NAZWA_","name","NAME_2","NAME_1","powiat","nazwa","name_2","county","state_name"]){if(p[key])return String(p[key]);}const vals=propValues(p).map(x=>x[1]);return vals.find(v=>/powiat/i.test(v))||vals[0]||"Unnamed area";}
function isMalopolskie(f){const p=f.properties||{};const code=String(p.JPT_KOD_JE||p.TERYT||p.terc||"");if(/^12\\d{3,5}$/.test(code))return true;const vals=propValues(p).map(x=>norm(x[1]));return vals.some(v=>v==="malopolskie"||v.includes("wojewodztwo malopolskie"));}
function isUsFeature(f){const p=f.properties||{};return norm(p.country||"").includes("united states")||p["ISO3166-1-Alpha-3"]==="USA";}
function recordMatchesArea(r,f){const loc=norm(r.location);if(!loc)return false;const name=norm(featureName(f));const raw=String(featureName(f)||"").replace(/^powiat\s+/i,"");const bare=norm(raw);return (name.length>2&&loc.includes(name))||(bare.length>2&&loc.split(" ").includes(bare));}
function matching(f){return records.filter(r=>recordMatchesArea(r,f));}
function color(n,max){if(!n)return "#d0c8b8";const t=max? n/max:0;return t>.72?"#70202b":t>.42?"#963541":t>.18?"#bd6a62":"#d9a29a";}
function styleFeature(f){const n=matching(f).length,max=Math.max(1,...features.map(x=>matching(x).length));return{color:"#f5ead4",weight:1.25,opacity:1,fillColor:color(n,max),fillOpacity:n?0.9:0.72};}
function geometryRings(g){
 if(!g)return [];
 if(g.type==="Polygon")return g.coordinates||[];
 if(g.type==="MultiPolygon")return (g.coordinates||[]).flat();
 return [];
}
function projectFeatures(){
 const points=[];
 features.forEach(f=>geometryRings(f.geometry).forEach(r=>r.forEach(pt=>points.push(pt))));
 if(!points.length)throw new Error("No drawable map boundaries were found.");
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const w=820,h=570,pad=18,scale=Math.min((w-pad*2)/(maxX-minX||1),(h-pad*2)/(maxY-minY||1));
 const usedW=(maxX-minX)*scale,usedH=(maxY-minY)*scale,offX=(w-usedW)/2,offY=(h-usedH)/2;
 const xy=pt=>[offX+(pt[0]-minX)*scale,h-offY-(pt[1]-minY)*scale];
 return {w,h,path(f){return geometryRings(f.geometry).map(r=>r.map((pt,i)=>{const q=xy(pt);return (i?"L":"M")+q[0].toFixed(2)+","+q[1].toFixed(2);}).join(" ")+" Z").join(" ");}};
}
function drawMap(){
 const projection=projectFeatures();areaPaths.clear();
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
 svg.setAttribute("viewBox",`0 0 ${projection.w} ${projection.h}`);svg.setAttribute("role","group");svg.setAttribute("aria-label",country.value==="US"?"Clickable map of United States states":"Clickable map of Małopolskie counties");
 svg.classList.add("coverage-vector-map");
 features.forEach(f=>{
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d",projection.path(f));path.setAttribute("class","coverage-map-area");path.setAttribute("fill",color(matching(f).length,Math.max(1,...features.map(x=>matching(x).length))));
  path.setAttribute("tabindex","0");path.setAttribute("role","button");path.setAttribute("aria-label",featureName(f)+", "+matching(f).length+" indexed records");
  const tip=document.createElementNS("http://www.w3.org/2000/svg","title");tip.textContent=featureName(f)+" · "+matching(f).length+" records";path.append(tip);
  path.addEventListener("click",()=>selectArea(f));
  path.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectArea(f);}});
  path.addEventListener("pointerenter",()=>path.classList.add("is-hovered"));
  path.addEventListener("pointerleave",()=>path.classList.remove("is-hovered"));
  areaPaths.set(f,path);svg.append(path);
 });
 mapSvg=svg;canvas.replaceChildren(svg);
}
function refreshMapStyles(){
 const max=Math.max(1,...features.map(f=>matching(f).length));
 features.forEach(f=>{const p=areaPaths.get(f);if(!p)return;p.setAttribute("fill",color(matching(f).length,max));p.classList.toggle("is-selected",selectedFeature===f);p.setAttribute("aria-pressed",selectedFeature===f?"true":"false");});
}

function selectArea(f){if(!matching(f).length)return;selectedFeature=f;refreshMapStyles();renderStats();const found=matching(f);title.textContent=featureName(f);count.textContent=found.length+" matching indexed record"+(found.length===1?"":"s");recordBox.replaceChildren();if(!found.length){recordBox.append(text("p","No records could be matched to this administrative-area name. Town-level locations may need a town-to-county match to be counted here."));return;}found.sort((a,b)=>String(a.record_date||"").localeCompare(String(b.record_date||"")));found.slice(0,12).forEach(r=>{const a=text("a",r.title||"Untitled record","coverage-record-link");a.href="archive.html?record="+encodeURIComponent(r.id);const meta=text("small",[r.record_date,r.location].filter(Boolean).join(" · "));const item=document.createElement("div");item.className="coverage-record-item";item.append(a,meta);recordBox.append(item);});if(found.length>12)recordBox.append(text("p","Showing 12 of "+found.length+" matching records."));}
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
  const choose=()=>{selectArea(row.feature);const target=areaPaths.get(row.feature);if(target){target.focus();}};
  tr.addEventListener("click",choose);
  tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});
  statsBody.append(tr);
 });
 if(statsTotal)statsTotal.textContent=total.toLocaleString();
}
function fitFeatures(){drawMap();}
async function loadFeatures(){if(country.value==="US"){note.textContent="Each state is a separate map shape. States stay grey and unavailable until at least one saved record is explicitly associated with that state.";region.disabled=true;region.hidden=true;$("coverage-region-label").hidden=true;const res=await fetch(US_URL);if(!res.ok)throw new Error("Could not load United States state boundaries.");const data=await res.json();features=data.features.filter(isUsFeature);}else{region.hidden=false;region.disabled=false;$("coverage-region-label").hidden=false;const res=await fetch(POLAND_URL);if(!res.ok)throw new Error("Could not load Polish county boundaries.");const data=await res.json();features=data.features.filter(isMalopolskie);note.textContent="Each powiat is a separate map shape. Areas stay grey and unavailable until at least one saved record is explicitly associated with that powiat.";if(!features.length)throw new Error("The Małopolskie county features could not be identified in the boundary data.");}
fitFeatures();if(statsHeading)statsHeading.textContent=country.value==="US"?"United States · States":"Małopolskie · Powiaty";renderStats();title.textContent=country.value==="US"?"Choose a state on the map":"Choose a county on the map";count.textContent="Select an area to inspect matching archive records.";recordBox.replaceChildren(text("p","Select a county or state to see matching records."));}
async function loadRecords(){if(!configured||!window.supabase){note.textContent="The archive connection is not configured; the map can show boundaries but not record coverage.";return;}const client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));records=[];for(let start=0;;start+=1000){const {data,error}=await client.from("archive_records").select("id,title,category,location,record_date,created_at").order("created_at",{ascending:false}).range(start,start+999);if(error)throw error;const batch=data||[];records.push(...batch);if(batch.length<1000)break;}if(activity){activity.replaceChildren();records.slice(0,5).forEach(r=>{const item=document.createElement("article");item.className="activity-log-item";item.append(text("strong",r.title||"Untitled record","activity-log-entry-title"),text("span",[(r.category||"Record"),r.created_at?new Date(r.created_at).toLocaleDateString():""].filter(Boolean).join(" · "),"activity-log-entry-meta"));activity.append(item);});if(!records.length)activity.append(text("p","No records have been added yet.","empty-state"));}}
async function refresh(){try{await loadFeatures();}catch(e){canvas.replaceChildren(text("p","The map could not be displayed: "+e.message,"coverage-loading"));console.error("Tylka coverage map:",e);}}
country.addEventListener("change",refresh);region.addEventListener("change",refresh);
(async()=>{try{await loadRecords();}catch(e){note.textContent="The archive records could not be loaded: "+e.message;}await refresh();})();
})();