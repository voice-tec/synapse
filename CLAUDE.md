# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Synapse (UI brand "Symnaps") — a Next.js 14 (App Router) financial-intelligence app. A user asks a financial question; an LLM analyzes it into a graph node (`task`); related nodes cluster into a **tesi** (thesis) with a confidence and a **track record** derived from real market/macro signals. Theses can be published to a **marketplace** and imported by other users. Deployed on Vercel; Supabase for auth + Postgres (RLS).

## Commands

```bash
npm run dev          # local dev (localhost:3000)
npm run build        # next build
npm run lint         # next lint
npm run test         # vitest run (all lib/**/*.test.ts)
npx vitest run lib/confidence.test.ts   # single test file
npx tsc --noEmit     # typecheck (run before committing)
```

Tests live next to source as `lib/*.test.ts` and run in a `node` environment (vitest config only includes `lib/**/*.test.ts`). The `@/` import alias is mirrored in `vitest.config.ts`. Note `tsconfig` has `strict: false` and no `downlevelIteration` — don't `for...of` a `Set`; use `Array.from(...)` (this has bitten the build before).

## Deploy & DB workflow (important)

- **Push to `main` = production deploy on Vercel.** Only push when the user explicitly says so.
- **Schema changes are not auto-applied.** `supabase/schema.sql` is the source of truth, but Supabase prod is migrated **by hand** in the SQL editor. Any new column must be applied on prod **before** pushing code that reads it, or the endpoints 500. The user runs the `alter table` and confirms ("alter fatto") before you push.
- Secrets: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` are server-only — never prefix with `NEXT_PUBLIC_`. Optional data providers: `TWELVEDATA_API_KEY` (quotes/charts), `FRED_API_KEY` (macro), `FMP_API_KEY` (Financial Modeling Prep — TTM fundamentals: P/E, P/S, margins…). All degrade gracefully (fallbacks / `data_missing`) when absent.

## Architecture

### The graph app is a giant injected vanilla-JS string
`app/page.tsx` is the authenticated entry. It is a thin React shell that, after auth:
1. injects `BODY` (HTML markup from `app/synapse/body.ts`) via `innerHTML`,
2. injects `STYLE` (`app/synapse/style.ts`) into a `<style>`,
3. preloads the user's data from Supabase onto `window.__SYN_PRELOAD` (+ `__SYN_USAGE`, `__SYN_PORTFOLIO`, `__SYN_DISPLAY_NAME`),
4. exposes saver callbacks on `window` (`__synSaveTask`, `__synSaveThesis`, `__synSaveAction`, `__synSavePortfolio`, `__synSaveProfile`, `__synDeleteTask`, `__synLogout`),
5. then injects `public/synapse/graph.js` (the ~2400-line vanilla renderer) **only after** the `#gc` canvas exists (polled — avoids a blank-screen race).

So: **markup/style edits → `app/synapse/{body,style}.ts`; graph behavior/rendering → `public/synapse/graph.js`.** `graph.js` has an init guard (`window.__SYN_INITIALIZED`) against StrictMode double-mount and persists via the `window.__syn*` callbacks rather than touching Supabase directly. There is no build step that bundles `graph.js` — it's served static.

Two operational notes on `graph.js`: bumping `CONN_HEURISTIC_VERSION` forces `recomputeAllConns()` on next load for every client (do this whenever the connection heuristic changes). And it can be tested without a browser via a Node harness (stub `document`/`window`/`localStorage`/canvas, then `eval(src)`) — but `async` functions are **not** block-hoisted onto the global scope, so anything the harness needs must be exported explicitly on `window` (already done for `seedFromPortfolio`).

### Routing & auth
`middleware.ts` (Supabase SSR cookies) gates pages: unauthenticated `/` → `/welcome`; authenticated `/welcome` or `/login` → `/`. The `api` path is excluded from the matcher (routes do their own auth). Three Supabase clients: `lib/supabase-browser.ts` (client), `lib/supabase-server.ts` (route handlers, RLS as the user), `lib/supabase-admin.ts` (service-role, **only** for cron and cross-user reads like the marketplace).

### AI calls
All Claude calls go through `lib/anthropic.ts` (`askClaudeJSON` etc.), which handles the `pause_turn` loop for server-side `web_search`, real citation extraction, the Batch API, and a robust `extractJSON` that repairs truncated JSON (models hitting `max_tokens` mid-array — a real failure mode here). Model split for cost: **Sonnet** (`claude-sonnet-5`) for heavy analysis/dedup, **Haiku** (`claude-haiku-4-5`) for clustering/suggestions. Sonnet 5 gotchas already handled here: adaptive thinking is ON by default, so every Sonnet call passes `thinking: {type:'disabled'}` (it would eat the max_tokens budget); its tokenizer counts ~30% more tokens than 4.6 (max_tokens were bumped accordingly). Everything stays on `web_search_20250305` **deliberately**: the newer `web_search_20260209` (dynamic filtering) was live-tested and spawns erratic code_execution retries that confuse the model and burn `max_uses` — don't upgrade it without re-testing. There is no Anthropic embeddings endpoint — embedding-based dedup was tried (Voyage) and abandoned because it couldn't separate true duplicates from distinct-but-correlated theses; dedup is an LLM judge instead. No prompt caching (sporadic traffic + sub-minimum system prompts make it cost-negative).

API routes (`app/api/*/route.ts`): `analyze` (main, Sonnet + web search), `memory` (Haiku clustering → theses, with Sonnet dedup pass + signal validation), `suggest`, `portfolio`, `challenge` (counter-thesis), `refresh` (on-demand thesis re-eval via Batch API + free quote refresh — no cron, idle users cost nothing), `watch`, `seed`, `share`/`shared/[token]` (public read-only snapshot), `market`/`market/publish`/`import` (marketplace), `cron/{reset-usage,recheck}`.

### Track record (the trust-critical path)
`lib/confidence.ts` evaluates a thesis's `signals` against **real** data and derives a verdict. Signal kinds: `fred` (macro), `ticker` (price performance), `fund` (fundamentals, with a `field`; `pe` is a legacy alias for `fund`+`field:'pe'`), `manual` (text-only, never counted).
- `evalSignals` distinguishes **missing data** (`data_missing=true`, not counted) from **not fired**, so accuracy is never inflated by stale/absent data. Fetchers are injectable (`EvalDeps`, incl. optional `fetchFundamental`) for tests.
- `deriveOutcome` is deliberately strict (`MIN_FIRED=2`, `CONF_CONFIRM=72`, `CONF_INVALIDATE=45`) so "confermata"/"invalidata" is not gameable — a prerequisite for marketplace reputation ranking.
- `lib/signals.ts` `validateSignals` runs at save time: any FRED metric not in the catalog, any `fund` field outside `FUND_FIELDS`, or any ticker `lib/quotes.ts` `resolveTicker` can't confirm is demoted to `manual` (kept as text, but not counted as a testable/fired signal) — prevents hallucinated signals from faking a track record.
- `lib/fundamentals.ts`: `FUND_FIELDS` catalog (pe, ps, pb, ev_ebitda, peg, p_fcf, div_yield, net_margin, gross_margin, de) fetched from FMP's **stable** endpoint `/stable/ratios-ttm` (the v3 legacy endpoint is dead for new API keys), with a 24h whole-row cache per symbol.

### Marketplace & identity
Theses are private by default; `is_public` opts one into the marketplace (`market/publish` enforces anti-spam: `confidence>=60`, max 20 public, no republishing of imported theses). `app/market/page.tsx` (client) lists public theses across users (`api/market` via admin client), ranked by author reputation; `/market/mine` (own publications) and `/market/a/[ref]` (author profile) share components from `app/market/ui.tsx`. `api/market/stats` is CDN-cached (`s-maxage=15`); `api/market/imported` (RLS, `no-store`) powers the "già nel tuo grafo" badge. Import (`api/import`) clones a thesis into the caller's graph with a **fresh** track record (signals stripped of `fired`/`checked_at`, accuracy null, re-evaluated on today's data), deduped against the caller's own theses via `lib/text.ts` `wordOverlap` (≥0.55 = duplicate). Identity is privacy-first: `lib/reputation.ts` `authorRef` = `sha256(uid).slice(0,8)` (opaque, shown as `#hash`); users may opt into a `profiles.display_name` shown instead.

### Public surfaces & plans
The whole site is bilingual IT/EN, driven by one key: localStorage `syn-lang` → `navigator.language`, fallback `it`. React pages (`/welcome`, `/pricing`, `/privacy`, `/login`, `/market*`) use `lib/i18n-public.tsx` (`usePublicLang`/`LangToggle`) + per-page dictionaries (marketplace shares `MT`/`useMarketLang`/`stFor` in `app/market/ui.tsx`). The graph app: `body.ts` exports `BODY_FOR(lang)`, `graph.js` uses gettext-style `TT('testo italiano')` + `SYN_EN` map (key = current Italian text — when changing a UI string, update the SYN_EN key too). AI output: routes accept `lang` in the body; `lib/lang.ts` `langDirective` appends an English override to the (still Italian) prompts; `cron/recheck` follows the language of the previous verdict. Stored content keeps its original language (marketplace shows theses in the author's language). Plans: Free 10 analyses + 50 AI calls/mo, Pro/Team 150 + 500 — no billing yet; the Pro CTA on `/pricing` is a waitlist (PostHog event `pro_waitlist`). PostHog EU analytics is loaded inline in `app/layout.tsx`; the privacy policy lives in `app/privacy/page.tsx` (placeholders `[TITOLARE]`/`[EMAIL]` still to fill).

## Conventions

- Comments are in **Italian**; user-facing copy is bilingual IT/EN via the dictionaries described in "Public surfaces & plans" (Italian remains the source language; add both variants for any new string).
- Cost limits: `PLAN_LIMITS` in `app/api/analyze/route.ts` (free 10 / pro+team 150 tasks/mo), `AI_CALL_LIMITS` in `lib/ai-usage.ts` (free 50 / pro+team 500 accessory AI calls/mo). Promote a user to Pro by editing `profiles.plan` in Supabase.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
