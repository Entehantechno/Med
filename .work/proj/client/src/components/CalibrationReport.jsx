import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

/* Confidence calibration report (metacognition dashboard).
   Answers the clinical-safety question "do you know what you know?" — for each
   confidence level the learner declared, it shows how often they were actually
   right. Well-calibrated learners show accuracy rising low → high, with "high"
   being genuinely trustworthy. Only appears once the feature is on AND the
   learner has declared confidence enough times. Fully AI-free. */

const LEVELS = [
  { v: 1, emoji: "😕", key: "confLow", color: "var(--muted)" },
  { v: 2, emoji: "🙂", key: "confMed", color: "var(--primary)" },
  { v: 3, emoji: "😎", key: "confHigh", color: "var(--gold)" },
];

export default function CalibrationReport() {
  const { t, flag } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!flag("confidence_assess")) return;
    api.get("/learn/calibration/confidence").then(setData).catch(() => setData(null));
  }, [flag]);

  if (!flag("confidence_assess")) return null;
  if (!data || data.total < 3) return null;   // hide until there's signal

  const verdictMeta = {
    calibrated: { emoji: "🎯", label: t("calibVerdictGood"), cls: "good" },
    overconfident: { emoji: "⚠️", label: t("calibVerdictOver"), cls: "danger" },
    mixed: { emoji: "🔄", label: t("calibVerdictMixed"), cls: "" },
    building: { emoji: "📊", label: t("calibVerdictBuilding"), cls: "" },
  }[data.verdict] || { emoji: "📊", label: "", cls: "" };

  return (
    <div className="card mb16 calib-card">
      <div className="section-title"><h4><Icon name="target" size={18} /> {t("calibTitle")}</h4></div>
      <div className="small muted mb8">{t("calibHint")}</div>

      <div className="calib-levels">
        {LEVELS.map((L) => {
          const row = data.byLevel[L.v] || { n: 0, acc: null };
          return (
            <div key={L.v} className="calib-row">
              <span className="calib-lbl">{L.emoji} {t(L.key)}</span>
              <div className="calib-bar">
                <span style={{ width: `${row.acc ?? 0}%`, background: L.color }} />
              </div>
              <span className="calib-pct">{row.acc == null ? "—" : `${row.acc}%`}</span>
              <span className="calib-n small muted">({row.n})</span>
            </div>
          );
        })}
      </div>

      {verdictMeta.label && (
        <div className={`calib-verdict ${verdictMeta.cls}`}>
          {verdictMeta.emoji} {verdictMeta.label}
        </div>
      )}
    </div>
  );
}
