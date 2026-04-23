// Tools Panel: lists all registered tools grouped by category, lets the user
// enable/disable each one. Disabled tools are stripped from the request the
// chat edge function sends to the model.
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TOOL_REGISTRY, TOOL_CATEGORIES, type ToolMeta } from "@/lib/tools-registry";
import { useJarvis } from "@/store/jarvis";
import { Wrench, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

type Props = { open: boolean; onOpenChange: (b: boolean) => void };

const RiskIcon = ({ r }: { r: ToolMeta["risk"] }) => {
  if (r === "safe") return <ShieldCheck className="w-3.5 h-3.5 text-success" />;
  if (r === "medium") return <ShieldQuestion className="w-3.5 h-3.5 text-warning" />;
  return <ShieldAlert className="w-3.5 h-3.5 text-destructive" />;
};

export const ToolsSheet = ({ open, onOpenChange }: Props) => {
  const { disabledTools, toggleTool, enableAllTools, disableAllTools } = useJarvis();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-background border-l border-primary/30 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-primary glow-text font-display">
            <Wrench className="w-5 h-5" /> Tools Panel
          </SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex items-center justify-between text-[11px] font-mono">
          <span className="text-foreground-dim">
            {TOOL_REGISTRY.length - disabledTools.length}/{TOOL_REGISTRY.length} aktivnih
          </span>
          <div className="flex gap-2">
            <button onClick={enableAllTools} className="px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10">Sve ON</button>
            <button onClick={disableAllTools} className="px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10">Sve OFF</button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {TOOL_CATEGORIES.map((cat) => {
            const items = TOOL_REGISTRY.filter((t) => t.category === cat.id);
            if (!items.length) return null;
            return (
              <section key={cat.id}>
                <div className="text-[10px] font-mono uppercase tracking-widest text-primary/70 mb-1.5 border-b border-primary/15 pb-1">
                  {cat.label} <span className="text-foreground-dim">({items.length})</span>
                </div>
                <ul className="space-y-1">
                  {items.map((t) => {
                    const enabled = !disabledTools.includes(t.name);
                    return (
                      <li key={t.name} className="flex items-start justify-between gap-2 px-2 py-1.5 rounded border border-primary/10 bg-background-elev/40">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <RiskIcon r={t.risk} />
                            <code className="text-[11px] font-mono text-primary truncate">{t.name}</code>
                          </div>
                          <div className="text-[10px] text-foreground-dim mt-0.5 leading-tight">{t.description}</div>
                        </div>
                        <button
                          onClick={() => toggleTool(t.name)}
                          className={`text-[10px] font-mono px-2 py-1 rounded border flex-shrink-0 transition ${
                            enabled
                              ? "border-success/50 bg-success/15 text-success"
                              : "border-foreground-dim/30 text-foreground-dim hover:border-primary/40"
                          }`}
                        >
                          {enabled ? "ON" : "OFF"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
