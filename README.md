# Appfigures MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue.svg)](https://modelcontextprotocol.io)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes the
[Appfigures API](https://docs.appfigures.com/) to AI assistants like Claude. Ask in plain
language for your app downloads, revenue, subscriptions, and reviews — the assistant calls
Appfigures for you.

```
"How many downloads and how much revenue did my apps make in May?"
"Show me my latest 1-star reviews."
"Break down revenue by product for the last 30 days."
```

## Features

- 🔌 **Stdio MCP server** — works with Claude Code, Claude Desktop, and any MCP client
- 🔐 **Personal Access Token auth** — no OAuth flow to implement
- 📊 **Sales & revenue reports** — filter and pivot by date, product, country, store, device
- ⭐ **Reviews** — fetch and filter user reviews with optional translation
- 📦 **Your products** — list connected apps and their IDs
- 🪶 **Zero heavy dependencies** — native `fetch`, just the MCP SDK and `zod`

## Tools

| Tool | Appfigures endpoint | Description |
|------|---------------------|-------------|
| `products_list_mine` | `GET /products/mine` | List the products (apps) connected to your account, with IDs and stores. |
| `reports_sales` | `GET /reports/sales` | Downloads, updates, revenue and returns — filterable and pivotable. |
| `reports_revenue` | `GET /reports/revenue` | Revenue report with the same filtering/pivoting options. |
| `reports_subscriptions` | `GET /reports/subscriptions` | Trials, trial→paid conversions, active/new/cancelled subs, churn, MRR and revenue — the only report that splits subscription value **by country**. |
| `reviews_list` | `GET /reviews` | User reviews, filterable by product, rating, language and date range. |
| `products_search` | `GET /products/search/{term}` | Search the stores for apps. *Requires a Partner API tier — see [Notes](#notes).* |

Full parameter reference: [`docs/api-notes.md`](docs/api-notes.md).

## Prerequisites

- Node.js **>= 20**
- An [Appfigures](https://appfigures.com) account with a **Personal Access Token**

## Getting a token

1. Go to **[appfigures.com/developers/keys](https://appfigures.com/developers/keys)** and
   create an **API Client**.
2. Select the scopes you need — reports and reviews require **`private:read`**. Scopes
   **cannot** be changed after creation.
3. Open the client and click **Create Personal Access Token**.
4. Copy the token (starts with `pat_`). It is shown **only once** — store it securely.

## Installation

```bash
git clone https://github.com/desunit/appfigures-mcp.git
cd appfigures-mcp
npm install
npm run build
```

## Configuration

The server reads your token from the `APPFIGURES_PAT` environment variable.

### Claude Code

```bash
claude mcp add appfigures \
  --env APPFIGURES_PAT=pat_yourtoken \
  -- node /absolute/path/to/appfigures-mcp/dist/index.js
```

### Claude Desktop / generic MCP client

Add to your client's `mcpServers` config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "appfigures": {
      "command": "node",
      "args": ["/absolute/path/to/appfigures-mcp/dist/index.js"],
      "env": { "APPFIGURES_PAT": "pat_yourtoken" }
    }
  }
}
```

Restart the client, then ask it about your apps.

## Usage examples

Once connected, prompt your assistant naturally:

- *"List my apps and their product IDs."* → `products_list_mine`
- *"What were my sales in May 2026?"* → `reports_sales` with date range
- *"Revenue by product for the last 30 days, monthly."* → `reports_revenue` with `group_by=products`
- *"New trials and subscription revenue by country last month."* → `reports_subscriptions` with `group_by=countries`
- *"Show my 5 most recent reviews."* → `reviews_list` with `count=5`

### Report parameters

`reports_sales` / `reports_revenue` / `reports_subscriptions` accept:

| Param | Values |
|-------|--------|
| `group_by` | `products`, `countries`, `dates`, `stores`, `device`, `state` (omit for totals) |
| `start_date` / `end_date` | `yyyy-mm-dd` |
| `granularity` | `daily`, `weekly`, `monthly`, `yearly` |
| `products` | comma-separated product IDs |
| `countries` | comma-separated ISO country codes |
| `dataset` | `financial` (Apple/Google breakdown; requires monthly granularity) |

> **Subscriptions are keyed by IAP/subscription product IDs, not app IDs.** Filtering
> `reports_subscriptions` by an app's product ID returns `{}` — pass the subscription product IDs
> instead (resolve them via `GET /products/<id>` → `parent_id`, which points back to the app). The
> sales report's per-country `revenue` is downloads-only for free-with-IAP apps, so use
> `reports_subscriptions` for per-country subscription value.

## Development

```bash
npm run dev        # run from source with tsx (no build step)
npm run typecheck  # type-check only
npm run build      # compile to dist/
```

Project layout:

```
src/client.ts   Appfigures HTTP client (Bearer auth, error handling)
src/server.ts   MCP server + tool registrations
src/index.ts    stdio entry point
docs/           API reference notes
```

> **Note:** stdout is reserved for the MCP protocol — all logging goes to stderr.

## Notes

- **`products_search` and Partner API access.** The public store-search endpoint requires an
  Appfigures **Partner API** tier. On standard accounts the tool returns a clear
  "requires Partner API Access" error. All other tools work with a standard Personal Access Token.
- **In-app purchases.** Parent apps report downloads, while revenue is attributed to their
  in-app purchase / subscription children. To see downloads and revenue together per app,
  Appfigures' `include_inapps` parameter rolls children into their parent.
- **HTTPS only.** The Appfigures API rejects non-HTTPS requests.

## Author

Built by **[Songtive](https://songtive.com)** — [@desunit](https://x.com/desunit) on X.

## License

[MIT](LICENSE) © Songtive
