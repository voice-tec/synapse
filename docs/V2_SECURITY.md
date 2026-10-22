# V2 security audit and rollout

## Findings
Critical: broad own-profile RLS permits plan/counter edits; read-then-write counters lose updates. Own-thesis RLS permits forged status, accuracy and timestamps, publication bypass and fake provenance. Row ownership alone does not validate referenced task/thesis ownership. Actions expose client-editable performance. Dynamic graph HTML interpolates model/user strings and URLs, enabling stored XSS. Public author aggregates leak private research counts/results; private import activity reveals pseudonymous actors.

Scoring: imported fundamental predicates lose `field`; periodic refresh resets source-less conviction to 50 (maximum confidence 70 vs confirmation threshold 72); initial scoring uses a different baseline than periodic refresh. Manual/stale/nonfinite predicates need explicit handling. `accuracy` is signal alignment, not prediction accuracy. User-authored predicates are not proof of analyst skill.

## Manual deployment order
Never run schema.sql against an existing database. Back up first. Test the versioned migration in supabase/migrations on a disposable Supabase-compatible database, run supabase/tests role tests, then apply the migration manually in the Supabase SQL editor during a coordinated application release. Inspect existing cross-owner links and duplicate (user_id,cluster_id) values before rollout; do not delete research automatically. Deploy code only after schema validation and explicit authorization. No production changes are performed by this task.

New installations: run schema.sql followed by numbered migrations. Restricted client grants and server quota RPCs must ship together. Old browser sessions may need a reload. Do not roll back security grants to accommodate old clients; roll forward or temporarily disable writes. Keep backups and versions on rollback; additive fields do not require destructive reversal.

## Trust boundaries
Service-role credentials remain server-only. Server mutation paths must derive user ID from getUser, whitelist content, and scope updates by ownership. Quotas reserve atomically before provider calls; failed provider attempts consume reservations (bounded cost, no refund race). Append-only versions use database time. Legacy editable history is not backfilled as trustworthy history. Public metrics must use only public rows and must not be advertised as verified outcomes.

## Verification
Local unit/integration results and any unexecuted database/browser checks are recorded in the completion report. SQL tests are rollback-only and require disposable test users, never production execution. No claim of production hardening until migration is applied and verified there.
