# Symnaps V2 implementation plan

Goal: security/reliability plus one versioned Thesis Card; stop afterward.
Architecture: extend existing tables and drawer, preserve canvas and Supabase auth.
Stack: Next.js, TypeScript, vanilla JS, Supabase/PostgreSQL, Vitest.
Spec: V2_PRODUCT.md and the user-supplied SYMNAPS 2.0 brief.

## Constraints
No push/deploy/production migration. Local incremental commits only. Preserve existing uncommitted user files. IT/EN; manual migration instructions. Do not implement phases 2–5 wholesale.

## Execution and checks
1. Audit app/lib/public/SQL/config/tests and record architecture/product/security findings. Baseline: 103 tests pass.
2. Add restricted database grants, ownership constraints and atomic quota reservation. Update privileged server writes to use authenticated ownership checks. Add SQL adversarial role tests.
3. Preserve import fundamental fields and explicit conviction baseline; use consistent initial/refresh scoring. Add regression tests for missing/invalid data and import behavior. Relabel signal metrics throughout marketplace/drawer.
4. Route dynamic HTML sinks through a maintained sanitizer; remove inline generated handlers, escape untrusted text/attributes and validate URLs. Test malicious model/user content and existing interactions.
5. Add version snapshots, append-only triggers, migration baseline and concurrency-checked revision RPC. Add owned GET/PATCH card endpoint and safe DOM drawer tabs/editor. Test validation, unauthorized reads/writes, stale revisions, immutable originals and reload/history.
6. Run full tests, TS, JS syntax and production build; exercise SQL on local disposable database if available. Document unavailable infrastructure and browser verification honestly. Commit only task files.

## Review focus
Migration on existing rows; cross-user references including UUID arrays; stale saves after revision; malicious text/URLs/styles in generated HTML; missing providers/data/migrations. Fail closed and preserve previously saved research.

## Later phases
Phase 2: sourced evidence ingestion and deterministic What Changed with review queues. Phase 3: domain entities/relationship proposals/provenance, Focus/Universe and time travel bounded by ingestion time. Phase 4: append-only decision journal with verified market observations. Phase 5: public branches and completed-prediction reputation. Establish classification/contradiction benchmarks before adding provider adapters.

## Implemented scope and remaining boundary
Steps A–C implemented locally. The first slice includes structured revisions, immutable original capture, history, deterministic revision comparison, concurrency rejection and preserved drawer actions. Evidence and Decisions tabs deliberately explain that their full ledgers are later phases. No domain graph rewrite, broker integration, external evidence ingestion, verified-performance calculation, time travel, or new AI provider was added.

Next operational step is the manual staging release checklist in V2_SECURITY.md. Next product step after acceptance is a source-and-ingestion-timestamp evidence ledger feeding deterministic What Changed. Do not begin it until this slice has been reviewed.
