# Meta Ads ingestion contract

## Authentication and scope

Use a Meta app and token appropriate to the organization, with explicit access to each ad account. Keep token ownership, expiry, permissions and account authorization in the control plane. Never print tokens or full authorization headers.

## Grain before fields

Define the Insights `level` and `breakdowns` before selecting metrics. Common facts:

- account-day;
- campaign-day;
- ad set-day;
- ad-day;
- placement/device/day;
- geography/day;
- action type and attribution window/day.

Breakdowns can multiply rows and some combinations are invalid. Do not merge breakdown-heavy output into campaign-day facts without aggregation.

## Extraction pattern with dlt

Use the maintained Facebook Ads verified source when it covers the required contract. Otherwise build a custom dlt resource around the official SDK or Graph API:

- yield one normalized reporting row per declared grain;
- expose account ID, object IDs, report date and breakdown keys;
- retain the raw `actions`, `action_values`, cost-per-action and video arrays when needed for replay;
- unnest action types into a separate fact or pivot only a governed catalog;
- record API version, requested fields, level, breakdowns, action breakdowns and attribution settings.

## Incremental and attribution

Meta reporting is mutable. Re-read a trailing window sized to the account's attribution setting and business latency. Keep both `date_start`/`date_stop` and extraction timestamp. A cursor on report date alone is insufficient without a lookback.

## Quota and async reports

Use bounded date windows, field sets tailored to the use case and account-level pacing. For large reports, use asynchronous Insights jobs and poll with capped backoff. A quota error is an account/app/request-volume problem; changing ingestion platforms does not create quota.

## Metric semantics

- Spend, impressions and link clicks can support canonical facts when definitions are documented.
- Actions are attributed events, not raw site events.
- Reach is non-additive across time and entities.
- Frequency should be derived from compatible reach/impression scopes, not summed.
- Preserve action type and attribution window for leads, purchases and messaging outcomes.

## Required tests

- Unique declared grain including action/breakdown keys.
- No duplicate rows after reloading the same mutable window.
- Spend comparison with Ads Manager for sample dates and account timezone.
- Selected action totals compared under the same attribution settings.
- Detection of empty responses caused by permissions versus genuinely zero activity.
- Fixture for nested actions and schema additions.

Official dlt source reference: [Facebook Ads verified source](https://dlthub.com/docs/dlt-ecosystem/verified-sources/facebook_ads). Revalidate current Meta API versions, permissions and supported breakdown combinations in official Meta documentation during implementation.
