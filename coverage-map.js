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
function rawFeatureName(f){const p=f.properties||{};for(const key of ["JPT_NAZWA_","name","NAME_2","NAME_1","powiat","nazwa","name_2","county","state_name"]){if(p[key])return String(p[key]);}const vals=propValues(p).map(x=>x[1]);return vals.find(v=>/powiat/i.test(v))||vals[0]||"Unnamed area";}
const POLISH_DISTRICT_NAMES={"1201":"Bochnia","1202":"Brzesko","1203":"Chrzanów","1204":"Dąbrowa","1205":"Gorlice","1206":"Krakowski","1207":"Limanowa","1208":"Miechów","1209":"Myślenice","1210":"Nowy Sądecki","1211":"Nowy Targ","1212":"Olkusz","1213":"Oświęcim","1214":"Proszowice","1215":"Sucha Beskidzka","1216":"Tarnowski","1217":"Tatrzański","1218":"Wadowice","1219":"Wieliczka","1261":"Kraków (city)","1262":"Nowy Sącz (city)","1263":"Tarnów (city)"};
function featureName(f){if(country.value!=="US"){const code=String(f.properties?.JPT_KOD_JE||"");if(POLISH_DISTRICT_NAMES[code])return POLISH_DISTRICT_NAMES[code];}return rawFeatureName(f).replace(/^powiat\\s+/i,"").replace(/^miasto na prawach powiatu\\s*/i,"");}
function isMalopolskie(f){const p=f.properties||{};const code=String(p.JPT_KOD_JE||p.TERYT||p.terc||"");if(/^12\d{2}$/.test(code))return true;const vals=propValues(p).map(x=>norm(x[1]));return vals.some(v=>v==="malopolskie"||v.includes("wojewodztwo malopolskie"));}
function isUsFeature(f){const p=f.properties||{};return norm(p.country||"").includes("united states")||p["ISO3166-1-Alpha-3"]==="USA";}
function recordMatchesArea(r,f){const loc=norm(r.location);if(!loc)return false;const display=norm(featureName(f));const source=norm(rawFeatureName(f).replace(/^powiat\\s+/i,"").replace(/^miasto na prawach powiatu\\s*/i,""));const code=String(f.properties?.JPT_KOD_JE||"");const english=norm(POLISH_DISTRICT_NAMES[code]||"");return [display,source,english].some(name=>name.length>2&&(loc.includes(name)||loc.split(" ").includes(name)));}
function matching(f){return records.filter(r=>recordMatchesArea(r,f));}
function color(n,max){if(!n)return "#d0c8b8";const step=Math.floor((n-1)/5);const shades=["#d9a29a","#c9827b","#bd6a62","#ad5552","#963541","#842a37","#70202b","#5e1725"];return shades[Math.min(step,shades.length-1)];}
function styleFeature(f){const n=matching(f).length,max=Math.max(1,...features.map(x=>matching(x).length));return{color:"#f5ead4",weight:1.25,opacity:1,fillColor:color(n,max),fillOpacity:n?0.9:0.72};}
function geometryRings(g){
 if(!g)return [];
 if(g.type==="Polygon")return g.coordinates||[];
 if(g.type==="MultiPolygon")return (g.coordinates||[]).flat();
 return [];
}
function stateCode(f){
 const p=f.properties||{},raw=String(p.state_code||p.postal||p.abbr||p["postal-code"]||p.STUSPS||p.usps||"").toUpperCase();
 if(/^[A-Z]{2}$/.test(raw))return raw;
 const name=norm(p.name||p.NAME_1||p.state_name||rawFeatureName(f));
 const codes={alabama:"AL",alaska:"AK",arizona:"AZ",arkansas:"AR",california:"CA",colorado:"CO",connecticut:"CT",delaware:"DE",florida:"FL",georgia:"GA",hawaii:"HI",idaho:"ID",illinois:"IL",indiana:"IN",iowa:"IA",kansas:"KS",kentucky:"KY",louisiana:"LA",maine:"ME",maryland:"MD",massachusetts:"MA",michigan:"MI",minnesota:"MN",mississippi:"MS",missouri:"MO",montana:"MT",nebraska:"NE",nevada:"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND",ohio:"OH",oklahoma:"OK",oregon:"OR",pennsylvania:"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD",tennessee:"TN",texas:"TX",utah:"UT",vermont:"VT",virginia:"VA",washington:"WA","west virginia":"WV",wisconsin:"WI",wyoming:"WY","district of columbia":"DC"};
 return codes[name]||"";
}
function projectFeatures(){
 const pointsFor=list=>{const pts=[];list.forEach(f=>geometryRings(f.geometry).forEach(r=>r.forEach(pt=>pts.push(pt))));return pts;};
 const all=pointsFor(features);if(!all.length)throw new Error("No drawable map boundaries were found.");
 const isUS=country.value==="US",code=f=>stateCode(f),ak=features.filter(f=>code(f)==="AK"),hi=features.filter(f=>code(f)==="HI"),main=isUS?features.filter(f=>!["AK","HI"].includes(code(f))):features;
 const meanLat=all.reduce((s,p)=>s+p[1],0)/all.length,projectRaw=pt=>[pt[0]*Math.cos(meanLat*Math.PI/180),pt[1]];
 function transform(list,x,y,w,h){
  const pts=pointsFor(list).map(projectRaw);if(!pts.length)return pt=>[x+w/2,y+h/2];
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),ex=maxX-minX||1,ey=maxY-minY||1,pad=9,scale=Math.min((w-pad*2)/ex,(h-pad*2)/ey),dw=ex*scale,dh=ey*scale,ox=x+(w-dw)/2,oy=y+(h-dh)/2;
  return pt=>{const q=projectRaw(pt);return[ox+(q[0]-minX)*scale,y+oy-y+dh-(q[1]-minY)*scale];};
 }
 const transforms=new Map();
 if(isUS){
  const continental=transform(main,0,0,1000,550);main.forEach(f=>transforms.set(f,continental));
  const alaska=transform(ak,29,579,205,116),hawaii=transform(hi,269,579,155,116);
  ak.forEach(f=>transforms.set(f,alaska));hi.forEach(f=>transforms.set(f,hawaii));
 }else{const whole=transform(features,0,0,1000,720);features.forEach(f=>transforms.set(f,whole));}
 const xy=(f,p)=>transforms.get(f)(p);
 function ringPath(f,r){return r.map((p,i)=>{const q=xy(f,p);return(i?"L":"M")+q[0].toFixed(2)+","+q[1].toFixed(2);}).join(" ")+" Z";}
 function area(r){let v=0;for(let i=0,j=r.length-1;i<r.length;j=i++)v+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return Math.abs(v/2);}
 function centroid(r){let a=0,cx=0,cy=0;for(let i=0,j=r.length-1;i<r.length;j=i++){const c=r[j][0]*r[i][1]-r[i][0]*r[j][1];a+=c;cx+=(r[j][0]+r[i][0])*c;cy+=(r[j][1]+r[i][1])*c;}if(Math.abs(a)<1e-10)return r.reduce((v,p)=>[v[0]+p[0]/r.length,v[1]+p[1]/r.length],[0,0]);return[cx/(3*a),cy/(3*a)];}
 return{w:1000,h:720,path(f){return geometryRings(f.geometry).map(r=>ringPath(f,r)).join(" ");},labelPoint(f){const rings=geometryRings(f.geometry),outer=rings.slice().sort((a,b)=>area(b)-area(a))[0];return outer?xy(f,centroid(outer)):null;},labelSize(f){const rings=geometryRings(f.geometry),outer=rings.slice().sort((a,b)=>area(b)-area(a))[0];if(!outer)return 10;const px=outer.map(p=>xy(f,p)[0]),py=outer.map(p=>xy(f,p)[1]);return Math.max(8,Math.min(isUS?15:12,Math.min(Math.max(...px)-Math.min(...px),Math.max(...py)-Math.min(...py))*.24));}};
}
function mapLabel(f){
 const p=f.properties||{};
 if(country.value==="US"){
  const code=p.state_code||p.postal||p.abbr||p["postal-code"];
  return code?String(code):featureName(f).slice(0,3).toUpperCase();
 }
 return featureName(f);
}
function drawMap(){
 const projection=projectFeatures();areaPaths.clear();
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
 svg.setAttribute("viewBox",`0 0 ${projection.w} ${projection.h}`);
 svg.setAttribute("role","group");
 svg.setAttribute("aria-label",country.value==="US"?"Clickable map of United States states":"Clickable map of Małopolskie counties");
 svg.classList.add("coverage-vector-map");
 const max=Math.max(1,...features.map(f=>matching(f).length));
 features.forEach(f=>{
  const n=matching(f).length,enabled=n>0;
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d",projection.path(f));
  path.setAttribute("fill-rule","evenodd");
  path.setAttribute("class","coverage-map-area"+(enabled?"":" is-empty"));
  path.setAttribute("fill",color(n,max));
  path.setAttribute("tabindex",enabled?"0":"-1");
  path.setAttribute("role",enabled?"button":"img");
  path.setAttribute("aria-disabled",enabled?"false":"true");
  path.setAttribute("aria-label",featureName(f)+", "+n+" indexed records"+(enabled?"":"; unavailable until records are added"));
  const tip=document.createElementNS("http://www.w3.org/2000/svg","title");
  tip.textContent=featureName(f)+" · "+n+" records";path.append(tip);
  if(enabled){
   path.addEventListener("click",()=>selectArea(f));
   path.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectArea(f);}});
   path.addEventListener("pointerenter",()=>path.classList.add("is-hovered"));
   path.addEventListener("pointerleave",()=>path.classList.remove("is-hovered"));
  }
  areaPaths.set(f,path);svg.append(path);
 });
 features.forEach(f=>{
  const pt=projection.labelPoint(f);if(!pt)return;
  const label=document.createElementNS("http://www.w3.org/2000/svg","text");
  label.setAttribute("x",pt[0].toFixed(2));label.setAttribute("y",pt[1].toFixed(2));
  label.setAttribute("class","coverage-map-label");label.setAttribute("pointer-events","none");
  label.setAttribute("font-size",projection.labelSize(f).toFixed(1));
  label.setAttribute("text-anchor","middle");label.setAttribute("dominant-baseline","central");
  label.textContent=mapLabel(f);label.setAttribute("aria-hidden","true");
  svg.append(label);
 });
 if(country.value==="US"){
  [["Alaska",20,565,225,145],["Hawaii",255,565,185,145]].forEach(([name,x,y,w,h])=>{
   const frame=document.createElementNS("http://www.w3.org/2000/svg","rect");
   frame.setAttribute("x",x);frame.setAttribute("y",y);frame.setAttribute("width",w);frame.setAttribute("height",h);frame.setAttribute("rx","3");frame.setAttribute("class","coverage-map-inset-frame");svg.append(frame);
   const caption=document.createElementNS("http://www.w3.org/2000/svg","text");caption.setAttribute("x",x+w/2);caption.setAttribute("y",y+14);caption.setAttribute("class","coverage-map-inset-title");caption.setAttribute("text-anchor","middle");caption.textContent=name;svg.append(caption);
  });
 }
 mapSvg=svg;canvas.replaceChildren(svg);
}
function refreshMapStyles(){
 const max=Math.max(1,...features.map(f=>matching(f).length));
 features.forEach(f=>{
  const p=areaPaths.get(f);if(!p)return;
  const n=matching(f).length,enabled=n>0;
  p.setAttribute("fill",color(n,max));
  p.classList.toggle("is-selected",selectedFeature===f);
  p.classList.toggle("is-empty",!enabled);
  p.setAttribute("tabindex",enabled?"0":"-1");
  p.setAttribute("role",enabled?"button":"img");
  p.setAttribute("aria-disabled",enabled?"false":"true");
  p.setAttribute("aria-pressed",selectedFeature===f?"true":"false");
 });
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
  tr.className="coverage-stats-row"+(selectedFeature===row.feature?" is-selected":"")+(row.count?"":" is-empty");
  tr.tabIndex=row.count?0:-1;tr.setAttribute("role",row.count?"button":"row");
  tr.setAttribute("aria-label",row.name+": "+row.count.toLocaleString()+" matching records"+(row.count?"":"; unavailable until records are added"));
  tr.append(text("td",row.name),text("td",row.count.toLocaleString()));
  const choose=()=>{if(!row.count)return;selectArea(row.feature);const target=areaPaths.get(row.feature);if(target)target.focus();};
  if(row.count){tr.addEventListener("click",choose);tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});}
  statsBody.append(tr);
 });
 if(statsTotal)statsTotal.textContent=total.toLocaleString();
}
function fitFeatures(){drawMap();}
async function loadFeatures(){if(country.value==="US"){note.textContent="Each state is a separate map shape. States stay grey and unavailable until at least one saved record is explicitly associated with that state.";region.disabled=true;region.hidden=true;$("coverage-region-label").hidden=true;const res=await fetch(US_URL);if(!res.ok)throw new Error("Could not load United States state boundaries.");const data=await res.json();features=data.features.filter(isUsFeature);}else{region.hidden=false;region.disabled=false;$("coverage-region-label").hidden=false;const res=await fetch(POLAND_URL);if(!res.ok)throw new Error("Could not load Polish county boundaries.");const data=await res.json();features=data.features.filter(isMalopolskie);note.textContent="Each county or city district is a separate map shape. Areas stay grey and unavailable until at least one saved record is associated with them.";if(!features.length)throw new Error("The Małopolskie county features could not be identified in the boundary data.");}
fitFeatures();if(statsHeading)statsHeading.textContent=country.value==="US"?"United States · States":"Małopolskie · Counties";renderStats();title.textContent=country.value==="US"?"Choose a state on the map":"Choose a county on the map";count.textContent="Select an area to inspect matching archive records.";recordBox.replaceChildren(text("p","Select a county or state to see matching records."));}
async function loadRecords(){if(!configured||!window.supabase){note.textContent="The archive connection is not configured; the map can show boundaries but not record coverage.";return;}const client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));records=[];for(let start=0;;start+=1000){const {data,error}=await client.from("archive_records").select("id,title,category,location,record_date,created_at").order("created_at",{ascending:false}).range(start,start+999);if(error)throw error;const batch=data||[];records.push(...batch);if(batch.length<1000)break;}if(activity){activity.replaceChildren();records.slice(0,5).forEach(r=>{const item=document.createElement("article");item.className="activity-log-item";item.append(text("strong",r.title||"Untitled record","activity-log-entry-title"),text("span",[(r.category||"Record"),r.created_at?new Date(r.created_at).toLocaleDateString():""].filter(Boolean).join(" · "),"activity-log-entry-meta"));activity.append(item);});if(!records.length)activity.append(text("p","No records have been added yet.","empty-state"));}}
async function refresh(){try{await loadFeatures();}catch(e){canvas.replaceChildren(text("p","The map could not be displayed: "+e.message,"coverage-loading"));console.error("Tylka coverage map:",e);}}
country.addEventListener("change",refresh);region.addEventListener("change",refresh);
(async()=>{try{await loadRecords();}catch(e){note.textContent="The archive records could not be loaded: "+e.message;}await refresh();})();
})();