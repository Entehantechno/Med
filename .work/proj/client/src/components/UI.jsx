import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context.jsx";
import Icon from "./Icon.jsx";
import { useScrollLock } from "../utils/useScrollLock.js";

/* MED School logo mark (graduation cap in a rounded square). */
function LogoMark() {
  return (
    <div className="logo">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 8l10-4 10 4-10 4L2 8Z" />
        <path d="M6 10.5V15c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.5M22 8v5" />
      </svg>
    </div>
  );
}

export function TopBar({ onHome }) {
  const { t, user, toggleLang, logout, lang, theme, toggleTheme } = useApp();
  // Publish the real header height so sticky elements (path progress card,
  // unit headers) can sit exactly beneath it on every viewport.
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const set = () => document.documentElement.style.setProperty("--topbar-h", `${el.offsetHeight}px`);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const goProfile = () => window.dispatchEvent(new CustomEvent("medlab-nav", { detail: "profile" }));
  return (
    <div className="topbar" ref={ref}>
      <div className="brand" style={{ cursor: "pointer" }} onClick={onHome}>
        <LogoMark />
        <div><h1>{t("appName")}</h1><p>{t("appSub")}</p></div>
      </div>
      <div className="topbar-actions">
        {user && (
          <button className="btn btn-sm btn-ghost" onClick={goProfile} title={t("profile")}>
            <Icon name="user" size={16} /> <span className="small">{lang === "fa" ? user.name_fa : user.name_en}</span>
          </button>
        )}
        <button className="btn btn-sm btn-ghost icon-btn" onClick={toggleTheme} title={theme === "light" ? t("darkMode") : t("lightMode")}>
          <Icon name={theme === "light" ? "moon" : "sun"} size={16} />
        </button>
        <button className="btn btn-sm btn-ghost" onClick={toggleLang}><Icon name="globe" size={16} /> <span className="icon-lang-label">{t("otherLang")}</span></button>
        {user && <button className="btn btn-sm btn-danger icon-btn" onClick={logout} title={t("logout")}><Icon name="logout" size={16} /></button>}
      </div>
    </div>
  );
}

export function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

export function Spinner({ label }) {
  return <div className="loading-screen"><div className="spinner" />{label && <div className="muted">{label}</div>}</div>;
}

export function Pill({ kind, children }) {
  return <span className={`pill pill-${kind}`}>{children}</span>;
}

export function Modal({ title, children, onClose, onSave, saveLabel, wide }) {
  const { t } = useApp();
  useScrollLock(true);
  // Escape closes the dialog (standard modal affordance).
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Render through a PORTAL on <body>. Many page wrappers (.card, .container)
  // run CSS entrance animations that animate `transform` (softPop / pageIn);
  // an element with an active/filling transform becomes the containing block
  // for position:fixed descendants, so the dialog would anchor to the middle
  // of the (very long) page instead of the viewport — forcing admins to scroll
  // for ages to reach the create-card form. Portaling to <body> removes every
  // such ancestor so .modal-back is always viewport-fixed.
  // See: react.dev/reference/react-dom/createPortal (dialogs use case).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
          {onSave && <button className="btn btn-primary" onClick={onSave}>{saveLabel || t("save")}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function StarRating({ score, lang = "fa" }) {
  if (score == null) return null;
  let stars = 0;
  if (score >= 90) stars = 5;
  else if (score >= 75) stars = 4;
  else if (score >= 60) stars = 3;
  else if (score >= 45) stars = 2;
  else if (score > 0) stars = 1;

  return (
    <span className="star-rating" title={lang === "fa" ? `بالاترین نمره: ${score}٪ (${stars} از ۵ ستاره)` : `Best score: ${score}% (${stars}/5 stars)`}
      style={{ display: "inline-flex", alignItems: "center", gap: 2, marginInlineStart: 8, verticalAlign: "middle" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= stars ? "#f59e0b" : "var(--muted-border, #cbd5e1)", fontSize: "0.95rem", lineHeight: 1 }}>
          {i <= stars ? "★" : "☆"}
        </span>
      ))}
      <span className="small muted" style={{ marginInlineStart: 4, fontWeight: 700, fontSize: ".72rem" }}>
        {score}%
      </span>
    </span>
  );
}

export function useToast() {
  // simple imperative toast via state lifted in App; return via window event
  return (msg) => {
    window.dispatchEvent(new CustomEvent("medlab-toast", { detail: msg }));
  };
}
