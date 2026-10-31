(() => {
  const config = window.TYLKA_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey &&
    !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_");
  const status = document.getElementById("connection-status");
  const loginPanel = document.getElementById("login-panel");
  const archivePanel = document.getElementById("private-archive");
  const loginForm = document.getElementById("login-form");
  const uploadForm = document.getElementById("upload-form");
  const signOut = document.getElementById("sign-out");
  const loginMessage = document.getElementById("login-message");
  const uploadMessage = document.getElementById("upload-message");
  const recordsList = document.getElementById("records-list");
  const categoryFilter = document.getElementById("record-filter");
  const recordSearch = document.getElementById("record-search");
  const categoryNames = {births:"Births & baptisms",deaths:"Deaths & burials",marriages:"Marriages & spouses",immigration:"Immigration & naturalization",photos:"Family photographs",notes:"Sources & research notes"};
  let client = null;
  let currentUser = null;
  let records = [];
  let activeFolder = "all";
  const canonicalCategory = value => {
    const key = String(value || "").toLowerCase().trim().replace(/[ &-]+/g, "_");
    const aliases = {research_notes:"notes",sources:"notes",source_notes:"notes",family_photos:"photos",photographs:"photos",birth:"births",baptism:"births",burials:"deaths",death:"deaths",marriage:"marriages",naturalization:"immigration"};
    return aliases[key] || key;
  };

  function message(node, text, error = false) {
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("message-error", error);
  }
  function setSignedIn(user) {
    currentUser = user;
    loginPanel.hidden = !!user;
    archivePanel.hidden = !user;
    status.textContent = user ? "Private archive unlocked" : "Sign in to access your private archive";
  }
  function safeText(tag, text, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text || "";
    return el;
  }
  function renderRecords() {
    recordsList.replaceChildren();
    const term = (recordSearch.value || "").trim().toLowerCase();
    const category = activeFolder;
    const filtered = records.filter(record =>
      (category === "all" || canonicalCategory(record.category) === category) &&
      [record.title, record.description, record.file_name, record.location].join(" ").toLowerCase().includes(term)
    );
    if (!filtered.length) {
      recordsList.append(safeText("p", records.length ? "No records match this search." : "Your archive is empty. Use Add a record to upload your first item.", "empty-state"));
      return;
    }
    filtered.forEach(record => {
      const card = document.createElement("article");
      card.className = "record-card";
      const details = document.createElement("div");
      details.append(safeText("span", categoryNames[record.category] || record.category, "record-category"));
      details.append(safeText("h3", record.title));
      if (record.location) {
        const locationLine = safeText("p", "Location: ", "record-location");
        const locationLink = safeText("a", record.location, "record-location-link");
        locationLink.href = "location-registry.html?place=" + encodeURIComponent(record.location);
        locationLine.append(locationLink); details.append(locationLine);
      }
      if (record.description) details.append(safeText("p", record.description));
      if (record.file_name) details.append(safeText("small", record.file_name, "record-filename"));
      details.append(safeText("small", new Date(record.created_at).toLocaleString(), "record-date"));
      card.append(details);
      const actions = document.createElement("div");
      actions.className = "record-actions";
      if (record.file_path && record.mime_type && record.mime_type.startsWith("image/")) {
        const preview = document.createElement("div"); preview.className = "record-preview";
        const image = document.createElement("img"); image.alt = "Preview of " + record.title; image.loading = "lazy";
        preview.append(image); card.append(preview);
        client.storage.from("family-archive").createSignedUrl(record.file_path, 300).then(({data}) => { if (data?.signedUrl) image.src = data.signedUrl; });
      }
      if (record.file_path) {
        const open = document.createElement("button");
        open.type = "button"; open.className = "small-button";
        open.textContent = "Open file";
        open.addEventListener("click", async () => {
          const {data, error} = await client.storage.from("family-archive").createSignedUrl(record.file_path, 60);
          if (error) return alert("Could not open this file: " + error.message);
          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        });
        actions.append(open);
      }
      const remove = document.createElement("button");
      remove.type = "button"; remove.className = "small-button danger-button"; remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Delete this archive record and its uploaded file? This cannot be undone.")) return;
        const {error: rowError} = await client.from("archive_records").delete().eq("id", record.id);
        if (rowError) return alert("Could not delete record: " + rowError.message);
        if (record.file_path) {
          const {error: fileError} = await client.storage.from("family-archive").remove([record.file_path]);
          if (fileError) alert("Record deleted, but its file could not be removed: " + fileError.message);
        }
        await loadRecords();
      });
      actions.append(remove); card.append(actions); recordsList.append(card);
    });
  }
  async function loadRecords() {
    recordsList.textContent = "Loading records…";
    const {data, error} = await client.from("archive_records").select("*").order("created_at", {ascending:false});
    if (error) {
      recordsList.textContent = "Could not load records: " + error.message;
      return;
    }
    records = data || [];
    renderRecords();
  }
  async function start() {
    if (!configured || !window.supabase) {
      status.textContent = "Setup required — connect Supabase to activate private uploads";
      message(loginMessage, "The archive interface is ready. To activate secure sign-in and uploads, follow the setup guide in SETUP.md.", true);
      return;
    }
    client = window.supabase.createClient(config.url, config.anonKey, {
      auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}
    });
    const {data:{session}} = await client.auth.getSession();
    setSignedIn(session?.user || null);
    if (session?.user) await loadRecords();
    client.auth.onAuthStateChange((_event, sessionNow) => {
      setSignedIn(sessionNow?.user || null);
      if (sessionNow?.user) loadRecords();
      else { records=[]; recordsList.replaceChildren(); }
    });
  }
  if (loginForm) loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!client) return message(loginMessage, "Supabase is not configured yet. Follow SETUP.md.", true);
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    message(loginMessage, "Signing in…");
    const {error} = await client.auth.signInWithPassword({email,password});
    message(loginMessage, error ? error.message : "Signed in. Loading your archive…", !!error);
  });
  if (signOut) signOut.addEventListener("click", async () => { if (client) await client.auth.signOut(); });
  if (uploadForm) uploadForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!client || !currentUser) return message(uploadMessage, "Sign in to upload records.", true);
    const title = document.getElementById("record-title").value.trim();
    const category = document.getElementById("record-category").value;
    const description = document.getElementById("record-description").value.trim();
    const location = document.getElementById("record-location").value.trim();
    const file = document.getElementById("record-file").files[0];
    if (!title) return message(uploadMessage, "Please enter a record title.", true);
    if (file && file.size > 20 * 1024 * 1024) return message(uploadMessage, "Files must be 20 MB or smaller.", true);
    if (file && !["image/jpeg","image/png","image/webp","image/tiff","application/pdf"].includes(file.type)) return message(uploadMessage, "Allowed files: JPG, PNG, WEBP, TIFF, or PDF.", true);
    const submit = uploadForm.querySelector('button[type="submit"]');
    submit.disabled = true; message(uploadMessage, "Saving record…");
    let filePath = null;
    try {
      if (file) {
        const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100);
        filePath = currentUser.id + "/" + category + "/" + crypto.randomUUID() + "-" + safeName;
        const {error: storageError} = await client.storage.from("family-archive").upload(filePath, file, {contentType:file.type, upsert:false});
        if (storageError) throw storageError;
      }
      const {error: insertError} = await client.from("archive_records").insert({
        owner_id:currentUser.id,created_by:(currentUser.user_metadata?.full_name||currentUser.user_metadata?.name||currentUser.email||"Archive owner"),title,category,description,location,file_path:filePath,
        file_name:file?.name || null,mime_type:file?.type || null,file_size:file?.size || null
      });
      if (insertError) {
        if (filePath) await client.storage.from("family-archive").remove([filePath]);
        throw insertError;
      }
      uploadForm.reset(); message(uploadMessage, "Record saved to your private archive.");
      await loadRecords();
    } catch (error) {
      message(uploadMessage, error.message || "Upload failed.", true);
    } finally { submit.disabled = false; }
  });
  const folderContainer = document.querySelector(".archive-folders");
  if (folderContainer) folderContainer.addEventListener("click", event => {
    const button = event.target.closest(".archive-folder");
    if (!button || !folderContainer.contains(button)) return;
    activeFolder = canonicalCategory(button.dataset.folder || "all");
    folderContainer.querySelectorAll(".archive-folder").forEach(item => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    const heading = document.getElementById("folder-heading");
    if (heading) heading.textContent = button.textContent.trim();
    if (recordSearch) recordSearch.value = "";
    renderRecords();
  });
  if (categoryFilter) categoryFilter.addEventListener("change", renderRecords);
  if (recordSearch) recordSearch.addEventListener("input", renderRecords);
  if (document.body.dataset.page === "upload") {
    const heading = document.querySelector(".records-heading"), listing = document.getElementById("records-list");
    if (heading) heading.hidden = true; if (listing) listing.hidden = true;
  }
  start();
})();