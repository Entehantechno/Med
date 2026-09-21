import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api, loadFailKind, loadFailText } from "../api.js";
import { TopBar, Spinner, Pill } from "../components/UI.jsx";
import { biField } from "../lib/bifield.js";
import { fmtDateTime } from "../utils/date.js";
import Icon from "../components/Icon.jsx";

/* Student-facing scheduled exams: list (with time-window state) + detail. */
export default function StudentExams({ go, home }) {
  const { t, lang } = useApp();
  const [exams, setExams] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    setExams(null);
    api.get("/exams", { timeoutMs: 20_000, stage: "boot" })
      .then((d) => setExams(Array.isArray(d) ? d : []))
      .catch((e) => { setExams([]); setLoadErr(loadFailKind(e)); });
  };
  useEffect(() => { load(); }, []);
  if (!exams) return <div className="app"><TopBar onHome={home} /><Spinner /></div>;
  if (openId) return <ExamDetail examId={openId} go={go} back={() => setOpenId(null)} home={home} />;

  const stateLabel = (s) => s === "open" ? t("stateOpen") : s === "upcoming" ? t("stateUpcoming") : t("stateEnded");
  const stateKind = (s) => s === "open" ? "active" : s === "upcoming" ? "medium" : "inactive";
  const fmt = (s) => fmtDateTime(s, lang);

  return (
    <div className="app">
      <TopBar onHome={home} />
      <div className="container">
        <div className="section-title">
          <h2><Icon name="exam" size={16} /> {t("myExams")}</h2>
          <button className="btn btn-ghost btn-sm" onClick={home}>← {t("back")}</button>
        </div>
        {loadErr ? (
          <div className="card empty-state">
            <div className="ico"><Icon name="warn" size={30} /></div>
            <h3>{lang === "fa" ? "«بارگذاری آزمون‌ها» قطع شد" : "[Loading exams] failed"}</h3>
            <div className="muted small mt8">{loadFailText(loadErr, lang)}</div>
            <button className="btn btn-primary mt16" onClick={load}>{lang === "fa" ? "تلاش دوباره" : "Try again"}</button>
          </div>
        ) : exams.length === 0 ? (
          <div className="card empty-state">
            <div className="ico"><Icon name="exam" size={30} /></div><h3>{t("noExams")}</h3>
            <div className="muted small mt8">{t("noExamsDesc")}</div>
          </div>
        ) : (
          <div className="grid grid-2">
            {exams.map((e) => (
              <div className="card" key={e.id}>
                <div className="section-title" style={{ marginBottom: 8 }}>
                  <h3 style={{ fontSize: "1.1rem" }}>{biField(e, "title", lang)}</h3>
                  <Pill kind={stateKind(e.state)}>{stateLabel(e.state)}</Pill>
                </div>
                <p className="muted small">{biField(e, "desc", lang)}</p>
                <div className="case-meta mt8">
                  <span className="tag"><Icon name="clock" size={16} /> {fmt(e.starts_at)}</span>
                  <span className="tag"><Icon name="clock" size={16} /> {e.duration_min} {t("min")}</span>
                  <span className="tag">{t("attemptsUsedShort")}: {e.attemptsUsed ?? 0}/{e.max_attempts}</span>
                </div>
                <button className="btn btn-primary btn-block mt16"
                  disabled={e.state !== "open"}
                  style={e.state !== "open" ? { opacity: .5, cursor: "not-allowed" } : {}}
                  onClick={() => e.state === "open" && setOpenId(e.id)}>
                  {e.state === "open" ? t("enterExam") : stateLabel(e.state)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExamDetail({ examId, go, back, home }) {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  const [autoStarted, setAutoStarted] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const load = () => {
    setLoadErr("");
    setData(null);
    api.get(`/exams/${examId}`, { timeoutMs: 20_000, stage: "exam" })
      .then(setData)
      .catch((e) => setLoadErr(loadFailKind(e)));
  };
  useEffect(() => { load(); }, [examId]);

  useEffect(() => {
    if (!data || data.locked || autoStarted) return;
    const cases = data.cases || [];
    const vpLocked = !!data.vpLocked;
    const flashLocked = !!data.flashLocked;
    const flashIds = Array.isArray(data.flashcard_ids) ? data.flashcard_ids : [];
    if (cases.length === 1 && !data.use_flashcards && !vpLocked) {
      setAutoStarted(true);
      go("exam", { caseId: cases[0].case_id, examId, examDuration: data.duration_min, antiCheat: data.anti_cheat });
    } else if ((cases.length === 0 || vpLocked) && data.use_flashcards && flashIds.length && !flashLocked) {
      setAutoStarted(true);
      go("flashcards", { examId, flashcardIds: flashIds, examDuration: data.duration_min, shuffle: data.shuffle, antiCheat: data.anti_cheat, competition: data.competition, showCorrect: data.show_correct, showHints: data.show_hints, noPenalty: !!data.flashNoPenalty });
    }
  }, [data, autoStarted, examId, go]);

  if (loadErr) {
    return (
      <div className="app"><TopBar onHome={home} />
        <div className="container">
          <div className="card empty-state">
            <div className="ico"><Icon name="warn" size={30} /></div>
            <h3>{lang === "fa" ? "«بارگذاری آزمون» قطع شد" : "[Loading the exam] failed"}</h3>
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
  if (!data || autoStarted) return <div className="app"><TopBar onHome={home} /><Spinner /></div>;

  if (data.locked) {
    return (
      <div className="app"><TopBar onHome={home} />
        <div className="container">
          <div className="section-title"><h2>{biField(data, "title", lang)}</h2>
            <button className="btn btn-ghost btn-sm" onClick={back}>← {t("back")}</button></div>
          <div className="card empty-state"><div className="ico"><Icon name="lock" size={30} /></div>
            <h3>{data.lockReason === "attempts" ? t("examAttemptsExhausted") : t("examLocked")}</h3></div>
        </div>
      </div>
    );
  }

  const vpExhausted = !!data.vpLocked;
  const flashExhausted = !!data.flashLocked;
  const exhausted = vpExhausted && (flashExhausted || !data.use_flashcards);

  return (
    <div className="app">
      <TopBar onHome={home} />
      <div className="container">
        <div className="section-title">
          <h2><Icon name="exam" size={16} /> {biField(data, "title", lang)}</h2>
          <button className="btn btn-ghost btn-sm" onClick={back}>← {t("back")}</button>
        </div>
        <div className="card mb16">
          <p className="muted">{biField(data, "desc", lang)}</p>
          <div className="case-meta mt8">
            <span className="tag"><Icon name="clock" size={16} /> {data.duration_min} {t("min")}</span>
            <span className="tag">{t("attemptsUsedShort")}: {data.attemptsUsed ?? 0}/{data.max_attempts}</span>
          </div>
        </div>

        {data.cases && data.cases.length > 0 && (<>
          <h4 className="mb8"><Icon name="patient" size={16} /> {t("examCases")}</h4>
          <div className="grid" style={{ gap: 12 }}>
            {data.cases.map((c) => (
              <div className="case-item" key={c.case_id}>
                <div>
                  <strong>{biField(c, "title", lang)}</strong> <span className="badge-ver">v{c.version}</span>
                  <div className="case-meta"><Pill kind={c.difficulty}>{t(c.difficulty)}</Pill></div>
                </div>
                <button className="btn btn-primary" disabled={vpExhausted}
                  style={vpExhausted ? { opacity: .5, cursor: "not-allowed" } : {}}
                  onClick={() => !vpExhausted && go("exam", { caseId: c.case_id, examId, examDuration: data.duration_min, antiCheat: data.anti_cheat })}>
                  {t("startVp")}
                </button>
              </div>
            ))}
          </div>
        </>)}

        {data.use_flashcards && (data.flashcard_ids || []).length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 16 }}>
            <div className="card mod-card"
              onClick={() => !flashExhausted && go("flashcards", { examId, flashcardIds: data.flashcard_ids || [], examDuration: data.duration_min, shuffle: data.shuffle, antiCheat: data.anti_cheat, competition: data.competition, showCorrect: data.show_correct, showHints: data.show_hints, noPenalty: !!data.flashNoPenalty })}
              style={{ width: "100%", maxWidth: 400, ...(flashExhausted ? { opacity: .5, cursor: "not-allowed" } : {}) }}>
              <div className="mod-ico" style={{ background: "var(--grad-green)" }}><Icon name="flask" size={30} /></div>
              <h3>{t("startFlash")}</h3>
              {flashExhausted && <div className="small muted mt8"><Icon name="lock" size={14} /> {t("examLocked")}</div>}
            </div>
          </div>
        )}
        {(!data.cases || data.cases.length === 0) && !((data.flashcard_ids || []).length > 0 && data.use_flashcards) && (
          <div className="card empty-state">
            <div className="ico"><Icon name="warn" size={30} /></div>
            <h3>{lang === "fa" ? "این آزمون موردی برای شروع ندارد" : "This exam has nothing to start"}</h3>
            <div className="muted small mt8">{lang === "fa"
              ? "نه کیس بیمار مجازی و نه فلش‌کارت به این آزمون وصل است. به استاد بگویید."
              : "No virtual-patient case and no flashcards are attached. Tell your instructor."}</div>
          </div>
        )}
      </div>
    </div>
  );
}
