// Tools Panel: lists all registered tools grouped by category, lets the user
// enable/disable each one. Disabled tools are stripped from the request the
// chat edge function sends to the model.
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TOOL_REGISTRY, TOOL_CATEGORIES, type ToolMeta } from "@/lib/tools-registry";
import { useJarvis } from "@/store/jarvis";
import { Wrench, ShieldAlert, ShieldCheck, ShieldQuestion, Server, Copy } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (b: boolean) => void };

const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-server`;

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

        {/* MCP server endpoint — paste into Claude Desktop / Cursor / any MCP client */}
        <section className="mt-4 rounded border border-primary/30 bg-primary/5 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-primary/80 mb-1">
            <Server className="w-3 h-3" /> MCP Server Endpoint
          </div>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 min-w-0 text-[10px] font-mono text-foreground bg-background/60 rounded px-2 py-1 truncate">
              {MCP_URL}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(MCP_URL);
                toast.success("MCP URL kopiran");
              }}
              className="flex-shrink-0 p-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10"
              aria-label="Copy MCP URL"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[10px] text-foreground-dim mt-1.5 leading-tight">
            Streamable HTTP. Tools: <code className="text-primary/80">web_search, web_fetch, http_fetch, skill_search, ping</code>.
          </p>
        </section>

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
