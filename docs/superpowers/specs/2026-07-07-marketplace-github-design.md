# Marketplace "GitHub della ricerca finanziaria"

**Data:** 2026-07-07 · **Stato:** approvato · **Supera:** `2026-07-07-marketplace-ticker-discovery-design.md`

## Visione

Il marketplace non è "un posto dove scaricare tesi" (quello esiste già: Seeking
Alpha, Substack, Reddit). È il **GitHub della ricerca finanziaria**: le tesi
evolvono, vengono importate, forkate, validate dai dati reali, e costruiscono
una reputazione misurabile. Niente like: contano track record, import, fork,
accuratezza. Il **Knowledge Tree** — l'albero dei fork con track record per
nodo — è la meccanica difficile da copiare: dopo anni il marketplace contiene
la storia dell'evoluzione delle idee, quali ipotesi hanno resistito ai dati e
quali sono state superate.

## Scoperta chiave

Lo scheletro dati esiste già, nessuna migrazione DB per la fase 1:
- `theses.history` jsonb `[{thesis, confidence, date, note}]` = versioni.
- `theses.imported_from_thesis` uuid FK = lineage dei fork (già scritto a ogni
  import dal marketplace).
- `theses.updated_at` = "aggiornata N giorni fa".
- L'import clona già con track record azzerato (segnali senza `fired`,
  accuracy null) — è già un fork, manca solo la ripubblicazione.

L'unico blocco è la regola `imported_no_republish` in
`app/api/market/publish/route.ts`.

## Fase 1 (implementata da questo ciclo)

### 1. Fork ripubblicabile con anti-abuso
Una tesi importata dal marketplace (`imported_from_thesis` presente) diventa
ripubblicabile **solo se modificata** rispetto all'origine: `wordOverlap`
testo < 0.9 (lib/text.ts) oppure predicati dei segnali diversi (testo, kind,
metric, op, threshold normalizzati — helper `signalsPredicatesEqual` in
`lib/fork.ts`). Fork identico → errore `fork_unchanged`. Import da grafo
condiviso o con origine cancellata: resta non ripubblicabile (niente origine
da diffare = niente anti-abuso possibile). Il lineage resta sempre visibile e
il track record del fork parte da zero (già così).

### 2. Pagina dettaglio `/market/t/[id]`
Hero (titolo, autore→profilo, confidenza, stato, accuratezza, settore,
pubblicata il / online da N giorni / aggiornata N giorni fa), segnali con
stato per-segnale (scattato / in attesa / dato mancante / nota qualitativa),
**Evoluzione** (timeline verticale dalle entry di `history` — pubblicare una
tesi pubblica anche la sua evoluzione, detto esplicitamente nel copy),
**Knowledge Tree** (albero indentato: ogni nodo mostra autore, confidenza,
accuratezza, stato; nodo corrente evidenziato; figli privati aggregati come
"+N import privati"; click su un nodo → suo dettaglio), CTA: Importa, Forka
(stesso endpoint import + redirect al grafo), Condividi (copy link).
API: `GET /api/market/thesis/[id]` (admin client, solo `is_public`, 404
altrimenti; albero costruito da `buildForkTree` in `lib/fork.ts`, cap
profondità 6; cache `s-maxage=30`).

### 3. Home a sezioni
🔥 Trending (stats esistenti) · ✓ Confermate (`status=confirmed`) ·
📈 Miglior track record (sort `accuracy`) · 🆕 Nuove (sort `recent`) ·
🧠 Per te (solo autenticati: `GET /api/market/for-me` — ticker dell'utente da
portafoglio + segnali delle proprie tesi via `extractTickers` in
`lib/market-tickers.ts`, incrociati con le tesi pubbliche altrui non ancora
importate; nascosta se vuota). Row orizzontali + "vedi tutte →" che apre la
lista verticale col sort corrispondente. Restano stats, ricerca client-side,
filtro settore.
Nota: "⭐ Verified" della visione è sostituito da "✓ Confermate" finché non
esiste un processo di verifica reale — onesto e derivato dai dati.

### 4. Card ridisegnata
Meta essenziali: ◆ confidenza · stato · track record autore · ⑂ N fork ·
↘ N import · aggiornata N giorni fa · settore. Testo tesi → link al
dettaglio; footer autore + bottone "Apri". L'API vetrina espone `updated_at`
e `forks` (figli pubblici) per item.

## Roadmap Fase 2 (non implementata)

- **Segui autore/tesi + notifiche**: estensione del meccanismo `watches`
  esistente; digest dei verdetti cambiati.
- **Confronta (killer feature)**: due tesi → AI mostra nodi comuni, nodi
  diversi, catalizzatori mancanti, dati diversi, conclusioni diverse.
- **AI all'apertura di una tesi**: "esistono 7 tesi contrarie", "hai ignorato
  il petrolio", "simile al 93% a quella di Luca" (dedup LLM già in casa).
- **Discussione** sulla pagina dettaglio.

## Roadmap Fase 3 (non implementata)

- **Badge** (Macro Expert, 100 Import, 90% Accuracy…): derivati SOLO da
  metriche misurabili, mai autodichiarati.
- **Challenge settimanali** a tema con classifica automatica dai dati.
- **Marketplace Score** composito (confidence, track record, originalità,
  fonti, import, fork, freschezza).
- **Feed intelligente** per interessi (settori/ticker seguiti).
- **Verified** vero (processo di verifica identità/competenza).

## Il ciclo di vita

Domanda → ricerca → grafo → tesi → pubblica → altri la trovano → importano →
forkano → aggiornano → il track record cresce → la tesi migliora → nuovi fork
→ nuove prove → nuova reputazione. Non un archivio: un ecosistema che si
auto-migliora.

## Vincoli

Commenti in italiano; copy bilingue IT/EN; `npx tsc --noEmit` + `npm run test`
prima di ogni commit; mai push senza ok esplicito (deploy prod); niente
`for...of` su Set; fase 1 senza modifiche a `supabase/schema.sql`.
