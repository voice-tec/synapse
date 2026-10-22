// Scheda progressiva nel drawer esistente: niente HTML da input esterni.
export function mountThesisCard(body: HTMLElement, node: any, lang: string, onSaved?: () => void) {
  const en = lang === 'en';
  const tr = (it: string, english: string) => en ? english : it;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const root = el('section'); root.className = 'v2-card';
  const nav = el('div'); nav.className = 'v2-tabs'; nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', tr('Scheda tesi', 'Thesis card'));
  const titles = [tr('Panoramica', 'Overview'), tr('Evidenze', 'Evidence'), tr('Cosa è cambiato?', 'What Changed?'), tr('Storico', 'History'), tr('Decisioni', 'Decisions')];
  const panels = titles.map((title, i) => {
    const panel = el('div'); panel.id = 'v2-panel-' + i; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'v2-tab-' + i); panel.hidden = i !== 0;
    const button = el('button', title); button.type = 'button'; button.id = 'v2-tab-' + i;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-selected', String(i === 0)); button.tabIndex = i === 0 ? 0 : -1;
    const activate = () => {
      panels.forEach((p, j) => { p.hidden = i !== j; const b = nav.children[j] as HTMLButtonElement; b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    };
    button.addEventListener('click', activate);
    button.addEventListener('keydown', (e) => {
      const next = e.key === 'ArrowRight' ? (i + 1) % 5 : e.key === 'ArrowLeft' ? (i + 4) % 5 : e.key === 'Home' ? 0 : e.key === 'End' ? 4 : -1;
      if (next >= 0) { e.preventDefault(); const b = nav.children[next] as HTMLButtonElement; b.click(); b.focus(); }
    });
    nav.append(button); return panel;
  });
  // Sposta i nodi: conserva listener, ID e azioni legacy.
  while (body.firstChild) panels[0].append(body.firstChild);
  const editor = el('div'); panels[0].prepend(editor);
  const state = el('p', tr('Caricamento scheda…', 'Loading card…')); state.setAttribute('role', 'status'); editor.append(state);
  root.append(nav, ...panels); body.append(root);
  panels[1].append(el('p', tr('I segnali e le fonti delle analisi restano nella panoramica. Il registro di evidenze con provenienza sarà disponibile in una fase successiva.', 'Signals and analysis sources remain in Overview. A sourced evidence ledger is planned for a later phase.')));
  panels[4].append(el('p', tr('Nessuna decisione registrata in questa versione. I portafogli generati sono simulazioni educative, non operazioni eseguite.', 'No decisions are recorded in this version. Generated portfolios are educational simulations, not executed trades.')));
  let latest: any;
  const load = async () => {
    const response = await fetch('/api/theses?cluster=' + encodeURIComponent(node.clusterId), { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (!root.isConnected) return;
    latest = data.thesis;
    Object.assign(node, { revision:latest.revision, thesis:latest.thesis, explanation:latest.explanation,
      sector:latest.sector, status:latest.status, accuracy:latest.accuracy, confidence:latest.confidence,
      source_ids:latest.source_task_ids || [], signals:latest.signals, pattern:latest.pattern,
      suggested_question:latest.suggested_question, history:latest.history || [], challenge:latest.challenge,
      signals_hit:latest.signals_hit, signals_total:latest.signals_total, is_public:latest.is_public });
    render(data.versions || []);
  };
  const render = (versions: any[]) => {
    editor.replaceChildren();
    const heading = el('h3', tr('Ipotesi originale registrata', 'Original recorded hypothesis'));
    editor.append(heading, el('p', latest.original_hypothesis || latest.thesis));
    const baseline = versions.some(v => v.reason === 'migration_baseline');
    editor.append(el('small', baseline
      ? tr('Storico verificabile dalla migrazione. Le versioni precedenti non sono ricostruibili.', 'Trusted history begins at migration. Earlier versions cannot be reconstructed.')
      : tr('Originale e revisioni conservati con timestamp del database.', 'Original and revisions retained with database timestamps.')));
    editor.append(el('p', tr('Convinzione ≠ allineamento segnali ≠ accuratezza predittiva verificata ≠ rendimento realizzato. Gli ultimi due non sono misurati da questa scheda.', 'Conviction ≠ signal alignment ≠ verified predictive accuracy ≠ realized return. The latter two are not measured by this card.')));
    editor.append(el('small', tr('Creata: ', 'Created: ') + new Date(latest.created_at).toLocaleString(lang) + ' · v' + latest.revision));
    const details = el('details'); details.append(el('summary', tr('Modifica e registra una revisione', 'Edit and record a revision')));
    const form = el('form'); form.className = 'v2-form';
    const fields: [string, string, string][] = [
      ['thesis','Ipotesi attuale','Current hypothesis'], ['explanation','Motivazione','Rationale'], ['assets','Asset / ticker (separati da virgole)','Assets / tickers (comma separated)'],
      ['sector','Settore','Sector'], ['investment_horizon','Orizzonte temporale','Investment horizon'], ['evaluation_deadline','Scadenza di valutazione','Evaluation deadline'], ['benchmark','Benchmark (opzionale)','Benchmark (optional)'], ['success_condition','Condizione di successo misurabile','Measurable success condition'], ['invalidation_conditions','Condizioni di invalidazione','Invalidation conditions'], ['reason','Motivo della revisione','Revision reason'],
    ];
    const inputs: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};
    fields.forEach(([key,it,english]) => {
      const label = el('label', tr(it,english));
      const input = key === 'evaluation_deadline' ? el('input') : el('textarea');
      if (input instanceof HTMLInputElement) input.type = 'date';
      else { input.rows = ['thesis','explanation','success_condition','invalidation_conditions'].includes(key) ? 3 : 1; input.maxLength = key === 'reason' ? 1000 : 4000; }
      input.name = key; input.value = key === 'assets' ? (latest.assets || []).join(', ') : key === 'reason' ? '' : latest[key] || '';
      input.required = key === 'thesis' || key === 'reason';
      inputs[key] = input; label.append(input); form.append(label);
    });
    const workflow = el('label', tr('Stato del lavoro', 'Workflow state'));
    const select = el('select'); select.name = 'workflow_state';
    [['researching','Ricerca','Researching'],['monitoring','Monitoraggio','Monitoring'],['review_needed','Da rivedere','Review needed'],['archived','Archiviata','Archived']].forEach(([value,it,english]) => { const opt = el('option',tr(it,english)); opt.value=value; select.append(opt); });
    select.value = latest.workflow_state; inputs.workflow_state=select; workflow.append(select); form.append(workflow);
    const save = el('button', tr('Salva nuova versione','Save new version')); save.type='submit';
    const message = el('p'); message.setAttribute('role','status'); message.setAttribute('aria-live','polite');
    const reload = el('button',tr('Ricarica versione salvata','Reload saved version')); reload.type='button'; reload.hidden=true;
    reload.addEventListener('click', () => { load().catch(showError); });
    form.append(save, message, reload);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); save.disabled=true;
      const patch: any = { id: latest.id, revision: latest.revision };
      Object.entries(inputs).forEach(([key,input]) => { patch[key]=input.value; });
      patch.assets = patch.assets.split(',').map((s: string)=>s.trim()).filter(Boolean);
      try {
        const response = await fetch('/api/theses', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(patch) });
        const result = await response.json();
        if (response.status===409) { message.textContent=tr('La tesi è cambiata. Copia le modifiche e ricarica prima di riprovare.','The thesis changed. Copy your edits and reload before retrying.'); reload.hidden=false; return; }
        if (!response.ok) throw new Error('save_failed');
        Object.assign(node, { thesis:result.thesis.thesis, explanation:result.thesis.explanation, sector:result.thesis.sector, revision:result.thesis.revision, status:result.thesis.status, accuracy:result.thesis.accuracy, signals_hit:0, signals_total:0 });
        const hero = panels[0].querySelector('.hero-thesis'); if (hero) hero.textContent='“'+node.thesis+'”';
        if (onSaved) { onSaved(); return; }
        await load();
        editor.prepend(el('p',tr('Nuova versione salvata.','New version saved.')));
      } catch { message.textContent=tr('Salvataggio non riuscito. Le modifiche sono ancora qui: riprova.','Save failed. Your edits are still here: retry.'); }
      finally { save.disabled=false; }
    });
    details.append(form); editor.append(details);
    // Valori strutturati visibili anche senza aprire il modulo.
    const summary=el('dl'); summary.className='v2-summary';
    fields.filter(([k])=>!['thesis','explanation','reason'].includes(k)).forEach(([key,it,english])=>{
      summary.append(el('dt',tr(it,english)),el('dd',key==='assets' ? (latest.assets||[]).join(', ') || '—' : latest[key] || '—'));
    });
    editor.append(summary);
    panels[3].replaceChildren(el('h3',tr('Versioni immutabili','Immutable versions')));
    versions.forEach(v=>{
      const entry=el('article'); entry.className='v2-version';
      entry.append(el('h4','v'+v.revision+' · '+new Date(v.recorded_at).toLocaleString(lang)),el('p',v.snapshot.thesis || ''),el('small',v.reason));
      const full=el('details'); full.append(el('summary',tr('Dettagli registrati','Recorded details')));
      fields.filter(([k])=>k!=='reason').forEach(([key,it,english])=>{ full.append(el('p',tr(it,english)+': '+(Array.isArray(v.snapshot[key]) ? v.snapshot[key].join(', ') : v.snapshot[key] || '—'))); });
      entry.append(full); panels[3].append(entry);
    });
    panels[2].replaceChildren(el('h3',tr('Differenze registrate','Recorded changes')));
    if (versions.length < 2) panels[2].append(el('p',tr('Una sola versione: nessun confronto disponibile.','Only one version: no comparison available.')));
    else {
      const [current,previous]=versions;
      panels[2].append(el('small','v'+previous.revision+' → v'+current.revision));
      let changes=0;
      fields.filter(([key])=>key!=='reason').forEach(([key,it,english])=>{
        if(JSON.stringify(current.snapshot[key])!==JSON.stringify(previous.snapshot[key])){
          changes++; const row=el('article'); row.className='v2-version';
          row.append(el('h4',tr(it,english)),el('p',tr('Prima: ','Before: ')+String(previous.snapshot[key] || '—')),el('p',tr('Ora: ','Now: ')+String(current.snapshot[key] || '—')));panels[2].append(row);
        }
      });
      if(!changes) panels[2].append(el('p',tr('Aggiornamento di sistema: nessuna modifica ai campi della scheda.','System update: no changes to card fields.')));
    }
    panels[2].append(el('p',tr('Il confronto riguarda informazioni registrate, non nuovi eventi di mercato verificati.','This comparison concerns recorded information, not newly verified market events.')));
  };
  const showError=()=>{
    if(!root.isConnected)return;
    state.textContent=tr('Scheda versionata non disponibile. Verifica la migrazione e riprova; il grafo resta accessibile.','Versioned card unavailable. Check the migration and retry; the graph remains accessible.');
    const retry=el('button',tr('Riprova','Retry'));retry.type='button';retry.addEventListener('click',()=>{retry.remove();load().catch(showError);});editor.append(state,retry);
  };
  load().catch(showError);
}
