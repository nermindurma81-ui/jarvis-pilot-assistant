// Real marketplace integration. Two sources, no mocks:
//   1) "antigravity" — sickn33/antigravity-awesome-skills (flat /skills/<id>/SKILL.md)
//   2) "skillkit"    — rohitg00/skillkit (curated catalog of upstream collection repos)
// Skills are fetched live from GitHub on install.

export type MarketSource = "antigravity" | "skillkit";

const SOURCES: Record<MarketSource, { repo: string; raw: string; api: string }> = {
  antigravity: {
    repo: "sickn33/antigravity-awesome-skills",
    raw: "https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main",
    api: "https://api.github.com/repos/sickn33/antigravity-awesome-skills/contents",
  },
  skillkit: {
    repo: "rohitg00/skillkit",
    raw: "https://raw.githubusercontent.com/rohitg00/skillkit/main",
    api: "https://api.github.com/repos/rohitg00/skillkit/contents",
  },
};

export type CatalogEntry = {
  id: string;          // unique within source ("<source>:<...>")
  name: string;
  description: string;
  url: string;         // GitHub html URL
  rawUrl: string;      // raw SKILL.md (for direct skills) OR "" for collections
  source: MarketSource;
  // skillkit-only:
  kind?: "collection" | "skill";
  collectionRepo?: string; // e.g. "anthropics/skills"
  tags?: string[];
};

export type FetchedSkill = {
  id: string;
  name: string;
  description: string;
  risk?: string;
  source?: string;
  version?: string;
  prompt: string;
  fetchedAt: number;
  rawUrl: string;
};

const CATALOG_TTL_MS = 1000 * 60 * 60 * 6;
type CatalogCache = { ts: number; entries: CatalogEntry[] };
const cacheKey = (s: MarketSource) => `jarvis-skill-catalog-${s}-v2`;

// ── PUBLIC API ─────────────────────────────────────────────────────────────

/** Top-level catalog for a source. For skillkit this returns curated COLLECTIONS. */
export async function fetchCatalog(source: MarketSource, force = false): Promise<CatalogEntry[]> {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey(source)) || "null") as CatalogCache | null;
      if (cached && Date.now() - cached.ts < CATALOG_TTL_MS && cached.entries.length) return cached.entries;
    } catch {}
  }

  const entries = source === "antigravity" ? await fetchAntigravity() : await fetchSkillkitCollections();
  localStorage.setItem(cacheKey(source), JSON.stringify({ ts: Date.now(), entries } satisfies CatalogCache));
  return entries;
}

/** For a skillkit COLLECTION entry, list the actual skills inside its upstream repo. */
export async function fetchCollectionSkills(collectionRepo: string): Promise<CatalogEntry[]> {
  const cacheK = `jarvis-skillkit-coll-${collectionRepo.replace("/", "_")}-v1`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheK) || "null") as CatalogCache | null;
    if (cached && Date.now() - cached.ts < CATALOG_TTL_MS) return cached.entries;
  } catch {}

  // Try common locations: /skills, /agents, root. First that returns dirs with SKILL.md wins.
  const candidates = ["skills", "agents", ""];
  let entries: CatalogEntry[] = [];
  for (const path of candidates) {
    const url = `https://api.github.com/repos/${collectionRepo}/contents/${path}`;
    const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) continue;
    const items = (await r.json()) as Array<{ name: string; type: string; html_url: string; path: string }>;
    const dirs = items.filter((x) => x.type === "dir" && !x.name.startsWith("."));
    if (!dirs.length) continue;
    entries = dirs.map((d) => ({
      id: `skillkit:${collectionRepo}:${d.path}`,
      name: humanize(d.name),
      description: "",
      url: d.html_url,
      rawUrl: `https://raw.githubusercontent.com/${collectionRepo}/HEAD/${d.path}/SKILL.md`,
      source: "skillkit" as const,
      kind: "skill" as const,
      collectionRepo,
    }));
    if (entries.length) break;
  }
  localStorage.setItem(cacheK, JSON.stringify({ ts: Date.now(), entries } satisfies CatalogCache));
  return entries;
}

/** Fetch full SKILL.md, parse frontmatter + body. Works for both sources. */
export async function fetchSkill(entry: CatalogEntry): Promise<FetchedSkill> {
  const rawUrl = entry.rawUrl;
  if (!rawUrl) throw new Error("Cannot install a collection — open it and pick a skill.");
  // Try main first; HEAD redirects to default branch on raw.githubusercontent.com.
  let r = await fetch(rawUrl);
  if (!r.ok && rawUrl.includes("/HEAD/")) r = await fetch(rawUrl.replace("/HEAD/", "/main/"));
  if (!r.ok && rawUrl.includes("/HEAD/")) r = await fetch(rawUrl.replace("/HEAD/", "/master/"));
  if (!r.ok) throw new Error(`Skill fetch failed: ${r.status}`);
  const text = await r.text();
  const { meta, body } = parseFrontmatter(text);

  return {
    id: entry.id,
    name: meta.name || entry.name,
    description: stripQuotes(meta.description || entry.description || "").slice(0, 280),
    risk: stripQuotes(meta.risk || ""),
    source: stripQuotes(meta.source || entry.source),
    version: stripQuotes(meta["metadata.version"] || meta.version || ""),
    prompt: body.trim(),
    fetchedAt: Date.now(),
    rawUrl,
  };
}

export function searchCatalog(entries: CatalogEntry[], q: string, limit = 100): CatalogEntry[] {
  if (!q.trim()) return entries.slice(0, limit);
  const needle = q.toLowerCase();
  return entries
    .filter(
      (e) =>
        e.id.toLowerCase().includes(needle) ||
        e.name.toLowerCase().includes(needle) ||
        e.description.toLowerCase().includes(needle) ||
        e.tags?.some((t) => t.toLowerCase().includes(needle))
    )
    .slice(0, limit);
}

// ── SOURCE FETCHERS ────────────────────────────────────────────────────────

async function fetchAntigravity(): Promise<CatalogEntry[]> {
  const r = await fetch(`${SOURCES.antigravity.api}/skills?ref=main`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error(`antigravity catalog: ${r.status}`);
  const items = (await r.json()) as Array<{ name: string; type: string; html_url: string }>;
  return items
    .filter((x) => x.type === "dir" && !x.name.startsWith("."))
    .map((x) => ({
      id: `antigravity:${x.name}`,
      name: humanize(x.name),
      description: "",
      url: x.html_url,
      rawUrl: `${SOURCES.antigravity.raw}/skills/${x.name}/SKILL.md`,
      source: "antigravity" as const,
      kind: "skill" as const,
    }));
}

async function fetchSkillkitCollections(): Promise<CatalogEntry[]> {
  const r = await fetch(`${SOURCES.skillkit.raw}/marketplace/skills.json`);
  if (!r.ok) throw new Error(`skillkit catalog: ${r.status}`);
  const data = (await r.json()) as {
    skills: Array<{ id: string; name: string; description: string; source: string; tags?: string[]; type: string }>;
  };
  return (data.skills || []).map((s) => ({
    id: `skillkit:coll:${s.source}`,
    name: s.name,
    description: s.description || "",
    url: `https://github.com/${s.source}`,
    rawUrl: "", // collections aren't directly installable
    source: "skillkit" as const,
    kind: "collection" as const,
    collectionRepo: s.source,
    tags: s.tags,
  }));
}

// ── helpers ────────────────────────────────────────────────────────────────
function humanize(slug: string): string {
  return slug
    .replace(/^[0-9]+-/, "")
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
function stripQuotes(v: string): string {
  return v.replace(/^["']|["']$/g, "").trim();
}
function parseFrontmatter(src: string): { meta: Record<string, string>; body: string } {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta: Record<string, string> = {};
  const lines = m[1].split(/\r?\n/);
  let nestKey = "";
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indented = /^\s+/.test(line);
    const kv = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2];
    if (!val && !indented) {
      nestKey = key;
      continue;
    }
    if (indented && nestKey) meta[`${nestKey}.${key}`] = val;
    else {
      nestKey = "";
      meta[key] = val;
    }
  }
  return { meta, body: m[2] };
}
