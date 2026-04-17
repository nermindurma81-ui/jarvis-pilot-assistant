// CLI cheatsheet for major providers — copyable commands.
export type ProviderCli = {
  id: string;
  name: string;
  install: string;
  login: string;
  commands: { label: string; cmd: string }[];
};

export const PROVIDERS: ProviderCli[] = [
  {
    id: "lovable",
    name: "Lovable",
    install: "# Lovable je web platforma — nema lokalni CLI, koristi GitHub export.",
    login: "# Login je preko web aplikacije: https://lovable.dev",
    commands: [
      { label: "Export to GitHub", cmd: "# U Lovable UI: GitHub → Connect → Push" },
      { label: "Pull export lokalno", cmd: "git clone https://github.com/<user>/<repo>.git && cd <repo> && npm install" },
      { label: "Run dev", cmd: "npm run dev" },
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    install: "npm i -g supabase",
    login: "supabase login",
    commands: [
      { label: "Init projekt", cmd: "supabase init" },
      { label: "Link na remote", cmd: "supabase link --project-ref <ref>" },
      { label: "DB push migracija", cmd: "supabase db push" },
      { label: "Deploy edge function", cmd: "supabase functions deploy <name>" },
      { label: "Set secret", cmd: "supabase secrets set KEY=value" },
      { label: "Logs (functions)", cmd: "supabase functions logs <name> --tail" },
    ],
  },
  {
    id: "github",
    name: "GitHub (gh)",
    install: "# macOS: brew install gh   |  Linux: see https://cli.github.com",
    login: "gh auth login",
    commands: [
      { label: "Create repo", cmd: "gh repo create <name> --public --source=. --push" },
      { label: "Open PR", cmd: 'gh pr create --fill' },
      { label: "Issue create", cmd: 'gh issue create -t "title" -b "body"' },
      { label: "Workflow run", cmd: "gh workflow run <file.yml>" },
      { label: "Release", cmd: 'gh release create v1.0.0 --notes "notes"' },
    ],
  },
  {
    id: "vercel",
    name: "Vercel",
    install: "npm i -g vercel",
    login: "vercel login",
    commands: [
      { label: "Link", cmd: "vercel link" },
      { label: "Deploy preview", cmd: "vercel" },
      { label: "Deploy prod", cmd: "vercel --prod" },
      { label: "Env add", cmd: "vercel env add <NAME> production" },
      { label: "Logs", cmd: "vercel logs <deployment-url>" },
    ],
  },
  {
    id: "netlify",
    name: "Netlify",
    install: "npm i -g netlify-cli",
    login: "netlify login",
    commands: [
      { label: "Init", cmd: "netlify init" },
      { label: "Deploy preview", cmd: "netlify deploy" },
      { label: "Deploy prod", cmd: "netlify deploy --prod" },
      { label: "Functions invoke", cmd: "netlify functions:invoke <name>" },
      { label: "Env set", cmd: "netlify env:set KEY value" },
    ],
  },
  {
    id: "railway",
    name: "Railway",
    install: "npm i -g @railway/cli",
    login: "railway login",
    commands: [
      { label: "Init", cmd: "railway init" },
      { label: "Up (deploy)", cmd: "railway up" },
      { label: "Logs", cmd: "railway logs" },
      { label: "Var set", cmd: "railway variables set KEY=value" },
      { label: "Run lokalno sa varovima", cmd: "railway run npm start" },
    ],
  },
  {
    id: "fly",
    name: "Fly.io",
    install: "curl -L https://fly.io/install.sh | sh",
    login: "fly auth login",
    commands: [
      { label: "Launch", cmd: "fly launch" },
      { label: "Deploy", cmd: "fly deploy" },
      { label: "Logs", cmd: "fly logs" },
      { label: "Secrets", cmd: "fly secrets set KEY=value" },
      { label: "SSH", cmd: "fly ssh console" },
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare (wrangler)",
    install: "npm i -g wrangler",
    login: "wrangler login",
    commands: [
      { label: "Init worker", cmd: "wrangler init <name>" },
      { label: "Deploy", cmd: "wrangler deploy" },
      { label: "Tail logs", cmd: "wrangler tail" },
      { label: "Secret put", cmd: "wrangler secret put KEY" },
      { label: "Pages deploy", cmd: "wrangler pages deploy ./dist" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    install: "pip install openai   # Python\\nnpm i openai          # Node",
    login: "export OPENAI_API_KEY=sk-...",
    commands: [
      { label: "Chat (curl)", cmd: 'curl https://api.openai.com/v1/chat/completions -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" -d \'{"model":"gpt-5","messages":[{"role":"user","content":"Hi"}]}\'' },
      { label: "List models", cmd: 'curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"' },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    install: "pip install google-generativeai   # Python\\nnpm i @google/generative-ai      # Node",
    login: "export GEMINI_API_KEY=...",
    commands: [
      { label: "Generate (curl)", cmd: 'curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY" -H "Content-Type: application/json" -d \'{"contents":[{"parts":[{"text":"Hi"}]}]}\'' },
    ],
  },
  {
    id: "lovable-ai",
    name: "Lovable AI Gateway",
    install: "# No CLI — koristi se preko edge funkcija u Lovable Cloud-u.",
    login: "# Auto-provisioned LOVABLE_API_KEY u Cloud secrets.",
    commands: [
      { label: "Endpoint", cmd: "https://ai.gateway.lovable.dev/v1/chat/completions" },
      { label: "Curl test", cmd: 'curl https://ai.gateway.lovable.dev/v1/chat/completions -H "Authorization: Bearer $LOVABLE_API_KEY" -H "Content-Type: application/json" -d \'{"model":"google/gemini-3-flash-preview","messages":[{"role":"user","content":"Hi"}]}\'' },
    ],
  },
  {
    id: "docker",
    name: "Docker",
    install: "# https://docs.docker.com/get-docker/",
    login: "docker login",
    commands: [
      { label: "Build", cmd: "docker build -t <name> ." },
      { label: "Run", cmd: "docker run -p 3000:3000 <name>" },
      { label: "Push", cmd: "docker push <user>/<name>:tag" },
      { label: "Compose up", cmd: "docker compose up -d" },
    ],
  },
];
