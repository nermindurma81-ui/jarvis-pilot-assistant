import { SKILLS } from "@/lib/skills";
import { useJarvis } from "@/store/jarvis";
import { Sparkles, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { GOOSE_AGENT, fetchGoosePrompt, fetchAllGooseSkills } from "@/lib/goose-agent";
import { toast } from "sonner";

export const SkillBar = () => {
  const { activeSkill, setActiveSkill, installedSkills, installSkill } = useJarvis();
  const [gooseLoading, setGooseLoading] = useState(false);
  const builtin = SKILLS.find((s) => s.id === activeSkill);
  const installed = installedSkills.find((s) => s.id === activeSkill);
  const active = builtin
    ? { id: builtin.id, name: builtin.name, icon: builtin.icon }
    : installed
    ? { id: installed.id, name: installed.name, icon: installed.id.startsWith("goose") ? "🪿" : "🧩" }
    : null;

  const activateGoose = async () => {
    setGooseLoading(true);
    try {
      const [prompt, skills] = await Promise.all([fetchGoosePrompt(), fetchAllGooseSkills()]);
      // Install Goose persona as a skill so resolver picks it up.
      installSkill({
        id: GOOSE_AGENT.id,
        name: GOOSE_AGENT.name,
        description: GOOSE_AGENT.description,
        source: "aaif-goose/goose",
        prompt,
        fetchedAt: Date.now(),
        rawUrl: GOOSE_AGENT.systemPromptUrl,
      });
      // Auto-install all 4 Goose .agents skills.
      skills.forEach(installSkill);
      setActiveSkill(GOOSE_AGENT.id);
      toast.success(`🪿 Goose aktiviran + ${skills.length} skill-ova instalirano`);
    } catch (e: any) {
      toast.error(`Goose load failed: ${e.message}`);
    } finally {
      setGooseLoading(false);
    }
  };

  const gooseInstalled = installedSkills.some((s) => s.id === GOOSE_AGENT.id);

  return (
    <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 border-y border-primary/15 bg-background-elev/40 overflow-x-auto flex-shrink-0 scrollbar-thin">
      <Sparkles className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
      {active ? (
        <button
          onClick={() => setActiveSkill(null)}
          className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded bg-primary/20 border border-primary text-primary font-mono uppercase tracking-wider whitespace-nowrap"
        >
          {active.icon} {active.name} <X className="w-3 h-3" />
        </button>
      ) : (
        <>
          {/* Goose persona — special button */}
          <button
            onClick={gooseInstalled ? () => setActiveSkill(GOOSE_AGENT.id) : activateGoose}
            disabled={gooseLoading}
            title={gooseInstalled ? "Aktiviraj Goose agenta" : "Install + activate Goose agent (aaif-goose/goose)"}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-warning/40 bg-warning/5 hover:bg-warning/15 hover:border-warning text-warning font-mono whitespace-nowrap transition disabled:opacity-50"
          >
            {gooseLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>🪿</span>}
            Goose{!gooseInstalled && !gooseLoading && " +install"}
          </button>
          {SKILLS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSkill(s.id)}
              title={s.description}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-primary/25 hover:border-primary hover:bg-primary/10 text-foreground-dim hover:text-primary font-mono whitespace-nowrap transition"
            >
              <span>{s.icon}</span> {s.name}
            </button>
          ))}
          {installedSkills.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSkill(s.id)}
              title={s.description || s.id}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-accent/30 hover:border-accent hover:bg-accent/10 text-foreground-dim hover:text-accent font-mono whitespace-nowrap transition"
            >
              {s.id.startsWith("goose") ? "🪿" : "🧩"} {s.name}
            </button>
          ))}
        </>
      )}
    </div>
  );
};
