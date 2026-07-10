# BI delivery and production operations

## Semantic contracts

Publish versioned views with:

- declared grain;
- stable column names and SQL types;
- metric definitions and lineage;
- original and normalized platform fields;
- freshness timestamp;
- tenant/account security rules.

Recommended surfaces:

- `semantic.paid_media_campaign_daily`;
- `semantic.paid_media_creative_daily`;
- `semantic.paid_media_conversion_daily`;
- `semantic.paid_media_executive_daily` as a constrained wide table;
- `ops.pipeline_health` and `ops.data_freshness`.

## Looker Studio

Favor a single view per chart family and precompute expensive joins. Keep date fields typed as dates and money numeric. Avoid dashboard-side blends for core metrics. Test common filters for account, platform, campaign and date.

## Power BI

Expose a star schema when the model will be imported and a narrow aggregate/view for DirectQuery. Keep one-directional dimension-to-fact relationships and avoid many-to-many relationships unless a designed bridge exists. Validate refresh folding/query plans and row-level security where applicable.

## Coolify/VPS deployment

Use a lightweight dlt application/container that exits after each job or remains idle with negligible resources. Let Coolify scheduled tasks or an external scheduler invoke explicit commands. Separate pipeline service from PostgreSQL when possible.

Required deployment elements:

- health/readiness for long-running services, not fake health for batch jobs;
- environment-based secrets;
- persistent state mount if the local dlt working directory is required;
- resource limits and bounded extraction windows;
- non-overlapping schedules or an advisory lock;
- retention/rotation for logs;
- PostgreSQL backup and restore test;
- alerts for failure, staleness and reconciliation drift.

## Operational data model

Track at minimum:

```text
run_id, pipeline_name, platform, account_id, report_name,
window_start, window_end, status, started_at, finished_at,
rows_extracted, rows_loaded, dlt_load_id, attempt,
error_class, error_message_redacted, watermark_before, watermark_after
```

Monitor freshness separately by account/report. A successful container exit is not proof that all accounts and facts are current.

## Release gates

- Deployment config renders successfully.
- A backfill completes and can resume after interruption.
- Daily run is idempotent.
- No overlapping execution against the same pipeline state.
- Database backup and restore are proven.
- Source-to-mart reconciliation passes on samples.
- Ops dashboard/alerts are ready before stakeholder BI sign-off.
- BI read role cannot write to warehouse schemas.
