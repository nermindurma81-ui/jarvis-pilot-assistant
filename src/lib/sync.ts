// Cloud sync: pushes installed skills + recent chat to Supabase, pulls on boot,
// and subscribes to realtime changes from other devices using same device_id.
// Designed to be idempotent and safe to call repeatedly.

import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device-id";
import type { FetchedSkill } from "@/lib/skill-marketplace";
import type { ChatMessage } from "@/store/jarvis";

const deviceId = () => getDeviceId();

// ── Skills sync ────────────────────────────────────────────────────────────

export async function pushSkill(skill: FetchedSkill) {
  await supabase.from("synced_skills").upsert({
    device_id: deviceId(),
    skill_id: skill.id,
    payload: skill as any,
    updated_at: new Date().toISOString(),
  }, { onConflict: "device_id,skill_id" });
}

export async function pushSkillsBulk(skills: FetchedSkill[]) {
  if (!skills.length) return;
  const rows = skills.map((s) => ({
    device_id: deviceId(),
    skill_id: s.id,
    payload: s as any,
    updated_at: new Date().toISOString(),
  }));
  // Chunk to keep payloads small
  for (let i = 0; i < rows.length; i += 50) {
    await supabase.from("synced_skills").upsert(rows.slice(i, i + 50), { onConflict: "device_id,skill_id" });
  }
}

export async function deleteSkillRemote(id: string) {
  await supabase.from("synced_skills").delete().eq("device_id", deviceId()).eq("skill_id", id);
}

export async function pullAllSkills(): Promise<FetchedSkill[]> {
  const { data, error } = await supabase
    .from("synced_skills")
    .select("payload")
    .eq("device_id", deviceId());
  if (error || !data) return [];
  return data.map((r: any) => r.payload as FetchedSkill).filter(Boolean);
}

// ── Messages sync (lightweight) ────────────────────────────────────────────

export async function pushMessage(m: ChatMessage) {
  if (m.role === "tool") return; // skip tool noise
  await supabase.from("synced_messages").upsert({
    device_id: deviceId(),
    msg_id: m.id,
    role: m.role,
    content: typeof m.content === "string" ? m.content.slice(0, 20000) : "",
    ts: m.ts,
    meta: { toolName: m.toolName, attachments: m.attachments } as any,
  }, { onConflict: "device_id,msg_id" });
}

export async function pullRecentMessages(limit = 100): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from("synced_messages")
    .select("*")
    .eq("device_id", deviceId())
    .order("ts", { ascending: false })
    .limit(limit);
  if (!data) return [];
  return data
    .map((r: any) => ({ id: r.msg_id, role: r.role, content: r.content, ts: Number(r.ts), toolName: r.meta?.toolName, attachments: r.meta?.attachments }))
    .reverse();
}

// ── Realtime subscriptions ─────────────────────────────────────────────────

export function subscribeSkills(onChange: () => void) {
  const ch = supabase
    .channel(`skills-${deviceId()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "synced_skills", filter: `device_id=eq.${deviceId()}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
