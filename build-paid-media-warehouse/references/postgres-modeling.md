# PostgreSQL, dbt, and dimensional modeling

## Schema boundaries

Use `control`, platform raw schemas, `staging`, `intermediate`, `analytics`, `semantic`, and `ops`. Grant ingestion write access only to control/raw, transformation write access to derived schemas, and BI read-only access to semantic views.

## Facts and dimensions

Use a Kimball-style constellation, not one universal fact:

- `dim_date`, `dim_platform`, `dim_ad_account`;
- platform-aware campaign, ad group/ad set, ad and creative dimensions;
- `fact_campaign_daily`, `fact_ad_daily`, and separate conversion/breakdown facts;
- bridge/mapping tables for governed cross-platform campaign taxonomy.

Declare grain in every model description and encode it in a uniqueness test. Use deterministic surrogate keys from stable business-key columns. Do not join facts directly unless both sides are aggregated to the same grain.

## dbt layout

```text
models/
  staging/meta/
  staging/google/
  intermediate/
  marts/core/
  marts/paid_media/
  semantic/
  ops/
```

Keep source freshness, model contracts, tests and documentation in version control. Pin dbt and package versions. Use macros only when they remove real repetition; keep business definitions visible in SQL/YAML.

The Fivetran `dbt_ad_reporting` project is useful as a metric/modeling reference. Do not install it against dlt tables unless an adapter produces the exact source schemas and semantics it expects.

## Types and keys

- IDs: text unless numeric behavior is required.
- Money: `numeric`, never binary float.
- Timestamps: `timestamptz` for extraction events; local report date plus account timezone for platform reporting.
- Percentages/ratios: derived views, with safe division.
- JSON: retain only where replay/flexibility is useful; promote governed fields to typed columns.

## Incremental dbt models

Use incremental materialization only with:

- tested unique key;
- overlap window for late updates;
- deterministic update behavior;
- schema-change policy;
- full-refresh runbook;
- comparison test against a bounded full rebuild.

## Performance

Start with correct grains and narrow semantic views. Add composite indexes matching real predicates, commonly account/date and platform/date. Use materialized views or aggregate tables for repeated expensive dashboard queries. Use native partitioning only when table size, maintenance and query plans justify it; PostgreSQL does not offer BigQuery-style clustering.

Measure with `EXPLAIN (ANALYZE, BUFFERS)`, realistic date ranges and concurrent BI usage. Avoid indexing every column or materializing every dbt model.

## Core tests

- source freshness and required-column tests;
- unique and not-null grain keys;
- relationships to conformed dimensions;
- accepted platform/currency values;
- non-negative spend/impressions/clicks where semantically valid;
- reconciliation across raw, staging and marts;
- no fanout after dimension joins;
- semantic view column/type compatibility.
