import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { I18N_LITE } from "./i18n-lite.js";
import { api, getToken, setToken } from "./api.js";
import { isSoundOn, setSoundOn } from "./lib/feedback.js";
import { safeLocal, safeSession } from "./lib/storage.js";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [lang, setLangState] = useState(safeLocal.getItem("medlab_lang") || "fa");
  const [theme, setThemeState] = useState(safeLocal.getItem("medlab_theme") || "light");
  const [dict, setDict] = useState(I18N_LITE);
  const fullDictPromise = useRef(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const loadFullDict = useCallback(() => {
    if (!fullDictPromise.current) {
      fullDictPromise.current = import("./i18n.js").then((m) => { if (m.I18N) setDict(m.I18N); return m.I18N; }).catch(() => null);
    }
    return fullDictPromise.current;
  }, []);

  // ---- Editable site content (headless CMS): admin overrides for site copy ----
  // Stored per language as keys like "fa:landHeroTitle". Falls back to i18n.
  // t() is CMS-aware so EVERY translated string in the app is editable by the
  // admin (an override wins; otherwise the built-in i18n default is used).
  const [siteContent, setSiteContent] = useState({});
  const reloadSiteContent = useCallback(() => {
    return api.get("/site-content")
      .then((d) => setSiteContent(d.content || {}))
      .catch(() => setSiteContent({}));
  }, []);
  useEffect(() => { reloadSiteContent(); }, [reloadSiteContent]);

  const t = useCallback((key) => {
    const override = siteContent[`${lang}:${key}`];
    if (typeof override === "string" && override.trim() !== "") return override;
    return (dict[lang] && dict[lang][key]) || key;
  }, [siteContent, lang, dict]);
  // tc is kept as an alias for backward compatibility (Landing uses tc()).
  const tc = t;

  const setLang = useCallback((l) => {
    setLangState(l);
    safeLocal.setItem("medlab_lang", l);
  }, []);
  const toggleLang = useCallback(() => setLang(lang === "fa" ? "en" : "fa"), [lang, setLang]);

  // Load the full translation catalog only when it is likely to be needed.
  // Public visitors get the tiny landing dictionary first; the large catalog is
  // fetched after the first render and browser idle time, so it does not compete
  // with LCP. Logged-in users/admins load it immediately.
  useEffect(() => {
    if (getToken()) { loadFullDict(); return; }
    let idleId = null;
    let timerId = null;
    let cancelled = false;
    const run = () => { if (!cancelled) loadFullDict(); };
    if (typeof window !== "undefined") {
      timerId = window.setTimeout(() => {
        if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(run, { timeout: 8000 });
        else run();
      }, 3500);
    }
    return () => {
      cancelled = true;
      if (idleId != null && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      if (timerId != null) window.clearTimeout(timerId);
    };
  }, [loadFullDict]);
  useEffect(() => { if (user) loadFullDict(); }, [user, loadFullDict]);

  const setTheme = useCallback((th) => {
    setThemeState(th);
    safeLocal.setItem("medlab_theme", th);
  }, []);
  const toggleTheme = useCallback(() => setTheme(theme === "light" ? "dark" : "light"), [theme, setTheme]);

  // ---- Global sound preference (celebration/lesson SFX) ----
  // Mirrors feedback.js's localStorage flag so the Settings page and the in-lesson
  // toggle stay in sync. The audio itself is synthesized (AI-free, zero-cost).
  const [sound, setSoundState] = useState(isSoundOn());
  const setSound = useCallback((on) => { setSoundState(on); setSoundOn(on); }, []);
  const toggleSound = useCallback(() => setSound(!sound), [sound, setSound]);

  // ---- Font-size (accessibility) ----
  // Scales the whole UI by driving --fs (html font-size). Because the app uses
  // rem/relative units everywhere, changing the base scales everything cleanly.
  const FONT_SCALES = { small: 15, normal: 16, large: 18, xl: 20 };
  const [fontScale, setFontScaleState] = useState(
    safeLocal.getItem("medlab_font") || "normal"
  );
  const setFontScale = useCallback((s) => {
    const key = s in FONT_SCALES ? s : "normal";
    setFontScaleState(key);
    safeLocal.setItem("medlab_font", key);
  }, []);
  useEffect(() => {
    const px = FONT_SCALES[fontScale] || 16;
    document.documentElement.style.setProperty("--fs", `${px}px`);
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.dir = (dict[lang] && dict[lang].dir) || (lang === "fa" ? "rtl" : "ltr");
    document.documentElement.lang = lang;
  }, [lang, dict]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const [flags, setFlags] = useState({});

  // restore session
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const { user } = await api.me(); setUser(user);
          try { const { flags } = await api.get("/flags"); setFlags(flags || {}); } catch { /* */ }
        }
        catch { setToken(null); }
      }
      setReady(true);
    })();
  }, []);

  // load flags after any login too
  useEffect(() => {
    if (user) api.get("/flags").then((d) => setFlags(d.flags || {})).catch(() => {});
  }, [user]);

  // feature-flag check (defaults to enabled if unknown)
  const flag = useCallback((key) => (key in flags ? !!flags[key] : true), [flags]);

  const login = useCallback(async (username, password) => {
    const { token, user } = await api.login(username, password);
    setToken(token); setUser(user); return user;
  }, []);

  const register = useCallback(async (payload) => {
    const { token, user, emailSent } = await api.register(payload);
    setToken(token); setUser(user); return { user, emailSent };
  }, []);

  const googleLogin = useCallback(async (credential, extra = {}) => {
    const { token, user } = await api.post("/auth/google", { credential, ...extra });
    setToken(token); setUser(user); return user;
  }, []);

  // Forget the service-worker's cached API responses of the account that is
  // signing out (they would otherwise still be served offline on this device).
  const forgetCachedApi = () => {
    try { navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_API_CACHE" }); } catch { /* no SW */ }
  };

  const logout = useCallback(() => {
    api.post("/auth/logout", {}).catch(() => {});
    safeSession.removeItem("medlab_admin_token");
    forgetCachedApi();
    setToken(null); setUser(null);
  }, []);

  const logoutAll = useCallback(() => {
    api.post("/auth/logout-all", {}).catch(() => {});
    safeSession.removeItem("medlab_admin_token");
    forgetCachedApi();
    setToken(null); setUser(null);
  }, []);

  // Impersonate: keep the admin token in sessionStorage, switch to the target
  // user's token, then load that user via /auth/me (no page reload → deterministic).
  const impersonate = useCallback(async (token) => {
    safeSession.setItem("medlab_admin_token", getToken());
    setToken(token);
    const { user } = await api.me();
    setUser(user);
    return user;
  }, []);

  // Exit impersonation: restore the admin token and reload the admin identity.
  const exitImpersonation = useCallback(async () => {
    const adminTk = safeSession.getItem("medlab_admin_token");
    safeSession.removeItem("medlab_admin_token");
    if (!adminTk) return;
    setToken(adminTk);
    const { user } = await api.me();
    setUser(user);
  }, []);

  // permission check (admin implicitly has all)
  const can = useCallback((perm) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return Array.isArray(user.perms) && user.perms.includes(perm);
  }, [user]);

  return (
    <AppCtx.Provider value={{ lang, setLang, toggleLang, theme, setTheme, toggleTheme, sound, setSound, toggleSound, fontScale, setFontScale, t, tc, siteContent, reloadSiteContent, user, setUser, login, register, googleLogin, logout, logoutAll, impersonate, exitImpersonation, ready, can, flag }}>
      {children}
    </AppCtx.Provider>
  );
}
