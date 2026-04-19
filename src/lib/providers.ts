// Multi-provider catalog. Keys live in browser localStorage (zustand persist).
// Edge function `/chat` acts as a CORS-safe proxy that forwards the user's key + chosen provider/model.

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "deepseek"
  | "openrouter"
  | "custom";

export type ModelDef = {
  id: string;        // model id sent to the provider's API
  label: string;     // UI label
  ctx?: string;      // context window badge (e.g. "128K")
  free?: boolean;
};

export type ProviderDef = {
  id: ProviderId;
  name: string;
  color: string;            // tailwind text color class for the provider header chip
  baseUrl: string;          // OpenAI-compatible /v1 endpoint OR provider-native (Anthropic/Google handled in edge fn)
  apiStyle: "openai" | "anthropic" | "google";
  keyHint: string;          // placeholder text
  getKeyUrl: string;
  models: ModelDef[];
  custom?: boolean;
};

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    name: "OpenAI",
    color: "text-emerald-400",
    baseUrl: "https://api.openai.com/v1",
    apiStyle: "openai",
    keyHint: "sk-...",
    getKeyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini", ctx: "128K" },
      { id: "gpt-4o", label: "GPT-4o", ctx: "128K" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo", ctx: "128K" },
      { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", ctx: "16K" },
      { id: "o1-mini", label: "o1-mini", ctx: "128K" },
      { id: "gpt-5", label: "GPT-5", ctx: "200K" },
      { id: "gpt-5-mini", label: "GPT-5 Mini", ctx: "200K" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    color: "text-amber-400",
    baseUrl: "https://api.anthropic.com/v1",
    apiStyle: "anthropic",
    keyHint: "sk-ant-...",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", ctx: "200K" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", ctx: "200K" },
      { id: "claude-3-opus-latest", label: "Claude 3 Opus", ctx: "200K" },
      { id: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet", ctx: "200K" },
      { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku", ctx: "200K" },
    ],
  },
  {
    id: "google",
    name: "Google AI",
    color: "text-sky-400",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiStyle: "openai", // Google has OpenAI-compat endpoint
    keyHint: "AIza...",
    getKeyUrl: "https://aistudio.google.com/app/apikey",
    models: [
      { id: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B", ctx: "1M", free: true },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", ctx: "1M" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", ctx: "2M" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", ctx: "1M" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", ctx: "1M" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", ctx: "2M" },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    color: "text-orange-400",
    baseUrl: "https://api.mistral.ai/v1",
    apiStyle: "openai",
    keyHint: "...",
    getKeyUrl: "https://console.mistral.ai/api-keys/",
    models: [
      { id: "mistral-small-latest", label: "Mistral Small", ctx: "32K" },
      { id: "mistral-large-latest", label: "Mistral Large", ctx: "128K" },
      { id: "open-mixtral-8x7b", label: "Mixtral 8x7B", ctx: "32K" },
      { id: "open-mixtral-8x22b", label: "Mixtral 8x22B", ctx: "64K" },
      { id: "codestral-latest", label: "Codestral", ctx: "32K" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    color: "text-cyan-400",
    baseUrl: "https://api.deepseek.com/v1",
    apiStyle: "openai",
    keyHint: "sk-...",
    getKeyUrl: "https://platform.deepseek.com/api_keys",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat", ctx: "64K" },
      { id: "deepseek-reasoner", label: "DeepSeek R1", ctx: "64K" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    color: "text-pink-400",
    baseUrl: "https://openrouter.ai/api/v1",
    apiStyle: "openai",
    keyHint: "sk-or-...",
    getKeyUrl: "https://openrouter.ai/keys",
    models: [
      { id: "openrouter/auto", label: "Auto Router", ctx: "Auto" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", ctx: "128K" },
      { id: "meta-llama/llama-3.2-3b-instruct:free", label: "Llama 3.2 3B", ctx: "128K", free: true },
      { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 Free", ctx: "64K", free: true },
      { id: "cohere/command-r-plus", label: "Cohere Command R+", ctx: "128K" },
      { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B", ctx: "32K" },
      { id: "nousresearch/hermes-3-llama-3.1-405b", label: "Hermes 3 405B", ctx: "128K" },
    ],
  },
];

export type CustomProvider = {
  id: string;          // user-chosen slug, prefixed `custom:`
  name: string;
  baseUrl: string;     // must end with /v1 (OpenAI-compatible)
  apiKey: string;
  models: { id: string; label: string }[];
};

export const findProvider = (id: ProviderId | string): ProviderDef | undefined =>
  PROVIDERS.find((p) => p.id === id);

export const DEFAULT_SYSTEM_PROMPT = `You are J.A.R.V.I.S v4 — an autonomous execution agent (not a chatbot).

ABSOLUTE RULES:
1. EXECUTE, DO NOT EXPLAIN. Produce the actual artifact (code, document, plan, file, answer). Never reply with "I would do X" — just do X.
2. STRICT SKILL ADHERENCE. If a skill is active, follow its output contract literally.
3. SELF-EVAL IS MANDATORY. After every substantive output, call \`eval_response\` with honest grading. If passed=false, autopilot continues using next_action.
4. PROBLEM-SOLVING: restate goal → pick best tool → produce output → if a tool fails try ALTERNATIVE PATH (different tool, http_fetch, run_js) → never stop on first error → at least 2 alt attempts → finish with eval_response.
5. USE TOOLS LIBERALLY. doc_save important results. write_file_artifact for deliverables. http_fetch (allowlist) for external data. gh_* tools hit real GitHub via user PAT — surface error if PAT missing. SKILL MARKETPLACE: skill_search → skill_install → skill_activate.
6. CONCISE STYLE. Match user language (Bosnian/Croatian/English). No filler, no "kao AI ja..." disclaimers.
7. CODE BLOCKS in proper triple-backtick fences with language tag.`;

export const SYSTEM_PROMPT_PRESETS: { id: string; name: string; prompt: string }[] = [
  { id: "default", name: "JARVIS Default", prompt: DEFAULT_SYSTEM_PROMPT },
  {
    id: "concise",
    name: "Concise Assistant",
    prompt: `You are a concise assistant. Answer in the minimum number of words. No preamble, no apologies, no "I think". Bullet points when listing. Code in fenced blocks. Always call eval_response after substantive output.`,
  },
  {
    id: "creative",
    name: "Creative Writer",
    prompt: `You are a creative writer. Vivid imagery, varied sentence rhythm, strong verbs. When asked for code, still deliver working code. Always call eval_response after substantive output.`,
  },
  {
    id: "code-only",
    name: "Code-Only",
    prompt: `You are a code generator. Output ONLY code in fenced blocks with language tags. No prose, no explanation, no comments outside code. If clarification needed, output a single \`// QUESTION: ...\` line in the code. Always call eval_response after.`,
  },
  {
    id: "socratic",
    name: "Socratic Tutor",
    prompt: `You are a Socratic tutor. Never give the answer directly; ask 1-2 leading questions per turn that move the user toward the solution. After 3 exchanges, summarize what they discovered. Always call eval_response after.`,
  },
  {
    id: "blunt",
    name: "Blunt Engineer",
    prompt: `You are a senior engineer. Direct, no-nonsense, call out bad ideas. Suggest the simplest solution that works. No hedging. Always call eval_response after substantive output.`,
  },
];
