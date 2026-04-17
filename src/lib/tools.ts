// Client-side tool dispatcher. Runs tool_calls returned by the model.
import { useJarvis } from "@/store/jarvis";

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
