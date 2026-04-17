import { useEffect, useRef } from "react";
import { useJarvis } from "@/store/jarvis";
import { MessageBubble } from "./MessageBubble";

export const ChatStream = () => {
  const { messages, isAgentBusy } = useJarvis();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-5 relative scan-line">
      {messages.length === 0 && (
        <div className="m-auto text-center max-w-md animate-fade-up">
          <div className="font-display text-2xl sm:text-3xl font-bold text-primary glow-text mb-2">
            J.A.R.V.I.S v4
          </div>
          <div className="text-foreground-dim text-sm font-mono">
            Autonomous execution agent.
            <br />
            <span className="text-primary/70">Skills · Autopilot · eval_response · Terminal · CLI</span>
          </div>
          <div className="text-[11px] text-foreground-dim/60 mt-4 font-mono">
            Pošalji bilo šta — agent izvršava, ne objašnjava.
          </div>
        </div>
      )}
      {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
      {isAgentBusy && (
        <div className="self-start text-[10px] font-mono uppercase tracking-wider text-primary/70 inline-flex items-center gap-2">
          <span className="pulse-dot" /> processing
        </div>
      )}
    </div>
  );
};
