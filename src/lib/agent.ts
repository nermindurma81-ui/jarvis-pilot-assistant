// Agent loop — handles streaming, tool dispatch, eval_response autopilot continuation.
import { useJarvis, resolveActiveModel } from "@/store/jarvis";
import { skillById } from "./skills";
import { executeTool } from "./tools";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type StreamCallbacks = {
  onAssistantStart: (id: string) => void;
  onDelta: (id: string, text: string) => void;
  onToolCall: (id: string, name: string, args: string) => void;
  onToolResult: (toolId: string, name: string, result: any) => void;
  onEval: (id: string, ev: { score: number; passed: boolean; gaps?: string[] }) => void;
  onDone: (id: string) => void;
  onError: (msg: string) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

async function streamOnce(messages: any[], cb: StreamCallbacks): Promise<{
  assistantId: string;
  finalContent: string;
  toolCalls: { id: string; name: string; args: string }[];
  evalPassed?: boolean;
  evalNextAction?: string;
}> {
  const s = useJarvis.getState();
  const skill = skillById(s.activeSkill);
  const active = resolveActiveModel();
  if (!active) throw new Error("Nijedan provider/model nije izabran. Otvori Settings → Models.");
  if (!active.apiKey) throw new Error(`Nema API ključa za ${active.providerId}. Otvori Settings → Providers.`);

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      messages,
      provider: active.providerId,
      apiStyle: active.apiStyle,
      baseUrl: active.baseUrl,
      model: active.modelId,
      apiKey: active.apiKey,
      systemPrompt: s.systemPrompt,
      autopilot: s.autopilot,
      activeSkill: skill?.name || null,
      skillPrompt: skill?.prompt || "",
      uploads: s.uploads.map((u) => ({ name: u.name, url: u.url, size: u.size, type: u.type })),
    }),
  });

  if (!resp.ok || !resp.body) {
    let msg = `HTTP ${resp.status}`;
    try { const j = await resp.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }

  const assistantId = uid();
  cb.onAssistantStart(assistantId);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  let finalContent = "";
  const toolCallsMap = new Map<number, { id: string; name: string; args: string }>();
  let evalPassed: boolean | undefined;
  let evalNextAction: string | undefined;

  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || !line.trim()) continue;
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          finalContent += delta.content;
          cb.onDelta(assistantId, delta.content);
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = toolCallsMap.get(idx) || { id: tc.id || uid(), name: "", args: "" };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name = tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            toolCallsMap.set(idx, cur);
          }
        }
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }

  const toolCalls = Array.from(toolCallsMap.values());

  // Surface eval_response info
  for (const tc of toolCalls) {
    if (tc.name === "eval_response") {
      try {
        const a = JSON.parse(tc.args || "{}");
        evalPassed = !!a.passed;
        evalNextAction = a.next_action;
        cb.onEval(assistantId, { score: a.score, passed: !!a.passed, gaps: a.gaps });
      } catch {}
    }
  }

  return { assistantId, finalContent, toolCalls, evalPassed, evalNextAction };
}

export async function runAgent(userText: string, cb: StreamCallbacks) {
  const s0 = useJarvis.getState();
  s0.setAgentBusy(true);

  try {
    const apiMessages: any[] = s0.messages
      .filter((m) => m.role !== "tool" || m.toolCallId)
      .map((m) => {
        if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId!, content: m.content };
        if (m.role === "assistant" && m.toolCalls?.length)
          return { role: "assistant", content: m.content, tool_calls: m.toolCalls };
        return { role: m.role, content: m.content };
      });
    apiMessages.push({ role: "user", content: userText });

    const MAX_STEPS = useJarvis.getState().autopilot ? 12 : 6;

    for (let step = 0; step < MAX_STEPS; step++) {
      const { assistantId, finalContent, toolCalls, evalPassed, evalNextAction } = await streamOnce(apiMessages, cb);

      // Push assistant turn into store + api messages
      const apiToolCalls = toolCalls.map((t) => ({
        id: t.id,
        type: "function",
        function: { name: t.name, arguments: t.args },
      }));
      apiMessages.push({ role: "assistant", content: finalContent, tool_calls: apiToolCalls.length ? apiToolCalls : undefined });

      cb.onDone(assistantId);

      if (!toolCalls.length) break;

      // Execute each tool, push results
      for (const tc of toolCalls) {
        const res = await executeTool(tc.name, tc.args);
        const payload = JSON.stringify(res.ok ? res.result : { error: res.error });
        cb.onToolResult(tc.id, tc.name, res.ok ? res.result : { error: res.error });
        apiMessages.push({ role: "tool", tool_call_id: tc.id, content: payload });
      }

      const autopilot = useJarvis.getState().autopilot;
      const evalRequired = useJarvis.getState().evalRequired;

      // Stop conditions:
      // - eval_response was called and passed → done
      // - autopilot off and at least one tool ran → continue ONCE more for synthesis
      if (toolCalls.some((t) => t.name === "eval_response")) {
        if (evalPassed) break;
        if (!autopilot) break; // user not in autopilot — stop after first eval failure
        if (evalNextAction) {
          apiMessages.push({
            role: "user",
            content: `[AUTOPILOT-CONTINUE] Eval failed. Execute now: ${evalNextAction}`,
          });
        }
      } else if (!autopilot) {
        // give one more turn so model can synthesize tool outputs into final answer
        if (step >= 1) break;
      }

      // If evalRequired and last assistant didn't call eval, nudge it
      if (evalRequired && !toolCalls.some((t) => t.name === "eval_response") && step === MAX_STEPS - 2) {
        apiMessages.push({
          role: "user",
          content: "[SYSTEM] Now call eval_response to grade your output before finishing.",
        });
      }
    }
  } catch (e: any) {
    cb.onError(e.message || String(e));
  } finally {
    useJarvis.getState().setAgentBusy(false);
  }
}
