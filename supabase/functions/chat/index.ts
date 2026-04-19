// Universal chat proxy. Forwards user-provided API key + chosen provider/model.
// Handles 3 API styles: openai (most), anthropic (Claude), google (handled via openai-compat URL on client side).
// CORS-safe — keys live in browser localStorage, sent only per-request.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL_DEFS = [
  { type: "function", function: { name: "eval_response", description: "MANDATORY self-evaluation. After producing any substantive output, call this to grade your own response against the user goal. If passed=false, the agent loop will continue with next_action.", parameters: { type: "object", properties: { goal: { type: "string" }, output_summary: { type: "string" }, criteria: { type: "array", items: { type: "string" } }, score: { type: "number" }, passed: { type: "boolean" }, gaps: { type: "array", items: { type: "string" } }, next_action: { type: "string" } }, required: ["goal", "output_summary", "score", "passed", "next_action"] } } },
  { type: "function", function: { name: "doc_save", description: "Save or overwrite a Jarvis document by name.", parameters: { type: "object", properties: { name: { type: "string" }, content: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["name", "content"] } } },
  { type: "function", function: { name: "doc_list", description: "List all stored Jarvis documents.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "doc_get", description: "Read a stored Jarvis document.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "doc_delete", description: "Delete a stored Jarvis document.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "doc_export", description: "Export a document as a downloadable file.", parameters: { type: "object", properties: { name: { type: "string" }, format: { type: "string", enum: ["txt", "md", "json"] } }, required: ["name"] } } },
  { type: "function", function: { name: "audit_status", description: "Return current audit flags.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "http_fetch", description: "Fetch a URL (allowlist-gated). Returns text body and status.", parameters: { type: "object", properties: { url: { type: "string" }, method: { type: "string", enum: ["GET", "POST"] }, headers: { type: "object" }, body: { type: "string" } }, required: ["url"] } } },
  { type: "function", function: { name: "write_file_artifact", description: "Produce a downloadable file artifact.", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" }, mime: { type: "string" } }, required: ["filename", "content"] } } },
  { type: "function", function: { name: "run_js", description: "Execute sandboxed JavaScript in the browser.", parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } } },
  { type: "function", function: { name: "list_uploads", description: "List uploaded files.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "read_upload", description: "Read text from an uploaded file.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "gh_create_issue", description: "Create a GitHub issue via REST API. Requires user PAT.", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, body: { type: "string" }, labels: { type: "array", items: { type: "string" } } }, required: ["title", "body"] } } },
  { type: "function", function: { name: "gh_create_pr", description: "Create a GitHub PR via REST API.", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, body: { type: "string" }, head: { type: "string" }, base: { type: "string" }, draft: { type: "boolean" } }, required: ["title", "head"] } } },
  { type: "function", function: { name: "gh_workflow_dispatch", description: "Trigger GitHub Actions workflow_dispatch.", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, workflow_id: { type: "string" }, ref: { type: "string" }, inputs: { type: "object" } }, required: ["workflow_id"] } } },
  { type: "function", function: { name: "gh_status", description: "Return GitHub auth status.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "skill_search", description: "Search skill marketplace ('antigravity' or 'skillkit').", parameters: { type: "object", properties: { source: { type: "string", enum: ["antigravity", "skillkit"] }, query: { type: "string" }, collection: { type: "string" }, limit: { type: "number" }, refresh: { type: "boolean" } } } } },
  { type: "function", function: { name: "skill_install", description: "Install a marketplace skill.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } },
  { type: "function", function: { name: "skill_uninstall", description: "Remove an installed skill.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } },
  { type: "function", function: { name: "skill_activate", description: "Activate an installed skill.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } },
  { type: "function", function: { name: "skill_deactivate", description: "Deactivate the active skill.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "skill_list_installed", description: "List installed skills.", parameters: { type: "object", properties: {} } } },
];

const AUTOPILOT_INJECT = `\n\nAUTOPILOT ACTIVE — aggressive mode:\n- MAX 12 self-iteration steps. Keep calling tools and refining until eval_response.passed=true.\n- Never ask user clarifying questions; pick most reasonable interpretation and execute.\n- After each tool result, decide: continue executing or call eval_response.`;

// Convert OpenAI-style messages → Anthropic format
function toAnthropic(messages: any[], systemContent: string, model: string, tools: any[]) {
  // System extracted; tool_calls/tool messages need translation
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue; // handled separately
    if (m.role === "tool") {
      // Anthropic represents tool result as user message with tool_result content block
      out.push({
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: m.tool_call_id, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) },
        ],
      });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls) {
        let input: any = {};
        try { input = JSON.parse(tc.function?.arguments || "{}"); } catch {}
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function?.name, input });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return {
    model,
    system: systemContent,
    messages: out,
    max_tokens: 4096,
    stream: true,
    tools: tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    })),
  };
}

// Translate Anthropic SSE → OpenAI-style SSE deltas (so the client's existing parser keeps working)
function anthropicToOpenAIStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  // Track tool_use blocks: index → {id, name, args}
  const toolBlocks = new Map<number, { id: string; name: string; argBuf: string }>();

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      const send = (obj: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).replace(/\r$/, "");
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            try {
              const ev = JSON.parse(payload);
              switch (ev.type) {
                case "content_block_start": {
                  if (ev.content_block?.type === "tool_use") {
                    toolBlocks.set(ev.index, { id: ev.content_block.id, name: ev.content_block.name, argBuf: "" });
                    send({ choices: [{ delta: { tool_calls: [{ index: ev.index, id: ev.content_block.id, type: "function", function: { name: ev.content_block.name, arguments: "" } }] } }] });
                  }
                  break;
                }
                case "content_block_delta": {
                  if (ev.delta?.type === "text_delta") {
                    send({ choices: [{ delta: { content: ev.delta.text } }] });
                  } else if (ev.delta?.type === "input_json_delta") {
                    const blk = toolBlocks.get(ev.index);
                    if (blk) blk.argBuf += ev.delta.partial_json || "";
                    send({ choices: [{ delta: { tool_calls: [{ index: ev.index, function: { arguments: ev.delta.partial_json || "" } }] } }] });
                  }
                  break;
                }
                case "message_stop":
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                  break;
              }
            } catch {/* skip malformed */}
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      messages = [],
      provider = "openai",
      apiStyle = "openai",
      baseUrl = "https://api.openai.com/v1",
      model = "gpt-4o-mini",
      apiKey = "",
      autopilot = false,
      activeSkill = null,
      skillPrompt = "",
      uploads = [],
      systemPrompt = "",
    } = body;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: `Nema API ključa za ${provider}. Otvori Settings → Providers i unesi ključ.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemContent = systemPrompt || "You are a helpful AI assistant.";
    if (autopilot) systemContent += AUTOPILOT_INJECT;
    if (activeSkill && skillPrompt) {
      systemContent += `\n\n=== ACTIVE SKILL: ${activeSkill} ===\n${skillPrompt}\n=== END SKILL ===\nYou MUST follow this skill's contract strictly.`;
    }
    if (uploads.length) {
      systemContent += `\n\nUPLOADED FILES THIS SESSION:\n${uploads.map((u: any) => `- ${u.name} (${u.size} bytes, ${u.type || "unknown"}) — url: ${u.url}`).join("\n")}\nUse \`read_upload\` to read text content.`;
    }

    let upstreamUrl: string;
    let upstreamHeaders: Record<string, string>;
    let upstreamBody: string;
    let translateAnthropic = false;

    if (apiStyle === "anthropic") {
      upstreamUrl = `${baseUrl.replace(/\/$/, "")}/messages`;
      upstreamHeaders = {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      };
      upstreamBody = JSON.stringify(toAnthropic(messages, systemContent, model, TOOL_DEFS));
      translateAnthropic = true;
    } else {
      // OpenAI-compatible (works for OpenAI, Google AI compat, Mistral, DeepSeek, OpenRouter, Custom)
      upstreamUrl = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
      upstreamHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      // OpenRouter wants extra headers (optional)
      if (provider === "openrouter") {
        upstreamHeaders["HTTP-Referer"] = "https://jarvis-pilot-assistant.lovable.app";
        upstreamHeaders["X-Title"] = "JARVIS v4";
      }
      upstreamBody = JSON.stringify({
        model,
        messages: [{ role: "system", content: systemContent }, ...messages],
        tools: TOOL_DEFS,
        stream: true,
      });
    }

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: upstreamBody,
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      console.error(`Upstream ${provider} ${upstream.status}:`, text.slice(0, 500));
      let msg = `${provider} returned ${upstream.status}`;
      if (upstream.status === 401) msg = `${provider}: API ključ nije validan.`;
      else if (upstream.status === 429) msg = `${provider}: rate limit. Sačekaj malo.`;
      else if (upstream.status === 402 || upstream.status === 403) msg = `${provider}: nema kredita ili pristup odbijen.`;
      else if (upstream.status === 404) msg = `${provider}: model "${model}" ne postoji ili nije dostupan tvom ključu.`;
      try {
        const j = JSON.parse(text);
        msg = j.error?.message || j.message || msg;
      } catch {}
      return new Response(JSON.stringify({ error: msg }), {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseStream = translateAnthropic ? anthropicToOpenAIStream(upstream.body) : upstream.body;
    return new Response(responseStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
