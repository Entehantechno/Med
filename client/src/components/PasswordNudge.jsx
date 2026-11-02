/* PasswordNudge.jsx — a one-time suggestion to change a password that staff set (or
   that is the student number). It never blocks the app. "Later" hides it for this
   browser session; it returns at the next sign-in until the user picks a password. */
import { useReducer } from "react";
import { useApp } from "../context.jsx";
import Icon from "./Icon.jsx";

const keyFor = (user) => `pwNudge:${user.id}`;
function wasDismissed(user) {
  try { return sessionStorage.getItem(keyFor(user)) === "1"; } catch { return false; }
}

export default function PasswordNudge() {
  const { t, user } = useApp();
  const [, rerender] = useReducer((n) => n + 1, 0);

  if (!user?.initial_password || wasDismissed(user)) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(keyFor(user), "1"); } catch { /* storage blocked: hide until reload */ }
    rerender();
  };
  const change = () => window.dispatchEvent(new CustomEvent("medlab-nav", { detail: "profile" }));

  return (
    <section className="card" role="region" aria-labelledby="pw-nudge-title"
      style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "12px 0", borderInlineStart: "4px solid var(--primary, #2f7fd1)" }}>
      <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 12, background: "rgba(47,127,209,.12)", color: "var(--primary, #2f7fd1)" }}>
        <Icon name="shield" size={20} />
      </span>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <h4 id="pw-nudge-title" style={{ margin: "0 0 4px" }}>{t("pwNudgeTitle")}</h4>
        <p className="small muted" style={{ margin: 0 }}>{t("pwNudgeBody")}</p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={change}>
          <Icon name="key" size={13} /> {t("pwNudgeChange")}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>{t("pwNudgeLater")}</button>
      </div>
    </section>
  );
}
