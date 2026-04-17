import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolCallId?: string;
  toolCalls?: any[];
  attachments?: { name: string; url: string; size: number; type: string }[];
  ts: number;
  streaming?: boolean;
  evalResult?: { score: number; passed: boolean; gaps?: string[] };
};

export type JarvisDoc = { name: string; content: string; tags?: string[]; ts: number };

export type AuditFlags = {
  repoWrite: boolean;
  workflowDispatch: boolean;
  allowlist: string[];
};

export type UploadedFile = { name: string; url: string; size: number; type: string; textPreview?: string };

export type GithubAuth = { token: string; user: string; defaultRepo?: string } | null;

type Store = {
  // Chat
  messages: ChatMessage[];
  msgQueue: string[];
  isAgentBusy: boolean;
  // Settings
  model: string;
  autopilot: boolean;
  evalRequired: boolean;
  audit: AuditFlags;
  activeSkill: string | null;
  // Data
  docs: JarvisDoc[];
  uploads: UploadedFile[];
  github: GithubAuth;
  // Mutators
  addMessage: (m: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  enqueue: (text: string) => void;
  drainQueue: () => string | null;
  setAgentBusy: (b: boolean) => void;
  setModel: (m: string) => void;
  setAutopilot: (b: boolean) => void;
  setEvalRequired: (b: boolean) => void;
  setActiveSkill: (id: string | null) => void;
  setAudit: (patch: Partial<AuditFlags>) => void;
  addAllowlist: (host: string) => void;
  removeAllowlist: (host: string) => void;
  saveDoc: (d: Omit<JarvisDoc, "ts">) => void;
  deleteDoc: (name: string) => void;
  addUpload: (u: UploadedFile) => void;
  removeUpload: (name: string) => void;
};

export const useJarvis = create<Store>()(
  persist(
    (set, get) => ({
      messages: [],
      msgQueue: [],
      isAgentBusy: false,
      model: "google/gemini-3-flash-preview",
      autopilot: false,
      evalRequired: true,
      audit: {
        repoWrite: false,
        workflowDispatch: false,
        allowlist: [
          "api.github.com",
          "api.vercel.com",
          "api.railway.app",
          "generativelanguage.googleapis.com",
          "ai.gateway.lovable.dev",
        ],
      },
      activeSkill: null,
      docs: [],
      uploads: [],

      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      updateMessage: (id, patch) =>
        set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      clearMessages: () => set({ messages: [] }),
      enqueue: (text) => set((s) => ({ msgQueue: [...s.msgQueue, text] })),
      drainQueue: () => {
        const q = get().msgQueue;
        if (!q.length) return null;
        const [head, ...rest] = q;
        set({ msgQueue: rest });
        return head;
      },
      setAgentBusy: (b) => set({ isAgentBusy: b }),
      setModel: (m) => set({ model: m }),
      setAutopilot: (b) => set({ autopilot: b }),
      setEvalRequired: (b) => set({ evalRequired: b }),
      setActiveSkill: (id) => set({ activeSkill: id }),
      setAudit: (patch) => set((s) => ({ audit: { ...s.audit, ...patch } })),
      addAllowlist: (host) =>
        set((s) => ({ audit: { ...s.audit, allowlist: Array.from(new Set([...s.audit.allowlist, host])) } })),
      removeAllowlist: (host) =>
        set((s) => ({ audit: { ...s.audit, allowlist: s.audit.allowlist.filter((h) => h !== host) } })),
      saveDoc: (d) =>
        set((s) => ({
          docs: [{ ...d, ts: Date.now() }, ...s.docs.filter((x) => x.name !== d.name)],
        })),
      deleteDoc: (name) => set((s) => ({ docs: s.docs.filter((d) => d.name !== name) })),
      addUpload: (u) => set((s) => ({ uploads: [...s.uploads.filter((x) => x.name !== u.name), u] })),
      removeUpload: (name) => set((s) => ({ uploads: s.uploads.filter((u) => u.name !== name) })),
    }),
    {
      name: "jarvis-v4-store",
      partialize: (s) => ({
        messages: s.messages.slice(-200),
        model: s.model,
        autopilot: s.autopilot,
        evalRequired: s.evalRequired,
        audit: s.audit,
        activeSkill: s.activeSkill,
        docs: s.docs,
        uploads: s.uploads,
      }),
    }
  )
);

export const MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (default)" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "openai/gpt-5", label: "GPT-5" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano" },
  { id: "openai/gpt-5.2", label: "GPT-5.2" },
];
