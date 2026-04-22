// Lightweight skill execution: runs a sub-skill prompt against an input
// using the currently selected provider/model, then returns the text.
// Powers skill_run / skill_chain / skill_compose without entering a new
// agent loop (avoids recursive tool storms).

import { resolveActiveModel } from "@/store/jarvis";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export async function runSkill(prompt: string, input: string): Promise<string> {
  const model = resolveActiveModel();
  if (!model) throw new Error("No active model configured");
  if (!model.apiKey && !String(model.providerId).startsWith("custom:")) {
    throw new Error(`No API key for provider ${model.providerId}. Open Settings → Providers.`);
  }
  const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } } as any));
  const r = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      provider: { id: model.providerId, baseUrl: model.baseUrl, apiStyle: model.apiStyle, apiKey: model.apiKey },
      model: model.modelId,
      messages: [{ role: "user", content: input }],
      systemPrompt: prompt,
      stream: false,
      noTools: true,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Skill exec failed (${r.status}): ${t.slice(0, 300)}`);
  }
  const data = await r.json();
  // Be tolerant of provider envelopes
  return (
    data?.choices?.[0]?.message?.content ||
    data?.content?.[0]?.text ||
    data?.text ||
    JSON.stringify(data).slice(0, 4000)
  );
}
