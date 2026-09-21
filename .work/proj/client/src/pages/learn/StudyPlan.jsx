import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import ShamsiDatePicker from "../../components/ShamsiDatePicker.jsx";
import { fmtDate } from "../../utils/date.js";

/* Smart study plan: a personalised, day-by-day path to the exam. The plan is
   built server-side from the learner's weak topics + days left (deterministic,
   no AI cost). An OPTIONAL AI motivational note can be requested by the user. */
export default function StudyPlan({ onBack, openMindmap }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [plan, setPlan] = useState(null);      // {plan, note}
  const [loading, setLoading] = useState(true);
  const [examDate, setExamDate] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);

  useEffect(() => {
    api.get(`/learn/study-plan?lang=${lang}`).then((d) => {
      if (d?.plan) { setPlan(d); setExamDate(d.plan.examDate || ""); setMinutes(d.plan.minutesPerDay || 60); }
    }).catch(() => {}).finally(() => setLoading(false));
    // is AI configured? (public flag — no key exposed)
    api.get("/learn/ai-status").then((d) => setAiAvailable(!!d.available)).catch(() => setAiAvailable(false));
  }, [lang]);

  const generate = async () => {
    setBusy(true);
    try {
      const d = await api.post("/learn/study-plan", { examDate: examDate || null, minutesPerDay: minutes, useAi: useAi && aiAvailable, lang });
      setPlan(d);
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="book" size={22} /> {t("studyPlan")}</h2></div>
      <div className="muted small mb16">{t("studyPlanHint")}</div>

      <div className="card mb16">
        <div className="field" style={{ marginBottom: 4 }}>
          <label>{t("examDate")} <span className="muted small">({fa ? "به تقویم شمسی" : "Shamsi calendar"})</span></label>
        </div>
        <ShamsiDatePicker value={examDate} onChangeIso={setExamDate} allowEmpty />
        <div className="field mt8"><label>{t("minutesPerDay")}</label>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            <option value={30}>30 {t("minutesShort")}</option>
            <option value={60}>60 {t("minutesShort")}</option>
            <option value={90}>90 {t("minutesShort")}</option>
            <option value={120}>120 {t("minutesShort")}</option>
          </select>
        </div>
        {aiAvailable && (
          <label className="toggle-row" style={{ cursor: "pointer", marginTop: 6 }}>
            <span>🤖 {t("studyPlanAiNote")}</span>
            <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} style={{ width: 18, height: 18 }} />
          </label>
        )}
        <button className="btn btn-accent btn-block mt8" disabled={busy} onClick={generate}>
          <Icon name="target" size={16} /> {plan ? t("studyPlanRegen") : t("studyPlanGen")}
        </button>
      </div>

      {plan?.plan && (
        <>
          {plan.note && (
            <div className="card mb16" style={{ background: "var(--accentGlow)", borderColor: "var(--accent)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.3rem" }}>💬</span>
                <div style={{ fontWeight: 600 }}>{plan.note}</div>
              </div>
            </div>
          )}

          <div className="case-meta mb16" style={{ flexWrap: "wrap" }}>
            <span className="tag"><Icon name="clock" size={13} /> {t("daysLeft")}: {plan.plan.daysLeft}</span>
            <span className="tag">{t("minutesPerDay")}: {plan.plan.minutesPerDay}</span>
          </div>

          {plan.plan.weakestFirst?.length > 0 && (
            <div className="card mb16">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>🎯 {t("focusAreas")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {plan.plan.weakestFirst.map((w) => (
                  <span key={w.slug} className="tag" style={{ fontSize: ".85rem" }}>
                    {w.emoji} {w.title}{w.accuracy != null ? ` · ${w.accuracy}%` : ` · ${t("notStarted")}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {plan.plan.days.map((d) => (
              <div key={d.dayNo} className={`card sp-day ${d.kind === "mock" ? "sp-mock" : ""}`}>
                <div className="sp-day-head">
                  <span className="sp-daynum">{t("day")} {d.dayNo}</span>
                  <span className="small muted">{fmtDate(d.date, lang)}</span>
                  <span className="tag">⏱️ {d.minutes} {t("minutesShort")}</span>
                </div>
                <div className="sp-focus">
                  {d.focus.map((f, i) => (
                    <span key={i} className={`sp-chip ${d.kind === "mock" ? "mock" : ""}`}>
                      <span style={{ fontSize: "1rem" }}>{f.emoji}</span> {f.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-ghost btn-block mt16" onClick={onBack}>{t("back")}</button>
    </div>
  );
}
