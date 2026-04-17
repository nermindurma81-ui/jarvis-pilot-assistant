import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useJarvis } from "@/store/jarvis";
import {
  fetchCatalog, fetchCollectionSkills, fetchSkill, searchCatalog,
  type CatalogEntry, type MarketSource,
} from "@/lib/skill-marketplace";
import { toast } from "sonner";
import { Download, Trash2, Power, RefreshCw, ExternalLink, Loader2, Search, ChevronLeft, FolderOpen } from "lucide-react";

type Props = { open: boolean; onOpenChange: (b: boolean) => void };

type View =
  | { kind: "catalog"; source: MarketSource }
  | { kind: "collection"; source: "skillkit"; repo: string; name: string };

export const MarketplaceSheet = ({ open, onOpenChange }: Props) => {
  const { installedSkills, installSkill, uninstallSkill, activeSkill, setActiveSkill } = useJarvis();
  const [source, setSource] = useState<MarketSource>("antigravity");
  const [view, setView] = useState<View>({ kind: "catalog", source: "antigravity" });
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"browse" | "installed">("browse");

  useEffect(() => {
    if (!open) return;
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view]);

  async function load(force: boolean) {
    setLoading(true);
    try {
      if (view.kind === "catalog") {
        setEntries(await fetchCatalog(view.source, force));
      } else {
        setEntries(await fetchCollectionSkills(view.repo));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  function switchSource(s: MarketSource) {
    setSource(s);
    setView({ kind: "catalog", source: s });
    setQuery("");
  }

  function openCollection(e: CatalogEntry) {
    if (e.kind !== "collection" || !e.collectionRepo) return;
    setView({ kind: "collection", source: "skillkit", repo: e.collectionRepo, name: e.name });
    setQuery("");
  }

  function backToCatalog() {
    setView({ kind: "catalog", source });
    setQuery("");
  }

  const visible = useMemo(() => searchCatalog(entries, query, 200), [entries, query]);
  const installedIds = useMemo(() => new Set(installedSkills.map((s) => s.id)), [installedSkills]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-background border-l border-primary/30 p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-primary/20">
          <SheetTitle className="font-display text-primary glow-text text-sm">
            🧩 Skill Marketplace
          </SheetTitle>
        </SheetHeader>

        {/* Source picker */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-primary/10">
          <span className="text-[10px] font-mono text-foreground-dim uppercase mr-1">Source:</span>
          <button
            onClick={() => switchSource("antigravity")}
            className={`text-[11px] px-2 py-1 rounded font-mono border ${
              source === "antigravity" ? "border-primary bg-primary/15 text-primary" : "border-primary/20 text-foreground-dim"
            }`}
          >
            antigravity
          </button>
          <button
            onClick={() => switchSource("skillkit")}
            className={`text-[11px] px-2 py-1 rounded font-mono border ${
              source === "skillkit" ? "border-primary bg-primary/15 text-primary" : "border-primary/20 text-foreground-dim"
            }`}
          >
            skillkit
          </button>
          <div className="flex-1" />
          <button
            onClick={() => load(true)}
            title="Refresh"
            className="p-1.5 rounded border border-primary/20 hover:border-primary/60 text-primary"
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
        </div>

        {tab === "browse" && (
          <>
            {/* Breadcrumb when inside a collection */}
            {view.kind === "collection" && (
              <div className="px-3 py-1.5 border-b border-primary/10 flex items-center gap-2 bg-background-elev/30">
                <button
                  onClick={backToCatalog}
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:underline"
                >
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
                placeholder={
                  view.kind === "catalog" && source === "skillkit"
                    ? "Filter collections (e.g. supabase, marketing)…"
                    : "Filter by name or id…"
                }
                className="flex-1 bg-background-elev2 border border-primary/20 rounded text-xs font-mono px-2 py-1 text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {loading && <div className="text-xs font-mono text-foreground-dim">Fetching…</div>}
              {!loading && visible.length === 0 && (
                <div className="text-xs font-mono text-foreground-dim">No matches.</div>
              )}
              {visible.map((e) => {
                const installed = installedIds.has(e.id);
                const active = activeSkill === e.id;
                const isCollection = e.kind === "collection";
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 p-2 rounded border border-primary/15 bg-background-elev/40 hover:border-primary/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-foreground truncate flex items-center gap-1.5">
                        {isCollection && <FolderOpen className="w-3 h-3 text-accent flex-shrink-0" />}
                        {e.name}
                      </div>
                      <div className="text-[10px] font-mono text-foreground-dim truncate">
                        {e.collectionRepo || e.id.replace(/^[^:]+:/, "")}
                      </div>
                      {e.description && (
                        <div className="text-[10px] font-mono text-foreground-dim truncate">{e.description}</div>
                      )}
                    </div>
                    <a href={e.url} target="_blank" rel="noreferrer" className="p-1 text-foreground-dim hover:text-primary" title="View on GitHub">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {isCollection ? (
                      <button
                        onClick={() => openCollection(e)}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-accent/40 hover:border-accent hover:bg-accent/10 text-accent font-mono"
                      >
                        Open
                      </button>
                    ) : installed ? (
                      <>
                        <button
                          onClick={() => setActiveSkill(active ? null : e.id)}
                          title={active ? "Deactivate" : "Activate"}
                          className={`p-1 rounded border ${
                            active ? "border-success bg-success/15 text-success" : "border-primary/30 text-primary"
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => uninstallSkill(e.id)}
                          title="Uninstall"
                          className="p-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleInstall(e)}
                        disabled={busyId === e.id}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-primary/40 hover:border-primary hover:bg-primary/10 text-primary font-mono"
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
                    <button
                      onClick={() => uninstallSkill(sk.id)}
                      className="p-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {sk.description && (
                    <div className="text-[10px] font-mono text-foreground-dim line-clamp-2">{sk.description}</div>
                  )}
                  {sk.risk && sk.risk !== "unknown" && (
                    <div className="text-[10px] font-mono text-warning">risk: {sk.risk}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
