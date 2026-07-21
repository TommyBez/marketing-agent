# Pilot cost accounting

This subsystem measures real AI spend and Vercel infrastructure cost before paid plans are introduced. It deliberately does not implement subscriptions, Dodo Payments, top-ups, pricing UI, pilot cohorts, or pilot expiry automation.

## Commercial rules encoded today

- One credit is one US dollar of provider-reported model cost.
- Every pilot workspace receives one idempotent grant of 25 credits.
- Credits are a shared workspace balance; each model call retains its initiating user for attribution.
- Only model spend consumes the balance. Sandbox, Workflow, Functions, and Queues remain internal COGS used for pricing analysis.
- `AI_CREDIT_ENFORCEMENT` defaults to off operationally. Turn it on only after credits have been granted and two daily reconciliations have completed with acceptable quality.

The real source of truth for a balance is the append-only `ai_credit_ledger_entries` table plus the transactionally maintained account balance. Provider costs are stored in USD with 12 decimal places; ledger balances use integer micro-USD to avoid floating-point drift.

## Required production configuration

Set these server-side variables in Vercel Production:

```dotenv
CRON_SECRET=
# Native Upstash names; Vercel Marketplace KV_REST_API_URL/TOKEN are also accepted.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
VERCEL_TEAM_ID=
VERCEL_PROJECT_ID=
VERCEL_BILLING_TOKEN=
AI_GATEWAY_REPORTING_KEY=
AI_CREDIT_ENFORCEMENT=false
```

`VERCEL_BILLING_TOKEN` needs read access to the Billing Charges API and is also used for local/manual Workflow collection. Deployed Sandbox collection can use Vercel OIDC automatically. Keep all of these variables server-only.

Both cron routes intentionally share one environment-scoped Upstash lock key, for example `branderize:production:cron:cost-accounting:v1`, so report generation cannot read usage facts or allocations while reconciliation is updating them. Their normal schedules are one hour apart, well beyond the 330-second lock TTL. Preview deployments return `404` before authentication or lock acquisition, so the jobs cannot be invoked there even manually. Acquisition uses `SET NX PX 330000`; release is an owner-checked Lua delete. The client accepts either the native `UPSTASH_REDIS_REST_*` pair or the Vercel Marketplace `KV_REST_API_*` pair. A concurrent invocation returns `204`, and unavailable Redis returns `503` so accounting never runs without its lock.

## Deployment sequence

Do not apply the migration blindly to Production. First verify that the new uniqueness constraint can be created:

```sql
select "eveSessionId", count(*)
from "agent_threads"
where "eveSessionId" is not null
group by "eveSessionId"
having count(*) > 1;
```

Then:

1. Deploy the schema and application with `AI_CREDIT_ENFORCEMENT=false`.
2. Grant the pilot balance once to every existing workspace:

   ```bash
   pnpm pilot:grant -- --all
   ```

   To grant only selected workspaces, repeat the flag:

   ```bash
   pnpm pilot:grant -- --workspace <workspace-id> --workspace <workspace-id>
   ```

3. Let the 02:15 UTC reconciliation run twice and inspect `cost_reconciliation_runs`, source warnings, unattributed resources, pending facts, and Gateway residual adjustments. A Workflow `measure-workflow-data-written` coverage warning is currently expected: the read API does not expose that distinct byte counter, so it remains visible without degrading source health and FOCUS remains its actual-cost check.
4. Only after both runs are healthy, set `AI_CREDIT_ENFORCEMENT=true` manually.

The grant command is safe to repeat: its ledger idempotency key is fixed per workspace. There is intentionally no automatic pilot end date or tester-count configuration.

## Runtime measurement

Every physical AI SDK provider call is wrapped by `meteredModel`, including retries, subagents, and Eve compaction calls. The request carries a verified workspace, user, conversation, and Eve session identity; production generation fails closed if that identity cannot be resolved, including after an internal service-principal hop. AI Gateway receives a stable opaque user hash rather than a database identifier plus an environment tag such as `branderize:production`. The same tag is persisted on the physical call, so account-wide Gateway spend reports can filter out unrelated applications and compare only like-for-like local cost. The runtime debits the provider-reported Gateway cost immediately when present, captures generation metadata from every stream chunk, and falls back to generation lookup or the Gateway's current model catalog for a provisional debit. Eve lifecycle hooks provide a second observation path, while the daily Gateway collector replaces provisional cost with the provider-reported exact value, writes only the residual ledger adjustment, and warns about any completed call still missing direct model-level cost.

The cutoff is intentionally a soft transactional cutoff, not a reservation system: each call checks the locked workspace balance before starting. The final allowed call can take the balance below zero by its full cost, and concurrent calls can increase that overshoot; all subsequent calls are blocked after their debits land. A reservation ledger can be added later if pilot data shows this edge case matters.

Sandbox collection is read-only (`resume: false`). It revisits all returned sessions so terminal metrics can finalize older pending facts, and it snapshots CPU, provisioned memory, transfer, creations, and snapshot storage.

Workflow collection reads analytics and metadata without resolving payload data. It records every provider event exactly at the current public rate of $0.02 per 1,000 events, including retries and non-step state transitions. Retained bytes are converted to an explicitly `experimental` GB-month estimate at $0.50/GB-month. The API does not expose the semantically distinct Data Written counter, so no $0.50/GB estimate is invented; the collector emits a warning and its FOCUS charge deliberately remains `platform_shared` rather than being allocated using retained bytes. These rates follow Vercel's product-specific [Workflow pricing](https://vercel.com/docs/workflows/pricing), not an older step-based price card.

The daily reconciliation also imports Vercel FOCUS billing charges and allocates actual billed/effective infrastructure cost by measured usage where attribution exists. AI Gateway and FOCUS use a 14-day lookback so a post-settlement run can refresh an entire reported week. Unattributed or team-wide charges remain `platform_shared` instead of being assigned to a tester.

## Scheduled outputs

- `/api/cron/cost-reconciliation` runs every day at 02:15 UTC.
- `/api/cron/pilot-cost-report` runs every Monday at 03:15 UTC.
- Both require `Authorization: Bearer $CRON_SECRET`, run for at most 300 seconds, and use the shared Redis lock.
- Scheduling and route execution are Production-only; Preview returns `404` for both routes.

The weekly job stores the last two full UTC weeks. A week remains provisional for at least 72 hours and is finalized only when every source has gap-free successful coverage for that week. AI Gateway and FOCUS must also complete a full-week refresh after the 72-hour settlement point; Sandbox and Workflow need both continuous daily-window coverage and a successful post-settlement pass, and FOCUS allocation must succeed in that late pass. The coverage evidence is embedded in each report. Any missing interval, failed source, or stale snapshot keeps the report `provisional`. Reports include model cost by workspace/user/model, token counts, credit debits and current balances, standard-rate infrastructure cost, actual FOCUS allocations, pending and unattributed quality signals, and platform-to-model COGS ratio. Pricing simulations show monthly floors at 70%, 80%, and 85% target gross margin under three separate bases: standard marginal rates (recommended), actual billed infrastructure, and actual effective infrastructure after credits or adjustments. Unclassified FOCUS charges are reported but excluded from infrastructure pricing to avoid double-counting AI Gateway spend.

No customer-facing amount should be derived from a provisional report or from `estimated`/`experimental` facts without reviewing its quality breakdown.
