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
2. Aprilo e riempi i tre valori:

```
ANTHROPIC_API_KEY=sk-ant-api03-...        ← la tua chiave Anthropic
NEXT_PUBLIC_SUPABASE_URL=https://...       ← Project URL dal passo 4
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...       ← anon public key dal passo 4
```

⚠️ La chiave Anthropic resta SOLO qui sul server — non viene mai mandata al browser.

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
3. Seleziona il repo → in "Environment Variables" incolla gli stessi 3 valori del `.env.local`
4. Clicca **Deploy**

In ~2 minuti hai Synapse online con un URL pubblico da condividere.

---

## Struttura del progetto

```
app/
  api/
    analyze/route.ts    → analisi principale (Sonnet + web search), nasconde la chiave
    memory/route.ts     → rilevamento tesi multiple (Haiku)
    suggest/route.ts    → domande suggerite (Haiku)
  login/page.tsx        → pagina di login/registrazione
  page.tsx              → app principale (il grafo)
  layout.tsx            → layout root
lib/
  supabase-browser.ts   → client Supabase lato browser
  supabase-server.ts    → client Supabase lato server
supabase/
  schema.sql            → schema database da eseguire
middleware.ts           → protegge le route, gestisce le sessioni
```

---

## Come funzionano i costi

- **Free tier utenti**: 10 task al mese (limite gestito in `app/api/analyze/route.ts`, variabile `PLAN_LIMITS`)
- **Prompt caching attivo**: -85% sui token del system prompt
- **Haiku** per memory e suggest: ~25x più economico di Sonnet
- **Vercel + Supabase**: tier gratuiti coprono i primi utenti

Per cambiare i limiti dei piani, modifica `PLAN_LIMITS` in `app/api/analyze/route.ts`.

Per promuovere un utente a Pro manualmente: Supabase → Table Editor → `profiles` → cambia `plan` in `pro`.
