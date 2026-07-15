# Evolution Engine — design PARCHEGGIATO

> **STATO: PARCHEGGIATA — NON ESEGUIRE.**
> Decisione del 2026-07-13: il collo di bottiglia attuale è la mancanza di
> utenti, non la qualità delle risposte — e il motore stesso non può
> funzionare senza volume. Focus su crescita.
> **Condizione di riapertura: ~50+ utenti attivi**, o comunque un volume di
> richieste/tesi che renda misurabili i livelli L1/L2 dell'evaluator.

## Idea (proposta utente)

Trasformare Symnaps da piattaforma che risponde a piattaforma che **migliora
il proprio modo di ragionare**: ispirazione AlphaEvolve, ma a evolvere è il
comportamento (prompt, strategie di ricerca, sequenze, euristiche del grafo),
non il codice. Componenti immaginati: Workflow Generator, Prompt Evolver,
Knowledge Graph Evolver, Evaluator, memoria evolutiva; ogni modifica =
esperimento con id, metriche e decisione (promossa/scartata); rollout
prudente su percentuali piccole di traffico; feedback implicito dal
comportamento utente.

## Critica (perché la versione ingenua non funziona qui)

1. **Significatività online impossibile a questo traffico.** A/B su varianti
   di prompt richiede centinaia di campioni per braccio; a decine di
   analisi/mese le decisioni arriverebbero in tempi geologici. AlphaEvolve
   funziona perché la sua valutazione è oggettiva, economica e istantanea —
   la nostra è costosa (LLM judge) e rumorosa.
   → **L'evoluzione avviene OFFLINE su un golden set; il traffico reale è
   solo smoke test (canary), mai motore statistico.**
2. **Varianti parallele in produzione = 2-3× costo per richiesta.** Mai nel
   path di prod; solo nell'harness offline.
3. **"Soddisfazione utente" senza rating espliciti è inferenza fragile.**
   Prima di tutto: 👍/👎 minimale sulle risposte. I segnali impliciti
   (dwell, nodi aperti) sono deboli e gameable (verbosità → dwell).
4. **Troppo complesso per una v1:** Workflow Generator freeform (spazio di
   ricerca enorme, unsafe, 6 workflow fissi totali); KG Evolver autonomo
   (tocca dati utente — versione sicura: evolvere i PESI dell'euristica
   connessioni già versionata con `CONN_HEURISTIC_VERSION`, e archi proposti
   come suggerimenti con accept-rate come fitness).

## Cosa è davvero innovativo (il fossato)

**Il mercato come fitness function.** Symnaps ha già un evaluator oggettivo
che non è un LLM: il track record delle tesi (`lib/confidence.ts`,
`deriveOutcome` su dati FRED/prezzi/fondamentali). La domanda "le tesi
prodotte dalla strategia B vengono confermate dai dati reali più spesso di
quelle della A?" ha una risposta gratuita e non gameable. Feedback lento
(settimane) ma perfetto per generazioni evolutive settimanali. Secondo
asso già in casa: `validateSignals` — il tasso di segnali declassati a
`manual` è un **rilevatore di allucinazioni oggettivo e gratuito** per
confrontare prompt.

## Architettura (quando si riaprirà)

**Reframe centrale: strategia = configurazione versionata, non codice.**
Prompt/modello/max_tokens/flag oggi hardcoded nelle route → esternalizzati.

- **Strategy Registry** (tabella `strategies`, Supabase): scope
  (analyze|memory|suggest|conn_heuristic|…), params jsonb, version, status
  (draft|candidate|champion|retired), `parent_id` per lineage (stesso
  pattern di `imported_from_thesis`), `decision_note` (memoria evolutiva).
  Loader `lib/strategy.ts` con cache TTL; canary deterministico
  `hash(user_id) % 100 < traffic_pct`.
- **Experiments** (tabella): champion vs challenger, traffic_pct, metriche
  aggregate, TTL (expired se inconclusivo). **Un solo esperimento attivo per
  scope** (a questa scala gli effetti d'interazione distruggono il segnale).
- **strategy_runs** (tabella): log per richiesta — strategia, latenza,
  token, costo, flag qualità L0. Postgres basta per anni.
- **Evaluator a strati:**
  - L0 oggettivo/gratuito/immediato: parse ok, retry, demotion rate di
    validateSignals, data_missing rate, citazioni, latenza, costo;
  - L1 implicito (giorni): PostHog (nodo aperto, dwell, follow-up, export,
    share, publish) + 👍/👎 esplicito; peso minore di L0;
  - L2 ground truth (settimane): esiti tesi attribuiti alla strategia
    generatrice — la metrica regina;
  - LLM judge pairwise position-debiased: SOLO offline su golden set.
- **Prompt Evolver** (offline, cron/manuale): champion + run peggiori →
  Sonnet propone k mutazioni con rationale → golden set (30-50 domande reali
  congelate) → migliore diventa candidate → canary 5-10% come smoke test →
  promozione con approvazione umana (v1). Memoria evolutiva = lineage +
  decision_note ("già provato e fallito: …") nel prompt dell'evolver.
- **Guardrail:** auto-rollback su metriche hard (parse-failure, 5xx,
  costo > 2× champion); revert = flip di status; sezioni prompt CONGELATE
  (disclaimer/compliance) non mutabili strutturalmente.
- **Anti-overfitting:** golden set congelato + held-out mai usato per
  selezione; rotazione parziale col traffico fresco; strategie promosse
  restano in osservazione L2 (invalidazioni sopra baseline → alert+revert);
  selezione su score composito, report di tutte le componenti (anti-Goodhart).
- **Infra:** tutto Supabase jsonb + PostHog esistente; Vercel Cron/on-demand
  (filosofia "idle users cost nothing"); niente vector DB, niente code.

## Roadmap

- **MVP (igiene, utile anche senza engine):** 1) registry + loader per
  analyze/memory (prompt hotfix senza deploy); 2) strategy_runs con L0;
  3) golden set + harness offline (script stile `scripts/seed-market.ts`);
  4) loop manuale variante→eval→promozione, registrato come esperimento.
- **V2:** prompt evolver automatico + memoria evolutiva; canary online con
  auto-rollback; enrichment L1; 👍/👎 in UI; report settimanale.
- **V3:** attribuzione ground truth (L2) come fitness; evoluzione pesi
  euristica connessioni via replay + archi suggeriti con accept-rate;
  decisioni bayesiane sequenziali; champion per segmento (lingua/tipo).
- **Visione:** co-evoluzione multi-scope; workflow varianti solo con DSL
  tipizzato di step ammessi; l'account "Symnaps Research" sul marketplace
  come vetrina pubblica del motore — il track record delle tesi generate
  dal sistema è la prova misurabile (e il marketing) che la piattaforma
  migliora.

## Tagliati esplicitamente

Workflow generator freeform; KG evolver autonomo su dati utente; esecuzione
parallela di varianti in produzione; pretese di significatività statistica
online al traffico attuale.
