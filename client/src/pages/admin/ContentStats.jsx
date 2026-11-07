import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner } from "../../components/UI.jsx";

/* ---------------------------------------------------------------------------
   ContentStats — a management dashboard for the competitive-track content.
   Shows: coverage KPIs (media / lesson-note / answer-key / used-in-path),
   question-type & difficulty distribution, per-subject coverage table, content
   gaps (subjects with the least media), and a media-library rollup. AI-free;
   all bars are pure CSS so it renders even in an offline preview.
--------------------------------------------------------------------------- */
const TYPE_FA = { mcq: "چهارگزینه‌ای", truefalse: "درست/غلط", fill: "جای خالی", match: "تطبیق", order: "مرتب‌سازی", compare: "تمایز بالینی" };
const TYPE_EN = { mcq: "MCQ", truefalse: "True/False", fill: "Fill", match: "Match", order: "Order", compare: "Compare" };
const DIFF_FA = { easy: "آسان", medium: "متوسط", hard: "سخت", brutal: "خیلی سخت" };
const DIFF_EN = { easy: "Easy", medium: "Medium", hard: "Hard", brutal: "Brutal" };
const SECTION_FA = { internal: "دروس داخلی", major: "دروس ماژور", minor: "دروس مینور", floating: "دروس شناور", basic: "علوم پایه", other: "سایر" };

function fmtSize(n) {
  if (!n) return "0";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Kpi({ label, value, sub, accent }) {
  return (
    <div className="cs-kpi card">
      <div className="cs-kpi-v" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="cs-kpi-l">{label}</div>
      {sub != null && <div className="cs-kpi-sub small muted">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, pct, color }) {
  const w = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="cs-bar-row">
      <div className="cs-bar-label">{label}</div>
      <div className="cs-bar-track"><span style={{ width: `${Math.max(2, w)}%`, background: color || "var(--primary)" }} /></div>
      <div className="cs-bar-val">{value}{pct != null ? ` · ${pct}٪` : ""}</div>
    </div>
  );
}

export default function ContentStats({ onJump } = {}) {
  const { t, lang } = useApp();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get(`/admin/content-stats?lang=${lang}`).then(setD).catch((e) => setErr(e.message)); }, [lang]);

  if (err) return <div className="card empty-state"><div className="ico"><Icon name="warn" size={40} /></div><h3>{err}</h3></div>;
  if (!d) return <Spinner />;
  const fa = lang === "fa";
  const TL = fa ? TYPE_FA : TYPE_EN, DL = fa ? DIFF_FA : DIFF_EN;
  const tt = d.totals;
  const typeMax = Math.max(1, ...Object.values(d.byType));
  const diffMax = Math.max(1, ...Object.values(d.byDifficulty));
  // WCAG-AA safe (white text ≥4.5:1): dark green / dark amber / dark red
  const pctColor = (p) => (p >= 66 ? "#0f7a43" : p >= 33 ? "#8a5a0c" : "#b5352a");

  return (
    <div className="page cs-page">
      <div className="section-title"><h2><Icon name="chart" size={22} /> {t("contentStats")}</h2></div>
      <div className="muted small mb16">{t("contentStatsHint")}</div>

      {/* headline KPIs */}
      <div className="cs-kpi-grid">
        <Kpi label={t("csTotalCards")} value={tt.total} sub={`${tt.active} ${t("csActive")}`} />
        <Kpi label={t("csMediaCoverage")} value={`${tt.mediaPct}٪`} sub={`${tt.withMedia} ${t("csOfCards")}`} accent={pctColor(tt.mediaPct)} />
        <Kpi label={t("csMicroCoverage")} value={`${tt.microPct}٪`} sub={`${tt.withMicro} ${t("csOfCards")}`} accent={pctColor(tt.microPct)} />
        <Kpi label={t("csExplainCoverage")} value={`${tt.explainPct}٪`} sub={`${tt.withExplain} ${t("csOfCards")}`} accent={pctColor(tt.explainPct)} />
        <Kpi label={t("csUsedInPath")} value={`${tt.usedPct}٪`} sub={`${tt.orphan} ${t("csOrphan")}`} accent={pctColor(tt.usedPct)} />
        <Kpi label={t("csPremium")} value={tt.premium} sub={`🖼️ ${tt.withImage} · 🎞️ ${tt.withVideo} · ▶️ ${tt.withEmbed}`} />
      </div>

      <div className="cs-two">
        {/* question type distribution */}
        <div className="card">
          <div className="section-title"><h4>{t("csByType")}</h4></div>
          {Object.entries(d.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <BarRow key={k} label={TL[k] || k} value={v} max={typeMax} color="#2569b0" />
          ))}
        </div>
        {/* difficulty distribution */}
        <div className="card">
          <div className="section-title"><h4>{t("csByDifficulty")}</h4></div>
          {["easy", "medium", "hard", "brutal"].filter((k) => d.byDifficulty[k]).map((k) => (
            <BarRow key={k} label={DL[k] || k} value={d.byDifficulty[k]} max={diffMax}
              color={k === "easy" ? "#22a06b" : k === "medium" ? "#e0912e" : "#e0544f"} />
          ))}
        </div>
      </div>

      {/* content gaps */}
      {d.gaps.length > 0 && (
        <div className="card cs-gaps">
          <div className="section-title"><h4>⚠️ {t("csGaps")}</h4></div>
          <div className="small muted mb8">{t("csGapsHint")}{onJump ? ` — ${t("csClickToFix")}` : ""}</div>
          {d.gaps.map((s) => (
            <button type="button" key={s.slug} className="cs-gap-btn" disabled={!onJump}
              onClick={() => onJump?.({ subject: s.slug, media: "none" })} title={onJump ? t("csClickToFix") : undefined}>
              <BarRow label={`${s.name} (${SECTION_FA[s.section] || s.section})`} value={s.withMedia}
                max={s.total} pct={s.mediaPct} color={pctColor(s.mediaPct)} />
            </button>
          ))}
        </div>
      )}

      {/* per-subject coverage table */}
      <div className="card">
        <div className="section-title"><h4>{t("csBySubject")}</h4></div>
        <div className="cs-table-wrap">
          <table className="cs-table">
            <thead><tr>
              <th>{t("subjectCol")}</th><th>{t("sectionLabel")}</th><th>{t("csCards")}</th>
              <th>{t("csMediaPct")}</th><th>{t("csMicroPct")}</th><th>{t("premiumCard")}</th>
            </tr></thead>
            <tbody>
              {d.subjects.map((s) => (
                <tr key={s.slug} className={onJump ? "cs-row-click" : ""}
                  onClick={onJump ? () => onJump({ subject: s.slug }) : undefined}
                  title={onJump ? t("csClickToFilter") : undefined}>
                  <td>{s.name}</td>
                  <td className="small muted">{SECTION_FA[s.section] || s.section}</td>
                  <td>{s.total}</td>
                  <td><span className="cs-pill" style={{ background: pctColor(s.mediaPct) }}>{s.mediaPct}٪</span></td>
                  <td><span className="cs-pill" style={{ background: pctColor(s.microPct) }}>{s.microPct}٪</span></td>
                  <td className="small muted">{s.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* media library rollup */}
      <div className="card cs-lib">
        <div className="section-title"><h4>🗂️ {t("mediaLibrary")}</h4></div>
        <div className="cs-lib-row">
          <span>📁 {d.library.files} {t("csFiles")}</span>
          <span>🖼️ {d.library.images}</span>
          <span>🎞️ {d.library.videos}</span>
          <span>💾 {fmtSize(d.library.sizeBytes)}</span>
        </div>
      </div>
    </div>
  );
}
