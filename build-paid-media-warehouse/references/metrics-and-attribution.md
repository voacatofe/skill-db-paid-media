# Paid-media metrics, blending, and attribution

## Start from business questions

Map each dashboard question to a grain and governed metric. Typical groups:

- delivery: spend, impressions, reach, frequency;
- traffic: clicks, link clicks, landing-page views, CTR, CPC;
- outcomes: platform conversions, leads, purchases, messages, revenue;
- efficiency: CPM, CPL/CPA, conversion rate, ROAS;
- diagnostics: creative, placement, device, geography, audience, keyword/search term.

## Canonical metric catalog

For every metric record:

- canonical name and business definition;
- platform source field(s);
- numerator, denominator and formula;
- aggregation behavior: additive, semi-additive or non-additive;
- compatible grain;
- attribution window and event scope;
- currency/timezone behavior;
- owner and version/effective date.

## Safe blending

Union compatible, already aggregated rows using a common contract such as:

```text
report_date, platform, account_id, campaign_id, campaign_name,
currency, spend, impressions, clicks, selected_conversions,
conversion_value, extraction_timestamp
```

Calculate derived metrics after aggregation:

```sql
ctr  = sum(clicks) / nullif(sum(impressions), 0)
cpc  = sum(spend) / nullif(sum(clicks), 0)
cpm  = 1000 * sum(spend) / nullif(sum(impressions), 0)
cpa  = sum(spend) / nullif(sum(conversions), 0)
roas = sum(conversion_value) / nullif(sum(spend), 0)
```

Never average stored ratios.

## Metrics that require caution

- Reach cannot be summed across days, campaigns or platforms.
- Frequency is not additive.
- Meta actions and Google conversions use different attribution systems.
- Click definitions differ; keep platform-native variants when relevant.
- Video quartiles and views have platform-specific thresholds.
- CRM leads/revenue are downstream outcomes and need a separate identity/attribution model.

## Currency and timezone

Keep original currency and original amount. If reporting in a common currency, add exchange rate, rate date, source and converted amount. Derive report dates in each account's timezone before cross-platform aggregation; retain UTC extraction timestamps.

## Attribution layers

Expose distinct metric families:

1. platform-reported attribution;
2. analytics/site attribution;
3. CRM/offline outcomes;
4. modeled or business-rule allocation.

Do not label them all `conversions`. Use explicit names and reconciliation views. Preserve click/view windows and conversion-action/event identity.

## Campaign taxonomy

Create governed mappings for channel, market, product, funnel stage, objective and owner. Parse naming conventions only into a provisional staging model, retain the original names, and flag unmatched or ambiguous records.
