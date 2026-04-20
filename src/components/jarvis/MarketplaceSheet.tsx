import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useJarvis } from "@/store/jarvis";
import {
  fetchCatalog, fetchCollectionSkills, fetchSkill, fetchSkillsBulk, searchCatalog,
  presetFromCustomRepo, SOURCE_PRESETS,
  type CatalogEntry, type SourcePreset,
} from "@/lib/skill-marketplace";
import { estimateStorage } from "@/lib/skills-store";
import { toast } from "sonner";
import { Download, Trash2, Power, RefreshCw, ExternalLink, Loader2, Search, ChevronLeft, FolderOpen, Plus, Database, X } from "lucide-react";

type Props = { open: boolean; onOpenChange: (b: boolean) => void };

type View =
  | { kind: "catalog"; preset: SourcePreset }
  | { kind: "collection"; preset: SourcePreset; repo: string; name: string };

export const MarketplaceSheet = ({ open, onOpenChange }: Props) => {
  const {
    installedSkills, installSkill, installSkillsBulk, uninstallSkill,
    activeSkill, setActiveSkill, customSources, addCustomSource, removeCustomSource,
  } = useJarvis();

  // Combined preset list = curated + user-added custom repos
  const allPresets: SourcePreset[] = useMemo(() => {
    return [
      ...SOURCE_PRESETS,
      ...customSources.map((c) => ({
        id: c.id, label: c.label, repo: c.repo, ref: c.ref || "HEAD",
        layout: "nested-skill-md" as const, rootPath: c.rootPath, description: "Custom",
      })),
    ];
  }, [customSources]);

  const [activePresetId, setActivePresetId] = useState<string>(SOURCE_PRESETS[0].id);
  const activePreset = allPresets.find((p) => p.id === activePresetId) || SOURCE_PRESETS[0];

  const [view, setView] = useState<View>({ kind: "catalog", preset: activePreset });
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<{ done: number; total: number; name: string } | null>(null);
  const [tab, setTab] = useState<"browse" | "installed" | "tools">("browse");
  const [customInput, setCustomInput] = useState("");
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setView({ kind: "catalog", preset: activePreset });
    void load(false, { kind: "catalog", preset: activePreset });
    void estimateStorage().then(setStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activePresetId]);

  async function load(force: boolean, v: View = view) {
    setLoading(true);
    try {
      if (v.kind === "catalog") {
        setEntries(await fetchCatalog(v.preset, force));
      } else {
        setEntries(await fetchCollectionSkills(v.repo));
      }
    } catch (e: any) {
      toast.error(e?.message || "Catalog fetch failed");
    } finally {
      setLoading(false);
    }
  }

  function openCollection(e: CatalogEntry) {
    if (e.kind !== "collection" || !e.collectionRepo) return;
    const v: View = { kind: "collection", preset: activePreset, repo: e.collectionRepo, name: e.name };
    setView(v); setQuery(""); void load(false, v);
  }
  function backToCatalog() {
    const v: View = { kind: "catalog", preset: activePreset };
    setView(v); setQuery(""); void load(false, v);
  }

  const visible = useMemo(() => searchCatalog(entries, query, 500), [entries, query]);
  const installedIds = useMemo(() => new Set(installedSkills.map((s) => s.id)), [installedSkills]);
  const installableVisible = useMemo(() => visible.filter((e) => e.kind !== "collection" && e.rawUrl && !installedIds.has(e.id)), [visible, installedIds]);

  async function handleInstall(e: CatalogEntry) {
    setBusyId(e.id);
    try {
      const sk = await fetchSkill(e);
      installSkill(sk);
      toast.success(`Installed: ${sk.name}`);
    } catch (err: any) {
      toast.error(`Install failed: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleInstallAll() {
    if (!installableVisible.length) { toast.info("Nothing new to install."); return; }
    setBulkBusy({ done: 0, total: installableVisible.length, name: "" });
    try {
      const { ok, failed } = await fetchSkillsBulk(installableVisible, (done, total, name) => {
        setBulkBusy({ done, total, name });
      });
      await installSkillsBulk(ok);
      void estimateStorage().then(setStorage);
      if (failed.length) toast.warning(`Installed ${ok.length}. ${failed.length} failed.`);
      else toast.success(`Installed ${ok.length} skills`);
    } catch (err: any) {
      toast.error(`Bulk install failed: ${err?.message}`);
    } finally {
      setBulkBusy(null);
    }
  }

  function handleAddCustom() {
    const raw = customInput.trim();
    if (!raw) return;
    try {
      const p = presetFromCustomRepo(raw);
      addCustomSource({ id: p.id, label: p.label, repo: p.repo, ref: p.ref, rootPath: p.rootPath });
      setCustomInput("");
      setActivePresetId(p.id);
      setTab("browse");
      toast.success(`Added source: ${p.label}`);
    } catch (e: any) {
      toast.error(e?.message || "Invalid repo");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-background border-l border-primary/30 p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-primary/20">
          <SheetTitle className="font-display text-primary glow-text text-sm">
            🧩 Skill Marketplace
          </SheetTitle>
        </SheetHeader>

        {/* Source picker (scrollable horizontally) */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-primary/10 overflow-x-auto">
          <span className="text-[10px] font-mono text-foreground-dim uppercase mr-1 flex-shrink-0">Source:</span>
          {allPresets.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePresetId(p.id)}
              className={`text-[11px] px-2 py-1 rounded font-mono border flex-shrink-0 ${
                activePresetId === p.id ? "border-primary bg-primary/15 text-primary" : "border-primary/20 text-foreground-dim hover:border-primary/40"
              }`}
              title={p.repo}
            >
              {p.label}
              {p.id.startsWith("custom:") && (
                <X
                  className="w-3 h-3 inline ml-1 hover:text-destructive"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    removeCustomSource(p.id);
                    if (activePresetId === p.id) setActivePresetId(SOURCE_PRESETS[0].id);
                  }}
                />
              )}
            </button>
          ))}
          <button
            onClick={() => load(true)}
            title="Refresh"
            className="p-1.5 rounded border border-primary/20 hover:border-primary/60 text-primary flex-shrink-0 ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-primary/10">
          <button
            onClick={() => setTab("browse")}
            className={`text-[11px] px-2.5 py-1 rounded font-mono uppercase tracking-wider border ${
              tab === "browse" ? "border-primary bg-primary/15 text-primary" : "border-primary/20 text-foreground-dim"
            }`}
          >
            Browse · {entries.length || "…"}
          </button>
          <button
            onClick={() => setTab("installed")}
            className={`text-[11px] px-2.5 py-1 rounded font-mono uppercase tracking-wider border ${
              tab === "installed" ? "border-primary bg-primary/15 text-primary" : "border-primary/20 text-foreground-dim"
            }`}
          >
            Installed · {installedSkills.length}
          </button>
          <button
            onClick={() => setTab("tools")}
            className={`text-[11px] px-2.5 py-1 rounded font-mono uppercase tracking-wider border ${
              tab === "tools" ? "border-primary bg-primary/15 text-primary" : "border-primary/20 text-foreground-dim"
            }`}
          >
            Add Source
          </button>
        </div>

        {/* Bulk progress bar */}
        {bulkBusy && (
          <div className="px-3 py-2 border-b border-primary/10 bg-primary/5">
            <div className="flex items-center justify-between text-[10px] font-mono text-primary mb-1">
              <span>Installing {bulkBusy.done}/{bulkBusy.total}: {bulkBusy.name}</span>
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
            <div className="h-1 bg-primary/10 rounded">
              <div
                className="h-full bg-primary rounded transition-all"
                style={{ width: `${(bulkBusy.done / bulkBusy.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {tab === "browse" && (
          <>
            {view.kind === "collection" && (
              <div className="px-3 py-1.5 border-b border-primary/10 flex items-center gap-2 bg-background-elev/30">
                <button onClick={backToCatalog} className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:underline">
                  <ChevronLeft className="w-3 h-3" /> back
                </button>
                <span className="text-[10px] font-mono text-foreground-dim">›</span>
                <span className="text-[11px] font-mono text-foreground truncate">{view.name}</span>
                <span className="text-[10px] font-mono text-foreground-dim truncate">({view.repo})</span>
              </div>
            )}

            <div className="px-3 py-2 border-b border-primary/10 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-primary/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name, id, or category…"
                className="flex-1 bg-background-elev2 border border-primary/20 rounded text-xs font-mono px-2 py-1 text-foreground focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleInstallAll}
                disabled={!installableVisible.length || !!bulkBusy}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-success/40 text-success hover:bg-success/10 font-mono disabled:opacity-40"
                title="Install all visible skills (skips already installed)"
              >
                <Download className="w-3 h-3" /> Install all ({installableVisible.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {loading && <div className="text-xs font-mono text-foreground-dim">Fetching…</div>}
              {!loading && visible.length === 0 && <div className="text-xs font-mono text-foreground-dim">No matches.</div>}
              {visible.map((e) => {
                const installed = installedIds.has(e.id);
                const active = activeSkill === e.id;
                const isCollection = e.kind === "collection";
                return (
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded border border-primary/15 bg-background-elev/40 hover:border-primary/40">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-foreground truncate flex items-center gap-1.5">
                        {isCollection && <FolderOpen className="w-3 h-3 text-accent flex-shrink-0" />}
                        {e.name}
                      </div>
                      <div className="text-[10px] font-mono text-foreground-dim truncate">
                        {e.collectionRepo || e.id.replace(/^[^:]+:/, "")}
                      </div>
                      {e.description && <div className="text-[10px] font-mono text-foreground-dim truncate">{e.description}</div>}
                    </div>
                    <a href={e.url} target="_blank" rel="noreferrer" className="p-1 text-foreground-dim hover:text-primary" title="View on GitHub">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {isCollection ? (
                      <button onClick={() => openCollection(e)} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-accent/40 hover:border-accent hover:bg-accent/10 text-accent font-mono">
                        Open
                      </button>
                    ) : installed ? (
                      <>
                        <button
                          onClick={() => setActiveSkill(active ? null : e.id)}
                          title={active ? "Deactivate" : "Activate"}
                          className={`p-1 rounded border ${active ? "border-success bg-success/15 text-success" : "border-primary/30 text-primary"}`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => uninstallSkill(e.id)} title="Uninstall" className="p-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleInstall(e)}
                        disabled={busyId === e.id || !!bulkBusy}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-primary/40 hover:border-primary hover:bg-primary/10 text-primary font-mono disabled:opacity-40"
                      >
                        {busyId === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        Install
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "installed" && (
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {installedSkills.length === 0 && (
              <div className="text-xs font-mono text-foreground-dim">No skills installed yet. Browse the catalog →</div>
            )}
            {installedSkills.map((sk) => {
              const active = activeSkill === sk.id;
              return (
                <div key={sk.id} className="p-2 rounded border border-primary/15 bg-background-elev/40 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-foreground truncate">🧩 {sk.name}</div>
                      <div className="text-[10px] font-mono text-foreground-dim truncate">{sk.id}</div>
                    </div>
                    <button
                      onClick={() => setActiveSkill(active ? null : sk.id)}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border font-mono uppercase ${
                        active ? "border-success bg-success/15 text-success" : "border-primary/40 text-primary hover:bg-primary/10"
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {active ? "Active" : "Activate"}
                    </button>
                    <button onClick={() => uninstallSkill(sk.id)} className="p-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {sk.description && <div className="text-[10px] font-mono text-foreground-dim line-clamp-2">{sk.description}</div>}
                  {sk.risk && sk.risk !== "unknown" && <div className="text-[10px] font-mono text-warning">risk: {sk.risk}</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "tools" && (
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-primary uppercase tracking-wider">Add custom GitHub repo</div>
              <p className="text-[10px] font-mono text-foreground-dim">
                Paste <code className="text-primary">owner/repo</code>, <code className="text-primary">owner/repo/path</code>, or a full GitHub tree URL.
                The marketplace will auto-detect SKILL.md folders or flat .md files.
              </p>
              <div className="flex gap-2">
                <input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                  placeholder="e.g. anthropics/skills or https://github.com/owner/repo/tree/main/skills"
                  className="flex-1 bg-background-elev2 border border-primary/20 rounded text-xs font-mono px-2 py-1.5 text-foreground focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleAddCustom}
                  className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded border border-primary/40 hover:border-primary hover:bg-primary/10 text-primary font-mono"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {customSources.length > 0 && (
                <div className="space-y-1 mt-2">
                  <div className="text-[10px] font-mono text-foreground-dim uppercase">Your custom sources</div>
                  {customSources.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded border border-primary/15 bg-background-elev/40">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-foreground truncate">{c.label}</div>
                        <div className="text-[10px] font-mono text-foreground-dim truncate">{c.repo}{c.rootPath ? `/${c.rootPath}` : ""}</div>
                      </div>
                      <button onClick={() => removeCustomSource(c.id)} className="p-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-primary/10 pt-3 space-y-2">
              <div className="text-[11px] font-mono text-primary uppercase tracking-wider flex items-center gap-1">
                <Database className="w-3 h-3" /> Storage (IndexedDB)
              </div>
              <p className="text-[10px] font-mono text-foreground-dim">
                Skills are stored in your browser's IndexedDB — effectively unlimited (browser quota is hundreds of MB to several GB, vs. 5 MB for localStorage).
              </p>
              {storage && (
                <div className="text-[10px] font-mono text-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Used</span>
                    <span className="text-primary">{(storage.usage / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quota</span>
                    <span className="text-success">{(storage.quota / 1024 / 1024).toFixed(0)} MB</span>
                  </div>
                  <div className="h-1 bg-primary/10 rounded mt-1">
                    <div className="h-full bg-success rounded" style={{ width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%` }} />
                  </div>
                </div>
              )}
              <button
                onClick={() => estimateStorage().then(setStorage)}
                className="text-[11px] px-2 py-1 rounded border border-primary/30 text-primary font-mono hover:bg-primary/10"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
