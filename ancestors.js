(() => {
 const grid=document.getElementById("ancestor-grid"),empty=document.getElementById("ancestor-empty"),count=document.getElementById("ancestor-count");
 const esc=value=>String(value||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 function render(){
  let people=[];try{people=JSON.parse(localStorage.getItem("tylkaAncestorPortraits")||"[]");}catch(_){}
  people.sort((a,b)=>a.name.localeCompare(b.name));
  grid.replaceChildren();count.textContent=people.length+" "+(people.length===1?"person":"people");empty.hidden=people.length>0;
  people.forEach(person=>{
   const card=document.createElement("article");card.className="ancestor-card";
   const image=document.createElement("img");image.className="ancestor-portrait";image.src=person.portrait;image.alt="Portrait of "+person.name;
   const body=document.createElement("div");body.className="ancestor-card-body";
   const title=document.createElement("h3");title.textContent=person.name;
   const source=document.createElement("p");source.className="ancestor-source";source.textContent=person.sourceTitle?"Portrait source: "+person.sourceTitle:"Portrait source not recorded";
   const open=document.createElement("a");open.className="small-button";open.href="archive.html";open.textContent="Open Record Archive";
   body.append(title,source,open);card.append(image,body);grid.append(card);
  });
 }
 render();window.addEventListener("storage",event=>{if(event.key==="tylkaAncestorPortraits")render();});
})();