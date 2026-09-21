import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Confetti from "../../components/Confetti.jsx";

/* Getting-started checklist (activation flow). A short, collapsible, dismissible
   card on the learner home. Each step reflects a REAL action (first lesson, set
   goal, first review, explore a tool); completing all of them grants gems +
   confetti. Research: short "learn by doing" checklists beat passive tours. */
export default function OnboardingChecklist({ go, onProfile }) {
  const { t, lang } = useApp();
  const [ob, setOb] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const load = () => api.get(`/learn/onboarding?lang=${lang}`).then(setOb).catch(() => setOb({ show: false }));
  useEffect(() => { load(); }, [lang]);

  if (!ob || !ob.show) return null;

  const pct = ob.total ? Math.round((ob.doneCount / ob.total) * 100) : 0;

  const dismiss = async () => { await api.post("/learn/onboarding/dismiss", {}).catch(() => {}); setOb({ show: false }); };
  const claim = async () => {
    try { const r = await api.post("/learn/onboarding/claim", {}); if (r.profile) onProfile?.(r.profile); setCelebrate(true); setTimeout(() => { setCelebrate(false); load(); }, 2200); }
    catch { /* */ }
  };
  const goStep = (link) => { if (link && go) go(link); };

  return (
    <div className="card onboard-card mb16">
      {celebrate && <Confetti />}
      <div className="onboard-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div className="onboard-emoji">🚀</div>
          <div style={{ minWidth: 0 }}>
            <div className="onboard-title">{t("onboardTitle")}</div>
            <div className="small muted">{ob.doneCount}/{ob.total} · {t("onboardSubtitle")}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn btn-ghost btn-sm icon-btn" onClick={() => setCollapsed((c) => !c)} title={collapsed ? t("expand") : t("collapse")}>
            <Icon name={collapsed ? "chevronDown" : "chevronUp"} size={16} />
          </button>
          <button className="btn btn-ghost btn-sm icon-btn" onClick={dismiss} title={t("dismiss")}><Icon name="close" size={16} /></button>
        </div>
      </div>

      <div className="onboard-bar"><span style={{ width: `${pct}%` }} /></div>

      {!collapsed && (
        <>
          <div className="onboard-steps">
            {ob.steps.map((s) => (
              <button key={s.key} className={`onboard-step ${s.done ? "done" : ""}`} onClick={() => !s.done && goStep(s.link)} disabled={s.done}>
                <span className="os-check">{s.done ? "✅" : <Icon name={s.icon} size={16} />}</span>
                <span className="os-body">
                  <span className="os-label">{s.label}</span>
                  {!s.done && <span className="os-hint small muted">{s.hint}</span>}
                </span>
                {!s.done && <Icon name={lang === "fa" ? "chevronLeft" : "chevronRight"} size={16} />}
              </button>
            ))}
          </div>

          {ob.complete && !ob.claimed && (
            <button className="btn btn-accent btn-block mt8" onClick={claim}>
              🎉 {t("onboardClaim").replace("{n}", ob.reward_gems)}
            </button>
          )}
        </>
      )}
    </div>
  );
}
