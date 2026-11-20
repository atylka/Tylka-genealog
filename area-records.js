(()=>{"use strict";
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),country=params.get("country")||"PL",area=params.get("area")||"",results=$("area-results"),surname=$("area-surname"),given=$("area-given"),year=$("area-year"),folderBar=document.querySelector(".area-folder-bar"),config=window.TYLKA_SUPABASE_CONFIG||{};
$("area-heading").textContent=area||"Area records";
$("area-country").textContent=country==="US"?"United States · State":"Poland · Małopolskie county";
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const canon=value=>{const key=String(value||"").toLowerCase().trim().replace(/[ &-]+/g,"_");const aliases={research_notes:"notes",sources:"notes",source_notes:"notes",family_photos:"photos",photographs:"photos",birth:"births",baptism:"births",burials:"deaths",death:"deaths",marriage:"marriages",naturalization:"immigration"};return aliases[key]||key;};
let records=[],activeFolder="all";
function locationMatches(r){const loc=norm(r.location),name=norm(area);return name.length>2&&(loc.includes(name)||loc.split(" ").includes(name));}
function peopleText(r){let p=r.persons_mentioned||"";if(Array.isArray(p))p=p.join(", ");else if(typeof p==="object"&&p!==null)p=Object.values(p).join(", ");return String(p||"").replace(/\s+/g," ").trim();}
function recordYear(r){const raw=String(r.record_date||r.registration_date||"");const m=raw.match(/(?:18|19|20)\d{2}/);return m?m[0]:"";}
function render(){
 const sur=norm(surname.value),giv=norm(given.value),yr=String(year.value||"").replace(/\D/g,"").slice(0,4);
 let list=records.filter(r=>{
  if(!locationMatches(r))return false;
  if(activeFolder!=="all"&&canon(r.category)!==activeFolder)return false;
  const people=norm(peopleText(r)),title=norm(r.title),all=people+" "+title;
  if(sur&&!all.split(" ").some(w=>w.startsWith(sur)))return false;
  if(giv&&!all.split(" ").some(w=>w.startsWith(giv)))return false;
  if(yr&&recordYear(r)!==yr)return false;
  return true;
 });
 list.sort((a,b)=>{const da=String(a.record_date||a.registration_date||"9999"),db=String(b.record_date||b.registration_date||"9999");return da.localeCompare(db);});
 $("area-summary").textContent=list.length.toLocaleString()+" matching records in "+area;
 results.replaceChildren();
 if(!list.length){const p=document.createElement("p");p.className="empty-state";p.textContent=records.length?"No records match these search criteria.":"No records have been added yet.";results.append(p);return;}
 const wrap=document.createElement("div");wrap.className="geneteka-results-wrap";
 const table=document.createElement("table");table.className="geneteka-results-table";
 const thead=document.createElement("thead"),head=document.createElement("tr");
 ["Date","Name / record","People mentioned","Location","Type","Source"].forEach(label=>{const th=document.createElement("th");th.scope="col";th.textContent=label;head.append(th);});thead.append(head);table.append(thead);
 const tbody=document.createElement("tbody");
 list.forEach(r=>{
  const tr=document.createElement("tr");tr.className="geneteka-record-row";tr.tabIndex=0;tr.setAttribute("role","link");
  const url="archive.html?record="+encodeURIComponent(r.id);
  const open=()=>location.href=url;
  tr.addEventListener("click",e=>{if(!e.target.closest("a"))open();});
  tr.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();open();}});
  const date=document.createElement("td");date.textContent=r.record_date||r.registration_date||"—";
  const title=document.createElement("td"),link=document.createElement("a");link.href=url;link.textContent=r.title||"Untitled record";title.append(link);
  const people=document.createElement("td");people.textContent=peopleText(r)||"—";
  const loc=document.createElement("td");loc.textContent=r.location||"—";
  const type=document.createElement("td");type.textContent=({births:"Births",deaths:"Deaths",marriages:"Marriages",immigration:"Immigration",photos:"Photographs",notes:"Sources"})[canon(r.category)]||r.category||"—";
  const source=document.createElement("td");source.textContent=r.source_reference||r.repository||r.collection_name||(r.file_path?"Attached scan":"—");
  tr.append(date,title,people,loc,type,source);tbody.append(tr);
 });
 table.append(tbody);wrap.append(table);results.append(wrap);
}
folderBar.addEventListener("click",e=>{const btn=e.target.closest("[data-folder]");if(!btn)return;activeFolder=btn.dataset.folder;folderBar.querySelectorAll("button").forEach(b=>{const active=b===btn;b.classList.toggle("is-active",active);b.setAttribute("aria-pressed",String(active));});render();});
[surname,given,year].forEach(input=>input.addEventListener("input",render));
async function load(){
 if(!config.url||!config.anonKey||!window.supabase){results.textContent="Archive connection unavailable.";return;}
 const client=window.tylkaSupabaseClient||(window.tylkaSupabaseClient=window.supabase.createClient(config.url,config.anonKey));
 for(let start=0;;start+=1000){const {data,error}=await client.from("archive_records").select("*").range(start,start+999);if(error){results.textContent="Unable to load records: "+error.message;return;}records.push(...(data||[]));if(!data||data.length<1000)break;}
 render();
}
load();
})();