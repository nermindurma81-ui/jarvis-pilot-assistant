// GOD skill — hierarchical router that orchestrates ALL installed skills.
// Layer 1: pick a category (Coding/UI/Data/Writing/PM/Research/Other)
// Layer 2: pick concrete sub-skills via skill_search/skill_run
// Layer 3: chain results with skill_chain or merge with skill_compose

import type { FetchedSkill } from "@/lib/skill-marketplace";

export const GOD_SKILL_ID = "jarvis:god";

const CATEGORY_HINTS: Record<string, string[]> = {
  Coding: ["code", "refactor", "review", "debug", "test", "lint", "ts", "py", "api", "backend", "frontend", "git", "regex"],
  UI:     ["ui", "ux", "design", "css", "tailwind", "figma", "component", "layout", "icon", "color"],
  Data:   ["data", "sql", "csv", "analyt", "chart", "viz", "etl", "pipeline", "stat", "ml", "model"],
  Writing:["write", "blog", "article", "seo", "copy", "edit", "summary", "translate", "doc"],
  PM:     ["product", "pm", "roadmap", "user story", "spec", "prd", "stakeholder", "okr", "kpi"],
  Research:["research", "search", "scrape", "crawl", "wiki", "paper", "extract", "fact"],
  Marketing:["ad", "marketing", "social", "post", "campaign", "brand", "growth"],
  Other:  [],
};

export function categorize(skill: { name: string; description?: string; id: string }): string {
  const hay = (skill.name + " " + (skill.description || "") + " " + skill.id).toLowerCase();
  let best = "Other"; let bestHits = 0;
  for (const [cat, hints] of Object.entries(CATEGORY_HINTS)) {
    let hits = 0;
    for (const h of hints) if (hay.includes(h)) hits++;
    if (hits > bestHits) { best = cat; bestHits = hits; }
  }
  return best;
}

export function buildGodSkill(installed: FetchedSkill[]): FetchedSkill {
  const byCat: Record<string, FetchedSkill[]> = {};
  for (const s of installed) {
    if (s.id === GOD_SKILL_ID) continue;
    const c = categorize(s);
    (byCat[c] ||= []).push(s);
  }
  const lines: string[] = [];
  lines.push("# 🧠 GOD SKILL — Hierarchical Skill Router");
  lines.push("");
  lines.push("You are the **GOD orchestrator** that coordinates ALL installed skills.");
  lines.push("Your job is NOT to do every task yourself — it's to **route, compose, and chain** specialized skills.");
  lines.push("");
  lines.push("## Decision protocol (apply on EVERY user request)");
  lines.push("1. Read the user request and decide the best **category** (Coding/UI/Data/Writing/PM/Research/Marketing/Other).");
  lines.push("2. Use `skill_search` (with `query=<keywords from request>`) to discover candidate sub-skills inside that category.");
  lines.push("3. Pick the top 1–3 most relevant skills. If exactly one matches → run it via `skill_run`. If multiple are relevant → use `skill_chain` (sequential) or `skill_compose` (parallel merge).");
  lines.push("4. After running, summarize what each sub-skill returned and present a unified answer.");
  lines.push("5. Only fall back to your own reasoning if NO installed skill fits.");
  lines.push("");
  lines.push("## Available categories & skill index");
  for (const cat of Object.keys(CATEGORY_HINTS)) {
    const items = byCat[cat] || [];
    if (!items.length) continue;
    lines.push(`### ${cat} (${items.length})`);
    for (const s of items.slice(0, 40)) {
      const desc = (s.description || "").slice(0, 100);
      lines.push(`- \`${s.id}\` — **${s.name}**${desc ? `: ${desc}` : ""}`);
    }
    if (items.length > 40) lines.push(`- …and ${items.length - 40} more in this category (use skill_search)`);
    lines.push("");
  }
  lines.push("## Tools you must prefer");
  lines.push("- `skill_search({ query, category? })` — find candidate sub-skills (also searches installed list).");
  lines.push("- `skill_run({ id, input })` — execute one skill against the current input.");
  lines.push("- `skill_chain({ ids: [a,b,c], input })` — pipe output of skill A → B → C.");
  lines.push("- `skill_compose({ ids: [a,b], input })` — run in parallel, merge results.");
  lines.push("- `skill_list_installed()` — full list with descriptions if you need a refresher.");
  lines.push("");
  lines.push("## Output contract");
  lines.push("Always end with a short **`### ROUTING TRACE`** section listing which sub-skills you invoked and why. Then call `eval_response` with `passed=true` if the merged answer satisfies the user, otherwise `passed=false` with `next_action` describing the missing piece.");

  const prompt = lines.join("\n");
  return {
    id: GOD_SKILL_ID,
    name: "🧠 GOD — Master Orchestrator",
    description: `Hierarchical router across ${installed.length} installed skills (${Object.keys(byCat).filter(c => byCat[c]?.length).length} categories).`,
    risk: "low",
    source: "synthetic",
    version: "1.0.0",
    prompt,
    fetchedAt: Date.now(),
    rawUrl: "",
  };
}
