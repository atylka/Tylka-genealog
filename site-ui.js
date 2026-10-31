(() => {
  const config=window.TYLKA_SUPABASE_CONFIG||{};
  if(!config.url||!config.anonKey||!window.supabase)return;
  const client=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});
  const ownerId="7a8cd586-c68f-4078-b61d-a87f3842b07e";
  const ownerButton=document.querySelector("[data-owner-sign-in]");let ownerModal=null;
  function ensureOwnerModal(){
    if(ownerModal)return ownerModal;
    ownerModal=document.createElement("section");ownerModal.className="site-modal";ownerModal.id="owner-sign-in-modal";ownerModal.hidden=true;ownerModal.setAttribute("role","dialog");ownerModal.setAttribute("aria-modal","true");ownerModal.innerHTML='<div class="modal-card owner-sign-in-card"><button class="modal-close" type="button" aria-label="Close sign in">×</button><p class="eyebrow">Private owner workspace</p><h2>Owner Sign In</h2><p class="connection-status" id="owner-auth-status">Sign in to add records and access owner tools. Browsing is open to everyone.</p><form id="owner-sign-in-form"><label for="owner-sign-in-email">Email address</label><input id="owner-sign-in-email" type="email" autocomplete="username" required><label for="owner-sign-in-password">Password</label><input id="owner-sign-in-password" type="password" autocomplete="current-password" required><button class="button button-dark" type="submit">Sign in</button><p id="owner-sign-in-message" class="form-message" role="status"></p></form><button id="owner-sign-out" class="small-button" type="button" hidden>Sign out</button></div>';
    document.body.append(ownerModal);const close=()=>ownerModal.hidden=true;ownerModal.querySelector(".modal-close").addEventListener("click",close);ownerModal.addEventListener("click",e=>{if(e.target===ownerModal)close();});
    ownerModal.querySelector("#owner-sign-in-form").addEventListener("submit",async e=>{e.preventDefault();const msg=ownerModal.querySelector("#owner-sign-in-message"),button=e.currentTarget.querySelector('button[type="submit"]');msg.textContent="Signing in…";button.disabled=true;try{const {data,error}=await client.auth.signInWithPassword({email:ownerModal.querySelector("#owner-sign-in-email").value.trim(),password:ownerModal.querySelector("#owner-sign-in-password").value});if(error)throw error;if(data.user?.id!==ownerId){await client.auth.signOut();throw new Error("This account does not have archive owner access.");}msg.textContent="Signed in successfully.";document.dispatchEvent(new CustomEvent("tylka:auth-changed"));setTimeout(()=>ownerModal.hidden=true,450);}catch(error){msg.textContent=error.message||"Sign in failed.";msg.classList.add("message-error");}finally{button.disabled=false;}});
    ownerModal.querySelector("#owner-sign-out").addEventListener("click",async()=>{const {error}=await client.auth.signOut();if(error)ownerModal.querySelector("#owner-sign-in-message").textContent=error.message;document.dispatchEvent(new CustomEvent("tylka:auth-changed"));});return ownerModal;
  }
  async function openOwnerSignIn(){const box=ensureOwnerModal(),form=box.querySelector("#owner-sign-in-form"),status=box.querySelector("#owner-auth-status"),out=box.querySelector("#owner-sign-out");box.hidden=false;const {data:{session}}=await client.auth.getSession();if(session?.user?.id===ownerId){status.textContent="You are signed in. Owner tools are available.";form.hidden=true;out.hidden=false;}else{status.textContent="Sign in to add records and access owner tools. Browsing is open to everyone.";form.hidden=false;out.hidden=true;}}
  if(ownerButton)ownerButton.addEventListener("click",openOwnerSignIn);document.addEventListener("tylka:open-owner-sign-in",openOwnerSignIn);
  client.auth.onAuthStateChange((_event,session)=>{document.dispatchEvent(new CustomEvent("tylka:auth-changed"));if(ownerModal){const form=ownerModal.querySelector("#owner-sign-in-form"),status=ownerModal.querySelector("#owner-auth-status"),out=ownerModal.querySelector("#owner-sign-out");if(session?.user){status.textContent="You are signed in. Owner tools are available.";form.hidden=true;out.hidden=false;}else{status.textContent="Sign in to add records and access owner tools.";form.hidden=false;out.hidden=true;}}});

  const tokenKey="tylka_access_request_tokens";
  const getTokens=()=>{try{return JSON.parse(localStorage.getItem(tokenKey)||"[]").filter(x=>x&&x.requestToken);}catch(_){return [];}};
  const saveTokens=tokens=>{try{localStorage.setItem(tokenKey,JSON.stringify(tokens.slice(-50)));}catch(_){}};
  const call=async body=>{const {data,error}=await client.functions.invoke("record-access",{body});if(error)throw new Error(error.message||"Mailbox could not be loaded.");if(data?.error)throw new Error(data.error);return data;};
  let modal=null;
  function ensureModal(){
    if(modal)return modal;
    modal=document.createElement("section");modal.className="site-modal";modal.id="site-mailbox-modal";modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.innerHTML='<div class="modal-card modal-wide"><button class="modal-close" type="button" aria-label="Close mailbox">×</button><p class="eyebrow">Your archive messages</p><h2>Mailbox</h2><div class="inbox-list" id="site-mailbox-list"><p class="empty-state">Loading messages…</p></div></div>';
    document.body.append(modal);modal.querySelector(".modal-close").addEventListener("click",()=>modal.hidden=true);modal.addEventListener("click",e=>{if(e.target===modal)modal.hidden=true;});return modal;
  }
  const addText=(parent,tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el;};
  async function openMailbox(){
    const box=ensureModal(),list=box.querySelector("#site-mailbox-list");box.hidden=false;list.replaceChildren();addText(list,"p","Loading messages…","empty-state");
    try{
      const {data:{session}}=await client.auth.getSession();
      list.replaceChildren();
      if(session?.user?.id===ownerId){
        const result=await call({action:"inbox"}),requests=result.requests||[];
        if(!requests.length){addText(list,"p","No access requests yet.","empty-state");return;}
        requests.forEach(req=>{
          const row=document.createElement("article");row.className="inbox-item";
          addText(row,"h3",req.archive_records?.title||"Archive attachment");
          addText(row,"p",req.visitor_name+" · "+new Date(req.created_at).toLocaleString());
          addText(row,"small",req.status,"record-category");
          if(req.status==="pending"){
            const controls=document.createElement("div");controls.className="record-actions";
            [["approved","Accept"],["denied","Deny"]].forEach(([decision,label])=>{const b=document.createElement("button");b.type="button";b.className="small-button";b.textContent=label;b.addEventListener("click",async()=>{b.disabled=true;try{await call({action:"decide",requestId:req.id,decision});await openMailbox();}catch(e){alert(e.message);b.disabled=false;}});controls.append(b);});
            row.append(controls);
          }
          list.append(row);
        });
      }else{
        const tokens=getTokens();
        if(!tokens.length){addText(list,"p","You haven't submitted any attachment requests on this device yet.","empty-state");return;}
        for(const saved of tokens){
          try{
            const result=await call({action:"status",requestToken:saved.requestToken});
            const row=document.createElement("article");row.className="inbox-item";
            addText(row,"h3",result.title||saved.title||"Attachment request");
            addText(row,"p",result.status==="approved"?"The owner approved your request.":result.status==="denied"?"The owner denied your request.":"Your request is awaiting the owner's decision.");
            addText(row,"small",result.status,"record-category");
            if(result.status==="approved"&&result.signedUrl){
              const link=document.createElement("a");link.href=result.signedUrl;link.target="_blank";link.rel="noopener";link.className="text-link";link.textContent="View approved attachment";row.append(link);
            }
            list.append(row);
          }catch(_){}
        }
        if(!list.children.length)addText(list,"p","No request updates are available yet. Try again later.","empty-state");
      }
    }catch(error){list.replaceChildren();addText(list,"p",error.message,"empty-state");}
  }
  document.addEventListener("tylka:open-mailbox",openMailbox);
  document.addEventListener("tylka:save-request",event=>{
    const tokens=getTokens();tokens.push(event.detail);saveTokens(tokens);
  });
  setInterval(async()=>{
    const tokens=getTokens();if(!tokens.length)return;
    for(const saved of tokens){try{await call({action:"status",requestToken:saved.requestToken});}catch(_){}}
  },15000);
})();