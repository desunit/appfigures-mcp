#!/usr/bin/env node
/**
 * Entry point: start the Appfigures MCP server over stdio.
 * IMPORTANT: stdout is reserved for the MCP protocol — all logging goes to stderr.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  if (!process.env.APPFIGURES_PAT?.trim()) {
    // Warn but don't exit: tools will return a clear error if actually called.
    console.error(
      "[appfigures-mcp] Warning: APPFIGURES_PAT is not set. Tool calls will fail until it is.",
    );
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[appfigures-mcp] Server running on stdio.");
}

main().catch((err) => {
  console.error("[appfigures-mcp] Fatal error:", err);
  process.exit(1);
});
