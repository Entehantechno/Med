import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";

/* Shows a slim banner when the browser goes offline, and a brief "back online"
   confirmation when the connection returns. Purely client-side (navigator.onLine). */
export default function ConnectionBanner() {
  const { lang } = useApp();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    const goOffline = () => { setOnline(false); setJustBack(false); };
    const goOnline = () => { setOnline(true); setJustBack(true); setTimeout(() => setJustBack(false), 2500); };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  if (online && !justBack) return null;
  const fa = lang !== "en";
  return (
    <div className={`conn-banner ${online ? "ok" : "off"}`} role="status" aria-live="polite">
      {online
        ? (fa ? "اتصال دوباره برقرار شد" : "Back online")
        : (fa ? "اتصال اینترنت قطع است — برخی امکانات کار نمی‌کنند" : "You're offline — some features are unavailable")}
    </div>
  );
}
