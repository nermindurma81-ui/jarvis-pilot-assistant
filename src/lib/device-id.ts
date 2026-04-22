// Stable per-device identifier (no auth). Used as the partition key for sync tables.
const KEY = "jarvis-device-id";

export function getDeviceId(): string {
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = (crypto.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return "anonymous";
  }
}
