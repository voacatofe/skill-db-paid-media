# dlt-first ingestion architecture

## Selection rule

Use dlt for ingestion. Do not present Airbyte or PyAirbyte as alternatives. Select the dlt implementation form that gives the required control:

| Form | Use when | Guardrail |
|---|---|---|
| Verified source | Its resources and fields satisfy the contract | Pin a compatible version and inspect its schema/state behavior |
| REST API source | Pagination, authentication and JSON resources are conventional | Test pagination, rate-limit headers and nested child tables |
| Custom source/resource | GAQL, SDK iterators, async jobs or unusual breakdowns require code | Keep API code thin and test query construction separately |

## Pipeline identity and state

Treat `(pipeline_name, destination, dataset_name)` as durable identity. Do not derive names from ephemeral container IDs. Use a stable pipeline per independent state/credential boundary. dlt can restore state from destination tables, but preserve the local pipeline working directory when deployments depend on local schemas or faster restoration.

Recommended environment contract:

```text
DESTINATION__POSTGRES__CREDENTIALS=postgresql://...
DLT_PROJECT_DIR=/app/.dlt
PIPELINE_NAME=meta_ads_<account_key>
DATASET_NAME=raw_meta
```

Use dlt secrets/config files only when they are mounted outside version control. Prefer platform environment variables in Coolify.

## Idempotency

For reporting facts that change because of attribution or corrections:

- use `write_disposition="merge"`;
- specify a stable primary/merge key;
- use a date cursor plus a trailing mutable lookback;
- delete-and-reload a bounded partition only when merge keys cannot represent the source;
- test the same window twice and require unchanged final row counts and totals.

Use append for immutable audit events, never as the default for daily Ads insights.

## Concurrency

Never run two writers against the same stateful dlt pipeline concurrently. Enforce one of:

- PostgreSQL advisory lock keyed by pipeline/account;
- scheduler concurrency limit of one;
- OS/container mutex with a persistent lock location.

Run separate accounts concurrently only when they have distinct pipeline identities and API quotas permit it.

## Backfill and incremental pattern

1. Register the run in `control.sync_runs`.
2. Acquire the pipeline/account lock.
3. Compute windows from explicit start/end dates.
4. Extract bounded ranges with retry and exponential backoff.
5. Load with dlt and record load IDs and row counts.
6. Reconcile totals and update the watermark only after success.
7. Release the lock and emit operational metrics.

Do not let one failed account prevent independent accounts from completing. Do not advance a cursor after a partial failure.

## Schema evolution and contracts

Allow additive changes only in raw when appropriate. Freeze staging interfaces with explicit casts and selected columns. Quarantine incompatible type changes or missing required columns. Avoid letting automatic nested normalization dictate analytics table grains.

## Error classes

Handle separately:

- authentication/authorization: stop and alert;
- invalid query or unsupported field combination: fail deterministically;
- quota/rate limit: back off, shrink windows and reschedule;
- transient network/stream removal: retry the iterator/request boundary;
- destination constraint/type failure: preserve load evidence and repair the contract;
- partial account failure: mark that account/run failed without corrupting other watermarks.

## Production acceptance

- Stable pipeline and dataset names.
- Destination state and local-state strategy documented.
- Merge keys and mutable lookback tested.
- Concurrency lock present.
- Backfill resumable.
- Logs redact credentials.
- Run ledger, freshness and reconciliation visible.
- Recovery drill performed for an interrupted load.

Official references: [dlt introduction](https://dlthub.com/docs/intro), [state](https://dlthub.com/docs/general-usage/state), [schema evolution](https://dlthub.com/docs/general-usage/schema-evolution), and [performance](https://dlthub.com/docs/reference/performance).
