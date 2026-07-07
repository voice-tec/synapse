# Marketplace Ticker Discovery Implementation Plan

> **SUPERATO** — non eseguire. Sostituito dalla spec
> `docs/superpowers/specs/2026-07-07-marketplace-github-design.md`
> ("GitHub della ricerca finanziaria", fase 1: fork + albero + home a sezioni).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ticker estratti dai segnali come asse di discovery del marketplace: chip/filtro in `/market`, pagina dettaglio `/market/t/[id]` con tesi correlate, chip nel grafo "N tesi community sui tuoi titoli".

**Architecture:** I segnali delle tesi portano già i simboli in `s.metric` (kind `ticker`/`fund`/`pe`, validati al salvataggio). Una helper pura `extractTickers` in `lib/` li espone; l'API vetrina li ritorna e filtra in memoria (stesso pattern del sort per reputazione); una nuova route dettaglio (admin client, solo `is_public`) serve la pagina `/market/t/[id]`; una route `for-me` incrocia i ticker dell'utente con le tesi pubbliche altrui per il chip nel grafo. Nessuna migrazione DB.

**Tech Stack:** Next.js 14 App Router, Supabase (RLS + admin client), vitest (solo `lib/**/*.test.ts`, env node), vanilla JS per `public/synapse/graph.js`.

**Spec:** `docs/superpowers/specs/2026-07-07-marketplace-ticker-discovery-design.md`

## Global Constraints

- Commenti nel codice in **italiano**; copy utente bilingue IT/EN (l'italiano è la lingua sorgente).
- Prima di OGNI commit: `npx tsc --noEmit` e `npm run test` devono passare.
- Commit message termina con: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **MAI `git push`** (push su main = deploy in produzione; solo l'utente lo autorizza).
- `tsconfig` ha `strict: false` e **niente `downlevelIteration`**: mai `for...of` su un `Set` — usare `Array.from(...)`.
- Nessuna modifica a `supabase/schema.sql` (nessuna slice tocca il DB).
- Stile pagine market: inline style, tema `#08080a` + Fraunces, come i file esistenti in `app/market/`.
- In `graph.js`: stringhe UI via `TT('testo italiano')` + voce corrispondente in `SYN_EN`.
- Ogni feature degrada in silenzio: un'API in errore non deve mai rompere una pagina esistente.

---

## Slice 1 — Ticker visibili e filtrabili in `/market`

### Task 1: helper `extractTickers` in lib (TDD)

**Files:**
- Create: `lib/market-tickers.ts`
- Test: `lib/market-tickers.test.ts`

**Interfaces:**
- Consumes: niente (funzione pura).
- Produces: `extractTickers(signals: any): string[]` — da un oggetto `signals` di una tesi (`{confirm: Signal[], invalidate: Signal[]}`, item possibili anche stringhe legacy) ritorna i simboli dedup, uppercase, in ordine di apparizione. Kind con simbolo: `ticker`, `fund`, `pe` (alias legacy); il simbolo sta in `s.metric`.

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// lib/market-tickers.test.ts
import { describe, it, expect } from 'vitest';
import { extractTickers } from './market-tickers';

describe('extractTickers', () => {
  it('estrae i simboli dai kind ticker/fund/pe (metric), uppercase e dedup', () => {
    const signals = {
      confirm: [
        { kind: 'ticker', metric: 'nvda', text: 'NVDA +20%' },
        { kind: 'fund', metric: 'NVDA', field: 'pe', text: 'P/E sotto 40' },
        { kind: 'pe', metric: 'tsm', text: 'P/E TSMC' },
        { kind: 'fred', metric: 'CPIAUCSL', text: 'inflazione' },
      ],
      invalidate: [
        { kind: 'ticker', metric: 'AMD', text: 'AMD -15%' },
        { kind: 'manual', metric: null, text: 'nota qualitativa' },
      ],
    };
    expect(extractTickers(signals)).toEqual(['NVDA', 'TSM', 'AMD']);
  });

  it('ignora item stringa (legacy), segnali senza metric e input null', () => {
    expect(extractTickers(null)).toEqual([]);
    expect(extractTickers({})).toEqual([]);
    expect(extractTickers({ confirm: ['testo legacy', { kind: 'ticker', metric: '' }], invalidate: null })).toEqual([]);
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `npx vitest run lib/market-tickers.test.ts`
Expected: FAIL — `Cannot find module './market-tickers'` (o simile).

- [ ] **Step 3: Implementazione minima**

```ts
// lib/market-tickers.ts
// Estrae i ticker dai segnali strutturati di una tesi: i kind 'ticker', 'fund'
// e 'pe' (alias legacy) portano il simbolo in `metric`, già validato al
// salvataggio da lib/signals.ts (i simboli inventati vengono declassati a
// manual). Dedup, uppercase, ordine di apparizione. Funzione pura: usata da
// api/market (vetrina), api/market/thesis (dettaglio) e api/market/for-me.

const SYMBOL_KINDS = new Set(['ticker', 'fund', 'pe']);

export function extractTickers(signals: any): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const dir of ['confirm', 'invalidate'] as const) {
    for (const s of signals?.[dir] || []) {
      if (!s || typeof s === 'string') continue;
      if (!SYMBOL_KINDS.has(s.kind) || !s.metric) continue;
      const sym = String(s.metric).toUpperCase().trim();
      if (sym && !seen.has(sym)) { seen.add(sym); out.push(sym); }
    }
  }
  return out;
}
```

- [ ] **Step 4: Verifica che passi**

Run: `npx vitest run lib/market-tickers.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Typecheck + suite completa + commit**

Run: `npx tsc --noEmit && npm run test`
Expected: zero errori.

```bash
git add lib/market-tickers.ts lib/market-tickers.test.ts
git commit -m "feat: extractTickers — ticker dai segnali di una tesi

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2: API vetrina e profilo autore ritornano `tickers` + filtro `?ticker=`

**Files:**
- Modify: `app/api/market/route.ts`
- Modify: `app/api/market/author/[ref]/route.ts`

**Interfaces:**
- Consumes: `extractTickers` (Task 1).
- Produces: ogni item di `GET /api/market` e ogni thesis di `GET /api/market/author/[ref]` ha `tickers: string[]`. `GET /api/market?ticker=NVDA` filtra (match esatto case-insensitive). `total`/`hasMore` riflettono il filtro.

- [ ] **Step 1: Modifica `app/api/market/route.ts`**

Aggiungi l'import in testa (dopo gli altri import):

```ts
import { extractTickers } from '@/lib/market-tickers';
```

Dopo la riga che legge `sectorFilter` aggiungi:

```ts
  const tickerFilter = (params.get('ticker') || '').trim().toUpperCase();
```

Nel mapping degli item (il blocco `const all = pubRows.map((t) => ({ ... }))`): cambia `const all` in `let all` e aggiungi il campo dopo `sector`:

```ts
    tickers: extractTickers(t.signals),
```

Subito dopo il mapping, prima del blocco sort, aggiungi:

```ts
  // Filtro ticker: in memoria come il sort (dataset bounded); la CDN cachea
  // per URL completo quindi ogni combinazione di filtri è una entry distinta.
  if (tickerFilter) all = all.filter((i) => i.tickers.includes(tickerFilter));
```

- [ ] **Step 2: Modifica `app/api/market/author/[ref]/route.ts`**

Import in testa:

```ts
import { extractTickers } from '@/lib/market-tickers';
```

Nel mapping finale `theses: theses.map((t) => ({ ... }))` aggiungi dopo `sector`:

```ts
        tickers: extractTickers(t.signals),
```

- [ ] **Step 3: Verifica manuale**

Run: `npx tsc --noEmit` → zero errori.
Con `npm run dev` attivo:

```bash
curl -s 'http://localhost:3000/api/market?limit=3' | python3 -m json.tool | grep -A3 tickers
curl -s 'http://localhost:3000/api/market?ticker=NVDA' | python3 -c "import json,sys; j=json.load(sys.stdin); print(j['total'], [i['tickers'] for i in j['items']])"
```

Expected: gli item hanno `tickers: [...]`; con `?ticker=` restano solo item che lo contengono (o lista vuota, senza errori).

- [ ] **Step 4: Commit**

```bash
git add app/api/market/route.ts 'app/api/market/author/[ref]/route.ts'
git commit -m "feat: api market — tickers per tesi + filtro ?ticker=

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: UI /market — chip ticker sulle card + filtro attivo deep-linkabile

**Files:**
- Modify: `app/market/ui.tsx`
- Modify: `app/market/page.tsx`

**Interfaces:**
- Consumes: `tickers` negli item API (Task 2).
- Produces: `Item.tickers?: string[]`; componente `TickerChips({ tickers })` esportato da `ui.tsx`; `/market?ticker=NVDA` deep-linkabile (prerequisito Task 7-8). I chip sono **link** a `/market?ticker=X` (full page load: semplice, funziona da ogni pagina che usa `ThesisCard`).

- [ ] **Step 1: `ui.tsx` — tipo, dizionario, componente chip**

Nel tipo `Item` aggiungi dopo `signals`:

```ts
  tickers?: string[];
```

Nel dizionario `MT.it` aggiungi:

```ts
    tickerTitle: 'vedi tutte le tesi su questo ticker',
```

e in `MT.en`:

```ts
    tickerTitle: 'see all theses on this ticker',
```

Nuovo componente esportato (dopo `ImportsBadge`):

```tsx
// Chip ticker di una tesi: link al marketplace filtrato su quel simbolo.
export function TickerChips({ tickers }: { tickers?: string[] }) {
  const [, , t] = useMarketLang();
  if (!tickers?.length) return null;
  return (
    <>
      {tickers.slice(0, 6).map((tk) => (
        <a key={tk} href={`/market?ticker=${encodeURIComponent(tk)}`} title={t.tickerTitle}
          style={{ fontFamily: 'monospace', fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#101624', color: '#5b9cf6', textDecoration: 'none' }}>
          {tk}
        </a>
      ))}
    </>
  );
}
```

In `ThesisCard`, nella riga header (il div con `◆ {t.conf}...`), aggiungi `<TickerChips tickers={it.tickers} />` subito dopo `<ImportsBadge n={it.imports} />`.

- [ ] **Step 2: `page.tsx` — stato ticker da URL + fetch + chip filtro attivo**

Nessun import nuovo (i chip li rende `ThesisCard` da `ui.tsx`). Aggiungi nello stato del componente (vicino a `sector`):

```ts
  // Filtro ticker: letto dall'URL al mount (deep-link /market?ticker=NVDA).
  // Lazy initializer: evita un doppio fetch (prima senza e poi con filtro).
  const [ticker, setTicker] = useState<string>(() =>
    typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('ticker') || '').toUpperCase(),
  );
```

In `listUrl` aggiungi dopo la riga del sector:

```ts
    if (ticker) p.set('ticker', ticker);
```

Nell'`useEffect` del fetch iniziale cambia le dependencies da `[sector, sort]` a `[sector, sort, ticker]`.

Funzione per togliere il filtro (sopra il `return`):

```ts
  const clearTicker = () => {
    setTicker('');
    // Pulisce l'URL senza ricaricare la pagina.
    try { const u = new URL(window.location.href); u.searchParams.delete('ticker'); window.history.replaceState(null, '', u.toString()); } catch {}
  };
```

Nel blocco filtri (accanto al `<select>` settore), aggiungi il chip del filtro attivo:

```tsx
            {ticker && (
              <button onClick={clearTicker}
                style={{ fontFamily: 'monospace', background: '#101624', border: '1px solid #24324a', borderRadius: 9, padding: '8px 12px', color: '#5b9cf6', fontSize: 11.5, cursor: 'pointer' }}>
                {ticker} ×
              </button>
            )}
```

Nei dizionari `P` della pagina aggiungi — `P.it`:

```ts
    emptyTicker: (x: string) => `Nessuna tesi pubblica su ${x}.`,
```

`P.en`:

```ts
    emptyTicker: (x: string) => `No public theses on ${x}.`,
```

E lo stato empty diventa:

```tsx
        {state === 'empty' && <div style={{ color: '#7a7a95', fontSize: 13 }}>{ticker ? lp.emptyTicker(ticker) : sector ? lp.emptySector(sector) : lp.empty}</div>}
```

- [ ] **Step 3: Verifica manuale**

Run: `npx tsc --noEmit && npm run test` → zero errori.
Con dev attivo, in browser:
- `/market` → card con chip ticker monospace blu (solo tesi con segnali ticker/fund).
- Click su un chip → `/market?ticker=X`, lista filtrata, chip `X ×` visibile.
- Click su `X ×` → filtro rimosso, URL pulito, lista completa.
- `/market?ticker=ZZZZZ` → messaggio "Nessuna tesi pubblica su ZZZZZ.".
- Toggle lingua EN → title chip e messaggio empty in inglese.

- [ ] **Step 4: Commit**

```bash
git add app/market/ui.tsx app/market/page.tsx
git commit -m "feat: /market — chip ticker sulle card + filtro ?ticker deep-linkabile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Slice 2 — Pagina dettaglio `/market/t/[id]`

### Task 4: helper `rankRelated` in lib (TDD)

**Files:**
- Create: `lib/market-related.ts`
- Test: `lib/market-related.test.ts`

**Interfaces:**
- Consumes: `wordOverlap(a: string, b: string): number` da `@/lib/text`.
- Produces: `rankRelated<T extends RelatedCandidate>(current: RelatedCandidate, candidates: T[], max?: number): T[]` con `type RelatedCandidate = { id: string; thesis: string; sector: string | null; tickers: string[] }`. Score: ticker condiviso +2, stesso settore +1, + `wordOverlap` dei testi; soglia minima 0.2; mai la tesi stessa; max 5 di default.

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// lib/market-related.test.ts
import { describe, it, expect } from 'vitest';
import { rankRelated } from './market-related';

const mk = (id: string, thesis: string, sector: string | null, tickers: string[]) => ({ id, thesis, sector, tickers });

describe('rankRelated', () => {
  const current = mk('a', 'I semiconduttori guidano il ciclo AI nei prossimi anni', 'tech', ['NVDA']);

  it('ticker condiviso batte stesso settore, che batte solo overlap; esclude se stessa e le non correlate', () => {
    const candidates = [
      mk('a', 'I semiconduttori guidano il ciclo AI nei prossimi anni', 'tech', ['NVDA']), // se stessa
      mk('b', 'Il lusso europeo rallenta con la Cina', 'consumo', ['MC']),                  // niente in comune
      mk('c', 'NVDA resta il fornitore dominante del training AI', 'tech', ['NVDA']),       // ticker+settore
      mk('d', 'Il software enterprise cresce sopra il mercato', 'tech', []),                // solo settore
    ];
    const r = rankRelated(current, candidates);
    expect(r.map((x) => x.id)).toEqual(['c', 'd']);
  });

  it('rispetta max', () => {
    const candidates = [
      mk('c1', 'tesi uno', 'tech', ['NVDA']),
      mk('c2', 'tesi due', 'tech', ['NVDA']),
      mk('c3', 'tesi tre', 'tech', ['NVDA']),
    ];
    expect(rankRelated(current, candidates, 2)).toHaveLength(2);
  });

  it('nessuna correlata → array vuoto', () => {
    expect(rankRelated(current, [mk('z', 'Petrolio in range per tutto il 2026', 'energia', ['XOM'])])).toEqual([]);
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `npx vitest run lib/market-related.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementazione minima**

```ts
// lib/market-related.ts
// Ranking delle tesi correlate per la pagina dettaglio del marketplace:
// ticker condiviso > stesso settore > somiglianza testuale (wordOverlap).
// Pesi additivi (2/1/0..1) con soglia minima: una tesi entra tra le correlate
// solo se condivide ticker, settore o abbastanza testo. Funzione pura.

import { wordOverlap } from '@/lib/text';

export type RelatedCandidate = { id: string; thesis: string; sector: string | null; tickers: string[] };

export function rankRelated<T extends RelatedCandidate>(current: RelatedCandidate, candidates: T[], max = 5): T[] {
  return candidates
    .filter((c) => c.id !== current.id)
    .map((c) => {
      const sharedTicker = c.tickers.some((t) => current.tickers.includes(t));
      const sameSector = !!current.sector && c.sector === current.sector;
      const score = (sharedTicker ? 2 : 0) + (sameSector ? 1 : 0) + wordOverlap(current.thesis, c.thesis);
      return { c, score };
    })
    .filter((x) => x.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.c);
}
```

- [ ] **Step 4: Verifica che passi + commit**

Run: `npx vitest run lib/market-related.test.ts` → PASS.
Run: `npx tsc --noEmit && npm run test` → zero errori.

```bash
git add lib/market-related.ts lib/market-related.test.ts
git commit -m "feat: rankRelated — correlate per ticker/settore/overlap

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5: API dettaglio `GET /api/market/thesis/[id]`

**Files:**
- Create: `app/api/market/thesis/[id]/route.ts`

**Interfaces:**
- Consumes: `extractTickers` (Task 1), `rankRelated` (Task 4), `authorRef`/`authorRep` da `@/lib/reputation`, `normalizeSector` da `@/lib/sectors`, `createAdminClient` da `@/lib/supabase-admin`.
- Produces (JSON, 200):

```ts
{
  id: string; thesis: string; confidence: number; explanation: string | null;
  status: string; accuracy: number | null; sector: string; created_at: string;
  tickers: string[];
  signals: { confirm: SigView[]; invalidate: SigView[] } | null;
  author: { ref: string; name: string | null; rep: Rep };
  imports: number;
  related: { id: string; thesis: string; confidence: number; status: string; sector: string; tickers: string[]; author: string; authorName: string | null }[];
}
// SigView = { text: string; kind: string; fired: boolean; data_missing: boolean; checked_at: string | null }
```

404 se la tesi non esiste o non è pubblica; id non-UUID → 404 (l'errore Postgres sul cast viene trattato come not found).

- [ ] **Step 1: Crea la route**

```ts
// app/api/market/thesis/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authorRep, authorRef } from '@/lib/reputation';
import { normalizeSector } from '@/lib/sectors';
import { extractTickers } from '@/lib/market-tickers';
import { rankRelated } from '@/lib/market-related';

// Dettaglio pubblico di una tesi del marketplace: tesi completa con lo stato
// dei segnali (scattato/dato mancante), autore (ref opaco + reputazione),
// import ricevuti e tesi correlate (ticker > settore > overlap testuale).
// Lettura cross-utente → service role; risponde SOLO se is_public (404
// altrimenti: una tesi privata non deve nemmeno risultare esistente).

// Vista segnale per il dettaglio: testo + stato, mai i parametri interni.
function sigView(arr: any[]): { text: string; kind: string; fired: boolean; data_missing: boolean; checked_at: string | null }[] {
  return (arr || [])
    .map((s: any) => (typeof s === 'string' ? { text: s, kind: 'manual' } : s))
    .filter((s: any) => s && s.text)
    .map((s: any) => ({
      text: s.text,
      kind: s.kind || 'manual',
      fired: !!s.fired,
      data_missing: !!s.data_missing,
      checked_at: s.checked_at || null,
    }));
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = (params.id || '').trim();
  if (!id) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const admin = createAdminClient();
  const { data: t, error } = await admin
    .from('theses')
    .select('id, user_id, thesis, confidence, explanation, signals, status, accuracy, sector, created_at')
    .eq('id', id).eq('is_public', true)
    .maybeSingle();
  // Id malformato (cast uuid fallito) o tesi privata/inesistente → stesso 404.
  if (error || !t) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const tickers = extractTickers(t.signals);

  const [{ data: prof }, { data: allMine }, { count: importsCount }, { data: pubAll }] = await Promise.all([
    admin.from('profiles').select('display_name').eq('id', t.user_id).maybeSingle(),
    // Reputazione su TUTTE le tesi dell'autore (anche private), come in vetrina.
    admin.from('theses').select('status, accuracy').eq('user_id', t.user_id),
    admin.from('theses').select('id', { count: 'exact', head: true }).eq('imported_from_thesis', t.id),
    // Pool per le correlate: le altre tesi pubbliche (bounded, come la vetrina).
    admin.from('theses').select('id, user_id, thesis, confidence, status, sector, signals').eq('is_public', true).limit(1000),
  ]);

  const current = { id: t.id, thesis: t.thesis, sector: normalizeSector(t.sector), tickers };
  const related = rankRelated(
    current,
    (pubAll || []).map((r) => ({
      id: r.id,
      thesis: r.thesis,
      confidence: r.confidence,
      status: r.status || 'active',
      sector: normalizeSector(r.sector),
      tickers: extractTickers(r.signals),
      user_id: r.user_id,
    })),
  ).map((r) => ({
    id: r.id, thesis: r.thesis, confidence: r.confidence, status: r.status,
    sector: r.sector, tickers: r.tickers,
    author: authorRef((r as any).user_id), authorName: null as string | null,
  }));

  // Nomi pubblici degli autori delle correlate (una query sola).
  if (related.length) {
    const uids = Array.from(new Set((pubAll || []).filter((r) => related.some((x) => x.id === r.id)).map((r) => r.user_id)));
    const { data: profs } = await admin.from('profiles').select('id, display_name').in('id', uids);
    const nameByRef = new Map<string, string>();
    for (const p of profs || []) if (p.display_name) nameByRef.set(authorRef(p.id), p.display_name);
    for (const r of related) r.authorName = nameByRef.get(r.author) || null;
  }

  return NextResponse.json(
    {
      id: t.id,
      thesis: t.thesis,
      confidence: t.confidence,
      explanation: t.explanation,
      status: t.status || 'active',
      accuracy: t.accuracy ?? null,
      sector: normalizeSector(t.sector),
      created_at: t.created_at,
      tickers,
      signals: t.signals ? { confirm: sigView(t.signals.confirm), invalidate: sigView(t.signals.invalidate) } : null,
      author: { ref: authorRef(t.user_id), name: prof?.display_name || null, rep: authorRep(allMine || []) },
      imports: importsCount || 0,
      related,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  );
}
```

- [ ] **Step 2: Verifica manuale**

Run: `npx tsc --noEmit` → zero errori.
Con dev attivo (prendi un id vero da `/api/market?limit=1`):

```bash
ID=$(curl -s 'http://localhost:3000/api/market?limit=1' | python3 -c "import json,sys; print(json.load(sys.stdin)['items'][0]['id'])")
curl -s "http://localhost:3000/api/market/thesis/$ID" | python3 -m json.tool | head -40
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/market/thesis/00000000-0000-0000-0000-000000000000'   # → 404
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/market/thesis/non-un-uuid'                            # → 404
```

Expected: 200 con `signals.confirm[].fired`, `author.rep`, `related` (array, anche vuoto); 404 sugli altri due.

- [ ] **Step 3: Commit**

```bash
git add 'app/api/market/thesis/[id]/route.ts'
git commit -m "feat: api dettaglio tesi pubblica con stato segnali e correlate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 6: pagina `/market/t/[id]` + link dalle card

**Files:**
- Create: `app/market/t/[id]/page.tsx`
- Modify: `app/market/ui.tsx` (testo tesi della card → link al dettaglio)
- Modify: `app/market/page.tsx` (trending card → link al dettaglio)

**Interfaces:**
- Consumes: API Task 5; `MarketTopbar`, `AccuracyBar`, `RepLine`, `TickerChips`, `btnStyle`, `stFor`, `useMarketLang`, `useAuthed`, `ImpState` da `../../ui`.
- Produces: pagina dettaglio raggiungibile da ogni card. Il layout `app/market/layout.tsx` esistente copre anche questa pagina (nessun layout nuovo).

- [ ] **Step 1: Crea la pagina**

```tsx
// app/market/t/[id]/page.tsx
'use client';
// Dettaglio pubblico di una tesi del marketplace: tesi completa, stato dei
// segnali (scattato / in attesa / dato mancante), autore, import e correlate.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { type ImpState, type Rep, useAuthed, MarketTopbar, AccuracyBar, RepLine, TickerChips, btnStyle, stFor, useMarketLang } from '../../ui';

const P = {
  it: {
    back: '← marketplace', loading: 'caricamento…',
    notfound: 'Tesi non trovata (o non pubblica).', error: 'Tesi non disponibile al momento. Riprova tra poco.',
    published: 'pubblicata il', dateLocale: 'it-IT',
    signalsTitle: 'segnali', confirmCol: 'conferma se', invalidateCol: 'invalida se',
    fired: 'scattato', waiting: 'in attesa', noData: 'dato mancante', manualNote: 'nota qualitativa (non conteggiata)',
    accuracy: 'accuratezza', relatedTitle: 'tesi correlate',
  },
  en: {
    back: '← marketplace', loading: 'loading…',
    notfound: 'Thesis not found (or not public).', error: 'Thesis unavailable right now. Try again shortly.',
    published: 'published on', dateLocale: 'en-US',
    signalsTitle: 'signals', confirmCol: 'confirms if', invalidateCol: 'invalidates if',
    fired: 'fired', waiting: 'waiting', noData: 'data missing', manualNote: 'qualitative note (not counted)',
    accuracy: 'accuracy', relatedTitle: 'related theses',
  },
};

type SigView = { text: string; kind: string; fired: boolean; data_missing: boolean; checked_at: string | null };
type Detail = {
  id: string; thesis: string; confidence: number; explanation: string | null;
  status: string; accuracy: number | null; sector: string; created_at: string;
  tickers: string[];
  signals: { confirm: SigView[]; invalidate: SigView[] } | null;
  author: { ref: string; name: string | null; rep: Rep };
  imports: number;
  related: { id: string; thesis: string; confidence: number; status: string; sector: string; tickers: string[]; author: string; authorName: string | null }[];
};

// Stato di un segnale: scattato (colore direzione) / dato mancante / in attesa.
function SigRow({ s, color, lp }: { s: SigView; color: string; lp: typeof P.it }) {
  const state = s.kind === 'manual' ? lp.manualNote : s.data_missing ? lp.noData : s.fired ? lp.fired : lp.waiting;
  const stColor = s.kind === 'manual' ? '#5a5a78' : s.data_missing ? '#5a5a78' : s.fired ? color : '#7a7a95';
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ color: `${color}99` }}>{s.text}</span>
      <span style={{ marginLeft: 8, fontSize: 9.5, color: stColor, textTransform: 'uppercase', letterSpacing: '.04em' }}>· {state}</span>
    </div>
  );
}

export default function ThesisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const isAuthed = useAuthed();
  const [imp, setImp] = useState<ImpState>('idle');
  const [mlang, , mt] = useMarketLang();
  const lp = P[mlang];
  const STL = stFor(mt);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/market/thesis/${encodeURIComponent(id)}`).then(async (r) => {
      if (r.status === 404) { setState('notfound'); return; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) { setState('error'); return; }
      setData(j); setState('ok');
    }).catch(() => setState('error'));
  }, [id]);

  // Badge "già nel tuo grafo" anche qui: stessa fonte della vetrina.
  useEffect(() => {
    if (!isAuthed || !id) return;
    fetch('/api/market/imported', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(j.ids) && j.ids.includes(id)) setImp((s) => (s === 'idle' ? 'already' : s));
    }).catch(() => {});
  }, [isAuthed, id]);

  const importThesis = async () => {
    setImp('loading');
    try {
      const r = await fetch('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thesisId: id }),
      });
      const j = await r.json();
      setImp(j.imported ? 'done' : j.duplicate ? 'duplicate' : 'error');
      try { if (j.imported) (window as any).posthog?.capture('thesis_imported'); } catch {}
    } catch { setImp('error'); }
  };

  const st = data ? (STL[data.status] || STL.active) : STL.active;

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#e8e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <MarketTopbar isAuthed={isAuthed} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 18px 60px' }}>
        <a href="/market" style={{ fontSize: 11, color: '#7a7a95', textDecoration: 'none' }}>{lp.back}</a>

        {state === 'loading' && <div style={{ color: '#3a3a50', fontSize: 12, marginTop: 20 }}>{lp.loading}</div>}
        {state === 'notfound' && <div style={{ color: '#7a7a95', fontSize: 13, marginTop: 20 }}>{lp.notfound}</div>}
        {state === 'error' && <div style={{ color: '#e05555', fontSize: 13, marginTop: 20 }}>{lp.error}</div>}

        {state === 'ok' && data && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 10, fontSize: 10, color: '#5a5a78', flexWrap: 'wrap' }}>
              <span style={{ color: '#a78bfa' }}>◆ {mt.conf} {data.confidence}%</span>
              <span style={{ color: st.c }}>{st.l}</span>
              <TickerChips tickers={data.tickers} />
              {data.sector && <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, background: '#16161e', color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.05em' }}>{data.sector}</span>}
            </div>

            <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 22, fontWeight: 300, lineHeight: 1.45, color: '#d4bbff', marginBottom: 12 }}>"{data.thesis}"</div>
            {data.explanation && <div style={{ fontSize: 12.5, color: '#9a9ab2', lineHeight: 1.7, marginBottom: 16 }}>{data.explanation}</div>}

            <div style={{ fontSize: 10.5, color: '#7a7a95', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <RepLine authorRef={data.author.ref} name={data.author.name} rep={data.author.rep} />
              <span>· {lp.published} {new Date(data.created_at).toLocaleDateString(lp.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              {data.imports > 0 && <span style={{ color: '#4ad68a' }}>↘ {data.imports} {mt.importsWord}</span>}
            </div>

            <div style={{ marginBottom: 6, fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.06em' }}>{lp.accuracy}</div>
            <div style={{ marginBottom: 20 }}><AccuracyBar accuracy={data.accuracy} status={data.status} /></div>

            {data.signals && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{lp.signalsTitle}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11.5, lineHeight: 1.6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9.5, color: '#4ad68a', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>✓ {lp.confirmCol}</div>
                    {data.signals.confirm.map((s, i) => <SigRow key={i} s={s} color="#4ad68a" lp={lp} />)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9.5, color: '#e05555', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>✗ {lp.invalidateCol}</div>
                    {data.signals.invalidate.map((s, i) => <SigRow key={i} s={s} color="#e05555" lp={lp} />)}
                  </div>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #1f1f28', paddingTop: 16, marginBottom: 28 }}>
              {isAuthed ? (
                imp === 'done' ? <span style={{ fontSize: 12, color: '#4ad68a' }}>{mt.imported}</span>
                : imp === 'already' ? <span style={{ fontSize: 12, color: '#4ad68a' }} title={mt.alreadyTitle}>{mt.already}</span>
                : imp === 'duplicate' ? <span style={{ fontSize: 12, color: '#f0a030' }}>{mt.similar}</span>
                : imp === 'error' ? <button onClick={importThesis} style={btnStyle}>{mt.retry}</button>
                : <button onClick={importThesis} disabled={imp === 'loading'} style={{ ...btnStyle, opacity: imp === 'loading' ? 0.6 : 1 }}>{imp === 'loading' ? mt.importing : mt.save}</button>
              ) : (
                <a href="/login" style={{ ...btnStyle, textDecoration: 'none' }}>{mt.loginToImport}</a>
              )}
            </div>

            {data.related.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: '#7a7a95', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>{lp.relatedTitle}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.related.map((r) => {
                    const rst = STL[r.status] || STL.active;
                    return (
                      <a key={r.id} href={`/market/t/${r.id}`}
                        style={{ display: 'block', background: '#0e0e12', border: '1px solid #2a2a36', borderRadius: 12, padding: '12px 14px', textDecoration: 'none' }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 9.5, color: '#5a5a78', marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ color: '#a78bfa' }}>◆ {r.confidence}%</span>
                          <span style={{ color: rst.c }}>{rst.l}</span>
                          {r.tickers.slice(0, 4).map((tk) => <span key={tk} style={{ fontFamily: 'monospace', color: '#5b9cf6' }}>{tk}</span>)}
                          {r.sector && <span style={{ marginLeft: 'auto', textTransform: 'uppercase', letterSpacing: '.05em' }}>{r.sector}</span>}
                        </div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.45, color: '#d4bbff', marginBottom: 4 }}>"{r.thesis}"</div>
                        <div style={{ fontSize: 10, color: '#7a7a95' }}>{r.authorName || `#${r.author}`}</div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Link dalle card — `ui.tsx`**

In `ThesisCard`, il testo della tesi diventa link al dettaglio (stesso stile, niente underline):

```tsx
      <a href={`/market/t/${it.id}`} style={{ textDecoration: 'none' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 16, fontWeight: 300, lineHeight: 1.5, color: '#d4bbff', marginBottom: 8 }}>"{it.thesis}"</div>
      </a>
```

- [ ] **Step 3: Link dalle trending — `page.tsx`**

Nella card trending, il testo della tesi (il div con `WebkitLineClamp: 3`) va avvolto:

```tsx
                    <a href={`/market/t/${t.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 13, lineHeight: 1.45, color: '#d4bbff', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{t.thesis}"</div>
                    </a>
```

- [ ] **Step 4: Verifica manuale**

Run: `npx tsc --noEmit && npm run test` → zero errori.
In browser con dev attivo:
- Click sul testo di una card in `/market` → `/market/t/<id>` con tesi, segnali con stato, barra accuratezza, autore, CTA import.
- Correlate cliccabili (se presenti) → altro dettaglio.
- Id inventato `/market/t/xyz` → "Tesi non trovata (o non pubblica).".
- Import da dettaglio funziona (o `already` se già importata); da sloggato → CTA "accedi per importare".
- Toggle EN → copy inglese.

- [ ] **Step 5: Commit**

```bash
git add 'app/market/t/[id]/page.tsx' app/market/ui.tsx app/market/page.tsx
git commit -m "feat: pagina dettaglio tesi /market/t/[id] + link dalle card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Slice 3 — Ponte nel grafo

### Task 7: API `GET /api/market/for-me`

**Files:**
- Create: `app/api/market/for-me/route.ts`

**Interfaces:**
- Consumes: `extractTickers` (Task 1), `createClient` da `@/lib/supabase-server`, `createAdminClient` da `@/lib/supabase-admin`.
- Produces (JSON, 200): `{ count: number, tickers: string[] }` — quante tesi pubbliche di ALTRI utenti (escluse quelle già importate) toccano i ticker dell'utente (portafoglio + segnali delle sue tesi); `tickers` = top 3 per numero di tesi. 401 se non autenticato. `Cache-Control: private, no-store`.

- [ ] **Step 1: Crea la route**

```ts
// app/api/market/for-me/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { extractTickers } from '@/lib/market-tickers';

// Ponte grafo → marketplace: quante tesi pubbliche di altri utenti toccano i
// ticker dell'utente (portafoglio + segnali delle sue tesi). Dati propri via
// client RLS; tesi pubbliche altrui via admin (lettura cross-utente, come la
// vetrina). Escluse le tesi già importate: il chip deve proporre roba nuova.
// Dato personale: mai in cache.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const [{ data: prof }, { data: mine }] = await Promise.all([
    supabase.from('profiles').select('portfolio').eq('id', user.id).single(),
    supabase.from('theses').select('signals, imported_from_thesis').eq('user_id', user.id),
  ]);

  const myTickers = new Set<string>();
  for (const h of ((Array.isArray(prof?.portfolio) ? prof!.portfolio : []) as any[])) {
    const tk = h?.ticker ? String(h.ticker).toUpperCase().trim() : '';
    if (tk) myTickers.add(tk);
  }
  for (const t of mine || []) {
    for (const tk of extractTickers(t.signals)) myTickers.add(tk);
  }
  const empty = { count: 0, tickers: [] as string[] };
  if (!myTickers.size) return NextResponse.json(empty, { headers: { 'Cache-Control': 'private, no-store' } });

  const importedIds = new Set((mine || []).map((t) => t.imported_from_thesis).filter(Boolean));

  const admin = createAdminClient();
  const { data: pub, error } = await admin
    .from('theses')
    .select('id, signals')
    .eq('is_public', true)
    .neq('user_id', user.id)
    .limit(1000);
  if (error) return NextResponse.json({ error: 'forme_unavailable' }, { status: 500 });

  let count = 0;
  const tally = new Map<string, number>();
  for (const t of pub || []) {
    if (importedIds.has(t.id)) continue;
    const match = extractTickers(t.signals).filter((tk) => myTickers.has(tk));
    if (!match.length) continue;
    count++;
    for (const tk of match) tally.set(tk, (tally.get(tk) || 0) + 1);
  }
  const tickers = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);

  return NextResponse.json({ count, tickers }, { headers: { 'Cache-Control': 'private, no-store' } });
}
```

- [ ] **Step 2: Verifica manuale**

Run: `npx tsc --noEmit` → zero errori.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/market/for-me'   # → 401 (senza cookie)
```

Il caso autenticato si verifica nel Task 8 dal browser (stessa origine, cookie inclusi).

- [ ] **Step 3: Commit**

```bash
git add app/api/market/for-me/route.ts
git commit -m "feat: api for-me — tesi community sui ticker dell'utente

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 8: chip nel grafo (body.ts + graph.js)

**Files:**
- Modify: `app/synapse/body.ts` (markup chip in topbar, dopo `#market-btn`)
- Modify: `public/synapse/graph.js` (fetch lazy + i18n + dismiss)

**Interfaces:**
- Consumes: `GET /api/market/for-me` (Task 7); pattern `TT()`/`SYN_EN` e `loadWatches()` esistenti in `graph.js`.
- Produces: chip `#forme-chip` in topbar, popolato da `loadCommunityForMe()` chiamata accanto a `loadWatches()` (riga ~2758). Dismiss: `localStorage.synForMeDismiss` = count al momento del dismiss; il chip riappare solo se il count supera quel valore. NON toccare `CONN_HEURISTIC_VERSION` (la heuristica delle connessioni non cambia).

- [ ] **Step 1: Markup in `body.ts`**

In `BODY_FOR`, subito dopo la riga dell'anchor `<a id="market-btn" ...>...</a>`, aggiungi:

```html
  <a id="forme-chip" href="/market" style="display:none;align-items:center;gap:6px;background:#241a3a;border:1px solid #a78bfa33;border-radius:8px;padding:6px 10px;color:#c4b0f0;font-family:DM Mono;font-size:10.5px;margin-left:12px;text-decoration:none"><span id="forme-chip-text"></span><span id="forme-chip-x" style="color:#7a7a95;cursor:pointer;padding:0 2px">×</span></a>
```

(Nessuna stringa nel dizionario `UI` di body.ts: il testo lo scrive graph.js via `TT`, che conosce la lingua.)

- [ ] **Step 2: Logica in `graph.js`**

Aggiungi le due voci a `SYN_EN` (riga ~15, dentro l'oggetto esistente):

```js
"1 tesi community sui tuoi titoli": "1 community thesis on your holdings", " tesi community sui tuoi titoli": " community theses on your holdings",
```

Aggiungi la funzione dopo `loadWatches()` (dopo la riga ~137, fuori da altre funzioni):

```js
// ── Ponte marketplace: tesi della community sui ticker dell'utente ──
// Chip discreto in topbar. Dismiss ricordato in localStorage col count del
// momento: il chip riappare solo se arrivano tesi nuove (count più alto).
// Best-effort: qualsiasi errore → nessun chip, mai bloccante.
async function loadCommunityForMe(){
  try{
    const res=await fetch('/api/market/for-me');
    const json=await res.json();
    if(!json || !json.count) return;
    const dismissed=parseInt(localStorage.getItem('synForMeDismiss')||'0',10)||0;
    if(json.count<=dismissed) return;
    const chip=document.getElementById('forme-chip');
    const txt=document.getElementById('forme-chip-text');
    if(!chip||!txt) return;
    txt.textContent = json.count===1 ? '◆ '+TT('1 tesi community sui tuoi titoli') : '◆ '+json.count+TT(' tesi community sui tuoi titoli');
    chip.href = (json.tickers&&json.tickers.length===1) ? '/market?ticker='+encodeURIComponent(json.tickers[0]) : '/market';
    chip.style.display='inline-flex';
    const x=document.getElementById('forme-chip-x');
    if(x) x.onclick=(e)=>{ e.preventDefault(); e.stopPropagation(); try{ localStorage.setItem('synForMeDismiss',String(json.count)); }catch(err){} chip.style.display='none'; };
  }catch(e){}
}
```

Alla riga ~2758, subito dopo la chiamata `loadWatches();`, aggiungi:

```js
    loadCommunityForMe();
```

- [ ] **Step 3: Verifica manuale**

Run: `npx tsc --noEmit && npm run test` → zero errori (graph.js non è typecheckato ma la suite deve restare verde).
In browser, loggato su `localhost:3000` con un portafoglio o tesi che condividono ticker con tesi pubbliche altrui:
- Chip "◆ N tesi community sui tuoi titoli" in topbar; click → `/market?ticker=X` (o `/market`).
- Click su × → chip sparisce; reload → non riappare (count invariato).
- `localStorage.removeItem('synForMeDismiss')` in console + reload → riappare.
- Con `localStorage['syn-lang']='en'` → testo inglese.
- Utente senza match (o API in errore, simulabile bloccando la request da DevTools) → nessun chip, grafo normale.

- [ ] **Step 4: Commit**

```bash
git add app/synapse/body.ts public/synapse/graph.js
git commit -m "feat: chip nel grafo — tesi community sui titoli dell'utente

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 9: verifica finale end-to-end

**Files:** nessuno (solo verifica).

- [ ] **Step 1: Build e suite**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: tutto verde, build Next senza errori.

- [ ] **Step 2: Giro completo su dev**

Con `npm run dev`:
1. `/market` → chip ticker, filtro via chip, `?ticker=` deep-link, clear.
2. Card → dettaglio → correlate → altro dettaglio → import.
3. Profilo autore → card con chip ticker.
4. Grafo → chip community → `/market?ticker=X` → dismiss.

- [ ] **Step 3: Stop — niente push**

Il push su main deploya in produzione: aspettare l'ok esplicito dell'utente.
