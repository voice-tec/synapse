# Marketplace: ticker come asse di discovery + pagina dettaglio tesi

**Data:** 2026-07-07 · **Stato:** approvato

## Obiettivo

Migliorare la **scoperta** delle tesi sul marketplace. Con il dataset attuale
(<30 tesi pubbliche) la discovery non è filtrare un catalogo grande: è rendere
ogni tesi più raggiungibile e collegarla a ciò che interessa all'utente (i suoi
ticker). Tre slice indipendenti, ognuna utile da sola, in ordine di valore.

## Contesto tecnico

- I `signals` delle tesi sono strutturati: i kind `ticker`, `fund`, `pe`
  portano il simbolo in `s.metric` (validato al salvataggio da
  `lib/signals.ts`, quindi affidabile). Oggi `api/market` li appiattisce a solo
  testo (`sigText`) — il dato ticker esiste ma non è esposto.
- Il portafoglio utente è `profiles.portfolio`: array `{name, ticker, weight,
  note}`.
- Nessuna migrazione DB richiesta da nessuna slice: solo codice.

## Slice 1 — Ticker visibili e filtrabili in `/market`

**API** (`app/api/market/route.ts`):
- Nuova helper `extractTickers(signals)` in `lib/` (es. `lib/market-tickers.ts`),
  con test vitest: raccoglie `s.metric` dai segnali con kind
  `ticker`/`fund`/`pe` (confirm + invalidate), dedup, uppercase.
- Ogni item della vetrina ritorna `tickers: string[]`.
- Nuovo param `?ticker=NVDA`: filtro in memoria post-query (dataset bounded,
  stesso pattern del sort per reputazione). La CDN cachea per URL completo,
  quindi la cache continua a funzionare senza modifiche.

**UI** (`app/market/page.tsx` + `app/market/ui.tsx`):
- Chip monospace con i ticker sulla card (accanto al settore).
- Click su chip → attiva il filtro ticker e aggiorna l'URL:
  `/market?ticker=NVDA` è deep-linkabile (prerequisito della slice 3).
- Filtro attivo mostrato come chip con "×" accanto al select settore.
- Stringhe nuove in entrambe le lingue (dizionari `P`/`MT`).

## Slice 2 — Pagina dettaglio `/market/t/[id]`

Oggi una tesi pubblica non ha un URL proprio. Il dettaglio la rende una
destinazione linkabile (bonus SEO).

**API** `app/api/market/thesis/[id]/route.ts` (admin client; risponde solo se
`is_public`, altrimenti 404):
- Tesi completa: testo, spiegazione, confidenza, stato, accuratezza, settore,
  segnali con stato (`text`, direzione, `fired`, `data_missing`), ticker.
- Blocco autore: ref opaco/`display_name`, reputazione (`authorRep`).
- Import ricevuti (conteggio cloni).
- **Correlate** (max 5, mai la tesi stessa): ranking stesso ticker > stesso
  settore > `wordOverlap` (`lib/text.ts`). Helper di ranking in `lib/` con
  test vitest.
- Cache `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`.

**Page** `app/market/t/[id]/page.tsx` (client, riusa `MarketTopbar`,
`AccuracyBar`, `btnStyle`, dizionari marketplace):
- Tesi, spiegazione, segnali ✓/✗ con indicazione scattato/dato mancante,
  barra accuratezza, autore linkato al profilo, CTA import (stessa macchina a
  stati `ImpState`), correlate come mini-card linkate.
- Il testo della tesi nelle card di `/market`, nelle trending e nel profilo
  autore diventa link al dettaglio.

## Slice 3 — Ponte nel grafo

**API** `app/api/market/for-me/route.ts` (auth utente via
`lib/supabase-server`, lettura cross-utente via admin):
- Ticker dell'utente = portafoglio + segnali delle proprie tesi.
- Match vs ticker delle tesi pubbliche di altri (escluse le proprie e le già
  importate).
- Ritorna `{count, tickers}` (top 3 ticker per numero di tesi).

**Grafo** (`app/synapse/body.ts` + `public/synapse/graph.js`):
- Chip discreto nell'HUD: "N tesi community sui tuoi titoli" → link
  `/market?ticker=X` (un solo ticker) o `/market` (più ticker).
- i18n con `TT()` + voce in `SYN_EN`.
- Dismissibile via `localStorage`; riappare se `count` cresce rispetto
  all'ultimo dismiss.
- Fetch lazy dopo l'init del grafo, mai bloccante.

## Gestione errori

Ogni pezzo degrada in silenzio: API ticker assente → nessun chip; correlate
vuote → sezione nascosta; `for-me` in errore → nessun chip nel grafo. Nessuna
slice può rompere una pagina esistente.

## Test

- `lib/market-tickers.ts` (`extractTickers`) e la helper di ranking correlate:
  test vitest accanto al sorgente (`lib/*.test.ts`, ambiente node).
- Superfici UI e route: verifica manuale su dev (`npm run dev`), inclusi i
  casi 404/tesi privata per il dettaglio.
- `npx tsc --noEmit` prima di ogni commit.

## Fuori scope

Ricerca server-side, tag liberi, feed personalizzato ranked, metadata SEO
dinamici per il dettaglio (le pagine market sono client; basta il layout
statico come per le altre).
