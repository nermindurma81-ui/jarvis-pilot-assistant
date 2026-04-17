import { SKILLS } from "@/lib/skills";
import { useJarvis } from "@/store/jarvis";
import { Sparkles, X } from "lucide-react";

export const SkillBar = () => {
  const { activeSkill, setActiveSkill } = useJarvis();
  const active = SKILLS.find((s) => s.id === activeSkill);

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
        SKILLS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSkill(s.id)}
            title={s.description}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-primary/25 hover:border-primary hover:bg-primary/10 text-foreground-dim hover:text-primary font-mono whitespace-nowrap transition"
          >
            <span>{s.icon}</span> {s.name}
          </button>
        ))
      )}
    </div>
  );
};
