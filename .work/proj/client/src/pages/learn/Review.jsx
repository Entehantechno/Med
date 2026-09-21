import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { TYPE_MAP, MicroLesson } from "./QuestionTypes.jsx";

/* Spaced-repetition review: shows due cards. The learner reveals the answer,
   then self-grades (Again/Hard/Good/Easy) which reschedules the card. */
export default function Review({ onProfile, go }) {
  const { t, lang } = useApp();
  const [mode, setMode] = useState("due");   // due | saved
  const [cards, setCards] = useState(null);
  const [calm, setCalm] = useState(null);   // Calm Mode review-cap info
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setCards(null); setIdx(0); setRevealed(false); setReviewed(0); setDone(false);
    const url = mode === "saved" ? "/learn/review/saved" : "/learn/review";
    api.get(`${url}?lang=${lang}`).then((d) => { setCards(d.cards); setStats(d.stats || null); setCalm(d.calm || null); }).catch(() => setCards([]));
  }, [lang, mode]);

  // FSRS interval label helper: "۱ روز" / "۳ ماه" style short label
  const ivLabel = (days) => {
    if (days == null) return "";
    if (days < 1) return lang === "fa" ? "امروز" : "today";
    if (days < 30) return `${days}${lang === "fa" ? "ر" : "d"}`;
    if (days < 365) return `${Math.round(days / 30)}${lang === "fa" ? "م" : "mo"}`;
    return `${Math.round(days / 365)}${lang === "fa" ? "س" : "y"}`;
  };

  const Tabs = () => (
    <div className="tabs mb16">
      <button className={`tab ${mode === "due" ? "active" : ""}`} onClick={() => setMode("due")}><Icon name="repeat" size={15} /> {t("dueCardsTab")}</button>
      <button className={`tab ${mode === "saved" ? "active" : ""}`} onClick={() => setMode("saved")}><Icon name="star" size={15} /> {t("savedCardsTab")}</button>
    </div>
  );

  if (!cards) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (cards.length === 0 || done)
    return (
      <div className="page">
        <div className="section-title"><h2><Icon name="repeat" size={22} /> {t("review")}</h2></div>
        <Tabs />
        <div className="card empty-state">
          <div className="ico" style={{ color: "var(--green)" }}><Icon name="check" size={48} /></div>
          <h3>{done ? t("reviewDone") : (mode === "saved" ? t("noSaved") : t("noReviews"))}</h3>
          {mode === "saved" && !done && <div className="muted small mt8">{t("noSavedHint")}</div>}
          {done && <div className="muted small mt8">{reviewed} {t("cardsReviewed")}</div>}
          {/* Not a dead end: point the learner to the next useful action. */}
          {mode === "due" && (
            <>
              <div className="muted small mt8">{t("reviewEmptyHint")}</div>
              {go && <button className="btn btn-primary empty-cta" onClick={() => go("path")}>
                <Icon name="play" size={16} /> {t("continueLearning")}
              </button>}
            </>
          )}
          {mode === "saved" && go && (
            <button className="btn btn-ghost empty-cta" onClick={() => go("path")}>
              <Icon name="play" size={16} /> {t("continueLearning")}
            </button>
          )}
        </div>
      </div>
    );

  const card = cards[idx];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;

  const grade = async (g) => {
    try { const { profile } = await api.post("/learn/review/grade", { cardId: card.id, grade: g }); onProfile?.(profile); } catch { /* */ }
    setReviewed((n) => n + 1);
    if (idx + 1 < cards.length) { setIdx(idx + 1); setRevealed(false); }
    else setDone(true);
  };

  const nextSaved = () => {
    if (idx + 1 < cards.length) { setIdx(idx + 1); setRevealed(false); }
    else setDone(true);
  };

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="repeat" size={22} /> {mode === "saved" ? t("savedCardsTab") : t("reviewDue")}</h2>
        <span className="tag">{idx + 1} / {cards.length}</span></div>
      <Tabs />
      <div className="muted small mb16">{mode === "saved" ? t("savedCardsHint") : t("reviewDesc")}</div>

      {/* Calm Mode: reassure the learner that the pile is intentionally trimmed */}
      {mode === "due" && calm?.capped && (
        <div className="card calm-cap-note mb16">
          🌿 {t("calmCapNote").replace("{cap}", calm.cap).replace("{total}", calm.totalDue)}
        </div>
      )}

      {/* FSRS memory dashboard: scheduler + retention target + avg stability */}
      {mode === "due" && stats && (
        <div className="srs-stats mb16">
          <span className="srs-chip" title={t("srsScheduler")}>🧠 {stats.scheduler === "fsrs" ? "FSRS-6" : "SM-2"}</span>
          <span className="srs-chip" title={t("srsRetentionHint")}>🎯 {Math.round((stats.retention || 0) * 100)}% {t("srsRetention")}</span>
          <span className="srs-chip" title={t("srsStabilityHint")}>📈 {stats.avgStability} {t("srsAvgStability")}</span>
          <span className="srs-chip">✅ {stats.mature} {t("srsMature")}</span>
        </div>
      )}

      <div className="lesson-wrap">
        <div className="pbar mb16"><span style={{ width: `${Math.round((idx / cards.length) * 100)}%` }} /></div>
        <div className="lesson-q">{card.q}</div>
        {card.image && <img src={card.image} alt="" style={{ maxHeight: 180, display: "block", margin: "0 auto 14px", borderRadius: 12 }} />}

        {/* show the card content; in review we reveal the answer + micro */}
        <Type card={card} checked={revealed} sel={reviewAnswer(card)} setSel={() => {}} />
        {revealed && card.micro && <MicroLesson micro={card.micro} defaultOpen={true} />}

        {!revealed ? (
          <div className="lesson-cta mt16">
          <button className="btn btn-primary btn-block" onClick={() => setRevealed(true)}>
            <Icon name="check" size={16} /> {t("showAnswer")}
          </button>
          </div>
        ) : mode === "saved" ? (
          <div className="lesson-cta mt16">
          <button className="btn btn-accent btn-block" onClick={nextSaved}>
            {idx + 1 < cards.length ? t("next") : t("finish")}
          </button>
          </div>
        ) : (
          <div className="lesson-cta mt16">
            <div className="small muted mb8" style={{ textAlign: "center" }}>{t("howWell")}</div>
            <div className="grade-row">
              <button className="btn grade-again" aria-label={t("gAgain")} onClick={() => grade(0)}><span className="grade-lbl">{t("gAgain")}</span>{card.preview && <span className="grade-iv">{ivLabel(card.preview.again)}</span>}</button>
              <button className="btn grade-hard" aria-label={t("gHard")} onClick={() => grade(1)}><span className="grade-lbl">{t("gHard")}</span>{card.preview && <span className="grade-iv">{ivLabel(card.preview.hard)}</span>}</button>
              <button className="btn grade-good" aria-label={t("gGood")} onClick={() => grade(2)}><span className="grade-lbl">{t("gGood")}</span>{card.preview && <span className="grade-iv">{ivLabel(card.preview.good)}</span>}</button>
              <button className="btn grade-easy" aria-label={t("gEasy")} onClick={() => grade(3)}><span className="grade-lbl">{t("gEasy")}</span>{card.preview && <span className="grade-iv">{ivLabel(card.preview.easy)}</span>}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* When revealing, pre-fill the "answer" so the type renderer highlights the correct one. */
function reviewAnswer(card) {
  if (card.type === "mcq") return card.options.findIndex((o) => o.correct);
  if (card.type === "truefalse") return card.answer;
  if (card.type === "fill") return card.blank;
  if (card.type === "match") return { pairs: Object.fromEntries((card.left || []).map((l) => [l.id, l.id])), activeLeft: null };
  if (card.type === "order") return (card.items || []).map((it) => it);
  return null;
}
