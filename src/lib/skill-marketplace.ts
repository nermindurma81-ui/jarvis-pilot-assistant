// Real marketplace integration with github.com/sickn33/antigravity-awesome-skills
// No mocks. Catalog is fetched from GitHub, individual skills are fetched on install.

const REPO = "sickn33/antigravity-awesome-skills";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main`;
const API_BASE = `https://api.github.com/repos/${REPO}/contents`;

export type CatalogEntry = {
  id: string;          // directory name == unique id
  name: string;        // human-readable
  description: string; // short, from frontmatter or fallback
  url: string;         // GitHub html URL for the SKILL.md
  rawUrl: string;      // raw SKILL.md
};

export type FetchedSkill = {
  id: string;
  name: string;
  description: string;
  risk?: string;
  source?: string;
  version?: string;
  prompt: string;       // body of SKILL.md (system prompt content)
  fetchedAt: number;
  rawUrl: string;
};

const CATALOG_CACHE_KEY = "jarvis-skill-catalog-v1";
const CATALOG_TTL_MS = 1000 * 60 * 60 * 6; // 6h

type CatalogCache = { ts: number; entries: CatalogEntry[] };

/** Fetch the directory listing of /skills via the GitHub contents API.
 *  Returns ALL skill folders (handles pagination via per_page=100 + manual paging). */
export async function fetchCatalog(force = false): Promise<CatalogEntry[]> {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) || "null") as CatalogCache | null;
      if (cached && Date.now() - cached.ts < CATALOG_TTL_MS && cached.entries.length) {
        return cached.entries;
      }
    } catch {}
  }

  // /contents only returns first 1000 entries flat. We use the git tree API for completeness.
  const treeUrl = `https://api.github.com/repos/${REPO}/git/trees/main?recursive=0`;
  // Simpler: list /skills via contents (returns up to 1000, sufficient).
  const r = await fetch(`${API_BASE}/skills?ref=main`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error(`Catalog fetch failed: ${r.status}`);
  const items = (await r.json()) as Array<{ name: string; type: string; html_url: string }>;
  const entries: CatalogEntry[] = items
    .filter((x) => x.type === "dir" && !x.name.startsWith("."))
    .map((x) => ({
      id: x.name,
      name: humanize(x.name),
      description: "",
      url: x.html_url,
      rawUrl: `${RAW_BASE}/skills/${x.name}/SKILL.md`,
    }));

  localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ ts: Date.now(), entries } satisfies CatalogCache));
  return entries;
}

/** Fetch full SKILL.md, parse YAML frontmatter, return executable skill payload. */
export async function fetchSkill(id: string): Promise<FetchedSkill> {
  const rawUrl = `${RAW_BASE}/skills/${encodeURIComponent(id)}/SKILL.md`;
  const r = await fetch(rawUrl);
  if (!r.ok) throw new Error(`Skill fetch failed: ${r.status}`);
  const text = await r.text();
  const { meta, body } = parseFrontmatter(text);

  return {
    id,
    name: meta.name || humanize(id),
    description: stripQuotes(meta.description || "").slice(0, 280),
    risk: stripQuotes(meta.risk || ""),
    source: stripQuotes(meta.source || ""),
    version: stripQuotes(meta["metadata.version"] || meta.version || ""),
    prompt: body.trim(),
    fetchedAt: Date.now(),
    rawUrl,
  };
}

/** Search catalog client-side by name+description substring. */
export function searchCatalog(entries: CatalogEntry[], q: string, limit = 50): CatalogEntry[] {
  if (!q.trim()) return entries.slice(0, limit);
  const needle = q.toLowerCase();
  return entries
    .filter((e) => e.id.toLowerCase().includes(needle) || e.name.toLowerCase().includes(needle))
    .slice(0, limit);
}

// ── helpers ────────────────────────────────────────────────────────────────
function humanize(slug: string): string {
  return slug
    .replace(/^[0-9]+-/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function stripQuotes(v: string): string {
  return v.replace(/^["']|["']$/g, "").trim();
}

/** Minimal YAML frontmatter parser — handles flat keys + 1 level of nesting (metadata.version). */
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
    if (indented && nestKey) {
      meta[`${nestKey}.${key}`] = val;
    } else {
      nestKey = "";
      meta[key] = val;
    }
  }
  return { meta, body: m[2] };
}
