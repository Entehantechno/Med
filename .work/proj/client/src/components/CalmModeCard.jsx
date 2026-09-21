import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

/* Calm Mode settings card (anti-burnout, opt-in).
   Bundles evidence-based humane guardrails a learner can turn on for themselves:
   a daily review cap, guilt-free rest days, a hidden streak, and opting out of
   leagues. Deterministic, AI-free; the whole feature is gated by the calm_mode
   flag and its defaults are set by the admin. */
export default function CalmModeCard() {
  const { t, flag } = useApp();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!flag("calm_mode")) return;
    api.get("/learn/calm").then(setS).catch(() => setS(null));
  }, [flag]);

  if (!flag("calm_mode")) return null;
  if (!s) return null;

  const patch = async (body) => {
    setBusy(true);
    try { const r = await api.put("/learn/calm", body); setS(r); } catch { /* */ } finally { setBusy(false); }
  };
  const restDay = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api.post("/learn/calm/rest-day", {});
      if (r.ok) { setS(r); setMsg(t("calmRestOk")); }
      else setMsg(t("calmRest_" + (r.reason || "err")) || t("calmRestErr"));
    } catch { setMsg(t("calmRestErr")); } finally { setBusy(false); }
  };

  return (
    <div className="card set-card calm-card">
      <div className="set-head"><Icon name="shield" size={16} /> {t("calmTitle")}</div>
      <p className="small muted" style={{ marginTop: -2 }}>{t("calmHint")}</p>

      {/* master switch */}
      <div className="set-row">
        <div className="set-label">{t("calmEnable")}</div>
        <div className={`switch ${s.enabled ? "on" : ""}`} role="switch" aria-checked={s.enabled}
          aria-label={t("calmEnable")}
          onClick={() => !busy && patch({ enabled: !s.enabled })}>
          <span className="slider" /></div>
      </div>

      {s.enabled && (
        <div className="calm-body">
          {/* daily review cap */}
          <div className="calm-field">
            <label>{t("calmReviewCap")}: <b>{fmtCap(s.reviewCap, t)}</b></label>
            <input type="range" min={s.minReviewCap} max={s.maxReviewCap} step="5" value={s.reviewCap}
              disabled={busy} onChange={(e) => setS({ ...s, reviewCap: Number(e.target.value) })}
              onMouseUp={(e) => patch({ reviewCap: Number(e.target.value) })}
              onTouchEnd={(e) => patch({ reviewCap: Number(e.target.value) })} />
            <div className="small muted">{t("calmReviewCapHint")}</div>
          </div>

          {/* hide streak */}
          <div className="set-row">
            <div className="set-label">{t("calmHideStreak")}</div>
            <div className={`switch ${s.hideStreak ? "on" : ""}`} role="switch" aria-checked={s.hideStreak}
              aria-label={t("calmHideStreak")}
              onClick={() => !busy && patch({ hideStreak: !s.hideStreak })}><span className="slider" /></div>
          </div>

          {/* opt out of leagues */}
          <div className="set-row">
            <div className="set-label">{t("calmOptOutLeagues")}</div>
            <div className={`switch ${s.optOutLeagues ? "on" : ""}`} role="switch" aria-checked={s.optOutLeagues}
              aria-label={t("calmOptOutLeagues")}
              onClick={() => !busy && patch({ optOutLeagues: !s.optOutLeagues })}><span className="slider" /></div>
          </div>

          {/* rest days */}
          <div className="calm-rest">
            <div className="calm-rest-info">
              <div style={{ fontWeight: 700 }}>🌿 {t("calmRestDays")}</div>
              <div className="small muted">{t("calmRestLeft").replace("{n}", s.restDaysLeft).replace("{m}", s.restDaysPerWeek)}</div>
            </div>
            <button className="btn btn-primary btn-sm" disabled={busy || s.restDaysLeft <= 0 || s.restToday}
              onClick={restDay}>
              {s.restToday ? t("calmRestedToday") : t("calmTakeRest")}
            </button>
          </div>
          {msg && <div className="small calm-msg">{msg}</div>}

          {s.showWellbeingTips && (
            <div className="calm-tip small">💙 {t("calmWellbeing")}</div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtCap(n, t) { return `${n} ${t("calmCardsPerDay")}`; }
