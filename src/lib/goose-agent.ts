// Goose agent — Block/AAIF's open-source agent persona.
// Source: https://github.com/aaif-goose/goose
// Loads the real Goose system prompt + auto-installs the 4 .agents/skills.
import type { FetchedSkill } from "./skill-marketplace";

const REPO = "aaif-goose/goose";
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;

// Curated, real skill paths from .agents/skills/
const GOOSE_SKILL_PATHS = [
  "code-review",
  "create-app-e2e-test",
  "create-pr",
  "edge-case-finder",
] as const;

export const GOOSE_AGENT = {
  id: "goose",
  name: "Goose",
  icon: "🪿",
  description: "AAIF's open-source general-purpose agent (aaif-goose/goose).",
  systemPromptUrl: `${RAW}/crates/goose/src/prompts/system.md`,
};

/** Fetch Goose's real system prompt and strip Jinja templating that doesn't apply here. */
export async function fetchGoosePrompt(): Promise<string> {
  const r = await fetch(GOOSE_AGENT.systemPromptUrl);
  if (!r.ok) throw new Error(`Goose prompt fetch failed: ${r.status}`);
  const raw = await r.text();
  // Remove Jinja blocks ({% ... %} ... {% endif %}/{% endfor %}/{% endwith %}) and {{ vars }}.
  const cleaned = raw
    .replace(/\{%[\s\S]*?%\}/g, "")
    .replace(/\{\{[\s\S]*?\}\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned;
}

/** Fetch one .agents/skills/<id>/SKILL.md and parse frontmatter. */
async function fetchOneSkill(slug: string): Promise<FetchedSkill> {
  const url = `${RAW}/.agents/skills/${slug}/SKILL.md`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${slug}: ${r.status}`);
  const text = await r.text();
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta: Record<string, string> = {};
  let body = text;
  if (m) {
    body = m[2];
    const lines = m[1].split(/\r?\n/);
    let key = "";
    let buf: string[] = [];
    const flush = () => { if (key) meta[key] = buf.join(" ").trim(); };
    for (const line of lines) {
      const kv = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (kv && !line.startsWith(" ")) {
        flush(); key = kv[1]; buf = kv[2] ? [kv[2].replace(/^>-?\s*/, "")] : [];
      } else if (line.trim()) {
        buf.push(line.trim());
      }
    }
    flush();
  }
  return {
    id: `goose:${slug}`,
    name: meta.name ? meta.name.replace(/^["']|["']$/g, "") : slug,
    description: (meta.description || "").replace(/^["']|["']$/g, "").slice(0, 280),
    source: "aaif-goose/goose",
    prompt: body.trim(),
    fetchedAt: Date.now(),
    rawUrl: url,
  };
}

/** Fetch all 4 Goose skills in parallel. */
export async function fetchAllGooseSkills(): Promise<FetchedSkill[]> {
  const results = await Promise.allSettled(GOOSE_SKILL_PATHS.map(fetchOneSkill));
  return results
    .filter((r): r is PromiseFulfilledResult<FetchedSkill> => r.status === "fulfilled")
    .map((r) => r.value);
}
