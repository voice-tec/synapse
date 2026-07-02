// CSS dello grafo, iniettato come <style> da app/page.tsx.
// Estratto dalla stringa gigante per renderlo editabile.
export const STYLE = `
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
.graph-legend{position:absolute;bottom:100px;left:20px;display:flex;flex-direction:column;gap:6px}
.leg-row{display:flex;gap:14px;flex-wrap:wrap}
.leg-item{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text3)}
.leg-dot{width:7px;height:7px;border-radius:50%}
.leg-line{width:14px;height:0;border-top:2px solid}
.leg-line.dash{border-top-style:dashed}

/* INPUT BAR — fixed bottom */
.input-bar{position:fixed;bottom:0;left:0;right:0;padding:14px 20px 16px;background:linear-gradient(transparent,var(--bg) 30%);z-index:15;display:flex;flex-direction:column;gap:8px}
.examples{display:flex;gap:6px;flex-wrap:wrap}
/* Tutorial — swipeable cards on first access */
.tut-overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(8,8,10,0.85);backdrop-filter:blur(4px);padding:20px}
.tut-card{background:#0e0e12;border:1px solid #2a2a36;border-radius:18px;padding:26px 24px 20px;max-width:380px;width:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:14px}
.tut-logo{font-family:'Fraunces',serif;font-size:20px;font-weight:300;color:#fff;text-align:center}
.tut-slide-wrap{min-height:210px;display:flex;align-items:center}
.tut-slide{display:flex;flex-direction:column;gap:10px;text-align:center;width:100%;align-items:center}
.tut-shape{width:120px;height:80px;animation:tutShapeIn .45s ease}
@keyframes tutShapeIn{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}
.tut-h{font-size:18px;font-weight:600;color:#fff}
.tut-p{font-size:13.5px;line-height:1.6;color:#c4c4d4}
.tut-p b{color:#fff}
.tut-dots{display:flex;gap:7px;justify-content:center;margin:2px 0}
.tut-dot{width:7px;height:7px;border-radius:50%;background:#2a2a36;transition:background .2s}
.tut-dot.active{background:#5b9cf6}
.tut-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:4px}
.tut-skip{background:none;border:none;color:#6a6a82;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;padding:8px}
.tut-skip:hover{color:#9a9ab2}
.tut-next{background:#5b9cf6;color:#08080a;border:none;border-radius:12px;padding:12px 22px;font-family:'DM Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .2s}
.tut-next:hover{opacity:.88}
/* Allocation donut: hover lifts a slice (desktop); harmless on touch */
.al-svg .al-seg{transition:stroke-width .15s ease, opacity .15s ease}
.al-svg:hover .al-seg{opacity:.45}
.al-svg .al-seg:hover{opacity:1;stroke-width:28}
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
/* Etichetta di banda: raggruppa più sezioni sotto un titolo (risposta, perché, …).
   Sibling diretto in #dr-body (non wrapper) per non rompere lo stagger secIn.
   --c = tinta del nodo, settata inline. Margin negativo: avvicina la prima
   sezione della banda nonostante il gap flex del body. */
.band-lbl{display:flex;align-items:center;gap:10px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.14em;font-family:'DM Mono',monospace;margin:6px 0 -10px}
.band-lbl::before{content:'';width:14px;height:1px;background:var(--c,var(--border2));flex-shrink:0}
.band-lbl::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--border2),transparent)}
/* Meta collassabile (details): riduce il rumore delle sezioni secondarie */
details.meta-fold summary{list-style:none;cursor:pointer;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:8px;user-select:none}
details.meta-fold summary::-webkit-details-marker{display:none}
details.meta-fold summary::after{content:'+';margin-left:auto;color:var(--text3);font-size:13px}
details.meta-fold[open] summary::after{content:'–'}
details.meta-fold>*:not(summary){margin-top:10px}
.hyp-box{background:var(--bg3);border-left:2px solid var(--blue);border-radius:0 10px 10px 0;padding:12px 16px;font-family:'Fraunces',serif;font-size:15px;font-weight:300;font-style:italic;color:var(--text);line-height:1.5}
.intent-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.icell{background:var(--bg3);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:3px}
.icell-k{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
.icell-v{font-size:11px;color:var(--text2)}
.metrics-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.metric-box{background:var(--bg3);border-radius:10px;padding:12px 14px}
.verdict-box{border-radius:14px;padding:14px 16px}
.verdict-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.verdict-pill{font-size:10px;text-transform:uppercase;letter-spacing:.1em;padding:3px 10px;border-radius:20px;font-weight:500}
.verdict-conf{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em}
.verdict-lbl{font-family:'Fraunces',serif;font-size:18px;font-weight:400;line-height:1.35;color:var(--text)}
.tk-list{display:flex;flex-direction:column;background:var(--bg3);border-radius:14px;padding:4px 14px}
.tk-row{display:grid;grid-template-columns:24px 1fr;gap:10px;padding:10px 2px;border-bottom:1px solid var(--border);font-size:12.5px;line-height:1.5;color:var(--text)}
.tk-row:last-child{border-bottom:none}
.tk-num{font-size:10px;padding-top:2px}
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
/* Hero della tesi: sintesi in cima al drawer (stato, confidenza, cosa la conferma).
   Colore per-tesi via custom prop --c; --p = confidenza 0..100 per l'anello. */
.thesis-hero{background:linear-gradient(160deg,color-mix(in srgb,var(--c) 14%,transparent),var(--bg3));border:1px solid color-mix(in srgb,var(--c) 38%,transparent);border-radius:18px;padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.hero-top{display:flex;align-items:center;gap:8px}
.hero-badge{font-size:10px;padding:3px 10px;border-radius:20px;letter-spacing:.06em;text-transform:uppercase;background:color-mix(in srgb,var(--c) 22%,transparent);color:var(--c)}
.hero-thesis{font-family:'Fraunces',serif;font-size:19px;font-weight:300;font-style:italic;color:var(--text);line-height:1.45}
.hero-metrics{display:flex;align-items:center;gap:18px}
.hero-ring{width:74px;height:74px;flex-shrink:0;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p)*1%),var(--border2) 0);display:grid;place-items:center;position:relative}
.hero-ring::before{content:'';position:absolute;inset:7px;border-radius:50%;background:var(--bg2)}
.hero-ring b{position:relative;font-size:17px;font-weight:600;color:var(--c)}
.hero-track{flex:1;min-width:0}
.hero-stato{font-size:16px;font-weight:500;margin-bottom:2px}
.hero-sub{font-size:11px;color:var(--text2)}
.hero-confirm{margin-top:8px;font-size:11.5px;color:var(--text);line-height:1.5}
.hero-confirm b{color:var(--c);font-weight:500}
.hero-note{margin-top:8px;font-size:10px;color:var(--text3);line-height:1.5}
/* Segnali della tesi: due colonne (rafforzano/indeboliscono), una riga per
   segnale con stato esplicito a destra (scattato / in attesa / non misurabile) */
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sig-col{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 12px}
.sig-head{font-size:9px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.sig-row{display:flex;gap:7px;align-items:baseline;font-size:11px;color:var(--text2);line-height:1.5;padding:6px 0}
.sig-row+.sig-row{border-top:1px solid var(--border)}
.sig-mark{flex-shrink:0}
.sig-txt{flex:1;min-width:0}
.sig-status{flex-shrink:0;font-size:9px;color:#6a6a88;white-space:nowrap}
.sig-empty{font-size:10px;color:var(--text3);font-style:italic;padding:6px 0}
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

/* ═══ MOBILE (≤640px): adapt layout for phones ═══ */
@media (max-width: 640px){
  html{height:100dvh}
  body{height:100dvh;font-size:13px}
  /* Top bar on ONE line so its height is predictable (~54px).
     Su mobile restano solo logo + bottoni icon-only: ricerca, stats e
     usage escono (i conteggi sono già nel graph-hint), le label dei
     bottoni collassano a icona (.tb-lbl) — prima condividi/marketplace
     finivano fuori schermo. */
  .topbar{padding:10px 14px;gap:6px;flex-wrap:nowrap;min-height:54px}
  .logo{font-size:15px;flex:1}
  #usage-label,#graph-search,.topbar-stats,.pulse{display:none}
  .tb-lbl{display:none}
  #share-btn,#market-btn,#logout-btn{margin-left:6px;padding:6px 10px}
  #pf-edit-btn{margin-left:0}
  /* Give the graph an EXPLICIT height (mobile only) so the canvas fills it.
     height:100% on a flex child collapses on mobile; an explicit dvh value
     based on the known topbar height is reliable. */
  .graph-wrap{height:calc(100dvh - 54px);flex:none}
  /* Grids collapse so cards stay readable */
  .intent-grid{grid-template-columns:repeat(2,1fr);gap:8px}
  .metrics-row{grid-template-columns:1fr;gap:8px}
  .charts-row{grid-template-columns:1fr;gap:10px}
  /* Drawer takes more of the screen and is easier to read */
  .drawer{height:85vh;border-radius:18px 18px 0 0}
  .drawer-header{padding:14px 16px 10px;gap:8px}
  .drawer-query{font-size:16px}
  .drawer-body{padding:16px 16px 20px;gap:16px}
  /* Example pills steal too much room on a phone — hide them, user can type */
  .examples{display:none}
  /* Input bar pinned to the very bottom of the screen, always reachable */
  .input-bar{position:fixed;bottom:0;left:0;right:0;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
  #qi{font-size:16px}            /* 16px stops iOS from auto-zooming on focus */
  #sb{padding:10px 14px}
  .graph-legend{display:none}
  #reset-view-btn{right:12px;bottom:120px;padding:7px 12px;font-size:11px}
  .disclaimer{display:none}
  .graph-hint{font-size:9px;top:12px;left:12px}
}

/* ═══ DRAWER — raffinamento terminale editoriale ═══ */
.drawer{background:linear-gradient(180deg,#111118 0%,var(--bg2) 140px)}
#dr-glow{position:absolute;top:0;left:0;right:0;height:170px;pointer-events:none;opacity:.55;transition:background .4s}
.drawer-backdrop.open{backdrop-filter:blur(3px)}
.drawer-body{font-variant-numeric:tabular-nums}
@keyframes secIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
#dr-body>div{animation:secIn .45s cubic-bezier(.22,1,.36,1) both}
#dr-body>div:nth-child(1){animation-delay:.04s}
#dr-body>div:nth-child(2){animation-delay:.09s}
#dr-body>div:nth-child(3){animation-delay:.14s}
#dr-body>div:nth-child(4){animation-delay:.19s}
#dr-body>div:nth-child(5){animation-delay:.24s}
#dr-body>div:nth-child(6){animation-delay:.29s}
#dr-body>div:nth-child(7){animation-delay:.34s}
#dr-body>div:nth-child(8){animation-delay:.39s}
#dr-body>div:nth-child(n+9){animation-delay:.44s}
#dr-body>div:nth-child(n+12){animation-delay:.5s}
.section-lbl{display:flex;align-items:center;gap:10px}
.section-lbl::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--border2),transparent)}
.chart-box{position:relative}
.chart-box::before{content:'';position:absolute;top:6px;left:6px;width:9px;height:9px;border-top:1px solid var(--border2);border-left:1px solid var(--border2)}
.chart-box::after{content:'';position:absolute;bottom:6px;right:6px;width:9px;height:9px;border-bottom:1px solid var(--border2);border-right:1px solid var(--border2)}
.insight-box{position:relative;padding-left:38px}
.insight-box::before{content:'\\201C';font-family:'Fraunces',serif;font-style:italic;font-size:46px;line-height:1;position:absolute;top:10px;left:10px;color:var(--text2);opacity:.35}
.conn-pill,.sq-pill,.source-pill{transition:border-color .15s,transform .18s cubic-bezier(.22,1,.36,1)}
.conn-pill:hover,.sq-pill:hover{transform:translateX(3px)}
.conf-label{font-family:'Fraunces',serif;font-size:26px;font-weight:300;min-width:68px}
.conf-bar-wrap{height:6px;border-radius:3px}
.conf-bar{height:6px;border-radius:3px}

.al-seg2{transform-origin:left;animation:alGrow .55s cubic-bezier(.22,1,.36,1) both}
@keyframes alGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.al-row:last-child{border-bottom:none!important}

/* ═══ SCENARI / CATALIZZATORI / WATCH / PORTFOLIO / FRESHNESS ═══ */
.scen-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.scen-cell{background:var(--bg3);border-radius:12px;padding:12px 12px 14px;border-top:2px solid var(--border2);display:flex;flex-direction:column;gap:6px}
.scen-name{font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:500}
.scen-prob{font-family:'Fraunces',serif;font-size:22px;font-weight:300;color:var(--text)}
.scen-trigger{font-size:10.5px;color:var(--text2);line-height:1.45}
.scen-outcome{font-size:11px;color:var(--text);line-height:1.45}
.cat-list{display:flex;flex-direction:column;background:var(--bg3);border-radius:14px;padding:4px 14px}
.cat-row{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:10px 2px;border-bottom:1px solid var(--border);align-items:baseline}
.cat-row:last-child{border-bottom:none}
.cat-when{font-size:11px;color:var(--amber);white-space:nowrap}
.cat-event{font-size:12px;color:var(--text);line-height:1.4}
.cat-why{font-size:10.5px;color:var(--text3);line-height:1.4;margin-top:2px}
.pf-box{background:var(--teal-dim);border:1px solid #1a4a38;border-radius:14px;padding:12px 16px;font-size:12px;color:#9fe8c8;line-height:1.6;display:flex;gap:10px;align-items:flex-start}
.watch-btn{margin-top:10px;width:100%;background:none;border:1px dashed var(--border2);border-radius:10px;padding:9px;color:var(--text2);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .2s}
.watch-btn:hover{border-color:var(--blue);color:var(--blue)}
.watch-btn.on{border-style:solid;border-color:var(--teal);color:var(--teal);background:var(--teal-dim)}
.chart-asof{font-size:9px;color:var(--text3);margin-top:8px;text-align:right;letter-spacing:.04em}
@media (max-width:640px){.scen-grid{grid-template-columns:1fr;gap:8px}.sig-grid{grid-template-columns:1fr}}

/* ═══ EDITOR PORTAFOGLIO REALE ═══ */
.pfe-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(8,8,10,.82);backdrop-filter:blur(4px);padding:20px}
.pfe-card{background:#0e0e12;border:1px solid #2a2a36;border-radius:18px;padding:22px;max-width:440px;width:100%;display:flex;flex-direction:column;gap:14px;max-height:85vh;overflow-y:auto}
.pfe-title{font-family:'Fraunces',serif;font-size:18px;font-weight:300;color:#fff}
.pfe-sub{font-size:11px;color:var(--text2);line-height:1.5}
.pfe-rows{display:flex;flex-direction:column;gap:8px}
.pfe-row{display:grid;grid-template-columns:90px 1fr 64px 28px;gap:8px;align-items:center}
.pfe-row input{background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Mono',monospace;font-size:11px;outline:none;width:100%;box-sizing:border-box}
.pfe-row input:focus{border-color:#34d399}
.pfe-del{background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;padding:4px}
.pfe-del:hover{color:var(--rose)}
.pfe-total{font-size:11px;color:var(--text2);text-align:right}
.pfe-total b{color:var(--text)}
.pfe-actions{display:flex;gap:10px;justify-content:space-between;align-items:center}
.pfe-add{background:none;border:1px dashed var(--border2);border-radius:8px;padding:8px 14px;color:var(--text2);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer}
.pfe-add:hover{border-color:#34d399;color:#34d399}
.pfe-save{background:#34d399;border:none;border-radius:10px;padding:10px 20px;color:#08080a;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;cursor:pointer}
.pfe-save:hover{opacity:.88}
.pfe-cancel{background:none;border:none;color:var(--text3);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;padding:8px}
@media (max-width:640px){.pf-btn-lbl{display:none}#pf-edit-btn{padding:6px 9px}}
.proto-panel{position:absolute;left:16px;bottom:120px;width:260px;max-width:42vw;background:#0e0e12ee;border:1px solid #2a2a36;border-radius:14px;backdrop-filter:blur(8px);box-shadow:0 12px 40px #00000066;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .35s,transform .35s;z-index:14;overflow:hidden}.proto-panel.show{opacity:1;transform:none;pointer-events:auto}.proto-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 14px;font-size:11px;color:#a78bfa;cursor:pointer;border-bottom:1px solid #2a2a3688;user-select:none}.proto-head b{color:#fff;font-weight:500}.proto-caret{color:#7a7a95;transition:transform .25s}.proto-panel.collapsed .proto-caret{transform:rotate(-90deg)}.proto-panel.collapsed .proto-body{display:none}.proto-body{max-height:38vh;overflow-y:auto;padding:8px}.proto-row{padding:9px}.proto-row:hover{background:#a78bfa10;border-radius:10px}.proto-row+.proto-row{margin-top:4px;border-top:1px solid #1f1f28}.proto-thesis{font-size:11.5px;line-height:1.45;color:#dddde8;margin-bottom:7px}.proto-meta{display:flex;align-items:center;gap:8px;margin-bottom:7px}.proto-bar{flex:1;height:4px;border-radius:3px;background:#2a2a36;overflow:hidden}.proto-bar i{display:block;height:100%;background:#a78bfa;border-radius:3px}.proto-need{font-size:9px;color:#7a7a95;white-space:nowrap}.proto-dev{background:none;border:1px solid #a78bfa55;color:#a78bfa;border-radius:8px;padding:5px 10px;font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;transition:background .2s}.proto-dev:hover{background:#a78bfa1a}@media (max-width:640px){.proto-panel{left:10px;right:10px;width:auto;max-width:none;bottom:130px}}
`;
