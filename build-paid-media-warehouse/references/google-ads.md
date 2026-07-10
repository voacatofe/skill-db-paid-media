# Google Ads ingestion contract

## Authentication and hierarchy

Model customer ID, optional manager/login customer ID, developer token and OAuth credentials separately. Store account timezone and currency from customer metadata. Never assume the manager account's settings apply to child customers.

## GAQL contract

Persist or version every GAQL query. A query contract includes:

- `FROM` resource;
- selected resource attributes, segments and metrics;
- date predicate and incremental cursor;
- customer/login customer context;
- expected grain implied by selected segments;
- API version.

Adding a segment can change cardinality. Do not add fields to an existing fact without re-evaluating its key.

## Extraction pattern with dlt

Use the maintained Google Ads verified source when its resources match the contract. Otherwise wrap `GoogleAdsService.SearchStream` or paged search in custom dlt resources:

- build GAQL from controlled templates, not user-provided raw strings;
- convert protobuf values deterministically;
- retry around the stream/request boundary, not only row processing;
- yield account ID, resource IDs, segment keys and report date;
- load each independent report into a table with an explicit merge key.

## Suggested facts

- campaign-day;
- ad group-day;
- ad/day;
- conversion action-day;
- keyword-day;
- search term-day;
- device/network/day;
- asset or asset-group/day for supported campaign types.

Keep conversion-action and search-term grains separate from campaign-day.

## Incremental and mutable metrics

Use a date cursor with a trailing lookback for conversions and corrections. Backfill bounded intervals per customer. Maintain separate watermarks by query/report and customer, because one successful report must not advance another.

## Metric semantics

Micros-based monetary fields must be divided once and typed as fixed-precision numeric. Preserve `conversions`, `all_conversions`, conversion value and conversion action separately. Record whether the business KPI uses primary conversions, all conversions or an external CRM event.

## Required tests

- Query compilation/validation for every GAQL template.
- Unique grain after all selected segments.
- Monetary micros conversion and currency metadata.
- Repeated-window idempotency.
- Comparison with Google Ads UI using matching date, timezone and conversion columns.
- Retry fixture for stream removal/transient transport failure.
- Permission and invalid-customer errors classified separately.

Official dlt source reference: [Google Ads verified source](https://dlthub.com/docs/dlt-ecosystem/verified-sources/google_ads). Revalidate current Google Ads API fields, compatibility rules and version lifecycle in official Google documentation during implementation.
