// Markup HTML del grafo, iniettato via innerHTML da app/page.tsx.
// Estratto dalla stringa gigante per renderlo editabile.
export const BODY = `

<div class="topbar">
  <div class="logo">
    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAeCAYAAADHJYVoAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAACMklEQVR42rWWPWtUURCGn7m7iVmNScRSjVXwAwSxEg2oRbATa7ERCxv9CWpvYWFasRexsBCtFDXYCIKgFkaIYPADQVMpxuw+Fs6VmxB3k911YNh7zt7zzpy573nPQJoaao0uTd2g3ld/qnfU4SiBI8J83gYcA/YDg0B0wC2AFrALmAKaQA24XC+B1QZwBTifi5q5qJMFIDCQ46UEn0At1GF1xj92Td2nblKHcrvtvJHvHVS/JsYX9UBZr1s5eZQeTB1XT6jby4mpBD6X48HcTazTixWBCtQH6vucqKnRQ+ZFYhTlxKJ6PZ/r9NGK/Mrv+A9W1qnRSznagX8EJvMQ2Vd09WKyZSLHA/3CDnUzMAvMAYcjopUas94ytSKitVr2RzL7GXVPD1VYRuVQaxHRVI8DN4FR4CnwInXin1j5+x14DTyMiPmVQkgptepW9ZL6Sv2h/kpfauNVm1aHywDLtrSKPjc6+EZ1VN2vXs0AzzPJWFmzUOvdcl6dVFvqvU4vrku01MFcdyp3cDL6eF4CqEXEkjoLLPT7QNZzJ9Nqq+i3niQFP1WFiz6XZwSIqEwUeYTtpSxZ82fAGKtcT9FNthW2HEq2XCj/3JIcHatcV2umYiXIDvWD+lIdQt2rzmW0WXW8i8xH1NPqQrYXu0vhugGcARazw/oGfK40O+2aIfKa3JmN0AxwNiLeqEU9garMeQvMrwH8r44Dt4G7EfGoLGtEtEolfKw21SelqnVLwypBfgNA68VUmj2DLAAAAABJRU5ErkJggg==" alt="Symnaps" style="height:28px;width:auto;display:block" />
    Symnaps
  </div>
  <span id="usage-label" style="font-size:10px;color:#5a5a78;margin-left:8px"></span>
  <div id="graph-search" style="position:relative;margin-left:14px">
    <input id="gs-input" type="text" placeholder="cerca nel grafo…" autocomplete="off" spellcheck="false" style="background:#0f0f1e;border:1px solid #2a2a44;border-radius:8px;padding:6px 10px;color:#cfcfe8;font-family:DM Mono;font-size:11px;width:150px;outline:none" />
    <div id="gs-results" style="display:none;position:absolute;top:36px;left:0;width:340px;max-height:320px;overflow-y:auto;background:#12121f;border:1px solid #2a2a44;border-radius:10px;box-shadow:0 12px 40px #000000aa;z-index:50;padding:4px"></div>
  </div>
  <div class="topbar-stats">
    <div class="stat"><span class="stat-val" id="st">0</span><span class="stat-key">task</span></div>
    <div class="stat"><span class="stat-val" id="sc">0</span><span class="stat-key">conn.</span></div>
    <div class="stat"><span class="stat-val" id="sh">0</span><span class="stat-key">ipotesi</span></div>
  </div>
  <div class="pulse" id="pdot"></div>
  <button id="pf-edit-btn" style="background:none;border:1px solid #1a4a38;border-radius:8px;padding:6px 12px;color:#34d399;font-family:DM Mono;font-size:11px;cursor:pointer;margin-left:12px">◈<span class="pf-btn-lbl"> portafoglio</span></button>
  <button id="share-btn" style="background:#1a2a4a;border:1px solid #5b9cf655;border-radius:8px;padding:6px 12px;color:#5b9cf6;font-family:DM Mono;font-size:11px;cursor:pointer;margin-left:12px">condividi</button>
  <a id="market-btn" href="/market" style="background:#241a3a;border:1px solid #a78bfa55;border-radius:8px;padding:6px 12px;color:#a78bfa;font-family:DM Mono;font-size:11px;cursor:pointer;margin-left:12px;text-decoration:none">marketplace</a>
  <button id="logout-btn" style="background:none;border:1px solid #2a2a36;border-radius:8px;padding:6px 12px;color:#7a7a95;font-family:DM Mono;font-size:11px;cursor:pointer;margin-left:12px">esci</button>
</div>

<div class="graph-wrap">
  <canvas id="gc"></canvas>
  <div class="graph-hint" id="ghint">la tua rete semantica apparirà qui</div>

  <div class="proto-panel" id="proto-panel">
    <div class="proto-head" onclick="this.parentElement.classList.toggle('collapsed')">
      <span>◆ tesi in formazione · <b id="proto-count">0</b></span>
      <span class="proto-caret">▾</span>
    </div>
    <div style="font-size:9.5px;color:var(--text3);padding:0 12px 6px;letter-spacing:.03em">emergono dalle tue domande · maturano coi dati</div>
    <div class="proto-body" id="proto-body"></div>
  </div>

  <!-- TUTORIAL: schede sfogliabili al primo accesso -->
  <div class="tut-overlay" id="tutorial" style="display:none">
    <div class="tut-card">
      <div class="tut-logo">Symnaps</div>
      <div class="tut-slide-wrap">
        <div class="tut-slide" data-i="0">
          <svg class="tut-shape" viewBox="0 0 80 80"><circle cx="40" cy="40" r="20" fill="#5b9cf622" stroke="#5b9cf6" stroke-width="2.5"/><circle cx="40" cy="40" r="30" fill="none" stroke="#5b9cf6" stroke-width="1" opacity="0.4"/><text x="40" y="46" text-anchor="middle" fill="#5b9cf6" font-size="16" font-family="monospace">?</text></svg>
          <div class="tut-h">Le domande sono nodi</div>
          <div class="tut-p">Scrivi una domanda di analisi e premi <b>analizza</b>. Diventa un <b>cerchio</b> colorato nel grafo, con la sua analisi, i dati e le fonti. Il colore indica il tipo: causale, confronto, rischio, trend.</div>
        </div>
        <div class="tut-slide" data-i="1" style="display:none">
          <svg class="tut-shape" viewBox="0 0 120 80"><circle cx="25" cy="40" r="13" fill="#5b9cf622" stroke="#5b9cf6" stroke-width="2"/><circle cx="95" cy="25" r="13" fill="#2ecf9822" stroke="#2ecf98" stroke-width="2"/><circle cx="90" cy="60" r="13" fill="#f0a03022" stroke="#f0a030" stroke-width="2"/><line x1="38" y1="38" x2="82" y2="27" stroke="#6a6a82" stroke-width="1.5" stroke-dasharray="3 3"/><line x1="37" y1="44" x2="77" y2="58" stroke="#6a6a82" stroke-width="1.5" stroke-dasharray="3 3"/></svg>
          <div class="tut-h">Si collegano tra loro</div>
          <div class="tut-p">Fai <b>4-5 domande sullo stesso tema</b>: Symnaps le collega automaticamente con dei fili. È qui che il grafo prende vita e mostra come ragioni.</div>
        </div>
        <div class="tut-slide" data-i="2" style="display:none">
          <svg class="tut-shape" viewBox="0 0 120 80"><polygon points="40,18 58,29 58,51 40,62 22,51 22,29" fill="#a78bfa22" stroke="#a78bfa" stroke-width="2.5"/><text x="40" y="45" text-anchor="middle" fill="#a78bfa" font-size="14">◆</text><rect x="78" y="30" width="28" height="28" rx="4" fill="#34d39922" stroke="#34d399" stroke-width="2.5"/><line x1="58" y1="40" x2="78" y2="44" stroke="#34d399" stroke-width="1.5" stroke-dasharray="3 3"/></svg>
          <div class="tut-h">Emergono tesi e portafogli</div>
          <div class="tut-p">Dalle domande nascono le <b>tesi</b> (esagoni colorati): convinzioni con una percentuale di confidenza. Da una tesi forte germoglia un <b>portafoglio</b> (quadrato verde). Tocca le forme per aprirle.</div>
        </div>
        <div class="tut-slide" data-i="3" style="display:none">
          <svg class="tut-shape" viewBox="0 0 120 80"><rect x="14" y="26" width="92" height="13" rx="6" fill="none" stroke="#5b9cf6" stroke-width="1.5" opacity="0.5"/><rect x="14" y="44" width="68" height="13" rx="6" fill="none" stroke="#5b9cf6" stroke-width="1.5" opacity="0.5"/><text x="98" y="36" fill="#5b9cf6" font-size="13">→</text><text x="76" y="54" fill="#5b9cf6" font-size="13">→</text></svg>
          <div class="tut-h">Approfondisci</div>
          <div class="tut-p">Sotto ogni analisi trovi delle <b>domande suggerite</b>: sono spunti da <b>cliccare</b> per esplorare nuove direzioni — non domande a cui rispondere. Buona esplorazione!</div>
        </div>
      </div>
      <div class="tut-dots" id="tut-dots"></div>
      <div class="tut-actions">
        <button class="tut-skip" onclick="endTutorial()">salta</button>
        <button class="tut-next" id="tut-next" onclick="tutNext()">Avanti →</button>
      </div>
    </div>
  </div>

  <div class="graph-legend">
    <div class="leg-item"><div class="leg-dot" style="background:#5b9cf6"></div>causal</div>
    <div class="leg-item"><div class="leg-dot" style="background:#2ecf98"></div>compare</div>
    <div class="leg-item"><div class="leg-dot" style="background:#f0a030"></div>risk</div>
    <div class="leg-item"><div class="leg-dot" style="background:#4ad68a"></div>trend</div>
  </div>

  <!-- INPUT BAR -->
  <div class="input-bar">
    <div class="examples">
      <span class="ex-pill" data-cat="explore" data-q="perché i titoli tech hanno perso così tanto nel 2022?">perché tech giù nel 2022</span>
      <span class="ex-pill" data-cat="explore" data-q="come influiscono i rialzi dei tassi Fed sulle growth stocks?">tassi Fed e growth</span>
      <span class="ex-pill" data-cat="allocate" data-q="quali settori reggono meglio in una recessione economica?">difendersi in recessione</span>
      <span class="ex-pill" data-cat="allocate" data-q="come costruire un'allocazione bilanciata contro l'inflazione?">allocazione anti-inflazione</span>
      <span class="ex-pill" data-cat="screen" data-q="quali aziende con forte potere di prezzo storicamente reggono l'inflazione?">aziende con pricing power</span>
      <span class="ex-pill" data-cat="screen" data-q="quali società value con bassi multipli e basso debito nel settore industriale?">value a basso debito</span>
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
  <div id="dr-glow"></div>
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
