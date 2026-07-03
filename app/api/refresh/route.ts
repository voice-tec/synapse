import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { extractJSON, createBatch, getBatch, getBatchResults } from '@/lib/anthropic';
import { fetchTickerPerformance, formatPerf } from '@/lib/quotes';
import { macroSnapshot } from '@/lib/fred';
import { verdictBase, evalSignals, computeConfidence, deriveOutcome } from '@/lib/confidence';

// Refresh ON-DEMAND dei dati dell'utente, chiamato dal client all'apertura
// dell'app. Paga solo chi usa l'app: gli account inattivi costano zero.
//
// - Tesi: ri-valutate via Message Batches (-50% sui token). Il batch viene
//   SOTTOMESSO a questa apertura e INGERITO alla successiva (o quando pronto):
//   per dati che invecchiano in settimane, la latenza è irrilevante.
// - Performance portafogli: prezzi da API gratuita (lib/quotes), zero AI,
//   calcolata in modo sincrono qui.

const STALE_MS = 7 * 24 * 3600 * 1000;
const THESES_PER_REFRESH = 8;
const ACTIONS_PER_REFRESH = 8;

// Il NUMERO di confidenza non lo decide il modello (era rumore non riproducibile):
// è calcolato dai verdetti delle task sorgente + dai segnali testabili scattati
// (vedi computeConfidence/evalSignals). Al modello chiediamo SOLO la nota qualitativa.
const REFRESH_SYS = `Sei il motore di Synapse, una piattaforma di financial intelligence.
Ti viene data una tesi di investimento formulata da un utente in passato.
Ri-valutala ALLA LUCE DEI DATI DI OGGI. Usa web_search per verificare i dati chiave più recenti.
NON dare un punteggio numerico: spiega solo cosa è cambiato.
Rispondi SOLO con JSON valido:
{
  "note": "una frase italiana concisa: cosa è cambiato di recente e in che direzione spinge la tesi (rafforza / indebolisce / tiene)"
}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const staleCutoff = new Date(Date.now() - STALE_MS).toISOString();
  const updatedTheses: any[] = [];
  const updatedActions: any[] = [];
  let status = 'idle';

  const { data: profile } = await supabase
    .from('profiles')
    .select('refresh_batch_id')
    .eq('id', user.id)
    .single();

  // ── 1. Ingerisci il batch pendente, se pronto ──
  if (profile?.refresh_batch_id) {
    try {
      const batch = await getBatch(profile.refresh_batch_id);
      if (batch.processing_status === 'ended' && batch.results_url) {
        const results = await getBatchResults(batch.results_url);
        for (const r of results) {
          if (r.result?.type !== 'succeeded') continue;
          const msg = r.result.message;
          const finalText = (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
          let parsed: any;
          try { parsed = extractJSON(finalText); } catch { continue; }

          const { data: th } = await supabase
            .from('theses')
            .select('*')
            .eq('id', r.custom_id)
            .eq('user_id', user.id)
            .single();
          if (!th) continue;

          // Confidence CALCOLATA (non dal modello): base verdetti + scarto segnali scattati.
          const base = await verdictBase(supabase, user.id, th.source_task_ids || []);
          const { signals, confirmFired, invalidateFired, testableTotal } = await evalSignals(th.signals, th.created_at);
          const newConf = computeConfidence(base, confirmFired, invalidateFired);
          const history = Array.isArray(th.history) ? th.history : [];
          history.push({ thesis: th.thesis, confidence: newConf, date: new Date().toISOString(), note: parsed.note || '' });

          // Track record: esito dedotto dai segnali reali. closed_at solo alla prima chiusura.
          const outcome = deriveOutcome(confirmFired, invalidateFired, testableTotal, newConf);
          const closing = outcome.status !== 'active' && th.status === 'active';
          const update: any = {
            confidence: newConf, signals, history, updated_at: new Date().toISOString(),
            status: outcome.status, accuracy: outcome.accuracy,
            signals_hit: outcome.signalsHit, signals_total: outcome.signalsTotal,
          };
          if (closing) update.closed_at = new Date().toISOString();

          await supabase.from('theses').update(update).eq('id', th.id);
          updatedTheses.push({ id: th.id, cluster_id: th.cluster_id, confidence: newConf, signals, history, status: outcome.status, accuracy: outcome.accuracy, signals_hit: outcome.signalsHit, signals_total: outcome.signalsTotal });
        }
        await supabase.from('profiles').update({ refresh_batch_id: null }).eq('id', user.id);
        status = 'ingested';
      } else if (batch.processing_status === 'in_progress') {
        status = 'pending';
      } else {
        // canceled / expired / stato ignoto: sgancia e riparti al prossimo giro
        await supabase.from('profiles').update({ refresh_batch_id: null }).eq('id', user.id);
      }
    } catch (e) {
      // batch non recuperabile (es. cancellato lato API): sgancia
      await supabase.from('profiles').update({ refresh_batch_id: null }).eq('id', user.id);
    }
  }

  // ── 2. Sottometti un nuovo batch per le tesi stantie ──
  if (status !== 'pending') {
    const { data: stale } = await supabase
      .from('theses')
      .select('id, thesis, confidence, created_at')
      .eq('user_id', user.id)
      .lt('updated_at', staleCutoff)
      .order('updated_at', { ascending: true })
      .limit(THESES_PER_REFRESH);

    if (stale?.length) {
      try {
        const macro = await macroSnapshot();
        const system = [
          { type: 'text', text: REFRESH_SYS },
          ...(macro ? [{ type: 'text', text: macro }] : []),
        ];
        const batch = await createBatch(stale.map((th) => ({
          custom_id: th.id,
          params: {
            model: 'claude-sonnet-5',
            max_tokens: 650, // +30% per il tokenizer di Sonnet 5
            // Thinking adattivo di default su Sonnet 5: disabilitato, consumerebbe il budget
            thinking: { type: 'disabled' },
            system,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
            messages: [{
              role: 'user',
              content: `Tesi: "${th.thesis}"\nFormulata il: ${th.created_at}`,
            }],
          },
        })));
        await supabase.from('profiles').update({ refresh_batch_id: batch.id }).eq('id', user.id);
        status = status === 'ingested' ? 'ingested+submitted' : 'submitted';
      } catch (e: any) {
        console.warn('batch submit failed', e.message);
      }
    }
  }

  // ── 2b. Valutazione SEGNALI immediata (gratis, niente AI) per tesi mai valutate ──
  // Senza questa una tesi nuova mostra 0/0 e "in corso" finché non diventa stantia
  // (7 giorni) e parte il batch AI. evalSignals usa solo dati FRED/prezzi (gratis) e
  // popola subito signals_hit/total/status/accuracy. NON tocca updated_at: la
  // staleness per la nota AI resta intatta. Una volta che signals_total > 0 la tesi
  // non rientra più qui (re-scoring affidato al batch settimanale).
  const { data: unscored } = await supabase
    .from('theses')
    .select('id, cluster_id, signals, created_at, confidence, status')
    .eq('user_id', user.id)
    .eq('signals_total', 0)
    .limit(THESES_PER_REFRESH);
  for (const th of unscored || []) {
    if (!th.signals) continue;
    const { signals, confirmFired, invalidateFired, testableTotal } = await evalSignals(th.signals, th.created_at);
    if (testableTotal === 0) continue; // niente di testabile: lascia 0/0, niente update inutile
    const outcome = deriveOutcome(confirmFired, invalidateFired, testableTotal, th.confidence ?? 0);
    const update: any = {
      signals, status: outcome.status, accuracy: outcome.accuracy,
      signals_hit: outcome.signalsHit, signals_total: outcome.signalsTotal,
    };
    if (outcome.status !== 'active' && th.status === 'active') update.closed_at = new Date().toISOString();
    await supabase.from('theses').update(update).eq('id', th.id);
    updatedTheses.push({ id: th.id, cluster_id: th.cluster_id, confidence: th.confidence, signals, status: outcome.status, accuracy: outcome.accuracy, signals_hit: outcome.signalsHit, signals_total: outcome.signalsTotal });
  }

  // ── 3. Performance portafogli — prezzi gratuiti, sincrono ──
  const { data: staleActions } = await supabase
    .from('actions')
    .select('*')
    .eq('user_id', user.id)
    .or(`performance_updated_at.is.null,performance_updated_at.lt.${staleCutoff}`)
    .limit(ACTIONS_PER_REFRESH);

  for (const ac of staleActions || []) {
    const tickers: string[] = (ac.categories || [])
      .flatMap((c: any) => c.examples || [])
      .map((ex: any) => ex.ticker)
      .filter(Boolean)
      .slice(0, 8);
    if (!tickers.length) continue;

    const items: any[] = [];
    for (const tk of tickers) {
      const pct = await fetchTickerPerformance(tk, ac.created_at);
      if (pct !== null) items.push({ ticker: tk, perf: formatPerf(pct), pct });
    }

    // Timestamp aggiornato anche senza risultati: evita di rimartellare
    // l'endpoint quotes a ogni apertura per ticker irrisolvibili
    const performance = items.length
      ? {
          overall: formatPerf(items.reduce((s, it) => s + it.pct, 0) / items.length),
          items: items.map(({ ticker, perf }) => ({ ticker, perf })),
          note: 'Stima da prezzi di mercato, non aggiustata per dividendi o cambio.',
        }
      : ac.performance;

    await supabase
      .from('actions')
      .update({ performance, performance_updated_at: new Date().toISOString() })
      .eq('id', ac.id);
    if (items.length) updatedActions.push({ id: ac.id, performance });
  }

  return NextResponse.json({ status, updatedTheses, updatedActions });
}
