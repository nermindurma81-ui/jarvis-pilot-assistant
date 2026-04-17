import { SKILLS } from "@/lib/skills";
import { useJarvis } from "@/store/jarvis";
import { Sparkles, X } from "lucide-react";

export const SkillBar = () => {
  const { activeSkill, setActiveSkill, installedSkills } = useJarvis();
  const builtin = SKILLS.find((s) => s.id === activeSkill);
  const installed = installedSkills.find((s) => s.id === activeSkill);
  const active = builtin
    ? { id: builtin.id, name: builtin.name, icon: builtin.icon }
    : installed
    ? { id: installed.id, name: installed.name, icon: "🧩" }
    : null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-y border-primary/15 bg-background-elev/40 overflow-x-auto flex-shrink-0">
      <Sparkles className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
      {active ? (
        <button
          onClick={() => setActiveSkill(null)}
          className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded bg-primary/20 border border-primary text-primary font-mono uppercase tracking-wider"
        >
          {active.icon} {active.name} <X className="w-3 h-3" />
        </button>
      ) : (
        <>
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
              🧩 {s.name}
            </button>
          ))}
        </>
      )}
    </div>
  );
};
