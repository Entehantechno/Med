import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api, loadFailKind, loadFailText } from "../api.js";
import { TopBar, Spinner, Pill, StarRating } from "../components/UI.jsx";
import { biField } from "../lib/bifield.js";
import Icon from "../components/Icon.jsx";

/* Student-facing classroom list + detail */
export default function Classes({ go, home }) {
  const { t, lang } = useApp();
  const [classes, setClasses] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    setClasses(null);
    api.get("/classes", { timeoutMs: 20_000, stage: "boot" })
      .then((d) => setClasses(Array.isArray(d) ? d : []))
      .catch((e) => { setClasses([]); setLoadErr(loadFailKind(e)); });
  };
  useEffect(() => { load(); }, []);
  if (!classes) return <div className="app"><TopBar onHome={home} /><Spinner /></div>;

  if (openId) return <ClassDetail classId={openId} go={go} back={() => setOpenId(null)} home={home} />;

  return (
    <div className="app">
      <TopBar onHome={home} />
      <div className="container">
        <div className="section-title">
          <h2><Icon name="class" size={16} /> {t("myClasses")}</h2>
          <button className="btn btn-ghost btn-sm" onClick={home}>← {t("back")}</button>
        </div>
        {loadErr ? (
          <div className="card empty-state">
            <div className="ico"><Icon name="warn" size={30} /></div>
            <h3>{lang === "fa" ? "«بارگذاری کلاس‌ها» قطع شد" : "[Loading classes] failed"}</h3>
            <div className="muted small mt8">{loadFailText(loadErr, lang)}</div>
            <button className="btn btn-primary mt16" onClick={load}>{lang === "fa" ? "تلاش دوباره" : "Try again"}</button>
          </div>
        ) : classes.length === 0 ? (
          <div className="card empty-state">
            <div className="ico"><Icon name="class" size={30} /></div>
            <h3>{t("noClasses")}</h3>
            <div className="muted small mt8">{t("noClassesDesc")}</div>
          </div>
        ) : (
          <div className="grid grid-2">
            {classes.map((c) => (
              <button className="card mod-card mod-card-row" key={c.id} onClick={() => setOpenId(c.id)}>
                <div className="mod-ico" style={{ background: "var(--grad-purple)" }}><Icon name="class" size={26} /></div>
                <div className="mod-card-body">
                  <h3>{biField(c, "name", lang)}</h3>
                  <p>{biField(c, "desc", lang)}</p>
                  <div className="case-meta mt8">
                    <span className="tag"><Icon name="book" size={16} /> {c.nCases} {t("casesCount")}</span>
                    <span className="tag"><Icon name="users" size={16} /> {c.nStudents} {t("students")}</span>
                  </div>
                </div>
                <Icon name={lang === "fa" ? "chevronLeft" : "chevronRight"} size={18} className="mod-card-go" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClassDetail({ classId, go, back, home }) {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    setData(null);
    api.get(`/classes/${classId}`, { timeoutMs: 20_000, stage: "boot" })
      .then(setData)
      .catch((e) => setLoadErr(loadFailKind(e)));
  };
  useEffect(() => { load(); }, [classId]);
  if (loadErr) {
    return (
      <div className="app"><TopBar onHome={home} />
        <div className="container">
          <div className="card empty-state">
            <div className="ico"><Icon name="warn" size={30} /></div>
            <h3>{lang === "fa" ? "«بارگذاری کلاس» قطع شد" : "[Loading the class] failed"}</h3>
            <div className="muted small mt8">{loadFailText(loadErr, lang)}</div>
            <div className="row gap8 mt16" style={{ justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={load}>{lang === "fa" ? "تلاش دوباره" : "Try again"}</button>
              <button className="btn btn-ghost" onClick={back}>{lang === "fa" ? "بازگشت" : "Back"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!data) return <div className="app"><TopBar onHome={home} /><Spinner /></div>;

  const { class: cl, cases, flashcards = [], grade, doneCount, maxAttempts } = data;
  const totalItems = (cases?.length || 0) + (flashcards?.length || 0);
  return (
    <div className="app">
      <TopBar onHome={home} />
      <div className="container">
        <div className="section-title">
          <h2><Icon name="class" size={16} /> {biField(cl, "name", lang)}</h2>
          <button className="btn btn-ghost btn-sm" onClick={back}>← {t("back")}</button>
        </div>

        <div className="grid grid-2 mb16">
          <div className="card center">
            <div className="score-ring" style={{ "--pct": `${grade * 3.6}deg` }}><div className="val">{grade}</div></div>
            <div className="lbl muted mt8">{t("yourGrade")} / 100</div>
          </div>
          <div className="card">
            <h4 className="mb8"><Icon name="chart" size={16} /> {t("progress")}</h4>
            <div className="muted small mb8">{doneCount || 0} {t("of")} {totalItems} {t("completed")}</div>
            <div className="pbar"><span style={{ width: `${totalItems ? ((doneCount || 0) / totalItems) * 100 : 0}%` }} /></div>
            <div className="mt16 small muted">{biField(cl, "desc", lang)}</div>
          </div>
        </div>

        <h4 className="mb16"><Icon name="book" size={16} /> {t("classCases")}</h4>
        <div className="grid" style={{ gap: 12 }}>
          {cases.map((c) => {
            const used = c.attemptsUsed ?? 0;
            const remaining = Math.max(0, (maxAttempts ?? 1) - used);
            const exhausted = remaining <= 0;
            return (
              <div className="case-item" key={c.case_id}>
                <div style={{ minWidth: 0 }}>
                  <strong>{biField(c, "title", lang) || biField(c, "chief", lang) || `#${c.case_id}`}</strong> <span className="badge-ver">v{c.version}</span>
                  <StarRating score={c.best} lang={lang} />
                  <div className="case-meta">
                    <Pill kind={c.difficulty}>{t(c.difficulty)}</Pill>
                    <span className="tag">{t("weightField")}: {c.weight}</span>
                    <span className="tag">{t("attemptsRemaining")}: {remaining}/{maxAttempts}</span>
                    {c.best != null && <span className="tag" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>{t("bestScore")}: {c.best}</span>}
                  </div>
                </div>
                <button className="btn btn-primary" disabled={exhausted}
                  style={exhausted ? { opacity: .5, cursor: "not-allowed" } : {}}
                  onClick={() => !exhausted && go("exam", { caseId: c.case_id, classId })}>
                  {c.best != null ? t("retake") : t("startClassCase")}
                </button>
              </div>
            );
          })}
          {cases.length === 0 && <div className="small muted">{t("classNoCases")}</div>}
        </div>

        {/* Class flashcard sets (graded or practice) */}
        {flashcards.length > 0 && (<>
          <h4 className="mb16 mt16"><Icon name="flask" size={16} /> {t("classFlashcards")}</h4>
          <div className="grid" style={{ gap: 12 }}>
            {flashcards.map((f) => {
              const used = f.attemptsUsed ?? 0;
              const remaining = Math.max(0, (maxAttempts ?? 1) - used);
              const exhausted = f.graded && remaining <= 0;   // practice sets never lock
              return (
                <div className="case-item" key={f.flashcard_id}>
                  <div style={{ minWidth: 0 }}>
                    {/* Students see the QUESTION, never the teacher's internal title. */}
                    <strong>{biField(f, "q", lang) || biField(f, "title", lang) || `#${f.flashcard_id}`}</strong>
                    <div className="case-meta">
                      <span className="tag" style={f.graded ? {} : { opacity: .7 }}>{f.graded ? t("gradedShort") : t("practiceShort")}</span>
                      {!!data.class?.flashNoPenalty && <span className="tag" style={{ color: "var(--ok,#16a34a)", borderColor: "var(--ok,#16a34a)" }}>{lang === "fa" ? "🎯 بدون کسر نمره" : "🎯 no penalty"}</span>}
                      {f.graded && <span className="tag">{t("weightField")}: {f.weight}</span>}
                      {f.graded && <span className="tag">{t("attemptsRemaining")}: {remaining}/{maxAttempts}</span>}
                      {f.best != null && <span className="tag" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>{t("bestScore")}: {f.best}</span>}
                    </div>
                  </div>
                  <button className="btn btn-primary" disabled={exhausted}
                    style={exhausted ? { opacity: .5, cursor: "not-allowed" } : {}}
                    onClick={() => !exhausted && go("flashcards", { flashcardIds: [f.flashcard_id], classId, classFlashcardId: f.flashcard_id, noPenalty: !!data.class?.flashNoPenalty })}>
                    {f.best != null ? t("retake") : t("startClassCase")}
                  </button>
                </div>
              );
            })}
          </div>
        </>)}
      </div>
    </div>
  );
}
