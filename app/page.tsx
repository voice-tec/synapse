'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#08080a;--bg2:#0e0e12;--bg3:#141418;--bg4:#1a1a20;
  --border:#1f1f28;--border2:#2a2a36;
  --text:#dddde8;--text2:#7a7a95;--text3:#3a3a50;
  --blue:#5b9cf6;--blue-dim:#1a2a4a;
  --teal:#2ecf98;--teal-dim:#0a2a20;
  --amber:#f0a030;--amber-dim:#2a1a00;
  --rose:#e05577;--rose-dim:#2a0f1a;
  --green:#4ad68a;--red:#e05555;
  --r:12px;--r-lg:18px;
}
html,body{height:100%;overflow:hidden}
body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);font-size:12px;display:flex;flex-direction:column}

/* TOP BAR */
.topbar{display:flex;align-items:center;gap:16px;padding:12px 24px;border-bottom:1px solid var(--border);background:var(--bg2);flex-shrink:0;z-index:20}
.logo{font-family:'Fraunces',serif;font-size:17px;font-weight:300;color:var(--text);display:flex;align-items:center;gap:10px;letter-spacing:.02em}
.logo svg{flex-shrink:0}
.api-wrap{display:flex;align-items:center;gap:8px}
.api-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
#api-key{background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:6px 12px;color:var(--text);font-family:'DM Mono',monospace;font-size:11px;width:240px;outline:none;transition:border-color .2s}
#api-key:focus{border-color:var(--blue)}
.topbar-stats{margin-left:auto;display:flex;gap:28px}
.stat{display:flex;flex-direction:column;align-items:flex-end;gap:1px}
.stat-val{font-size:16px;font-weight:500;color:var(--text)}
.stat-key{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em}
.pulse{width:6px;height:6px;border-radius:50%;background:var(--text3);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* GRAPH — full area */
.graph-wrap{flex:1;position:relative;overflow:hidden}
#gc{width:100%;height:100%;display:block}
.graph-hint{position:absolute;top:18px;left:20px;font-size:10px;color:var(--text3)}
.graph-legend{position:absolute;bottom:100px;left:20px;display:flex;gap:14px}
.leg-item{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text3)}
.leg-dot{width:7px;height:7px;border-radius:50%}

/* INPUT BAR — fixed bottom */
.input-bar{position:absolute;bottom:0;left:0;right:0;padding:14px 20px 16px;background:linear-gradient(transparent,var(--bg) 30%);z-index:15;display:flex;flex-direction:column;gap:8px}
.examples{display:flex;gap:6px;flex-wrap:wrap}
.ex-pill{font-size:10px;padding:3px 10px;border-radius:20px;border:1px solid var(--border2);color:var(--text3);cursor:pointer;transition:all .15s;background:var(--bg2)}
.ex-pill:hover{border-color:var(--blue);color:var(--blue)}
.input-row{display:flex;gap:10px;align-items:flex-end}
#qi{flex:1;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r-lg);padding:12px 16px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;resize:none;outline:none;min-height:44px;max-height:120px;line-height:1.5;transition:border-color .2s}
#qi:focus{border-color:var(--blue)}
#qi::placeholder{color:var(--text3)}
#sb{background:var(--blue);color:var(--bg);border:none;border-radius:var(--r);padding:10px 20px;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;cursor:pointer;transition:opacity .15s;white-space:nowrap;height:44px}
#sb:hover{opacity:.85}
#sb:disabled{opacity:.3;cursor:not-allowed}

/* DRAWER */
.drawer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0);pointer-events:none;z-index:30;transition:background .3s}
.drawer-backdrop.open{background:rgba(0,0,0,.55);pointer-events:all}
.drawer{position:fixed;bottom:0;left:0;right:0;height:72vh;background:var(--bg2);border-top:1px solid var(--border2);border-radius:24px 24px 0 0;z-index:31;transform:translateY(100%);transition:transform .35s cubic-bezier(.32,1,.32,1);display:flex;flex-direction:column;overflow:hidden}
.drawer.open{transform:translateY(0)}
.drawer-handle{width:36px;height:4px;border-radius:2px;background:var(--border2);margin:12px auto 0;flex-shrink:0;cursor:pointer}
.drawer-header{padding:16px 24px 12px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:flex-start;gap:12px}
.drawer-type-badge{padding:3px 10px;border-radius:6px;font-size:10px;flex-shrink:0;margin-top:3px}
.drawer-query{font-family:'Fraunces',serif;font-size:18px;font-weight:300;color:var(--text);line-height:1.4;flex:1}
.drawer-close{width:28px;height:28px;border-radius:50%;border:1px solid var(--border2);background:none;color:var(--text2);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.drawer-close:hover{border-color:var(--text2);color:var(--text)}
.drawer-body{flex:1;overflow-y:auto;padding:20px 24px 24px;display:flex;flex-direction:column;gap:20px}
.drawer-body::-webkit-scrollbar{width:4px}
.drawer-body::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}

/* Drawer sections */
.section-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
.hyp-box{background:var(--bg3);border-left:2px solid var(--blue);border-radius:0 10px 10px 0;padding:12px 16px;font-family:'Fraunces',serif;font-size:15px;font-weight:300;font-style:italic;color:var(--text);line-height:1.5}
.intent-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.icell{background:var(--bg3);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:3px}
.icell-k{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
.icell-v{font-size:11px;color:var(--text2)}
.metrics-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.metric-box{background:var(--bg3);border-radius:10px;padding:12px 14px}
.metric-k{font-size:10px;color:var(--text3);margin-bottom:4px}
.metric-v{font-size:20px;font-weight:500}
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.chart-box{background:var(--bg3);border-radius:14px;padding:14px 16px}
.chart-lbl{font-size:11px;color:var(--text2);margin-bottom:10px}
.chart-canvas{width:100%;height:110px;display:block}
.insight-box{background:var(--bg3);border-radius:14px;padding:16px;font-family:'Fraunces',serif;font-size:14px;font-weight:300;color:var(--text2);line-height:1.8}
.conns-list{display:flex;flex-direction:column;gap:6px}
.conn-pill{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:border-color .15s}
.conn-pill:hover{border-color:var(--amber)}
.conn-pct{font-size:12px;color:var(--amber);min-width:36px}
.conn-type{font-size:10px;padding:2px 7px;border-radius:4px;background:var(--amber-dim);color:var(--amber)}
.conn-q{font-size:12px;color:var(--text2);flex:1}

/* MEMORY NODE DRAWER */
.memory-drawer-header{padding:20px 24px 16px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:flex-start;gap:14px}
.memory-icon{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px}
.memory-badge{font-size:10px;padding:3px 10px;border-radius:6px;background:#2a1a40;color:#a78bfa;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;display:inline-block}
.memory-title{font-family:'Fraunces',serif;font-size:20px;font-weight:300;color:var(--text);line-height:1.4}
.memory-thesis{background:#16102a;border-left:2px solid #a78bfa;border-radius:0 12px 12px 0;padding:16px 20px;font-family:'Fraunces',serif;font-size:16px;font-weight:300;font-style:italic;color:#d4bbff;line-height:1.6}
.memory-confidence{display:flex;align-items:center;gap:12px;padding:12px 0}
.conf-bar-wrap{flex:1;height:4px;background:var(--border2);border-radius:2px}
.conf-bar{height:4px;border-radius:2px;background:linear-gradient(90deg,#7c3aed,#a78bfa);transition:width .8s ease}
.conf-label{font-size:12px;color:#a78bfa;min-width:36px;text-align:right}
.memory-sources{display:flex;flex-direction:column;gap:6px}
.source-pill{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border:1px solid #2a1a40;border-radius:10px}
.source-num{font-size:10px;color:#7c3aed;min-width:20px}
.source-q{font-size:12px;color:var(--text2)}
.memory-notification{position:fixed;bottom:120px;left:50%;transform:translateX(-50%) translateY(20px);background:#16102a;border:1px solid #a78bfa;border-radius:14px;padding:14px 20px;display:flex;align-items:center;gap:12px;z-index:50;opacity:0;transition:all .4s cubic-bezier(.32,1,.32,1);pointer-events:none;white-space:nowrap}
.memory-notification.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:all}
.mem-notif-icon{font-size:18px}
.mem-notif-text{font-size:12px;color:#d4bbff}
.mem-notif-btn{font-size:11px;color:#a78bfa;background:none;border:1px solid #a78bfa;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:'DM Mono',monospace;transition:all .15s}
.mem-notif-btn:hover{background:#a78bfa;color:var(--bg)}

.sq-pill{padding:10px 14px;background:var(--bg3);border:1px solid var(--teal-dim);border-radius:10px;cursor:pointer;transition:all .15s}
.sq-pill:hover{border-color:var(--teal);background:var(--teal-dim)}
.sq-q{font-size:12px;color:var(--text);line-height:1.5;margin-bottom:3px}
.sq-reason{font-size:10px;color:var(--text3);line-height:1.4}
.sq-arrow{font-size:12px;color:var(--teal);margin-left:auto;flex-shrink:0;opacity:0;transition:opacity .15s}
.sq-pill:hover .sq-arrow{opacity:1}

/* Loading overlay */
.loading-overlay{position:fixed;inset:0;background:rgba(8,8,10,.85);z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;pointer-events:none;opacity:0;transition:opacity .25s}
.loading-overlay.show{opacity:1;pointer-events:all}
.loading-canvas-wrap{position:relative;width:200px;height:200px}
#loading-canvas{width:200px;height:200px}
.loading-label{font-size:11px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.04em;min-height:16px;text-align:center;transition:opacity .3s}
.loading-query-preview{font-family:'Fraunces',serif;font-size:14px;font-weight:300;color:var(--text2);max-width:320px;text-align:center;line-height:1.5;font-style:italic;padding:0 20px}
.spinner{width:11px;height:11px;border:1.5px solid var(--border2);border-top-color:var(--blue);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}

.disclaimer{position:absolute;bottom:0;right:20px;font-size:10px;color:var(--text3);padding-bottom:4px;pointer-events:none;z-index:14}
`;
const BODY = `

<div class="topbar">
  <div class="logo">
    <svg width="22" height="28" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 6.5C17 4.5 15 3 11 3C7 3 5 4.8 5 7C5 9.2 7.5 10.2 11 11C14.5 11.8 17 13 17 15.5C17 18 14.5 19.5 11 19.5C7.5 19.5 5 18 5 16" stroke="white" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <circle cx="17" cy="6.5" r="2.2" fill="white"/>
      <circle cx="5" cy="16" r="2.2" fill="white"/>
    </svg>
    Synapse
  </div>
  <span id="usage-label" style="font-size:10px;color:#5a5a78;margin-left:8px"></span>
  <div class="topbar-stats">
    <div class="stat"><span class="stat-val" id="st">0</span><span class="stat-key">task</span></div>
    <div class="stat"><span class="stat-val" id="sc">0</span><span class="stat-key">conn.</span></div>
    <div class="stat"><span class="stat-val" id="sh">0</span><span class="stat-key">ipotesi</span></div>
  </div>
  <div class="pulse" id="pdot"></div>
  <button id="logout-btn" style="background:none;border:1px solid #2a2a36;border-radius:8px;padding:6px 12px;color:#7a7a95;font-family:DM Mono;font-size:11px;cursor:pointer;margin-left:12px">esci</button>
</div>

<div class="graph-wrap">
  <canvas id="gc"></canvas>
  <div class="graph-hint" id="ghint">la tua rete semantica apparirà qui</div>
  <div class="graph-legend">
    <div class="leg-item"><div class="leg-dot" style="background:#5b9cf6"></div>causal</div>
    <div class="leg-item"><div class="leg-dot" style="background:#2ecf98"></div>compare</div>
    <div class="leg-item"><div class="leg-dot" style="background:#f0a030"></div>risk</div>
    <div class="leg-item"><div class="leg-dot" style="background:#4ad68a"></div>trend</div>
  </div>

  <!-- INPUT BAR -->
  <div class="input-bar">
    <div class="examples">
      <span class="ex-pill" data-q="perché i titoli tech hanno perso così tanto nel 2022?">tech 2022</span>
      <span class="ex-pill" data-q="come si comporta l'oro in periodi di alta inflazione?">oro inflazione</span>
      <span class="ex-pill" data-q="confronta le performance di S&P 500 vs MSCI World negli ultimi 5 anni">S&P vs MSCI</span>
      <span class="ex-pill" data-q="quali settori reggono meglio in una recessione economica?">recessione settori</span>
      <span class="ex-pill" data-q="come influiscono i rialzi dei tassi Fed sulle growth stocks?">Fed tassi growth</span>
      <span class="ex-pill" data-q="bitcoin è ancora un asset decorrelato rispetto all'azionario?">BTC correlazione</span>
    </div>
    <div class="input-row">
      <textarea id="qi" rows="1" placeholder="Scrivi qualsiasi domanda di analisi finanziaria..."></textarea>
      <button id="sb" onclick="runTask()">analizza →</button>
    </div>
  </div>

  <div class="disclaimer">solo a scopo informativo — non consulenza finanziaria</div>
</div>

<!-- MEMORY NODE NOTIFICATION -->
<div class="memory-notification" id="mem-notif">
  <span class="mem-notif-icon">◆</span>
  <span class="mem-notif-text" id="mem-notif-text">nuova tesi emergente rilevata</span>
  <button class="mem-notif-btn" onclick="openMemoryDrawer()">vedi →</button>
</div>

<!-- DRAWER -->
<div class="drawer-backdrop" id="backdrop" onclick="closeDrawer()"></div>
<div class="drawer" id="drawer">
  <div class="drawer-handle" onclick="closeDrawer()"></div>
  <div class="drawer-header">
    <div class="drawer-type-badge" id="dr-badge"></div>
    <div class="drawer-query" id="dr-query"></div>
    <button class="drawer-close" onclick="closeDrawer()">×</button>
  </div>
  <div class="drawer-body" id="dr-body"></div>
</div>

<!-- LOADING -->
<div class="loading-overlay" id="loverlay">
  <div class="loading-canvas-wrap">
    <canvas id="loading-canvas" width="400" height="400"></canvas>
  </div>
  <div class="loading-label" id="loading-label">parsing intent semantico</div>
  <div class="loading-query-preview" id="loading-query-preview"></div>
</div>

`;
const SCRIPT = `
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


// ═══ STATE ═══
const TASKS = [];
const NODES = [];
const EDGES = [];
let selNode = null, hovNode = null, isLoading = false;
let loadInterval = null;
let MEMORY_NODES = []; // array of {id, thesis, confidence, history:[{thesis,confidence,date}], source_ids, suggested_question, x, y}
let memCheckPending = false;

// Distinct colors per memory cluster
const MEMORY_COLORS = ['#a78bfa','#f472b6','#34d399','#fb923c','#60a5fa'];
const TC = {causal:'#5b9cf6',compare:'#2ecf98',risk:'#f0a030',trend:'#4ad68a',screen:'#4ad68a'};

// ═══ CANVAS ═══
const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');

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

  const cx = W/2, cy = graphH/2;

  // Physics — repulsion accounts for label width
  for (let i=0;i<NODES.length;i++) for (let j=i+1;j<NODES.length;j++) {
    const a=NODES[i],b=NODES[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    // Minimum desired distance: node radius + label width estimate + padding
    const minDist = 200 + Math.max(a.task.raw_query.length, b.task.raw_query.length) * 2.2;
    const f = d < minDist
      ? 28000/(d*d)           // very strong when too close
      : 8000/(d*d);           // normal repulsion when far
    const fx=(dx/d)*f,fy=(dy/d)*f;
    a.vx-=fx;a.vy-=fy;b.vx+=fx;b.vy+=fy;
  }
  // Hard separation — push apart nodes that are dangerously close
  for (let i=0;i<NODES.length;i++) for (let j=i+1;j<NODES.length;j++) {
    const a=NODES[i],b=NODES[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    const minHard=160;
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
    const target=300+(1-e.score)*120,f=(d-target)*0.008*e.score;
    const fx=(dx/d)*f,fy=(dy/d)*f;
    a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;
  }
  for (const n of NODES) {
    n.vx+=(cx-n.x)*0.002;n.vy+=(cy-n.y)*0.002;
    n.vx*=0.76;n.vy*=0.76;
    n.x+=n.vx;n.y+=n.vy;
    n.x=Math.max(120,Math.min(W-120,n.x));
    n.y=Math.max(100,Math.min(graphH-80,n.y));
  }

  // Draw edges
  for (const e of EDGES) {
    const a=NODES.find(n=>n.id===e.from),b=NODES.find(n=>n.id===e.to);
    if(!a||!b)continue;
    const ecmap={same_hypothesis:'#f0a030',complementary_data:'#5b9cf6',same_question_type:'#2ecf98'};
    const ec=ecmap[e.type]||'#5b9cf6';
    const mx=(a.x+b.x)/2+(b.y-a.y)*0.18,my=(a.y+b.y)/2-(b.x-a.x)*0.18;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mx,my,b.x,b.y);
    ctx.strokeStyle=ec;ctx.globalAlpha=0.1+e.score*0.55;ctx.lineWidth=0.5+e.score*2.5;ctx.stroke();ctx.globalAlpha=1;
    if(e.score>=0.4){
      const lbl=Math.round(e.score*100)+'%';
      ctx.font='10px DM Mono';const tw=ctx.measureText(lbl).width;
      ctx.fillStyle='#0e0e12';ctx.globalAlpha=0.88;ctx.fillRect(mx-tw/2-5,my-10,tw+10,14);ctx.globalAlpha=1;
      ctx.fillStyle=ec;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lbl,mx,my-3);
      const ts={same_hypothesis:'ipotesi',complementary_data:'dati',same_question_type:'pattern'}[e.type]||'';
      ctx.font='9px DM Mono';ctx.globalAlpha=0.5;ctx.fillText(ts,mx,my+9);ctx.globalAlpha=1;
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
    ctx.fillStyle=color;ctx.font=\`\${isSel||isHov?13:11}px DM Mono\`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText((task.intent?.analysis_type||'?')[0].toUpperCase(),n.x,n.y);

    // Label — only show if no other node is too close
    const tooClose = NODES.some(other => {
      if(other.id === n.id) return false;
      const dx2 = other.x - n.x, dy2 = other.y - n.y;
      return Math.sqrt(dx2*dx2+dy2*dy2) < 90;
    });

    if(!tooClose || isSel || isHov) {
      const q=task.raw_query,ll=30;
      let lines;
      if(q.length<=ll){lines=[q];}
      else{
        const mid=Math.floor(q.length/2);
        let sp=q.lastIndexOf(' ',mid+10);if(sp<4)sp=q.indexOf(' ',mid-10);if(sp<0)sp=ll;
        const l1=q.slice(0,sp).trim(),l2=q.slice(sp).trim();
        lines=l2.length>ll+5?[l1,l2.slice(0,ll)+'…']:[l1,l2];
      }
      const lc=isSel?'#dddde8':isHov?'#b0b0c8':'#5a5a78';
      const lalpha = tooClose ? 0.5 : 1;
      ctx.fillStyle=lc;ctx.font=\`\${isSel||isHov?11:10}px DM Mono\`;
      ctx.textAlign='center';ctx.textBaseline='top';
      ctx.globalAlpha = lalpha;
      const ly=n.y+r+8;
      lines.forEach((l,i)=>ctx.fillText(l,n.x,ly+i*14));
      ctx.globalAlpha = 1;
    }

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
    document.getElementById('ghint').textContent=\`\${NODES.length} nodi · \${EDGES.length} connessioni · \${uniqueHyp()} ipotesi\${memCount?\` · ◆ \${memCount} tesi\`:''}\`;
  }

  // Draw memory nodes
  for(const mn of MEMORY_NODES){
    const color = mn.color || '#a78bfa';
    const colorDim = mn.colorDim || '#2a1a40';
    const isSel=selNode===mn.id, isHov=hovNode===mn.id;
    const r=(isSel||isHov)?34:26;
    const pulse=0.6+0.4*Math.sin(Date.now()/1000+mn.phaseOffset);

    // Dashed edges to source tasks
    for(const sid of (mn.source_ids||[])){
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
      ctx.fillStyle=color;ctx.font=\`\${isSel?14:11}px DM Mono\`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('◆',mn.x,mn.y);
    }

    // Label below
    const lc=isSel?'#fff':isHov?'#d4bbff':'#7c5ab8';
    ctx.fillStyle=lc;ctx.font=\`\${isSel?11:10}px DM Mono\`;
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
    ctx.fillText(\`\${lastConf}%\${trend?' '+trend:''}\`,mn.x,labelY+tLines.length*13+4);

    if(isHov&&!isSel){
      ctx.fillStyle=color;ctx.font='9px DM Mono';ctx.globalAlpha=0.7;
      ctx.fillText('clicca per aprire',mn.x,labelY+tLines.length*13+18);ctx.globalAlpha=1;
    }
  }

  requestAnimationFrame(loop);
}

canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  const hit=NODES.find(n=>{const dx=n.x-mx,dy=n.y-my;return Math.sqrt(dx*dx+dy*dy)<32});
  const memHit=MEMORY_NODES.find(mn=>{const dx=mn.x-mx,dy=mn.y-my;return Math.sqrt(dx*dx+dy*dy)<38});
  hovNode=memHit?memHit.id:hit?hit.id:null;
  canvas.style.cursor=(hit||memHit)?'pointer':'default';
});

canvas.addEventListener('click',e=>{
  const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  const memHit=MEMORY_NODES.find(mn=>{const dx=mn.x-mx,dy=mn.y-my;return Math.sqrt(dx*dx+dy*dy)<38});
  if(memHit){selNode=memHit.id;openMemoryDrawer(memHit);return;}
  const hit=NODES.find(n=>{const dx=n.x-mx,dy=n.y-my;return Math.sqrt(dx*dx+dy*dy)<32});
  if(hit){selNode=hit.id;openDrawer(hit.task);}
  else{selNode=null;}
});

loop();

// ═══ DRAWER ═══
function openDrawer(task){
  const color=TC[task.intent?.analysis_type]||'#5b9cf6';
  const badge=document.getElementById('dr-badge');
  badge.textContent=task.intent?.analysis_type||'analysis';
  badge.style.background=color+'22';badge.style.color=color;
  const wsTag = task.output?.sources?.length
    ? \` <span style="font-size:10px;padding:2px 8px;border-radius:5px;background:#0a2a20;color:#2ecf98;vertical-align:middle;margin-left:6px">⊕ dati reali</span>\`
    : \` <span style="font-size:10px;padding:2px 8px;border-radius:5px;background:var(--bg4);color:var(--text3);vertical-align:middle;margin-left:6px">training</span>\`;
  document.getElementById('dr-query').innerHTML = task.raw_query + wsTag;
  renderDrawerBody(task);
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}
function closeDrawer(){
  document.getElementById('backdrop').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  selNode=null;
}

function renderDrawerBody(task){
  const color=TC[task.intent?.analysis_type]||'#5b9cf6';
  const body=document.getElementById('dr-body');
  body.innerHTML='';

  // Hypothesis
  if(task.fingerprint?.hypothesis){
    const s=document.createElement('div');
    s.innerHTML=\`<div class="section-lbl">ipotesi implicita</div><div class="hyp-box">"\${task.fingerprint.hypothesis}"</div>\`;
    body.appendChild(s);
  }

  // Intent grid
  const ig=document.createElement('div');
  ig.innerHTML=\`<div class="section-lbl">intent estratto</div>
  <div class="intent-grid">
    <div class="icell"><span class="icell-k">assets</span><span class="icell-v">\${(task.intent?.assets||[]).slice(0,3).join(', ')||'—'}</span></div>
    <div class="icell"><span class="icell-k">metriche</span><span class="icell-v">\${(task.intent?.metrics||[]).slice(0,2).join(', ')||'—'}</span></div>
    <div class="icell"><span class="icell-k">periodo</span><span class="icell-v">\${task.intent?.timeframe||'—'}</span></div>
    <div class="icell"><span class="icell-k">settore</span><span class="icell-v" style="color:\${color}">\${task.fingerprint?.sector||'—'}</span></div>
  </div>\`;
  body.appendChild(ig);

  // Metrics
  if(task.output?.metrics?.length){
    const m=document.createElement('div');
    m.innerHTML=\`<div class="section-lbl">metriche chiave</div><div class="metrics-row">
    \${task.output.metrics.slice(0,3).map(x=>\`
      <div class="metric-box">
        <div class="metric-k">\${x.k}</div>
        <div class="metric-v" style="color:\${x.pos===true?'var(--green)':x.pos===false?'var(--red)':'var(--text)'}">\${x.v}</div>
      </div>\`).join('')}
    </div>\`;
    body.appendChild(m);
  }

  // Chart
  if(task.output?.chart?.values?.length){
    const cc=document.createElement('div');
    cc.innerHTML=\`<div class="section-lbl">grafico</div>
    <div class="chart-box">
      <div class="chart-lbl">\${task.output.chart.label||''}</div>
      <canvas class="chart-canvas" id="dc-\${task.id}"></canvas>
    </div>\`;
    body.appendChild(cc);
    setTimeout(()=>drawChart('dc-'+task.id,task.output.chart,color),60);
  }

  // Insight
  if(task.output?.insight){
    const ins=document.createElement('div');
    ins.innerHTML=\`<div class="section-lbl">analisi AI</div><div class="insight-box">\${task.output.insight}</div>\`;
    body.appendChild(ins);
  }

  // Connections
  if(task.connections?.length){
    const co=document.createElement('div');
    co.innerHTML=\`<div class="section-lbl">connessioni nel grafo (\${task.connections.length})</div>
    <div class="conns-list">
    \${task.connections.map(c=>\`
      <div class="conn-pill" onclick="jumpToNode('\${c.task_id}')">
        <span class="conn-pct">\${Math.round(c.score*100)}%</span>
        <span class="conn-type">\${c.type.replace(/_/g,' ')}</span>
        <span class="conn-q">\${c.query}</span>
      </div>\`).join('')}
    </div>\`;
    body.appendChild(co);
  }

  // Sources
  if(task.output?.sources?.length){
    const src=document.createElement('div');
    src.innerHTML=\`<div class="section-lbl">fonti</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
    \${task.output.sources.map(s=>\`<span style="font-size:10px;padding:3px 10px;border-radius:20px;background:var(--bg4);color:var(--text3);border:1px solid var(--border)">\${s}</span>\`).join('')}
    </div>\`;
    body.appendChild(src);
  }

  // Suggested questions — loads async after drawer opens
  const sqSection = document.createElement('div');
  sqSection.id = 'sq-section';
  sqSection.innerHTML = \`
    <div class="section-lbl">domande suggerite dal grafo</div>
    <div id="sq-loading" style="display:flex;align-items:center;gap:8px;padding:10px 0;color:var(--text3);font-size:11px">
      <div class="spinner"></div><span>Synapse sta leggendo il tuo grafo...</span>
    </div>
    <div id="sq-list" style="display:none;flex-direction:column;gap:6px"></div>\`;
  body.appendChild(sqSection);
  setTimeout(()=>loadSuggestedQuestions(task), 200);
}

function openMemoryDrawer(mn){
  if(!mn)return;
  const color=mn.color||'#a78bfa';
  const body=document.getElementById('dr-body');
  const badge=document.getElementById('dr-badge');
  badge.textContent='tesi emergente';
  badge.style.background=color+'22';badge.style.color=color;
  document.getElementById('dr-query').innerHTML=\`<span style="font-size:13px;display:block;margin-bottom:4px;opacity:.6">◆ nodo memoria</span>\${mn.thesis}\`;

  // History timeline HTML
  const historyHTML = mn.history?.length>1 ? \`
    <div>
      <div class="section-lbl">evoluzione della tesi</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        \${mn.history.map((h,i)=>{
          const isLatest=i===mn.history.length-1;
          const prev=mn.history[i-1];
          const delta=prev?h.confidence-prev.confidence:null;
          const deltaColor=delta>0?'var(--green)':delta<0?'var(--red)':'var(--text3)';
          const deltaStr=delta!==null?(delta>0?'↑+'+delta+'%':'↓'+delta+'%'):'';
          return \`<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 14px;background:\${isLatest?color+'11':'var(--bg3)'};border:1px solid \${isLatest?color+'44':'var(--border)'};border-radius:10px">
            <div style="flex-shrink:0;text-align:right;min-width:60px">
              <div style="font-size:15px;font-weight:500;color:\${isLatest?color:'var(--text2)'}">\${h.confidence}%</div>
              \${deltaStr?\`<div style="font-size:10px;color:\${deltaColor}">\${deltaStr}</div>\`:''}
              <div style="font-size:9px;color:var(--text3);margin-top:2px">\${new Date(h.date).toLocaleDateString('it',{day:'numeric',month:'short'})}</div>
            </div>
            <div style="flex:1">
              \${isLatest?\`<div style="font-size:9px;color:\${color};text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">ora</div>\`:''}
              <div style="font-size:\${isLatest?13:11}px;color:\${isLatest?'var(--text)':'var(--text2)'};font-family:'Fraunces',serif;font-weight:300;font-style:italic;line-height:1.4">"\${h.thesis}"</div>
              \${!isLatest&&h.thesis!==mn.history[i+1]?.thesis?\`<div style="font-size:9px;color:var(--text3);margin-top:4px">→ riformulata</div>\`:''}
            </div>
          </div>\`;
        }).reverse().join('')}
      </div>
    </div>\` : '';

  body.innerHTML=\`
    <div>
      <div class="section-lbl">tesi corrente</div>
      <div class="memory-thesis" style="border-left-color:\${color}">"\${mn.thesis}"</div>
    </div>
    <div>
      <div class="section-lbl">confidenza</div>
      <div class="memory-confidence">
        <div class="conf-bar-wrap"><div class="conf-bar" id="conf-bar-\${mn.id}" style="width:0%;background:linear-gradient(90deg,\${color}88,\${color})"></div></div>
        <span class="conf-label" style="color:\${color}">\${mn.confidence}%</span>
      </div>
      <div style="font-size:11px;color:var(--text3);line-height:1.6">\${mn.explanation||''}</div>
    </div>
    <div>
      <div class="section-lbl">pattern rilevato</div>
      <div style="background:var(--bg3);border-radius:12px;padding:14px 16px;font-size:13px;color:var(--text2);line-height:1.7;font-family:'Fraunces',serif;font-weight:300">\${mn.pattern||''}</div>
    </div>
    \${historyHTML}
    <div>
      <div class="section-lbl">task sorgente (\${(mn.source_ids||[]).length})</div>
      <div class="memory-sources">
        \${(mn.source_ids||[]).map((sid,i)=>{
          const t=TASKS.find(x=>x.id===sid);
          return t?\`<div class="source-pill mem-source-pill" data-id="\${sid}" style="cursor:pointer;border-color:\${color}22">
            <span class="source-num" style="color:\${color}">\${i+1}</span>
            <span class="source-q">\${t.raw_query}</span>
          </div>\`:'';
        }).join('')}
      </div>
    </div>
    <div>
      <div class="section-lbl">prossimo passo suggerito</div>
      <div id="mem-suggested-q-\${mn.id}" style="background:\${color}11;border:1px dashed \${color}44;border-radius:12px;padding:14px 16px;font-size:12px;color:\${color};cursor:pointer;line-height:1.5">
        → \${mn.suggested_question||'—'}
      </div>
    </div>\`;

  setTimeout(()=>{
    const b=document.getElementById(\`conf-bar-\${mn.id}\`);if(b)b.style.width=mn.confidence+'%';
    const sq=document.getElementById(\`mem-suggested-q-\${mn.id}\`);
    if(sq&&mn.suggested_question)sq.addEventListener('click',()=>setQAndClose(mn.suggested_question));
    document.querySelectorAll('.mem-source-pill').forEach(el=>{
      el.addEventListener('click',()=>jumpToNode(el.dataset.id));
    });
  },100);
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function setQAndClose(q){
  closeDrawer();
  // Flag all memory nodes to refresh suggested question
  MEMORY_NODES.forEach(mn=>mn.suggested_question=null);
  setTimeout(()=>{document.getElementById('qi').value=q;document.getElementById('qi').focus();},400);
}

async function checkMemoryNode(){
  if(TASKS.length<5||memCheckPending)return;
  const needsRefresh=MEMORY_NODES.some(mn=>mn.suggested_question===null);
  if(!needsRefresh&&TASKS.length>5&&(TASKS.length-5)%3!==0)return;
  memCheckPending=true;
  try{
    const summary=TASKS.map((t,i)=>\`[\${i+1}] query:"\${t.raw_query}" | hypothesis:"\${t.fingerprint?.hypothesis||''}" | concepts:\${(t.fingerprint?.concepts||[]).join(',')} | sector:\${t.fingerprint?.sector||''} | type:\${t.intent?.analysis_type||''}\`).join('\\n');

    const res=await fetch('/api/memory',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({summary, taskCount: TASKS.length})
    });
    const json=await res.json();
    if(json.error||!json.result)return;
    const raw=JSON.stringify(json.result);
    const parsed=JSON.parse(raw);
    if(!parsed.clusters?.length)return;

    const _dpr2=window.devicePixelRatio||1;
    const W=canvas.width/_dpr2,H=canvas.height/_dpr2,graphH=H-110;
    const now=new Date();

    for(const cluster of parsed.clusters){
      if(cluster.confidence<65)continue;
      const sourceIds=(cluster.source_indices||[]).map(i=>TASKS[i-1]?.id).filter(Boolean);

      // Check if this cluster already exists (match by id)
      const existing=MEMORY_NODES.find(mn=>mn.clusterId===cluster.id);

      if(existing){
        // Update existing — add to history if thesis or confidence changed
        const changed=existing.thesis!==cluster.thesis||existing.confidence!==cluster.confidence;
        if(changed){
          existing.history.push({thesis:existing.thesis,confidence:existing.confidence,date:now.toISOString()});
        }
        existing.thesis=cluster.thesis;
        existing.confidence=cluster.confidence;
        existing.explanation=cluster.explanation;
        existing.pattern=cluster.pattern;
        existing.source_ids=sourceIds;
        if(existing.suggested_question===null) existing.suggested_question=cluster.suggested_question;
        persistThesis(existing);
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
          source_ids:sourceIds,
          suggested_question:cluster.suggested_question,
          history:[{thesis:cluster.thesis,confidence:cluster.confidence,date:now.toISOString()}],
          created_at:now
        };
        MEMORY_NODES.push(newNode);
        persistThesis(newNode);

        // Notify
        const notif=document.getElementById('mem-notif');
        const shortT=cluster.thesis.length>45?cluster.thesis.slice(0,45)+'…':cluster.thesis;
        document.getElementById('mem-notif-text').textContent=\`◆ nuova tesi: "\${shortT}"\`;
        notif.classList.add('show');
        setTimeout(()=>notif.classList.remove('show'),7000);
      }
    }

    // Update notification button to open first memory node
    document.getElementById('mem-notif').querySelector('.mem-notif-btn').onclick=
      ()=>MEMORY_NODES.length?openMemoryDrawer(MEMORY_NODES[MEMORY_NODES.length-1]):null;

  }catch(e){console.warn('memory node check failed',e);}
  finally{memCheckPending=false;}
}

async function loadSuggestedQuestions(task){
  const loading=document.getElementById('sq-loading');
  const list=document.getElementById('sq-list');
  if(!loading||!list)return;

  try{
    // Build context: this task + its connections + memory node if exists
    const connContext=task.connections.map(c=>\`- "\${c.query}" (\${c.type.replace(/_/g,' ')})\`).join('\\n')||'nessuna';
    const memContext=MEMORY_NODES.length?\`\\nTesi emergenti: \${MEMORY_NODES.map(mn=>mn.thesis).join('; ')}\`:'';
    const graphContext=TASKS.length>1?\`\\nAltre task nel grafo: \${TASKS.filter(t=>t.id!==task.id).map(t=>\`"\${t.raw_query}"\`).slice(0,6).join(', ')}\`:'';

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
    loading.style.display='none';
    list.style.display='flex';
    list.innerHTML=parsed.questions.map((q,i)=>\`
      <div class="sq-pill" data-q="\${q.q.replace(/"/g,'&quot;')}">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <span style="color:var(--teal);font-size:10px;margin-top:1px;flex-shrink:0">\${i+1}</span>
          <div>
            <div class="sq-q">\${q.q}</div>
            <div class="sq-reason">\${q.reason}</div>
          </div>
          <span class="sq-arrow">→</span>
        </div>
      </div>\`).join('');

    // Wire clicks
    list.querySelectorAll('.sq-pill').forEach(el=>{
      el.addEventListener('click',()=>{
        closeDrawer();
        setTimeout(()=>{
          document.getElementById('qi').value=el.dataset.q;
          document.getElementById('qi').focus();
        },400);
      });
    });

  }catch(e){
    if(loading)loading.innerHTML='<span style="color:var(--text3);font-size:11px">—</span>';
  }
}

function jumpToNode(id){
  closeDrawer();
  setTimeout(()=>{
    const n=NODES.find(x=>x.id===id);
    if(n){selNode=n.id;openDrawer(n.task);}
  },400);
}

function drawChart(id,chart,color){
  const canvas=document.getElementById(id);
  if(!canvas)return;
  const vals=chart.values||[],labels=chart.labels||[];
  if(!vals.length){canvas.style.display='none';return;}
  const W=canvas.offsetWidth||400,H=110;
  canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d');
  const pad={t:8,r:10,b:22,l:8},iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
  const mn=Math.min(...vals),mx=Math.max(...vals),range=mx-mn||1;
  const gx=i=>pad.l+(i/(vals.length-1))*iw;
  const gy=v=>pad.t+(1-(v-mn)/range)*ih;

  // Grid
  c.strokeStyle='#1f1f28';c.lineWidth=0.5;
  for(let i=0;i<3;i++){const y=pad.t+(i/2)*ih;c.beginPath();c.moveTo(pad.l,y);c.lineTo(pad.l+iw,y);c.stroke();}

  if(chart.type==='bar'){
    const bw=Math.max(4,iw/vals.length-4);
    const base=mn>=0?pad.t+ih:gy(0);
    vals.forEach((v,i)=>{
      const x=pad.l+(i+.5)*(iw/vals.length)-bw/2;
      c.fillStyle=v>=0?color:'#e05555';c.globalAlpha=.75;
      c.fillRect(x,v>=0?gy(v):base,bw,Math.abs(base-gy(v)));c.globalAlpha=1;
    });
  } else {
    // Fill
    c.beginPath();vals.forEach((v,i)=>i===0?c.moveTo(gx(i),gy(v)):c.lineTo(gx(i),gy(v)));
    c.lineTo(gx(vals.length-1),pad.t+ih);c.lineTo(gx(0),pad.t+ih);c.closePath();
    c.fillStyle=color;c.globalAlpha=.08;c.fill();c.globalAlpha=1;
    // Line
    c.beginPath();c.strokeStyle=color;c.lineWidth=2;c.lineJoin='round';
    vals.forEach((v,i)=>i===0?c.moveTo(gx(i),gy(v)):c.lineTo(gx(i),gy(v)));c.stroke();
    // Dots
    vals.forEach((v,i)=>{c.beginPath();c.arc(gx(i),gy(v),3,0,Math.PI*2);c.fillStyle=color;c.fill();});
  }

  // X labels
  c.fillStyle='#3a3a50';c.font='9px DM Mono';c.textAlign='center';c.textBaseline='top';
  const step=Math.max(1,Math.ceil(labels.length/7));
  labels.forEach((l,i)=>{if(i%step===0||i===labels.length-1)c.fillText(l,gx(i),H-14);});
}

// ═══ TASK LOGIC ═══
function uniqueHyp(){
  return new Set(TASKS.map(t=>(t.fingerprint?.hypothesis||'').toLowerCase().slice(0,40)).filter(Boolean)).size;
}

function setQ(q){document.getElementById('qi').value=q;document.getElementById('qi').focus();}

document.querySelectorAll('.ex-pill').forEach(el=>{
  el.addEventListener('click',()=>setQ(el.dataset.q||''));
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
    const prevCtx=TASKS.length>0?\`\\n\\nPRIOR TASKS:\\n\${TASKS.map((t,i)=>\`[\${i+1}] "\${t.raw_query}" | type:\${t.intent?.analysis_type} | assets:\${(t.intent?.assets||[]).join(',')} | hypothesis:"\${t.fingerprint?.hypothesis}"\`).join('\\n')}\`:'';
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
    await persistTask(task);

    updateStats();
    document.getElementById('qi').value='';
    stopLoading();

    // Auto-open drawer for new task
    selNode=taskId;
    openDrawer(task);

    // Check for memory node (async, non-blocking)
    setTimeout(()=>checkMemoryNode(),800);

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
    const h1=(newT.fingerprint?.hypothesis||'').toLowerCase().split(/\\s+/).filter(w=>w.length>4);
    const h2=(old.fingerprint?.hypothesis||'').toLowerCase().split(/\\s+/).filter(w=>w.length>4);
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
    score=Math.round(Math.min(score,1)*100)/100;
    if(score>=0.35)res.push({task_id:old.id,query:old.raw_query,type,score});
  }
  return res.sort((a,b)=>b.score-a.score).slice(0,4);
}

function updateStats(){
  document.getElementById('st').textContent=TASKS.length;
  document.getElementById('sc').textContent=EDGES.length;
  document.getElementById('sh').textContent=uniqueHyp();
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
`;

export default function SynapsePage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const supabase = createClient();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // Inject HTML body
      if (containerRef.current) containerRef.current.innerHTML = BODY;

      // Inject style
      const styleEl = document.createElement('style');
      styleEl.textContent = STYLE;
      document.head.appendChild(styleEl);

      // ── Expose DB savers to the script (window globals) ──
      (window as any).__synSaveTask = async (task: any) => {
        try {
          const { data: saved } = await supabase.from('tasks').insert({
            user_id: user.id, raw_query: task.raw_query, intent: task.intent,
            fingerprint: task.fingerprint, output: task.output,
          }).select().single();
          if (saved) {
            // remap the in-memory task id to the DB id so connections match
            const oldId = task.id;
            task.id = saved.id;
            const NODES = (window as any).NODES;
            if (NODES) { const n = NODES.find((x: any) => x.id === oldId); if (n) n.id = saved.id; }
            const EDGES = (window as any).EDGES;
            if (EDGES) EDGES.forEach((e: any) => { if (e.from === oldId) e.from = saved.id; if (e.to === oldId) e.to = saved.id; });
            // save connections
            if (task.connections?.length) {
              await supabase.from('connections').insert(task.connections.map((c: any) => ({
                user_id: user.id, task_from: saved.id, task_to: c.task_id, type: c.type, score: c.score,
              })));
            }
          }
        } catch (e) { console.warn('save task failed', e); }
      };

      (window as any).__synSaveThesis = async (mn: any) => {
        try {
          const { data: existing } = await supabase.from('theses').select('id').eq('user_id', user.id).eq('cluster_id', mn.clusterId).maybeSingle();
          const payload = {
            user_id: user.id, cluster_id: mn.clusterId, thesis: mn.thesis, confidence: mn.confidence,
            explanation: mn.explanation, pattern: mn.pattern, suggested_question: mn.suggested_question,
            source_task_ids: mn.source_ids, history: mn.history, color: mn.color, pos_x: mn.x, pos_y: mn.y,
            updated_at: new Date().toISOString(),
          };
          if (existing) await supabase.from('theses').update(payload).eq('id', existing.id);
          else await supabase.from('theses').insert(payload);
        } catch (e) { console.warn('save thesis failed', e); }
      };

      // ── Load existing graph from DB ──
      const { data: tasks } = await supabase.from('tasks').select('*').order('created_at');
      const { data: conns } = await supabase.from('connections').select('*');
      const { data: theses } = await supabase.from('theses').select('*');
      (window as any).__SYN_PRELOAD = { tasks: tasks || [], conns: conns || [], theses: theses || [] };

      // Load usage
      const { data: profile } = await supabase.from('profiles').select('plan, tasks_this_month').eq('id', user.id).single();
      if (profile) { (window as any).__SYN_USAGE = { used: profile.tasks_this_month, limit: profile.plan === 'free' ? 10 : 99999, plan: profile.plan }; }

      // Run the main script
      const scriptEl = document.createElement('script');
      scriptEl.textContent = SCRIPT + `
        // ── Post-init: hydrate from preloaded DB data ──
        (function(){
          try{
            const pre = window.__SYN_PRELOAD;
            if(pre && pre.tasks.length){
              const W = canvas.width/(window.devicePixelRatio||1), graphH = (canvas.height/(window.devicePixelRatio||1))-110;
              pre.tasks.forEach((t,i)=>{
                const task={id:t.id,raw_query:t.raw_query,intent:t.intent,fingerprint:t.fingerprint,output:t.output,created_at:new Date(t.created_at),connections:[]};
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
                MEMORY_NODES.push({id:th.id,clusterId:th.cluster_id,thesis:th.thesis,confidence:th.confidence,explanation:th.explanation,pattern:th.pattern,suggested_question:th.suggested_question,source_ids:th.source_task_ids||[],history:th.history||[],color:th.color||'#a78bfa',phaseOffset:Math.random()*Math.PI*2,x:th.pos_x||W/2,y:th.pos_y||graphH/2});
              });
              updateStats();
            }
            // Wire inline onclick elements explicitly (innerHTML onclick may not fire)
            const sb=document.getElementById('sb'); if(sb) sb.addEventListener('click',()=>runTask());
            const bd=document.getElementById('backdrop'); if(bd) bd.addEventListener('click',()=>closeDrawer());
            const dh=document.querySelector('.drawer-handle'); if(dh) dh.addEventListener('click',()=>closeDrawer());
            const dc=document.querySelector('.drawer-close'); if(dc) dc.addEventListener('click',()=>closeDrawer());
            const qi=document.getElementById('qi'); if(qi) qi.addEventListener('keydown',(e)=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();runTask();} });
            window.NODES=NODES; window.EDGES=EDGES; window.TASKS=TASKS; window.MEMORY_NODES=MEMORY_NODES;
            updateUsageLabel();
            // Wire logout
            const lb=document.getElementById('logout-btn');
            if(lb) lb.addEventListener('click', async()=>{ window.__synLogout && window.__synLogout(); });
          }catch(e){ console.warn('hydrate failed', e); }
        })();
      `;
      document.body.appendChild(scriptEl);

      // logout handler
      (window as any).__synLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };
    })();
  }, []);

  return <div ref={containerRef} style={{ height: '100vh' }} />;
}
