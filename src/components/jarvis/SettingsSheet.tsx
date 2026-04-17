import { useState } from "react";
import { useJarvis } from "@/store/jarvis";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROVIDERS } from "@/lib/cli-providers";
import { Copy, Trash2, Plus, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (b: boolean) => void };

const Cmd = ({ cmd }: { cmd: string }) => (
  <div className="flex items-start gap-2 group">
    <pre className="flex-1 font-mono text-[11px] bg-background-elev2/80 border border-primary/15 rounded px-2.5 py-1.5 overflow-x-auto text-foreground-dim whitespace-pre-wrap">
      {cmd}
    </pre>
    <button
      onClick={() => { navigator.clipboard.writeText(cmd); toast.success("Copied"); }}
      className="opacity-60 hover:opacity-100 text-primary p-1 rounded border border-primary/20 hover:border-primary/60 transition"
    >
      <Copy className="w-3 h-3" />
    </button>
  </div>
);

export const SettingsSheet = ({ open, onOpenChange }: Props) => {
  const {
    autopilot, setAutopilot, evalRequired, setEvalRequired,
    audit, setAudit, addAllowlist, removeAllowlist,
    docs, deleteDoc, clearMessages, uploads, removeUpload,
  } = useJarvis();
  const [newHost, setNewHost] = useState("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md bg-background border-primary/30 overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b border-primary/20">
          <SheetTitle className="font-display text-primary glow-text">SETTINGS</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-primary/15 bg-background-elev/40 px-2 h-auto">
            <TabsTrigger value="general" className="text-[11px]">General</TabsTrigger>
            <TabsTrigger value="audit" className="text-[11px]">Audit</TabsTrigger>
            <TabsTrigger value="docs" className="text-[11px]">Docs</TabsTrigger>
            <TabsTrigger value="cli" className="text-[11px]">CLI</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="p-4 space-y-4">
            <Row label="Autopilot režim" hint="MAX 12 koraka, agresivni problem-solving, automatski nastavlja na eval fail.">
              <Switch checked={autopilot} onCheckedChange={setAutopilot} />
            </Row>
            <Row label="Eval required" hint="Forsira eval_response na svaki output.">
              <Switch checked={evalRequired} onCheckedChange={setEvalRequired} />
            </Row>
            <div className="pt-2 space-y-2">
              <Button variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => { clearMessages(); toast.success("Chat cleared"); }}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear chat history
              </Button>
            </div>

            {uploads.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase text-primary/60 mb-1">Uploads ({uploads.length})</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {uploads.map((u) => (
                    <div key={u.url} className="flex items-center gap-2 text-[11px] font-mono bg-background-elev2/50 border border-primary/15 rounded px-2 py-1">
                      <FileText className="w-3 h-3 text-primary" />
                      <span className="truncate flex-1">{u.name}</span>
                      <span className="text-foreground-dim text-[10px]">{(u.size / 1024).toFixed(1)}KB</span>
                      <button onClick={() => removeUpload(u.name)} className="text-destructive/70 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="audit" className="p-4 space-y-3">
            <Row label="Repo write" hint="Dozvoli gh_create_issue i sl.">
              <Switch checked={audit.repoWrite} onCheckedChange={(b) => setAudit({ repoWrite: b })} />
            </Row>
            <Row label="Workflow dispatch" hint="Dozvoli pokretanje GitHub Actions workflow-a.">
              <Switch checked={audit.workflowDispatch} onCheckedChange={(b) => setAudit({ workflowDispatch: b })} />
            </Row>

            <div>
              <div className="text-[10px] font-mono uppercase text-primary/60 mb-1">HTTP allowlist</div>
              <div className="flex gap-1.5 mb-2">
                <Input
                  value={newHost}
                  onChange={(e) => setNewHost(e.target.value)}
                  placeholder="api.example.com"
                  className="bg-background-elev2 border-primary/25 text-[12px] font-mono h-8"
                />
                <Button size="sm" onClick={() => { if (newHost.trim()) { addAllowlist(newHost.trim()); setNewHost(""); } }}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {audit.allowlist.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1 text-[10px] font-mono bg-primary/10 border border-primary/30 rounded px-1.5 py-0.5">
                    {h}
                    <button onClick={() => removeAllowlist(h)} className="text-destructive/70 hover:text-destructive">×</button>
                  </span>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="docs" className="p-4 space-y-2">
            <div className="text-[10px] font-mono uppercase text-primary/60">Saved JARVIS docs ({docs.length})</div>
            {docs.length === 0 && <div className="text-foreground-dim text-xs">Nema dokumenata. Reci agentu: "save this as &lt;name&gt;".</div>}
            {docs.map((d) => (
              <div key={d.name} className="bg-background-elev2/50 border border-primary/15 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[12px] text-primary">{d.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const blob = new Blob([d.content], { type: "text/plain" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `${d.name}.txt`;
                        a.click();
                      }}
                      className="text-primary/70 hover:text-primary p-1"
                    >
                      <FileDown className="w-3 h-3" />
                    </button>
                    <button onClick={() => deleteDoc(d.name)} className="text-destructive/70 hover:text-destructive p-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <pre className="text-[10px] text-foreground-dim font-mono max-h-20 overflow-hidden whitespace-pre-wrap">{d.content.slice(0, 200)}{d.content.length > 200 ? "…" : ""}</pre>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="cli" className="p-4 space-y-4">
            <div className="text-[10px] font-mono uppercase text-primary/60 mb-1">CLI cheat-sheet za sve provajdere</div>
            {PROVIDERS.map((p) => (
              <div key={p.id} className="border border-primary/20 rounded-md p-2.5 bg-background-elev/40">
                <div className="font-display text-primary text-sm mb-2">{p.name}</div>
                <div className="text-[10px] text-foreground-dim uppercase font-mono mb-1">install</div>
                <Cmd cmd={p.install} />
                <div className="text-[10px] text-foreground-dim uppercase font-mono mt-2 mb-1">login</div>
                <Cmd cmd={p.login} />
                <div className="text-[10px] text-foreground-dim uppercase font-mono mt-2 mb-1">commands</div>
                <div className="space-y-1.5">
                  {p.commands.map((c, i) => (
                    <div key={i}>
                      <div className="text-[10px] text-primary/60 font-mono mb-0.5">{c.label}</div>
                      <Cmd cmd={c.cmd} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex-1">
      <div className="text-[13px] text-foreground">{label}</div>
      {hint && <div className="text-[10px] text-foreground-dim font-mono">{hint}</div>}
    </div>
    {children}
  </div>
);
