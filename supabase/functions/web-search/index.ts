// Free web search via DuckDuckGo HTML endpoint — no API key required.
// Returns top results with title, url, snippet. Used by the `web_search` tool
// so the LLM can browse the live internet during tool-calling.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

async function ddgSearch(query: string, limit: number) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; JARVIS/4.0)",
      "Accept": "text/html",
    },
  });
  const html = await r.text();
  const results: { title: string; url: string; snippet: string }[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && results.length < limit) {
    let href = m[1];
    // DDG wraps real URL in /l/?uddg=...
    const u = new URL(href, "https://duckduckgo.com");
    const real = u.searchParams.get("uddg");
    if (real) href = decodeURIComponent(real);
    results.push({ title: stripTags(m[2]).slice(0, 200), url: href, snippet: stripTags(m[3]).slice(0, 400) });
  }
  return results;
}

async function fetchPage(url: string, maxBytes = 30000) {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; JARVIS/4.0)", Accept: "text/html,text/plain,*/*" },
    signal: AbortSignal.timeout(15000),
  });
  const ct = r.headers.get("content-type") || "";
  const text = await r.text();
  // Strip tags for HTML
  const cleaned = ct.includes("html")
    ? text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : text;
  return { status: r.status, contentType: ct, content: cleaned.slice(0, maxBytes) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { query, limit = 6, fetchUrl } = await req.json();
    if (fetchUrl && typeof fetchUrl === "string") {
      const page = await fetchPage(fetchUrl);
      return new Response(JSON.stringify({ ok: true, ...page }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const results = await ddgSearch(query, Math.min(Number(limit) || 6, 12));
    return new Response(JSON.stringify({ ok: true, query, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
