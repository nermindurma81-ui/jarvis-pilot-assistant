// MCP server (Streamable HTTP) — exposes JARVIS tools over Model Context Protocol.
// Deno + mcp-lite + Hono. Connect from Claude Desktop / Cursor / any MCP client.
import { Hono } from "npm:hono@4.6.14";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const app = new Hono();

const mcp = new McpServer({
  name: "jarvis-mcp",
  version: "1.0.0",
});

// ---- Tools ---------------------------------------------------------------

mcp.tool({
  name: "web_search",
  description: "Search the web (DuckDuckGo) for a query and return top results.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: { type: "number", description: "Max results (default 6)" },
    },
    required: ["query"],
  },
  handler: async ({ query, limit }: { query: string; limit?: number }) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ query, limit: limit ?? 6 }),
    });
    const data = await r.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool({
  name: "web_fetch",
  description: "Fetch a URL and return its cleaned text content.",
  inputSchema: {
    type: "object",
    properties: { url: { type: "string", description: "URL to fetch" } },
    required: ["url"],
  },
  handler: async ({ url }: { url: string }) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ fetchUrl: url }),
    });
    const data = await r.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool({
  name: "http_fetch",
  description:
    "Generic HTTP fetch. Returns status, headers and body (text). Use for APIs.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" },
      method: { type: "string", description: "GET|POST|PUT|DELETE (default GET)" },
      headers: { type: "object", description: "Optional headers map" },
      body: { type: "string", description: "Optional request body (string)" },
    },
    required: ["url"],
  },
  handler: async ({
    url,
    method,
    headers,
    body,
  }: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }) => {
    const resp = await fetch(url, {
      method: method ?? "GET",
      headers: headers ?? {},
      body: body && method && method !== "GET" ? body : undefined,
    });
    const text = await resp.text();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: resp.status,
              headers: Object.fromEntries(resp.headers.entries()),
              body: text.slice(0, 20000),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
});

mcp.tool({
  name: "skill_search",
  description:
    "Search the JARVIS skill marketplace (anthropics/skills + custom sources) by keyword.",
  inputSchema: {
    type: "object",
    properties: { q: { type: "string" } },
    required: ["q"],
  },
  handler: async ({ q }: { q: string }) => {
    // Marketplace catalog lives in client; expose a stub that points to the source repos.
    return {
      content: [
        {
          type: "text",
          text:
            `Skill search "${q}": query the JARVIS web app (Marketplace sheet) for the live catalog. ` +
            `Sources: anthropics/skills, aaif-goose/goose, plus user custom sources.`,
        },
      ],
    };
  },
});

mcp.tool({
  name: "ping",
  description: "Health check.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => ({
    content: [{ type: "text", text: `pong @ ${new Date().toISOString()}` }],
  }),
});

// ---- HTTP transport ------------------------------------------------------

const transport = new StreamableHttpTransport();

app.options("/*", (c) => new Response(null, { headers: corsHeaders }));

app.all("/*", async (c) => {
  const resp = await transport.handleRequest(c.req.raw, mcp);
  // Merge CORS into response
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
});

Deno.serve(app.fetch);
