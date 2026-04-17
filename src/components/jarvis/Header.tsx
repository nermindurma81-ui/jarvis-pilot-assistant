import { useJarvis, MODELS } from "@/store/jarvis";
import { Settings2, Rocket, Terminal as TerminalIcon, Cpu } from "lucide-react";

type Props = {
  onOpenSettings: () => void;
  onOpenTerminal: () => void;
};

export const Header = ({ onOpenSettings, onOpenTerminal }: Props) => {
  const { model, setModel, autopilot, setAutopilot, audit } = useJarvis();
  const allowedTools = audit.repoWrite ? "REPO+RW" : "RO";

  return (
    <header className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-primary/20 bg-background-elev/80 backdrop-blur-xl flex-shrink-0">
      <div className="flex items-center gap-1.5">
        <Cpu className="w-5 h-5 text-primary glow-text" />
        <div className="font-display font-bold text-primary glow-text text-sm sm:text-base">
          J.A.R.V.I.S<span className="text-foreground-dim font-normal text-[10px] ml-1">v4 · 2026</span>
        </div>
      </div>

      <div className="flex-1" />

      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="bg-background-elev2 border border-primary/30 rounded text-[11px] font-mono px-2 py-1 text-foreground max-w-[140px] focus:outline-none focus:border-primary focus:shadow-glow"
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>

      <button
        onClick={() => setAutopilot(!autopilot)}
        title={`Autopilot ${autopilot ? "ON" : "OFF"}`}
        className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border font-mono uppercase tracking-wider transition ${
          autopilot
            ? "border-success bg-success/15 text-success shadow-[0_0_12px_hsl(var(--success)/0.5)]"
            : "border-primary/30 text-primary/70 hover:border-primary/60"
        }`}
      >
        <Rocket className="w-3 h-3" />
        <span className="hidden sm:inline">{autopilot ? "AUTO" : "AUTO"}</span>
      </button>

      <span className="hidden sm:inline-flex text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-success/40 bg-success/10 text-success">
        {allowedTools}
      </span>

      <button onClick={onOpenTerminal} title="Terminal" className="p-1.5 rounded border border-primary/20 hover:border-primary/60 hover:bg-primary/10 text-primary transition">
        <TerminalIcon className="w-4 h-4" />
      </button>
      <button onClick={onOpenSettings} title="Settings" className="p-1.5 rounded border border-primary/20 hover:border-primary/60 hover:bg-primary/10 text-primary transition">
        <Settings2 className="w-4 h-4" />
      </button>
    </header>
  );
};
