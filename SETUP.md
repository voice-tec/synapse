# 🧠 Synapse — Guida al setup

Hai in mano un'app Next.js completa con backend, autenticazione e database.
Segui questi passi nell'ordine. Tempo totale: ~25 minuti.

---

## 1. Installa le dipendenze

Apri il terminale nella cartella del progetto ed esegui:

```bash
npm install
```

---

## 2. Crea il progetto Supabase (gratis)

1. Vai su **https://supabase.com** → "Start your project" → accedi con GitHub
2. "New project" → dai un nome (es. `synapse`), scegli una password per il DB, regione Europa (Frankfurt)
3. Aspetta ~2 minuti che il progetto si crei

---

## 3. Crea le tabelle del database

1. Nel dashboard Supabase, menu a sinistra → **SQL Editor**
2. Clicca "New query"
3. Apri il file `supabase/schema.sql` di questo progetto, copia TUTTO il contenuto
4. Incollalo nell'editor e clicca **Run** (in basso a destra)
5. Dovresti vedere "Success" — le tabelle sono create

---

## 4. Prendi le chiavi Supabase

1. Dashboard Supabase → icona ingranaggio (Settings) → **API**
2. Copia due valori:
   - **Project URL** (es. `https://xxxxx.supabase.co`)
   - **anon public** key (la chiave lunga sotto "Project API keys")

---

## 5. Configura le variabili d'ambiente

1. Nella cartella del progetto, copia il file `.env.local.example` e rinominalo in `.env.local`
2. Aprilo e riempi i valori:

```
ANTHROPIC_API_KEY=sk-ant-api03-...        ← la tua chiave Anthropic
NEXT_PUBLIC_SUPABASE_URL=https://...       ← Project URL dal passo 4
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...       ← anon public key dal passo 4
SUPABASE_SERVICE_ROLE_KEY=eyJ...           ← service_role key (stessa pagina) — solo per i cron
CRON_SECRET=...                            ← stringa casuale lunga, autentica i cron
```

⚠️ La chiave Anthropic e la service_role restano SOLO qui sul server — mai mandate al browser.

---

## 6. Avvia in locale

```bash
npm run dev
```

Apri **http://localhost:3000** — vedrai la pagina di login.
Crea un account, conferma la mail (Supabase la manda automaticamente), accedi.

---

## 7. Deploy su Vercel (quando sei pronto)

1. Carica il progetto su GitHub (crea un repo nuovo, fai push)
2. Vai su **https://vercel.com** → accedi con GitHub → "Add New Project"
3. Seleziona il repo → in "Environment Variables" incolla gli stessi 5 valori del `.env.local`
4. Clicca **Deploy**

In ~2 minuti hai Synapse online con un URL pubblico da condividere.

Il cron job (definito in `vercel.json`) parte automaticamente col deploy:
- **`/api/cron/reset-usage`** — 1° del mese: azzera i contatori `tasks_this_month` e `ai_calls_this_month`

Vercel autentica i cron mandando `Authorization: Bearer $CRON_SECRET` — basta che la variabile sia impostata.

Il refresh di tesi e performance NON usa un cron: avviene on-demand quando
l'utente apre l'app (`/api/refresh`) — gli account inattivi costano zero.

---

## Struttura del progetto

```
app/
  api/
    analyze/route.ts    → analisi principale (Sonnet + web search), nasconde la chiave
    memory/route.ts     → rilevamento tesi multiple (Haiku)
    suggest/route.ts    → domande suggerite (Haiku)
    portfolio/route.ts  → portafoglio della tesi (Sonnet + web search)
    challenge/route.ts  → avvocato del diavolo: contro-tesi (Sonnet + web search)
    refresh/route.ts    → refresh on-demand: tesi via Batch API (-50%), performance via prezzi gratuiti
    share/route.ts      → crea/aggiorna lo snapshot pubblico del grafo (zero AI)
    shared/[token]/     → lettura pubblica dello snapshot (service role, token non enumerabili)
    cron/
      reset-usage/      → azzera i contatori mensili (1° del mese)
  g/[token]/page.tsx    → pagina pubblica read-only del grafo condiviso
  login/page.tsx        → pagina di login/registrazione
  page.tsx              → app principale (il grafo)
  layout.tsx            → layout root
lib/
  anthropic.ts          → helper condiviso chiamate Claude (pause_turn, extractJSON, batches)
  ai-usage.ts           → metering chiamate AI accessorie
  quotes.ts             → prezzi ETF da API gratuita (per la performance)
  supabase-browser.ts   → client Supabase lato browser
  supabase-server.ts    → client Supabase lato server
  supabase-admin.ts     → client service-role (solo cron)
supabase/
  schema.sql            → schema database da eseguire
vercel.json             → schedulazione cron
middleware.ts           → protegge le route, gestisce le sessioni
```

---

## Come funzionano i costi

- **Free tier utenti**: 10 task al mese (`PLAN_LIMITS` in `app/api/analyze/route.ts`) + 50 chiamate AI accessorie al mese (`AI_CALL_LIMITS` in `lib/ai-usage.ts` — memory, suggest, portfolio, challenge)
- **Web search con `max_uses`**: ogni chiamata ha un tetto di ricerche (1-2) — era il vero driver di costo
- **Haiku** per memory e suggest: ~10-25x più economico di Sonnet
- **Refresh on-demand**: tesi ri-valutate solo per utenti che aprono l'app, via Batch API (-50% sui token); performance dei portafogli da prezzi di mercato gratuiti (zero AI)
- **Vercel + Supabase**: tier gratuiti coprono i primi utenti
- **Niente prompt caching**: con traffico sporadico il cache write costa più di quanto risparmia (e i system prompt sono sotto il minimo cacheabile di Sonnet 4.6)

Per cambiare i limiti dei piani, modifica `PLAN_LIMITS` e `AI_CALL_LIMITS`.

Per promuovere un utente a Pro manualmente: Supabase → Table Editor → `profiles` → cambia `plan` in `pro`.
