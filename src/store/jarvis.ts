import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FetchedSkill } from "@/lib/skill-marketplace";
import type { ProviderId, CustomProvider } from "@/lib/providers";
import { DEFAULT_SYSTEM_PROMPT, SYSTEM_PROMPT_PRESETS, PROVIDERS } from "@/lib/providers";
import { saveSkill, saveSkillsBulk, deleteSkill, loadAllSkills } from "@/lib/skills-store";

// Quota-safe localStorage. Heavy data (installed skills) lives in IndexedDB,
// so this only handles light state (settings, chat msgs). Trims on overflow.
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
  skillsHydrated: boolean;
  // Tools panel: names of tools the user has disabled.
  disabledTools: string[];
  // Sync status for header indicator.
  syncStatus: "idle" | "syncing" | "synced" | "error" | "offline";
  syncLastAt: number | null;
  // Dual-agent (Hermes planner + Goose executor) toggle.
  dualAgent: boolean;
  // Custom marketplace sources (user-added GitHub repos)
  customSources: { id: string; label: string; repo: string; ref?: string; rootPath?: string }[];
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
  installSkillsBulk: (s: FetchedSkill[]) => Promise<void>;
  uninstallSkill: (id: string) => void;
  hydrateSkills: () => Promise<void>;
  addCustomSource: (src: { id: string; label: string; repo: string; ref?: string; rootPath?: string }) => void;
  removeCustomSource: (id: string) => void;
  toggleTool: (name: string) => void;
  enableAllTools: () => void;
  disableAllTools: () => void;
  setSyncStatus: (s: Store["syncStatus"]) => void;
  setDualAgent: (b: boolean) => void;
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
      skillsHydrated: false,
      disabledTools: [],
      syncStatus: "idle",
      syncLastAt: null,
      dualAgent: false,
      customSources: [],
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
      // Skills now persist in IndexedDB (no localStorage quota). Memory mirror = installedSkills.
      installSkill: (sk) => {
        set((s) => ({ installedSkills: [sk, ...s.installedSkills.filter((x) => x.id !== sk.id)] }));
        void saveSkill(sk).catch(() => {});
      },
      installSkillsBulk: async (list) => {
        if (!list.length) return;
        await saveSkillsBulk(list);
        set((s) => {
          const merged = [...list, ...s.installedSkills.filter((x) => !list.find((l) => l.id === x.id))];
          return { installedSkills: merged };
        });
      },
      uninstallSkill: (id) => {
        set((s) => ({
          installedSkills: s.installedSkills.filter((x) => x.id !== id),
          activeSkill: s.activeSkill === id ? null : s.activeSkill,
        }));
        void deleteSkill(id).catch(() => {});
      },
      hydrateSkills: async () => {
        if (get().skillsHydrated) return;
        try {
          const all = await loadAllSkills();
          set((s) => {
            const map = new Map<string, FetchedSkill>();
            for (const sk of all) map.set(sk.id, sk);
            for (const sk of s.installedSkills) if (!map.has(sk.id)) map.set(sk.id, sk);
            return { installedSkills: Array.from(map.values()), skillsHydrated: true };
          });
          // Backfill: ensure any pre-existing in-memory skills get persisted to IDB too.
          const remaining = get().installedSkills.filter((sk) => !all.find((a) => a.id === sk.id));
          if (remaining.length) await saveSkillsBulk(remaining);
        } catch {
          set({ skillsHydrated: true });
        }
      },
      addCustomSource: (src) =>
        set((s) => ({ customSources: [...s.customSources.filter((x) => x.id !== src.id), src] })),
      removeCustomSource: (id) =>
        set((s) => ({ customSources: s.customSources.filter((x) => x.id !== id) })),
      toggleTool: (name) =>
        set((s) => ({
          disabledTools: s.disabledTools.includes(name)
            ? s.disabledTools.filter((n) => n !== name)
            : [...s.disabledTools, name],
        })),
      enableAllTools: () => set({ disabledTools: [] }),
      disableAllTools: () =>
        // Keep eval_response always on (autopilot loop depends on it).
        set({ disabledTools: ["run_js", "http_fetch", "web_search", "web_fetch", "doc_save", "doc_list", "doc_get", "doc_delete", "doc_export", "audit_status", "gh_create_issue", "gh_create_pr", "gh_workflow_dispatch", "gh_status", "skill_search", "skill_install", "skill_uninstall", "skill_activate", "skill_deactivate", "skill_list_installed", "skill_run", "skill_chain", "skill_compose", "skill_god_rebuild", "list_uploads", "read_upload", "upload_get_url", "sync_push", "sync_pull", "push_notify", "write_file_artifact"] }),
      setSyncStatus: (s) => set({ syncStatus: s, syncLastAt: s === "synced" ? Date.now() : get().syncLastAt }),
      setDualAgent: (b) => set({ dualAgent: b }),
    }),
    {
      name: "jarvis-v4-store",
      version: 3,
      migrate: (persisted: any) => {
        if (persisted && !persisted.activeModel) persisted.activeModel = DEFAULT_ACTIVE;
        if (persisted && !persisted.providerKeys) persisted.providerKeys = {};
        if (persisted && !persisted.customProviders) persisted.customProviders = [];
        if (persisted && !persisted.systemPrompt) persisted.systemPrompt = DEFAULT_SYSTEM_PROMPT;
        if (persisted && !persisted.presets) persisted.presets = SYSTEM_PROMPT_PRESETS;
        if (persisted && !persisted.customSources) persisted.customSources = [];
        // v2 -> v3: skills moved to IndexedDB. Keep in-memory list; hydrate on boot.
        return persisted;
      },
      partialize: (s) => ({
        messages: s.messages.slice(-100).map((m) => ({
          ...m,
          content: typeof m.content === "string" && m.content.length > 8000
            ? m.content.slice(0, 8000) + "\n…[truncated for storage]"
            : m.content,
        })),
        providerKeys: s.providerKeys,
        customProviders: s.customProviders,
        activeModel: s.activeModel,
        systemPrompt: s.systemPrompt,
        presets: s.presets,
        autopilot: s.autopilot,
        evalRequired: s.evalRequired,
        audit: s.audit,
        activeSkill: s.activeSkill,
        disabledTools: s.disabledTools,
        dualAgent: s.dualAgent,
        // installedSkills intentionally NOT persisted here — IndexedDB handles them.
        customSources: s.customSources,
        docs: s.docs,
        uploads: s.uploads.map((u) => ({ name: u.name, url: u.url, size: u.size, type: u.type })),
        github: s.github,
      }),
      storage: createJSONStorage(() => safeStorage),
      onRehydrateStorage: () => (state) => {
        // Pull installed skills from IndexedDB right after rehydration.
        state?.hydrateSkills?.();
        // Best-effort: ask browser to grant persistent quota for IDB.
        if (typeof navigator !== "undefined" && navigator.storage?.persist) {
          navigator.storage.persist().catch(() => {});
        }
      },
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
