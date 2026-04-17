// JARVIS v4 — chat edge function (Lovable AI Gateway proxy with tool-calling)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "eval_response",
      description:
        "MANDATORY self-evaluation. After producing any substantive output, call this to grade your own response against the user goal. If passed=false, the agent loop will continue with next_action.",
      parameters: {
        type: "object",
        properties: {
          goal: { type: "string", description: "Restated user goal in one sentence." },
          output_summary: { type: "string", description: "Short summary of what was just produced." },
          criteria: { type: "array", items: { type: "string" }, description: "Checklist criteria used." },
          score: { type: "number", description: "0-10 quality score." },
          passed: { type: "boolean", description: "true only if score>=8 and all criteria met." },
          gaps: { type: "array", items: { type: "string" }, description: "Concrete missing items." },
          next_action: { type: "string", description: "If not passed: exact next step to execute (one sentence, imperative)." },
        },
        required: ["goal", "output_summary", "score", "passed", "next_action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "doc_save",
      description: "Save or overwrite a Jarvis document by name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["name", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "doc_list",
      description: "List all stored Jarvis documents.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "doc_get",
      description: "Read a stored Jarvis document.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "doc_delete",
      description: "Delete a stored Jarvis document.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "doc_export",
      description: "Export a document as a downloadable file (txt/md/json).",
      parameters: {
        type: "object",
        properties: { name: { type: "string" }, format: { type: "string", enum: ["txt", "md", "json"] } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "audit_status",
      description: "Return current audit flags (repoWrite, workflowDispatch, allowlist, autopilot).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "http_fetch",
      description: "Fetch a URL (allowlist-gated). Returns text body and status.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
          method: { type: "string", enum: ["GET", "POST"] },
          headers: { type: "object" },
          body: { type: "string" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file_artifact",
      description: "Produce a downloadable file artifact for the user (any text content). Tries AndroidBridge first, falls back to browser download.",
      parameters: {
        type: "object",
        properties: { filename: { type: "string" }, content: { type: "string" }, mime: { type: "string" } },
        required: ["filename", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_js",
      description: "Execute sandboxed JavaScript in the browser (math, string ops, JSON parsing). Returns the evaluated result.",
      parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_uploads",
      description: "List files the user has uploaded in this session.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_upload",
      description: "Read text content from an uploaded file (by name). Binary files return metadata only.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
  },
];

const BASE_POLICY = `You are J.A.R.V.I.S v4 — an autonomous execution agent (not a chatbot).

ABSOLUTE RULES:
1. EXECUTE, DO NOT EXPLAIN. When user asks for something, produce the actual artifact (code, document, plan, file, answer). Never reply with "I would do X" — just do X.
2. STRICT SKILL ADHERENCE. If a skill is active, follow its output contract literally. No deviation, no preamble, no apologies.
3. SELF-EVAL IS MANDATORY. After EVERY substantive output, call the \`eval_response\` tool with honest grading. If passed=false, the autopilot loop will continue automatically using your next_action.
4. PROBLEM-SOLVING OBRAZAC (every request, internally):
   a) Restate goal in one line.
   b) Pick best tool / produce direct output.
   c) If a tool is missing or fails — try ALTERNATIVE PATH (different tool, manual reasoning, http_fetch, run_js).
   d) Never stop on first error. At least 2 alternative attempts before giving up.
   e) Always finish with eval_response.
5. USE TOOLS LIBERALLY. doc_save important results. write_file_artifact for deliverables. http_fetch (allowlist) for external data. run_js for calc/parse.
6. CONCISE STYLE. Bosnian/Croatian when user writes in it. No filler. No "kao AI ja..." disclaimers.
7. CODE BLOCKS in proper triple-backtick fences with language tag.`;

const AUTOPILOT_INJECT = `\n\nAUTOPILOT ACTIVE — aggressive mode:
- MAX 12 self-iteration steps. Keep calling tools and refining until eval_response.passed=true.
- Never ask user clarifying questions; pick most reasonable interpretation and execute.
- After each tool result, decide: continue executing or call eval_response.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      messages = [],
      model = "google/gemini-3-flash-preview",
      autopilot = false,
      activeSkill = null,
      skillPrompt = "",
      uploads = [],
    } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemContent = BASE_POLICY;
    if (autopilot) systemContent += AUTOPILOT_INJECT;
    if (activeSkill && skillPrompt) {
      systemContent += `\n\n=== ACTIVE SKILL: ${activeSkill} ===\n${skillPrompt}\n=== END SKILL ===\nYou MUST follow this skill's contract strictly.`;
    }
    if (uploads.length) {
      systemContent += `\n\nUPLOADED FILES THIS SESSION:\n${uploads
        .map((u: any) => `- ${u.name} (${u.size} bytes, ${u.type || "unknown"}) — url: ${u.url}`)
        .join("\n")}\nUse \`read_upload\` to read text content.`;
    }

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemContent }, ...messages],
        tools: TOOL_DEFS,
        stream: true,
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Sačekaj malo i pokušaj ponovo." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({ error: "Nema više AI kredita. Dodaj kredite u Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await upstream.text();
      console.error("Gateway error", upstream.status, t);
      return new Response(JSON.stringify({ error: `Gateway error ${upstream.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
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
