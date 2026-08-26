
// ============================================================
// Firebase (compat SDK — classic scripts, works with the existing
// inline onclick="..." handlers throughout index.html)
// ============================================================
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const channelsCol = db.collection("channels");
const serialsCol = db.collection("serials");
const episodesCol = db.collection("episodes");

// Seed data used only once, the very first time the database is empty.
const defaultData = {
  channels: [
    {
      name: "Star Jalsha",
      image: "assets/star-jalsha.jpg",
      serials: [
        {name:"Tilottama",image:"https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800",episodes:[
          {number:14,title:"Tomosha Fakes an Illness",date:"2026-08-09",duration:"23m",image:"https://images.unsplash.com/photo-1485846234645-a62644f84728?w=700",video:""},
          {number:13,title:"Pritha Doubts Tomosha",date:"2026-08-08",duration:"23m",image:"https://images.unsplash.com/photo-1517841905240-472988babdf9?w=700",video:""},
          {number:12,title:"The Truth Comes Out",date:"2026-08-07",duration:"23m",image:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=700",video:""}
        ]},
        {name:"Jalsha Silver Screen",image:"https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800",episodes:[]},
        {name:"Kumkum Bhagya",image:"https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800",episodes:[]},
        {name:"Barali Sundari",image:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800",episodes:[]},
        {name:"Dhroni",image:"https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",episodes:[]},
        {name:"Sansarer Sangkirtan",image:"https://images.unsplash.com/photo-1507502707541-f369a3b18502?w=800",episodes:[]}
      ]
    },
    {
      name: "Zee Bangla",
      image: "assets/zee-bangla.jpg",
      serials: [
        {name:"Zee Bangla Serial 1",image:"https://images.unsplash.com/photo-1516321165247-4aa89a48be28?w=800",episodes:[]},
        {name:"Zee Bangla Serial 2",image:"https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800",episodes:[]},
        {name:"Zee Bangla Serial 3",image:"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800",episodes:[]},
        {name:"Zee Bangla Serial 4",image:"https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",episodes:[]},
        {name:"Zee Bangla Serial 5",image:"https://images.unsplash.com/photo-1500534623283-312aade485b7?w=800",episodes:[]},
        {name:"Zee Bangla Serial 6",image:"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800",episodes:[]}
      ]
    }
  ]
};

// Local mirrors of the three Firestore collections, kept live by onSnapshot.
let rawChannels = [];
let rawSerials = [];
let rawEpisodes = [];

// Nested view rebuilt from the raw collections — same shape the render
// functions always expected (state.channels[].serials[].episodes[]).
let state = { channels: [] };

let channelEdit = false;
let serialEdit = false;
let episodeEdit = false;

let currentChannelId = null;
let currentSerialId = null;
let editingChannelId = null;
let editingSerialId = null;
let editingEpisodeId = null;

// ============================================================
// Password gate + anonymous auth
// ============================================================
const LOCK_KEY = "liveTvUnlocked";

async function sha256Hex(text){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function tryUnlock(pw){
  const errEl = document.getElementById("lockError");
  errEl.textContent = "";
  if(!pw){ errEl.textContent = "Enter the password."; return; }
  let hash;
  try{
    hash = await sha256Hex(pw);
  }catch(e){
    errEl.textContent = "This browser can't verify the password here (needs https or localhost).";
    return;
  }
  if(hash === SITE_PASSWORD_HASH){
    localStorage.setItem(LOCK_KEY,"1");
    enterApp();
  }else{
    errEl.textContent = "Wrong password — try again.";
  }
}

async function enterApp(){
  document.body.classList.add("unlocked");
  try{
    await auth.signInAnonymously();
  }catch(e){
    toast("Couldn't connect — check your internet connection");
  }
}

function lockSite(){
  localStorage.removeItem(LOCK_KEY);
  document.body.classList.remove("unlocked");
  auth.signOut().catch(()=>{});
}

auth.onAuthStateChanged(user=>{
  if(user){
    startSync();
    seedIfEmpty();
  }
});

// ============================================================
// Firestore sync — every device listens for live changes and
// re-renders automatically, so an edit anywhere shows up everywhere.
// ============================================================
let syncStarted = false;

function startSync(){
  if(syncStarted) return;
  syncStarted = true;

  channelsCol.orderBy("order").onSnapshot(snap=>{
    rawChannels = snap.docs.map(d=>({id:d.id, ...d.data()}));
    rebuildState(); renderCurrentPage();
  }, err=>toast("Sync error: "+err.message));

  serialsCol.orderBy("order").onSnapshot(snap=>{
    rawSerials = snap.docs.map(d=>({id:d.id, ...d.data()}));
    rebuildState(); renderCurrentPage();
  }, err=>toast("Sync error: "+err.message));

  episodesCol.onSnapshot(snap=>{
    rawEpisodes = snap.docs.map(d=>({id:d.id, ...d.data()}));
    rebuildState(); renderCurrentPage();
  }, err=>toast("Sync error: "+err.message));
}

function rebuildState(){
  state.channels = rawChannels.map(ch=>({
    id: ch.id, name: ch.name, image: ch.image,
    serials: rawSerials.filter(s=>s.channelId===ch.id).map(sr=>({
      id: sr.id, name: sr.name, image: sr.image,
      episodes: rawEpisodes.filter(e=>e.serialId===sr.id)
    }))
  }));
}

async function seedIfEmpty(){
  const snap = await channelsCol.limit(1).get();
  if(!snap.empty) return;
  const batch = db.batch();
  defaultData.channels.forEach((ch,ci)=>{
    const chRef = channelsCol.doc();
    batch.set(chRef, {name:ch.name, image:ch.image, order: Date.now()+ci});
    ch.serials.forEach((sr,si)=>{
      const srRef = serialsCol.doc();
      batch.set(srRef, {channelId:chRef.id, name:sr.name, image:sr.image, order: Date.now()+ci*1000+si});
      sr.episodes.forEach(ep=>{
        const epRef = episodesCol.doc();
        batch.set(epRef, {serialId:srRef.id, number:ep.number, title:ep.title, date:ep.date, duration:ep.duration, image:ep.image, video:ep.video});
      });
    });
  });
  try{ await batch.commit(); }catch(e){ toast("Couldn't load starter data: "+e.message); }
}

// ============================================================
// Page navigation
// ============================================================
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}

function activePageId(){
  const p = document.querySelector(".page.active");
  return p ? p.id : "homePage";
}

function renderCurrentPage(){
  const id = activePageId();
  if(id==="channelPage") renderChannel();
  else if(id==="serialPage") renderEpisodes();
  else renderHome();
}

function goHome(){
  channelEdit=false;
  serialEdit=false;
  episodeEdit=false;
  showPage("homePage");
  renderHome();
}

function goChannel(){
  episodeEdit=false;
  showPage("channelPage");
  renderChannel();
}

function openChannel(id){
  currentChannelId=id;
  serialEdit=false;
  const ch=getChannel();
  document.getElementById("channelTitle").textContent=ch?.name || "Channel";
  document.getElementById("channelSubtitle").textContent=`${ch?.serials?.length || 0} serials`;
  showPage("channelPage");
  renderChannel();
}

function openSerial(id){
  currentSerialId=id;
  episodeEdit=false;
  const sr=getSerial();
  document.getElementById("serialTitle").textContent=sr?.name || "Serial";
  document.getElementById("serialSubtitle").textContent=`Season 1 • ${sr?.episodes?.length || 0} episodes`;
  showPage("serialPage");
  renderEpisodes();
}

function getChannel(){
  return state.channels.find(c=>c.id===currentChannelId);
}
function getSerial(){
  const ch=getChannel();
  return ch?.serials.find(s=>s.id===currentSerialId);
}

function toggleChannelEdit(){
  channelEdit=!channelEdit;
  renderHome();
  toast(channelEdit ? "Homepage editing enabled" : "Homepage editing disabled");
}

function toggleSerialEdit(){
  serialEdit=!serialEdit;
  renderChannel();
  toast(serialEdit ? "Serial editing enabled" : "Serial editing disabled");
}

function toggleEpisodeEdit(){
  episodeEdit=!episodeEdit;
  renderEpisodes();
  toast(episodeEdit ? "Episode editing enabled" : "Episode editing disabled");
}

// ============================================================
// Rendering (unchanged from the original — reads from `state`)
// ============================================================
function renderHome(){
  const grid=document.getElementById("channelGrid");
  grid.classList.toggle("editing",channelEdit);
  grid.innerHTML="";

  state.channels.forEach((ch,i)=>{
    const card=document.createElement("article");
    card.className="channel-card";
    card.style.animationDelay=`${Math.min(i,8)*35}ms`;
    card.innerHTML=`
      <div class="channel-bg" style="background-image:url('${escapeAttr(ch.image)}')"></div>
      <div class="channel-overlay"></div>
      <div class="channel-content">
        <div class="channel-logo"><img src="${escapeAttr(ch.image)}" alt="${escapeAttr(ch.name)}" decoding="async"></div>
        <div class="channel-info">
          <h2>${escapeHtml(ch.name)}</h2>
          <div class="channel-live"><i class="live-dot"></i> Live TV</div>
        </div>
        <div class="channel-open">OPEN</div>
      </div>
      <button class="card-edit" onclick="event.stopPropagation();openChannelEditor('${ch.id}')">EDIT</button>
    `;
    card.onclick=()=>openChannel(ch.id);
    grid.appendChild(card);
  });

  const add=document.createElement("button");
  add.className="add-card";
  add.innerHTML="<span>＋ Add Channel</span>";
  add.onclick=()=>openChannelEditor(null);
  grid.appendChild(add);
  fadeInImages(grid);
}

function renderChannel(){
  const ch=getChannel();
  if(!ch)return goHome();
  document.getElementById("channelTitle").textContent=ch.name;
  document.getElementById("channelSubtitle").textContent=`${ch.serials.length} serials`;

  const grid=document.getElementById("serialGrid");
  grid.classList.toggle("editing",serialEdit);
  grid.innerHTML="";

  ch.serials.forEach((sr,i)=>{
    const card=document.createElement("article");
    card.className="poster-card";
    card.style.animationDelay=`${Math.min(i,12)*25}ms`;
    card.innerHTML=`
      <img src="${escapeAttr(sr.image)}" alt="${escapeAttr(sr.name)}" loading="lazy" decoding="async" onerror="this.style.opacity='.35'">
      <div class="poster-name">${escapeHtml(sr.name)}</div>
      <button class="poster-edit" onclick="event.stopPropagation();openSerialEditor('${sr.id}')">EDIT</button>
    `;
    card.onclick=()=>openSerial(sr.id);
    grid.appendChild(card);
  });

  const add=document.createElement("button");
  add.className="add-poster";
  add.innerHTML="<span>＋ Add Serial</span>";
  add.onclick=()=>openSerialEditor(null);
  grid.appendChild(add);
  fadeInImages(grid);
}

function renderEpisodes(){
  const sr=getSerial();
  if(!sr)return goChannel();

  document.getElementById("serialTitle").textContent=sr.name;
  document.getElementById("serialSubtitle").textContent=`Season 1 • ${sr.episodes.length} episodes`;

  const episodes=[...sr.episodes].sort((a,b)=>Number(b.number)-Number(a.number));
  const latest=episodes[0];
  const latestBtn=document.getElementById("latestBtn");
  latestBtn.disabled=!latest;
  document.getElementById("latestText").textContent=latest
    ? `Watch Latest Episode ${latest.date ? formatDate(latest.date) : ""}`
    : "No Episodes Added";

  const list=document.getElementById("episodeList");
  list.classList.toggle("editing",episodeEdit);
  list.innerHTML="";

  if(!episodes.length){
    list.innerHTML='<div class="no-episodes">No episodes yet. Use “+ Add Episode” to add one.</div>';
    return;
  }

  episodes.forEach((ep,i)=>{
    const row=document.createElement("article");
    row.className="episode-row";
    row.style.animationDelay=`${Math.min(i,10)*30}ms`;
    row.innerHTML=`
      <div class="episode-thumb">
        ${ep.image ? `<img src="${escapeAttr(ep.image)}" alt="" loading="lazy" decoding="async">` : ""}
      </div>
      <div class="episode-number">E${escapeHtml(ep.number)}</div>
      <div class="episode-info">
        <div class="episode-title">${escapeHtml(ep.title)}</div>
        <div class="episode-meta">
          S1 E${escapeHtml(ep.number)}
          ${ep.date ? " • "+escapeHtml(formatDate(ep.date)) : ""}
          ${ep.duration ? " • "+escapeHtml(ep.duration) : ""}
        </div>
      </div>
      <div class="episode-actions">
        <button class="play-ep" title="Watch episode" onclick="watchEpisode('${ep.id}')">▶</button>
        <button class="edit-ep" onclick="openEpisodeEditor('${ep.id}')">EDIT</button>
      </div>
    `;
    list.appendChild(row);
  });
  fadeInImages(list);
}

// ============================================================
// Editors + Firestore writes
// (no manual re-render calls needed — onSnapshot above handles it,
// on this device and every other device that has the site open)
// ============================================================
function openChannelEditor(id){
  editingChannelId=id;
  const ch=id ? state.channels.find(x=>x.id===id) : null;
  document.getElementById("channelModalTitle").textContent=id ? "Edit Channel" : "Add Channel";
  document.getElementById("channelNameInput").value=ch?.name || "";
  document.getElementById("channelImageUrl").value=ch?.image?.startsWith("data:") ? "" : (ch?.image || "");
  document.getElementById("channelImageFile").value="";
  document.getElementById("deleteChannelBtn").style.display=id ? "block" : "none";
  setPreview("channelPreview",ch?.image || "");
  openModal("channelModal");
}

async function saveChannel(){
  const name=document.getElementById("channelNameInput").value.trim() || "New Channel";
  const file=document.getElementById("channelImageFile").files[0];
  const url=document.getElementById("channelImageUrl").value.trim();
  const old=editingChannelId ? state.channels.find(x=>x.id===editingChannelId) : null;
  let image=old?.image || "";
  try{
    if(file) image=await fileToCompressedDataURL(file);
    else if(url) image=url;
    if(!image) image="https://via.placeholder.com/800x500/202127/ffffff?text=Channel";

    if(old){
      await channelsCol.doc(old.id).update({name,image});
    }else{
      await channelsCol.add({name,image,order:Date.now()});
    }
    closeModal("channelModal");toast("Channel saved");
  }catch(e){
    toast("Couldn't save: "+e.message);
  }
}

async function deleteChannel(){
  if(!editingChannelId)return;
  const ch=state.channels.find(x=>x.id===editingChannelId);
  if(!confirm(`Delete "${ch?.name}" and all its serials?`))return;
  try{
    const batch=db.batch();
    ch?.serials.forEach(sr=>{
      sr.episodes.forEach(ep=>batch.delete(episodesCol.doc(ep.id)));
      batch.delete(serialsCol.doc(sr.id));
    });
    batch.delete(channelsCol.doc(editingChannelId));
    await batch.commit();
    closeModal("channelModal");toast("Channel deleted");
  }catch(e){
    toast("Couldn't delete: "+e.message);
  }
}

function openSerialEditor(id){
  editingSerialId=id;
  const ch=getChannel();
  const sr=id ? ch?.serials.find(x=>x.id===id) : null;
  document.getElementById("serialModalTitle").textContent=id ? "Edit Serial" : "Add Serial";
  document.getElementById("serialNameInput").value=sr?.name || "";
  document.getElementById("serialImageUrl").value=sr?.image?.startsWith("data:") ? "" : (sr?.image || "");
  document.getElementById("serialImageFile").value="";
  document.getElementById("deleteSerialBtn").style.display=id ? "block" : "none";
  setPreview("serialPreview",sr?.image || "");
  openModal("serialModal");
}

async function saveSerial(){
  const ch=getChannel();
  if(!ch)return;
  const name=document.getElementById("serialNameInput").value.trim() || "New Serial";
  const file=document.getElementById("serialImageFile").files[0];
  const url=document.getElementById("serialImageUrl").value.trim();
  const old=editingSerialId ? ch.serials.find(x=>x.id===editingSerialId) : null;
  let image=old?.image || "";
  try{
    if(file)image=await fileToCompressedDataURL(file);
    else if(url)image=url;
    if(!image)image="https://via.placeholder.com/800x1150/202127/ffffff?text=Serial";

    if(old){
      await serialsCol.doc(old.id).update({name,image});
    }else{
      await serialsCol.add({channelId:ch.id,name,image,order:Date.now()});
    }
    closeModal("serialModal");toast("Serial saved");
  }catch(e){
    toast("Couldn't save: "+e.message);
  }
}

async function deleteSerial(){
  const ch=getChannel();
  if(!ch || !editingSerialId)return;
  const sr=ch.serials.find(x=>x.id===editingSerialId);
  if(!confirm(`Delete "${sr?.name}" and all episodes?`))return;
  try{
    const batch=db.batch();
    sr?.episodes.forEach(ep=>batch.delete(episodesCol.doc(ep.id)));
    batch.delete(serialsCol.doc(editingSerialId));
    await batch.commit();
    closeModal("serialModal");toast("Serial deleted");
  }catch(e){
    toast("Couldn't delete: "+e.message);
  }
}

function openEpisodeEditor(id){
  editingEpisodeId=id;
  const sr=getSerial();
  const ep=id ? sr?.episodes.find(x=>x.id===id) : null;
  const next=sr?.episodes.length ? Math.max(...sr.episodes.map(x=>Number(x.number)||0))+1 : 1;

  document.getElementById("episodeModalTitle").textContent=id ? "Edit Episode" : "Add Episode";
  document.getElementById("episodeNoInput").value=ep?.number ?? next;
  document.getElementById("episodeTitleInput").value=ep?.title || "";
  document.getElementById("episodeDateInput").value=ep?.date || "";
  document.getElementById("episodeDurationInput").value=ep?.duration || "";
  document.getElementById("episodeVideoInput").value=ep?.video || "";
  document.getElementById("episodeImageFile").value="";
  document.getElementById("episodeImageUrl").value=ep?.image?.startsWith("data:") ? "" : (ep?.image || "");
  document.getElementById("deleteEpisodeBtn").style.display=id ? "block" : "none";
  setPreview("episodePreview",ep?.image || "");
  openModal("episodeModal");
}

async function saveEpisode(){
  const sr=getSerial();
  if(!sr)return;
  const number=Number(document.getElementById("episodeNoInput").value);
  if(!number){toast("Enter an episode number");return}
  const title=document.getElementById("episodeTitleInput").value.trim() || "Untitled Episode";
  const date=document.getElementById("episodeDateInput").value;
  const duration=document.getElementById("episodeDurationInput").value.trim();
  const video=document.getElementById("episodeVideoInput").value.trim();
  const file=document.getElementById("episodeImageFile").files[0];
  const url=document.getElementById("episodeImageUrl").value.trim();

  const old=editingEpisodeId ? sr.episodes.find(x=>x.id===editingEpisodeId) : null;
  let image=old?.image || "";
  try{
    if(file)image=await fileToCompressedDataURL(file);
    else if(url)image=url;

    const payload={number,title,date,duration,image,video};
    if(old){
      await episodesCol.doc(old.id).update(payload);
    }else{
      await episodesCol.add({...payload, serialId:sr.id});
    }
    closeModal("episodeModal");toast("Episode saved");
  }catch(e){
    toast("Couldn't save: "+e.message);
  }
}

async function deleteEpisode(){
  const sr=getSerial();
  if(!sr || !editingEpisodeId)return;
  const ep=sr.episodes.find(x=>x.id===editingEpisodeId);
  if(!confirm(`Delete Episode ${ep?.number}?`))return;
  try{
    await episodesCol.doc(editingEpisodeId).delete();
    closeModal("episodeModal");toast("Episode deleted");
  }catch(e){
    toast("Couldn't delete: "+e.message);
  }
}

function watchLatest(){
  const sr=getSerial();
  if(!sr?.episodes.length)return;
  const ep=[...sr.episodes].sort((a,b)=>Number(b.number)-Number(a.number))[0];
  watchEpisode(ep.id);
}

function watchEpisode(id){
  const sr=getSerial();
  const ep=sr?.episodes.find(x=>x.id===id);
  if(!ep)return;
  if(!ep.video){
    toast("No video link added for this episode");
    return;
  }
  openVideo(ep.video);
}

function openVideo(url){
  const modal=document.getElementById("videoModal");
  const player=document.getElementById("videoPlayer");
  const fallback=document.getElementById("videoFallback");
  const link=document.getElementById("openVideoLink");

  player.pause();
  player.style.display="block";
  fallback.style.display="none";
  player.src=url;
  link.href=url;
  modal.classList.add("show");
  player.play().catch(()=>{});

  player.onerror=()=>{
    player.style.display="none";
    fallback.style.display="block";
  };
}

function closeVideo(){
  const player=document.getElementById("videoPlayer");
  player.pause();player.removeAttribute("src");player.load();
  document.getElementById("videoModal").classList.remove("show");
}

function openModal(id){document.getElementById(id).classList.add("show")}
function closeModal(id){document.getElementById(id).classList.remove("show")}
function backdropClose(e,id){if(e.target.id===id)closeModal(id)}
function videoBackdrop(e){if(e.target.id==="videoModal")closeVideo()}

function setPreview(id,src){
  const box=document.getElementById(id);
  if(!src){box.classList.remove("show");box.innerHTML="";return}
  box.classList.add("show");
  box.innerHTML=`<img src="${escapeAttr(src)}" alt="Preview" decoding="async" onerror="this.parentElement.classList.remove('show')">`;
  fadeInImages(box);
}

["channel","serial","episode"].forEach(type=>{
  const file=document.getElementById(type+"ImageFile");
  const url=document.getElementById(type+"ImageUrl");
  const preview=type+"Preview";
  file?.addEventListener("change",async()=>{
    const f=file.files[0];
    if(f)setPreview(preview,await fileToCompressedDataURL(f));
  });
  url?.addEventListener("input",()=>{if(url.value.trim())setPreview(preview,url.value.trim())});
});

// Resizes + JPEG-compresses uploaded images client-side before they're
// stored, so a single item stays well under Firestore's 1MB document
// limit and syncs fast on slow connections. Prefer "image link" for
// very large source photos.
function fileToCompressedDataURL(file, maxDim=900, quality=0.82){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        let {width,height}=img;
        if(width>maxDim || height>maxDim){
          const scale=Math.min(maxDim/width, maxDim/height);
          width=Math.round(width*scale); height=Math.round(height*scale);
        }
        const canvas=document.createElement("canvas");
        canvas.width=width; canvas.height=height;
        canvas.getContext("2d").drawImage(img,0,0,width,height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror=reject;
      img.src=reader.result;
    };
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

function fadeInImages(container){
  container.querySelectorAll("img").forEach(img=>{
    if(img.complete && img.naturalWidth){
      img.classList.add("loaded");
    }else{
      img.addEventListener("load",()=>img.classList.add("loaded"),{once:true});
      img.addEventListener("error",()=>img.classList.add("loaded"),{once:true});
    }
  });
}

function formatDate(value){
  const d=new Date(value+"T00:00:00");
  if(Number.isNaN(d.getTime()))return value;
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function escapeAttr(value){return escapeHtml(value)}

let toastTimer;
function toast(message){
  const el=document.getElementById("toast");
  el.textContent=message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),1800);
}

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    document.querySelectorAll(".modal.show").forEach(m=>m.classList.remove("show"));
    closeVideo();
  }
});

// ============================================================
// Lock screen wiring + auto-unlock if this device already knows the password
// ============================================================
document.getElementById("lockSubmitBtn").addEventListener("click", ()=>{
  tryUnlock(document.getElementById("lockPasswordInput").value);
});
document.getElementById("lockPasswordInput").addEventListener("keydown", e=>{
  if(e.key==="Enter") tryUnlock(e.target.value);
});

if(localStorage.getItem(LOCK_KEY)==="1"){
  enterApp();
}
