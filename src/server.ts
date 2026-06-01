/**
 * MCP server definition: registers Appfigures tools.
 * Each tool validates input with zod, calls the Appfigures API, and returns
 * the raw JSON as text content (or an error result on failure).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { afRequest, AppfiguresError, type Query } from "./client.js";

/** Wrap a handler so any error becomes an MCP error result instead of crashing. */
async function run(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (err) {
    const msg =
      err instanceof AppfiguresError
        ? `${err.message}${err.body ? `\n${err.body}` : ""}`
        : (err as Error).message;
    return {
      isError: true,
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
    };
  }
}

// Default metrics kept when a report is returned in compact form. The raw
// Appfigures rows carry ~45 fields each, which overflows context on any
// multi-day/multi-country pull.
const DEFAULT_METRICS = [
  "downloads",
  "re_downloads",
  "net_downloads",
  "updates",
  "uninstalls",
  "returns",
  "revenue",
  "subscription_purchases",
];

/**
 * Recursively walk a report response and trim each metric leaf (any object
 * carrying a "downloads" or "revenue" key) down to the requested metrics.
 * Grouping levels (by date/country/etc.) are preserved as-is.
 */
function trimReport(node: unknown, keep: string[]): unknown {
  if (Array.isArray(node)) return node.map((n) => trimReport(n, keep));
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const isLeaf = "downloads" in obj || "revenue" in obj;
    if (isLeaf) {
      const out: Record<string, unknown> = {};
      for (const k of keep) if (k in obj) out[k] = obj[k];
      return out;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = trimReport(v, keep);
    return out;
  }
  return node;
}

/**
 * Call a report endpoint and optionally trim the response. `compact`/`metrics`
 * are MCP-only controls and are stripped before the request goes to Appfigures.
 */
async function runReport(path: string, args: Record<string, unknown>) {
  const { compact = true, metrics, ...query } = args;
  const data = await afRequest(path, query as Query);
  if (!compact) return data;
  const keep =
    typeof metrics === "string" && metrics.trim()
      ? metrics.split(",").map((m) => m.trim()).filter(Boolean)
      : DEFAULT_METRICS;
  return trimReport(data, keep);
}

// Shared param shapes for the financial report endpoints (sales/revenue).
const reportShape = {
  compact: z
    .boolean()
    .optional()
    .describe(
      "Trim each row to key metrics (default true) to stay context-friendly. Set false for all ~45 raw fields.",
    ),
  metrics: z
    .string()
    .optional()
    .describe(
      "Comma-separated metric names to keep (overrides the compact default set), e.g. 'downloads,revenue'.",
    ),
  group_by: z
    .string()
    .optional()
    .describe(
      "Comma-separated pivots: products, countries, dates, stores, device, state. Omit for totals.",
    ),
  start_date: z
    .string()
    .optional()
    .describe("Start date yyyy-mm-dd (inclusive). Defaults to all available data."),
  end_date: z
    .string()
    .optional()
    .describe("End date yyyy-mm-dd (inclusive). Defaults to today."),
  granularity: z
    .enum(["daily", "weekly", "monthly", "yearly"])
    .optional()
    .describe("Time aggregation. Default daily."),
  products: z
    .string()
    .optional()
    .describe("Comma-separated product IDs. Defaults to all active products."),
  countries: z
    .string()
    .optional()
    .describe("Comma-separated ISO country codes to filter by."),
  dataset: z
    .enum(["financial"])
    .optional()
    .describe("Use 'financial' for Apple/Google financial breakdown (requires monthly granularity)."),
};

export function createServer(): McpServer {
  const server = new McpServer({
    name: "appfigures-mcp",
    version: "0.1.0",
  });

  // 1. Search the app stores for products.
  server.registerTool(
    "products_search",
    {
      title: "Search products",
      description:
        "Search the app stores for apps/products by name or term. Returns matches with product IDs usable in other tools.",
      inputSchema: {
        term: z.string().describe("Search term, e.g. an app or company name."),
        count: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Max results to return."),
      },
    },
    ({ term, count }) =>
      run(() =>
        afRequest(`/products/search/${encodeURIComponent(term)}`, { count }),
      ),
  );

  // 2. List the authenticated user's own products.
  server.registerTool(
    "products_list_mine",
    {
      title: "List my products",
      description:
        "List the products (apps) connected to your Appfigures account, with their IDs, names, and stores. " +
        "Compact by default (id/name/store/vendor/sku/active/type) to stay context-friendly; set compact=false for full metadata.",
      inputSchema: {
        compact: z
          .boolean()
          .optional()
          .describe(
            "Return only essential fields per product (default true). Set false for the full raw response.",
          ),
        filter: z
          .string()
          .optional()
          .describe("Case-insensitive substring to match against product name."),
      },
    },
    ({ compact = true, filter }) =>
      run(async () => {
        const data = await afRequest("/products/mine");
        // The API returns an object keyed by product id. Optionally filter by
        // name and trim to essential fields so the result fits in context.
        let products = Object.values(data as Record<string, Record<string, unknown>>);
        if (filter) {
          const needle = filter.toLowerCase();
          products = products.filter((p) =>
            String(p.name ?? "").toLowerCase().includes(needle),
          );
        }
        if (!compact) return filter ? products : data;
        return products.map((p) => ({
          id: p.id,
          name: p.name,
          store: p.store,
          vendor_identifier: p.vendor_identifier,
          sku: p.sku,
          active: p.active,
          type: p.type,
          parent_id: p.parent_id,
        }));
      }),
  );

  // 3. Sales report (downloads + revenue).
  server.registerTool(
    "reports_sales",
    {
      title: "Sales report",
      description:
        "Sales report: downloads, updates, revenue and returns, optionally pivoted and filtered by date/product/country.",
      inputSchema: reportShape,
    },
    (args) => run(() => runReport("/reports/sales", args)),
  );

  // 4. Revenue report.
  server.registerTool(
    "reports_revenue",
    {
      title: "Revenue report",
      description:
        "Revenue report with the same filtering/pivoting options as the sales report.",
      inputSchema: reportShape,
    },
    (args) => run(() => runReport("/reports/revenue", args)),
  );

  // 5. Reviews.
  server.registerTool(
    "reviews_list",
    {
      title: "List reviews",
      description:
        "Fetch user reviews, optionally filtered by product, rating, language and date range.",
      inputSchema: {
        products: z
          .string()
          .optional()
          .describe("Comma-separated product IDs to filter by."),
        count: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Reviews per page (default 25)."),
        page: z.number().int().positive().optional().describe("Page number (1-based)."),
        lang: z
          .string()
          .optional()
          .describe("Translate reviews to this language code, e.g. 'en'."),
        start: z.string().optional().describe("Start date yyyy-mm-dd."),
        end: z.string().optional().describe("End date yyyy-mm-dd."),
        stars: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Filter by star rating 1-5."),
        sort: z
          .enum(["date", "stars"])
          .optional()
          .describe("Sort field. Default date (newest first)."),
      },
    },
    (args) => run(() => afRequest("/reviews", args as Query)),
  );

  return server;
}
