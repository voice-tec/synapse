# Security audit and first hardening sprint — 2026-11-10

## Scope and baseline

Audited the local `voice-tec/synapse` checkout at `71d56d9`, including Supabase schema/migrations, browser persistence callbacks, the legacy graph renderer, AI endpoints, cron authentication, public shares and marketplace paths. GitHub `main` was `4df6222` when checked. The local checkout is eight unpublished commits ahead, including V2 hardening and unrelated marketing/UI work.

The sprint branch is `codex/security-hardening-sprint-1`. Its draft PR targets a separate snapshot, `codex/security-audit-baseline`, at `71d56d9`. This keeps the PR diff limited to this sprint. It is **not a standalone main-ready PR**: integrating the unpublished baseline or porting its security prerequisites requires separate review. No merge or production deployment is part of this sprint.

No production secrets were read or changed. No live database was inspected or modified. Findings describe repository-defined permissions, not a verified production configuration. Existing uncommitted workspace files are excluded.

## Findings and disposition

| Severity | Finding and attack path | Disposition |
| --- | --- | --- |
| Critical if legacy schema is deployed alone | Own-row RLS permits changing a profile's plan/counters and a thesis's accuracy/status/publication fields. RLS is not a column allowlist. | Existing migration **001** restricts columns, protects computed action/watch fields, and restricts reservation RPC access. Tests now run against **001 + 002**. Both migrations are release prerequisites. |
| High | Legacy `ALL` grants on tasks/connections/shared snapshots include `TRUNCATE`, which RLS does not filter. Graph inserts also accept forged timestamps. | **002** revokes broad grants and permits only the graph's actual insert/select/delete operations. Protected profile/thesis tables also lose any PUBLIC grants. |
| High | A caller can bypass thesis column grants through `/api/theses`: the service-role writer trusted request confidence and signal predicates. | Memory output carries an expiring, user-bound HMAC evidence envelope. The graph forwards it unchanged. The writer takes confidence/signals from verified evidence, never from raw client fields. Unsigned new research uses confidence 50 and no measured predicates; existing content-only saves preserve trusted fields, and changed hypothesis text clears unsigned predicates. Accuracy/status remain server-derived. |
| High | Direct shared-graph writes bypass `/api/share`'s server-built snapshot, allowing forged results to enter public shares and imports. | Clients can read/delete their snapshots but cannot insert/update them. The authenticated share route builds its snapshot using owner-scoped reads and writes it server-side. |
| High | Monthly quotas were atomic in V2 but had no short-window abuse protection. Null RPC kind also selected the AI path. | **002** reserves under one profile row lock, applying a shared 20-reservations/60-second window across analysis and accessory AI. Invalid/null kinds fail; denied reservations do not increment counters. Clients cannot reset the window. |
| Medium | Several routes reserved quota before parsing/validating input; unbounded strings and malformed JSON reached provider paths or caused uncontrolled failures. | Streaming JSON reader caps actual bytes at 256 KiB, including requests without Content-Length. Route-specific validation bounds AI prompts, arrays and identifiers before quota reservation. Seed/refresh still support an empty body. |
| Medium | APIs exposed provider and database exception messages, including a `detail` field. | All route exports have a safe exception boundary; explicit failure responses use fixed codes. Existing success bodies, status conventions and memory's empty-cluster fallback remain intact. Usage failures return safe 503; burst denial returns 429 and Retry-After. |
| Medium | Existing DOMPurify protects graph HTML from executable markup, but CSS resource loads survive sanitization. Source links also lacked an explicit opener boundary. | Strip resource-bearing/obfuscated CSS while retaining graph layout styles and canvas elements. Safe links retain target behavior with `noopener noreferrer`. Expanded malicious HTML/CSS regression coverage; all legacy graph HTML sinks remain sanitized. |

Column privileges must be combined with table-level revocation: see [Supabase column security](https://supabase.com/docs/guides/database/postgres/column-level-security). PostgreSQL documents RLS exceptions, including whole-table operations and integrity checks, in [row security policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## Preserved behavior and compatibility

- No page markup, CSS design, graph geometry, connection heuristic, market ranking, import rules or user-facing navigation changed in this sprint.
- Graph task/edge saves, deletion, layout editing, action content saves, profile name/portfolio editing and watch acknowledgement keep their permitted database operations.
- API success shapes remain unchanged except for the additive `clusters[].evidence` transport field. Validation rejects malformed/oversized requests. Unexpected errors deliberately stop exposing upstream strings.
- Evidence is valid for one hour and uses the existing server-only service-role secret with domain separation. No new production credentials are required. It authenticates server output, not factual accuracy. Old browser sessions without evidence cannot set confidence or predicates; reload clients during coordinated rollout.
- Monthly quotas still count logical operations, including failed provider attempts, with no refund race. Memory's dedup pass and provider continuation loops remain part of the existing logical operation. Refresh batch items reserve individually; its existing best-effort fallback may return an idle/partial response when a reservation is refused, without submitting unpaid work.

## Manual database rollout — not executed

1. Review the baseline dependency before merging anything into main. Back up application and database. Restore representative data to an isolated staging database.
2. On an existing database, **do not run schema.sql**. Apply `001_v2_security_and_versions.sql` once if it is not already installed, then `002_security_hardening.sql` once. Both are transactional and intentionally not rerun scripts. New databases need schema.sql followed by 001 and 002.
3. Migration 001 can abort on duplicate cluster IDs or invalid cross-owner references and resets legacy computed results; follow its existing reconciliation instructions. Migration 002 only changes privileges, adds two profile rate-window columns, and replaces `reserve_usage`; it does not reset plans, usage totals or research.
4. Run the rollback-only `supabase/tests/v2_rls.sql` and `supabase/tests/security_hardening.sql` on staging with `ON_ERROR_STOP=1`. Do not run these fixture scripts on production.
5. In staging, test two separate authenticated users through the actual Supabase REST API, concurrent reservation requests from multiple connections, signup, graph save/reload, profile editing, shares, import, publish, watches and AI failure behavior. Use separate test credentials; never point tests at production.
6. Coordinate migration and application deployment, then reload old clients. Retain restricted grants on rollback. Prefer rolling forward; do not restore broad client writes to accommodate old code. Additive rate columns can remain if reverting the application.
7. Legacy snapshots and confidence/predicates were writable before hardening. Review/rebuild shared snapshots and treat legacy research as unverified. This sprint does not silently delete or rewrite that content.

## Verification

- Regression tests were first run against the original code and reproduced malformed-input/quota-ordering failures, raw error disclosure, broad privileges, forged timestamps, missing burst limits, CSS resource injection and the thesis admin-write bypass.
- Full Vitest suite includes real embedded PostgreSQL (PGlite) role/RLS tests, route tests with external auth/provider boundaries replaced, evidence tampering/expiry tests, DOM sanitization, and existing graph/card/marketplace regression suites.
- PGlite queues concurrent JavaScript requests on one embedded connection. Those tests verify reservation results and caps, **not** real multi-session contention. PostgreSQL row locks provide the implementation; multi-connection staging verification remains required.
- Production build uses an isolated source copy under `/tmp` with no `.env.local` and placeholder local Supabase settings. No live data/provider access is required.
- Production dependency audit reports zero known vulnerabilities at audit time. This is not a guarantee against undisclosed vulnerabilities.

### Recorded results

- `npm test`: **158 passed**, 20 test files.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run build` in the isolated source copy: passed (Next.js 15.5.28).
- `git diff --check`: passed.
- `npm audit --omit=dev --json`: zero reported vulnerabilities.
- Existing non-failing output: Vite warns about future native config loading; webpack warns about large cache strings; Next reports that the edge OG-image route disables static generation for that route. No standalone ESLint configuration is supplied by this repository.

## Follow-up risks outside this first sprint

- Authenticated task output and action content remain client-authored to preserve the graph's existing persistence contract. They can influence derived conviction. A future server-owned analysis persistence flow should bind task output to provider results and real source IDs; AI evidence alone does not make marketplace scores independently verified.
- Signed cluster evidence can be replayed by the same user for the same hypothesis during its validity window. Revision CAS still prevents stale overwrites, but unique/idempotent provenance and anti-cloning are not claimed.
- The per-user AI reservation limiter is not a global/IP DDoS limiter. Public read endpoints, direct Supabase content writes, refresh polling and non-AI mutations need separate infrastructure/resource budgets. Marketplace publish-count and refresh-batch submission races remain candidates for a follow-up sprint.
- Legacy inline scripts and styles preclude enabling a strict CSP without a separate compatibility effort. Sanitization remains the immediate XSS boundary; do not introduce new unsanitized sinks.
- No authenticated browser run against a deployed Supabase environment or independent penetration test was performed. Production migration status is unknown.
