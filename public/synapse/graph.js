// ═══ INIT GUARD — prevents double-execution (React StrictMode / re-mounts) ═══
if (window.__SYN_INITIALIZED) {
  console.warn('Synapse già inizializzato, salto la seconda esecuzione');
} else if (!document.getElementById('gc')) {
  console.warn('Synapse: canvas non pronto, script non eseguito');
} else {
  window.__SYN_INITIALIZED = true;


// ═══ BACKEND INTEGRATION HELPERS ═══
window.__SYN_USAGE = null;
function updateUsageLabel(){
  const u = window.__SYN_USAGE;
  const el = document.getElementById('usage-label');
  if(el && u){ el.textContent = u.plan + ' · ' + (u.plan==='free' ? (u.used+'/'+u.limit+' task') : 'illimitato'); }
}
// Persistence — saves tasks/connections/theses to Supabase via the page's saver
async function persistTask(task){
  if(window.__synSaveTask) await window.__synSaveTask(task);
}
async function persistThesis(mn){
  if(window.__synSaveThesis) await window.__synSaveThesis(mn);
}
// Badge delta confidenza: visibile finché l'utente non apre la tesi.
// Il "visto" è in localStorage, così non risorge a ogni reload.
function confSeenMap(){ try{ return JSON.parse(localStorage.getItem('synConfSeen')||'{}'); }catch(e){ return {}; } }
function markConfSeen(mn){
  mn.confDelta=null;
  try{ const m=confSeenMap(); m[mn.id]=new Date().toISOString(); localStorage.setItem('synConfSeen',JSON.stringify(m)); }catch(e){}
}
function computeConfDelta(mn){
  const h=mn.history;
  if(!h||h.length<2){ mn.confDelta=null; return; }
  const last=h[h.length-1], prev=h[h.length-2];
  const delta=(last.confidence||0)-(prev.confidence||0);
  if(!delta){ mn.confDelta=null; return; }
  const seen=confSeenMap()[mn.id];
  mn.confDelta=(!seen||new Date(last.date)>new Date(seen))?delta:null;
}

// Refresh on-demand: all'apertura chiede al server di ri-valutare tesi stantie
// (via batch, ingerito all'apertura successiva) e aggiornare le performance.
async function refreshStaleData(){
  try{
    const res=await fetch('/api/refresh',{method:'POST'});
    const json=await res.json();
    if(json.error) return;
    let touched=0;
    (json.updatedTheses||[]).forEach(t=>{
      const mn=MEMORY_NODES.find(m=>m.id===t.id);
      if(mn){ mn.confidence=t.confidence; if(t.history) mn.history=t.history; if(t.signals) mn.signals=t.signals; if(t.status) mn.status=t.status; if('accuracy' in t) mn.accuracy=t.accuracy; if('signals_hit' in t) mn.signals_hit=t.signals_hit; if('signals_total' in t) mn.signals_total=t.signals_total; computeConfDelta(mn); touched++; }
    });
    (json.updatedActions||[]).forEach(a=>{
      const an=ACTION_NODES.find(x=>x.id===a.id);
      if(an) an.performance=a.performance;
    });
    if(touched>0){
      const notif=document.getElementById('mem-notif');
      if(notif){
        document.getElementById('mem-notif-text').textContent='◆ '+touched+(touched===1?' tesi ri-valutata':' tesi ri-valutate')+' con dati aggiornati';
        notif.classList.add('show');
        setTimeout(()=>notif.classList.remove('show'),7000);
      }
    }
  }catch(e){ console.warn('refresh failed', e); }
}


// ═══ STATE ═══
let pendingOrigin = null; // provenance: da quale nodo nasce la prossima domanda suggerita
let TASKS = [];
let NODES = [];
let EDGES = [];
let selNode = null, hovNode = null, isLoading = false;
let loadInterval = null;
let PROTO_THESES = []; // candidate theses (tesi in formazione) da sviluppare
let MEMORY_NODES = []; // array of {id, thesis, confidence, history, source_ids, suggested_question, x, y}
let ACTION_NODES = []; // array of {id, clusterId, title, summary, categories, caveat, x, y, color, sourceMemId}
const ACTION_COLOR = '#34d399';
let memCheckPending = false;

// ═══ WATCH ("avvisami se cambia") ═══
// Stato locale degli avvisi attivi; il cron server-side ricontrolla il
// verdetto ogni settimana e salva il flip — qui lo mostriamo al load.
let WATCHES = [];
function watchFor(taskId){ return WATCHES.find(w=>w.task_id===taskId); }
async function loadWatches(){
  try{
    const res=await fetch('/api/watch');
    const json=await res.json();
    if(json.watches){ WATCHES=json.watches; showFlipNotification(); }
  }catch(e){}
}
function showFlipNotification(){
  const w=WATCHES.find(x=>x.flip && !x.flip_seen);
  if(!w) return;
  const notif=document.getElementById('mem-notif');
  if(!notif) return;
  const lbl={si:'sì',no:'no',dipende:'dipende'};
  document.getElementById('mem-notif-text').textContent='⚡ Verdetto cambiato: "'+w.query.slice(0,48)+(w.query.length>48?'…':'')+'" — '+(lbl[w.flip.old_stance]||w.flip.old_stance)+' → '+(lbl[w.flip.new_stance]||w.flip.new_stance);
  const nb=notif.querySelector('.mem-notif-btn');
  if(nb){ nb.textContent='vedi →'; nb.onclick=async()=>{
    notif.classList.remove('show');
    try{ await fetch('/api/watch',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:w.id})}); w.flip_seen=true; }catch(e){}
    const t=TASKS.find(x=>x.id===w.task_id);
    if(t){ jumpToNode(t.id); selNode=t.id; openDrawer(t); }
  };}
  notif.classList.add('show');
  setTimeout(()=>notif.classList.remove('show'),12000);
}
async function toggleWatch(task, btn){
  const existing=watchFor(task.id);
  btn.disabled=true;
  try{
    if(existing){
      await fetch('/api/watch',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({task_id:task.id})});
      WATCHES=WATCHES.filter(w=>w.task_id!==task.id);
      btn.classList.remove('on'); btn.textContent='🔔 avvisami se il verdetto cambia';
    } else {
      const res=await fetch('/api/watch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task_id:task.id})});
      const json=await res.json();
      if(json.error==='watch_limit'){ alert('Limite di '+json.limit+' avvisi attivi per il piano '+json.plan+'. Disattiva un avviso o passa a Pro.'); }
      else if(json.error==='no_verdict'){ alert('Questa domanda non ha un verdetto da osservare: il watch serve per domande con risposta si/no/dipende.'); }
      else if(json.watch){ WATCHES.push(json.watch); btn.classList.add('on'); btn.textContent='✓ avviso attivo — ricontrollo ogni settimana'; }
    }
  }catch(e){ console.warn('watch toggle failed', e); }
  btn.disabled=false;
}

// ═══ PORTAFOGLIO REALE — editor ═══
// L'utente dichiara gli strumenti che possiede davvero (ticker + peso %):
// /api/analyze li usa per quantificare l'esposizione già presente a un tema.
function pfeRow(h){
  const r=document.createElement('div');
  r.className='pfe-row';
  r.innerHTML=`<input class="pfe-ticker" placeholder="VWCE" maxlength="12" value="${String(h&&h.ticker||'').replace(/["<>]/g,'')}">
  <input class="pfe-name" placeholder="nome (opzionale)" maxlength="60" value="${String(h&&h.name||'').replace(/["<>]/g,'')}">
  <input class="pfe-weight" placeholder="%" inputmode="decimal" maxlength="6" value="${h&&h.weight!=null?h.weight:''}">
  <button class="pfe-del" title="rimuovi">×</button>`;
  r.querySelector('.pfe-del').addEventListener('click',()=>{ r.remove(); pfeUpdateTotal(); });
  r.querySelector('.pfe-weight').addEventListener('input',pfeUpdateTotal);
  return r;
}
function pfeUpdateTotal(){
  const tot=[...document.querySelectorAll('.pfe-weight')].reduce((s,i)=>s+(parseFloat(String(i.value).replace(',','.'))||0),0);
  const el=document.getElementById('pfe-total');
  if(el) el.innerHTML='totale: <b style="color:'+(Math.abs(tot-100)<0.5?'#34d399':tot>100?'#e05555':'#dddde8')+'">'+(Math.round(tot*10)/10)+'%</b>';
}
function openPortfolioEditor(){
  if(document.getElementById('pfe-overlay')) return;
  const holdings=Array.isArray(window.__SYN_PORTFOLIO)?window.__SYN_PORTFOLIO:[];
  const ov=document.createElement('div');
  ov.className='pfe-overlay'; ov.id='pfe-overlay';
  ov.innerHTML=`<div class="pfe-card">
    <div class="pfe-title">Il mio portafoglio</div>
    <div class="pfe-sub">Gli strumenti che possiedi davvero, col peso in %. Le analisi li useranno per dirti quanto sei già esposto a un tema ("sei già esposto ~12% via VWCE"). Restano privati nel tuo profilo.</div>
    <div class="pfe-rows" id="pfe-rows"></div>
    <div class="pfe-total" id="pfe-total"></div>
    <div class="pfe-actions">
      <button class="pfe-add" id="pfe-add">+ aggiungi strumento</button>
      <span><button class="pfe-cancel" id="pfe-cancel">annulla</button>
      <button class="pfe-save" id="pfe-save">salva</button></span>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const rows=document.getElementById('pfe-rows');
  (holdings.length?holdings:[{}]).forEach(h=>rows.appendChild(pfeRow(h)));
  pfeUpdateTotal();
  document.getElementById('pfe-add').addEventListener('click',()=>{ rows.appendChild(pfeRow({})); });
  document.getElementById('pfe-cancel').addEventListener('click',()=>ov.remove());
  ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
  document.getElementById('pfe-save').addEventListener('click',async()=>{
    const out=[];
    rows.querySelectorAll('.pfe-row').forEach(r=>{
      const ticker=r.querySelector('.pfe-ticker').value.trim().toUpperCase();
      const name=r.querySelector('.pfe-name').value.trim();
      const w=parseFloat(String(r.querySelector('.pfe-weight').value).replace(',','.'));
      if(ticker||name) out.push({ticker,name,weight:isNaN(w)?null:w});
    });
    const btn=document.getElementById('pfe-save');
    btn.disabled=true; btn.textContent='…';
    try{
      if(window.__synSavePortfolio) await window.__synSavePortfolio(out);
      window.__SYN_PORTFOLIO=out;
      ov.remove();
      const notif=document.getElementById('mem-notif');
      if(notif){
        document.getElementById('mem-notif-text').textContent='◈ portafoglio salvato — le prossime analisi lo useranno';
        notif.classList.add('show');
        setTimeout(()=>notif.classList.remove('show'),5000);
      }
    }catch(e){ btn.disabled=false; btn.textContent='salva'; alert('Salvataggio fallito, riprova.'); }
  });
}

// Distinct colors per memory cluster
const MEMORY_COLORS = ['#a78bfa','#f472b6','#34d399','#fb923c','#60a5fa'];
const TC = {causal:'#5b9cf6',compare:'#2ecf98',risk:'#f0a030',trend:'#4ad68a',screen:'#4ad68a'};

// ═══ CANVAS ═══
const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');

// ═══ PAN / ZOOM VIEW STATE ═══
const VIEW = { panX: 0, panY: 0, zoom: 1 };
// Convert a screen point (mouse) to world coordinates (where nodes actually live)
function screenToWorld(sx, sy){
  return { x: (sx - VIEW.panX) / VIEW.zoom, y: (sy - VIEW.panY) / VIEW.zoom };
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);
// Mobile: the first resize can fire before layout settles (browser bar, fonts).
// Re-measure shortly after so the canvas gets the correct height.
setTimeout(resize, 150);
// Re-fit at growing intervals: on mobile the canvas height settles late,
// so we reframe a few times until it's stable (only during the first ~2s).
[400, 900, 1600].forEach(ms=>setTimeout(()=>{ resize(); if(window.__synFitView) window.__synFitView(); }, ms));
window.addEventListener('orientationchange', ()=>setTimeout(()=>{ resize(); if(window.__synFitView) window.__synFitView(); },250));

function wrapText(text, max) {
  const words = text.split(' '); let lines = [], line = '';
  for (const w of words) {
    if ((line+' '+w).trim().length > max) { if(line) lines.push(line); line = w; }
    else line = (line+' '+w).trim();
  }
  if (line) lines.push(line);
  return lines;
}
function roundRect(c,x,y,w,h,r){
  c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}

function drawHex(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + r * Math.cos(angle), py = y + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function loop() {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;
  // Account for input bar height (~110px)
  const graphH = H - 110;
  ctx.clearRect(0,0,W,H);

  if (!NODES.length) { requestAnimationFrame(loop); return; }

  // Apply pan/zoom view transform (everything drawn after this is in "world" coords)
  ctx.save();
  ctx.translate(VIEW.panX, VIEW.panY);
  ctx.scale(VIEW.zoom, VIEW.zoom);

  const cx = W/2, cy = graphH/2;

  // Physics — repulsion accounts for label width
  for (let i=0;i<NODES.length;i++) for (let j=i+1;j<NODES.length;j++) {
    const a=NODES[i],b=NODES[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    // Minimum desired distance: node radius + label width estimate + padding
    const minDist = 260 + Math.max(a.task.raw_query.length, b.task.raw_query.length) * 2.6;
    const f = d < minDist
      ? 42000/(d*d)           // very strong when too close
      : 12000/(d*d);          // normal repulsion when far
    const fx=(dx/d)*f,fy=(dy/d)*f;
    a.vx-=fx;a.vy-=fy;b.vx+=fx;b.vy+=fy;
  }
  // Hard separation — push apart nodes that are dangerously close
  for (let i=0;i<NODES.length;i++) for (let j=i+1;j<NODES.length;j++) {
    const a=NODES[i],b=NODES[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    const minHard=200;
    if(d<minHard){
      const push=(minHard-d)/2+1;
      a.x-=(dx/d)*push;a.y-=(dy/d)*push;
      b.x+=(dx/d)*push;b.y+=(dy/d)*push;
    }
  }
  for (const e of EDGES) {
    const a=NODES.find(n=>n.id===e.from),b=NODES.find(n=>n.id===e.to);
    if(!a||!b)continue;
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    const target=340+(1-e.score)*120,f=(d-target)*0.008*e.score;
    const fx=(dx/d)*f,fy=(dy/d)*f;
    a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;
  }
  for (const n of NODES) {
    // Same gentle center pull on all screens — let the graph spread naturally.
    // On mobile we DON'T compress (that caused a cramped vertical column);
    // instead fitView zooms out to frame the whole spread.
    n.vx+=(cx-n.x)*0.002;n.vy+=(cy-n.y)*0.002;
    n.vx*=0.76;n.vy*=0.76;
    n.x+=n.vx;n.y+=n.vy;
    const margin = Math.max(0, (NODES.length-6)) * 60;
    n.x=Math.max(120-margin,Math.min(W-120+margin,n.x));
    n.y=Math.max(100-margin,Math.min(graphH-80+margin,n.y));
  }

  // Draw edges
  for (const e of EDGES) {
    const a=NODES.find(n=>n.id===e.from),b=NODES.find(n=>n.id===e.to);
    if(!a||!b)continue;
    const ecmap={same_hypothesis:'#f0a030',complementary_data:'#5b9cf6',same_question_type:'#2ecf98',contradiction:'#e05555',supports:'#4ad68a'};
    const ec=ecmap[e.type]||'#5b9cf6';
    const mx=(a.x+b.x)/2+(b.y-a.y)*0.18,my=(a.y+b.y)/2-(b.x-a.x)*0.18;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mx,my,b.x,b.y);
    // Contraddizione: tratteggiata + alpha minimo più alto, così salta all'occhio anche debole.
    if(e.type==='contradiction'){ ctx.setLineDash([5,4]); ctx.globalAlpha=0.4+e.score*0.45; }
    else { ctx.globalAlpha=0.1+e.score*0.55; }
    ctx.strokeStyle=ec;ctx.lineWidth=0.5+e.score*2.5;ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    // Edge label only when one of its nodes is selected or hovered — keeps dense graphs clean
    const edgeActive = selNode===e.from||selNode===e.to||hovNode===e.from||hovNode===e.to;
    if(e.score>=0.4 && edgeActive){
      const lbl=Math.round(e.score*100)+'%';
      ctx.font='10px DM Mono';const tw=ctx.measureText(lbl).width;
      ctx.fillStyle='#0e0e12';ctx.globalAlpha=0.92;ctx.fillRect(mx-tw/2-5,my-8,tw+10,16);ctx.globalAlpha=1;
      ctx.fillStyle=ec;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lbl,mx,my);
    }
  }

  // Draw nodes
  for (const n of NODES) {
    const task=n.task,color=TC[task.intent?.analysis_type]||'#5b9cf6';
    const isSel=selNode===n.id,isHov=hovNode===n.id;
    const r=(isSel||isHov)?28:20;
    const connCount=EDGES.filter(e=>e.from===n.id||e.to===n.id).length;

    // Glow
    ctx.beginPath();ctx.arc(n.x,n.y,r+14,0,Math.PI*2);
    ctx.fillStyle=color;ctx.globalAlpha=isSel?0.18:isHov?0.1:0.04;ctx.fill();ctx.globalAlpha=1;

    // Connection arc ring
    if(connCount>0){
      const arc=Math.min((connCount/6)*Math.PI*2,Math.PI*2);
      ctx.beginPath();ctx.arc(n.x,n.y,r+6,-Math.PI/2,-Math.PI/2+arc);
      ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.globalAlpha=0.35;ctx.stroke();ctx.globalAlpha=1;
    }

    // Circle
    ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.fillStyle='#0e0e12';ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=isSel?2.5:isHov?2:1.5;
    ctx.globalAlpha=isSel?1:isHov?0.9:0.65;ctx.stroke();ctx.globalAlpha=1;

    // Letter
    ctx.fillStyle=color;ctx.font=`${isSel||isHov?13:11}px DM Mono`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText((task.intent?.analysis_type||'?')[0].toUpperCase(),n.x,n.y);

    // Label — count how many nodes are crowding this one
    let crowdCount = 0;
    for(const other of NODES){
      if(other.id===n.id) continue;
      const dx2=other.x-n.x, dy2=other.y-n.y;
      if(Math.sqrt(dx2*dx2+dy2*dy2) < 150) crowdCount++;
    }
    const tooClose = crowdCount > 0;

    if(isSel || isHov){
      // FULL label, wrapped, with background plate — only for the focused node
      const q=task.raw_query,ll=30;
      let lines;
      if(q.length<=ll){lines=[q];}
      else{
        const mid=Math.floor(q.length/2);
        let sp=q.lastIndexOf(' ',mid+10);if(sp<4)sp=q.indexOf(' ',mid-10);if(sp<0)sp=ll;
        const l1=q.slice(0,sp).trim(),l2=q.slice(sp).trim();
        lines=l2.length>ll+5?[l1,l2.slice(0,ll)+'…']:[l1,l2];
      }
      ctx.font='11px DM Mono';ctx.textAlign='center';ctx.textBaseline='top';
      const maxW=Math.max(...lines.map(l=>ctx.measureText(l).width));
      ctx.fillStyle='#08080a';ctx.globalAlpha=0.85;
      ctx.fillRect(n.x-maxW/2-6,n.y+r+5,maxW+12,lines.length*14+6);
      ctx.globalAlpha=1;
      ctx.fillStyle=isSel?'#dddde8':'#b0b0c8';
      const ly=n.y+r+8;
      lines.forEach((l,i)=>ctx.fillText(l,n.x,ly+i*14));
    } else if(!tooClose){
      // SHORT single-line label for isolated nodes — truncated to avoid overlap
      const q=task.raw_query;
      const short = q.length>26 ? q.slice(0,26)+'…' : q;
      ctx.fillStyle='#5a5a78';ctx.font='10px DM Mono';
      ctx.textAlign='center';ctx.textBaseline='top';ctx.globalAlpha=1;
      ctx.fillText(short,n.x,n.y+r+8);
    }
    // crowded + not focused → no label at all (hover to reveal)

    // Click hint on hover
    if(isHov&&!isSel){
      ctx.font='9px DM Mono';ctx.fillStyle=color;ctx.globalAlpha=0.7;
      ctx.textAlign='center';ctx.textBaseline='top';
      const ly2=n.y+r+8+(tooClose?0:28);
      ctx.fillText('clicca per aprire',n.x,ly2);
      ctx.globalAlpha=1;
    }

    // Tooltip on selected (shows hypothesis)
    if(isSel&&task.fingerprint?.hypothesis){
      const tx2=Math.min(n.x+r+18,W-270),ty2=Math.max(n.y-70,8);
      const hyp=task.fingerprint.hypothesis;
      const hLines=wrapText(hyp,36);
      const ph=14*2+18+hLines.length*16+10,pw=260;
      ctx.fillStyle='#141418';ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=0.97;
      roundRect(ctx,tx2,ty2,pw,ph,10);ctx.fill();ctx.stroke();ctx.globalAlpha=1;
      ctx.fillStyle=color;ctx.font='9px DM Mono';ctx.textAlign='left';ctx.textBaseline='top';
      ctx.fillText('ipotesi implicita',tx2+14,ty2+14);
      ctx.fillStyle='#a0a0b8';ctx.font='11px DM Mono';
      hLines.forEach((l,i)=>ctx.fillText(l,tx2+14,ty2+14+18+i*16));
    }
  }

  if(NODES.length>=2){
    const memCount = MEMORY_NODES.length;
    const gh = document.getElementById('ghint');
    if(gh) gh.textContent=`${NODES.length} nodi · ${EDGES.length} connessioni · ${uniqueHyp()} ipotesi${memCount?` · ◆ ${memCount} tesi`:''}`;
  }

  // Draw memory nodes
  for(const mn of MEMORY_NODES){
    const color = mn.color || '#a78bfa';
    const colorDim = mn.colorDim || '#2a1a40';
    const isSel=selNode===mn.id, isHov=hovNode===mn.id;
    const r=(isSel||isHov)?34:26;
    const pulse=0.6+0.4*Math.sin(Date.now()/1000+mn.phaseOffset);

    // Dashed edges to source tasks (+ provenance durabile: domande nate da questa tesi)
    const _provSrc=NODES.filter(n=>n.task&&n.task.originKind==='thesis'&&n.task.originRef===mn.clusterId).map(n=>n.id);
    for(const sid of [...new Set([...(mn.source_ids||[]),..._provSrc])]){
      const sn=NODES.find(n=>n.id===sid);
      if(!sn)continue;
      ctx.beginPath();ctx.setLineDash([4,4]);
      ctx.moveTo(mn.x,mn.y);ctx.lineTo(sn.x,sn.y);
      ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=0.2;ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha=1;
    }

    // Outer glow
    ctx.save();
    drawHex(ctx,mn.x,mn.y,r+18);
    ctx.fillStyle=color;ctx.globalAlpha=0.05*pulse;ctx.fill();ctx.restore();

    // Second ring
    drawHex(ctx,mn.x,mn.y,r+8);
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=0.18+0.12*pulse;ctx.stroke();ctx.globalAlpha=1;

    // Main hex
    drawHex(ctx,mn.x,mn.y,r);
    ctx.fillStyle='#0d0a18';ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=isSel?2.5:1.5;
    ctx.globalAlpha=isSel?1:0.8;ctx.stroke();ctx.globalAlpha=1;

    // Confidence arc
    const conf=mn.confidence/100;
    ctx.beginPath();ctx.arc(mn.x,mn.y,r+12,-Math.PI/2,-Math.PI/2+conf*Math.PI*2);
    ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.globalAlpha=0.5;ctx.stroke();ctx.globalAlpha=1;

    // Badge: tesi sfidata (ha una contro-tesi)
    if(mn.challenge){
      ctx.fillStyle='#e05577';ctx.font='10px DM Mono';
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=0.9;
      ctx.fillText('⚔',mn.x-r-10,mn.y-r+2);ctx.globalAlpha=1;
    }

    // Badge: delta confidenza non ancora visto (dal refresh)
    if(mn.confDelta){
      const up=mn.confDelta>0;
      const dTxt=(up?'↑+':'↓')+mn.confDelta;
      ctx.font='9px DM Mono';
      const dw=ctx.measureText(dTxt).width;
      const bx=mn.x+r-2, by=mn.y-r-14, bw=dw+10, bh=14;
      ctx.fillStyle=up?'#0a2a18':'#2a0f12';
      ctx.strokeStyle=up?'#4ad68a':'#e05555';
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(bx,by,bw,bh,7); else ctx.rect(bx,by,bw,bh);
      ctx.fill();ctx.lineWidth=1;ctx.globalAlpha=0.9;ctx.stroke();ctx.globalAlpha=1;
      ctx.fillStyle=up?'#4ad68a':'#e05555';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(dTxt,bx+bw/2,by+bh/2+0.5);
    }

    // History trend mini-sparkline inside hex
    if(mn.history?.length>1){
      const hw=r*0.9, hh=r*0.4;
      const hx=mn.x-hw/2, hy=mn.y+4;
      const vals=mn.history.map(h=>h.confidence);
      const hmin=Math.min(...vals), hmax=Math.max(...vals), hrange=hmax-hmin||1;
      ctx.beginPath();
      vals.forEach((v,i)=>{
        const px=hx+(i/(vals.length-1))*hw;
        const py=hy+hh-(v-hmin)/hrange*hh;
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      });
      ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.globalAlpha=0.6;ctx.stroke();ctx.globalAlpha=1;
    } else {
      // Diamond symbol if no history yet
      ctx.fillStyle=color;ctx.font=`${isSel?14:11}px DM Mono`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('◆',mn.x,mn.y);
    }

    // Label below
    const lc=isSel?'#fff':isHov?'#d4bbff':'#7c5ab8';
    ctx.fillStyle=lc;ctx.font=`${isSel?11:10}px DM Mono`;
    ctx.textAlign='center';ctx.textBaseline='top';
    const shortT=mn.thesis.length>30?mn.thesis.slice(0,30)+'…':mn.thesis;
    const tLines=wrapText(shortT,26);
    const labelY=mn.y+r+8;
    tLines.forEach((l,i)=>ctx.fillText(l,mn.x,labelY+i*13));

    // Confidence + trend indicator
    const lastConf=mn.confidence;
    const prevConf=mn.history?.length>1?mn.history[mn.history.length-2].confidence:null;
    const trend=prevConf!==null?(lastConf>prevConf?'↑':lastConf<prevConf?'↓':'→'):null;
    ctx.fillStyle=color;ctx.font='9px DM Mono';
    ctx.fillText(`${lastConf}%${trend?' '+trend:''}`,mn.x,labelY+tLines.length*13+4);

    if(isHov&&!isSel){
      ctx.fillStyle=color;ctx.font='9px DM Mono';ctx.globalAlpha=0.7;
      ctx.fillText('clicca per aprire',mn.x,labelY+tLines.length*13+18);ctx.globalAlpha=1;
    }
  }

  // Draw action nodes (squares) — the "portfolio of the thesis"
  for(const an of ACTION_NODES){
    const color=an.color||'#34d399';
    const isSel=selNode===an.id, isHov=hovNode===an.id;
    const s=(isSel||isHov)?30:24; // half-side
    const pulse=0.6+0.4*Math.sin(Date.now()/1000+(an.phaseOffset||0));

    // Dashed link to source memory node
    const srcMem=MEMORY_NODES.find(m=>m.id===an.sourceMemId);
    if(srcMem){
      ctx.beginPath();ctx.setLineDash([3,3]);
      ctx.moveTo(an.x,an.y);ctx.lineTo(srcMem.x,srcMem.y);
      ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=0.3;ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha=1;
    }

    // Glow
    ctx.fillStyle=color;ctx.globalAlpha=0.05*pulse;
    ctx.fillRect(an.x-s-8,an.y-s-8,(s+8)*2,(s+8)*2);ctx.globalAlpha=1;

    // Square
    ctx.fillStyle='#0a1a14';
    ctx.fillRect(an.x-s,an.y-s,s*2,s*2);
    ctx.strokeStyle=color;ctx.lineWidth=isSel?2.5:1.5;ctx.globalAlpha=isSel?1:0.8;
    ctx.strokeRect(an.x-s,an.y-s,s*2,s*2);ctx.globalAlpha=1;

    // Icon (portfolio symbol)
    ctx.fillStyle=color;ctx.font=`${isSel?16:13}px DM Mono`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('▤',an.x,an.y);

    // Label
    ctx.fillStyle=isSel?'#fff':isHov?'#9fe8cb':'#4a8a72';
    ctx.font=`${isSel?11:10}px DM Mono`;ctx.textAlign='center';ctx.textBaseline='top';
    const al=an.title||'portafoglio';
    const aLines=wrapText(al.length>28?al.slice(0,28)+'…':al,24);
    aLines.forEach((l,i)=>ctx.fillText(l,an.x,an.y+s+8+i*13));
    ctx.fillStyle=color;ctx.font='9px DM Mono';
    ctx.fillText('▤ portafoglio tesi',an.x,an.y+s+8+aLines.length*13+2);

    // Badge: performance dalla creazione (verde/rosso)
    const hasPerf=an.performance&&an.performance.overall;
    if(hasPerf){
      const neg=String(an.performance.overall).trim().startsWith('-');
      ctx.fillStyle=neg?'#e05555':'#4ad68a';ctx.font='11px DM Mono';
      ctx.fillText(an.performance.overall,an.x,an.y+s+8+aLines.length*13+15);
    }

    if(isHov&&!isSel){
      ctx.fillStyle=color;ctx.font='9px DM Mono';ctx.globalAlpha=0.7;
      ctx.fillText('clicca per aprire',an.x,an.y+s+8+aLines.length*13+(hasPerf?30:16));ctx.globalAlpha=1;
    }
  }

  ctx.restore(); // end pan/zoom transform
  requestAnimationFrame(loop);
}

// ── Pan/zoom interaction state ──
let isPanning=false, panMoved=false; const panStart={x:0,y:0};

// Fit the view so all nodes are visible and centered
function fitView(){
  const all=[...NODES, ...MEMORY_NODES, ...ACTION_NODES];
  if(!all.length){ VIEW.panX=0; VIEW.panY=0; VIEW.zoom=1; return; }
  const dpr=window.devicePixelRatio||1;
  const W=canvas.width/dpr, H=canvas.height/dpr;
  const isMobile = W <= 640;
  // On mobile the input bar is shorter; reserve less space and center more evenly.
  const reserveBottom = isMobile ? 70 : 110;
  const graphH = H - reserveBottom;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const n of all){ if(n.x<minX)minX=n.x; if(n.x>maxX)maxX=n.x; if(n.y<minY)minY=n.y; if(n.y>maxY)maxY=n.y; }
  // More breathing room on the narrow mobile screen
  const pad = isMobile ? 90 : 120;
  minX-=pad; minY-=pad; maxX+=pad; maxY+=pad;
  const w=maxX-minX, h=maxY-minY;
  // Allow a bit more zoom-out range on mobile so everything fits
  const minZoom = isMobile ? 0.2 : 0.3;
  const z=Math.max(minZoom, Math.min(1.4, Math.min(W/w, graphH/h)));
  VIEW.zoom=z;
  VIEW.panX = (W - w*z)/2 - minX*z;
  VIEW.panY = (graphH - h*z)/2 - minY*z;
}
window.__synFitView = fitView;

// Reset-view button: always lets the user return to the default framing
(function addResetViewBtn(){
  if(document.getElementById('reset-view-btn')) return;
  const b=document.createElement('button');
  b.id='reset-view-btn';
  b.textContent='⊙ centra';
  b.style.cssText="position:fixed;right:18px;bottom:130px;z-index:50;background:var(--bg3,#141418);color:var(--text2,#9a9aa5);border:1px solid var(--border,#2a2a33);border-radius:10px;padding:8px 14px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;opacity:0.85";
  b.addEventListener('click',()=>{ fitView(); });
  b.addEventListener('mouseenter',()=>{b.style.opacity='1';});
  b.addEventListener('mouseleave',()=>{b.style.opacity='0.85';});
  document.body.appendChild(b);

  // Export button: saves the graph as a PNG image (for sharing)
  if(!document.getElementById('export-btn')){
    const e=document.createElement('button');
    e.id='export-btn';
    e.textContent='↓ esporta';
    e.style.cssText="position:fixed;right:18px;bottom:172px;z-index:50;background:var(--bg3,#141418);color:var(--text2,#9a9aa5);border:1px solid var(--border,#2a2a33);border-radius:10px;padding:8px 14px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;opacity:0.85";
    e.addEventListener('mouseenter',()=>{e.style.opacity='1';});
    e.addEventListener('mouseleave',()=>{e.style.opacity='0.85';});
    e.addEventListener('click',exportGraphImage);
    document.body.appendChild(e);
  }
})();

function exportGraphImage(){
  try{
    const dpr=window.devicePixelRatio||1;
    const W=canvas.width, H=canvas.height;
    // Compose onto an opaque dark background (canvas itself is transparent)
    const out=document.createElement('canvas');
    out.width=W; out.height=H;
    const o=out.getContext('2d');
    o.fillStyle='#08080a';
    o.fillRect(0,0,W,H);
    o.drawImage(canvas,0,0);
    // Brand watermark bottom-right
    o.font=`${600}  ${22*dpr}px Georgia, serif`;
    o.fillStyle='rgba(255,255,255,0.5)';
    o.textAlign='right';
    o.fillText('Symnaps', W-20*dpr, H-18*dpr);
    // Trigger download
    const link=document.createElement('a');
    link.download='symnaps-grafo.png';
    link.href=out.toDataURL('image/png');
    link.click();
    if(window.posthog) try{ window.posthog.capture('graph_exported'); }catch(_){}
  }catch(err){ console.warn('export failed', err); alert('Esportazione non riuscita, riprova.'); }
}

canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect();
  // dragging the canvas pans the view
  if(isPanning){
    VIEW.panX += (e.clientX - panStart.x);
    VIEW.panY += (e.clientY - panStart.y);
    panStart.x = e.clientX; panStart.y = e.clientY;
    panMoved = true;
    return;
  }
  const sx=e.clientX-r.left, sy=e.clientY-r.top;
  const {x:mx, y:my} = screenToWorld(sx, sy);
  const hit=NODES.find(n=>{const dx=n.x-mx,dy=n.y-my;return Math.sqrt(dx*dx+dy*dy)<32});
  const memHit=MEMORY_NODES.find(mn=>{const dx=mn.x-mx,dy=mn.y-my;return Math.sqrt(dx*dx+dy*dy)<38});
  const actHit=ACTION_NODES.find(an=>Math.abs(an.x-mx)<32&&Math.abs(an.y-my)<32);
  hovNode=actHit?actHit.id:memHit?memHit.id:hit?hit.id:null;
  canvas.style.cursor=(hit||memHit||actHit)?'pointer':(isPanning?'grabbing':'grab');
});

// ── Drag-to-pan handlers ──
canvas.addEventListener('mousedown',e=>{ isPanning=true; panMoved=false; panStart.x=e.clientX; panStart.y=e.clientY; });
window.addEventListener('mouseup',()=>{ isPanning=false; });
// ── Wheel to zoom (centered on cursor) ──
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  const sx=e.clientX-r.left, sy=e.clientY-r.top;
  const before=screenToWorld(sx,sy);
  const factor = e.deltaY<0 ? 1.1 : 1/1.1;
  VIEW.zoom = Math.max(0.3, Math.min(2.5, VIEW.zoom*factor));
  const after=screenToWorld(sx,sy);
  // keep the point under the cursor fixed while zooming
  VIEW.panX += (after.x-before.x)*VIEW.zoom;
  VIEW.panY += (after.y-before.y)*VIEW.zoom;
}, {passive:false});

canvas.addEventListener('click',e=>{
  if(panMoved) return; // it was a drag, not a click
  const r=canvas.getBoundingClientRect();
  const sx=e.clientX-r.left, sy=e.clientY-r.top;
  handleTapAt(sx, sy);
});

// Shared hit-testing for both click (mouse) and tap (touch)
function handleTapAt(sx, sy){
  const {x:mx, y:my} = screenToWorld(sx, sy);
  const actHit=ACTION_NODES.find(an=>Math.abs(an.x-mx)<32&&Math.abs(an.y-my)<32);
  if(actHit){selNode=actHit.id;openActionDrawer(actHit);return;}
  const memHit=MEMORY_NODES.find(mn=>{const dx=mn.x-mx,dy=mn.y-my;return Math.sqrt(dx*dx+dy*dy)<38});
  if(memHit){selNode=memHit.id;openMemoryDrawer(memHit);return;}
  const hit=NODES.find(n=>{const dx=n.x-mx,dy=n.y-my;return Math.sqrt(dx*dx+dy*dy)<32});
  if(hit){selNode=hit.id;openDrawer(hit.task);}
  else{selNode=null;}
}

// ═══ RICERCA NEL GRAFO — task · tesi · portafogli ═══
function centerOnNode(n){
  const dpr=window.devicePixelRatio||1;
  const W=canvas.width/dpr, H=canvas.height/dpr;
  const reserveBottom = W<=640?70:110;
  const graphH=H-reserveBottom;
  VIEW.zoom=Math.min(2.5, Math.max(VIEW.zoom, 1.1));
  VIEW.panX = W/2 - n.x*VIEW.zoom;
  VIEW.panY = graphH/2 - n.y*VIEW.zoom;
}
function focusGraphEntity(kind,id){
  if(kind==='task'){ const n=NODES.find(x=>x.id===id); if(n){ centerOnNode(n); selNode=n.id; openDrawer(n.task); } }
  else if(kind==='thesis'){ const n=MEMORY_NODES.find(x=>x.id===id); if(n){ centerOnNode(n); selNode=n.id; openMemoryDrawer(n); } }
  else if(kind==='action'){ const n=ACTION_NODES.find(x=>x.id===id); if(n){ centerOnNode(n); selNode=n.id; openActionDrawer(n); } }
}
function graphSearchHits(q){
  q=(q||'').trim().toLowerCase();
  if(!q) return [];
  const out=[];
  for(const n of MEMORY_NODES){ const hay=((n.thesis||'')+' '+(n.explanation||'')+' '+(n.pattern||'')).toLowerCase(); if(hay.includes(q)) out.push({kind:'thesis',id:n.id,label:n.thesis||'(tesi)',tag:'tesi',color:n.color||'#a78bfa'}); }
  for(const an of ACTION_NODES){ const hay=((an.title||'')+' '+(an.summary||'')).toLowerCase(); if(hay.includes(q)) out.push({kind:'action',id:an.id,label:an.title||'(portafoglio)',tag:'portafoglio',color:'#34d399'}); }
  for(const n of NODES){ const t=n.task||{}; const fp=t.fingerprint||{}; const hay=((t.raw_query||'')+' '+(fp.hypothesis||'')+' '+((fp.concepts||[]).join(' '))+' '+(fp.sector||'')).toLowerCase(); if(hay.includes(q)) out.push({kind:'task',id:n.id,label:t.raw_query||'(task)',tag:'task',color:'#5b9cf6'}); }
  return out.slice(0,12);
}
function renderGraphSearch(){
  const inp=document.getElementById('gs-input'); const box=document.getElementById('gs-results');
  if(!inp||!box) return;
  const hits=graphSearchHits(inp.value);
  if(!hits.length){ box.innerHTML = inp.value.trim()? '<div style="padding:10px 12px;font-size:11px;color:#6a6a88">nessun risultato</div>' : ''; box.style.display = inp.value.trim()?'block':'none'; return; }
  box.innerHTML = hits.map((h,i)=>'<div class="gs-row" data-i="'+i+'" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:11.5px;color:#cfcfe8"><span style="flex:0 0 auto;font-size:9px;padding:2px 7px;border-radius:20px;background:'+h.color+'22;border:1px solid '+h.color+'55;color:'+h.color+'">'+h.tag+'</span><span style="flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+String(h.label).replace(/</g,'&lt;')+'</span></div>').join('');
  box.style.display='block';
  box.querySelectorAll('.gs-row').forEach(el=>{
    el.addEventListener('mouseenter',()=>{ el.style.background='#1e1e34'; });
    el.addEventListener('mouseleave',()=>{ el.style.background='transparent'; });
    el.addEventListener('click',()=>{ const h=hits[+el.dataset.i]; focusGraphEntity(h.kind,h.id); box.style.display='none'; });
  });
}
(function initGraphSearch(){
  const inp=document.getElementById('gs-input'); const box=document.getElementById('gs-results');
  if(!inp||!box) return;
  inp.addEventListener('input',renderGraphSearch);
  inp.addEventListener('focus',renderGraphSearch);
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape'){ inp.value=''; box.style.display='none'; inp.blur(); } else if(e.key==='Enter'){ const hits=graphSearchHits(inp.value); if(hits[0]){ focusGraphEntity(hits[0].kind,hits[0].id); box.style.display='none'; } } });
  document.addEventListener('click',e=>{ if(!e.target.closest('#graph-search')) box.style.display='none'; });
})();

// ═══ TOUCH (mobile): one finger = pan, two fingers = pinch-zoom, tap = open ═══
let touchPanning=false, touchMoved=false;
const touchStart={x:0,y:0};      // last position, updated each move (for pan delta)
const touchOrigin={x:0,y:0};     // initial touch position (for tap-vs-drag distance)
let pinchDist=0, pinchActive=false;

function touchPoint(t){
  const r=canvas.getBoundingClientRect();
  return { x:t.clientX-r.left, y:t.clientY-r.top };
}

canvas.addEventListener('touchstart',e=>{
  if(e.touches.length===1){
    touchPanning=true; touchMoved=false; pinchActive=false;
    touchStart.x=e.touches[0].clientX; touchStart.y=e.touches[0].clientY;
    touchOrigin.x=e.touches[0].clientX; touchOrigin.y=e.touches[0].clientY;
  } else if(e.touches.length===2){
    touchPanning=false; pinchActive=true; touchMoved=true;
    const dx=e.touches[0].clientX-e.touches[1].clientX;
    const dy=e.touches[0].clientY-e.touches[1].clientY;
    pinchDist=Math.sqrt(dx*dx+dy*dy)||1;
  }
}, {passive:false});

canvas.addEventListener('touchmove',e=>{
  e.preventDefault(); // stop the page from scrolling while interacting with the graph
  if(pinchActive && e.touches.length===2){
    const dx=e.touches[0].clientX-e.touches[1].clientX;
    const dy=e.touches[0].clientY-e.touches[1].clientY;
    const dist=Math.sqrt(dx*dx+dy*dy)||1;
    const r=canvas.getBoundingClientRect();
    const mx=((e.touches[0].clientX+e.touches[1].clientX)/2)-r.left;
    const my=((e.touches[0].clientY+e.touches[1].clientY)/2)-r.top;
    const before=screenToWorld(mx,my);
    VIEW.zoom=Math.max(0.3, Math.min(2.5, VIEW.zoom*(dist/pinchDist)));
    const after=screenToWorld(mx,my);
    VIEW.panX += (after.x-before.x)*VIEW.zoom;
    VIEW.panY += (after.y-before.y)*VIEW.zoom;
    pinchDist=dist;
  } else if(touchPanning && e.touches.length===1){
    const cx=e.touches[0].clientX, cy=e.touches[0].clientY;
    VIEW.panX += (cx - touchStart.x);
    VIEW.panY += (cy - touchStart.y);
    touchStart.x=cx; touchStart.y=cy;
    // tap vs drag: measured from the ORIGINAL touch point, not the last one
    if(Math.abs(cx-touchOrigin.x)>6 || Math.abs(cy-touchOrigin.y)>6) touchMoved=true;
  }
}, {passive:false});

canvas.addEventListener('touchend',e=>{
  if(touchPanning && !touchMoved && !pinchActive && e.changedTouches.length===1){
    const p=touchPoint(e.changedTouches[0]);
    // Suppress the synthetic "ghost click" the browser fires ~300ms after a tap.
    // Without this, the ghost click lands on the just-opened drawer backdrop and
    // closes it immediately.
    e.preventDefault();
    window.__synSuppressClick = true;
    setTimeout(()=>{ window.__synSuppressClick = false; }, 500);
    handleTapAt(p.x, p.y);
  }
  if(e.touches.length===0){ touchPanning=false; pinchActive=false; }
}, {passive:false});

loop();

// ═══ DRAWER ═══
// Alone colorato in testa al drawer, tinto per tipo di nodo
function tintDrawer(color){
  const g=document.getElementById('dr-glow');
  if(g) g.style.background='radial-gradient(ellipse 70% 100% at 50% 0%, '+color+'16, transparent 70%)';
}
function openDrawer(task){
  const color=TC[task.intent?.analysis_type]||'#5b9cf6';
  const badge=document.getElementById('dr-badge');
  badge.textContent=task.intent?.analysis_type||'analysis';
  badge.style.background=color+'22';badge.style.color=color;
  tintDrawer(color);
  const wsTag = task.output?.sources?.length
    ? ` <span style="font-size:10px;padding:2px 8px;border-radius:5px;background:#0a2a20;color:#2ecf98;vertical-align:middle;margin-left:6px">⊕ dati reali</span>`
    : ` <span style="font-size:10px;padding:2px 8px;border-radius:5px;background:var(--bg4);color:var(--text3);vertical-align:middle;margin-left:6px">training</span>`;
  document.getElementById('dr-query').innerHTML = task.raw_query + wsTag;
  renderDrawerBody(task);
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}
function closeDrawer(){
  // Ignore the ghost click that fires right after a touch tap (which would
  // otherwise close the drawer the same instant the tap opened it).
  if(window.__synSuppressClick) return;
  document.getElementById('backdrop').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  selNode=null;
}

function renderDrawerBody(task){
  const color=TC[task.intent?.analysis_type]||'#5b9cf6';
  const body=document.getElementById('dr-body');
  body.innerHTML='';

  // Verdetto — la risposta secca alla domanda, prima di tutto
  const vd=task.output?.verdict;
  if(vd&&vd.label){
    const VC={si:'#4ad68a',no:'#e05555',dipende:'#f0a030'};
    const vc=VC[vd.stance]||'#7a7a95';
    const vx=document.createElement('div');
    vx.innerHTML=`<div class="section-lbl">verdetto</div>
    <div class="verdict-box" style="background:${vc}12;border:1px solid ${vc}30">
      <div class="verdict-top">
        <span class="verdict-pill" style="color:${vc};background:${vc}1a;border:1px solid ${vc}40">${vd.stance==='si'?'sì':vd.stance||'—'}</span>
        ${vd.confidence?`<span class="verdict-conf">convinzione ${vd.confidence}</span>`:''}
      </div>
      <div class="verdict-lbl">${vd.label}</div>
    </div>
    <button class="watch-btn${watchFor(task.id)?' on':''}" id="watch-btn">${watchFor(task.id)?'✓ avviso attivo — ricontrollo ogni settimana':'🔔 avvisami se il verdetto cambia'}</button>`;
    body.appendChild(vx);
    setTimeout(()=>{ const wb=document.getElementById('watch-btn'); if(wb) wb.addEventListener('click',()=>toggleWatch(task,wb)); },100);
  }

  // Scenari bull/base/bear — tre esiti con probabilità e trigger
  if(task.output?.scenarios?.length){
    const SCEN={bull:{c:'#4ad68a',l:'rialzista'},base:{c:'#5b9cf6',l:'base'},bear:{c:'#e05555',l:'ribassista'}};
    const sc=document.createElement('div');
    sc.innerHTML=`<div class="section-lbl">scenari</div><div class="scen-grid">
    ${task.output.scenarios.slice(0,3).map(s=>{const m=SCEN[s.name]||{c:'#7a7a95',l:s.name||''};return `
      <div class="scen-cell" style="border-top-color:${m.c}66">
        <span class="scen-name" style="color:${m.c}">${m.l}</span>
        <span class="scen-prob">${s.prob||'—'}</span>
        <span class="scen-trigger">se ${s.trigger||'—'}</span>
        <span class="scen-outcome">→ ${s.outcome||''}</span>
      </div>`;}).join('')}
    </div>`;
    body.appendChild(sc);
  }

  // Punti chiave — i fatti che reggono la conclusione
  if(task.output?.takeaways?.length){
    const tk=document.createElement('div');
    tk.innerHTML=`<div class="section-lbl">punti chiave</div><div class="tk-list">
    ${task.output.takeaways.slice(0,3).map((t,i)=>`<div class="tk-row"><span class="tk-num" style="color:${color}">0${i+1}</span><span>${t}</span></div>`).join('')}
    </div>`;
    body.appendChild(tk);
  }

  // Collegamento al portafoglio — esposizione già presente al tema
  if(task.output?.portfolio_link?.note){
    const pf=document.createElement('div');
    pf.innerHTML=`<div class="section-lbl">il tuo portafoglio</div>
    <div class="pf-box"><span style="flex-shrink:0">◈</span><span>${task.output.portfolio_link.note}</span></div>`;
    body.appendChild(pf);
  }

  // Metrics
  if(task.output?.metrics?.length){
    const m=document.createElement('div');
    m.innerHTML=`<div class="section-lbl">metriche chiave</div><div class="metrics-row">
    ${task.output.metrics.slice(0,3).map(x=>`
      <div class="metric-box" style="border-bottom:2px solid ${x.pos===true?'#1f4a33':x.pos===false?'#4a1f1f':'var(--border)'}">
        <div class="metric-k">${x.k}</div>
        <div class="metric-v" style="color:${x.pos===true?'var(--green)':x.pos===false?'var(--red)':'var(--text)'}">${x.pos===true?'<span style="font-size:11px">▲</span> ':x.pos===false?'<span style="font-size:11px">▼</span> ':''}${x.v}</div>
      </div>`).join('')}
    </div>`;
    body.appendChild(m);
  }

  // Chart
  if(task.output?.chart?.values?.length){
    const cc=document.createElement('div');
    cc.innerHTML=`<div class="section-lbl">grafico</div>
    <div class="chart-box">
      <div class="chart-lbl">${task.output.chart.label||''}</div>
      <canvas class="chart-canvas" id="dc-${task.id}"></canvas>
      ${task.output.chart.asof?`<div class="chart-asof">dati al ${new Date(task.output.chart.asof).toLocaleDateString('it',{day:'numeric',month:'short'})}, ${new Date(task.output.chart.asof).toLocaleTimeString('it',{hour:'2-digit',minute:'2-digit'})}</div>`:''}
    </div>`;
    body.appendChild(cc);
    setTimeout(()=>drawChart('dc-'+task.id,task.output.chart,color),60);
  }

  // Insight
  if(task.output?.insight){
    const ins=document.createElement('div');
    ins.innerHTML=`<div class="section-lbl">analisi AI</div><div class="insight-box">${task.output.insight}</div>`;
    body.appendChild(ins);
  }

  // Catalizzatori in arrivo — il "quando ricontrollare"
  if(task.output?.catalysts?.length){
    const ct=document.createElement('div');
    ct.innerHTML=`<div class="section-lbl">catalizzatori in arrivo</div><div class="cat-list">
    ${task.output.catalysts.slice(0,4).map(c=>`
      <div class="cat-row">
        <span class="cat-when">${c.when||''}</span>
        <span><div class="cat-event">${c.event||''}</div>${c.why?`<div class="cat-why">${c.why}</div>`:''}</span>
      </div>`).join('')}
    </div>`;
    body.appendChild(ct);
  }

  // Hypothesis — meta-info, dopo il contenuto
  if(task.fingerprint?.hypothesis){
    const s=document.createElement('div');
    s.innerHTML=`<div class="section-lbl">ipotesi implicita</div><div class="hyp-box">"${task.fingerprint.hypothesis}"</div>`;
    body.appendChild(s);
  }

  // Intent grid
  const ig=document.createElement('div');
  ig.innerHTML=`<div class="section-lbl">intent estratto</div>
  <div class="intent-grid">
    <div class="icell"><span class="icell-k">assets</span><span class="icell-v">${(task.intent?.assets||[]).slice(0,3).join(', ')||'—'}</span></div>
    <div class="icell"><span class="icell-k">metriche</span><span class="icell-v">${(task.intent?.metrics||[]).slice(0,2).join(', ')||'—'}</span></div>
    <div class="icell"><span class="icell-k">periodo</span><span class="icell-v">${task.intent?.timeframe||'—'}</span></div>
    <div class="icell"><span class="icell-k">settore</span><span class="icell-v" style="color:${color}">${task.fingerprint?.sector||'—'}</span></div>
  </div>`;
  body.appendChild(ig);

  // Connections
  if(task.connections?.length){
    const co=document.createElement('div');
    co.innerHTML=`<div class="section-lbl">connessioni nel grafo (${task.connections.length})</div>
    <div class="conns-list">
    ${task.connections.map(c=>`
      <div class="conn-pill" onclick="jumpToNode('${c.task_id}')">
        <span class="conn-pct">${Math.round(c.score*100)}%</span>
        <span class="conn-type" style="color:${({contradiction:'#e05555',supports:'#4ad68a'})[c.type]||'inherit'}">${({contradiction:'⚡ contraddice',supports:'✓ rafforza',same_hypothesis:'stessa ipotesi',complementary_data:'dato complementare',same_question_type:'stesso tipo'})[c.type]||c.type.replace(/_/g,' ')}</span>
        <span class="conn-q">${c.query}</span>
      </div>`).join('')}
    </div>`;
    body.appendChild(co);
  }

  // Sources — link cliccabili quando la fonte è una citazione vera {url,title}
  // estratta dalla risposta web_search; stringa semplice per task vecchie in DB.
  function renderSourcePill(s){
    const url=s&&s.url;
    const title=String((s&&s.title)||s||'').slice(0,80).replace(/[<>"]/g,'');
    if(!url) return `<span style="font-size:10px;padding:3px 10px;border-radius:20px;background:var(--bg4);color:var(--text3);border:1px solid var(--border)">${title}</span>`;
    let host='';try{host=new URL(url).hostname.replace('www.','')}catch(e){}
    return `<a href="${url}" target="_blank" rel="noopener" style="font-size:10px;padding:3px 10px;border-radius:20px;background:var(--bg4);color:var(--blue);border:1px solid var(--border2);text-decoration:none;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle">${host?host+' · ':''}${title}</a>`;
  }
  if(task.output?.sources?.length){
    const src=document.createElement('div');
    src.innerHTML=`<div class="section-lbl">fonti</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${task.output.sources.map(renderSourcePill).join('')}
    </div>`;
    body.appendChild(src);
  }

  // Suggested questions — loads async after drawer opens
  const sqSection = document.createElement('div');
  sqSection.id = 'sq-section';
  sqSection.innerHTML = `
    <div class="section-lbl">tocca una domanda per esplorarla →</div>
    <div id="sq-loading" style="display:flex;align-items:center;gap:8px;padding:10px 0;color:var(--text3);font-size:11px">
      <div class="spinner"></div><span>Symnaps sta leggendo il tuo grafo...</span>
    </div>
    <div id="sq-list" style="display:none;flex-direction:column;gap:6px"></div>`;
  body.appendChild(sqSection);
  setTimeout(()=>loadSuggestedQuestions(task), 200);

  // Delete task button
  const delSection = document.createElement('div');
  delSection.style.cssText = 'margin-top:8px;padding-top:16px;border-top:1px solid var(--border)';
  delSection.innerHTML = `<button id="del-task-btn" style="width:100%;background:none;border:1px solid #3a1a1a;border-radius:10px;padding:11px;color:#c0506a;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .2s">elimina questa task</button>`;
  body.appendChild(delSection);
  setTimeout(()=>{
    const db=document.getElementById('del-task-btn');
    if(db){
      db.addEventListener('mouseenter',()=>{db.style.background='#1a0a0a';db.style.borderColor='#5a2a2a';});
      db.addEventListener('mouseleave',()=>{db.style.background='none';db.style.borderColor='#3a1a1a';});
      db.addEventListener('click',()=>deleteTask(task.id));
    }
  },100);
}

async function deleteTask(taskId){
  if(!confirm('Eliminare questa task? Verranno rimosse anche le sue connessioni.')) return;
  // Remove from local state
  TASKS = TASKS.filter(t=>t.id!==taskId);
  NODES = NODES.filter(n=>n.id!==taskId);
  EDGES = EDGES.filter(e=>e.from!==taskId && e.to!==taskId);
  // Remove this task from other tasks' connections
  TASKS.forEach(t=>{ if(t.connections) t.connections = t.connections.filter(c=>c.task_id!==taskId); });
  // Remove from memory node sources
  MEMORY_NODES.forEach(mn=>{ if(mn.source_ids) mn.source_ids = mn.source_ids.filter(id=>id!==taskId); });
  closeDrawer();
  updateStats();
  // Persist deletion
  if(window.__synDeleteTask) await window.__synDeleteTask(taskId);
}

const ALLOC_PALETTE=['#34d399','#5b9cf6','#a78bfa','#f0a030','#f472b6','#2ecf98','#60a5fa'];
// Allocazione come barra impilata orizzontale — coerente col linguaggio
// dell'app (barre, hairline, numeri mono) al posto della ciambella.
function buildAllocationChart(categories, color, perf){
  const cats=(categories||[]).filter(c=>c&&c.name);
  if(cats.length<2) return '';
  const parsed=cats.map(c=>{
    const m=(c.weight_hint||'').match(/(\d+(?:[.,]\d+)?)\s*%/);
    return m?parseFloat(m[1].replace(',','.')):null;
  });
  const allNumeric=parsed.every(v=>v!==null && v>0);
  const weights=allNumeric?parsed:cats.map(()=>1);
  const total=weights.reduce((a,b)=>a+b,0);
  const neg=perf&&String(perf.overall||'').trim().startsWith('-');

  const segs=cats.map((c,i)=>{
    const pct=weights[i]/total*100;
    return `<div class="al-seg2" title="${c.name}" style="width:${pct}%;background:${ALLOC_PALETTE[i%ALLOC_PALETTE.length]};animation-delay:${(0.1+i*0.07).toFixed(2)}s"></div>`;
  }).join('');

  const rows=cats.map((c,i)=>{
    const pct=Math.round(weights[i]/total*100);
    return `<div class="al-row" style="display:flex;align-items:center;gap:8px;font-size:11px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="width:8px;height:8px;border-radius:2px;background:${ALLOC_PALETTE[i%ALLOC_PALETTE.length]};flex:none"></span>
      <span style="flex:1;color:var(--text2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
      <span style="color:var(--text);font-weight:500">${pct}%</span>
    </div>`;
  }).join('');

  const perfHead=(perf&&perf.overall)?`
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px">
      <span style="font-family:'Fraunces',serif;font-size:26px;font-weight:300;color:${neg?'var(--red)':'var(--green)'}">${perf.overall}</span>
      <span style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">dal lancio</span>
    </div>`:'';
  const note=allNumeric?'':'<div style="font-size:9px;color:var(--text3);margin-top:8px;font-style:italic">Ripartizione indicativa (pesi non specificati)</div>';
  const perfNote=(perf&&perf.note)?`<div style="font-size:10px;color:var(--text3);margin-top:10px;line-height:1.5">${perf.note} · si aggiorna ogni settimana</div>`:'';

  return `
    <div>
      <div class="section-lbl">${perf&&perf.overall?'allocazione · performance':'allocazione'}</div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:16px">
        ${perfHead}
        <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;gap:2px;margin-bottom:12px">${segs}</div>
        <div>${rows}</div>
        ${note}${perfNote}
      </div>
    </div>`;
}

function openActionDrawer(an){
  if(!an)return;
  const color=an.color||'#34d399';
  const body=document.getElementById('dr-body');
  const badge=document.getElementById('dr-badge');
  badge.textContent='portafoglio tesi';
  badge.style.background=color+'22';badge.style.color=color;
  tintDrawer(color);
  document.getElementById('dr-query').innerHTML=`<span style="font-size:13px;display:block;margin-bottom:4px;opacity:.6">▤ nodo azione</span>${an.title||'Portafoglio della tesi'}`;

  const perf=an.performance;
  const perfMap={};
  ((perf&&perf.items)||[]).forEach(it=>{ if(it.ticker) perfMap[String(it.ticker).toUpperCase()]=it.perf; });

  const cats=(an.categories||[]).map((c,ci)=>{
    const dot=ALLOC_PALETTE[ci%ALLOC_PALETTE.length];
    const wm=String(c.weight_hint||'').match(/(\d+)(?!.*\d)/);
    const wpct=wm?Math.min(100,parseInt(wm[1])):null;
    return `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="width:8px;height:8px;border-radius:2px;background:${dot};flex:none"></span>
        <span style="font-size:13px;color:var(--text);font-weight:500;flex:1">${c.name}</span>
        ${c.weight_hint?`<span style="font-size:10px;color:${dot};white-space:nowrap">${c.weight_hint}</span>`:''}
      </div>
      <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:8px">${c.rationale||''}</div>
      ${wpct!==null?`<div style="height:3px;background:var(--bg4);border-radius:2px;margin-bottom:10px;overflow:hidden"><div style="height:3px;width:${wpct}%;background:linear-gradient(90deg,${dot}55,${dot});border-radius:2px"></div></div>`:''}
      <div style="display:flex;flex-direction:column;gap:5px">
        ${(c.examples||[]).map(ex=>{
          const tp=ex.ticker?perfMap[String(ex.ticker).toUpperCase()]:null;
          return `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg4);border-radius:8px">
            ${ex.ticker?`<span style="font-size:10px;font-family:'DM Mono';color:${dot};background:${dot}22;padding:2px 7px;border-radius:4px;white-space:nowrap">${ex.ticker}</span>`:''}
            <span style="font-size:12px;color:var(--text2)">${ex.name}</span>
            ${tp?`<span style="font-size:11px;font-family:'DM Mono';margin-left:auto;white-space:nowrap;color:${String(tp).trim().startsWith('-')?'var(--red)':'var(--green)'}">${tp}</span>`:ex.note?`<span style="font-size:10px;color:var(--text3);margin-left:auto">${ex.note}</span>`:''}
          </div>`;}).join('')}
      </div>
    </div>`;}).join('');

  const allocHTML=buildAllocationChart(an.categories, color, perf);
  const perfFallback=(!allocHTML&&perf&&perf.overall)?`
    <div>
      <div class="section-lbl">performance dal lancio</div>
      <div style="background:var(--bg3);border-radius:12px;padding:14px 16px;display:flex;align-items:baseline;gap:10px">
        <span style="font-size:22px;font-weight:500;color:${String(perf.overall).trim().startsWith('-')?'var(--red)':'var(--green)'}">${perf.overall}</span>
        <span style="font-size:10px;color:var(--text3)">${perf.note||'stima media del paniere'}</span>
      </div>
    </div>`:'';

  body.innerHTML=`
    <div>
      <div class="section-lbl">logica del portafoglio</div>
      <div style="background:var(--bg3);border-left:2px solid ${color};border-radius:0 12px 12px 0;padding:14px 18px;font-family:'Fraunces',serif;font-size:14px;font-weight:300;color:var(--text);line-height:1.6">${an.summary||''}</div>
    </div>
    ${allocHTML}
    ${perfFallback}
    <div>
      <div class="section-lbl">categorie e strumenti</div>
      ${cats}
    </div>
    <div style="background:#1a1505;border:1px solid #3a2800;border-radius:10px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start">
      <span style="color:#f0a030;font-size:14px;flex-shrink:0">⚠</span>
      <span style="font-size:10px;color:#9a8a6a;line-height:1.5">${an.caveat||'Contenuto puramente educativo e illustrativo. Non costituisce consulenza finanziaria né raccomandazione personalizzata. Valuta sempre in autonomia e, se necessario, consulta un professionista abilitato.'}</span>
    </div>`;

  document.getElementById('backdrop').classList.add('open');
  document.getElementById('drawer').classList.add('open');


}

function openMemoryDrawer(mn){
  if(!mn)return;
  markConfSeen(mn);
  const color=mn.color||'#a78bfa';
  const body=document.getElementById('dr-body');
  const badge=document.getElementById('dr-badge');
  if(mn.status==='confirmed'){badge.textContent='tesi confermata ✓';badge.style.background='var(--green)22';badge.style.color='var(--green)';}
  else if(mn.status==='invalidated'){badge.textContent='tesi invalidata ✕';badge.style.background='var(--red)22';badge.style.color='var(--red)';}
  else{badge.textContent='tesi emergente';badge.style.background=color+'22';badge.style.color=color;}
  tintDrawer(color);
  document.getElementById('dr-query').innerHTML=`<span style="font-size:13px;display:block;margin-bottom:4px;opacity:.6">◆ nodo memoria</span>${mn.thesis}`;

  // History timeline HTML
  const historyHTML = mn.history?.length>1 ? `
    <div>
      <div class="section-lbl">evoluzione della tesi</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${mn.history.map((h,i)=>{
          const isLatest=i===mn.history.length-1;
          const prev=mn.history[i-1];
          const delta=prev?h.confidence-prev.confidence:null;
          const deltaColor=delta>0?'var(--green)':delta<0?'var(--red)':'var(--text3)';
          const deltaStr=delta!==null?(delta>0?'↑+'+delta+'%':'↓'+delta+'%'):'';
          return `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 14px;background:${isLatest?color+'11':'var(--bg3)'};border:1px solid ${isLatest?color+'44':'var(--border)'};border-radius:10px">
            <div style="flex-shrink:0;text-align:right;min-width:60px">
              <div style="font-size:15px;font-weight:500;color:${isLatest?color:'var(--text2)'}">${h.confidence}%</div>
              ${deltaStr?`<div style="font-size:10px;color:${deltaColor}">${deltaStr}</div>`:''}
              <div style="font-size:9px;color:var(--text3);margin-top:2px">${new Date(h.date).toLocaleDateString('it',{day:'numeric',month:'short'})}</div>
            </div>
            <div style="flex:1">
              ${isLatest?`<div style="font-size:9px;color:${color};text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">ora</div>`:''}
              <div style="font-size:${isLatest?13:11}px;color:${isLatest?'var(--text)':'var(--text2)'};font-family:'Fraunces',serif;font-weight:300;font-style:italic;line-height:1.4">"${h.thesis}"</div>
              ${!isLatest&&h.thesis!==mn.history[i+1]?.thesis?`<div style="font-size:9px;color:var(--text3);margin-top:4px">→ riformulata</div>`:''}
            </div>
          </div>`;
        }).reverse().join('')}
      </div>
    </div>` : '';

  const h0=mn.history&&mn.history[0], hN=mn.history&&mn.history[mn.history.length-1];
  const ageDays=(h0&&h0.date)?Math.max(0,Math.round((Date.now()-new Date(h0.date).getTime())/864e5)):null;
  const revs=mn.history?Math.max(0,mn.history.length-1):0;
  const dTot=(h0&&hN)?((hN.confidence||0)-(h0.confidence||0)):0;
  const expo=[...new Set((mn.source_ids||[]).flatMap(sid=>{
    const t=TASKS.find(x=>x.id===sid);
    return t?[...(t.intent?.assets||[]).slice(0,2), t.fingerprint?.sector].filter(Boolean):[];
  }))].slice(0,8);
  const statHTML=`
    <div>
      <div class="intent-grid">
        <div class="icell"><span class="icell-k">sorgenti</span><span class="icell-v">${(mn.source_ids||[]).length} task</span></div>
        <div class="icell"><span class="icell-k">età</span><span class="icell-v">${ageDays!==null?ageDays+' giorni':'—'}</span></div>
        <div class="icell"><span class="icell-k">revisioni</span><span class="icell-v">${revs}</span></div>
        <div class="icell"><span class="icell-k">Δ confidenza</span><span class="icell-v" style="color:${dTot>0?'var(--green)':dTot<0?'var(--red)':'var(--text2)'}">${dTot>0?'+':''}${dTot}%</span></div>
      </div>
      ${expo.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${expo.map(e=>`<span style="font-size:10px;padding:3px 10px;border-radius:20px;background:${color}11;border:1px solid ${color}33;color:${color}cc">${e}</span>`).join('')}</div>`:''}
    </div>`;
  // Track record: stato di vita + accuratezza dedotti dai segnali reali (Fase 1).
  const stMap={active:{l:'in corso',c:'var(--text2)',bg:'var(--bg3)'},confirmed:{l:'confermata ✓',c:'var(--green)',bg:'#0f2a1c'},invalidated:{l:'invalidata ✕',c:'var(--red)',bg:'#2a0f0f'}};
  const stt=stMap[mn.status||'active']||stMap.active;
  const accStr=(mn.accuracy==null)?'—':mn.accuracy+'%';
  const trackHTML=`
    <div>
      <div class="section-lbl">track record</div>
      <div style="display:flex;gap:8px;align-items:stretch">
        <div style="flex:1;background:${stt.bg};border:1px solid ${stt.c}33;border-radius:10px;padding:10px 12px">
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">stato</div>
          <div style="font-size:14px;font-weight:500;color:${stt.c}">${stt.l}</div>
        </div>
        <div style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">accuratezza</div>
          <div style="font-size:14px;font-weight:500;color:var(--text)">${accStr}</div>
        </div>
        <div style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">segnali</div>
          <div style="font-size:14px;font-weight:500;color:var(--text)">${mn.signals_hit||0}/${mn.signals_total||0}</div>
        </div>
      </div>
    </div>`;
  // Pubblicazione nel marketplace (opt-in per tesi). Solo tesi native, non
  // quelle a loro volta importate (evita ricircolo).
  const pub=!!mn.is_public;
  const publishHTML=`
    <div>
      <div class="section-lbl">marketplace</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--bg3);border:1px solid ${pub?color+'55':'var(--border)'};border-radius:10px;padding:10px 14px">
        <div style="font-size:11px;color:var(--text2);line-height:1.5">${pub?'Pubblica: altri possono trovarla e importarla':'Privata: visibile solo a te'}</div>
        <button id="mem-publish-${mn.id}" data-cluster="${mn.clusterId}" data-pub="${pub?1:0}" style="flex-shrink:0;background:${pub?color:'transparent'};color:${pub?'#08080a':'var(--text2)'};border:1px solid ${pub?color:'var(--border)'};border-radius:8px;padding:6px 12px;font-size:11px;font-weight:500;cursor:pointer">${pub?'pubblicata ✓':'pubblica'}</button>
      </div>
    </div>`;
  const sg=mn.signals;
  const signalsHTML=(sg&&(((sg.confirm||[]).length)||((sg.invalidate||[]).length)))?`
    <div>
      <div class="section-lbl">segnali da monitorare</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--bg3);border:1px solid #1f4a3366;border-radius:10px;padding:10px 12px">
          <div style="font-size:9px;color:var(--green);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">la rafforzano</div>
          ${(sg.confirm||[]).map(s=>{const o=(typeof s==='string')?{text:s}:(s||{});const b=o.fired?` <span style="color:var(--green);font-size:9px">● scattato</span>`:(o.checked_at?` <span style="color:#6a6a88;font-size:9px">○ non ancora</span>`:'');return `<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-bottom:5px">✓ ${o.text||''}${b}</div>`;}).join('')}
        </div>
        <div style="background:var(--bg3);border:1px solid #4a1f1f66;border-radius:10px;padding:10px 12px">
          <div style="font-size:9px;color:var(--red);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">la indeboliscono</div>
          ${(sg.invalidate||[]).map(s=>{const o=(typeof s==='string')?{text:s}:(s||{});const b=o.fired?` <span style="color:var(--red);font-size:9px">● scattato</span>`:(o.checked_at?` <span style="color:#6a6a88;font-size:9px">○ non ancora</span>`:'');return `<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-bottom:5px">✗ ${o.text||''}${b}</div>`;}).join('')}
        </div>
      </div>
    </div>`:'';

  body.innerHTML=`
    <div>
      <div class="section-lbl">tesi corrente</div>
      <div class="memory-thesis" style="border-left-color:${color}">"${mn.thesis}"</div>
    </div>
    ${trackHTML}
    ${publishHTML}
    ${statHTML}
    <div>
      <div class="section-lbl">confidenza</div>
      <div class="memory-confidence">
        <div class="conf-bar-wrap"><div class="conf-bar" id="conf-bar-${mn.id}" style="width:0%;background:linear-gradient(90deg,${color}88,${color})"></div></div>
        <span class="conf-label" style="color:${color}">${mn.confidence}%</span>
      </div>
      <div style="font-size:11px;color:var(--text3);line-height:1.6">${mn.explanation||''}</div>
    </div>
    <div>
      <div class="section-lbl">pattern rilevato</div>
      <div style="background:var(--bg3);border-radius:12px;padding:14px 16px;font-size:13px;color:var(--text2);line-height:1.7;font-family:'Fraunces',serif;font-weight:300">${mn.pattern||''}</div>
    </div>
    <div>
      <div class="section-lbl">portafoglio della tesi</div>
      <div id="mem-portfolio-area-${mn.id}"></div>
    </div>
    ${historyHTML}
    <div>
      <div class="section-lbl">task sorgente (${(mn.source_ids||[]).length})</div>
      <div class="memory-sources">
        ${(mn.source_ids||[]).map((sid,i)=>{
          const t=TASKS.find(x=>x.id===sid);
          return t?`<div class="source-pill mem-source-pill" data-id="${sid}" style="cursor:pointer;border-color:${color}22">
            <span class="source-num" style="color:${color}">${i+1}</span>
            <span class="source-q">${t.raw_query}</span>
          </div>`:'';
        }).join('')}
      </div>
    </div>
    ${signalsHTML}
    <div>
      <div class="section-lbl">avvocato del diavolo</div>
      <div id="mem-challenge-area-${mn.id}"></div>
    </div>
    <div>
      <div class="section-lbl">prossimo passo suggerito</div>
      <div id="mem-suggested-q-${mn.id}" style="background:${color}11;border:1px dashed ${color}44;border-radius:12px;padding:14px 16px;font-size:12px;color:${color};cursor:pointer;line-height:1.5">
        → ${mn.suggested_question||'—'}
      </div>
    </div>`;

  setTimeout(()=>{
    const b=document.getElementById(`conf-bar-${mn.id}`);if(b)b.style.width=mn.confidence+'%';
    const sq=document.getElementById(`mem-suggested-q-${mn.id}`);
    if(sq&&mn.suggested_question)sq.addEventListener('click',()=>setQAndClose(mn.suggested_question, mn.clusterId));
    document.querySelectorAll('.mem-source-pill').forEach(el=>{
      el.addEventListener('click',()=>jumpToNode(el.dataset.id));
    });
    const pubBtn=document.getElementById(`mem-publish-${mn.id}`);
    if(pubBtn)pubBtn.addEventListener('click',async()=>{
      const next=!mn.is_public;
      pubBtn.disabled=true;pubBtn.textContent='…';
      try{
        const r=await fetch('/api/market/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clusterId:mn.clusterId,public:next})});
        if(!r.ok)throw 0;
        mn.is_public=next;
        openMemoryDrawer(mn); // re-render con lo stato aggiornato
      }catch(e){pubBtn.disabled=false;pubBtn.textContent='riprova';}
    });
    renderPortfolioArea(mn);
    renderChallengeArea(mn);
  },100);
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

// Renders the on-demand portfolio control inside the thesis panel
function renderPortfolioArea(mn){
  const area=document.getElementById(`mem-portfolio-area-${mn.id}`);
  if(!area)return;
  const color=mn.color||'#a78bfa';
  const exists=ACTION_NODES.find(a=>a.clusterId===mn.clusterId);
  const inFlight=window.__synActionInFlight && window.__synActionInFlight[mn.clusterId];
  if(exists){
    area.innerHTML=`<div style="background:#34d39911;border:1px solid #34d39944;border-radius:12px;padding:14px 16px;font-size:12px;color:#34d399;line-height:1.5">▤ portafoglio già generato — lo trovi come quadrato verde collegato a questa tesi sul grafo</div>`;
  } else if(inFlight){
    area.innerHTML=`<div style="background:var(--bg3);border-radius:12px;padding:14px 16px;font-size:12px;color:var(--text3)">generazione in corso…</div>`;
  } else if(mn.confidence<75){
    area.innerHTML=`<div style="background:var(--bg3);border-radius:12px;padding:14px 16px;font-size:12px;color:var(--text3);line-height:1.5">Il portafoglio si può generare quando la tesi raggiunge il 75% di confidenza (ora ${mn.confidence}%). Continua a fare domande sul tema per rafforzarla.</div>`;
  } else {
    area.innerHTML=`<button id="gen-portfolio-${mn.id}" style="width:100%;background:#34d39915;border:1px solid #34d39955;border-radius:12px;padding:14px 16px;font-size:13px;color:#34d399;cursor:pointer;font-family:inherit;transition:background .2s">⊞ genera portafoglio da questa tesi</button>
    <div style="font-size:10px;color:var(--text3);margin-top:8px;line-height:1.5">Traduce la tesi in categorie di asset e strumenti, con taglio educativo.</div>`;
    const btn=document.getElementById(`gen-portfolio-${mn.id}`);
    if(btn){
      btn.addEventListener('mouseenter',()=>btn.style.background='#34d39925');
      btn.addEventListener('mouseleave',()=>btn.style.background='#34d39915');
      btn.addEventListener('click',async()=>{
        btn.disabled=true;
        btn.textContent='generazione in corso…';
        btn.style.cursor='default';
        await genActionForThesis(mn);
        renderPortfolioArea(mn); // refresh to show the "already generated" state
      });
    }
  }
}
window.renderPortfolioArea = renderPortfolioArea;

// ═══ AVVOCATO DEL DIAVOLO ═══
// Renders the challenge (counter-thesis) area inside the thesis panel
function renderChallengeArea(mn){
  const area=document.getElementById(`mem-challenge-area-${mn.id}`);
  if(!area)return;
  const ch=mn.challenge;
  const inFlight=window.__synChallengeInFlight && window.__synChallengeInFlight[mn.clusterId];
  if(ch){
    area.innerHTML=`
      <div style="background:#e0557711;border-left:2px solid #e05577;border-radius:0 12px 12px 0;padding:14px 18px;font-family:'Fraunces',serif;font-size:14px;font-weight:300;font-style:italic;color:#f0a0b8;line-height:1.6">"${ch.counter_thesis}"</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
        ${(ch.arguments||[]).map(a=>`<div style="background:var(--bg3);border:1px solid #e0557722;border-radius:10px;padding:10px 14px">
          <div style="font-size:12px;color:var(--text);margin-bottom:3px">⚔ ${a.point}</div>
          <div style="font-size:10px;color:var(--text3);line-height:1.5">${a.evidence||''}</div>
        </div>`).join('')}
      </div>
      ${(ch.weak_spots||[]).length?`<div style="margin-top:10px;font-size:11px;color:var(--text3);line-height:1.6">punti deboli: ${(ch.weak_spots||[]).join(' · ')}</div>`:''}
      ${ch.what_would_confirm?`<div style="margin-top:8px;font-size:11px;color:var(--green);line-height:1.6">✓ ti darebbe ragione: ${ch.what_would_confirm}</div>`:''}`;
  } else if(inFlight){
    area.innerHTML=`<div style="background:var(--bg3);border-radius:12px;padding:14px 16px;font-size:12px;color:var(--text3)">costruzione del caso contrario…</div>`;
  } else {
    area.innerHTML=`<button id="gen-challenge-${mn.id}" style="width:100%;background:#e0557715;border:1px solid #e0557755;border-radius:12px;padding:14px 16px;font-size:13px;color:#e05577;cursor:pointer;font-family:inherit;transition:background .2s">⚔ sfida questa tesi</button>
    <div style="font-size:10px;color:var(--text3);margin-top:8px;line-height:1.5">Costruisce il miglior caso contrario con dati aggiornati — per testare la solidità della tesi.</div>`;
    const btn=document.getElementById(`gen-challenge-${mn.id}`);
    if(btn){
      btn.addEventListener('mouseenter',()=>btn.style.background='#e0557725');
      btn.addEventListener('mouseleave',()=>btn.style.background='#e0557715');
      btn.addEventListener('click',async()=>{
        btn.disabled=true; btn.textContent='costruzione del caso contrario…'; btn.style.cursor='default';
        await genChallengeForThesis(mn);
        renderChallengeArea(mn);
      });
    }
  }
}

async function genChallengeForThesis(mn){
  // In-flight guard: same pattern as genActionForThesis (no double billing)
  window.__synChallengeInFlight = window.__synChallengeInFlight || {};
  if(window.__synChallengeInFlight[mn.clusterId]) return;
  window.__synChallengeInFlight[mn.clusterId] = true;
  try{
    const res=await fetch('/api/challenge',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({thesis:mn.thesis, explanation:mn.explanation, clusterId:mn.clusterId})
    });
    const json=await res.json();
    if(json.error||!json.result){
      if(json.error==='limit_reached') alert('Limite mensile di chiamate AI raggiunto.');
      return;
    }
    mn.challenge=json.result; // già persistita server-side dalla route
    try{ if(window.posthog) window.posthog.capture('thesis_challenged'); }catch(e){}
  }catch(e){ console.warn('genChallenge failed', e); }
  finally{ if(window.__synChallengeInFlight) window.__synChallengeInFlight[mn.clusterId] = false; }
}

function setQAndClose(q,originId){
  if(originId) pendingOrigin={kind:'thesis',ref:originId,q:(q||'').trim()};
  closeDrawer();
  // Flag all memory nodes to refresh suggested question
  MEMORY_NODES.forEach(mn=>mn.suggested_question=null);
  setTimeout(()=>{document.getElementById('qi').value=q;document.getElementById('qi').focus();},400);
}


async function genActionForThesis(mn){
  // Only if confidence >= 75 and no action node yet for this cluster
  if(mn.confidence < 75) return;
  if(ACTION_NODES.find(a=>a.clusterId===mn.clusterId)) return;
  // In-flight guard: prevent duplicate parallel calls for the same cluster.
  // The API call takes seconds; without this, a second checkMemoryNode() could
  // fire another portfolio request before the first one finished (double billing).
  window.__synActionInFlight = window.__synActionInFlight || {};
  if(window.__synActionInFlight[mn.clusterId]) return;
  window.__synActionInFlight[mn.clusterId] = true;
  try{
    const res=await fetch('/api/portfolio',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({thesis:mn.thesis, pattern:mn.pattern})
    });
    const json=await res.json();
    if(json.error||!json.result) return;
    const p=json.result;

    // Position the action node near its memory node but offset
    const _dpr=window.devicePixelRatio||1;
    const W=canvas.width/_dpr,H=canvas.height/_dpr,graphH=H-110;
    let ax=Math.min(Math.max(mn.x+90,120),W-120);
    let ay=Math.min(Math.max(mn.y+90,100),graphH-80);

    const action={
      id:'act_'+mn.clusterId+'_'+Date.now(),
      clusterId:mn.clusterId,
      sourceMemId:mn.id,
      title:p.title, summary:p.summary, categories:p.categories||[], caveat:p.caveat,
      x:ax, y:ay, color:ACTION_COLOR, phaseOffset:Math.random()*Math.PI*2
    };
    ACTION_NODES.push(action);
    try{ if(window.posthog) window.posthog.capture('portfolio_generated',{total_portfolios:ACTION_NODES.length}); }catch(e){}
    persistAction(action);
  }catch(e){ console.warn('genAction failed', e); }
  finally{ if(window.__synActionInFlight) window.__synActionInFlight[mn.clusterId] = false; }
}
async function persistAction(a){ if(window.__synSaveAction) await window.__synSaveAction(a); }

// Returns true if two thesis texts are essentially about the same topic.
// Used to prevent near-duplicate theses from appearing as separate nodes.
function thesisSimilar(a, b){
  if(!a||!b) return false;
  const norm=s=>s.toLowerCase().replace(/[^a-zà-ù0-9\s]/g,' ').split(/\s+/)
    .filter(w=>w.length>3); // keep meaningful words only
  const wa=new Set(norm(a)), wb=new Set(norm(b));
  if(wa.size===0||wb.size===0) return false;
  let common=0;
  for(const w of wa){ if(wb.has(w)) common++; }
  // Jaccard-like overlap relative to the smaller set
  const overlap=common/Math.min(wa.size, wb.size);
  return overlap>=0.55; // 55%+ shared significant words → same thesis
}

function developProto(q){
  if(!q) return;
  const qi=document.getElementById('qi');
  qi.value=q; qi.focus(); try{qi.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}
}
// Spunti generati dal portafoglio al primo accesso (seed). Mostrati nel
// pannello finché non emergono tesi vere; cliccabili per partire l'analisi.
let SEED_SPUNTI=[];
async function seedFromPortfolio(){
  const holdings=Array.isArray(window.__SYN_PORTFOLIO)?window.__SYN_PORTFOLIO:[];
  if(!holdings.length) return false;
  try{
    const res=await fetch('/api/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const json=await res.json();
    const qs=(json.result&&json.result.questions)||[];
    if(!qs.length) return false;
    SEED_SPUNTI=qs.slice(1);            // gli altri restano come spunti cliccabili
    renderProtoTheses();
    const qi=document.getElementById('qi');
    if(qi){ qi.value=qs[0].q; runTask(); } // auto-analizza la prima → grafo non vuoto subito
    return true;
  }catch(e){ console.warn('seed dal portafoglio fallito',e); return false; }
}
async function runSpunto(i){
  const s=SEED_SPUNTI[i]; if(!s) return;
  SEED_SPUNTI.splice(i,1);
  renderProtoTheses();
  const qi=document.getElementById('qi');
  if(qi){ qi.value=s.q; runTask(); }
}
window.runSpunto=runSpunto;

function renderProtoTheses(){
  const panel=document.getElementById('proto-panel');
  if(!panel) return;
  const list=(PROTO_THESES||[]).slice(0,4);
  if(!list.length){
    // Spunti dal portafoglio (seed): mostrali finché non ci sono tesi vere.
    if(SEED_SPUNTI && SEED_SPUNTI.length){
      panel.classList.add('show');
      const cntS=document.getElementById('proto-count'); if(cntS) cntS.textContent=SEED_SPUNTI.length;
      const bS=document.getElementById('proto-body');
      if(bS) bS.innerHTML=SEED_SPUNTI.map((q,i)=>'<div class="proto-row"><div class="proto-thesis">'+(q.q||'').replace(/</g,'&lt;')+'</div><div class="proto-meta" style="color:var(--text3);line-height:1.4">'+(q.reason||'').replace(/</g,'&lt;')+'</div><button class="proto-dev" onclick="runSpunto('+i+')">esplora →</button></div>').join('');
      return;
    }
    // Cold start: poche domande e nessuna tesi ancora → trasforma il vuoto in
    // promessa invece di nascondere il pannello.
    const tn=(typeof TASKS!=='undefined'&&TASKS)?TASKS.length:0;
    if(tn>0 && tn<5){
      panel.classList.add('show');
      const cnt0=document.getElementById('proto-count'); if(cnt0) cnt0.textContent='0';
      const b0=document.getElementById('proto-body');
      if(b0) b0.innerHTML='<div style="font-size:11px;color:var(--text2);line-height:1.6;padding:4px 2px">Ancora poche domande. Le tesi emergono da ~5 domande collegate: continua a esplorare e qui vedrai quelle che stanno maturando.</div>';
      return;
    }
    panel.classList.remove('show'); return;
  }
  panel.classList.add('show');
  const cnt=document.getElementById('proto-count'); if(cnt) cnt.textContent=list.length;
  const body=document.getElementById('proto-body'); if(!body) return;
  body.innerHTML=list.map(p=>{
    const t=(p.thesis||'').replace(/"/g,'&quot;');
    const sq=(p.suggested_question||'').replace(/"/g,'&quot;');
    const ex=(p.explanation||'').replace(/"/g,'&quot;');
    const need = p.sources<2 ? 'serve 1 domanda in più' : 'conferma '+p.confidence+'%';
    return '<div class="proto-row">'+
      '<div class="proto-thesis" title="'+ex+'">'+t+'</div>'+
      '<div class="proto-meta"><span class="proto-bar"><i style="width:'+Math.min(100,p.confidence)+'%"></i></span><span class="proto-need">'+need+'</span></div>'+
      (sq?'<button class="proto-dev" data-q="'+sq+'">sviluppa →</button>':'')+
    '</div>';
  }).join('');
  body.querySelectorAll('.proto-dev').forEach(el=>el.addEventListener('click',()=>developProto(el.dataset.q)));
}
async function checkMemoryNode(){
  if(TASKS.length<5||memCheckPending)return;
  memCheckPending=true;
  try{
    const summary=TASKS.map((t,i)=>`[${i+1}] query:"${t.raw_query}" | hypothesis:"${t.fingerprint?.hypothesis||''}" | concepts:${(t.fingerprint?.concepts||[]).join(',')} | sector:${t.fingerprint?.sector||''} | type:${t.intent?.analysis_type||''} | verdict:${t.output?.verdict?.stance||'n/d'}/${t.output?.verdict?.confidence||'n/d'}`).join('\n');

    const res=await fetch('/api/memory',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        summary,
        taskCount: TASKS.length,
        theses: MEMORY_NODES.map(m=>({id:m.clusterId, thesis:m.thesis, confidence:m.confidence}))
      })
    });
    const json=await res.json();
    if(json.error||!json.result)return;
    const raw=JSON.stringify(json.result);
    const parsed=JSON.parse(raw);
    if(!parsed.clusters?.length)return;

    const _dpr2=window.devicePixelRatio||1;
    const W=canvas.width/_dpr2,H=canvas.height/_dpr2,graphH=H-110;
    const now=new Date();
    const protos=[]; // tesi in formazione (promettenti, non ancora solide)

    for(const cluster of parsed.clusters){
      if(cluster.confidence<50)continue;
      const sourceIds=(cluster.source_indices||[]).map(i=>TASKS[i-1]?.id).filter(Boolean);

      // Match: l'id esistente lo decide il MODELLO (action update), che vede
      // tutte le tesi e deduplica semanticamente; i vecchi fallback restano
      // come cintura di sicurezza.
      let existing=null;
      if(cluster.action==='update'&&cluster.existing_id){
        existing=MEMORY_NODES.find(mn=>mn.clusterId===cluster.existing_id);
      }
      if(!existing) existing=MEMORY_NODES.find(mn=>mn.clusterId===cluster.id);
      if(!existing) existing=MEMORY_NODES.find(mn=>thesisSimilar(mn.thesis, cluster.thesis));

      // Guardia anti-proliferazione (Bilanciata) + cattura 'tesi in formazione'
      if(!existing){
        const solid = MEMORY_NODES.length<10 && sourceIds.length>=2 && cluster.confidence>=68;
        if(!solid){
          // promettente ma non ancora solida: finisce nella lista da sviluppare
          if(cluster.confidence>=50 && !MEMORY_NODES.some(mn=>thesisSimilar(mn.thesis,cluster.thesis)))
            protos.push({id:cluster.id,thesis:cluster.thesis,confidence:cluster.confidence,sources:sourceIds.length,suggested_question:cluster.suggested_question,explanation:cluster.explanation});
          continue;
        }
      }

      if(existing){
        // Identità del cluster confermata dal modello, ma il CONTENUTO della tesi
        // (testo + confidence) NON si riscrive a ogni re-clustering: quello produceva
        // update continui e incomprensibili (numero ballerino di Haiku) e, peggio,
        // resettava updated_at impedendo per sempre al refresh macro/web di partire.
        // Evolve SOLO con dati reali: (1) refresh settimanale /api/refresh
        // (Sonnet + web_search + macro FRED), (2) ingresso di una NUOVA task nel cluster.
        const prevSet=new Set(existing.source_ids||[]);
        const gotNewSource=sourceIds.some(id=>!prevSet.has(id));
        if(gotNewSource){
          const changed=existing.thesis!==cluster.thesis||existing.confidence!==cluster.confidence;
          if(changed){
            existing.history.push({thesis:existing.thesis,confidence:existing.confidence,date:now.toISOString()});
          }
          existing.thesis=cluster.thesis;
          existing.confidence=cluster.confidence;
          existing.explanation=cluster.explanation;
          existing.pattern=cluster.pattern;
          if(cluster.signals) existing.signals=cluster.signals;
          existing.source_ids=sourceIds;
          if(existing.suggested_question===null) existing.suggested_question=cluster.suggested_question;
          persistThesis(existing);
        }
        // Portfolio is now generated on demand (button in the thesis panel), not automatically.
      } else {
        // New cluster — find empty position
        let bestX=W/2,bestY=graphH/2,bestDist=0;
        const allObstacles=[...NODES,...MEMORY_NODES];
        const candidates=[];
        for(let tx=130;tx<W-130;tx+=90) for(let ty=110;ty<graphH-90;ty+=90) candidates.push([tx,ty]);
        for(const [tx,ty] of candidates){
          const minD=allObstacles.reduce((m,n)=>{const dx=n.x-tx,dy=n.y-ty;return Math.min(m,Math.sqrt(dx*dx+dy*dy));},Infinity);
          if(minD>bestDist){bestDist=minD;bestX=tx;bestY=ty;}
        }

        const colorIdx=MEMORY_NODES.length%MEMORY_COLORS.length;
        const newNode={
          id:'mem_'+cluster.id+'_'+Date.now(),
          clusterId:cluster.id,
          x:bestX, y:bestY,
          color:MEMORY_COLORS[colorIdx],
          phaseOffset:Math.random()*Math.PI*2,
          thesis:cluster.thesis,
          confidence:cluster.confidence,
          explanation:cluster.explanation,
          pattern:cluster.pattern,
          signals:cluster.signals||null,
          source_ids:sourceIds,
          suggested_question:cluster.suggested_question,
          history:[{thesis:cluster.thesis,confidence:cluster.confidence,date:now.toISOString()}],
          created_at:now
        };
        MEMORY_NODES.push(newNode);
        try{ if(window.posthog) window.posthog.capture('thesis_emerged',{confidence:newNode.confidence, total_theses:MEMORY_NODES.length}); }catch(e){}
        persistThesis(newNode);
        // Portfolio is now generated on demand (button in the thesis panel), not automatically.

        // Notify
        const notif=document.getElementById('mem-notif');
        const shortT=cluster.thesis.length>45?cluster.thesis.slice(0,45)+'…':cluster.thesis;
        document.getElementById('mem-notif-text').textContent=`◆ nuova tesi: "${shortT}"`;
        notif.classList.add('show');
        setTimeout(()=>notif.classList.remove('show'),7000);
      }
    }

    PROTO_THESES = protos; renderProtoTheses();
    console.log('[memory] cluster:', parsed.clusters.length, '· tesi in formazione (proto):', protos.length, protos.map(x=>x.thesis));

    // Update notification button to open first memory node
    document.getElementById('mem-notif').querySelector('.mem-notif-btn').onclick=
      ()=>MEMORY_NODES.length?openMemoryDrawer(MEMORY_NODES[MEMORY_NODES.length-1]):null;

  }catch(e){console.warn('memory node check failed',e);}
  finally{memCheckPending=false;}
}

function renderSuggestedQuestions(questions,originId){
  const loading=document.getElementById('sq-loading');
  const list=document.getElementById('sq-list');
  if(!loading||!list)return;
  loading.style.display='none';
  list.style.display='flex';
  list.innerHTML=questions.map((q,i)=>`
    <div class="sq-pill" data-q="${q.q.replace(/"/g,'&quot;')}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <span style="color:var(--teal);font-size:10px;margin-top:1px;flex-shrink:0">${i+1}</span>
        <div>
          <div class="sq-q">${q.q}</div>
          <div class="sq-reason">${q.reason}</div>
        </div>
        <span class="sq-arrow">\u2192</span>
      </div>
    </div>`).join('');
  list.querySelectorAll('.sq-pill').forEach(el=>{
    el.addEventListener('click',()=>{
      pendingOrigin=originId?{kind:'task',ref:originId,q:el.dataset.q}:null;
      closeDrawer();
      setTimeout(()=>{
        document.getElementById('qi').value=el.dataset.q;
        document.getElementById('qi').focus();
      },400);
    });
  });
}

async function loadSuggestedQuestions(task){
  const loading=document.getElementById('sq-loading');
  const list=document.getElementById('sq-list');
  if(!loading||!list)return;

  // CACHE: if already generated for this task, reuse (no API call)
  if(task.suggestedQuestions && task.suggestedQuestions.length){
    renderSuggestedQuestions(task.suggestedQuestions, task.id);
    return;
  }

  try{
    // Build context: this task + its connections + memory node if exists
    const connContext=task.connections.map(c=>`- "${c.query}" (${c.type.replace(/_/g,' ')})`).join('\n')||'nessuna';
    const memContext=MEMORY_NODES.length?`\nTesi emergenti: ${MEMORY_NODES.map(mn=>mn.thesis).join('; ')}`:'';
    const graphContext=TASKS.length>1?`\nAltre task nel grafo: ${TASKS.filter(t=>t.id!==task.id).map(t=>`"${t.raw_query}"`).slice(0,6).join(', ')}`:'';

    const userMsg=`Task analizzata: "${task.raw_query}"
Ipotesi implicita: "${task.fingerprint?.hypothesis||''}"
Assets: ${(task.intent?.assets||[]).join(', ')}
Tipo: ${task.intent?.analysis_type||''}
Connessioni esistenti:
${connContext}${memContext}${graphContext}`;

    const res=await fetch('/api/suggest',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userMsg})
    });
    const json=await res.json();
    if(json.error)throw new Error(json.error);
    const raw=JSON.stringify(json.result);
    const parsed=JSON.parse(raw);

    if(!loading||!list)return; // drawer might have closed
    // Save to task object so reopening doesn't re-call the API
    task.suggestedQuestions = parsed.questions;
    renderSuggestedQuestions(parsed.questions, task.id);

  }catch(e){
    if(loading)loading.innerHTML='<span style="color:var(--text3);font-size:11px">\u2014</span>';
  }
}

function jumpToNode(id){
  closeDrawer();
  setTimeout(()=>{
    const n=NODES.find(x=>x.id===id);
    if(n){selNode=n.id;openDrawer(n.task);}
  },400);
}

function drawLineLWC(canvas,chart,color,vals,labels,fmt){
  try{
    const {createChart,AreaSeries,ColorType}=window.__SYN_LWC;
    const host=document.createElement('div');
    const last=vals[vals.length-1];
    const head=document.createElement('div');
    head.style.cssText='display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px';
    const lFirst=labels[0]||'', lLast=labels[labels.length-1]||'';
    head.innerHTML='<span style="font-size:16px;color:'+(last>=0?'var(--green)':'var(--red)')+'">'+fmt(last)+'</span>'+(lFirst&&lLast?'<span style="font-size:9px;color:var(--text3)">'+lFirst+' → '+lLast+'</span>':'');
    host.appendChild(head);
    const wrap=document.createElement('div');
    wrap.style.cssText='position:relative;height:150px';
    host.appendChild(wrap);
    canvas.replaceWith(host);
    try{
      const cs=getComputedStyle(document.documentElement);
      const cv=n=>cs.getPropertyValue(n).trim();
      const ch=createChart(wrap,{
        autoSize:true,
        layout:{background:{type:ColorType.Solid,color:'transparent'},textColor:cv('--text2'),fontFamily:'DM Mono',fontSize:9,attributionLogo:false},
        grid:{vertLines:{visible:false},horzLines:{color:cv('--border')}},
        rightPriceScale:{borderVisible:false},
        timeScale:{borderVisible:false,tickMarkFormatter:t=>labels[t]||''},
        localization:{timeFormatter:t=>labels[t]||'',priceFormatter:p=>fmt(p)},
        crosshair:{vertLine:{color:cv('--border2'),labelBackgroundColor:cv('--bg4')},horzLine:{color:cv('--border2'),labelBackgroundColor:cv('--bg4')}},
        handleScroll:false,handleScale:false
      });
      const s=ch.addSeries(AreaSeries,{lineColor:color,lineWidth:2,topColor:color+'33',bottomColor:color+'00',priceLineVisible:false});
      s.setData(vals.map((v,i)=>({time:i,value:v})));
      const mn=Math.min(...vals),mx=Math.max(...vals);
      if(mn<0&&mx>0)s.createPriceLine({price:0,color:cv('--border2'),lineWidth:1,lineStyle:2,axisLabelVisible:false});
      ch.timeScale().fitContent();
      window.__SYN_CHARTS=window.__SYN_CHARTS||{};
      if(window.__SYN_CHARTS[canvas.id]){try{window.__SYN_CHARTS[canvas.id].remove();}catch(e){}}
      window.__SYN_CHARTS[canvas.id]=ch;
      return true;
    }catch(e){host.replaceWith(canvas);throw e;}
  }catch(e){console.warn('lwc fallback su canvas',e);return false;}
}

function drawChart(id,chart,color){
  const canvas=document.getElementById(id);
  if(!canvas)return;
  const pairs=(chart.values||[]).map((v,i)=>[Number(v),(chart.labels||[])[i]]).filter(p=>!isNaN(p[0]));
  const vals=pairs.map(p=>p[0]);
  const labels=pairs.map(p=>String(p[1]??''));
  if(!vals.length){canvas.style.display='none';return;}
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||400;
  const c=canvas.getContext('2d');
  const sfx=chart.suffix||'';
  const fmt=v=>{
    if(Math.abs(v)>=1000) return (v/1000).toFixed(1).replace(/\.0$/,'')+'k'+sfx;
    return (Math.round(v*10)/10).toString()+sfx;
  };

  if(chart.type==='bar'){
    // ═══ BARRE ORIZZONTALI: etichetta · barra · valore — sempre tutto leggibile ═══
    const rowH=26, padT=6, padB=6;
    const H=padT+padB+vals.length*rowH;
    canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.height=H+'px';
    c.setTransform(dpr,0,0,dpr,0,0);
    c.font='10px DM Mono';
    const labW=Math.min(90, Math.max(30,...labels.map(l=>c.measureText(String(l)).width))+6);
    const valW=Math.max(...vals.map(v=>c.measureText(fmt(v)).width))+10;
    const x0=labW+8, bw=Math.max(40, W-x0-valW-6);
    const mn=Math.min(0,...vals), mx=Math.max(0,...vals), range=(mx-mn)||1;
    const xz=x0+((0-mn)/range)*bw;
    if(mn<0){ c.strokeStyle='#2a2a36';c.lineWidth=1;c.beginPath();c.moveTo(xz,padT-2);c.lineTo(xz,H-padB+2);c.stroke(); }
    vals.forEach((v,i)=>{
      const y=padT+i*rowH, bh=12, by=y+(rowH-bh)/2;
      const xs=x0+((Math.min(v,0)-mn)/range)*bw;
      const xe=x0+((Math.max(v,0)-mn)/range)*bw;
      // etichetta, troncata se non ci sta
      let lt=String(labels[i]??'');
      if(c.measureText(lt).width>labW){ while(lt.length>1&&c.measureText(lt+'…').width>labW) lt=lt.slice(0,-1); lt+='…'; }
      c.fillStyle='#7a7a90';c.font='10px DM Mono';c.textAlign='left';c.textBaseline='middle';
      c.fillText(lt,0,y+rowH/2);
      // barra
      c.fillStyle=v>=0?color:'#e05555';c.globalAlpha=.85;
      c.beginPath();
      if(c.roundRect) c.roundRect(xs,by,Math.max(2,xe-xs),bh,3); else c.rect(xs,by,Math.max(2,xe-xs),bh);
      c.fill();c.globalAlpha=1;
      // valore SEMPRE visibile, allineato a destra
      c.fillStyle=v>=0?'#c8e8d8':'#f0b8b8';c.font='10px DM Mono';c.textAlign='right';
      c.fillText(fmt(v),W-2,y+rowH/2);
    });
  } else {
    if(window.__SYN_LWC&&drawLineLWC(canvas,chart,color,vals,labels,fmt))return;
    // ═══ LINEA (fallback canvas): numero finale hero + area, min/max marcati, zero line ═══
    const H=150;
    canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.height=H+'px';
    c.setTransform(dpr,0,0,dpr,0,0);
    const pad={t:32,r:14,b:14,l:14},iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
    const mn=Math.min(0,...vals),mx=Math.max(0,...vals),range=(mx-mn)||1;
    const gx=i=>pad.l+(i/Math.max(1,vals.length-1))*iw;
    const gy=v=>pad.t+(1-(v-mn)/range)*ih;
    const last=vals[vals.length-1];
    // header: valore finale grande, periodo a destra
    c.fillStyle=last>=0?'#4ad68a':'#e05555';
    c.font='16px DM Mono';c.textAlign='left';c.textBaseline='top';
    c.fillText(fmt(last),pad.l,5);
    const lFirst=String(labels[0]??''), lLast=String(labels[labels.length-1]??'');
    if(lFirst&&lLast){
      c.fillStyle='#5a5a78';c.font='9px DM Mono';c.textAlign='right';
      c.fillText(lFirst+' → '+lLast,W-pad.r,9);
    }
    // linea dello zero
    if(mn<0&&mx>0){
      c.strokeStyle='#2a2a36';c.lineWidth=1;c.setLineDash([3,3]);
      c.beginPath();c.moveTo(pad.l,gy(0));c.lineTo(pad.l+iw,gy(0));c.stroke();c.setLineDash([]);
    }
    // area sfumata + linea
    const grad=c.createLinearGradient(0,pad.t,0,pad.t+ih);
    grad.addColorStop(0,color+'33');grad.addColorStop(1,color+'00');
    c.beginPath();vals.forEach((v,i)=>i===0?c.moveTo(gx(i),gy(v)):c.lineTo(gx(i),gy(v)));
    c.lineTo(gx(vals.length-1),pad.t+ih);c.lineTo(gx(0),pad.t+ih);c.closePath();
    c.fillStyle=grad;c.fill();
    c.beginPath();c.strokeStyle=color;c.lineWidth=2;c.lineJoin='round';
    vals.forEach((v,i)=>i===0?c.moveTo(gx(i),gy(v)):c.lineTo(gx(i),gy(v)));c.stroke();
    // min e max etichettati (se non coincidono col punto finale)
    const iMin=vals.indexOf(Math.min(...vals)), iMax=vals.indexOf(Math.max(...vals));
    c.font='9px DM Mono';c.textAlign='center';
    [[iMax,'bottom',-5],[iMin,'top',5]].forEach(p=>{
      const idx=p[0];
      if(idx<0||idx===vals.length-1||iMin===iMax)return;
      c.beginPath();c.arc(gx(idx),gy(vals[idx]),2.5,0,6.29);c.fillStyle=color;c.fill();
      c.fillStyle='#c8c8d8';c.textBaseline=p[1];
      c.fillText(fmt(vals[idx]),Math.min(Math.max(gx(idx),pad.l+16),W-pad.r-16),gy(vals[idx])+p[2]);
    });
    // punto finale evidenziato
    c.beginPath();c.arc(gx(vals.length-1),gy(last),3.5,0,6.29);
    c.fillStyle=last>=0?'#4ad68a':'#e05555';c.fill();
  }
}

// ═══ TASK LOGIC ═══
function uniqueHyp(){
  return new Set(TASKS.map(t=>(t.fingerprint?.hypothesis||'').toLowerCase().slice(0,40)).filter(Boolean)).size;
}

function setQ(q){document.getElementById('qi').value=q;document.getElementById('qi').focus();}

document.querySelectorAll('.ex-pill').forEach(el=>{
  el.addEventListener('click',()=>setQ(el.dataset.q||''));
  // Tint pill border by usage category (explore/allocate/screen)
  const catColors={explore:'#5b9cf6', allocate:'#2ecf98', screen:'#f0a030'};
  const c=catColors[el.dataset.cat];
  if(c){ el.style.borderColor=c+'44'; el.style.color=c+'cc'; }
});

async function runTask(){
  const query=document.getElementById('qi').value.trim();
  if(!query)return;
  if(isLoading)return;
  isLoading=true;
  document.getElementById('sb').disabled=true;
  document.getElementById('pdot').style.background='var(--blue)';
  startLoading(query);

  const taskId='t'+Date.now();
  try{
    // Send only the last 6 tasks, and only query + type (no long hypothesis text)
    // — keeps input tokens bounded as the graph grows.
    const recentTasks = TASKS.slice(-6);
    const prevCtx=recentTasks.length>0?`\n\nPRIOR TASKS:\n${recentTasks.map((t,i)=>`[${i+1}] "${t.raw_query}" | type:${t.intent?.analysis_type}`).join('\n')}`:'';
    // Static system prompt — cacheable (never changes)
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, priorContext: prevCtx })
    });
    const json = await res.json();
    if (json.error === 'limit_reached') { stopLoading(); alert('Hai raggiunto il limite di ' + json.limit + ' task del piano ' + json.plan + '. Passa a Pro per task illimitate.'); isLoading=false; document.getElementById('sb').disabled=false; return; }
    if (json.error) throw new Error(json.error);
    const parsed = json.result;
    if (json.usage) { window.__SYN_USAGE = json.usage; updateUsageLabel(); }

    const task={id:taskId,raw_query:query,created_at:new Date(),...parsed,connections:[]};
    task.connections=computeConns(task,TASKS);
    TASKS.unshift(task);

    const _dpr=window.devicePixelRatio||1;
    const W=canvas.width/_dpr,H=canvas.height/_dpr,graphH=H-110;
    const angle=Math.random()*Math.PI*2,dist=160+Math.random()*200;
    NODES.push({id:taskId,x:W/2+Math.cos(angle)*dist,y:graphH/2+Math.sin(angle)*dist,vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4,task});
    for(const c of task.connections) EDGES.push({from:taskId,to:c.task_id,score:c.score,type:c.type});
    // Provenance DURABILE: da quale nodo nasce questa domanda. Salvata sul task
    // (origin_kind/origin_ref) e ridisegnata ogni frame, indipendente da AI/clustering.
    task.originKind=null; task.originRef=null;
    if(pendingOrigin && pendingOrigin.q && pendingOrigin.q.trim()===query){
      task.originKind=pendingOrigin.kind; task.originRef=pendingOrigin.ref;
      if(pendingOrigin.kind==='task'){
        // task->task: arco reale e permanente nella tabella connections
        const src=TASKS.find(t=>t.id===pendingOrigin.ref);
        if(src && src.id!==taskId && !task.connections.some(cc=>cc.task_id===src.id)){
          const conn={task_id:src.id,query:src.raw_query,type:'same_hypothesis',score:0.6};
          task.connections.unshift(conn);
          EDGES.push({from:taskId,to:src.id,score:conn.score,type:conn.type});
        }
      }
      // thesis->task: nessuna mutazione di source_ids (evita id temporanei e
      // sovrascritture del clustering). originRef=clusterId basta: loop() disegna l'arco.
    }
    pendingOrigin=null;
    await persistTask(task);

    updateStats();
    try{ if(window.posthog) window.posthog.capture('question_analyzed',{analysis_type:task.intent?.analysis_type, total_tasks:TASKS.length}); }catch(e){}
    document.getElementById('qi').value='';
    stopLoading();

    // Auto-open drawer for new task
    selNode=taskId;
    openDrawer(task);

    // Check for memory node (async, non-blocking).
    // Gira a ogni nuova task da >= 5: con un numero dispari di domande il vecchio
    // `% 2 === 0` saltava il re-clustering finale (es. 7 domande → tesi mai ricontrollate).
    // memCheckPending evita comunque chiamate concorrenti.
    if(TASKS.length >= 5){
      setTimeout(()=>checkMemoryNode(),800);
    }

  }catch(err){
    stopLoading();
    alert('Errore: '+err.message);
  }finally{
    isLoading=false;
    document.getElementById('sb').disabled=false;
    document.getElementById('pdot').style.background='var(--teal)';
  }
}

function computeConns(newT,existing){
  const res=[];
  for(const old of existing){
    let score=0,type='complementary_data';
    const h1=(newT.fingerprint?.hypothesis||'').toLowerCase().split(/\s+/).filter(w=>w.length>4);
    const h2=(old.fingerprint?.hypothesis||'').toLowerCase().split(/\s+/).filter(w=>w.length>4);
    const ho=h1.filter(w=>h2.includes(w)).length;
    if(ho>=2){score+=0.45;type='same_hypothesis';}
    const a1=(newT.intent?.assets||[]).map(a=>a.toLowerCase());
    const a2=(old.intent?.assets||[]).map(a=>a.toLowerCase());
    const ao=a1.filter(a=>a2.some(b=>b.includes(a)||a.includes(b))).length;
    if(ao>0)score+=Math.min(0.35,ao*0.18);
    if(newT.intent?.analysis_type===old.intent?.analysis_type){score+=0.15;if(type==='complementary_data')type='same_question_type';}
    const s1=(newT.fingerprint?.sector||'').toLowerCase(),s2=(old.fingerprint?.sector||'').toLowerCase();
    if(s1&&s2&&(s1===s2||s1.includes(s2)||s2.includes(s1)))score+=0.15;
    const c1=(newT.fingerprint?.concepts||[]).map(c=>c.toLowerCase());
    const c2=(old.fingerprint?.concepts||[]).map(c=>c.toLowerCase());
    const co=c1.filter(c=>c2.some(d=>d.includes(c)||c.includes(d))).length;
    if(co>0)score+=Math.min(0.2,co*0.1);
    // Verdetti: due domande sullo STESSO tema con verdetti OPPOSTI = contraddizione
    // (tensione nel ragionamento, va evidenziata); se concordi, si rafforzano.
    const v1=newT.output?.verdict?.stance, v2=old.output?.verdict?.stance;
    if(score>=0.35 && v1 && v2 && v1!=='dipende' && v2!=='dipende'){
      if(v1!==v2){ type='contradiction'; score=Math.max(score,0.6); }
      else { type='supports'; }
    }
    score=Math.round(Math.min(score,1)*100)/100;
    if(score>=0.35)res.push({task_id:old.id,query:old.raw_query,type,score});
  }
  return res.sort((a,b)=>b.score-a.score).slice(0,4);
}

// ═══ SESSION MIRROR — riflette a posteriori la modalità d'uso prevalente ═══
const MODE_MAP = {causal:'explore', trend:'explore', risk:'allocate', compare:'allocate', screen:'screen'};
const MODE_META = {
  explore:  {label:'esplorazione di meccanismi', color:'#5b9cf6'},
  allocate: {label:'costruzione di una strategia', color:'#2ecf98'},
  screen:   {label:'ricerca di titoli specifici', color:'#f0a030'}
};
function computeSessionMode(){
  if(TASKS.length<3) return null;
  const counts={explore:0,allocate:0,screen:0};
  TASKS.forEach(t=>{const m=MODE_MAP[t.intent?.analysis_type]; if(m)counts[m]++;});
  const total=counts.explore+counts.allocate+counts.screen;
  if(total===0) return null;
  let best='explore',bestN=-1;
  for(const k of ['explore','allocate','screen']){ if(counts[k]>bestN){bestN=counts[k];best=k;} }
  const pct=Math.round(bestN/total*100);
  return {mode:best, pct, ...MODE_META[best], isScreen:best==='screen'};
}
function updateSessionMirror(){
  const el=document.getElementById('session-mirror');
  if(!el) return;
  const sm=computeSessionMode();
  if(!sm){ el.style.opacity='0'; el.innerHTML=''; return; }
  const screenBadge = sm.isScreen
    ? ` <span style="color:#f0a030;border:1px solid #3a2800;background:#1a1505;border-radius:4px;padding:1px 6px;margin-left:6px;font-size:9px">solo educativo</span>`
    : '';
  el.innerHTML = `<span style="opacity:.5">questa sessione:</span> <span style="color:${sm.color}">${sm.label}</span> <span style="opacity:.4">· ${sm.pct}%</span>${screenBadge}`;
  el.style.opacity='1';
  el.title = sm.isScreen
    ? 'Stai cercando titoli specifici. Symnaps mostra esempi a scopo puramente educativo, non raccomandazioni.'
    : 'Modalità d\'uso prevalente, dedotta dalle tue domande. Cambia liberamente continuando a esplorare.';
}

function updateStats(){
  document.getElementById('st').textContent=TASKS.length;
  document.getElementById('sc').textContent=EDGES.length;
  document.getElementById('sh').textContent=uniqueHyp();
  updateSessionMirror();
}

// Loading steps
// ═══ LOADING ANIMATION ═══
let loadingAnimFrame = null;
let loadingPhase = 0;
const LOAD_LABELS = ['parsing intent semantico','ricerca web se necessaria','analizzando contesto macro','costruendo fingerprint e output'];

function startLoading(queryText){
  document.getElementById('loverlay').classList.add('show');
  document.getElementById('loading-query-preview').textContent = queryText||'';
  loadingPhase = 0;
  document.getElementById('loading-label').textContent = LOAD_LABELS[0];

  const lc = document.getElementById('loading-canvas');
  const lctx = lc.getContext('2d');
  const W = 400, H = 400, cx = W/2, cy = H/2;

  // Generate fake mini-graph nodes
  const n = 5 + Math.floor(Math.random()*3);
  const lnodes = Array.from({length:n},(_,i)=>{
    const a = (i/n)*Math.PI*2;
    const r = 60+Math.random()*60;
    return {x:cx+Math.cos(a)*r, y:cy+Math.sin(a)*r, r:8+Math.random()*8, phase:Math.random()*Math.PI*2, color:Object.values(TC)[Math.floor(Math.random()*4)]};
  });
  // Central node
  lnodes.push({x:cx,y:cy,r:14,phase:0,color:'#a78bfa',central:true});

  let t=0;
  let phaseInterval = setInterval(()=>{
    loadingPhase = Math.min(loadingPhase+1, LOAD_LABELS.length-1);
    const lbl = document.getElementById('loading-label');
    if(lbl){lbl.style.opacity='0'; setTimeout(()=>{if(lbl)lbl.textContent=LOAD_LABELS[loadingPhase];lbl.style.opacity='1';},200);}
  }, 900);

  function drawLoading(){
    lctx.clearRect(0,0,W,H);
    t+=0.02;

    // Draw pulsing edges
    for(let i=0;i<lnodes.length-1;i++){
      const a=lnodes[i], b=lnodes[lnodes.length-1];
      const progress = (Math.sin(t*2+i)*0.5+0.5);
      lctx.beginPath();
      lctx.moveTo(a.x,a.y);
      lctx.lineTo(b.x,b.y);
      lctx.strokeStyle=a.color;
      lctx.globalAlpha=0.08+progress*0.25;
      lctx.lineWidth=0.5+progress*1.5;
      lctx.stroke();
      lctx.globalAlpha=1;

      // Travelling dot along edge
      const tp=(t*0.8+i*0.4)%1;
      const dx=lnodes[lnodes.length-1].x - a.x, dy=lnodes[lnodes.length-1].y - a.y;
      lctx.beginPath();
      lctx.arc(a.x+dx*tp, a.y+dy*tp, 2, 0, Math.PI*2);
      lctx.fillStyle=a.color;
      lctx.globalAlpha=0.6*(1-Math.abs(tp-0.5)*2);
      lctx.fill();
      lctx.globalAlpha=1;
    }

    // Draw nodes
    lnodes.forEach((n,i)=>{
      const pulse = 0.7+0.3*Math.sin(t*1.5+n.phase);
      // Glow
      lctx.beginPath();lctx.arc(n.x,n.y,n.r*1.8,0,Math.PI*2);
      lctx.fillStyle=n.color;lctx.globalAlpha=0.06*pulse;lctx.fill();lctx.globalAlpha=1;
      // Circle
      lctx.beginPath();lctx.arc(n.x,n.y,n.r*pulse,0,Math.PI*2);
      lctx.fillStyle='#0e0e12';lctx.fill();
      lctx.strokeStyle=n.color;lctx.lineWidth=n.central?2:1.5;
      lctx.globalAlpha=n.central?1:0.65;lctx.stroke();lctx.globalAlpha=1;
      if(n.central){
        lctx.fillStyle='#a78bfa';lctx.font='11px DM Mono';
        lctx.textAlign='center';lctx.textBaseline='middle';
        lctx.fillText('◆',n.x,n.y);
      }
    });

    loadingAnimFrame = requestAnimationFrame(drawLoading);
  }
  drawLoading();
  loadingAnimFrame._interval = phaseInterval;
}

function stopLoading(){
  if(loadingAnimFrame){
    cancelAnimationFrame(loadingAnimFrame);
    if(loadingAnimFrame._interval) clearInterval(loadingAnimFrame._interval);
    loadingAnimFrame = null;
  }
  document.getElementById('loverlay').classList.remove('show');
}

document.getElementById('qi').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();runTask();}});
document.getElementById('qi').addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';});


// Post-init: hydrate from preloaded DB data
(function(){
  try{
    // Create session-mirror element in the topbar (centered, discreet)
    const tb=document.querySelector('.topbar');
    const stats=document.querySelector('.topbar-stats');
    if(tb && stats && !document.getElementById('session-mirror')){
      const sm=document.createElement('div');
      sm.id='session-mirror';
      sm.style.cssText='flex:1;text-align:center;font-family:DM Mono,monospace;font-size:11px;color:#7a7a95;opacity:0;transition:opacity .4s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 16px';
      tb.insertBefore(sm, stats);
    }
    const pre = window.__SYN_PRELOAD;
    if(pre && pre.tasks.length){
      const W = canvas.width/(window.devicePixelRatio||1), graphH = (canvas.height/(window.devicePixelRatio||1))-110;
      pre.tasks.forEach((t,i)=>{
        const task={id:t.id,raw_query:t.raw_query,intent:t.intent,fingerprint:t.fingerprint,output:t.output,created_at:new Date(t.created_at),connections:[],originKind:t.origin_kind||null,originRef:t.origin_ref||null};
        TASKS.push(task);
        const a=(i/pre.tasks.length)*Math.PI*2;
        NODES.push({id:t.id,x:W/2+Math.cos(a)*200,y:graphH/2+Math.sin(a)*150,vx:0,vy:0,task});
      });
      pre.conns.forEach(c=>{
        EDGES.push({from:c.task_from,to:c.task_to,score:c.score,type:c.type});
        const t=TASKS.find(x=>x.id===c.task_from);
        if(t){const other=TASKS.find(x=>x.id===c.task_to);t.connections.push({task_id:c.task_to,query:other?other.raw_query:'',type:c.type,score:c.score});}
      });
      pre.theses.forEach((th,i)=>{
        const n=pre.theses.length;
        const ang=(i/Math.max(1,n))*Math.PI*2;
        const isMobile = W <= 640;
        // On mobile, ignore wide desktop-saved positions and use a TIGHT ring
        // near the center so the whole graph stays compact and fills the screen.
        const ringR = isMobile ? Math.min(W,graphH)*0.42 : Math.min(W,graphH)*0.38;
        const fallbackX=W/2+Math.cos(ang)*ringR;
        const fallbackY=graphH/2+Math.sin(ang)*ringR;
        const px = isMobile ? fallbackX : (th.pos_x||fallbackX);
        const py = isMobile ? fallbackY : (th.pos_y||fallbackY);
        MEMORY_NODES.push({id:th.id,clusterId:th.cluster_id,thesis:th.thesis,confidence:th.confidence,explanation:th.explanation,pattern:th.pattern,suggested_question:th.suggested_question,source_ids:th.source_task_ids||[],history:th.history||[],challenge:th.challenge||null,signals:th.signals||null,status:th.status||'active',accuracy:(th.accuracy==null?null:th.accuracy),signals_hit:th.signals_hit||0,signals_total:th.signals_total||0,is_public:th.is_public||false,created_at:th.created_at?new Date(th.created_at):null,color:th.color||'#a78bfa',phaseOffset:Math.random()*Math.PI*2,x:px,y:py});
      });
      MEMORY_NODES.forEach(computeConfDelta);
      (pre.actions||[]).forEach((ac)=>{
        const srcMem=MEMORY_NODES.find(m=>m.clusterId===ac.cluster_id);
        const isMobile = W <= 640;
        // On mobile, anchor the portfolio just below its source thesis (compact),
        // ignoring wide desktop-saved coordinates.
        let ax, ay;
        if(isMobile && srcMem){ ax=srcMem.x+40; ay=srcMem.y+60; }
        else { ax=ac.pos_x||W/2; ay=ac.pos_y||graphH/2; }
        ACTION_NODES.push({id:ac.id,clusterId:ac.cluster_id,sourceMemId:srcMem?srcMem.id:null,title:ac.title,summary:ac.summary,categories:ac.categories||[],caveat:ac.caveat,performance:ac.performance||null,x:ax,y:ay,color:'#34d399',phaseOffset:Math.random()*Math.PI*2});
      });
      updateStats();
      // Only run the (slow, paid) thesis check on load if we have tasks but NO
      // theses yet — otherwise the data is already loaded, no need to call the AI.
      const _covered=new Set(MEMORY_NODES.flatMap(mn=>mn.source_ids||[]));
      const _orphans=TASKS.filter(t=>!_covered.has(t.id)).length;
      // Gira il check su load se non ci sono tesi OPPURE se ci sono >=3 task
      // non ancora attribuite a una tesi: cosi' il pannello 'tesi in formazione'
      // si popola gia' all'apertura, non solo dopo una nuova domanda.
      if(TASKS.length>=5 && (MEMORY_NODES.length===0 || _orphans>=3)){
        setTimeout(()=>checkMemoryNode(),1500);
      }
      // Let physics settle briefly, then frame everything in view
      setTimeout(()=>fitView(),600);
    }
    const sb=document.getElementById('sb'); if(sb) sb.addEventListener('click',()=>runTask());
    const bd=document.getElementById('backdrop'); if(bd) bd.addEventListener('click',()=>closeDrawer());
    const dh=document.querySelector('.drawer-handle'); if(dh) dh.addEventListener('click',()=>closeDrawer());
    const dc=document.querySelector('.drawer-close'); if(dc) dc.addEventListener('click',()=>closeDrawer());
    const qi=document.getElementById('qi'); if(qi) qi.addEventListener('keydown',(e)=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();runTask();} });
    window.NODES=NODES; window.EDGES=EDGES; window.TASKS=TASKS; window.MEMORY_NODES=MEMORY_NODES; window.ACTION_NODES=ACTION_NODES;
    // First-time onboarding: show the swipeable tutorial if the user has no tasks yet.
    // Deferred so window.startTutorial (defined later in the file) already exists.
    if(TASKS.length===0){
      const _hold=Array.isArray(window.__SYN_PORTFOLIO)?window.__SYN_PORTFOLIO:[];
      // Con un portafoglio ma grafo vuoto: seed dai titoli posseduti (grafo non
      // vuoto dal primo secondo). Altrimenti il tutorial classico.
      if(_hold.length){ setTimeout(()=>seedFromPortfolio(), 400); }
      else { setTimeout(()=>{ if(window.startTutorial) window.startTutorial(); }, 300); }
    }
    updateUsageLabel();
    updateSessionMirror();
    refreshStaleData();
    loadWatches();
    const lb=document.getElementById('logout-btn');
    if(lb) lb.addEventListener('click', async()=>{ window.__synLogout && window.__synLogout(); });
    const pfb=document.getElementById('pf-edit-btn');
    if(pfb) pfb.addEventListener('click',()=>openPortfolioEditor());
    const shb=document.getElementById('share-btn');
    if(shb) shb.addEventListener('click', async()=>{
      if(shb.disabled) return;
      shb.disabled=true; const old=shb.textContent; shb.textContent='…';
      try{
        const res=await fetch('/api/share',{method:'POST'});
        const json=await res.json();
        if(json.path){
          const url=location.origin+json.path;
          let copied=false;
          try{ await navigator.clipboard.writeText(url); copied=true; }catch(e){}
          // Apri subito la pagina pubblica; se il popup blocker la ferma,
          // la notifica offre il bottone "apri" (click esplicito = gesture valida)
          const win=window.open(url,'_blank');
          const notif=document.getElementById('mem-notif');
          if(notif){
            document.getElementById('mem-notif-text').textContent=copied?'🔗 link copiato negli appunti':'🔗 grafo pubblico creato';
            const nb=notif.querySelector('.mem-notif-btn');
            if(nb){ nb.textContent='apri →'; nb.onclick=()=>{ window.open(url,'_blank'); }; }
            notif.classList.add('show');
            setTimeout(()=>notif.classList.remove('show'), win?6000:12000);
          }
          try{ if(window.posthog) window.posthog.capture('graph_shared'); }catch(e){}
        } else if(json.error==='empty_graph'){
          alert('Fai almeno una domanda prima di condividere il grafo.');
        }
      }catch(e){ console.warn('share failed', e); }
      shb.disabled=false; shb.textContent=old;
    });
  }catch(e){ console.warn('hydrate failed', e); }
})();

// Expose functions called from inline onclick handlers (they live in block scope now)
window.runTask = runTask;
window.closeDrawer = closeDrawer;
window.openMemoryDrawer = openMemoryDrawer;
window.jumpToNode = jumpToNode;
window.openActionDrawer = openActionDrawer;
window.deleteTask = deleteTask;
// ── Tutorial: swipeable intro cards ──
window.__tutStep = 0;
window.__tutTotal = 4;
window.startTutorial = function(){
  window.__tutStep = 0;
  const ov=document.getElementById('tutorial');
  if(!ov) return;
  // build dots
  const dots=document.getElementById('tut-dots');
  if(dots) dots.innerHTML = Array.from({length:window.__tutTotal},(_,i)=>`<div class="tut-dot${i===0?' active':''}"></div>`).join('');
  ov.style.display='flex';
  window.__showTutStep(0);
};
window.__showTutStep = function(i){
  document.querySelectorAll('.tut-slide').forEach(s=>{ s.style.display = (parseInt(s.dataset.i)===i)?'flex':'none'; });
  document.querySelectorAll('.tut-dot').forEach((d,di)=>{ d.classList.toggle('active', di===i); });
  const next=document.getElementById('tut-next');
  if(next) next.textContent = (i>=window.__tutTotal-1) ? 'Inizia →' : 'Avanti →';
};
window.tutNext = function(){
  if(window.__tutStep >= window.__tutTotal-1){ window.endTutorial(); return; }
  window.__tutStep++;
  window.__showTutStep(window.__tutStep);
};
window.endTutorial = function(){
  const ov=document.getElementById('tutorial');
  if(ov) ov.style.display='none';
  const qi=document.getElementById('qi'); if(qi) qi.focus();
};


} // end init guard
