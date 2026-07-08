# Offerta prodotti — Symnaps

> Questo documento serve a rispondere senza errori a "cosa include, quanto
> costa, cosa è gratis". I numeri vengono dal codice: se cambiano lì, va
> aggiornato qui.

## Piani (2026-07)

| | **Free** | **Pro** (in arrivo) | **Team** |
|---|---|---|---|
| Prezzo | 0 € | **€9.90/mese** | allineato a Pro (non in vendita) |
| Analisi (domande) / mese | **10** | **150** | 150 |
| Azioni AI accessorie / mese | **50** | **500** | 500 |
| Feature | tutte | tutte | tutte |

- Le "azioni AI accessorie" coprono clustering delle tesi, suggerimenti,
  portafogli, sfide (avvocato del diavolo).
- **Pro non è ancora acquistabile**: sul sito c'è la waitlist (evento
  PostHog `pro_waitlist`). Processor previsto: Lemon Squeezy.
- Nessuna differenza di feature tra i piani: si paga il volume, non le
  funzioni. Argomento di vendita onesto: "provi tutto gratis, paghi solo se
  ti serve più volume".

## Cosa include il prodotto (tutti i piani)

- **Grafo di ricerca**: domande ● con verdetto (sì/no/dipende), fonti citate,
  connessioni automatiche tra nodi.
- **Tesi ◆** con confidenza calcolata, scenari bull/base/bear, catalizzatori,
  segnali testabili (macro FRED, prezzi, fondamentali FMP) e **track record**
  (confermata/invalidata/in corso) ricontrollato sui dati.
- **Stress test**: sfida una tesi con una variabile macro; **avvocato del
  diavolo**: contro-tesi generata per trovare i punti deboli.
- **Portafogli ▤ educativi** dalla tesi (categorie e strumenti reali) +
  caricamento del proprio portafoglio ("già coperto in parte da VWCE").
- **Avvisi**: watch settimanale sul verdetto di una domanda (limite di avvisi
  attivi per piano).
- **Condivisione**: link pubblico read-only del grafo, senza account.
- **Marketplace**: pubblicazione tesi (richiede confidenza ≥60%, nome
  pubblico, max 20 tesi pubbliche), **evolvi** nel tuo grafo le tesi altrui
  (track record che riparte da zero), knowledge tree, reputazione autori per
  accuratezza, identità #hash o nome pubblico.
- **Bilingue** IT/EN su tutto il sito e l'app.

## Perché tanto gratis (strategia di fase)

Beta soft: l'obiettivo ora è **utenti attivi e loop del marketplace**, non
revenue. Il cap di 10 analisi/mese tiene i costi AI sotto controllo; la
waitlist Pro misura l'intento di pagamento senza l'attrito del billing.

## FAQ / obiezioni

- **Serve la carta?** No. "Gratis per iniziare. Nessuna carta richiesta."
- **Che fine fanno i miei dati?** Il grafo è privato di default. Nel
  marketplace appari come hash anonimo (#a3f21c09) finché non scegli tu un
  nome pubblico. Il portafoglio caricato non è mai visibile ad altri.
- **È consulenza finanziaria?** No: strumento di ricerca a taglio educativo,
  nessuna raccomandazione personalizzata (disclaimer in
  `guida-voce-brand.md`).
- **I numeri sono affidabili?** Le fonti sono istituzionali (FRED, Twelve
  Data, FMP). Se un dato non è disponibile, il segnale risulta "dato
  mancante" e non conta nel track record — mai numeri inventati.
- **Cosa succede se supero il limite?** L'app avvisa e rimanda a /pricing;
  il conteggio si azzera ogni mese.

## Roadmap monetizzazione (interna, non promettere date)

1. Billing Pro via Lemon Squeezy quando la waitlist giustifica l'attivazione.
2. Upgrade manuale possibile già oggi (campo `profiles.plan` in Supabase) per
   partner/beta tester.

---

**Fonti di verità nel repo:** `PLAN_LIMITS` in `app/api/analyze/route.ts`
(10/150), `AI_CALL_LIMITS` in `lib/ai-usage.ts` (50/500), `app/pricing/page.tsx`
(€9.90 + waitlist), `app/api/market/publish/route.ts` (regole pubblicazione),
memoria di progetto `launch-pricing-decisions` (Lemon Squeezy, beta soft).
