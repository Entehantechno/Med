/* push.js — browser Web Push subscription (best-effort).
   Falls back gracefully: if the browser lacks support, or the server has no VAPID
   key configured, it just notifies the user and does nothing harmful. */
import { api } from "../../api.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function subscribePush(t) {
  const toast = (m) => window.dispatchEvent(new CustomEvent("medlab-toast", { detail: m }));
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast(t ? t("notifUnsupported") : "Notifications not supported"); return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast(t ? t("notifDenied") : "Permission denied"); return; }

    const { publicKey, configured } = await api.get("/learn/push/key");
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    if (!configured || !publicKey) {
      // In-app notifications still work; browser push needs VAPID keys on the server.
      toast(t ? t("notifInAppOnly") : "In-app notifications enabled");
      return;
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await api.post("/learn/push/subscribe", sub.toJSON());
    toast(t ? t("notifEnabled") : "Notifications enabled");
  } catch (e) {
    toast(t ? t("notifInAppOnly") : "In-app notifications enabled");
  }
}
