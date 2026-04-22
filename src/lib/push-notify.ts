// Web Push registration via service worker. Works without Firebase.
// Saves the subscription server-side so an edge function can later push to it.

import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device-id";

const SW_PATH = "/sw.js";

export async function registerPush(vapidPublicKey?: string): Promise<{ ok: boolean; message: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, message: "Push API not supported in this browser." };
  }
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, message: "Notification permission denied." };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const opts: PushSubscriptionOptionsInit = { userVisibleOnly: true };
      if (vapidPublicKey) opts.applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      sub = await reg.pushManager.subscribe(opts);
    }
    const j = sub.toJSON();
    await supabase.from("push_devices").upsert({
      device_id: getDeviceId(),
      endpoint: j.endpoint!,
      p256dh: j.keys?.p256dh || "",
      auth: j.keys?.auth || "",
      ua: navigator.userAgent,
    }, { onConflict: "device_id" });

    return { ok: true, message: "Push notifications enabled." };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Registration failed" };
  }
}

export async function showLocalNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) reg.showNotification(title, { body, icon: "/placeholder.svg" });
  else new Notification(title, { body });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}
