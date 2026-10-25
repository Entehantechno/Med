import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../context.jsx";

const NONCE_KEY = "medlab_gis_nonce";

function randomNonce() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* Official Google Identity Services button + One Tap (FedCM 2025–26).
   Loads only when the server has a Client ID. Nonce is stored in sessionStorage
   so the backend can reject a replayed ID token. */
export default function GoogleButton({ onCredential, onError, promptOneTap = false }) {
  const { lang } = useApp();
  const ref = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get("/auth/methods").then((m) => {
      if (cancelled) return;
      if (m.google && m.googleClientId) setClientId(m.googleClientId);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    const nonce = randomNonce();
    try { sessionStorage.setItem(NONCE_KEY, nonce); } catch { /* private mode */ }

    const init = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce,
        use_fedcm_for_prompt: true,
        itp_support: true,
        ux_mode: "popup",
        callback: (resp) => {
          if (!resp?.credential) return;
          let stored = "";
          try { stored = sessionStorage.getItem(NONCE_KEY) || ""; } catch { /* */ }
          onCredential(resp.credential, stored);
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline", size: "large", width: 320,
        text: "continue_with", locale: lang === "fa" ? "fa" : "en", shape: "pill",
      });
      if (promptOneTap) {
        try { window.google.accounts.id.prompt(); } catch { /* FedCM may be blocked in iframes */ }
      }
      setReady(true);
    };
    if (window.google?.accounts?.id) { init(); return; }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", init, { once: true });
      if (window.google?.accounts?.id) init();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = init;
    s.onerror = () => onError?.();
    document.head.appendChild(s);
  }, [clientId, lang, promptOneTap]);

  if (!clientId) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }} aria-busy={!ready}>
      <div ref={ref} />
    </div>
  );
}
