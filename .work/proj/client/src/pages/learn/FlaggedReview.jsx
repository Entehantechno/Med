import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { TYPE_MAP } from "./QuestionTypes.jsx";
import Emphasis from "../../components/Emphasis.jsx";

/* Flagged / lucky-guess review hub: re-drill the questions you FLAGGED to revisit
   or got right but honestly marked as a GUESS. A clean correct answer (not a
   guess) clears the card from your flagged list. Mirrors the Mistakes hub but
   surfaces the per-option rationale so it's a true reasoning review. */
export default function FlaggedReview({ onProfile, onBack }) {
  const { t, lang } = useApp();
  const [cards, setCards] = useState(null);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [guessed, setGuessed] = useState(false);
  const [done, setDone] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => { api.get(`/learn/flagged?lang=${lang}`).then((d) => setCards(d.cards)).catch(() => setCards([])); }, [lang]);
  if (!cards) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  if (cards.length === 0)
    return (
      <div className="card empty-state">
        <div className="ico"><Icon name="check" size={40} /></div>
        <h3>{t("noFlagged")}</h3>
        <div className="small muted">{t("noFlaggedDesc")}</div>
        <button className="btn btn-ghost mt16" onClick={onBack}>{t("back")}</button>
      </div>
    );

  if (done)
    return (
      <div className="card empty-state">
        <div className="ico">🎉</div>
        <h3>{t("mistakesCleared") || "تمام شد!"}</h3>
        <button className="btn btn-primary mt16" onClick={onBack}>{t("back")}</button>
      </div>
    );

  const card = cards[idx];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;
  const canCheck = Type.canCheck({ sel }, card);

  const check = async () => {
    const right = Type.judge(card, { sel });
    setChecked(true); setWasCorrect(right);
  };
  const next = async () => {
    // submit with the guess signal so a lucky guess stays in the review list
    try {
      const r = await api.post("/learn/flagged/answer", {
        cardId: card.id, correct: wasCorrect, guessed, flagged: false,
        responseMs: Date.now() - startRef.current,
      });
      onProfile?.(r.profile);
    } catch { /* */ }
    if (idx + 1 < cards.length) { setIdx(idx + 1); setSel(null); setChecked(false); setGuessed(false); startRef.current = Date.now(); }
    else setDone(true);
  };

  return (
    <div className="lesson-wrap">
      <div className="lesson-top">
        <button className="btn btn-ghost btn-sm icon-btn" onClick={onBack} title={t("back")}><Icon name="logout" size={16} /></button>
        <div className="pbar"><span style={{ width: `${Math.round((idx / cards.length) * 100)}%` }} /></div>
        <span className="tag">🚩 {idx + 1}/{cards.length}</span>
      </div>
      <div className="card">
        <div className="q-text lesson-q">{card.q}</div>
        <Type card={card} sel={sel} setSel={setSel} checked={checked} isCorrect={wasCorrect} />
        {checked && (
          <>
            <div className={`lesson-fb ${wasCorrect ? "ok" : "bad"}`} style={{ marginTop: 12 }}>
              <Icon name={wasCorrect ? "check" : "warn"} size={18} /> <b>{wasCorrect ? t("correct") : t("wrong")}</b>
            </div>
            {card.explain && (card.explain.text) && (
              <div className="answer-explain"><div className="ae-title"><Icon name="check" size={15} /> {t("answerKey")}</div>
                <Emphasis as="div" className="ae-text" text={card.explain.text} /></div>
            )}
            {wasCorrect && (
              <div className="study-signals">
                <button type="button" className={`sig-btn ${guessed ? "on" : ""}`} onClick={() => setGuessed(!guessed)}>🤔 {t("iGuessed")}</button>
              </div>
            )}
          </>
        )}
      </div>
      <div className="lesson-actions">
        {!checked
          ? <button className="btn btn-primary btn-block" disabled={!canCheck} onClick={check}>{t("check")}</button>
          : <button className="btn btn-accent btn-block" onClick={next}>{idx + 1 < cards.length ? t("next") : t("finish")}</button>}
      </div>
    </div>
  );
}
