# Appfigures API notes

Reference for the endpoints wrapped by this MCP server.
Full docs: https://docs.appfigures.com/api/reference/v2/

- **Base URL:** `https://api.appfigures.com/v2`
- **Auth:** `Authorization: Bearer <PAT>` (Personal Access Token). HTTPS only.
  Create at https://appfigures.com/developers/keys → API Client → choose scopes →
  "Create Personal Access Token" (shown once). Reports need the `private:read` scope.

## Endpoints used

### GET `/products/search/{term}`
Search the stores for apps. Optional `count`. → tool `products_search`.

### GET `/products/mine`
Products connected to your account (ids, names, stores). → tool `products_list_mine`.

### GET `/reports/sales` and `/reports/revenue`
Financial reports. Shared params (→ tools `reports_sales`, `reports_revenue`):

| Param | Notes |
|-------|-------|
| `group_by` | products, countries, dates, stores, device, state. Omit → totals. |
| `start_date` / `end_date` | `yyyy-mm-dd`. Default = all available. |
| `granularity` | daily \| weekly \| monthly \| yearly (default daily). |
| `products` | csv product IDs (default: all active). |
| `countries` | csv ISO country codes. |
| `dataset` | `financial` for Apple/Google breakdown (requires monthly granularity). |

Without `group_by` the response is aggregate totals; with it, results nest by pivot.
Fields include downloads, revenue, returns, updates; financial adds `iap_revenue`,
`subscription_revenue`, `business_revenue`.

### GET `/reports/subscriptions`
Subscription report (→ tool `reports_subscriptions`). Same pivot/filter params as the
financial reports (`group_by`, `start_date`/`end_date`, `granularity`, `products`,
`countries`). Per-row fields include `new_trials`, `trial_conversions`,
`trial_conversion_rate`, `new_subscriptions`, `active_subscriptions`,
`cancelled_subscriptions`, `churn`, `mrr`, `actual_revenue`, `gross_revenue`.

This is the **only** report that splits subscription value **by country** — the sales
report's per-country `revenue` is downloads-only for free-with-IAP apps (Apple's sales
feed attributes only paid-app proceeds per country).

**Gotcha — keyed by IAP/subscription product IDs, not app IDs.** Filtering `products` by
an app's product ID returns `{}`. Pass the subscription product IDs instead; resolve them
via `GET /products/<subId>` → `parent_id` (which points back to the app). A grouped
`group_by=product` pull lists every subscription product with its parent `product` object.

## Other endpoints (not yet wrapped)
`/reports/ads`, `/reports/adspend`, `/reports/ratings`,
`/ranks`, `/aso`, `/featured`, `/events`, `/users`, `/external_accounts`.
