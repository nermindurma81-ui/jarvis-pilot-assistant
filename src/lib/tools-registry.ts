// Central tool registry. Drives the Tools Panel UI and lets the user
// enable/disable individual tools (the chat edge function will only
// receive the enabled ones).
export type ToolMeta = {
  name: string;
  category: "core" | "docs" | "web" | "github" | "skills" | "uploads" | "sync" | "agent";
  description: string;
  risk: "safe" | "medium" | "high";
};

export const TOOL_REGISTRY: ToolMeta[] = [
  // agent
  { name: "eval_response", category: "agent", description: "Self-evaluate the current response against the user goal.", risk: "safe" },
  { name: "run_js", category: "core", description: "Execute sandboxed JavaScript in the browser.", risk: "high" },
  { name: "write_file_artifact", category: "core", description: "Produce a downloadable file artifact.", risk: "safe" },
  { name: "http_fetch", category: "web", description: "Fetch any URL on the audit allowlist.", risk: "medium" },
  { name: "web_search", category: "web", description: "Free internet search (DuckDuckGo) — returns title/url/snippet.", risk: "safe" },
  { name: "web_fetch", category: "web", description: "Fetch a webpage and return cleaned text content.", risk: "safe" },
  // docs
  { name: "doc_save", category: "docs", description: "Save a Jarvis document.", risk: "safe" },
  { name: "doc_list", category: "docs", description: "List stored documents.", risk: "safe" },
  { name: "doc_get", category: "docs", description: "Read a document.", risk: "safe" },
  { name: "doc_delete", category: "docs", description: "Delete a document.", risk: "safe" },
  { name: "doc_export", category: "docs", description: "Export a document as a download.", risk: "safe" },
  { name: "audit_status", category: "core", description: "Return audit/allowlist flags.", risk: "safe" },
  // github
  { name: "gh_status", category: "github", description: "GitHub auth status.", risk: "safe" },
  { name: "gh_create_issue", category: "github", description: "Create a GitHub issue (PAT required).", risk: "medium" },
  { name: "gh_create_pr", category: "github", description: "Create a GitHub PR.", risk: "medium" },
  { name: "gh_workflow_dispatch", category: "github", description: "Trigger a GitHub Actions workflow.", risk: "high" },
  // skills
  { name: "skill_search", category: "skills", description: "Search marketplace or installed skills.", risk: "safe" },
  { name: "skill_install", category: "skills", description: "Install a marketplace skill.", risk: "safe" },
  { name: "skill_uninstall", category: "skills", description: "Uninstall a skill.", risk: "safe" },
  { name: "skill_activate", category: "skills", description: "Set a skill as active.", risk: "safe" },
  { name: "skill_deactivate", category: "skills", description: "Clear active skill.", risk: "safe" },
  { name: "skill_list_installed", category: "skills", description: "List installed skills.", risk: "safe" },
  { name: "skill_run", category: "skills", description: "Run ONE skill against an input.", risk: "safe" },
  { name: "skill_chain", category: "skills", description: "Chain skills sequentially (A → B → C).", risk: "safe" },
  { name: "skill_compose", category: "skills", description: "Run skills in PARALLEL on the same input.", risk: "safe" },
  { name: "skill_god_rebuild", category: "skills", description: "Rebuild the GOD meta-skill.", risk: "safe" },
  // uploads / sync
  { name: "list_uploads", category: "uploads", description: "List uploaded files.", risk: "safe" },
  { name: "read_upload", category: "uploads", description: "Read text from an uploaded file.", risk: "safe" },
  { name: "upload_get_url", category: "uploads", description: "Get the public URL of an upload.", risk: "safe" },
  { name: "sync_push", category: "sync", description: "Push skills + chat to cloud.", risk: "safe" },
  { name: "sync_pull", category: "sync", description: "Pull skills from cloud.", risk: "safe" },
  { name: "push_notify", category: "sync", description: "Show a local/web push notification.", risk: "safe" },
];

export const TOOL_CATEGORIES: { id: ToolMeta["category"]; label: string }[] = [
  { id: "agent", label: "Agent" },
  { id: "core", label: "Core" },
  { id: "web", label: "Web" },
  { id: "docs", label: "Docs" },
  { id: "github", label: "GitHub" },
  { id: "skills", label: "Skills" },
  { id: "uploads", label: "Uploads" },
  { id: "sync", label: "Sync & Push" },
];
