import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, FileText, Wrench, AlertCircle } from "lucide-react";
import type { ChatMessage } from "@/store/jarvis";
import { Button } from "@/components/ui/button";

const CopyBtn = ({ text, label = "Copy" }: { text: string; label?: string }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary/70 hover:text-primary transition px-2 py-1 rounded border border-primary/20 hover:border-primary/50 bg-background-elev/50"
    >
      {done ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {done ? "OK" : label}
    </button>
  );
};

export const MessageBubble = memo(({ m }: { m: ChatMessage }) => {
  const isUser = m.role === "user";
  const isTool = m.role === "tool";

  if (isTool) {
    return (
      <div className="self-start max-w-[92%] animate-fade-up">
        <div className="text-[10px] font-mono uppercase tracking-wider text-primary/60 mb-1 flex items-center gap-1">
          <Wrench className="w-3 h-3" /> tool · {m.toolName}
        </div>
        <pre className="font-mono text-[11px] bg-background-elev/60 border border-primary/15 rounded-md px-3 py-2 overflow-x-auto text-foreground-dim max-h-48">
          {m.content}
        </pre>
      </div>
    );
  }

  return (
    <div className={`max-w-[92%] flex flex-col gap-1 animate-fade-up ${isUser ? "self-end items-end" : "self-start items-start"}`}>
      <div className="text-[10px] font-mono uppercase tracking-wider text-primary/50">
        {isUser ? "you" : "jarvis"}
        {m.streaming && <span className="ml-2 text-primary"><span className="pulse-dot" /></span>}
      </div>
      <div
        className={`relative group rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed break-words ${
          isUser
            ? "bg-primary/15 border border-primary/40 text-foreground rounded-br-sm"
            : "bg-card/80 border border-primary/20 rounded-bl-sm"
        }`}
      >
        {m.attachments?.length ? (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {m.attachments.map((a) => (
              <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] bg-background-elev/70 border border-primary/25 rounded px-2 py-0.5 text-primary hover:bg-primary/10">
                <FileText className="w-3 h-3" /> {a.name}
              </a>
            ))}
          </div>
        ) : null}

        {isUser ? (
          <div className="whitespace-pre-wrap">{m.content}</div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:text-primary prose-headings:font-display prose-strong:text-foreground prose-code:text-primary-glow prose-code:before:hidden prose-code:after:hidden prose-pre:bg-transparent prose-pre:p-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const code = String(children).replace(/\n$/, "");
                  if (!inline && (match || code.includes("\n"))) {
                    return (
                      <div className="relative my-2 rounded-md overflow-hidden border border-primary/25 bg-[#0a0a0f]">
                        <div className="flex items-center justify-between px-2.5 py-1 border-b border-primary/15 bg-background-elev/80">
                          <span className="text-[10px] font-mono uppercase text-primary/70">{match?.[1] || "code"}</span>
                          <CopyBtn text={code} />
                        </div>
                        <SyntaxHighlighter
                          language={match?.[1] || "text"}
                          style={atomDark as any}
                          customStyle={{ margin: 0, padding: "10px 12px", background: "transparent", fontSize: "12px" }}
                          wrapLongLines
                        >
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return <code className={className} {...props}>{children}</code>;
                },
              }}
            >
              {m.content || (m.streaming ? "..." : "")}
            </ReactMarkdown>
          </div>
        )}

        {!isUser && !m.streaming && m.content && (
          <div className="absolute -bottom-7 left-0 opacity-0 group-hover:opacity-100 transition flex gap-1.5">
            <CopyBtn text={m.content} label="Copy answer" />
          </div>
        )}
      </div>

      {m.evalResult && (
        <div className={`mt-1 inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border ${m.evalResult.passed ? "border-success/40 text-success bg-success/10" : "border-warning/40 text-warning bg-warning/10"}`}>
          {m.evalResult.passed ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          eval {m.evalResult.score}/10 {m.evalResult.passed ? "passed" : "needs work"}
        </div>
      )}
    </div>
  );
});
MessageBubble.displayName = "MessageBubble";
