---
name: build-paid-media-warehouse
description: Design, build, audit, and troubleshoot global dlt-first PostgreSQL data warehouses for Meta Ads and Google Ads. Use when planning or implementing paid-media ingestion, raw and staging layers, dbt transformations, Kimball marts, cross-platform metric blending, semantic views for Looker Studio or Power BI, backfills, reconciliation, observability, or performance tuning. Prefer dlt for every ingestion workflow and do not propose Airbyte or PyAirbyte as architecture alternatives.
---

# Build Paid Media Warehouse

Build reusable, production-oriented paid-media warehouses with dlt, PostgreSQL, SQL/dbt, and explicit analytical contracts. Keep the solution independent of any single repository, agency, client, cloud, or BI tool.

## Enforce the dlt-first policy

- Use dlt as the ingestion engine for every new pipeline, extension, or migration designed by this skill.
- Do not recommend, install, scaffold, or present Airbyte or PyAirbyte as alternatives.
- Prefer, in order: a maintained dlt verified source that satisfies the contract; a dlt REST API source; a custom `@dlt.source`/`@dlt.resource` using the official platform SDK.
- Extend Python resources and API queries when a verified source lacks a field, breakdown, or report grain.
- Keep orchestration replaceable. Use Coolify cron, system cron, CI schedules, Dagster, Prefect, or another scheduler only as the execution layer around dlt.
- When diagnosing an existing Airbyte system, inspect it without silently rewriting it. If implementation or migration is requested, design the target with dlt.
- If the user explicitly requests an Airbyte-only assessment, answer that assessment without turning Airbyte into the skill's recommended architecture.

## Route the task

1. Classify the request as `plan`, `build`, `audit`, `diagnose`, `migrate`, or `optimize`.
2. Inspect repository documentation, configuration, ingestion code, SQL/dbt models, tests, deployment files, and actual error output before making repo-specific claims.
3. Read only the references required by the request:
   - Always read [dlt-architecture.md](references/dlt-architecture.md) for ingestion or operations work.
   - Read [meta-ads.md](references/meta-ads.md) for Meta Ads.
   - Read [google-ads.md](references/google-ads.md) for Google Ads.
   - Read [postgres-modeling.md](references/postgres-modeling.md) for schemas, dbt, Kimball, or performance.
   - Read [metrics-and-attribution.md](references/metrics-and-attribution.md) for blending, KPIs, attribution, currency, or grain.
   - Read [bi-and-operations.md](references/bi-and-operations.md) for Looker Studio, Power BI, Coolify, monitoring, or production readiness.
4. For implementation tasks, make scoped changes and validate them. For audits or diagnoses, remain read-only unless the user also asks for a fix.

## Establish the data contract first

Record these decisions before writing extraction or transformation code:

- platform, business, account and credential boundary;
- report level and exact grain;
- account timezone, reporting date, currency and conversion policy;
- attribution window and conversion event definitions;
- dimensions, metrics, breakdowns and API query;
- stable primary key or deterministic surrogate key;
- incremental cursor, mutable lookback and backfill range;
- dlt `pipeline_name`, destination, dataset and write disposition;
- schema-evolution policy, data contract and replay strategy;
- expected freshness, volume, API quota and BI SLA.

Do not combine incompatible grains. Create separate facts for campaign, ad group/ad set, ad, conversion action, geography, placement, device, keyword, search term, or asset when their dimensions change row cardinality.

## Build the warehouse in layers

Use separate PostgreSQL schemas unless the existing repository has an equivalent convention:

1. `control`: account registry, sync runs, cursors, watermarks, reconciliation and data-quality results.
2. `raw_meta` and `raw_google`: lossless or minimally transformed platform data plus extraction metadata.
3. `staging`: typed, renamed, deduplicated, source-specific models at a declared grain.
4. `intermediate`: reusable joins, allocation, currency conversion and canonical mappings.
5. `analytics`: conformed dimensions and facts using a Kimball-style constellation.
6. `semantic`: narrow purpose-built views and one-wide-table exports for BI.
7. `ops`: freshness, failures, row counts, quota symptoms, reconciliation and runtime metrics.

Preserve the source truth before blending. Keep platform-native metrics alongside canonical metrics and expose semantic differences explicitly.

## Implement ingestion safely

- Isolate dlt state by stable pipeline name, destination and dataset.
- Use one controlled execution per stateful pipeline. Add a scheduler-level mutex or PostgreSQL advisory lock.
- Use `merge` with explicit keys for mutable Ads reporting data; reserve `append` for immutable event logs.
- Re-read a configurable trailing attribution window on incremental runs.
- Split large backfills into bounded windows and checkpoint progress.
- Persist `_dlt_pipeline_state` in PostgreSQL and preserve local state storage when the deployment relies on it.
- Capture account, extraction timestamp, API version, query/report specification, load ID and source record identifiers.
- Store secrets outside the repository and redact tokens from logs.
- Treat rate limits, expired credentials, invalid field combinations and removed streams as distinct error classes.

## Transform and model with dbt

- Keep staging models source-specific and one-to-one with declared raw contracts.
- Create conformed dimensions for date, platform, account, campaign and creative identifiers only when identity is reliable.
- Build facts at explicit grains; never hide many-to-many joins inside a dashboard view.
- Use incremental models only when their unique key, late-arriving update behavior and full-refresh path are tested.
- Add `not_null`, `unique`, `relationships`, accepted-values and custom grain tests.
- Treat `fivetran/dbt_ad_reporting` as a semantic and modeling reference unless the raw schemas actually match its Fivetran source contracts.
- Pin package versions and inspect generated SQL for PostgreSQL compatibility.

## Blend metrics without changing their meaning

- Use additive universal measures such as spend, impressions, clicks and selected conversions in cross-platform facts.
- Calculate ratios from summed numerators and denominators; never average row-level CTR, CPC, CPM, CVR, CPA or ROAS.
- Keep reach, frequency, video events and attributed conversions platform-specific unless a documented harmonization exists.
- Preserve `source_metric_name`, `canonical_metric_name`, attribution window, conversion action, currency and timezone lineage.
- Reject joins or unions that mix campaign-day with more detailed grains without prior aggregation.

## Make the output dashboard-ready

- Publish stable semantic views with business names, types, definitions and declared grain.
- Prefer separate campaign, creative and conversion views over one universal wide table.
- Provide a focused wide table only when the dashboard benefits from a single relation and the grain remains unambiguous.
- Pre-aggregate heavy queries by common date and account filters.
- Index actual filter and join columns; use declarative partitioning only after volume and query evidence justify it.
- Expose read-only BI roles and restrict tenant/account access where required.
- Validate representative Looker Studio and Power BI queries with `EXPLAIN (ANALYZE, BUFFERS)` against realistic volume.

## Validate before completion

Run the deterministic project audit:

```bash
python scripts/validate_dlt_project.py /path/to/project
```

Run it with `--json` for machine-readable results. Treat critical failures as blockers, especially missing dlt dependency, committed secrets, absent merge/idempotency controls, missing persistent state strategy, or concurrent execution without a lock.

Also validate:

- a small historical backfill and a repeated idempotent run;
- a daily incremental run over the mutable lookback;
- row uniqueness at every published fact grain;
- spend, impressions, clicks and conversions against platform exports for sample dates;
- timezone/currency boundaries and attribution lag;
- schema-change behavior and recovery from partial failure;
- freshness and operational alerts before business dashboard sign-off.

## Deliver the result

For plans, return the target architecture, contracts, phased implementation and acceptance checks. For implementations, include changed files and validation evidence. For audits, rank findings by impact and cite exact files or lines. State unresolved API or business-semantic assumptions instead of inventing them.
