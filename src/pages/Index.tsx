import { useEffect, useState } from "react";
import { Header } from "@/components/jarvis/Header";
import { ChatStream } from "@/components/jarvis/ChatStream";
import { SkillBar } from "@/components/jarvis/SkillBar";
import { Composer } from "@/components/jarvis/Composer";
import { SettingsSheet } from "@/components/jarvis/SettingsSheet";
import { TerminalSheet } from "@/components/jarvis/TerminalSheet";
import { useJarvis } from "@/store/jarvis";
import { runAgent } from "@/lib/agent";
import { toast } from "sonner";

const Index = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const { addMessage, updateMessage, isAgentBusy, enqueue, drainQueue, uploads } = useJarvis();

  // Drain queue when agent becomes free
  useEffect(() => {
    if (!isAgentBusy) {
      const next = useJarvis.getState().drainQueue();
      if (next) submit(next, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgentBusy]);

  const submit = async (text: string, fromQueue = false) => {
    if (useJarvis.getState().isAgentBusy && !fromQueue) {
      enqueue(text);
      toast.info("Dodano u queue — agent radi.");
      return;
    }
    const userMsg = {
      id: Math.random().toString(36).slice(2),
      role: "user" as const,
      content: text,
      ts: Date.now(),
      attachments: uploads.length ? uploads.map((u) => ({ name: u.name, url: u.url, size: u.size, type: u.type })) : undefined,
    };
    addMessage(userMsg);

    let currentAssistantId = "";
    await runAgent(text, {
      onAssistantStart: (id) => {
        currentAssistantId = id;
        addMessage({ id, role: "assistant", content: "", ts: Date.now(), streaming: true });
      },
      onDelta: (id, t) => {
        const cur = useJarvis.getState().messages.find((m) => m.id === id);
        updateMessage(id, { content: (cur?.content || "") + t });
      },
      onToolCall: () => {},
      onToolResult: (toolId, name, result) => {
        addMessage({
          id: Math.random().toString(36).slice(2),
          role: "tool",
          toolCallId: toolId,
          toolName: name,
          content: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          ts: Date.now(),
        });
      },
      onEval: (id, ev) => updateMessage(id, { evalResult: ev }),
      onDone: (id) => updateMessage(id, { streaming: false }),
      onError: (msg) => {
        toast.error(msg);
        if (currentAssistantId) updateMessage(currentAssistantId, { streaming: false, content: `⚠️ ${msg}` });
      },
    });
  };

  return (
    <main className="flex flex-col h-screen bg-gradient-bg">
      <Header onOpenSettings={() => setSettingsOpen(true)} onOpenTerminal={() => setTerminalOpen(true)} />
      <SkillBar />
      <ChatStream />
      <Composer onSend={submit} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TerminalSheet open={terminalOpen} onOpenChange={setTerminalOpen} />
    </main>
  );
};

export default Index;
