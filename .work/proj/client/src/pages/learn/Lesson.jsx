import { useEffect, useState, useRef } from "react";
import { markBusy } from "../../lib/sw-update.js";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Confetti from "../../components/Confetti.jsx";
import StatNum from "../../components/StatNum.jsx";
import RewardStars from "../../components/RewardStars.jsx";
import { StreakIcon, HeartIcon, GemIcon, XpIcon } from "../../components/StatIcons.jsx";
import { DrMed } from "../../components/PathMascots.jsx";
import { currentMascots, loadMascots } from "../../lib/mascotConfig.js";
import { AdCard } from "./AdCard.jsx";
import { MotionAd } from "./MotionAd.jsx";
import { PremiumCard, PremiumInline } from "./PremiumBanner.jsx";
import { RewardedAd } from "./RewardedAd.jsx";
import { TYPE_MAP, MicroLesson } from "./QuestionTypes.jsx";
import { useSummaryBullets } from "../../components/ResolvedBullets.jsx";
import MediaEmbed from "../../components/MediaEmbed.jsx";
import BugReportButton from "../../components/BugReportButton.jsx";
import HighlightableStem from "../../components/HighlightableStem.jsx";
import LessonInsights from "../../components/LessonInsights.jsx";
import { NoteButton } from "./Notes.jsx";
import { CalibrationChip } from "./MedGuide.jsx";
import { playCorrect, playWrong, celebrate } from "../../lib/feedback.js";
import { optionLetter } from "../../lib/optionLetter.js";
import Emphasis from "../../components/Emphasis.jsx";
import GlossaryText from "../../components/GlossaryText.jsx";
import { OptionStatsBars, HintButton, SaveFlashcardButton } from "../../components/PeerBits.jsx";
import LabValuesModal from "../../components/LabValuesModal.jsx";

const sessKey = (nodeId) => `medlab_lesson_${nodeId}`;
function loadSess(nodeId) {
  try { return JSON.parse(sessionStorage.getItem(sessKey(nodeId)) || "null"); } catch { return null; }
}
function saveSess(nodeId, payload) {
  try { sessionStorage.setItem(sessKey(nodeId), JSON.stringify(payload)); } catch { /* */ }
}
function clearSess(nodeId) {
  try { sessionStorage.removeItem(sessKey(nodeId)); } catch { /* */ }
}

/* pick a varied, encouraging message so feedback never feels repetitive
   (research: an emotional/encouraging layer + safe failure lifts retention). */
function pick(t, keys) { return t(keys[Math.floor(Math.random() * keys.length)]); }
const PRAISE = ["encourage1", "encourage2", "encourage3", "encourage4", "encourage5"];
const GENTLE = ["gentleWrong1", "gentleWrong2", "gentleWrong3"];

/* Best-effort human-readable "correct answer" for corrective feedback. */
function correctAnswerText(card, lang) {
  if (card.type === "mcq" && Array.isArray(card.options)) {
    const i = card.options.findIndex((x) => x.correct);
    const o = i >= 0 ? card.options[i] : null;
    if (!o) return null;
    const L = optionLetter(i, lang);
    return L ? `${L}) ${o.text}` : o.text;
  }
  if (card.type === "truefalse") return card.answer ? (lang === "fa" ? "درست" : "True") : (lang === "fa" ? "نادرست" : "False");
  if (card.type === "fill") return card.blank || null;
  return null; // order/other types reveal the answer inline already
}

export default function Lesson({ nodeId, onDone, onProfile, onContinueLesson, onPremiumWanted }) {
  // Tell sw-update.js that in-progress work is on screen: a new build must
  // not auto-reload the page until this screen unmounts.
  useEffect(() => { markBusy(true); return () => markBusy(false); }, []);
  const { t, lang, sound: soundOn, setSound, flag } = useApp();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [flagged, setFlagged] = useState(false);   // learner flagged this Q to revisit
  const [guessed, setGuessed] = useState(false);    // learner admitted it was a guess
  const [confidence, setConfidence] = useState(0);  // CBA: 0=none,1=low,2=med,3=high
  const [hintUsed, setHintUsed] = useState(false);  // Round 9: learner took the pre-answer hint
  const [showMicro, setShowMicro] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [combo, setCombo] = useState(0);            // consecutive correct in this lesson
  const [bestCombo, setBestCombo] = useState(0);
  const [fbMsg, setFbMsg] = useState("");           // varied encouragement line
  const [hearts, setHearts] = useState(5);
  const [premium, setPremium] = useState(false);
  const [buryMsg, setBuryMsg] = useState("");
  const [buryBusy, setBuryBusy] = useState(null);
  const [features, setFeatures] = useState({ high_yield: true, learning_radar: true, bury: true, suspend: true, bury_show_in_lesson: true, bury_show_in_review: true, high_yield_show_toggle: true, high_yield_persist_choice: true, bug_hunt: true });
  useEffect(() => { api.get("/learn/features").then(setFeatures).catch(() => {}); }, []);
  useEffect(() => { setBuryMsg(""); setBuryBusy(null); }, [idx]);
  const [showLabModal, setShowLabModal] = useState(false);
  const [stemZoom, setStemZoom] = useState(() => { try { return Number(localStorage.getItem("med_stem_zoom") || 1); } catch { return 1; } });
  const adjustZoom = (d) => {
    const next = Math.max(0.85, Math.min(1.4, Number((stemZoom + d).toFixed(2))));
    setStemZoom(next);
    try { localStorage.setItem("med_stem_zoom", String(next)); } catch {}
  };
  const [result, setResult] = useState(null);
  const [betweenAd, setBetweenAd] = useState(null);
  const [introAd, setIntroAd] = useState(null);   // shown before the first question
  const [introDismissed, setIntroDismissed] = useState(false);
  const startRef = useRef(Date.now());
  const cardStartRef = useRef(Date.now());   // per-card timer for response time
  const answersRef = useRef([]);             // collected per-card telemetry
  const ctaRef = useRef(null);
  const finishingRef = useRef(false);
  const outOfHearts = !premium && hearts <= 0;

  useEffect(() => {
    const sess = nodeId ? loadSess(nodeId) : null;
    const sameNode = !!sess;
    if (!sameNode) {
      setIdx(0); setSel(null); setChecked(false); setCorrect(0); setResult(null); setShowMicro(false);
      setIntroDismissed(false);
      setCombo(0); setBestCombo(0); setFbMsg("");
      startRef.current = Date.now();
      cardStartRef.current = Date.now();
      answersRef.current = [];
    }
    setErr(null);
    const idsQ = sess?.cardIds?.length ? `&ids=${sess.cardIds.join(",")}` : "";
    api.get(`/learn/lesson/${nodeId}?lang=${lang}${idsQ}`)
      .then((d) => {
        setData(d);
        setHearts(d.hearts);
        setPremium(d.premium);
        if (sess?.cardIds?.length) {
          setIdx(Math.min(sess.idx || 0, Math.max(0, (d.cards || []).length - 1)));
          setCorrect(sess.correct || 0);
          answersRef.current = Array.isArray(sess.answers) ? sess.answers : [];
        } else {
          saveSess(nodeId, { cardIds: (d.cards || []).map((c) => c.id), idx: 0, correct: 0, answers: [] });
        }
      })
      .catch((e) => setErr(e.message));
    api.get(`/learn/ads?slot=between-lessons&lang=${lang}`).then((d) => setBetweenAd(d.ads?.[0] || null)).catch(() => {});
    api.get(`/learn/ads?slot=lesson-intro&node=${nodeId}&lang=${lang}`).then((d) => setIntroAd(d.ads?.[0] || null)).catch(() => {});
  }, [nodeId, lang]);

  // Desktop power-user: 1–4 picks the matching booklet letter (الف/A …).
  // After check, Enter advances — same muscle memory as «بررسی پاسخ».
  useEffect(() => {
    if (result || !data) return;
    const cardNow = (data.cards || [])[idx];
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "l" || e.key === "L" || e.code === "KeyL") {
        e.preventDefault();
        setShowLabModal((s) => !s);
        return;
      }
      if (showLabModal) return;
      if (e.key === "f" || e.key === "F" || e.code === "KeyF") {
        e.preventDefault();
        setFlagged((prev) => !prev);
        return;
      }
      if (checked) {
        if (e.key === "Enter") {
          e.preventDefault();
          document.querySelector(".lesson-cta .btn-accent")?.click();
        }
        return;
      }
      let num = -1;
      if (e.key >= "1" && e.key <= "9") num = Number(e.key) - 1;
      else if ("۱۲۳۴۵۶۷۸۹".includes(e.key)) num = "۱۲۳۴۵۶۷۸۹".indexOf(e.key);
      else if ("١٢٣٤٥٦٧٨٩".includes(e.key)) num = "١٢٣٤٥٦٧٨٩".indexOf(e.key);
      else if (e.code && /^Digit[1-9]$/.test(e.code)) num = Number(e.code.slice(5)) - 1;
      else if (e.code && /^Numpad[1-9]$/.test(e.code)) num = Number(e.code.slice(6)) - 1;

      if (num >= 0 && cardNow?.options && num < cardNow.options.length) {
        e.preventDefault();
        setSel(num);
      }
      if (e.key === "Enter" && cardNow?.options && sel != null) {
        e.preventDefault();
        document.querySelector(".lesson-cta .btn-primary")?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checked, result, data, idx, sel, showLabModal]);

  if (err === "no hearts" || err === "HTTP 402") return <OutOfHearts onProfile={onProfile} onBack={onDone} />;
  if (err === "premium only" || err === "HTTP 403") return (
    <div className="card empty-state">
      <div className="ico" style={{ fontSize: 48, lineHeight: 1 }}>👑</div>
      <h3>{lang === "fa" ? "تمرین بیشتر ویژه اعضای پلاس است" : "Extra practice is for Plus members"}</h3>
      <div className="muted small mt8">{lang === "fa" ? "درس‌های اصلی هر فصل رایگان‌اند؛ با پلاس به سؤال‌های بیشترِ همین فصل، بانک سؤال و قلب نامحدود دسترسی دارید." : "Core lessons are free; Plus unlocks more questions per chapter, the question bank and unlimited hearts."}</div>
      <button type="button" className="btn btn-primary mt16" onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }))}>{lang === "fa" ? "مشاهده پلاس" : "See Plus"}</button>
      <button type="button" className="btn btn-ghost mt8" onClick={onDone}>{t("back")}</button>
    </div>
  );
  if (err) return <div className="card empty-state"><div className="ico"><Icon name="warn" size={40} /></div><h3>{err}</h3><button type="button" className="btn btn-ghost mt16" onClick={onDone}>{t("back")}</button></div>;
  if (!data) return <div className="card"><div className="skeleton" style={{ height: 240 }} /></div>;

  // lesson-intro motion graphic — admin ad inside premium motion shell, curated house promo otherwise
  if (!introDismissed && (introAd || !premium)) {
    // show curated intro only once per session for non-premium; premium with no admin ad skips straight to lesson
    const showCuratedIntro = !introAd && !premium && !introDismissed;
    if (introAd || showCuratedIntro) {
      return (
        <div className="lesson-wrap">
          <div className="lesson-top">
            <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={onDone} title={t("back")}><Icon name="logout" size={16} /></button>
            <div style={{ flex: 1 }} />
          </div>
          {introAd ? (
            <MotionAd ad={introAd} variant="intro" onCta={() => setIntroDismissed(true)} />
          ) : (
            <MotionAd variant="intro" onCta={() => setIntroDismissed(true)} />
          )}
          <button type="button" className="btn btn-primary btn-block mt16" onClick={() => setIntroDismissed(true)}>
            <Icon name="play" size={16} /> {t("startLesson")}
          </button>
          {!introAd && (
            <div className="small muted center mt8" style={{ opacity:.7 }}>
              {lang === "fa" ? "پیشنهاد ویژه — با پلاس بدون تبلیغ و با قلب نامحدود ادامه بده" : "Special — go Plus for no ads & unlimited hearts"}
            </div>
          )}
        </div>
      );
    }
  }

  const cards = data.cards;
  const card = cards[idx];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;

  // update the flag/guess signal on the CURRENT card's telemetry entry
  const setSignal = (key, val) => {
    if (key === "flagged") setFlagged(val); else setGuessed(val);
    const a = answersRef.current.find((x) => x.cardId === card.id && x._idx === idx);
    if (a) a[key] = val;
  };

  const check = async () => {
    if (checked) return;
    setChecked(true);
    const right = Type.judge(card, { sel });
    setWasCorrect(right);
    setShowMicro(!right); // auto-open lesson on wrong
    // record per-card telemetry (correctness + response time + flag/guess signals)
    answersRef.current.push({ cardId: card.id, _idx: idx, correct: right, responseMs: Date.now() - cardStartRef.current, flagged, guessed, confidence, sel: Number.isInteger(sel) ? sel : null, hintUsed });
    requestAnimationFrame(() => {
      // Center keeps the CTA visible above the sticky mobile tabbar (block:"end" hid it underneath).
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    if (right) {
      setCorrect((c) => c + 1);
      setCombo((n) => { const nn = n + 1; setBestCombo((b) => Math.max(b, nn)); return nn; });
      // multisensory feedback + varied praise (a combo message when on a roll)
      playCorrect();
      const nextCombo = combo + 1;
      setFbMsg(nextCombo >= 3 ? t("comboWow").replace("{n}", String(nextCombo)) : pick(t, PRAISE));
    } else {
      setCombo(0);
      playWrong();
      setFbMsg(pick(t, GENTLE));   // gentle, safe-failure message
      if (!premium) {
        try { const r = await api.post("/learn/heart/lose"); setHearts(r.hearts); setPremium(r.premium); } catch { /* */ }
      }
    }
  };

  const toggleSound = () => setSound(!soundOn);

  const next = async () => {
    if (!checked) return;
    if (idx + 1 < cards.length) {
      const ni = idx + 1;
      setIdx(ni); setSel(null); setChecked(false); setShowMicro(false); setFbMsg(""); setFlagged(false); setGuessed(false); setHintUsed(false); setConfidence(0); cardStartRef.current = Date.now();
      saveSess(nodeId, { cardIds: cards.map((c) => c.id), idx: ni, correct, answers: answersRef.current });
      return;
    }
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const r = await api.post(`/learn/lesson/${nodeId}/finish`, { correct, total: cards.length, answers: answersRef.current, lang });
      clearSess(nodeId);
      setResult(r); onProfile?.(r.profile);
    } catch (e) {
      finishingRef.current = false;
      setErr(e.message);
    }
  };

  const replay = () => {
    finishingRef.current = false;
    // reload the same lesson from scratch (new random order) to chase a perfect score
    setResult(null); setIdx(0); setSel(null); setChecked(false); setCorrect(0); setShowMicro(false);
    setCombo(0); setBestCombo(0); setFbMsg("");
    answersRef.current = []; cardStartRef.current = Date.now();
    api.get(`/learn/lesson/${nodeId}?lang=${lang}`).then((d) => { setData(d); setHearts(d.hearts); setPremium(d.premium); }).catch((e) => setErr(e.message));
  };

  if (outOfHearts && !result) return <OutOfHearts onProfile={onProfile} onBack={onDone} />;
  if (result) return <Celebrate result={result} betweenAd={betweenAd} onDone={onDone} onReplay={replay} onContinueLesson={onContinueLesson} />;

  // Safe-failure progress: the bar always moves forward a little on a checked
  // card (even a wrong one) so the learner never feels "stuck" — Duolingo's
  // "something always moves forward" principle. Base = questions passed.
  const stepPct = 100 / cards.length;
  const progress = Math.min(100, Math.round(idx * stepPct + (checked ? stepPct * (wasCorrect ? 1 : 0.35) : 0)));
  const canCheck = Type.canCheck({ sel }, card);
  const caText = !wasCorrect ? correctAnswerText(card, lang) : null;

  return (
    <div className="lesson-wrap">
      <div className="lesson-top">
        <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={onDone} title={t("back")}><Icon name="logout" size={16} /></button>
        <div className="pbar" style={{ "--seg": cards.length }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`${idx + 1} / ${cards.length}`}><span style={{ width: `${progress}%` }} /></div>
        {combo >= 2 && <span className="combo-chip" title={t("comboLabel")}><StreakIcon size={15} /> {combo}</span>}
        <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={toggleSound} title={soundOn ? t("soundOff") : t("soundOn")} aria-label={soundOn ? t("soundOff") : t("soundOn")}>
          {soundOn ? "🔊" : "🔇"}
        </button>
        <button type="button"
          className="btn btn-ghost btn-sm icon-btn"
          onClick={() => setShowLabModal(true)}
          title={lang === "fa" ? "مقادیر نرمال آزمایشگاهی (کلید L)" : "Normal Lab Values (Key L)"}
          aria-label={lang === "fa" ? "مقادیر نرمال آزمایشگاهی" : "Normal Lab Values"}
        >
          🧪
        </button>
        <div className="stem-zoom-wrap" title={lang === "fa" ? "اندازه متن سناریو" : "Vignette text size"}>
          <button type="button" className="zoom-btn" onClick={() => adjustZoom(-0.08)} aria-label="A-">A-</button>
          <button type="button" className="zoom-btn" onClick={() => adjustZoom(0.08)} aria-label="A+">A+</button>
        </div>
        <span className="hud-chip heart" style={{ fontSize: ".95rem" }}><HeartIcon size={17} /> {premium ? "∞" : hearts}</span>
      </div>

      {/* Stage header: explicit title + the concepts this stage tests */}
      {idx === 0 && data.node?.title && (
        <div className="lesson-stage-head">
          <div className="lsh-title">{data.node.title}</div>
          {data.node.subtitle && <div className="lsh-subtitle small muted">{data.node.subtitle}</div>}
        </div>
      )}

      <div className="small muted" style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <span>{idx + 1} {t("of")} {cards.length} · <span className="type-tag">{typeLabel(card.type, lang)}</span>
          {card.review && <span className="review-tag" title={t("reviewCardHint")}>🔄 {t("reviewCard")}</span>}
          {idx === 0 && <CalibrationChip calibration={data.calibration} />}</span>
        {flag("library") && <SaveCardButton cardId={card.id} />}
      </div>
      {(card.source || card.chapter) && (
        <div className="exam-source-row">
          {card.source && <span className="exam-source-chip" title={card.source}>📄 {card.source}</span>}
          {card.chapter && <span className="exam-chapter-chip">{card.chapter}</span>}
        </div>
      )}
      {/* Beautiful question card — glass + accent */}
      <div className="lesson-q-card">
        <div className="lesson-q-accent" aria-hidden="true" />
        <HighlightableStem text={card.q} highlights={card.highlights} className="lesson-q" style={{ fontSize: `${stemZoom * 1.35}rem`, lineHeight: 1.75 }} />
        {card.media
          ? <MediaEmbed media={card.media} className="lesson-media" />
          : card.image && <img src={card.image} alt={card.imageAlt || (lang === "fa" ? "طرح آموزشی سؤال" : "Teaching figure")} className="ddle-img" style={{ maxHeight: 220, margin: "0 auto 16px", display: "block", borderRadius: 12 }} />}
        <Type card={card} checked={checked} sel={sel} setSel={setSel} isCorrect={wasCorrect} glossary={data.glossary} />
        {/* Resource bar: reference unlimited + mindmap limited — competitive path */}
        <LessonResourceBar card={card} premium={premium} lang={lang} />
      </div>

      {!checked && flag("hint") && <HintButton card={card} premium={premium} onUsed={() => setHintUsed(true)} onProfile={(pp) => onProfile?.((prev) => ({ ...(prev || {}), ...pp }))} />}

      {checked && (
        <>
          <div className={`lesson-fb ${wasCorrect ? "ok" : "bad"}`} role="status" aria-live="polite">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Icon name={wasCorrect ? "check" : "warn"} size={18} />
              <b>{wasCorrect ? t("correct") : t("wrong")}</b>
              {fbMsg && <span className="fb-encourage">{fbMsg}</span>}
              {/* crowd difficulty: how many people got this right */}
              {card.crowd && card.crowd.seen >= 3 && (
                <span className="crowd-inline" title={t("crowdInsightsHint")}>
                  👥 {card.crowd.passRate}% {t("crowdPassRate")}
                </span>
              )}
            </div>
            {/* Confidence calibration nudge: praise honest self-rating, and
                gently flag dangerous overconfidence (felt sure but was wrong). */}
            {confidence > 0 && (
              confidence === 3 && !wasCorrect
                ? <div className="conf-note danger">⚠️ {t("confOverconfident")}</div>
                : confidence === 1 && wasCorrect
                  ? <div className="conf-note good">💪 {t("confHumbleWin")}</div>
                  : confidence === 3 && wasCorrect
                    ? <div className="conf-note good">🎯 {t("confJustified")}</div>
                    : null
            )}
            {/* corrective feedback: show the correct answer on a miss (research:
                corrective feedback amplifies retrieval-practice gains) */}
            {caText && (
              <div className="fb-correct-answer">{t("correctAnswerWas")} <b>{caText}</b></div>
            )}
            {/* study signals (UWorld-style): flag to revisit + honest "I guessed"
                so a lucky correct answer is still surfaced for review later */}
            <div className="study-signals">
              <button type="button" className={`sig-btn ${flagged ? "on" : ""}`} onClick={() => setSignal("flagged", !flagged)}
                title={t("flagHint")}>🚩 {t("flagForReview")}</button>
              {wasCorrect && (
                <button type="button" className={`sig-btn ${guessed ? "on" : ""}`} onClick={() => setSignal("guessed", !guessed)}
                  title={t("guessHint")}>🤔 {t("iGuessed")}</button>
              )}
            </div>
          </div>
          {/* «شناسنامهٔ سؤال» — what % of learners picked each option (Round 9) */}
          {flag("option_stats") && card.optionStats && <OptionStatsBars card={card} sel={sel} />}
          {/* پاسخنامه — dedicated answer explanation (text + optional media),
              shown right after answering (auto-open). Distinct from the درسنامه. */}
          {card.explain && (card.explain.text || card.explain.media) && (
            <div className="answer-explain">
              <div className="ae-title"><Icon name="check" size={15} /> {t("answerKey")}</div>
              {card.explain.media && <MediaEmbed media={card.explain.media} className="ae-media" />}
              {card.explain.text && <GlossaryText as="div" className="ae-text" text={card.explain.text} glossary={data.glossary} />}
            </div>
          )}
          {/* Attending-physician tip (AMBOSS-style) — a short expert nudge on how
              to reason toward the answer. Shown after answering. */}
          {card.attending && (
            <div className="attending-tip">
              <div className="at-title"><Icon name="patient" size={15} /> {t("attendingTip")}</div>
              <div className="at-text">{card.attending}</div>
            </div>
          )}
          {/* QB micro lesson: auto-open on wrong, offered as a button on correct — respects High-Yield + Learning Radar */}
          {card.micro && (wasCorrect
            ? <MicroLesson micro={card.micro} defaultOpen={showMicro} glossary={data.glossary} features={features} />
            : <MicroLesson micro={card.micro} defaultOpen={true} glossary={data.glossary} features={features} />)}
          {/* visual mnemonic (Sketchy-style) shown when the card carries one */}
          {card.mnemonic && (
            <div className="card mn-inline" style={{ marginTop: 10 }}>
              <div className="mn-title">🧠 {card.mnemonic.title || t("mnemonics")}</div>
              {card.mnemonic.media
                ? <MediaEmbed media={card.mnemonic.media} className="mn-media" />
                : card.mnemonic.image ? <img className="mn-img" src={card.mnemonic.image} alt="" /> : null}
              {card.mnemonic.scene && <div className="mn-scene">{card.mnemonic.scene}</div>}
              {card.mnemonic.hooks?.length > 0 && (
                <ul className="mn-hooks">{card.mnemonic.hooks.map((h, i) => <li key={i}><span className="mn-hook-dot">🔗</span> {h}</li>)}</ul>
              )}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10, gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {flag("notes") && <NoteButton cardId={card.id} />}
            {flag("learner_cards") && flag("save_flashcard") && <SaveFlashcardButton cardId={card.id} premium={premium} onPremium={() => onPremiumWanted?.()} />}
            {features.bury && features.bury_show_in_lesson !== false && <button type="button" className="btn btn-ghost btn-sm" disabled={!!buryBusy} onClick={async () => {
              if (buryBusy) return; setBuryBusy("bury");
              try { await api.post("/learn/review/bury", { cardId: card.id }); setBuryMsg(lang === "fa" ? "تا فردا مخفی شد" : "Buried until tomorrow"); setTimeout(() => setBuryMsg(""), 2500); }
              catch (e) { setBuryMsg(e.message || "خطا"); } finally { setBuryBusy(null); }
            }} title={lang === "fa" ? "مخفی تا فردا (bury)" : "Bury until tomorrow"}>⏸ {lang === "fa" ? "مخفی" : "Bury"}</button>}
            {features.suspend && features.bury_show_in_lesson !== false && <button type="button" className="btn btn-ghost btn-sm" disabled={!!buryBusy} onClick={async () => {
              if (buryBusy) return; setBuryBusy("suspend");
              try { await api.post("/learn/review/suspend", { cardId: card.id }); setBuryMsg(lang === "fa" ? "تعلیق شد — دیگر نمایش داده نمی‌شود" : "Suspended"); setTimeout(() => setBuryMsg(""), 2500); }
              catch (e) { setBuryMsg(e.message || "خطا"); } finally { setBuryBusy(null); }
            }} title={lang === "fa" ? "تعلیق کامل" : "Suspend"}>🚫 {lang === "fa" ? "تعلیق" : "Suspend"}</button>}
            {buryMsg && <span className="small muted">{buryMsg}</span>}
            {features.bug_hunt !== false && <BugReportButton cardId={card.id} />}
          </div>
        </>
      )}

      {/* Confidence-Based Assessment: before checking, the learner declares how
          sure they are. This trains metacognition ("do you know what you know?")
          — a core clinical-safety skill. Optional (admin flag) and never costs XP. */}
      {!checked && flag("confidence_assess") && (
        <div className="conf-picker" role="group" aria-label={t("confidenceAsk")}>
          <div className="conf-ask small muted">{t("confidenceAsk")}</div>
          <div className="conf-btns">
            {[[1, "😕", t("confLow")], [2, "🙂", t("confMed")], [3, "😎", t("confHigh")]].map(([v, emo, lbl]) => (
              <button key={v} type="button"
                className={`conf-btn conf-${v} ${confidence === v ? "on" : ""}`}
                aria-pressed={confidence === v}
                onClick={() => setConfidence(confidence === v ? 0 : v)}>
                <span className="conf-emo" aria-hidden="true">{emo}</span> {lbl}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="lesson-cta mt16" ref={ctaRef}>
        {!checked
          ? <button type="button" className="btn btn-primary btn-block" disabled={!canCheck} onClick={check}>{t("checkAns")}</button>
          : <button type="button" className="btn btn-accent btn-block" onClick={next}>{idx + 1 < cards.length ? t("nextQ") : t("lessonComplete")}</button>}
      </div>

      <LabValuesModal isOpen={showLabModal} onClose={() => setShowLabModal(false)} lang={lang} />
    </div>
  );
}

/* Bookmark the current card for later review (uses the notes/highlight store). */
function SaveCardButton({ cardId }) {
  const { t } = useApp();
  const [saved, setSaved] = useState(false);
  useEffect(() => { let ok = true; api.get(`/learn/library/save/${cardId}`).then((d) => ok && setSaved(!!d.saved)).catch(() => {}); return () => { ok = false; }; }, [cardId]);
  const toggle = async () => { try { const r = await api.post(`/learn/library/save/${cardId}`, {}); setSaved(!!r.saved); } catch { /* */ } };
  return (
    <button type="button" className={`btn btn-sm ${saved ? "btn-accent" : "btn-ghost"}`} onClick={toggle} title={t("saveForLater")} style={{ padding: "3px 10px" }}>
      <Icon name="star" size={13} /> {saved ? t("savedCard") : t("saveForLater")}
    </button>
  );
}

export function typeLabel(type, lang) {
  const M = {
    mcq: ["چهارگزینه‌ای", "Multiple choice"], truefalse: ["درست/غلط", "True/False"],
    fill: ["جای خالی", "Fill blank"], match: ["تطبیق جفت‌ها", "Match pairs"], order: ["مرتب‌سازی", "Order"],
    compare: ["تمایز بالینی", "Compare & contrast"],
  };
  return (M[type] || M.mcq)[lang === "fa" ? 0 : 1];
}

/* Resource bar — competitive: reference UNLIMITED deep-link (code+chapter+page), mindmap 5/day */
function LessonResourceBar({ card, premium, lang }) {
  const fa = lang === "fa";
  const [mindmaps, setMindmaps] = useState([]);
  const [used, setUsed] = useState(() => {
    try {
      const d = new Date().toISOString().slice(0, 10);
      const k = `med_mindmap_daily_${d}`;
      const v = JSON.parse(localStorage.getItem(k) || "0");
      return Number(v) || 0;
    } catch { return 0; }
  });
  const limit = premium ? Infinity : 5;
  const remaining = Math.max(0, limit - used);
  // pick per-question citation: bilingual, deep-link (code + chapter + page)
  const pickRef = () => {
    const m = card?.micro;
    if (!m) return null;
    // new shape: references array + reference_fa/en + reference (primary)
    let r = null;
    if (lang === "fa") r = m.reference_fa || m.reference || (Array.isArray(m.references) && m.references[0]) || null;
    else r = m.reference_en || m.reference || (Array.isArray(m.references) && (m.references[1] || m.references[0])) || null;
    if (!r || !r.code) {
      // fallback to legacy source string — try to extract code from micro.source if it looks like a code
      const src = m.source || card?.source || "";
      if (src && src.length < 40 && /^[a-z0-9-]+$/i.test(src.replace(/\s/g,""))) return { code: src.trim(), page: "", chapter_fa: "", chapter_en: "" };
      return r;
    }
    return r;
  };
  const ref = pickRef();
  const refCode = ref?.code || "";
  const refPage = ref?.page || "";
  const refChapter = fa ? (ref?.chapter_fa || ref?.chapter_en || "") : (ref?.chapter_en || ref?.chapter_fa || "");
  const refLabel = [ref?.short_fa || ref?.short_en || refCode, refChapter ? `${fa?"فصل":"Ch."} ${refChapter}` : null, refPage ? `${fa?"ص":"p."} ${refPage}` : null].filter(Boolean).join(" • ");

  useEffect(() => {
    if (!card?.id) return;
    api.get(`/learn/questions/${card.id}/mindmaps`).then((d) => setMindmaps(d.mindmaps || [])).catch(() => setMindmaps([]));
  }, [card?.id]);

  const openReference = () => {
    if (refCode) {
      const qs = new URLSearchParams();
      if (refPage) qs.set("page", refPage);
      if (refChapter) qs.set("chapter", refChapter);
      const q = qs.toString() ? `?${qs.toString()}` : "";
      const path = `/learn/reference/${encodeURIComponent(refCode)}${q}`;
      try { window.history.pushState({}, "", path); } catch {}
      try { window.dispatchEvent(new CustomEvent("medlab-go", { detail: `reference:${refCode}:${refPage}` })); } catch {}
      return;
    }
    // no per-question citation — fall back to library
    try { window.dispatchEvent(new CustomEvent("medlab-go", { detail: "library" })); } catch {}
  };

  const openMindmap = (slug) => {
    if (!premium && used >= limit) {
      window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }));
      return;
    }
    if (!premium) {
      try {
        const d = new Date().toISOString().slice(0, 10);
        const k = `med_mindmap_daily_${d}`;
        const next = used + 1;
        localStorage.setItem(k, String(next));
        setUsed(next);
      } catch {}
    }
    const target = slug || mindmaps[0]?.slug;
    if (target) {
      try { sessionStorage.setItem("openMindmap", target); } catch {}
      try { window.dispatchEvent(new CustomEvent("medlab-go", { detail: "mindmap" })); } catch {}
      // also keep hash detail for deep-link fallback
      try { window.dispatchEvent(new CustomEvent("medlab-go", { detail: `mindmap:${target}` })); } catch {}
    } else {
      try { window.dispatchEvent(new CustomEvent("medlab-go", { detail: "mindmap" })); } catch {}
    }
  };

  return (
    <div className="lesson-resource-bar">
      <button type="button" className="lesson-res-btn lesson-res-ref" onClick={openReference} title={refLabel || (fa ? "مرجع نامحدود — همیشه باز" : "Unlimited reference — always open")}>
        <span className="lesson-res-ico" style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}><Icon name="book" size={14} /></span>
        <span className="lesson-res-label" style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", lineHeight:1.25 }}>
          <span>{fa ? "مشاهده در رفرنس" : "View in reference"}</span>
          {refLabel && <span className="small" style={{ fontSize:".68rem", opacity:.85, fontWeight:600 }}>{refLabel}</span>}
        </span>
        <span className="lesson-res-badge unlimited" style={{ marginInlineStart:"auto" }}>{refCode ? (refPage ? `${fa?"ص":"p."} ${refPage} →` : `${fa?"رفرنس":"ref"} →`) : (fa ? "نامحدود" : "unlimited")} ✓</span>
      </button>
      <button type="button" className={`lesson-res-btn lesson-res-map ${!premium && used >= limit ? "locked" : ""}`} onClick={() => openMindmap()} title={!premium && used >= limit ? (fa ? "سهم روزانه تمام شد — ارتقا به پلاس" : "Daily limit reached — upgrade") : (fa ? `نقشه ذهنی — ${remaining} باقی‌مانده امروز` : `Mindmap — ${remaining} left today`)}>
        <span className="lesson-res-ico" style={{ background: premium || used < limit ? "linear-gradient(135deg,#10b981,#06b6d4)" : "linear-gradient(135deg,#9ca3af,#6b7280)" }}><Icon name={(!premium && used >= limit) ? "lock" : "brain"} size={14} /></span>
        <span className="lesson-res-label">{fa ? "نقشه ذهنی" : "Mindmap"}</span>
        {premium ? (
          <span className="lesson-res-badge unlimited">{fa ? "نامحدود" : "unlimited"} ✓</span>
        ) : (
          <span className={`lesson-res-badge ${remaining <= 1 ? "danger" : remaining <= 3 ? "warn" : ""}`}>{remaining}/{limit} {fa ? "امروز" : "today"}</span>
        )}
      </button>
      {mindmaps.length > 0 && (
        <span className="small muted" style={{ alignSelf: "center", fontSize: ".72rem", display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
          {mindmaps.slice(0,1).map(mm=> (
            <button key={mm.slug} type="button" className="chip" style={{ border:"1px solid #bbf7d0", background:"#f0fdf4", padding:"2px 7px", borderRadius:999, fontSize:".70rem" }} onClick={()=>openMindmap(mm.slug)} title={mm.title}>{mm.title?.slice(0,18)}{mm.title?.length>18?"…":""} →</button>
          ))}
          {mindmaps.length>1 && <span>+{mindmaps.length-1}</span>}
        </span>
      )}
    </div>
  );
}

function OutOfHearts({ onProfile, onBack }) {
  const { t, lang } = useApp();
  const [busy, setBusy] = useState(false);
  const [showAd, setShowAd] = useState(false);
  // Live refill settings (admin-tunable): minutes per heart, gem cost, countdown.
  const [hp, setHp] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get(`/learn/profile?lang=${lang}`).then((r) => { if (alive) setHp(r.profile); }).catch(() => {});
    return () => { alive = false; };
  }, [lang]);
  const mins = hp?.heart_refill_minutes || 30;
  const cost = hp?.heart_refill_gems ?? 50;
  const nextS = hp?.next_heart_in_s || 0;
  const nextTxt = nextS > 0 ? `${Math.floor(nextS / 60)}:${String(nextS % 60).padStart(2, "0")}` : "";
  const waitTxt = lang === "fa" ? `هر ${mins} دقیقه یک قلب پر می‌شود${nextTxt ? ` — قلب بعدی تا ${nextTxt}` : ""}` : `One heart refills every ${mins} minutes${nextTxt ? ` — next in ${nextTxt}` : ""}`;
  const refill = async () => {
    setBusy(true);
    try { const { profile } = await api.post("/learn/hearts/refill"); onProfile?.(profile); onBack(); }
    catch { setBusy(false); }
  };
  return (
    <div className="card empty-state">
      <div className="ico" style={{ fontSize: 48, lineHeight: 1 }}><HeartIcon size={48} /></div>
      <h3>{t("outOfHearts")}</h3>
      <div className="muted small mt8">{t("outOfHeartsDesc")}</div>
      <div className="muted small mt8">{waitTxt}</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-accent" disabled={busy} onClick={refill}><GemIcon size={16} /> {t("refillHearts")} ({cost})</button>
        <button type="button" className="btn btn-ghost" onClick={() => setShowAd(true)}>🎁 {t("rewardedWatch")}</button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>{t("back")}</button>
      </div>
      {showAd && <RewardedAd format="rewarded" onClose={() => setShowAd(false)} onReward={(p) => onProfile?.(p)} />}
    </div>
  );
}

function Celebrate({ result, betweenAd, onDone, onReplay, onContinueLesson }) {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const perfect = result.stars >= 5;
  const s = result.streak || {};             // { incremented, usedFreeze, milestone }
  const milestone = s.milestone;
  const tierUp = result.tierUp;              // { from, to } on a tier promotion
  const achievement = result.unlocked?.length > 0;
  const tierLabel = result.tierLabel || {};
  const [mascots, setMascots] = useState(currentMascots());
  useEffect(() => { loadMascots().then(setMascots).catch(() => {}); }, []);

  // Play the single most impactful celebration sound for this result on mount.
  // Priority: tier promotion > streak milestone > achievement > perfect > done.
  useEffect(() => {
    const kind = tierUp ? "levelup"
      : milestone ? "streak"
      : achievement ? "achievement"
      : perfect ? "fanfare"
      : "complete";
    celebrate(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lesson-wrap">
      {(perfect || milestone || tierUp || achievement) && <Confetti />}

      {/* Tier promotion — the biggest "level up" moment, shown first */}
      {tierUp && (
        <div className="tierup-celebrate card">
          <div className="tierup-badge">🏆</div>
          <div className="tierup-title">{t("rankUp") || "ارتقای رتبه!"}</div>
          <div className="tierup-tiers">
            <span className="tierup-from">{tierLabel[tierUp.from]?.fa || tierUp.from}</span>
            <span className="tierup-arrow">→</span>
            <span className="tierup-to">{tierLabel[tierUp.to]?.fa || tierUp.to}</span>
          </div>
        </div>
      )}

      {/* Streak update — built into the lesson flow (Duolingo-style) */}
      {s.incremented && (
        <div className="streak-celebrate card">
          <div className={`streak-flame ${s.usedFreeze ? "frozen" : ""}`}>{s.usedFreeze ? "🧊" : <StreakIcon size={40} />}</div>
          <div className="streak-count">{result.profile.streak}</div>
          <div className="small muted">{t("dayStreak")}</div>
          {s.usedFreeze && <div className="small" style={{ color: "var(--sky)", marginTop: 4 }}>❄️ {t("freezeUsedNote")}</div>}
          {milestone && (
            <div className="streak-society-chest">
              <div className="ssc-emoji">🎁</div>
              <div style={{ fontWeight: 800 }}>{t("streakSociety")} · {milestone.days} {t("dayStreak")}</div>
              <div className="small">+{milestone.gems} <GemIcon size={13} /> · +{milestone.freezes} <Icon name="ampoule" size={13} /></div>
            </div>
          )}
          {result.premiumTrial && (
            <div className="streak-society-chest premium-trial-chest">
              <div className="ssc-emoji">👑</div>
              <div style={{ fontWeight: 800 }}>{lang === "fa" ? `${result.premiumTrial.days} روز پرمیوم هدیه!` : `${result.premiumTrial.days} free premium days!`}</div>
              <div className="small">{lang === "fa" ? `به‌خاطر استریک ${result.premiumTrial.milestone} روزه — همهٔ امکانات پرمیوم فعال شد.` : `For your ${result.premiumTrial.milestone}-day streak — every premium feature is on.`}</div>
            </div>
          )}
        </div>
      )}

      <div className="celebrate card">
        {mascots.enabled && mascots.dr.enabled && (
          <div className="celebrate-mascot"><DrMed size={104} mood={perfect ? "celebrate" : "cheer"} src={mascots.dr.img} speed={mascots.speed} /></div>
        )}
        <h2 style={{ border: "none" }}>{t("lessonComplete")}</h2>
        <div className="big">+<StatNum value={result.xp} duration={1100} /> {t("xp")}</div>
        <RewardStars earned={result.stars} total={5} />
        <div className="reward-chips">
          <div className="reward-chip"><div className="rv" style={{ color: "var(--xp)" }}>+<StatNum value={result.xp} duration={1100} delay={200} /></div><div className="small muted">{t("xp")}</div></div>
          {perfect && <div className="reward-chip"><div className="rv"><XpIcon size={22} /></div><div className="small muted">{t("perfectBonus")}</div></div>}
          <div className="reward-chip"><div className="rv" style={{ color: "var(--flame)" }}><StatNum value={result.profile.streak} duration={900} delay={400} /></div><div className="small muted">{t("streak")}</div></div>
        </div>
        {result.unlocked?.length > 0 && (
          <div className="card" style={{ background: "var(--panel2)", marginTop: 8 }}>
            <div style={{ fontWeight: 800, color: "var(--gold)" }}><Icon name="medal" size={16} /> {t("achievementUnlocked")}</div>
            {result.unlocked.map((a) => <div key={a.slug} className="small mt8">{a.name_fa || a.name_en}</div>)}
          </div>
        )}
      </div>
      <LessonSummaryBox summary={result.summary} fa={fa} />
      <LessonInsights report={result.errorReport} srsAdded={result.srsAdded} confidence={result.confidence} newMastery={result.newMastery} />
      {!perfect && (
        <div className="card mt16" style={{ display: "flex", alignItems: "center", gap: 12, borderInlineStart: "4px solid var(--xp)" }}>
          <span className="node-emoji">🎯</span>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800 }}>{t("replayLesson")}</div></div>
          <button type="button" className="btn btn-accent btn-sm" onClick={onReplay}><Icon name="repeat" size={14} /> {t("tryAgain")}</button>
        </div>
      )}
      {/* motion-graphic between-lessons — admin ad in gold shell, or premium upsell for non-premium */}
      {betweenAd ? (
        <div className="mt16"><MotionAd ad={betweenAd} variant="between" /></div>
      ) : (
        !result.profile?.premium && !result.profile?.premium_effective && (
          <div className="mt16"><PremiumCard /></div>
        )
      )}
      <button type="button" className="btn btn-primary btn-block mt16" onClick={() => {
        if (result.nextNode?.id && onContinueLesson) onContinueLesson(result.nextNode.id);
        else onDone();
      }}><Icon name="check" size={18} /> {result.nextNode?.id ? (fa ? "درس بعدی" : "Next lesson") : t("continueLearning")}</button>
    </div>
  );
}

/* Lesson summary: one bullet per card in lesson order (see ResolvedBullets). */
function LessonSummaryBox({ summary, fa }) {
  const { bullets, loading } = useSummaryBullets(summary, true);
  if (!bullets.length && !loading) return null;
  return (
    <div className="chapter-summary card">
      <div className="cs-title">📌 {fa ? "خلاصهٔ این درس" : "This lesson in brief"}</div>
      <ul className="cs-list">
        {bullets.map((b, i) => <li key={i}><Emphasis text={b} /></li>)}
      </ul>
      {loading && <div className="small muted">{fa ? "⏳ ترجمهٔ بخشی از خلاصه در حال انجام است…" : "⏳ Translating part of the summary…"}</div>}
    </div>
  );
}
