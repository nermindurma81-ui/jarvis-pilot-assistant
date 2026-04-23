// Client-side tool dispatcher. Runs tool_calls returned by the model.
import { useJarvis } from "@/store/jarvis";
import { fetchCatalog, fetchCollectionSkills, fetchSkill, searchCatalog, SOURCE_PRESETS, presetFromCustomRepo, type CatalogEntry } from "@/lib/skill-marketplace";
import { runSkill } from "@/lib/skill-runner";
import { buildGodSkill, categorize, GOD_SKILL_ID } from "@/lib/god-skill";
import { pushSkillsBulk, pullAllSkills, pushMessage } from "@/lib/sync";
import { showLocalNotification } from "@/lib/push-notify";

export type ToolResult = { ok: boolean; result?: any; error?: string };

const ALLOW_HOST = (url: string, allowlist: string[]) => {
  try {
    const h = new URL(url).hostname;
    return allowlist.some((a) => h === a || h.endsWith("." + a));
  } catch {
    return false;
  }
};

export async function executeTool(name: string, argsJson: string): Promise<ToolResult> {
  let args: any = {};
  try {
    args = JSON.parse(argsJson || "{}");
  } catch {
    return { ok: false, error: "Invalid JSON arguments" };
  }
  const s = useJarvis.getState();

  try {
    switch (name) {
      case "eval_response": {
        return {
          ok: true,
          result: {
            ...args,
            received: true,
            note: args.passed
              ? "Eval passed. Loop may stop."
              : "Eval failed — autopilot will continue with next_action.",
          },
        };
      }

      case "doc_save": {
        if (!args.name || typeof args.content !== "string") return { ok: false, error: "name+content required" };
        s.saveDoc({ name: args.name, content: args.content, tags: args.tags });
        return { ok: true, result: { saved: args.name, bytes: args.content.length } };
      }
      case "doc_list":
        return { ok: true, result: s.docs.map((d) => ({ name: d.name, tags: d.tags, ts: d.ts, bytes: d.content.length })) };
      case "doc_get": {
        const d = s.docs.find((x) => x.name === args.name);
        return d ? { ok: true, result: d } : { ok: false, error: "not found" };
      }
      case "doc_delete":
        s.deleteDoc(args.name);
        return { ok: true, result: { deleted: args.name } };
      case "doc_export": {
        const d = s.docs.find((x) => x.name === args.name);
        if (!d) return { ok: false, error: "not found" };
        const fmt = args.format || "txt";
        const content = fmt === "json" ? JSON.stringify(d, null, 2) : d.content;
        downloadFile(`${d.name}.${fmt}`, content, fmt === "json" ? "application/json" : "text/plain");
        return { ok: true, result: { exported: `${d.name}.${fmt}` } };
      }

      case "audit_status":
        return {
          ok: true,
          result: {
            ...s.audit,
            autopilot: s.autopilot,
            evalRequired: s.evalRequired,
            androidBridge: !!(window as any).AndroidBridge,
          },
        };

      case "http_fetch": {
        if (!args.url) return { ok: false, error: "url required" };
        if (!ALLOW_HOST(args.url, s.audit.allowlist))
          return { ok: false, error: `Host not in allowlist. Add it via terminal: audit host add <hostname>` };
        const r = await fetch(args.url, {
          method: args.method || "GET",
          headers: args.headers || {},
          body: args.body,
        });
        const text = await r.text();
        return { ok: true, result: { status: r.status, body: text.slice(0, 50_000) } };
      }

      case "write_file_artifact": {
        if (!args.filename || typeof args.content !== "string")
          return { ok: false, error: "filename+content required" };
        const bridge = (window as any).AndroidBridge;
        if (bridge?.saveFile) {
          try {
            bridge.saveFile(args.filename, args.content);
            return { ok: true, result: { saved: args.filename, via: "AndroidBridge" } };
          } catch {}
        }
        downloadFile(args.filename, args.content, args.mime || "text/plain");
        return { ok: true, result: { saved: args.filename, via: "browser-download" } };
      }

      case "run_js": {
        if (!args.code) return { ok: false, error: "code required" };
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function(`"use strict"; return (async()=>{ ${args.code} })()`);
          const out = await fn();
          return { ok: true, result: typeof out === "object" ? out : { value: out } };
        } catch (e: any) {
          return { ok: false, error: e.message };
        }
      }

      case "list_uploads":
        return { ok: true, result: s.uploads.map((u) => ({ name: u.name, size: u.size, type: u.type })) };
      case "read_upload": {
        const u = s.uploads.find((x) => x.name === args.name);
        if (!u) return { ok: false, error: "upload not found" };
        if (u.textPreview) return { ok: true, result: { name: u.name, content: u.textPreview } };
        try {
          const r = await fetch(u.url);
          const ct = r.headers.get("content-type") || "";
          if (/^(text\/|application\/(json|xml|javascript|x-yaml))/.test(ct) || /\.(txt|md|json|csv|tsv|js|ts|tsx|jsx|py|html|css|xml|yml|yaml|log)$/i.test(u.name)) {
            const text = await r.text();
            return { ok: true, result: { name: u.name, content: text.slice(0, 100_000) } };
          }
          return { ok: true, result: { name: u.name, type: u.type, size: u.size, note: "Binary file — URL only.", url: u.url } };
        } catch (e: any) {
          return { ok: false, error: e.message };
        }
      }


      // ─── GitHub real REST API tools (PAT-based, single-user) ───
      case "gh_status": {
        const g = s.github;
        return {
          ok: true,
          result: {
            authenticated: !!g?.token,
            user: g?.user || null,
            defaultRepo: g?.defaultRepo || null,
            tokenScopes: g?.token ? "(check via 'curl -I https://api.github.com -H \"Authorization: Bearer $TOKEN\"' for X-OAuth-Scopes)" : null,
          },
        };
      }

      case "gh_create_issue": {
        const g = s.github;
        if (!g?.token) return { ok: false, error: "No GitHub PAT. Open Settings → GitHub and paste a token with 'repo' scope." };
        const { owner, repo } = resolveRepo(args, g);
        if (!owner || !repo) return { ok: false, error: "owner+repo required (or set defaultRepo in Settings)." };
        if (!args.title || !args.body) return { ok: false, error: "title+body required" };
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          method: "POST",
          headers: ghHeaders(g.token),
          body: JSON.stringify({ title: args.title, body: args.body, labels: args.labels }),
        });
        const data = await r.json();
        if (!r.ok) return { ok: false, error: `GitHub ${r.status}: ${data.message || JSON.stringify(data)}` };
        return { ok: true, result: { number: data.number, url: data.html_url, state: data.state } };
      }

      case "gh_create_pr": {
        const g = s.github;
        if (!g?.token) return { ok: false, error: "No GitHub PAT configured." };
        const { owner, repo } = resolveRepo(args, g);
        if (!owner || !repo) return { ok: false, error: "owner+repo required" };
        if (!args.title || !args.head) return { ok: false, error: "title+head required" };
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
          method: "POST",
          headers: ghHeaders(g.token),
          body: JSON.stringify({
            title: args.title,
            body: args.body || "",
            head: args.head,
            base: args.base || "main",
            draft: !!args.draft,
          }),
        });
        const data = await r.json();
        if (!r.ok) return { ok: false, error: `GitHub ${r.status}: ${data.message || JSON.stringify(data)}` };
        return { ok: true, result: { number: data.number, url: data.html_url, state: data.state, draft: data.draft } };
      }

      case "gh_workflow_dispatch": {
        const g = s.github;
        if (!g?.token) return { ok: false, error: "No GitHub PAT configured." };
        const { owner, repo } = resolveRepo(args, g);
        if (!owner || !repo) return { ok: false, error: "owner+repo required" };
        if (!args.workflow_id) return { ok: false, error: "workflow_id required (e.g. 'ci.yml')" };
        const r = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(args.workflow_id)}/dispatches`,
          {
            method: "POST",
            headers: ghHeaders(g.token),
            body: JSON.stringify({ ref: args.ref || "main", inputs: args.inputs || {} }),
          }
        );
        if (r.status === 204) return { ok: true, result: { dispatched: true, workflow_id: args.workflow_id, ref: args.ref || "main" } };
        const data = await r.json().catch(() => ({}));
        return { ok: false, error: `GitHub ${r.status}: ${data.message || "dispatch failed"}` };
      }

      // ─── Skill marketplace (multi-source) ───
      case "skill_search": {
        const q = (args.query || "").toLowerCase();
        const scope = args.scope || "marketplace";
        // Installed scope: search across already-installed skills (used by GOD router).
        if (scope === "installed") {
          const cat = (args.category || "").toLowerCase();
          const hits = s.installedSkills.filter((sk) => {
            const hay = `${sk.id} ${sk.name} ${sk.description || ""}`.toLowerCase();
            const matchQ = !q || hay.includes(q);
            const matchC = !cat || categorize(sk).toLowerCase() === cat;
            return matchQ && matchC;
          }).slice(0, args.limit || 30);
          return { ok: true, result: { scope: "installed", total: s.installedSkills.length, shown: hits.length, results: hits.map((h) => ({ id: h.id, name: h.name, description: h.description, category: categorize(h) })) } };
        }
        const sourceId = String(args.source || "antigravity");
        const preset =
          SOURCE_PRESETS.find((p) => p.id === sourceId) ||
          (sourceId.startsWith("custom:") || sourceId.includes("/") ? presetFromCustomRepo(sourceId.replace(/^custom:/, "")) : SOURCE_PRESETS[0]);
        const catalog = await fetchCatalog(preset, !!args.refresh);
        let entries: CatalogEntry[] = catalog;
        if (preset.id === "skillkit" && args.collection) {
          entries = await fetchCollectionSkills(args.collection);
        }
        const hits = searchCatalog(entries, args.query || "", args.limit || 30);
        return {
          ok: true,
          result: {
            source: preset.id,
            total: entries.length,
            shown: hits.length,
            query: args.query || "",
            results: hits.map((h) => ({
              id: h.id, name: h.name, url: h.url, kind: h.kind,
              collectionRepo: h.collectionRepo,
            })),
          },
        };
      }
      case "skill_install": {
        if (!args.id) return { ok: false, error: "id required (use skill_search to find one)" };
        // Reconstruct a minimal CatalogEntry from id. id formats:
        //   "antigravity:<slug>"  OR  "skillkit:<owner>/<repo>:<path>"  OR  "skillkit:coll:<owner>/<repo>"
        const entry = await resolveEntryFromId(args.id);
        if (!entry) return { ok: false, error: `Unknown skill id: ${args.id}` };
        if (entry.kind === "collection") {
          return { ok: false, error: "That id is a collection. Call skill_search with collection='<owner>/<repo>' to list its skills, then install one." };
        }
        const sk = await fetchSkill(entry);
        s.installSkill(sk);
        return {
          ok: true,
          result: {
            installed: sk.id, name: sk.name, description: sk.description,
            risk: sk.risk, promptBytes: sk.prompt.length,
          },
        };
      }
      case "skill_uninstall": {
        if (!args.id) return { ok: false, error: "id required" };
        s.uninstallSkill(args.id);
        return { ok: true, result: { uninstalled: args.id } };
      }
      case "skill_activate": {
        if (!args.id) return { ok: false, error: "id required" };
        const installed = s.installedSkills.find((x) => x.id === args.id);
        if (!installed) return { ok: false, error: `Skill '${args.id}' not installed. Call skill_install first.` };
        s.setActiveSkill(args.id);
        return { ok: true, result: { active: args.id, name: installed.name } };
      }
      case "skill_deactivate": {
        s.setActiveSkill(null);
        return { ok: true, result: { active: null } };
      }
      case "skill_list_installed": {
        return {
          ok: true,
          result: s.installedSkills.map((x) => ({
            id: x.id, name: x.name, description: x.description, risk: x.risk,
            category: categorize(x),
          })),
        };
      }

      // ─── GOD skill orchestration ───
      case "skill_run": {
        if (!args.id || typeof args.input !== "string") return { ok: false, error: "id+input required" };
        const sk = s.installedSkills.find((x) => x.id === args.id);
        if (!sk) return { ok: false, error: `Skill not installed: ${args.id}` };
        const out = await runSkill(sk.prompt, args.input);
        return { ok: true, result: { skill: sk.id, output: out } };
      }
      case "skill_chain": {
        const ids: string[] = Array.isArray(args.ids) ? args.ids : [];
        if (!ids.length || typeof args.input !== "string") return { ok: false, error: "ids[]+input required" };
        const trace: any[] = [];
        let current = args.input;
        for (const id of ids) {
          const sk = s.installedSkills.find((x) => x.id === id);
          if (!sk) { trace.push({ id, error: "not installed" }); continue; }
          try {
            const out = await runSkill(sk.prompt, current);
            trace.push({ id, name: sk.name, output: out.slice(0, 4000) });
            current = out;
          } catch (e: any) { trace.push({ id, error: e.message }); }
        }
        return { ok: true, result: { final: current, trace } };
      }
      case "skill_compose": {
        const ids: string[] = Array.isArray(args.ids) ? args.ids : [];
        if (!ids.length || typeof args.input !== "string") return { ok: false, error: "ids[]+input required" };
        const settled = await Promise.all(ids.map(async (id) => {
          const sk = s.installedSkills.find((x) => x.id === id);
          if (!sk) return { id, error: "not installed" };
          try { return { id, name: sk.name, output: await runSkill(sk.prompt, args.input) }; }
          catch (e: any) { return { id, error: e.message }; }
        }));
        return { ok: true, result: { outputs: settled } };
      }
      case "skill_god_rebuild": {
        const god = buildGodSkill(s.installedSkills.filter((x) => x.id !== GOD_SKILL_ID));
        s.installSkill(god);
        return { ok: true, result: { id: god.id, indexed: s.installedSkills.length, description: god.description } };
      }

      // ─── Uploads / Sync / Push ───
      case "upload_get_url": {
        const u = s.uploads.find((x) => x.name === args.name);
        if (!u) return { ok: false, error: "upload not found" };
        return { ok: true, result: { name: u.name, url: u.url, size: u.size, type: u.type } };
      }
      case "sync_push": {
        const skills = s.installedSkills;
        await pushSkillsBulk(skills);
        await Promise.all(s.messages.slice(-50).map((m) => pushMessage(m)));
        return { ok: true, result: { pushedSkills: skills.length, pushedMessages: Math.min(s.messages.length, 50) } };
      }
      case "sync_pull": {
        const remote = await pullAllSkills();
        if (remote.length) await s.installSkillsBulk(remote);
        return { ok: true, result: { pulled: remote.length } };
      }
      case "push_notify": {
        if (!args.title || !args.body) return { ok: false, error: "title+body required" };
        await showLocalNotification(args.title, args.body);
        return { ok: true, result: { delivered: true } };
      }

      case "web_search": {
        if (!args.query) return { ok: false, error: "query required" };
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ query: args.query, limit: args.limit || 6 }),
        });
        const data = await r.json();
        if (!r.ok) return { ok: false, error: data.error || `web_search ${r.status}` };
        return { ok: true, result: data };
      }
      case "web_fetch": {
        if (!args.url) return { ok: false, error: "url required" };
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ fetchUrl: args.url }),
        });
        const data = await r.json();
        if (!r.ok) return { ok: false, error: data.error || `web_fetch ${r.status}` };
        return { ok: true, result: data };
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e: any) {
    return { ok: false, error: e.message || String(e) };
  }
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ghHeaders(token: string) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function resolveRepo(args: any, g: NonNullable<ReturnType<typeof useJarvis.getState>["github"]>) {
  let owner = args.owner as string | undefined;
  let repo = args.repo as string | undefined;
  if ((!owner || !repo) && g?.defaultRepo?.includes("/")) {
    const [o, r] = g.defaultRepo.split("/");
    owner = owner || o;
    repo = repo || r;
  }
  return { owner, repo };
}

// Resolve a CatalogEntry from a stable id by re-walking its preset's catalog.
async function resolveEntryFromId(id: string): Promise<CatalogEntry | null> {
  // skillkit collection-derived skill
  if (id.startsWith("skillkit:coll:")) {
    const repo = id.slice("skillkit:coll:".length);
    return {
      id, sourceId: "skillkit", kind: "collection", collectionRepo: repo,
      name: repo, description: "",
      url: `https://github.com/${repo}`, rawUrl: "",
    };
  }
  if (id.startsWith("skillkit:")) {
    const rest = id.slice("skillkit:".length);
    const colonIdx = rest.indexOf(":");
    if (colonIdx < 0) return null;
    const repo = rest.slice(0, colonIdx);
    const path = rest.slice(colonIdx + 1);
    return {
      id, sourceId: "skillkit", kind: "skill", collectionRepo: repo,
      name: path.split("/").pop() || path, description: "",
      url: `https://github.com/${repo}/tree/HEAD/${path}`,
      rawUrl: `https://raw.githubusercontent.com/${repo}/HEAD/${path}/SKILL.md`,
    };
  }
  // Otherwise: id is "<presetId>:<path>". Look up the preset and refetch its catalog.
  const colon = id.indexOf(":");
  if (colon < 0) return null;
  const presetId = id.slice(0, colon);
  const preset =
    SOURCE_PRESETS.find((p) => p.id === presetId) ||
    (presetId.startsWith("custom") ? null : null);
  if (!preset) return null;
  const cat = await fetchCatalog(preset);
  return cat.find((e) => e.id === id) || null;
}

export async function ghVerifyToken(token: string): Promise<{ login: string; scopes: string[] } | null> {
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const scopes = (r.headers.get("x-oauth-scopes") || "").split(",").map((s) => s.trim()).filter(Boolean);
    return { login: data.login, scopes };
  } catch {
    return null;
  }
}
