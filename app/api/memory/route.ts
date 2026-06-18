import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { askClaudeJSON } from '@/lib/anthropic';
import { validateSignals } from '@/lib/signals';
import { checkAiCall, bumpAiCall } from '@/lib/ai-usage';
import { FRED_CATALOG } from '@/lib/fred';

const FRED_KEYS = Object.entries(FRED_CATALOG).map(([id, m]) => `${id} (${m.label})`).join(', ');

const DEDUP_SYS = `Sei un giudice di deduplicazione di tesi d'investimento. Ricevi le TESI ESISTENTI (con id) e delle TESI CANDIDATE nuove.
Per ogni candidata, decidi se esprime lo STESSO TEMA d'investimento di una esistente (anche se riformulata o vista da un'altra angolazione) — in tal caso è un doppione.
ATTENZIONE: tesi causalmente collegate ma DISTINTE NON sono doppioni (es. "inflazione in calo" e "la FED taglierà i tassi" sono tesi diverse; "Nvidia trainata dall'AI" e "il settore semiconduttori cresce" possono essere lo stesso tema).
Rispondi SOLO con JSON: {"verdicts":[{"candidate_index": <indice 0-based>, "duplicate_of": "<id esistente se doppione, altrimenti null>"}]}`;

// Secondo passaggio anti-doppione: solo per i cluster "new", chiede a Sonnet
// (giudizio semantico, non distanza vettoriale — gli embedding non separano i
// doppioni dalle tesi distinte ma correlate) se sono doppioni di una esistente.
// In tal caso li declassa a "update" col suo id, così confluiscono invece di
// creare un nodo nuovo. Best-effort: su errore NON tocca i cluster (fallback al
// dedup Haiku + Jaccard lato client). Gira solo se ci sono "new" ed esistenti.
async function dedupClusters(clusters: any[], theses: any[]) {
  const existing = (theses || []).filter((t: any) => t?.thesis && t?.id);
  const news = (clusters || []).filter((c: any) => c?.action === 'new' && c?.thesis);
  if (!existing.length || !news.length) return;
  try {
    const existingBlock = existing.map((t: any) => `[${t.id}] "${t.thesis}"`).join('\n');
    const candidatesBlock = news.map((c: any, i: number) => `${i}: "${c.thesis}"`).join('\n');
    const { json } = await askClaudeJSON({
      model: 'claude-sonnet-4-6',
      system: DEDUP_SYS,
      user: `TESI ESISTENTI:\n${existingBlock}\n\nTESI CANDIDATE:\n${candidatesBlock}`,
      maxTokens: 1000,
    });
    const validIds = new Set(existing.map((t: any) => t.id));
    for (const v of json?.verdicts || []) {
      const cluster = news[v.candidate_index];
      if (cluster && v.duplicate_of && validIds.has(v.duplicate_of)) {
        cluster.action = 'update';
        cluster.existing_id = v.duplicate_of;
      }
    }
  } catch (err: any) {
    console.error('[api/memory] dedup pass skipped:', err?.message);
  }
}

const SYS = `Sei il motore di analisi di Synapse. Ti vengono date: (1) le TESI GIÀ ESISTENTI dell'utente, (2) le sue task finanziarie.
Analizza le task e identifica i CLUSTER SEMANTICI DISTINTI — gruppi di domande che esplorano tesi diverse.

Per ogni cluster decidi l'azione:
- "update": il cluster corrisponde a una tesi esistente (anche se riformulata o vista da un'angolazione diversa) → metti il suo id in existing_id. La tesi può evolvere: riformula pure il testo.
- "new": il cluster esprime una tesi GENUINAMENTE DISTINTA da tutte le esistenti, GIÀ SOLIDA.
- "forming": il cluster è una tesi che STA EMERGENDO — un tema distinto e promettente ma NON ancora maturo per diventare tesi vera (es. una sola task sorgente, oppure confidence medio-bassa). Usala per le idee che nascono e non raggiungono ancora la soglia di "new".

REGOLE:
- Se il cluster è chiaramente lo STESSO TEMA di una tesi esistente (anche riformulato) → update (NON duplicare, NON creare doppioni). Se esplora un TEMA DISTINTO già solido → new. Se è un TEMA DISTINTO ma ancora debole/immaturo → forming.
- Evita tesi quasi-identiche, ma NON fondere temi diversi in una sola tesi.
- "new" richiede confidence >= 68 E almeno 2 task sorgente. Un tema distinto sotto questa soglia va in "forming" (confidence >= 50), non scartato.
- Se le tesi esistenti sono già 10 o più, NON creare "new": solo update.
- COERENZA COI VERDETTI: ogni task può avere un verdetto (verdict:stance/confidence, es. si/alta, no/bassa, dipende/media). La confidence della tesi DEVE essere coerente con i verdetti delle sue task sorgente: se la maggioranza è negativa (no) o a bassa confidenza, la tesi NON può avere confidence alta. Verdetti concordi e ad alta confidenza → tesi più solida. 'dipende' o assenza di verdetto è neutro.

Rispondi SOLO con JSON valido:
{
  "clusters": [
    {
      "action": "update" | "new" | "forming",
      "existing_id": "id della tesi esistente se update, altrimenti null",
      "id": "stringa identificativa breve del cluster",
      "confidence": numero 0-100,
      "thesis": "la tesi in UNA frase italiana concisa",
      "explanation": "2 frasi su perché questa tesi emerge",
      "pattern": "descrivi il pattern analitico del cluster",
      "source_indices": [indici 1-based, massimo 6],
      "suggested_question": "una domanda che completerebbe questa tesi",
      "signals": {
        "confirm": [{ "text": "segnale osservabile che rafforza la tesi", "kind": "fred|ticker|manual", "metric": "id FRED o simbolo ticker, oppure null", "op": "<|>|<=|>=, oppure null", "threshold": "numero, oppure null" }],
        "invalidate": [{ "text": "segnale osservabile che indebolisce la tesi", "kind": "...", "metric": "...", "op": "...", "threshold": "..." }]
      }
    }
  ]
}
SEGNALI TESTABILI — dai 2 confirm e 2 invalidate. Quando un segnale è misurabile, aggancialo a un dato:
- macro USA → kind:"fred", metric = UNA di queste serie (usa l'id esatto): ${FRED_KEYS}; op + threshold come numero nell'unità della serie (es. CPI/tassi in %).
- prezzo di un titolo → kind:"ticker", metric = simbolo (es. AAPL, NVDA); threshold = variazione % attesa dalla creazione della tesi (es. 20 = +20%), op tipicamente > o <.
- non misurabile con questi → kind:"manual", metric/op/threshold = null.
Il "text" è SEMPRE presente e leggibile. Preferisci segnali fred/ticker quando il tema lo consente.
Se non ci sono cluster con confidenza >= 50, rispondi {"clusters":[]}. Massimo 4 cluster.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const gate = await checkAiCall(supabase, user.id);
  if (!gate.allowed) {
    return NextResponse.json({ error: 'limit_reached', plan: gate.plan, limit: gate.limit }, { status: 429 });
  }

  const { summary, taskCount, theses } = await req.json();

  const thesesBlock = (theses || []).length
    ? `TESI ESISTENTI:\n${theses.map((t: any) => `- [${t.id}] "${t.thesis}" (confidenza ${t.confidence})`).join('\n')}`
    : 'TESI ESISTENTI: nessuna';

  try {
    const { json: parsed } = await askClaudeJSON({
      model: 'claude-haiku-4-5', // clustering semplice: Haiku basta, ~10x più economico
      system: SYS,
      user: `${thesesBlock}\n\nAnalizza queste ${taskCount} task:\n${summary}`,
      // 8000 (era 3000): fino a 4 cluster, ognuno con 2 confirm + 2 invalidate,
      // superano facilmente 3000 token di output → JSON troncato → parse fallita.
      // Haiku è ~10x economico: headroom abbondante per non troncare mai.
      maxTokens: 8000,
    });
    await bumpAiCall(supabase, user.id, gate.used);
    if (parsed?.clusters?.length) {
      await dedupClusters(parsed.clusters, theses);
      // Segnali non verificabili (metric FRED fuori catalogo / ticker inventato)
      // declassati a 'manual': non sporcano il track record come falsi testabili.
      try { await validateSignals(parsed.clusters); }
      catch (e: any) { console.error('[api/memory] validateSignals skipped:', e?.message); }
    }
    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    // Il clustering è arricchimento di background: un suo fallimento NON deve mai
    // mostrare un 500 all'utente. Logghiamo per diagnosi e ritorniamo cluster vuoti
    // (il frontend gestisce già clusters: []). Rete di sicurezza oltre al token bump.
    console.error('[api/memory] failed:', err?.message, err);
    return NextResponse.json({ result: { clusters: [] }, error: err?.message }, { status: 200 });
  }
}
