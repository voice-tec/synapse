# Contesto brand — Symnaps

> Questo documento serve a dare a chiunque (persona o agente) il contesto per
> parlare di Symnaps senza travisarlo: cos'è, per chi, perché esiste, cosa lo
> distingue. È la fonte di verità per ogni contenuto di marketing.

## Cos'è

Symnaps è un **sistema di pensiero visivo per la ricerca finanziaria**.
L'utente parte da una domanda ("le big tech reggono coi tassi alti?"); Symnaps
risponde con dati ufficiali e prende posizione con un verdetto netto — sì, no
o dipende. Le domande sullo stesso tema si fondono in **tesi** con una
confidenza calcolata dai dati; le tesi solide si traducono in **portafogli**
educativi (categorie e strumenti reali, incrociati con ciò che l'utente già
possiede). Tutto vive in un grafo dinamico che si evolve nel tempo.

Tre tipi di nodo, tre glifi: **● domande, ◆ tesi, ▤ portafogli**.

## Il problema

La ricerca finanziaria retail oggi è:

- **opinioni sparse** — thread, video, newsletter: nessuna struttura, nessuna
  memoria, nessun modo di capire a distanza di mesi se un ragionamento reggeva;
- **note morte** — chi prende appunti (Notion, quaderni) accumula testo che
  non si aggiorna coi dati e non si collega;
- **guru senza track record** — chi vende analisi non risponde mai dei propri
  errori: le previsioni sbagliate spariscono, quelle giuste si amplificano.

## La risposta

1. **Dati ufficiali, non opinioni.** Serie macro FRED®, prezzi Twelve Data,
   fondamentali FMP. Niente numeri inventati: se un dato non c'è, Symnaps lo
   dice ("dato mancante") invece di improvvisare.
2. **Un track record che non si può gonfiare.** Ogni tesi ha segnali
   testabili (prezzi, macro, fondamentali) che la confermano o la invalidano
   sui dati reali. "Confermata" richiede più segnali scattati e zero
   invalidazioni: non è dichiarata, è calcolata. Ricontrollo settimanale.
3. **La ricerca si accumula.** Il grafo è la memoria: ogni analisi conclusa
   resta, si collega alle nuove, e la confidenza delle tesi si muove con i
   verdetti e i segnali.

## Il marketplace: il GitHub della ricerca finanziaria

Le tesi migliori non restano private. Un utente può pubblicare una tesi (serve
confidenza ≥60% e segnali misurabili) e chiunque può **evolverla** nel proprio
grafo: la tesi riparte con track record azzerato e si dimostra sui dati da
quel giorno in poi. Le evoluzioni modificate e ripubblicate diventano rami di
un **knowledge tree** — la genealogia delle idee, come i fork su GitHub.

La reputazione degli autori è l'accuratezza reale (tesi confermate contro
invalidate), non i like: **non si compra e non si gonfia**. L'identità è
privacy-first: hash anonimo (#a3f21c09) oppure nome pubblico, a scelta.

## Differenziatori (contro cosa ci confrontano)

| Alternativa | Perché Symnaps è diverso |
|---|---|
| ChatGPT & co. | Un chat generico non ha dati di mercato verificati, non ha memoria strutturata, non risponde dei propri verdetti. Symnaps àncora ogni risposta a fonti istituzionali e registra tutto nel grafo. |
| Seeking Alpha, guru, newsletter | Lì compri l'opinione di qualcuno. Qui ogni tesi — tua o importata — ha un track record misurato sui dati, e gli autori una reputazione calcolata. |
| Notion / note / fogli | Le note non si aggiornano coi prezzi e non si collegano da sole. Il grafo sì: verdetti dinamici, segnali ricontrollati, connessioni automatiche. |
| Copy trading / segnali | Symnaps non dice cosa comprare. Costruisce il ragionamento e lo mette alla prova. Taglio educativo, sempre. |

## Cosa Symnaps NON è (vincolo legale e di brand)

- **Non è consulenza finanziaria.** Output a taglio educativo; nessuna
  raccomandazione personalizzata di investimento. Ogni contenuto marketing
  che parla di portafogli o strumenti eredita questo disclaimer.
- **Non promette rendimenti.** Mai "guadagna", "batti il mercato", "+X%".
  La promessa è il metodo: ragionare meglio, con i dati, nel tempo.
- **Non è un tool di trading.** Niente segnali operativi, niente esecuzione.

## Personalità del brand in 5 aggettivi

1. **Rigoroso** — i numeri hanno una fonte o non esistono.
2. **Sobrio** — understatement, minuscole, zero hype.
3. **Visivo** — il grafo è l'identità: si mostra, non si descrive.
4. **Onesto** — "dipende" è una risposta legittima; "dato mancante" pure.
5. **Paziente** — la ricerca si accumula; il track record si costruisce in
   settimane, non in un titolo clickbait.

## Stato attuale (2026-07)

Beta soft su symnaps.com, prodotto bilingue IT/EN, piano Free attivo, Pro
(€9.90/mese) in waitlist — vedi `offerta-prodotti.md`. Marketplace attivo con
le prime ~20 tesi pubbliche, incluse quelle dell'account ufficiale dichiarato
"Symnaps Research".

---

**Fonti di verità nel repo:** `app/welcome/page.tsx` (positioning e claim),
`app/pricing/page.tsx` (piani), `CLAUDE.md` (architettura e vincoli),
`docs/superpowers/specs/2026-07-07-marketplace-github-design.md` (visione
marketplace), `lib/confidence.ts` (regole del track record).
