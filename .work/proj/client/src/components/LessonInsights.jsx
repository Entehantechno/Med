import { useApp } from "../context.jsx";
import Icon from "./Icon.jsx";

/* Post-quiz coaching card (AI-free, deterministic).
   Two research-backed mechanisms shown after a lesson/checkpoint:

   1) Error taxonomy — buckets every wrong answer into knowledge / reasoning /
      careless so the learner understands WHY they missed, not just that they
      did. Helps them decide: study more, slow down, or reason more carefully.
   2) Auto-review bridge (UWorld × Anki) — how many missed cards were pushed
      back into the spaced-repetition queue to be seen again soon. */

const TYPE_META = {
  knowledge: { emoji: "📚", color: "var(--primary)" },
  reasoning: { emoji: "🧩", color: "var(--gold)" },
  careless: { emoji: "⚡", color: "var(--flame)" },
};

export default function LessonInsights({ report, srsAdded = 0, confidence = null, newMastery = [] }) {
  const { t } = useApp();
  const hasErrors = report && report.total > 0;
  const hasConf = confidence && confidence.declared > 0;
  const hasMastery = Array.isArray(newMastery) && newMastery.length > 0;
  if (!hasErrors && !srsAdded && !hasConf && !hasMastery) return null;

  const counts = report?.counts || {};
  const order = ["knowledge", "reasoning", "careless"];
  const shown = order.filter((k) => (counts[k] || 0) > 0);

  return (
    <div className="card mt16 insights-card">
      <div className="insights-head">
        <span className="node-emoji">🔎</span>
        <div>
          <div style={{ fontWeight: 800 }}>{t("errAnalysisTitle")}</div>
          <div className="small muted">{t("errAnalysisHint")}</div>
        </div>
      </div>

      {hasErrors && (
        <>
          <div className="insights-bar" role="img"
            aria-label={order.map((k) => `${t("err_" + k)}: ${counts[k] || 0}`).join(", ")}>
            {shown.map((k) => (
              <div key={k} className="insights-seg"
                style={{ flex: counts[k], background: TYPE_META[k].color }} title={`${t("err_" + k)}: ${counts[k]}`} />
            ))}
          </div>
          <div className="insights-legend">
            {shown.map((k) => (
              <div key={k} className="insights-chip">
                <span className="insights-dot" style={{ background: TYPE_META[k].color }} />
                <span>{TYPE_META[k].emoji} {t("err_" + k)}</span>
                <b>{counts[k]}</b>
              </div>
            ))}
          </div>
          {report.dominant && (
            <div className="insights-tip small">
              <Icon name="bulb" size={14} /> {t("errTip_" + report.dominant)}
            </div>
          )}
        </>
      )}

      {hasMastery && (
        <div className="insights-mastery">
          {newMastery.map((b) => (
            <div key={b.topicId} className="mastery-earned">
              🏅 {t("masteryEarned").replace("{topic}", b.name_fa || b.name_en).replace("{a}", b.accuracy)}
              <span className="me-reward"> +{b.reward_xp} XP · +{b.reward_gems} 💎</span>
            </div>
          ))}
        </div>
      )}

      {srsAdded > 0 && (
        <div className="insights-srs small">
          🔁 {t("srsAddedNote").replace("{n}", srsAdded)}
        </div>
      )}

      {hasConf && (
        <div className="insights-conf">
          <div className="small" style={{ fontWeight: 800, marginBottom: 4 }}>🎯 {t("confSelfCheck")}</div>
          {confidence.overconfident > 0 && (
            <div className="conf-note danger small">
              ⚠️ {t("confOverCount").replace("{n}", confidence.overconfident)}
            </div>
          )}
          {confidence.humble > 0 && (
            <div className="conf-note good small">
              💪 {t("confHumbleCount").replace("{n}", confidence.humble)}
            </div>
          )}
          {confidence.overconfident === 0 && confidence.humble === 0 && (
            <div className="small muted">{t("confBalanced")}</div>
          )}
        </div>
      )}
    </div>
  );
}
