import { useState, KeyboardEvent } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useJarvis } from "@/store/jarvis";
import { SKILLS } from "@/lib/skills";
import { toast } from "sonner";

type Line = { kind: "in" | "out" | "err"; text: string };

type Props = { open: boolean; onOpenChange: (b: boolean) => void };

export const TerminalSheet = ({ open, onOpenChange }: Props) => {
  const [history, setHistory] = useState<Line[]>([
    { kind: "out", text: "JARVIS terminal v4 — type `help`" },
  ]);
  const [input, setInput] = useState("");
  const s = useJarvis();

  const print = (kind: Line["kind"], text: string) => setHistory((h) => [...h, { kind, text }]);

  const exec = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    print("in", `$ ${cmd}`);
    const [head, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");

    try {
      switch (head) {
        case "help":
          print("out",
`Commands:
  help                          show this
  clear                         clear terminal
  status                        show audit + autopilot
  autopilot on|off              toggle autopilot
  eval on|off                   toggle evalRequired
  audit repo on|off             toggle audit.repoWrite
  audit workflow on|off         toggle audit.workflowDispatch
  audit host add|rm <hostname>  modify allowlist
  skill list                    list available skills
  skill <id>                    activate skill
  skill off                     deactivate
  docs                          list saved jarvis-docs
  doc rm <name>                 delete a doc
  uploads                       list session uploads
  reset chat                    clear chat history
  model <id>                    set model
`);
          break;
        case "clear":
          setHistory([]); break;
        case "status":
          print("out", JSON.stringify({
            model: s.model, autopilot: s.autopilot, evalRequired: s.evalRequired,
            activeSkill: s.activeSkill, audit: s.audit,
            androidBridge: !!(window as any).AndroidBridge,
            uploads: s.uploads.length, docs: s.docs.length, queue: s.msgQueue.length,
            github: s.github ? { user: s.github.user, defaultRepo: s.github.defaultRepo, hasToken: true } : null,
          }, null, 2));
          break;
        case "gh": {
          const sub = rest[0];
          if (sub === "status") {
            print("out", s.github ? `signed in as ${s.github.user}, defaultRepo=${s.github.defaultRepo || "(none)"}` : "not signed in (Settings → GitHub)");
          } else if (sub === "signout") {
            s.setGithub(null); print("out", "signed out");
          } else if (sub === "repo" && rest[1]) {
            if (!s.github) print("err", "sign in first (Settings → GitHub)");
            else { s.setGithub({ ...s.github, defaultRepo: rest[1] }); print("out", `defaultRepo=${rest[1]}`); }
          } else {
            print("out", "usage: gh status | gh repo <owner/repo> | gh signout");
          }
          break;
        }
        case "autopilot":
          if (rest[0] === "on") { s.setAutopilot(true); print("out", "autopilot ON"); }
          else if (rest[0] === "off") { s.setAutopilot(false); print("out", "autopilot OFF"); }
          else print("err", "usage: autopilot on|off");
          break;
        case "eval":
          if (rest[0] === "on") { s.setEvalRequired(true); print("out", "eval required ON"); }
          else if (rest[0] === "off") { s.setEvalRequired(false); print("out", "eval required OFF"); }
          else print("err", "usage: eval on|off");
          break;
        case "audit": {
          const sub = rest[0];
          if (sub === "repo") {
            const v = rest[1] === "on";
            s.setAudit({ repoWrite: v }); print("out", `audit.repoWrite=${v}`);
          } else if (sub === "workflow") {
            const v = rest[1] === "on";
            s.setAudit({ workflowDispatch: v }); print("out", `audit.workflowDispatch=${v}`);
          } else if (sub === "host") {
            if (rest[1] === "add" && rest[2]) { s.addAllowlist(rest[2]); print("out", `+ ${rest[2]}`); }
            else if (rest[1] === "rm" && rest[2]) { s.removeAllowlist(rest[2]); print("out", `- ${rest[2]}`); }
            else print("err", "usage: audit host add|rm <hostname>");
          } else print("err", "usage: audit repo|workflow|host …");
          break;
        }
        case "skill":
          if (rest[0] === "list" || !rest[0]) {
            print("out", SKILLS.map((sk) => `  ${sk.icon} ${sk.id.padEnd(18)} ${sk.name}`).join("\n"));
          } else if (rest[0] === "off") {
            s.setActiveSkill(null); print("out", "skill deactivated");
          } else {
            const sk = SKILLS.find((x) => x.id === rest[0]);
            if (!sk) print("err", `unknown skill: ${rest[0]}`);
            else { s.setActiveSkill(sk.id); print("out", `skill ON: ${sk.name}`); }
          }
          break;
        case "docs":
          print("out", s.docs.length ? s.docs.map((d) => `  ${d.name} (${d.content.length}B)`).join("\n") : "(empty)");
          break;
        case "doc":
          if (rest[0] === "rm" && rest[1]) { s.deleteDoc(rest[1]); print("out", `deleted ${rest[1]}`); }
          else print("err", "usage: doc rm <name>");
          break;
        case "uploads":
          print("out", s.uploads.length ? s.uploads.map((u) => `  ${u.name} (${u.size}B) ${u.url}`).join("\n") : "(empty)");
          break;
        case "reset":
          if (rest[0] === "chat") { s.clearMessages(); print("out", "chat cleared"); toast.success("Chat reset"); }
          else print("err", "usage: reset chat");
          break;
        case "model":
          if (!arg) print("err", "usage: model <id>");
          else { s.setModel(arg); print("out", `model=${arg}`); }
          break;
        default:
          print("err", `unknown: ${head}  (try \`help\`)`);
      }
    } catch (e: any) {
      print("err", e.message);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      exec(input);
      setInput("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] bg-background border-primary/30 p-0 flex flex-col">
        <SheetHeader className="p-3 border-b border-primary/20 flex-shrink-0">
          <SheetTitle className="font-display text-primary glow-text">TERMINAL</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed bg-[#000510]">
          {history.map((l, i) => (
            <pre key={i} className={`whitespace-pre-wrap ${l.kind === "in" ? "text-primary" : l.kind === "err" ? "text-destructive" : "text-foreground-dim"}`}>
              {l.text}
            </pre>
          ))}
        </div>
        <div className="p-2 border-t border-primary/20 flex items-center gap-2 flex-shrink-0">
          <span className="text-primary font-mono">$</span>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            className="flex-1 bg-transparent border-none outline-none font-mono text-[12px] text-foreground"
            placeholder="type command…"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
