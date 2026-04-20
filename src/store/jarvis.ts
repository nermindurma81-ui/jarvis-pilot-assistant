import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FetchedSkill } from "@/lib/skill-marketplace";
import type { ProviderId, CustomProvider } from "@/lib/providers";
import { DEFAULT_SYSTEM_PROMPT, SYSTEM_PROMPT_PRESETS, PROVIDERS } from "@/lib/providers";

// Quota-safe localStorage: on QuotaExceeded, progressively trim and retry so the app never breaks.
const safeStorage = {
  getItem: (name: string) => {
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: (name: string, value: string) => {
    try { localStorage.setItem(name, value); return; } catch {}
    try {
      const parsed = JSON.parse(value);
      const st = parsed?.state;
      if (st) {
        if (Array.isArray(st.uploads)) st.uploads = st.uploads.map((u: any) => ({ ...u, textPreview: undefined }));
        try { localStorage.setItem(name, JSON.stringify(parsed)); return; } catch {}
        if (Array.isArray(st.messages)) st.messages = st.messages.slice(-50);
        try { localStorage.setItem(name, JSON.stringify(parsed)); return; } catch {}
        if (Array.isArray(st.messages)) st.messages = st.messages.slice(-10);
        try { localStorage.setItem(name, JSON.stringify(parsed)); return; } catch {}
        st.messages = [];
        try { localStorage.setItem(name, JSON.stringify(parsed)); return; } catch {}
        st.docs = [];
        try { localStorage.setItem(name, JSON.stringify(parsed)); return; } catch {}
      }
    } catch {}
    try { localStorage.removeItem(name); } catch {}
  },
  removeItem: (name: string) => {
    try { localStorage.removeItem(name); } catch {}
  },
};

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

// Per-provider stored API key (browser-only)
export type ProviderKeys = Partial<Record<ProviderId, string>>;

// Currently selected model = which provider + which model id
export type ActiveModel = {
  providerId: ProviderId | string; // string allows custom:slug
  modelId: string;
};

export type SystemPromptPreset = { id: string; name: string; prompt: string };

type Store = {
  // Chat
  messages: ChatMessage[];
  msgQueue: string[];
  isAgentBusy: boolean;
  // Providers / models
  providerKeys: ProviderKeys;
  customProviders: CustomProvider[];
  activeModel: ActiveModel;
  // System prompt
  systemPrompt: string;
  presets: SystemPromptPreset[];
  // Settings
  autopilot: boolean;
  evalRequired: boolean;
  audit: AuditFlags;
  activeSkill: string | null;
  installedSkills: FetchedSkill[];
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
  setProviderKey: (id: ProviderId, key: string) => void;
  removeProviderKey: (id: ProviderId) => void;
  addCustomProvider: (p: CustomProvider) => void;
  removeCustomProvider: (id: string) => void;
  setActiveModel: (a: ActiveModel) => void;
  setSystemPrompt: (s: string) => void;
  resetSystemPrompt: () => void;
  savePreset: (p: SystemPromptPreset) => void;
  deletePreset: (id: string) => void;
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
  setGithub: (g: GithubAuth) => void;
  installSkill: (s: FetchedSkill) => void;
  uninstallSkill: (id: string) => void;
};

const DEFAULT_ACTIVE: ActiveModel = {
  providerId: "openai",
  modelId: "gpt-4o-mini",
};

export const useJarvis = create<Store>()(
  persist(
    (set, get) => ({
      messages: [],
      msgQueue: [],
      isAgentBusy: false,
      providerKeys: {},
      customProviders: [],
      activeModel: DEFAULT_ACTIVE,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      presets: SYSTEM_PROMPT_PRESETS,
      autopilot: false,
      evalRequired: true,
      audit: {
        repoWrite: false,
        workflowDispatch: false,
        allowlist: [
          "api.github.com",
          "api.openai.com",
          "api.anthropic.com",
          "generativelanguage.googleapis.com",
          "api.mistral.ai",
          "api.deepseek.com",
          "openrouter.ai",
        ],
      },
      activeSkill: null,
      installedSkills: [],
      docs: [],
      uploads: [],
      github: null,

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
      setProviderKey: (id, key) =>
        set((s) => ({ providerKeys: { ...s.providerKeys, [id]: key } })),
      removeProviderKey: (id) =>
        set((s) => {
          const next = { ...s.providerKeys };
          delete next[id];
          return { providerKeys: next };
        }),
      addCustomProvider: (p) =>
        set((s) => ({
          customProviders: [...s.customProviders.filter((x) => x.id !== p.id), p],
        })),
      removeCustomProvider: (id) =>
        set((s) => ({
          customProviders: s.customProviders.filter((x) => x.id !== id),
          activeModel:
            s.activeModel.providerId === id ? DEFAULT_ACTIVE : s.activeModel,
        })),
      setActiveModel: (a) => set({ activeModel: a }),
      setSystemPrompt: (sp) => set({ systemPrompt: sp }),
      resetSystemPrompt: () => set({ systemPrompt: DEFAULT_SYSTEM_PROMPT }),
      savePreset: (p) =>
        set((s) => ({ presets: [...s.presets.filter((x) => x.id !== p.id), p] })),
      deletePreset: (id) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
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
      setGithub: (g) => set({ github: g }),
      installSkill: (sk) =>
        set((s) => ({ installedSkills: [sk, ...s.installedSkills.filter((x) => x.id !== sk.id)] })),
      uninstallSkill: (id) =>
        set((s) => ({
          installedSkills: s.installedSkills.filter((x) => x.id !== id),
          activeSkill: s.activeSkill === id ? null : s.activeSkill,
        })),
    }),
    {
      name: "jarvis-v4-store",
      version: 2,
      migrate: (persisted: any) => {
        // v1 -> v2: drop legacy `model`, seed activeModel
        if (persisted && !persisted.activeModel) {
          persisted.activeModel = DEFAULT_ACTIVE;
        }
        if (persisted && !persisted.providerKeys) persisted.providerKeys = {};
        if (persisted && !persisted.customProviders) persisted.customProviders = [];
        if (persisted && !persisted.systemPrompt) persisted.systemPrompt = DEFAULT_SYSTEM_PROMPT;
        if (persisted && !persisted.presets) persisted.presets = SYSTEM_PROMPT_PRESETS;
        return persisted;
      },
      partialize: (s) => ({
        messages: s.messages.slice(-200),
        providerKeys: s.providerKeys,
        customProviders: s.customProviders,
        activeModel: s.activeModel,
        systemPrompt: s.systemPrompt,
        presets: s.presets,
        autopilot: s.autopilot,
        evalRequired: s.evalRequired,
        audit: s.audit,
        activeSkill: s.activeSkill,
        installedSkills: s.installedSkills,
        docs: s.docs,
        uploads: s.uploads,
        github: s.github,
      }),
    }
  )
);

// Helper: resolve currently active model definition (built-in or custom)
export const resolveActiveModel = () => {
  const s = useJarvis.getState();
  const { providerId, modelId } = s.activeModel;
  if (typeof providerId === "string" && providerId.startsWith("custom:")) {
    const custom = s.customProviders.find((c) => c.id === providerId);
    if (!custom) return null;
    return {
      providerId,
      modelId,
      apiKey: custom.apiKey,
      baseUrl: custom.baseUrl,
      apiStyle: "openai" as const,
      label: `${custom.name} · ${modelId}`,
    };
  }
  const def = PROVIDERS.find((p) => p.id === providerId);
  if (!def) return null;
  const apiKey = s.providerKeys[def.id];
  const m = def.models.find((x) => x.id === modelId);
  return {
    providerId: def.id,
    modelId,
    apiKey: apiKey || "",
    baseUrl: def.baseUrl,
    apiStyle: def.apiStyle,
    label: m ? `${def.name} · ${m.label}` : `${def.name} · ${modelId}`,
  };
};
