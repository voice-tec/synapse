# Symnaps V2 — completion report (2026-10-22)

## 1. Audited
Existing Next/React shell, canvas renderer and drawer, bilingual markup/styles, authentication middleware/clients, analysis/memory/import/refresh flows, signal/confidence/quote/fundamental utilities, marketplace/public snapshots, cron/watch paths, Supabase schema, tests and dependencies. Architecture, product contract, roadmap and security findings are in the four requested V2 documents. Baseline was 103 passing tests.

## 2. Changed
- Restricted client permissions for plans, quotas, financial results, publication metadata and watches. Database ownership guards cover task edges, thesis sources, action parents and watches. Atomic quota reservations and watch limits prevent lost updates and quota races. Cron fails closed without a secret.
- All dynamic graph HTML sinks pass through DOMPurify. Principal untrusted text is escaped; the new card uses DOM/textContent. Generated inline handlers became event listeners.
- Import retains fundamental `field` and fresh predicates, with a stable conviction baseline for source-less theses. Initial and later scoring use the same calculation; added tasks take precedence over imported conviction. Invalid operators, stale manual annotations and nonfinite/missing observations do not produce results. Repeated observations cannot supply multiple independent confirmations.
- UI calls legacy `accuracy` signal alignment. Public author aggregates exclude private research; private imports do not create public activity. These metrics do not claim independently verified prediction skill or realized returns.
- Structured Thesis Card in the current drawer: original hypothesis, current hypothesis/rationale, assets/sector, horizon/deadline, benchmark, success/invalidation conditions, workflow state, append-only snapshots and recorded revision comparisons. Stale writes return 409 and preserve unsaved edits. Graph clustering changes also produce snapshots. Layout changes do not create research revisions.
- Existing imported-only graphs now hydrate and draw even without local task nodes.
- Security dependencies updated to Next 15.5.28 and patched transitive packages; React 18 remains. Dynamic API route params use the asynchronous Next contract. PostCSS override keeps the update on Next 15. npm reported zero known vulnerabilities after installation.

## 3. Preserved
Existing canvas engine, graph layout model, zoom/pan/search/selection code, visual palette and typography, task/thesis/action nodes, auth implementation, analysis and memory provider integrations, marketplace/import/public sharing, existing table IDs and research, and IT/EN conventions. Existing drawer controls remain mounted under Overview. No new model provider, broker integration or replacement dashboard.

## 4. Manual migration
Apply `supabase/migrations/001_v2_security_and_versions.sql` only after backup and staging validation. New installations require schema.sql followed by the migration. Existing databases must NOT rerun schema.sql. Migration is transactional, checks legacy references and duplicate clusters, adds the ledger/structured fields, tightens grants and resets previously client-editable derived scores for re-evaluation. No production SQL was executed. Full rollout and rollback guidance: V2_SECURITY.md.

## 5. Verification
- `npm test`: **133 tests passed, 16 files**, including all original 103 tests.
- PGlite executes the actual schema/migration, actual revision RPC, RLS/column grants, standalone SQL contract, cross-owner rejection, atomic quota limits, watch limits and action grants. Route integration tests exercise real PostgreSQL behind the authenticated query adapter, including 401/404, PATCH, reload/history and stale 409.
- jsdom executes the actual graph script and card DOM: legacy drawer opening, imported-only rendering, XSS payloads, tab keyboard navigation, revision saving/reload and conflict preservation. The HTML-sink test checks every assignment/insertion through the TypeScript AST.
- `npx tsc --noEmit --incremental false`: passed.
- `node --check public/synapse/graph.js`: passed.
- `git diff --check`: passed.
- `npm run build`: production build passed on Next 15.5.28 (34 pages generated).
- Dependency installation audit: zero vulnerabilities after patched PostCSS override.

Local runtime: Node 24.15.0, npm 11.12.1. Nonblocking messages: Vite warns about a future native config loader; Next notes edge-runtime static-generation behavior and large webpack cache strings. No security checks or existing tests were disabled.

An independent review found three regressions: action UPDATE included a now-protected owner column; card hydration advanced the revision without all persisted fields; automated snapshots inherited prior revision reasons. All three were corrected, with grant/hydration regression checks.

## 6. Limits
No live Supabase auth/session test, PostgREST deployment test, external AI/financial provider test or real-browser visual/mobile inspection was performed. Embedded PostgreSQL uses a minimal Supabase auth shim; staging must still validate actual Supabase grants, sessions, defaults and concurrency across separate connections. No production database was inspected or changed.

History starts at migration for existing theses. The legacy editable JSON history remains but is not promoted to trusted versions. Imported conviction backfill uses the value available at migration, not a reconstructed original; fundamental fields already lost by old imports cannot always be recovered. Signal alignment remains a descriptive measure of declared predicates, not an attested analyst reputation.

Evidence and Decisions tabs explicitly describe later-phase functionality. What Changed compares stored revisions only, without inventing news. Full evidence ingestion, decision journal, graph modes, time travel and verified outcomes are not implemented. Refresh batch orchestration can still submit overlapping work under concurrent opens, bounded by atomic quotas; broader provider retry/lease orchestration is deferred.

Security hardening is data-compatible but not compatible with old client write paths. Coordinate migration and release and reload old browser sessions. Tests do not establish production correctness before that step.

## 7. Next step
Validate the manual migration and existing workflows against isolated Supabase staging, including IT/EN mobile layouts. After acceptance of this slice, the next development phase is a sourced evidence ledger with trusted ingestion timestamps feeding What Changed. Stop here pending review; no push or deployment.
