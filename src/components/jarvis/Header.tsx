import { useJarvis, resolveActiveModel } from "@/store/jarvis";
import { Settings2, Rocket, Terminal as TerminalIcon, Cpu, Store, ChevronDown, KeyRound, Brain, Cloud, BellRing } from "lucide-react";
import { PROVIDERS } from "@/lib/providers";
import { useState } from "react";
import { GOD_SKILL_ID, buildGodSkill } from "@/lib/god-skill";
import { pushSkillsBulk, pullAllSkills } from "@/lib/sync";
import { registerPush } from "@/lib/push-notify";
import { toast } from "sonner";

type Props = {
  onOpenSettings: () => void;
  onOpenTerminal: () => void;
  onOpenMarketplace: () => void;
};

export const Header = ({ onOpenSettings, onOpenTerminal, onOpenMarketplace }: Props) => {
  const { activeModel, setActiveModel, autopilot, setAutopilot, github, installedSkills, providerKeys, customProviders, activeSkill, setActiveSkill, installSkill } = useJarvis();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const active = resolveActiveModel();
  const hasKey = !!active?.apiKey;
  const godActive = activeSkill === GOD_SKILL_ID;
  const shortLabel = active
    ? `${active.providerId.toString().replace("custom:", "")}/${active.modelId.split("/").pop()}`
    : "no model";

  const toggleGod = () => {
    if (godActive) { setActiveSkill(null); toast.info("GOD off"); return; }
    const all = installedSkills.filter((x) => x.id !== GOD_SKILL_ID);
    if (!all.length) { toast.error("Nema instaliranih skillova. Otvori Marketplace."); return; }
    const god = buildGodSkill(all);
    installSkill(god);
    setActiveSkill(GOD_SKILL_ID);
    toast.success(`🧠 GOD aktiviran (${all.length} skillova)`);
  };

  const doSync = async () => {
    setSyncing(true);
    try {
      const remote = await pullAllSkills();
      if (remote.length) await useJarvis.getState().installSkillsBulk(remote);
      const all = useJarvis.getState().installedSkills;
      await pushSkillsBulk(all);
      toast.success(`Sync: ↓${remote.length} ↑${all.length}`);
    } catch (e: any) {
      toast.error(`Sync fail: ${e.message}`);
    } finally { setSyncing(false); }
  };

  const enablePush = async () => {
    const r = await registerPush();
    r.ok ? toast.success(r.message) : toast.error(r.message);
  };

  return (
    <header className="flex items-center gap-1.5 px-2 sm:px-4 py-2 border-b border-primary/20 bg-background-elev/80 backdrop-blur-xl flex-shrink-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Cpu className="w-5 h-5 text-primary glow-text flex-shrink-0" />
        <div className="font-display font-bold text-primary glow-text text-sm sm:text-base truncate">
          J.A.R.V.I.S<span className="text-foreground-dim font-normal text-[10px] ml-1 hidden sm:inline">v4 · 2026</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Active model chip — opens picker */}
      <div className="relative">
        <button
          onClick={() => setPickerOpen((o) => !o)}
          title={active?.label || "Select provider/model"}
          className={`inline-flex items-center gap-1 bg-background-elev2 border rounded text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-1 max-w-[110px] sm:max-w-[180px] ${
            hasKey ? "border-primary/30 text-primary" : "border-warning/40 text-warning"
          }`}
        >
          {!hasKey && <KeyRound className="w-3 h-3 flex-shrink-0" />}
          <span className="truncate">{shortLabel}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </button>
        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-background-elev2 border border-primary/40 rounded shadow-glow w-[260px] max-h-[60vh] overflow-y-auto py-1">
              {PROVIDERS.map((p) => {
                const configured = !!providerKeys[p.id];
                return (
                  <div key={p.id} className="border-b border-primary/10 last:border-b-0">
                    <div className="flex items-center justify-between px-2 py-1 bg-background-elev/40">
                      <span className={`text-[10px] font-mono uppercase ${p.color}`}>{p.name}</span>
                      <span className={`text-[9px] font-mono ${configured ? "text-success" : "text-foreground-dim"}`}>
                        {configured ? "● configured" : "○ no key"}
                      </span>
                    </div>
                    {p.models.map((m) => {
                      const isActive = activeModel.providerId === p.id && activeModel.modelId === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setActiveModel({ providerId: p.id, modelId: m.id });
                            setPickerOpen(false);
                          }}
                          className={`w-full text-left text-[11px] font-mono px-3 py-1 hover:bg-primary/10 flex items-center justify-between ${
                            isActive ? "text-primary bg-primary/5" : "text-foreground-dim"
                          }`}
                        >
                          <span className="truncate">{m.label}</span>
                          <span className="text-[9px] text-foreground-dim ml-1 flex-shrink-0">
                            {m.free ? "FREE" : m.ctx}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {customProviders.map((cp) => (
                <div key={cp.id} className="border-b border-primary/10 last:border-b-0">
                  <div className="flex items-center justify-between px-2 py-1 bg-background-elev/40">
                    <span className="text-[10px] font-mono uppercase text-violet-400">{cp.name}</span>
                    <span className="text-[9px] font-mono text-success">● custom</span>
                  </div>
                  {cp.models.map((m) => {
                    const isActive = activeModel.providerId === cp.id && activeModel.modelId === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          setActiveModel({ providerId: cp.id, modelId: m.id });
                          setPickerOpen(false);
                        }}
                        className={`w-full text-left text-[11px] font-mono px-3 py-1 hover:bg-primary/10 ${
                          isActive ? "text-primary bg-primary/5" : "text-foreground-dim"
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              ))}
              <button
                onClick={() => { setPickerOpen(false); onOpenSettings(); }}
                className="w-full text-left text-[10px] font-mono px-3 py-1.5 text-primary hover:bg-primary/10 border-t border-primary/20"
              >
                + Manage providers & keys
              </button>
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => setAutopilot(!autopilot)}
        title={`Autopilot ${autopilot ? "ON" : "OFF"}`}
        className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-1 rounded border font-mono uppercase tracking-wider transition ${
          autopilot
            ? "border-success bg-success/15 text-success shadow-[0_0_12px_hsl(var(--success)/0.5)]"
            : "border-primary/30 text-primary/70 hover:border-primary/60"
        }`}
      >
        <Rocket className="w-3 h-3" />
        <span className="hidden xs:inline sm:inline">AUTO</span>
      </button>

      {github ? (
        <span title={`GitHub: ${github.user}${github.defaultRepo ? " · " + github.defaultRepo : ""}`} className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-success/40 bg-success/10 text-success">
          ⌥ {github.user}
        </span>
      ) : (
        <span title="GitHub not configured — open Settings → GitHub" className="hidden md:inline-flex text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-warning/40 bg-warning/10 text-warning">
          NO-GH
        </span>
      )}

      <button
        onClick={toggleGod}
        title={godActive ? "GOD aktivan — klik za off" : "Aktiviraj GOD meta-skill"}
        className={`p-1.5 rounded border transition ${godActive ? "border-primary bg-primary/20 text-primary shadow-glow" : "border-primary/20 hover:border-primary/60 text-primary"}`}
      >
        <Brain className="w-4 h-4" />
      </button>
      <button onClick={doSync} disabled={syncing} title="Cloud sync (skills + chat)" className="p-1.5 rounded border border-primary/20 hover:border-primary/60 hover:bg-primary/10 text-primary transition disabled:opacity-50">
        <Cloud className={`w-4 h-4 ${syncing ? "animate-pulse" : ""}`} />
      </button>
      <button onClick={enablePush} title="Enable push notifications" className="hidden sm:inline-flex p-1.5 rounded border border-primary/20 hover:border-primary/60 hover:bg-primary/10 text-primary transition">
        <BellRing className="w-4 h-4" />
      </button>
      <button onClick={onOpenMarketplace} title={`Skill Marketplace (${installedSkills.length} installed)`} className="relative p-1.5 rounded border border-primary/20 hover:border-primary/60 hover:bg-primary/10 text-primary transition">
        <Store className="w-4 h-4" />
        {installedSkills.length > 0 && (
          <span className="absolute -top-1 -right-1 text-[9px] font-mono bg-primary text-background rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center">
            {installedSkills.length}
          </span>
        )}
      </button>
      <button onClick={onOpenTerminal} title="Terminal" className="p-1.5 rounded border border-primary/20 hover:border-primary/60 hover:bg-primary/10 text-primary transition">
        <TerminalIcon className="w-4 h-4" />
      </button>
      <button onClick={onOpenSettings} title="Settings" className="p-1.5 rounded border border-primary/20 hover:border-primary/60 hover:bg-primary/10 text-primary transition">
        <Settings2 className="w-4 h-4" />
      </button>
    </header>
  );
};
