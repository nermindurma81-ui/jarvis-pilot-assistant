import { useJarvis, MODELS } from "@/store/jarvis";
import { Settings2, Rocket, Terminal as TerminalIcon, Cpu, Store, ChevronDown } from "lucide-react";
import { useState } from "react";

type Props = {
  onOpenSettings: () => void;
  onOpenTerminal: () => void;
  onOpenMarketplace: () => void;
};

export const Header = ({ onOpenSettings, onOpenTerminal, onOpenMarketplace }: Props) => {
  const { model, setModel, autopilot, setAutopilot, github, installedSkills } = useJarvis();
  const [modelOpen, setModelOpen] = useState(false);
  const currentModel = MODELS.find((m) => m.id === model)?.label || model;

  return (
    <header className="flex items-center gap-1.5 px-2 sm:px-4 py-2 border-b border-primary/20 bg-background-elev/80 backdrop-blur-xl flex-shrink-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Cpu className="w-5 h-5 text-primary glow-text flex-shrink-0" />
        <div className="font-display font-bold text-primary glow-text text-sm sm:text-base truncate">
          J.A.R.V.I.S<span className="text-foreground-dim font-normal text-[10px] ml-1 hidden sm:inline">v4 · 2026</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Desktop: full select. Mobile: compact button that opens dropdown. */}
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="hidden sm:block bg-background-elev2 border border-primary/30 rounded text-[11px] font-mono px-2 py-1 text-foreground max-w-[160px] focus:outline-none focus:border-primary focus:shadow-glow"
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>

      <div className="sm:hidden relative">
        <button
          onClick={() => setModelOpen((o) => !o)}
          title={currentModel}
          className="inline-flex items-center gap-1 bg-background-elev2 border border-primary/30 rounded text-[10px] font-mono px-1.5 py-1 text-primary max-w-[80px]"
        >
          <span className="truncate">{currentModel.replace(/Gemini |GPT-/, "").split(" ")[0]}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </button>
        {modelOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-background-elev2 border border-primary/40 rounded shadow-glow min-w-[180px] py-1">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m.id); setModelOpen(false); }}
                  className={`w-full text-left text-[11px] font-mono px-3 py-1.5 hover:bg-primary/10 ${m.id === model ? "text-primary bg-primary/5" : "text-foreground-dim"}`}
                >
                  {m.label}
                </button>
              ))}
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
