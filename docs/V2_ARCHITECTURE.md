# Symnaps V2 architecture audit — 2026-10-22

Repository: voice-tec/synapse. Scope: app, lib, public/synapse, SQL, configuration and existing tests; no live database inspection or migration.

## Existing system
Next.js 14 App Router authenticates with Supabase SSR middleware and route-local getUser. app/page.tsx loads owned rows, injects static bilingual BODY/STYLE, exposes persistence callbacks and loads public/synapse/graph.js. The vanilla canvas renderer owns layout, zoom, pan, search, selections, task/thesis/action nodes and drawer behavior. React owns public pages, auth and marketplace. Keep this boundary for the first slice.

Analysis → Anthropic JSON with actual web citations → client task persistence → heuristic graph connections → memory clustering/deduplication → thesis persistence. Portfolio and challenge reuse Anthropic; refresh evaluates FRED, quotes and FMP fundamentals and optionally ingests an Anthropic batch. Watch cron rechecks verdicts. Import clones public/shared content and must reset evaluated results. Marketplace reads through service-role queries.

## Entities
profiles: subscription, counters, portfolio and optional public identity. tasks: query, generated intent/fingerprint/output and provenance. connections: task edges. theses: mutable research, source task UUID array, legacy JSON history, signal evaluations, layout and publication/import metadata. actions: generated educational portfolios and estimated price performance. watches: periodic task verdict checks. shared_graphs: explicit public snapshots accessed by opaque token.

## Reuse and risks
Reuse renderer, node identity/cluster IDs, drawer, bilingual dictionaries, auth clients, provider wrappers, signal catalog and fetchers. Preserve all stored IDs and layout. Renderer has globally shared mutable state, asynchronous drawer callbacks and many HTML sinks; do not replace it. Reload and account-switch behavior must remain intact. Client generated task IDs are replaced by saved UUIDs. Missing migrations must produce an explicit card-unavailable error rather than discard research.

## Target first slice
Add structured fields to theses and append-only thesis_versions snapshots. PostgreSQL serializes revisions on the thesis row; optimistic revision numbers reject stale edits. Triggers capture existing automated changes too. Legacy rows get a migration-time baseline, never fabricated historical revisions. Card fetches by owned cluster ID in the existing drawer, exposes structured editing and immutable history. Evidence/decisions remain explicitly unimplemented until later phases.

## Debt
Unbundled 2,800-line renderer; loose any types and strict:false; client-controlled analysis JSON is conviction, not an attested prediction; JSON history is not trustworthy historical evidence. No existing database/browser integration suite. Refresh batch orchestration has concurrency/retry and cost-control debt. Legacy public metrics aggregate private research and overstate signal hits as accuracy. Dependency security updates require a separate compatibility pass. Google font/CDN availability affects rendering. Production behavior cannot be established from local source alone.
