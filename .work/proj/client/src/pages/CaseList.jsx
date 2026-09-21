import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api, loadFailKind, loadFailText } from "../api.js";
import { TopBar, Spinner, Pill, StarRating } from "../components/UI.jsx";
import { biField } from "../lib/bifield.js";
import Icon from "../components/Icon.jsx";

export default function CaseList({ go, home }) {
  const { t, lang } = useApp();
  const [cases, setCases] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    setCases(null);
    api.get("/cases", { timeoutMs: 20_000, stage: "boot" })
      .then((d) => setCases(Array.isArray(d) ? d : []))
      .catch((e) => { setCases([]); setLoadErr(loadFailKind(e)); });
  };
  useEffect(() => { load(); }, []);
  if (!cases) return <div className="app"><TopBar onHome={home} /><Spinner /></div>;

  return (
    <div className="app">
      <TopBar onHome={home} />
      <div className="container">
        <div className="section-title">
          <h2>{t("caseList")}</h2>
          <button className="btn btn-ghost btn-sm" onClick={home}>← {t("back")}</button>
        </div>

        {loadErr ? (
          <div className="card center" style={{ padding: 40 }}>
            <div style={{ fontSize: 44 }}><Icon name="warn" size={30} /></div>
            <h3 className="mt8">{lang === "fa" ? "«بارگذاری فهرست پرونده‌ها» قطع شد" : "[Loading the case list] failed"}</h3>
            <div className="muted small mt8">{loadFailText(loadErr, lang)}</div>
            <button className="btn btn-primary mt16" onClick={load}>{lang === "fa" ? "تلاش دوباره" : "Try again"}</button>
          </div>
        ) : cases.length === 0 ? (
          <div className="card center" style={{ padding: 40 }}>
            <div style={{ fontSize: 44 }}><Icon name="lock" size={30} /></div>
            <h3 className="mt8">{t("noExamsAssigned")}</h3>
            <div className="muted small mt8">{t("noExamsAssignedDesc")}</div>
          </div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {cases.map((c) => {
              const used = c.attemptsUsed ?? 0;
              const max = c.maxAttempts ?? Infinity;
              const exhausted = used >= max;
              return (
                <div className="case-item" key={c.id}>
                  <div>
                    {/* Students never see the internal title (it often names the
                        diagnosis) — the chief complaint is the card headline. */}
                    <strong>{biField(c, "title", lang) || biField(c, "chief", lang)}</strong> <span className="badge-ver">v{c.version}</span>
                    <StarRating score={c.best} lang={lang} />
                    <div className="case-meta">
                      <Pill kind={c.difficulty}>{t(c.difficulty)}</Pill>
                      <span className="tag">{t("specialty")}: {biField(c, "specialty", lang)}</span>
                      <span className="tag">{t("age")}: {c.age}</span>
                      <span className="tag">{t(c.sex)}</span>
                      {c.maxAttempts != null &&
                        <span className="tag">{t("attemptsUsedOf")}: {used}/{max}</span>}
                    </div>
                    {biField(c, "title", lang) && <div className="small muted mt8">{t("chief")}: {biField(c, "chief", lang)}</div>}
                  </div>
                  <button className="btn btn-primary" disabled={exhausted}
                    style={exhausted ? { opacity: .5, cursor: "not-allowed" } : {}}
                    onClick={() => !exhausted && go("exam", { caseId: c.id })}>
                    {t("startCase")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
