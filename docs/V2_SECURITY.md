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

## Implemented controls
- `001_v2_security_and_versions.sql`: profile column grants; thesis write API; action financial fields protected; watches created server-side with locked per-profile limits; cross-owner triggers; private version SELECT policy; append-only ledger; service-only atomic usage RPC; owner-bound revision RPC with row locking.
- Migration aborts on legacy cross-owner/orphan references or duplicate owner/cluster IDs. Reconcile these explicitly before rerunning the whole transaction. It resets previously client-editable thesis results and action performance for reevaluation; source research is retained. Existing import conviction uses its migration-time confidence as an explicitly approximate baseline.
- DOMPurify guards every dynamic graph HTML sink. New card content uses textContent/DOM APIs. Generated inline handlers were replaced with listeners. The original static BODY is trusted application markup.
- Refresh uses the same conviction baseline for first and subsequent scoring, preserves imported fundamental fields, clears missing/nonfinite data, and counts each observed metric once per direction. Batch results are tied to submitted revisions; legacy batches without revision identity are discarded and resubmitted when appropriate.
- Cron auth fails closed when CRON_SECRET is absent. Public author aggregates use public theses only; private imports are excluded from activity feeds.
- Next.js upgraded from 14.2.15 to 15.5.28 because dependency audit identified critical vulnerabilities. React 18 and the canvas renderer remain in place. Dynamic route params now use the asynchronous contract. PostCSS is overridden to patched 8.x. npm audit reported zero vulnerabilities after installation. See the [official upgrade guidance](https://nextjs.org/docs/app/guides/upgrading/version-15).

## Release checklist (manual, not performed in production)
1. Snapshot database and current application revision. Use Node compatible with the locked development dependencies (local validation used Node 24.15.0).
2. Restore a representative backup to an isolated Supabase staging project; verify duplicate cluster IDs and references. Run migration `supabase/migrations/001_v2_security_and_versions.sql` once as the database owner. It is transactional and intentionally not an idempotent rerun script.
3. Run `supabase/tests/v2_rls.sql` with ON_ERROR_STOP in staging. It creates reserved fixture users and always rolls back; never run it against production.
4. Test signup/login/logout, analysis→memory, first import into an empty graph, portfolio generation, publication, refresh and card edit/reload in IT/EN and narrow viewports against staging credentials.
5. Only after explicit deployment authorization, coordinate the production migration with the application release. Reload old clients. In-place permissions hardening deliberately disables old client write paths: schema additions are data-compatible, but mixed old/new client writes are not supported.
6. Keep versions and additive columns on rollback. Restore application+database together from the approved snapshot if required; do not reopen client access to protected fields.
