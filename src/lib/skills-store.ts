// IndexedDB-backed storage for installed skills (no localStorage quota limit).
// Skill prompts can be many KB each, so we keep them out of the zustand persist blob.

import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from "idb-keyval";
import type { FetchedSkill } from "@/lib/skill-marketplace";

const PREFIX = "jarvis-skill:";
const INDEX_KEY = "jarvis-skill-index";

type SkillIndex = { ids: string[] };

async function readIndex(): Promise<SkillIndex> {
  return ((await idbGet<SkillIndex>(INDEX_KEY)) || { ids: [] });
}
async function writeIndex(idx: SkillIndex) {
  await idbSet(INDEX_KEY, idx);
}

export async function saveSkill(skill: FetchedSkill): Promise<void> {
  await idbSet(PREFIX + skill.id, skill);
  const idx = await readIndex();
  if (!idx.ids.includes(skill.id)) {
    idx.ids = [skill.id, ...idx.ids];
    await writeIndex(idx);
  }
}

export async function saveSkillsBulk(skills: FetchedSkill[]): Promise<void> {
  await Promise.all(skills.map((s) => idbSet(PREFIX + s.id, s)));
  const idx = await readIndex();
  const set = new Set(idx.ids);
  for (const s of skills) set.add(s.id);
  idx.ids = Array.from(set);
  await writeIndex(idx);
}

export async function deleteSkill(id: string): Promise<void> {
  await idbDel(PREFIX + id);
  const idx = await readIndex();
  idx.ids = idx.ids.filter((x) => x !== id);
  await writeIndex(idx);
}

export async function loadAllSkills(): Promise<FetchedSkill[]> {
  const idx = await readIndex();
  // Backfill from raw keys if index ever drifts.
  if (!idx.ids.length) {
    const ks = await idbKeys();
    const fromKeys = (ks as string[]).filter((k) => typeof k === "string" && k.startsWith(PREFIX));
    if (fromKeys.length) {
      idx.ids = fromKeys.map((k) => k.slice(PREFIX.length));
      await writeIndex(idx);
    }
  }
  const all = await Promise.all(idx.ids.map((id) => idbGet<FetchedSkill>(PREFIX + id)));
  return all.filter(Boolean) as FetchedSkill[];
}

export async function getSkill(id: string): Promise<FetchedSkill | null> {
  return (await idbGet<FetchedSkill>(PREFIX + id)) || null;
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const e = await navigator.storage.estimate();
    return { usage: e.usage || 0, quota: e.quota || 0 };
  } catch {
    return null;
  }
}
