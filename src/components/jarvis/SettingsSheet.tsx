import { useState } from "react";
import { useJarvis } from "@/store/jarvis";
import { PROVIDERS, SYSTEM_PROMPT_PRESETS, DEFAULT_SYSTEM_PROMPT, type CustomProvider, type ProviderId } from "@/lib/providers";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROVIDERS as CLI_PROVIDERS } from "@/lib/cli-providers";
import { ghVerifyToken } from "@/lib/tools";
import { Copy, Trash2, Plus, FileDown, FileText, LogOut, Check, Loader2, Eye, EyeOff, ExternalLink, Save, RotateCcw, KeyRound } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (b: boolean) => void };

const Cmd = ({ cmd }: { cmd: string }) => (
  <div className="flex items-start gap-2 group">
    <pre className="flex-1 font-mono text-[11px] bg-background-elev2/80 border border-primary/15 rounded px-2.5 py-1.5 overflow-x-auto text-foreground-dim whitespace-pre-wrap">{cmd}</pre>
    <button onClick={() => { navigator.clipboard.writeText(cmd); toast.success("Copied"); }}
      className="opacity-60 hover:opacity-100 text-primary p-1 rounded border border-primary/20 hover:border-primary/60 transition">
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
        <SheetHeader className="p-4 border-b border-primary/20 sticky top-0 bg-background z-10">
          <SheetTitle className="font-display text-primary glow-text">SETTINGS</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="providers" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-primary/15 bg-background-elev/40 px-2 h-auto flex-wrap sticky top-[56px] z-10">
            <TabsTrigger value="providers" className="text-[11px]">Providers</TabsTrigger>
            <TabsTrigger value="models" className="text-[11px]">Models</TabsTrigger>
            <TabsTrigger value="prompt" className="text-[11px]">Prompt</TabsTrigger>
            <TabsTrigger value="general" className="text-[11px]">General</TabsTrigger>
            <TabsTrigger value="github" className="text-[11px]">GitHub</TabsTrigger>
            <TabsTrigger value="audit" className="text-[11px]">Audit</TabsTrigger>
            <TabsTrigger value="docs" className="text-[11px]">Docs</TabsTrigger>
            <TabsTrigger value="cli" className="text-[11px]">CLI</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="p-4 space-y-4">
            <ProvidersPanel />
            <CustomProvidersPanel />
          </TabsContent>

          <TabsContent value="models" className="p-4 space-y-3">
            <ModelsPanel />
          </TabsContent>

          <TabsContent value="prompt" className="p-4 space-y-3">
            <PromptPanel />
          </TabsContent>

          <TabsContent value="general" className="p-4 space-y-4">
            <Row label="Autopilot režim" hint="MAX 12 koraka, agresivni problem-solving, automatski nastavlja na eval fail.">
              <Switch checked={autopilot} onCheckedChange={setAutopilot} />
            </Row>
            <Row label="Eval required" hint="Forsira eval_response na svaki output.">
              <Switch checked={evalRequired} onCheckedChange={setEvalRequired} />
            </Row>
            <div className="pt-2">
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

          <TabsContent value="github" className="p-4 space-y-3">
            <GithubPanel />
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
                <Input value={newHost} onChange={(e) => setNewHost(e.target.value)} placeholder="api.example.com"
                  className="bg-background-elev2 border-primary/25 text-[12px] font-mono h-8" />
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
                    <button onClick={() => {
                      const blob = new Blob([d.content], { type: "text/plain" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${d.name}.txt`;
                      a.click();
                    }} className="text-primary/70 hover:text-primary p-1"><FileDown className="w-3 h-3" /></button>
                    <button onClick={() => deleteDoc(d.name)} className="text-destructive/70 hover:text-destructive p-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
                <pre className="text-[10px] text-foreground-dim font-mono max-h-20 overflow-hidden whitespace-pre-wrap">{d.content.slice(0, 200)}{d.content.length > 200 ? "…" : ""}</pre>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="cli" className="p-4 space-y-4">
            <div className="text-[10px] font-mono uppercase text-primary/60 mb-1">CLI cheat-sheet</div>
            {CLI_PROVIDERS.map((p) => (
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

// ───────────────────── Providers (API keys) ─────────────────────
const ProvidersPanel = () => {
  const { providerKeys, setProviderKey, removeProviderKey } = useJarvis();
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-foreground-dim leading-relaxed">
        Svaki provider koristi svoj API ključ. Ključevi se čuvaju samo u tvom browseru (localStorage). Šalju se per-request kroz proxy edge funkciju radi CORS-a.
      </div>
      <div className="text-[10px] font-mono uppercase text-primary/60">Provider API Keys</div>
      {PROVIDERS.map((p) => (
        <ProviderKeyRow
          key={p.id}
          providerId={p.id}
          name={p.name}
          color={p.color}
          hint={p.keyHint}
          getKeyUrl={p.getKeyUrl}
          configured={!!providerKeys[p.id]}
          currentKey={providerKeys[p.id] || ""}
          onSave={(k) => { setProviderKey(p.id, k); toast.success(`${p.name} ključ sačuvan`); }}
          onClear={() => { removeProviderKey(p.id); toast.info(`${p.name} ključ uklonjen`); }}
        />
      ))}
    </div>
  );
};

const ProviderKeyRow = ({ providerId, name, color, hint, getKeyUrl, configured, currentKey, onSave, onClear }: {
  providerId: ProviderId; name: string; color: string; hint: string; getKeyUrl: string;
  configured: boolean; currentKey: string;
  onSave: (k: string) => void; onClear: () => void;
}) => {
  const [val, setVal] = useState(currentKey);
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`text-[12px] font-display ${color}`}>{name} API Key</span>
          <a href={getKeyUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary inline-flex items-center gap-0.5 hover:underline">
            Get key <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
        {configured && <span className="text-[9px] font-mono text-success">● configured</span>}
      </div>
      <div className="flex gap-1">
        <div className="flex-1 relative">
          <KeyRound className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-foreground-dim" />
          <Input
            type={show ? "text" : "password"}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={hint}
            className="bg-background-elev2 border-primary/25 font-mono text-[11px] pl-7 pr-7 h-8"
          />
          <button onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-dim hover:text-primary">
            {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
        <Button size="sm" onClick={() => val.trim() && onSave(val.trim())} disabled={!val.trim() || val === currentKey}>
          <Save className="w-3 h-3" />
        </Button>
        {configured && (
          <Button size="sm" variant="outline" className="border-destructive/40 text-destructive" onClick={() => { onClear(); setVal(""); }}>
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

// ───────────────────── Custom providers ─────────────────────
const CustomProvidersPanel = () => {
  const { customProviders, addCustomProvider, removeCustomProvider } = useJarvis();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelsRaw, setModelsRaw] = useState("");

  const submit = () => {
    if (!name.trim() || !baseUrl.trim() || !apiKey.trim() || !modelsRaw.trim()) {
      toast.error("Sva polja su obavezna");
      return;
    }
    const models = modelsRaw.split("\n").map((l) => l.trim()).filter(Boolean).map((id) => ({ id, label: id }));
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const cp: CustomProvider = { id: `custom:${slug}`, name: name.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), models };
    addCustomProvider(cp);
    toast.success(`Custom provider "${name}" dodan`);
    setAdding(false); setName(""); setBaseUrl(""); setApiKey(""); setModelsRaw("");
  };

  return (
    <div className="space-y-2 pt-3 border-t border-primary/15">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-mono uppercase text-primary/60">Custom Providers</div>
          <div className="text-[10px] text-foreground-dim">Bilo koji OpenAI-compatible /v1 endpoint</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>

      {adding && (
        <div className="space-y-1.5 p-2 border border-primary/25 rounded bg-background-elev2/50">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name (e.g. Groq)" className="h-8 text-[11px] font-mono bg-background-elev2 border-primary/25" />
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL (https://api.groq.com/openai/v1)" className="h-8 text-[11px] font-mono bg-background-elev2 border-primary/25" />
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key" className="h-8 text-[11px] font-mono bg-background-elev2 border-primary/25" />
          <Textarea value={modelsRaw} onChange={(e) => setModelsRaw(e.target.value)} placeholder="One model id per line&#10;llama-3.3-70b-versatile&#10;mixtral-8x7b-32768" rows={3} className="text-[11px] font-mono bg-background-elev2 border-primary/25" />
          <div className="flex gap-1">
            <Button size="sm" onClick={submit} className="flex-1"><Save className="w-3 h-3 mr-1" />Save</Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {customProviders.length === 0 && !adding && (
        <div className="text-[11px] text-foreground-dim italic text-center py-3 border border-dashed border-primary/20 rounded">
          No custom providers. Add one to use any OpenAI-compatible API.
        </div>
      )}

      {customProviders.map((cp) => (
        <div key={cp.id} className="flex items-center gap-2 text-[11px] font-mono bg-background-elev2/50 border border-primary/15 rounded px-2 py-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-primary truncate">{cp.name}</div>
            <div className="text-[9px] text-foreground-dim truncate">{cp.baseUrl} · {cp.models.length} models</div>
          </div>
          <button onClick={() => { removeCustomProvider(cp.id); toast.info("Removed"); }} className="text-destructive/70 hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

// ───────────────────── Models picker ─────────────────────
const ModelsPanel = () => {
  const { activeModel, setActiveModel, providerKeys, customProviders } = useJarvis();
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-foreground-dim">Klikni model da postaviš kao aktivan. Modeli su dostupni samo ako je njihov provider ima ključ.</div>
      {PROVIDERS.map((p) => {
        const hasKey = !!providerKeys[p.id];
        return (
          <div key={p.id} className="border border-primary/20 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1.5 bg-background-elev/40">
              <div className="flex items-center gap-1.5">
                <span className={`text-[12px] font-display ${p.color}`}>○ {p.name}</span>
              </div>
              <span className={`text-[9px] font-mono ${hasKey ? "text-success" : "text-warning"}`}>
                {hasKey ? "● configured" : "○ no key"}
              </span>
            </div>
            <div className="divide-y divide-primary/10">
              {p.models.map((m) => {
                const isActive = activeModel.providerId === p.id && activeModel.modelId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => { setActiveModel({ providerId: p.id, modelId: m.id }); toast.success(`Active: ${p.name} · ${m.label}`); }}
                    disabled={!hasKey}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-mono hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed ${
                      isActive ? "bg-primary/10 text-primary" : "text-foreground-dim"
                    }`}
                  >
                    <span>{isActive ? "● " : "  "}{m.label}</span>
                    <span className="text-[9px]">{m.free ? "FREE" : m.ctx}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {customProviders.length > 0 && (
        <div className="text-[10px] font-mono uppercase text-primary/60 pt-2">Custom</div>
      )}
      {customProviders.map((cp) => (
        <div key={cp.id} className="border border-primary/20 rounded-md overflow-hidden">
          <div className="px-2 py-1.5 bg-background-elev/40 text-[12px] font-display text-violet-400">○ {cp.name}</div>
          <div className="divide-y divide-primary/10">
            {cp.models.map((m) => {
              const isActive = activeModel.providerId === cp.id && activeModel.modelId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => { setActiveModel({ providerId: cp.id, modelId: m.id }); toast.success(`Active: ${cp.name} · ${m.label}`); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-primary/10 ${
                    isActive ? "bg-primary/10 text-primary" : "text-foreground-dim"
                  }`}
                >
                  {isActive ? "● " : "  "}{m.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ───────────────────── System prompt ─────────────────────
const PromptPanel = () => {
  const { systemPrompt, setSystemPrompt, resetSystemPrompt, presets, savePreset, deletePreset } = useJarvis();
  const [draft, setDraft] = useState(systemPrompt);
  const [presetName, setPresetName] = useState("");

  const dirty = draft !== systemPrompt;
  const apply = () => { setSystemPrompt(draft); toast.success("System prompt applied"); };
  const reset = () => { resetSystemPrompt(); setDraft(DEFAULT_SYSTEM_PROMPT); toast.info("Reset to default"); };
  const saveAsPreset = () => {
    if (!presetName.trim()) { toast.error("Daj preset-u ime"); return; }
    const id = presetName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    savePreset({ id, name: presetName.trim(), prompt: draft });
    toast.success(`Preset "${presetName}" saved`);
    setPresetName("");
  };

  const builtInIds = new Set(SYSTEM_PROMPT_PRESETS.map((p) => p.id));

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-foreground-dim">System prompt definiše ponašanje agenta. Promijena se primjenjuje na sve sljedeće poruke.</div>

      <div>
        <div className="text-[10px] font-mono uppercase text-primary/60 mb-1">Presets</div>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <div key={p.id} className="inline-flex items-center gap-1 bg-background-elev2/60 border border-primary/20 rounded">
              <button
                onClick={() => { setDraft(p.prompt); toast.info(`Loaded preset: ${p.name}`); }}
                className="text-[10px] font-mono px-2 py-1 text-primary hover:bg-primary/10"
              >
                {p.name}
              </button>
              {!builtInIds.has(p.id) && (
                <button onClick={() => deletePreset(p.id)} className="text-destructive/70 hover:text-destructive pr-1">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-mono uppercase text-primary/60">System Prompt</div>
          <div className="text-[9px] text-foreground-dim font-mono">{draft.length} chars</div>
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={14}
          className="bg-background-elev2 border-primary/25 font-mono text-[11px] leading-relaxed"
        />
      </div>

      <div className="flex gap-1">
        <Button size="sm" onClick={apply} disabled={!dirty} className="flex-1">
          <Save className="w-3 h-3 mr-1" /> Apply
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          <RotateCcw className="w-3 h-3 mr-1" /> Reset
        </Button>
      </div>

      <div className="pt-2 border-t border-primary/15">
        <div className="text-[10px] font-mono uppercase text-primary/60 mb-1">Save current as preset</div>
        <div className="flex gap-1">
          <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" className="h-8 text-[11px] font-mono bg-background-elev2 border-primary/25" />
          <Button size="sm" onClick={saveAsPreset} disabled={!presetName.trim()}><Plus className="w-3 h-3" /></Button>
        </div>
      </div>
    </div>
  );
};

// ───────────────────── GitHub (unchanged) ─────────────────────
const GithubPanel = () => {
  const { github, setGithub } = useJarvis();
  const [tokenInput, setTokenInput] = useState("");
  const [repoInput, setRepoInput] = useState(github?.defaultRepo || "");
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    const token = tokenInput.trim();
    if (!token) return;
    setVerifying(true);
    const r = await ghVerifyToken(token);
    setVerifying(false);
    if (!r) { toast.error("Token invalid"); return; }
    setGithub({ token, user: r.login, defaultRepo: repoInput.trim() || undefined });
    setTokenInput();
    toast.success(`Signed in as ${r.login}`);
  };
  const saveRepo = () => {
    if (!github) return;
    setGithub({ ...github, defaultRepo: repoInput.trim() || undefined });
    toast.success("Default repo saved");
  };
  const signOut = () => { setGithub(null); setTokenInput(""); toast.info("GitHub signed out"); };

  if (!github) {
    return (
      <div className="space-y-3">
        <div className="text-[12px] text-foreground-dim leading-relaxed">
          Paste a <span className="text-primary font-mono">GitHub PAT</span> (Classic, scopes: <code className="text-primary-glow">repo</code>, <code className="text-primary-glow">workflow</code>).{" "}
          <a href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=JARVIS%20v4" target="_blank" rel="noreferrer" className="text-primary underline">Create token</a>
        </div>
        <Input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="ghp_… or github_pat_…" className="bg-background-elev2 border-primary/25 font-mono text-[12px]" />
        <Input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="Default repo (owner/repo) — optional" className="bg-background-elev2 border-primary/25 font-mono text-[12px]" />
        <Button onClick={verify} disabled={verifying || !tokenInput.trim()} className="w-full">
          {verifying ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
          Verify & save token
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 bg-success/10 border border-success/40 rounded">
        <Check className="w-4 h-4 text-success" />
        <div className="flex-1">
          <div className="text-[12px] font-mono text-success">{github.user}</div>
          <div className="text-[10px] text-foreground-dim">Authenticated</div>
        </div>
        <button onClick={signOut} className="text-destructive/70 hover:text-destructive p-1"><LogOut className="w-3.5 h-3.5" /></button>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-primary/60 mb-1">Default repo</div>
        <div className="flex gap-1.5">
          <Input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="user/my-repo" className="bg-background-elev2 border-primary/25 font-mono text-[12px] h-8" />
          <Button size="sm" onClick={saveRepo}>Save</Button>
        </div>
      </div>
    </div>
  );
};
