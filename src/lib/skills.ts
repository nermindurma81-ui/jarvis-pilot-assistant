// JARVIS v4 — Real production skills (no mocks).
// Each skill enforces a strict execution contract via system prompt injection.

export type Skill = {
  id: string;
  name: string;
  icon: string;
  description: string;
  prompt: string;
};

export const SKILLS: Skill[] = [
  {
    id: "comic-drama",
    name: "Comic Drama",
    icon: "🎬",
    description: "8 scena + 2 transition + character lock + style lock.",
    prompt: `Output EXACTLY this structure in markdown, no preamble:

## CHARACTER LOCK
- Protagonist: <name, age, 3 visual descriptors>
- Antagonist: <name, age, 3 visual descriptors>
- Supporting: <if needed>

## STYLE LOCK
- Art style: <e.g. cinematic noir, comic-ink, anime>
- Palette: <3-5 hex>
- Camera: <lens / mood>

## SCENE 1 — <title>
**Setting:** ...
**Action:** ...
**Image prompt:** "<200-char standalone prompt with character + style lock embedded>"

(repeat for SCENES 2-8)

## TRANSITION A (between 4→5)
**Image prompt:** "<...>"

## TRANSITION B (between 7→8)
**Image prompt:** "<...>"

Then call eval_response. Criteria: 8 scenes present, 2 transitions present, character+style lock embedded in every prompt.`,
  },
  {
    id: "ai-ppt",
    name: "AI PPT",
    icon: "📊",
    description: "Hero + per-slide promptovi + paleta + alt text.",
    prompt: `Produce a presentation deck. Output ONLY this structure:

## DECK META
- Title: ...
- Audience: ...
- Tone: ...
- Palette: <3 hex with names>

## HERO SLIDE
- Headline: ...
- Subhead: ...
- **Image prompt:** "..."
- **Alt text:** "..."

## SLIDE 2..N (8-12 slides)
### Slide N — <title>
- Bullet 1, 2, 3 (max 8 words each)
- Speaker note: <1 sentence>
- **Image prompt:** "..."
- **Alt text:** "..."

## CTA SLIDE
- Action: ...
- **Image prompt:** "..."

Then call eval_response. Criteria: hero present, 8-12 content slides, every slide has image prompt + alt text, palette respected.`,
  },
  {
    id: "ai-seo",
    name: "AI SEO Article",
    icon: "🔎",
    description: "Cover + inline + social images, SEO slugovi + meta.",
    prompt: `Produce a fully SEO-optimized article. Output structure:

## SEO META
- Title (≤60 chars): ...
- Slug: ...
- Meta description (≤155 chars): ...
- Primary keyword: ...
- Secondary keywords: 3-5 list
- JSON-LD Article schema: \`\`\`json {...} \`\`\`

## COVER IMAGE
- **Prompt:** "..."  **Alt:** "..."

## ARTICLE (markdown, 800-1500 words)
# H1 (contains primary keyword)
## H2 sections (3-5)
- Inline image after each H2 with prompt + alt.

## SOCIAL CARDS
- Twitter (image prompt + 280-char copy)
- LinkedIn (image prompt + 600-char copy)

Then call eval_response. Criteria: meta complete, H1+3-5 H2, inline images per H2, social cards, JSON-LD valid.`,
  },
  {
    id: "curated-prompts",
    name: "Curated Prompts",
    icon: "🎨",
    description: "5+ kategorisanih production-ready promptova.",
    prompt: `Produce a curated prompt pack. Output ONLY this:

## PACK: <topic>
For EACH of these 5 categories, give ONE production-ready prompt (200-400 chars, includes style/lighting/camera/mood):
1. **Hero / Cinematic**
2. **Product Macro**
3. **Editorial Portrait**
4. **Architectural / Environment**
5. **Abstract / Conceptual**

Each prompt block:
\`\`\`
<full prompt>
--- Negative: <negative prompt>
--- Aspect: 16:9 / 1:1 / 9:16 (pick best)
\`\`\`

Then call eval_response. Criteria: 5 categories, each prompt 200-400 chars, includes negative+aspect.`,
  },
  {
    id: "code-refactor",
    name: "Code Refactor",
    icon: "⚙️",
    description: "Analiza + diff + refactored full file + testovi.",
    prompt: `When user gives code, output ONLY:

## ANALYSIS
- Issues found (bullets, ≤5)
- Refactor strategy (1 paragraph)

## REFACTORED CODE
\`\`\`<lang>
<full refactored file>
\`\`\`

## DIFF SUMMARY
- What changed (3-7 bullets)

## TESTS
\`\`\`<lang>
<2-4 unit tests covering refactor>
\`\`\`

Then call eval_response. Criteria: full file (not snippet), tests present, analysis ≤5 issues.`,
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    icon: "📈",
    description: "Insights + charts spec + SQL/code + actions.",
    prompt: `When user gives data (CSV/JSON/text), output ONLY:

## DATASET PROFILE
- Rows: ... | Columns: ... | Types: ...
- Quality issues: ...

## TOP 5 INSIGHTS
1. <insight> — supporting numbers
2. ...

## CHART SPECS
For each insight worth visualizing:
\`\`\`json
{ "type":"bar|line|pie", "x":"col", "y":"col", "title":"..." }
\`\`\`

## SQL / CODE
\`\`\`sql
-- query that proves insight #1
\`\`\`

## RECOMMENDED ACTIONS
- 3 prioritized actions

Then call eval_response. Criteria: profile complete, exactly 5 insights, ≥1 chart spec, ≥1 SQL/code block.`,
  },
];

// Resolve a skill by id from BOTH built-ins AND installed marketplace skills.
// Imported lazily here to avoid a circular dep with the store.
export const skillById = (id: string | null): Skill | null => {
  if (!id) return null;
  const builtin = SKILLS.find((s) => s.id === id);
  if (builtin) return builtin;
  // Marketplace lookup — defer require so this module stays sync-importable.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useJarvis } = require("@/store/jarvis");
    const inst = useJarvis.getState().installedSkills.find((s: any) => s.id === id);
    if (inst) {
      return {
        id: inst.id,
        name: inst.name,
        icon: "🧩",
        description: inst.description || "Marketplace skill",
        prompt: inst.prompt,
      };
    }
  } catch {}
  return null;
};
