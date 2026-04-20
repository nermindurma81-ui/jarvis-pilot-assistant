// Universal GitHub-backed skill marketplace.
// Supports multiple "presets" (curated sources) AND arbitrary user-added repos.
//
// Layouts handled:
//   nested-skill-md  → walks dirs and grabs SKILL.md (or readme.md) per folder
//                      (antigravity, goose, AgentCoffee, pm-skills, anthropics/skills)
//   flat-md          → every *.md (except README) is a standalone skill
//                      (TRAE-Skills/<category>/*.md)
//   skillkit-curated → rohitg00/skillkit marketplace.json -> collections
//
// Skills are fetched live from GitHub on install. No mocks.

export type LayoutKind = "nested-skill-md" | "flat-md" | "skillkit-curated";

export type SourcePreset = {
  id: string;          // stable preset id ("antigravity", "trae", ...)
  label: string;       // shown in UI
  repo: string;        // "owner/name"
  ref?: string;        // branch (default "HEAD")
  layout: LayoutKind;
  rootPath?: string;   // optional starting subdir (e.g. "skills" or ".claude/skills")
  description?: string;
};

export const SOURCE_PRESETS: SourcePreset[] = [
  {
    id: "antigravity",
    label: "Antigravity Awesome Skills",
    repo: "sickn33/antigravity-awesome-skills",
    ref: "main",
    layout: "nested-skill-md",
    rootPath: "skills",
    description: "Curated SKILL.md collection",
  },
  {
    id: "skillkit",
    label: "Skillkit (curated collections)",
    repo: "rohitg00/skillkit",
    ref: "main",
    layout: "skillkit-curated",
    description: "Index of upstream skill repos",
  },
  {
    id: "agentcoffee",
    label: "AgentCoffee · Claude Skills 2026",
    repo: "AgentCoffee006/claude-skills-collection-2026",
    ref: "dev",
    layout: "nested-skill-md",
    rootPath: "skills",
    description: "Claude skills collection (2026)",
  },
  {
    id: "trae",
    label: "TRAE-Skills (HighMark-31)",
    repo: "HighMark-31/TRAE-Skills",
    ref: "main",
    layout: "flat-md",
    description: "Markdown-only skills by category",
  },
  {
    id: "voltagent",
    label: "VoltAgent · Awesome Agent Skills",
    repo: "VoltAgent/awesome-agent-skills",
    ref: "main",
    layout: "nested-skill-md",
    rootPath: "skills",
    description: "Community awesome list (some installable)",
  },
  {
    id: "pm-skills",
    label: "phuryn · PM Skills",
    repo: "phuryn/pm-skills",
    ref: "main",
    layout: "nested-skill-md",
    description: "Product Management skill plugins",
  },
];

export type CatalogEntry = {
  id: string;            // unique within source: "<sourceId>:<path>"
  name: string;
  description: string;
  url: string;           // GitHub html URL
  rawUrl: string;        // raw .md url ("" for collections)
  sourceId: string;      // preset id OR `custom:<owner>/<repo>`
  kind?: "collection" | "skill";
  collectionRepo?: string; // for skillkit collections
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
const cacheKey = (sourceId: string) => `jarvis-skill-catalog-${sourceId}-v3`;

// ── PUBLIC API ─────────────────────────────────────────────────────────────

/** Build/lookup a custom source preset on the fly from a GitHub URL or "owner/repo[/path]". */
export function presetFromCustomRepo(input: string): SourcePreset {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
  // Allow URL with /tree/<branch>/<path>
  let ref = "HEAD";
  let rootPath: string | undefined;
  const treeMatch = cleaned.match(/^([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+))?$/);
  let owner = "", name = "";
  if (treeMatch) {
    owner = treeMatch[1]; name = treeMatch[2]; ref = treeMatch[3]; rootPath = treeMatch[4];
  } else {
    const parts = cleaned.split("/");
    if (parts.length < 2) throw new Error("Use owner/repo or a GitHub URL");
    owner = parts[0]; name = parts[1];
    if (parts.length > 2) rootPath = parts.slice(2).join("/");
  }
  return {
    id: `custom:${owner}/${name}${rootPath ? `:${rootPath}` : ""}`,
    label: `${owner}/${name}${rootPath ? `/${rootPath}` : ""}`,
    repo: `${owner}/${name}`,
    ref,
    layout: "nested-skill-md", // fetcher will auto-fall-back to flat-md
    rootPath,
    description: "Custom GitHub repo",
  };
}

/** Fetch top-level catalog for any preset (curated or custom). */
export async function fetchCatalog(preset: SourcePreset, force = false): Promise<CatalogEntry[]> {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey(preset.id)) || "null") as CatalogCache | null;
      if (cached && Date.now() - cached.ts < CATALOG_TTL_MS && cached.entries.length) return cached.entries;
    } catch {}
  }

  let entries: CatalogEntry[] = [];
  if (preset.layout === "skillkit-curated") {
    entries = await fetchSkillkitCollections(preset);
  } else if (preset.layout === "flat-md") {
    entries = await fetchFlatMd(preset);
  } else {
    entries = await fetchNestedSkillMd(preset);
    // Auto-fallback for custom repos: if nothing found, try flat-md.
    if (!entries.length && preset.id.startsWith("custom:")) {
      entries = await fetchFlatMd(preset);
    }
  }
  try { localStorage.setItem(cacheKey(preset.id), JSON.stringify({ ts: Date.now(), entries } satisfies CatalogCache)); } catch {}
  return entries;
}

/** For a skillkit COLLECTION entry, list the actual skills inside its upstream repo. */
export async function fetchCollectionSkills(collectionRepo: string): Promise<CatalogEntry[]> {
  const cacheK = `jarvis-skillkit-coll-${collectionRepo.replace("/", "_")}-v2`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheK) || "null") as CatalogCache | null;
    if (cached && Date.now() - cached.ts < CATALOG_TTL_MS) return cached.entries;
  } catch {}

  const candidates = ["skills", "agents", ""];
  let entries: CatalogEntry[] = [];
  for (const path of candidates) {
    const items = await ghContents(collectionRepo, path, "HEAD");
    if (!items) continue;
    const dirs = items.filter((x) => x.type === "dir" && !x.name.startsWith("."));
    if (!dirs.length) continue;
    entries = dirs.map((d) => ({
      id: `skillkit:${collectionRepo}:${d.path}`,
      name: humanize(d.name),
      description: "",
      url: d.html_url,
      rawUrl: `https://raw.githubusercontent.com/${collectionRepo}/HEAD/${d.path}/SKILL.md`,
      sourceId: "skillkit",
      kind: "skill",
      collectionRepo,
    }));
    if (entries.length) break;
  }
  try { localStorage.setItem(cacheK, JSON.stringify({ ts: Date.now(), entries } satisfies CatalogCache)); } catch {}
  return entries;
}

/** Fetch full .md, parse frontmatter (if any) + body. Works for both layouts. */
export async function fetchSkill(entry: CatalogEntry): Promise<FetchedSkill> {
  const rawUrl = entry.rawUrl;
  if (!rawUrl) throw new Error("Cannot install a collection — open it and pick a skill.");
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
    source: stripQuotes(meta.source || entry.sourceId),
    version: stripQuotes(meta["metadata.version"] || meta.version || ""),
    prompt: body.trim() || text.trim(),
    fetchedAt: Date.now(),
    rawUrl,
  };
}

/** Bulk install — fetch all entries in parallel (capped concurrency). */
export async function fetchSkillsBulk(
  entries: CatalogEntry[],
  onProgress?: (done: number, total: number, name: string) => void,
  concurrency = 6
): Promise<{ ok: FetchedSkill[]; failed: { entry: CatalogEntry; error: string }[] }> {
  const ok: FetchedSkill[] = [];
  const failed: { entry: CatalogEntry; error: string }[] = [];
  let i = 0; let done = 0;
  const installable = entries.filter((e) => e.kind !== "collection" && e.rawUrl);
  async function worker() {
    while (i < installable.length) {
      const idx = i++;
      const e = installable[idx];
      try {
        const sk = await fetchSkill(e);
        ok.push(sk);
      } catch (err: any) {
        failed.push({ entry: e, error: err?.message || String(err) });
      }
      done++;
      onProgress?.(done, installable.length, e.name);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, installable.length) }, worker));
  return { ok, failed };
}

export function searchCatalog(entries: CatalogEntry[], q: string, limit = 500): CatalogEntry[] {
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

// ── LAYOUT FETCHERS ────────────────────────────────────────────────────────

async function fetchNestedSkillMd(preset: SourcePreset): Promise<CatalogEntry[]> {
  const ref = preset.ref || "HEAD";
  const root = preset.rootPath || "";
  const found: CatalogEntry[] = [];

  // Walk up to 3 levels deep looking for SKILL.md / readme.md.
  async function walk(path: string, depth: number) {
    if (depth > 3) return;
    const items = await ghContents(preset.repo, path, ref);
    if (!items) return;
    const skillFile = items.find(
      (x) => x.type === "file" && /^(skill|readme)\.md$/i.test(x.name)
    );
    if (skillFile) {
      const slug = path.split("/").filter(Boolean).pop() || preset.repo.split("/")[1];
      found.push({
        id: `${preset.id}:${path || skillFile.path}`,
        name: humanize(slug),
        description: "",
        url: skillFile.html_url,
        rawUrl: `https://raw.githubusercontent.com/${preset.repo}/${ref}/${skillFile.path}`,
        sourceId: preset.id,
        kind: "skill",
      });
      return; // don't recurse past a found skill
    }
    // recurse into subdirs (skip dotfiles & known noise)
    const subdirs = items.filter(
      (x) => x.type === "dir" && !x.name.startsWith(".") && !/^(node_modules|dist|build|tests?)$/i.test(x.name)
    );
    await Promise.all(subdirs.map((d) => walk(d.path, depth + 1)));
  }

  await walk(root, 0);
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchFlatMd(preset: SourcePreset): Promise<CatalogEntry[]> {
  const ref = preset.ref || "HEAD";
  const root = preset.rootPath || "";
  const out: CatalogEntry[] = [];

  async function walk(path: string, depth: number) {
    if (depth > 3) return;
    const items = await ghContents(preset.repo, path, ref);
    if (!items) return;
    for (const it of items) {
      if (it.type === "file" && /\.md$/i.test(it.name) && !/^(readme|contributing|changelog|license)\.md$/i.test(it.name)) {
        const slug = it.name.replace(/\.md$/i, "");
        const category = path ? path.split("/").pop() : "";
        out.push({
          id: `${preset.id}:${it.path}`,
          name: humanize(slug),
          description: category ? `[${humanize(category)}]` : "",
          url: it.html_url,
          rawUrl: `https://raw.githubusercontent.com/${preset.repo}/${ref}/${it.path}`,
          sourceId: preset.id,
          kind: "skill",
          tags: category ? [category] : [],
        });
      } else if (it.type === "dir" && !it.name.startsWith(".") && !/^(node_modules|dist|build|tests?|\.docs|\.claude-plugin)$/i.test(it.name)) {
        await walk(it.path, depth + 1);
      }
    }
  }
  await walk(root, 0);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchSkillkitCollections(preset: SourcePreset): Promise<CatalogEntry[]> {
  const r = await fetch(`https://raw.githubusercontent.com/${preset.repo}/${preset.ref || "main"}/marketplace/skills.json`);
  if (!r.ok) throw new Error(`skillkit catalog: ${r.status}`);
  const data = (await r.json()) as {
    skills: Array<{ id: string; name: string; description: string; source: string; tags?: string[]; type: string }>;
  };
  return (data.skills || []).map((s) => ({
    id: `skillkit:coll:${s.source}`,
    name: s.name,
    description: s.description || "",
    url: `https://github.com/${s.source}`,
    rawUrl: "",
    sourceId: preset.id,
    kind: "collection" as const,
    collectionRepo: s.source,
    tags: s.tags,
  }));
}

// ── helpers ────────────────────────────────────────────────────────────────

type GhItem = { name: string; path: string; type: "file" | "dir"; html_url: string };

async function ghContents(repo: string, path: string, ref: string): Promise<GhItem[] | null> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`;
  const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) return null;
  const data = await r.json();
  if (!Array.isArray(data)) return null;
  return data as GhItem[];
}

function humanize(slug: string): string {
  return slug
    .replace(/^[0-9]+[-_]/, "")
    .split(/[-_\s]/)
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
    if (!val && !indented) { nestKey = key; continue; }
    if (indented && nestKey) meta[`${nestKey}.${key}`] = val;
    else { nestKey = ""; meta[key] = val; }
  }
  return { meta, body: m[2] };
}
