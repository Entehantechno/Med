import { useEffect, useMemo, useState, useRef } from "react";
import { markBusy } from "../lib/sw-update.js";
import { useApp } from "../context.jsx";
import { api, loadFailKind, loadFailText, getToken } from "../api.js";
import { TopBar, Spinner } from "../components/UI.jsx";
import { biField } from "../lib/bifield.js";
import { facetCounts, normalizeSearch, sortBy } from "../lib/catalog-filter.js";
import SearchAnswer from "../components/SearchAnswer.jsx";
import Leaderboard from "../components/Leaderboard.jsx";
import { useAntiCheat } from "../utils/antiCheat.js";
import Icon from "../components/Icon.jsx";
import ExamOtherType from "../components/ExamOtherType.jsx";
import HotspotPlayer from "../components/HotspotPlayer.jsx";
import { remainingFromServer, isResumedSession } from "../lib/resume-state.js";

function shuffleArray(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function flashChrome(embedded, home, inner) {
  if (embedded) return inner;
  return <div className="app"><TopBar onHome={home} />{inner}</div>;
}

export default function Flashcards({ home, examId, flashcardIds, examDuration, shuffle, antiCheat, competition, classId, classFlashcardId, classCombined = false, showCorrect: examShowCorrect, showHints: examShowHints, noPenalty: noPenaltyProp, allowBack: allowBackProp, allowChange: allowChangeProp, embedded = false, topic = null, onOpenCases, onClearTopic }) {
  // Tell sw-update.js that in-progress work is on screen: a new build must
  // not auto-reload the page until this screen unmounts.
  useEffect(() => { markBusy(true); return () => markBusy(false); }, []);
  const { t, lang, user } = useApp();
  const [allCards, setAllCards] = useState(null);
  // R97: true while a learner deck's full card bodies are being fetched after the picker.
  const [deckBusy, setDeckBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [bootNonce, setBootNonce] = useState(0);
  const [gradeErr, setGradeErr] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const combinedConfig=useRef(null), combinedPayload=useRef(null), combinedSaving=useRef(false);
  const [savingCombined,setSavingCombined]=useState(false);
  const submissionId=useRef(null);
  if(!submissionId.current)submissionId.current=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  async function retryCombined() {
    if(combinedSaving.current||!combinedPayload.current)return;
    combinedSaving.current=true;setSavingCombined(true);setSaveErr('');
    try {
      const r=await api.post(`/classes/${classId}/flashcards/finish`,combinedPayload.current);
      setServerScore(r.score);setNoPenaltyCfg(!!r.noPenalty);
    } catch(e) {setSaveErr(e?.data?.error==='class_questions_changed'?'changed':loadFailKind(e));}
    finally {combinedSaving.current=false;setSavingCombined(false);}
  }
  const [cards, setCards] = useState(null); // filtered deck being practiced
  const [settings, setSettings] = useState({ showHints: true, showCorrect: true });
  const [idx, setIdx] = useState(0);
  // Per-card state (R60): every card keeps its own answer, so a student can go
  // back to it. Only the current card is interactive.
  const [cardStates, setCardStates] = useState([]);
  const [reachedIdx, setReachedIdx] = useState(0);   // furthest card ever shown (revisits are below it)
  // Navigation flags set by the teacher (class / exam) or admin (defaults): may the
  // student go back to earlier cards, and may they change a confirmed answer.
  const [navCfg, setNavCfg] = useState({ back: !!allowBackProp, change: !!allowChangeProp });
  const [results, setResults] = useState([]);
  const [totalHints, setTotalHints] = useState(0);
  const [finished, setFinished] = useState(false);
  const [zoomSrc, setZoomSrc] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null); // seconds (exam mode only)
  /* No-penalty mode: hints and wrong stage attempts do not reduce the score.
     Set by the class / scheduled exam (falls back to an explicit prop from
     the parent that loaded the class or exam payload). */
  const [noPenaltyCfg, setNoPenaltyCfg] = useState(false);
  // The server-regraded score (gradebook truth) — shown on the summary when it
  // differs from the local display total (e.g. strict hint penalties).
  const [serverScore, setServerScore] = useState(null);
  const startRef = useRef(Date.now());
  const finishRef = useRef(null);
  const hotspotLock = useRef(false);
  const gradeBusy = useRef(false);

  function newState() {
    return { hintsShown: 0, tried: [], solved: false, revealed: false, fb: null, hotspotClicks: [], overlayHotspot: null, correctIndex: null, startedAt: Date.now(),
      picked: null, editing: false, changes: 0, snapshot: null };
  }

  const inExam = !!examId || !!classId;   // class flashcard sets behave like a fixed deck
  // Card state accessors. A card is LOCKED once confirmed, unless it is being
  // edited ("change answer"). Handlers act on the current card only.
  const stateOf = (j) => cardStates[j] || newState();
  const state = stateOf(idx);
  const setStateAt = (j, upd) => setCardStates((arr) => {
    const n = arr.slice();
    const cur = n[j] || newState();
    n[j] = typeof upd === "function" ? upd(cur) : { ...cur, ...upd };
    return n;
  });
  const setState = (upd) => setStateAt(idx, upd);
  const locked = (state.solved || state.revealed) && !state.editing;
  // Class config fetch for nav flags when the route did not pass them.
  useEffect(() => {
    if (!classId || !classFlashcardId || (allowBackProp != null && allowChangeProp != null)) return;
    api.get(`/classes/${classId}/flashcard/${classFlashcardId}/config`, { timeoutMs: 15000, stage: "boot" })
      .then((d) => setNavCfg({ back: !!d?.allowBack, change: !!d?.allowChange }))
      .catch(() => {});
  }, [classId, classFlashcardId]);
  const { leaves } = useAntiCheat(inExam && antiCheat);
  /* Resolve no-penalty: an explicit route prop wins (loaded by the caller with
     the class/exam payload); class decks can also ask the server directly. */
  useEffect(() => {
    if (noPenaltyProp !== undefined && noPenaltyProp !== null) { setNoPenaltyCfg(!!noPenaltyProp); return; }
    if (classId && classFlashcardId) {
      api.get(`/classes/${classId}/flashcard/${classFlashcardId}/config`, { timeoutMs: 15000, stage: "boot" })
        .then((d) => setNoPenaltyCfg(!!d?.noPenalty))
        .catch(() => setNoPenaltyCfg(false));
    }
  }, [classId, classFlashcardId, noPenaltyProp]);

  useEffect(() => {
    (async () => {
      setLoadErr("");
      try {
        const skipUniExamSettings = user?.role === "learner";
        // R97: a learner's free-practice picker needs only id/topic/labels; bodies come per deck.
        const learnerSummary = !inExam && skipUniExamSettings;
        let requestedIds=flashcardIds;
        if(classCombined&&classId){
          const cfg=await api.get(`/classes/${classId}/flashcards/config`,{timeoutMs:15000,stage:'boot'});
          combinedConfig.current=cfg;requestedIds=cfg.ids;setNoPenaltyCfg(!!cfg.noPenalty);setNavCfg({back:!!cfg.allowBack,change:!!cfg.allowChange});
        }
        const examIds = Array.isArray(requestedIds) ? requestedIds.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
        const flashPath = inExam
          ? (examIds.length ? `/flashcards?ids=${examIds.slice(0, 400).join(",")}` : "/flashcards?ids=")
          : learnerSummary ? "/flashcards?summary=1" : "/flashcards";
        const [c, s] = await Promise.all([
          api.get(flashPath, { timeoutMs: 20_000, stage: "boot" }),
          skipUniExamSettings
            ? Promise.resolve({ showHints: true, showCorrect: true })
            : api.get("/settings/exam", { timeoutMs: 20_000, stage: "boot" }),
        ]);
        const list = Array.isArray(c) ? (learnerSummary ? c.map((card) => ({ ...card, _summary: true })) : c) : [];
        let filtered = list;
        if (inExam) {
          filtered = examIds.length ? list.filter((card) => examIds.includes(card.id)) : [];
        }
        if(classCombined && filtered.length!==examIds.length)throw new Error('class_questions_changed');
        // R64: an exam or class run resumes its saved progress. The server holds the clock and the card order.
        const runKey = inExam ? flashRunKey() : null;
        const run = runKey ? await openFlashRun(runKey) : null;
        const byId = new Map(filtered.map((card) => [card.id, card]));
        const savedOrder = isResumedSession(run) && Array.isArray(run.progress?.order)
          ? run.progress.order.map((id) => byId.get(id)).filter(Boolean) : null;
        const resumeOk = !!savedOrder && savedOrder.length === filtered.length;
        if (resumeOk) filtered = savedOrder;
        else if (inExam && shuffle) filtered = shuffleArray(filtered);
        let next = s && typeof s === "object"
          ? { showHints: s.showHints !== false, showCorrect: s.showCorrect !== false }
          : { showHints: true, showCorrect: true };
        if (examId) {
          if (examShowCorrect != null) next.showCorrect = !!examShowCorrect;
          if (examShowHints != null) next.showHints = !!examShowHints;
        }
        setAllCards(filtered); setSettings(next);
        if (inExam) {
          setCards(filtered); setCardStates(filtered.map(() => newState())); startRef.current = Date.now();
          runRef.current = run?.runId ?? null;
          if (resumeOk) applyRun(run.progress);
          if (run) setTimeLeft(remainingFromServer(run, null));
          else if (examDuration) setTimeLeft(examDuration * 60);
          if (resumeOk) setRunResumed(true);
        }
      } catch (e) {
        setLoadErr(loadFailKind(e));
        setAllCards([]);
      }
    })();
  }, [bootNonce]);

  // R64: the run this screen is playing (server row). Null for free practice and when unavailable.
  const runRef = useRef(null);
  const [runResumed, setRunResumed] = useState(false);
  const flashRunKey = () => {
    if (examId) return `exam:${examId}`;
    if (classCombined && classId) return `classcomb:${classId}`;
    if (classId && classFlashcardId) return `classfc:${classId}:${classFlashcardId}`;
    return null;
  };
  const openFlashRun = async (contextKey) => {
    try { return await api.post("/exam/flash-session", { contextKey }, { timeoutMs: 15000, stage: "boot" }); }
    catch { return null; }   // not a student, or the server is unreachable: play without saving
  };
  const applyRun = (p) => {
    if (typeof p.idx === "number") setIdx(p.idx);
    if (typeof p.reachedIdx === "number") setReachedIdx(p.reachedIdx);
    if (Array.isArray(p.cardStates)) setCardStates(p.cardStates);
    if (Array.isArray(p.results)) setResults(p.results);
    if (typeof p.totalHints === "number") setTotalHints(p.totalHints);
    if (typeof p.submissionId === "string" && p.submissionId) submissionId.current = p.submissionId;
  };
  const runBody = () => {
    const progress = {
      idx, reachedIdx, order: cards ? cards.map((c) => c.id) : [], cardStates, results, totalHints,
      submissionId: submissionId.current, version: combinedConfig.current?.version || null,
      answers: cards ? buildAnswers(resultsNow()) : [],
    };
    return { runId: runRef.current, progress };
  };
  // The leave-page save runs from an effect with no dependencies, so it reads the latest body through a ref.
  const runBodyRef = useRef(null);
  runBodyRef.current = runBody;
  const saveRun = async (timeoutMs = 15000) => {
    if (!runRef.current || !cards || finished) return;
    try { await api.put("/exam/flash-progress", runBody(), { timeoutMs, stage: "flashcards" }); }
    catch { /* the next change or the leave-page save retries */ }
  };
  // Autosave after each change (debounced). Stops once the run is finished.
  useEffect(() => {
    if (!runRef.current || !cards || finished) return;
    const id = setTimeout(() => { saveRun(); }, 1200);
    return () => clearTimeout(id);
  }, [idx, cardStates, results, totalHints, finished, cards]);
  // Leaving the screen saves once more (keepalive; large bodies are covered by the debounced save).
  useEffect(() => {
    const leave = () => {
      if (!runRef.current || finishRef.current == null || !runBodyRef.current) return;
      const body = JSON.stringify(runBodyRef.current());
      if (body.length > 60_000) return;
      try {
        fetch("/api/exam/flash-progress", {
          method: "PUT", keepalive: true, credentials: "same-origin",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }, body,
        }).catch(() => {});
      } catch { /* best-effort */ }
    };
    const onHide = () => { if (document.visibilityState === "hidden") leave(); };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onHide);
      leave();
    };
  }, []);
  // The server closed the run (time ran out while away): submit the stored answers now.
  useEffect(() => {
    const onExpired = () => setTimeLeft((x) => (x == null ? x : 0));
    window.addEventListener("medlab-session-expired", onExpired);
    return () => window.removeEventListener("medlab-session-expired", onExpired);
  }, []);

  // countdown timer (exam mode). At zero, save what was answered, then finish.
  useEffect(() => {
    if (timeLeft == null || finished) return;
    if (timeLeft <= 0) {
      saveRun(5000).finally(() => { finishRef.current && finishRef.current(); });
      return;
    }
    const id = setTimeout(() => setTimeLeft((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, finished]);

  const startDeck = async (deck) => {
    let playable = deck;
    if (deck.some((c) => c && c._summary)) {
      setDeckBusy(true);
      try {
        playable = await loadCardBodies(deck.map((c) => c.id));
      } catch (e) {
        setDeckBusy(false);
        setLoadErr(loadFailKind(e));
        return;
      }
      setDeckBusy(false);
    }
    setCards(playable); setIdx(0); setCardStates(deck.map(() => newState())); setReachedIdx(0); setResults([]); setTotalHints(0);
    setFinished(false); startRef.current = Date.now(); hotspotLock.current = false;
  };

  if (loadErr) {
    return flashChrome(embedded, home, (
        <div className="container">
          <div className="card empty-state">
            <div className="ico"><Icon name="warn" size={30} /></div>
            <h3>{lang === "fa" ? "«بارگذاری فلش‌کارت» قطع شد" : "[Loading flashcards] failed"}</h3>
            <div className="muted small mt8">{loadFailText(loadErr, lang)}</div>
            <button type="button" className="btn btn-primary mt16" onClick={() => { setAllCards(null); setLoadErr(""); setBootNonce((n) => n + 1); }}>
              {lang === "fa" ? "تلاش دوباره" : "Try again"}
            </button>
          </div>
        </div>
    ));
  }
  if (!allCards) return flashChrome(embedded, home, <Spinner />);

  // Empty exam/class deck: do not render cards[0] (crash) or auto-submit a 100.
  if (inExam && Array.isArray(allCards) && allCards.length === 0) {
    return flashChrome(embedded, home, (
        <div className="container">
          <div className="card empty-state">
            <div className="ico"><Icon name="warn" size={30} /></div>
            <h3>{lang === "fa" ? "«آزمون فلش‌کارت» — کارتی در این آزمون نیست" : "[Flashcard exam] — no cards in this exam"}</h3>
            <div className="muted small mt8">{lang === "fa"
              ? "فهرست کارت‌های این آزمون خالی است. به استاد بگویید."
              : "This exam has an empty flashcard list. Tell your instructor."}</div>
            <button type="button" className="btn btn-ghost mt16" onClick={home}>{lang === "fa" ? "بازگشت" : "Back"}</button>
          </div>
        </div>
    ));
  }

  // Deck picker only for FREE practice. In an exam, it auto-starts (no preview of answers).
  if (!cards) {
    if (inExam || deckBusy) return flashChrome(embedded, home, <Spinner />);
    return <DeckPicker allCards={allCards} onStart={startDeck} home={home} embedded={embedded} topic={topic} onOpenCases={onOpenCases} onClearTopic={onClearTopic} />;
  }

  if (finished) return <Summary cards={cards} results={results} totalHints={totalHints} home={home}
    examId={examId} classId={classId} onRetry={classCombined?retryCombined:null} saving={savingCombined} competition={competition} meUserId={user?.id} saveErr={saveErr} embedded={embedded}
    noPenalty={noPenaltyCfg} serverScore={serverScore}
    onRestart={() => startDeck(cards)} onPick={() => setCards(null)} />;

  const card = cards[idx];
  if (!card) {
    return flashChrome(embedded, home, (
        <div className="container">
          <div className="card empty-state">
            <div className="ico"><Icon name="warn" size={30} /></div>
            <h3>{lang === "fa" ? "«آزمون فلش‌کارت» — کارتی برای نمایش نیست" : "[Flashcard exam] — no card to show"}</h3>
            <button type="button" className="btn btn-ghost mt16" onClick={home}>{lang === "fa" ? "بازگشت" : "Back"}</button>
          </div>
        </div>
    ));
  }
  const hints = lang === "fa" ? (card.hints_fa || []) : (card.hints_en || []);
  const hintImages = lang === "fa" ? (card.hint_images_fa || []) : (card.hint_images_en || []);
  const hintText = (h) => (h && typeof h === "object") ? (h.text || h.label || "") : String(h || "");
  const hintImage = (h, i) => (h && typeof h === "object" && h.imageUrl) ? h.imageUrl : (hintImages[i] || "");

  const hotspotClick = async (pt) => {
    if (locked || hotspotLock.current) return;
    hotspotLock.current = true;
    setGradeErr("");
    const moreHints = settings.showHints && state.hintsShown < hints.length;
    try {
      const r = await api.post("/flashcards/check", {
        cardId: card.id, type: "hotspot", x: pt.x, y: pt.y, reveal: !moreHints && settings.showCorrect,
      }, { timeoutMs: 15000, stage: "evaluate" });
      const clicks = [...(state.hotspotClicks || []), { x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10, ok: !!r.ok }];
      const overlayHotspot = r.reveal?.hotspot || null;
      if (r.ok) {
        const pts = noPenaltyCfg ? cardMax : Math.max(0, cardMax - state.hintsShown * hintPenaltyUnit);
        setState((s) => ({ ...s, editing: false, snapshot: null, picked: null, solved: true, fb: "ok", hotspotClicks: clicks, overlayHotspot: overlayHotspot || s.overlayHotspot }));
        setResults((rr) => { const n = [...rr]; n[idx] = { solved: true, points: pts, hintsUsed: state.hintsShown, hintLevel: state.hintsShown, responseMs: Math.max(0, Date.now() - (state.startedAt || startRef.current)), hotspotClicks: clicks }; return n; });
      } else if (moreHints) {
        setTotalHints((h) => h + 1);
        setState((s) => ({ ...s, editing: false, snapshot: null, picked: null, fb: "bad", hintsShown: s.hintsShown + 1, hotspotClicks: clicks, overlayHotspot: overlayHotspot || s.overlayHotspot }));
        hotspotLock.current = false;
      } else {
        setState((s) => ({ ...s, editing: false, snapshot: null, picked: null, revealed: true, fb: "bad", hotspotClicks: clicks, overlayHotspot: overlayHotspot || s.overlayHotspot }));
        setResults((rr) => { const n = [...rr]; n[idx] = { solved: false, points: 0, hintsUsed: state.hintsShown, hintLevel: state.hintsShown, responseMs: Math.max(0, Date.now() - (state.startedAt || startRef.current)), hotspotClicks: clicks }; return n; });
      }
    } catch (e) {
      setGradeErr(String(e.message || e));
      hotspotLock.current = false;
    }
  };

  // Per-card max points: the 100-point total is split equally between the cards.
  const cardMax = cards.length ? 100 / cards.length : 0;
  // Fraction of the card's points lost per hint used: 1 / (totalHints + 1).
  const hintPenaltyUnit = cardMax / ((hints.length || 0) + 1);

  // Selecting an option never grades it (R60): the student confirms first.
  const pick = (optIdx) => {
    if (locked || gradeBusy.current || state.tried.includes(optIdx)) return;
    setState((s) => ({ ...s, picked: optIdx }));
  };
  const confirmChoice = async () => {
    const optIdx = state.picked;
    if (locked || optIdx == null || state.tried.includes(optIdx) || gradeBusy.current) return;
    const opt = (card.options || [])[optIdx];
    if (!opt) return;
    gradeBusy.current = true;
    setGradeErr("");
    const moreHints = settings.showHints && state.hintsShown < hints.length;
    try {
      const r = await api.post("/flashcards/check", {
        cardId: card.id, optionIndex: optIdx, type: "mcq", reveal: !moreHints && settings.showCorrect,
      }, { timeoutMs: 15000, stage: "evaluate" });
      if (r.ok) {
        const pts = noPenaltyCfg ? cardMax : Math.max(0, cardMax - state.hintsShown * hintPenaltyUnit);
        setState((s) => ({ ...s, editing: false, snapshot: null, picked: null, solved: true, fb: "ok", correctIndex: r.reveal?.index ?? optIdx }));
        setResults((rr) => { const n = [...rr]; n[idx] = { solved: true, points: pts, hintsUsed: state.hintsShown, hintLevel: state.hintsShown, responseMs: Math.max(0, Date.now() - (state.startedAt || startRef.current)), selectedIdx: optIdx, triedIdxs: [...state.tried, optIdx] }; return n; });
      } else {
        const tried = [...state.tried, optIdx];
        if (moreHints) {
          setTotalHints((h) => h + 1);
          setState((s) => ({ ...s, editing: false, snapshot: null, picked: null, tried, hintsShown: s.hintsShown + 1, fb: "bad" }));
        } else {
          setState((s) => ({ ...s, editing: false, snapshot: null, picked: null, tried, revealed: true, fb: null, correctIndex: r.reveal?.index ?? s.correctIndex }));
          setResults((rr) => { const n = [...rr]; n[idx] = { solved: false, points: 0, hintsUsed: state.hintsShown, hintLevel: state.hintsShown, responseMs: Math.max(0, Date.now() - (state.startedAt || startRef.current)), selectedIdx: optIdx, triedIdxs: tried }; return n; });
        }
      }
    } catch (e) {
      setGradeErr(String(e.message || e));
    } finally {
      gradeBusy.current = false;
    }
  };

  // Results so far, including the card on screen once it is answered. Shared by the final submit and the autosave.
  const resultsNow = () => {
    const finalResults = [...results];
    // ensure the current card's result is recorded
    if (state.solved && finalResults[idx] == null)
      finalResults[idx] = { solved: true, points: Math.max(0, cardMax - state.hintsShown * hintPenaltyUnit), hintsUsed: state.hintsShown, hintLevel: state.hintsShown, responseMs: Math.max(0, Date.now() - (state.startedAt || startRef.current)), triedIdxs: state.tried };
    else if (state.revealed && finalResults[idx] == null)
      finalResults[idx] = { solved: false, points: 0, hintsUsed: state.hintsShown, hintLevel: state.hintsShown, responseMs: Math.max(0, Date.now() - (state.startedAt || startRef.current)), triedIdxs: state.tried };
    return finalResults;
  };
  // One record per card. The final submit and the autosave both use it, so the server's
  // expiry settle grades exactly what the final submit would have sent.
  const buildAnswers = (finalResults) => cards.map((c, i) => {
      const r = finalResults[i] || { solved: false, points: 0, hintsUsed: 0, hintLevel: 0, responseMs: 0, triedIdxs: [] };
      const opts = c.options || [];
      const tried = Array.isArray(r.triedIdxs) ? r.triedIdxs : (r.selectedIdx != null ? [r.selectedIdx] : []);
      const correctOpt = opts.find((o) => o.correct) || null;
      const labels = (idxs) => idxs.map((j) => {
        const o = opts[j];
        return o ? { index: j, fa: o.fa || "", en: o.en || "" } : { index: j, fa: "", en: "" };
      });
      return {
        order: i + 1,
        card_id: c.id,
        type: c.type || "mcq",
        title_fa: c.title_fa || "", title_en: c.title_en || "",
        question_fa: c.questionText_fa || c.q_fa || c.title_fa || "",
        question_en: c.questionText_en || c.q_en || c.title_en || "",
        selected: labels(tried),
        selectedIdx: r.selectedIdx ?? (tried.length ? tried[tried.length - 1] : null),
        correct: correctOpt ? { fa: correctOpt.fa || "", en: correctOpt.en || "" } : null,
        solved: !!r.solved,
        answer: r.answer ?? null,
        answers: r.answers ?? null,
        pairs: r.pairs || r.answer?.pairs || null,
        orderIds: r.orderIds || (Array.isArray(r.answer) ? r.answer.map((x) => (x && typeof x === "object" ? x.id : x)) : null),
        assign: r.assign || null,
        kfResults: r.kfResults || [],
        lang,
        points: r.points || 0,
        proposedPoints: r.proposedPoints || 0,
        pendingApproval: !!r.pendingApproval,
        hintsUsed: r.hintsUsed || 0,
        hintLevel: r.hintLevel ?? r.hintsUsed ?? 0,
        responseMs: r.responseMs || 0,
        hotspotClicks: r.hotspotClicks || [],
        drawing: r.drawing || null,
        stepResults: r.stepResults || [],
        changes: cardStates[i]?.changes || 0,
      };
  });

  const submitResults = async () => {
    if (finished) return;
    const finalResults = resultsNow();
    const answerDetails = buildAnswers(finalResults);
    const solvedCount = finalResults.filter((r) => r && r.solved).length;
    const wrongCount = finalResults.filter((r) => r && !r.solved).length;
    // weighted total out of 100 (equal share per card, minus hint penalties)
    const score = Math.round(finalResults.reduce((sum, r) => sum + (r ? r.points : 0), 0));
    setFinished(true); setTimeLeft(null);
    try {
      if (classCombined && classId) {
        combinedPayload.current={submissionId:submissionId.current,version:combinedConfig.current?.version,
          durationSec:Math.round((Date.now()-startRef.current)/1000),answers:answerDetails};
        await retryCombined();
      } else if (classId && classFlashcardId) {
        // Class flashcard set → record the score against the class gradebook.
        // The server regrades from the answers (anti-cheat); its score is the
        // authoritative one (it also applies the no-penalty policy).
        const r = await api.post(`/classes/${classId}/flashcard/${classFlashcardId}/finish`, {
          score,
          durationSec: Math.round((Date.now() - startRef.current) / 1000),
          answers: answerDetails,
        });
        if (r && typeof r.score === "number") setServerScore(r.score);
        if (r && typeof r.noPenalty === "boolean") setNoPenaltyCfg(r.noPenalty);
      } else {
        const r = await api.post("/exam/flashcard-result", {
          score, hints: totalHints, lang, examId,
          total: cards.length, correct: solvedCount, wrong: wrongCount,
          durationSec: Math.round((Date.now() - startRef.current) / 1000),
          answers: answerDetails,
        });
        if (r && typeof r.score === "number") setServerScore(r.score);
      }
    } catch (e) {
      setSaveErr(loadFailKind(e));
    }
    setResults(finalResults);
  };
  finishRef.current = submitResults;

  const next = async () => {
    if (!locked) return;
    if (idx < cards.length - 1) { setIdx(idx + 1); setReachedIdx((r) => Math.max(r, idx + 1)); hotspotLock.current = false; gradeBusy.current = false; setGradeErr(""); return; }
    await submitResults();
  };
  const prev = () => {
    if (!navCfg.back || idx <= 0 || state.editing) return;
    setIdx(idx - 1); hotspotLock.current = false; gradeBusy.current = false; setGradeErr("");
  };
  // "Change answer": reopen a confirmed card. The previous grade is kept in
  // `snapshot` until a new confirm, so cancelling restores it exactly.
  const startEdit = () => {
    if (!navCfg.change || !locked) return;
    hotspotLock.current = false; gradeBusy.current = false; setGradeErr("");
    setState((s) => ({
      ...s, editing: true, changes: (s.changes || 0) + 1,
      snapshot: { solved: s.solved, revealed: s.revealed, fb: s.fb, correctIndex: s.correctIndex, tried: s.tried, picked: s.picked, hotspotClicks: s.hotspotClicks, overlayHotspot: s.overlayHotspot },
      solved: false, revealed: false, fb: null, tried: [], picked: null, hotspotClicks: [], overlayHotspot: null, correctIndex: null,
    }));
  };
  const cancelEdit = () => {
    if (!state.editing) return;
    const snap = state.snapshot || {};
    setState((s) => ({ ...snap, editing: false, snapshot: null, changes: Math.max(0, (s.changes || 0) - 1) }));
    hotspotLock.current = true;
    setGradeErr("");
  };
  const fmtT = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const done = locked;
  const lettersFa = ["الف", "ب", "ج", "د", "ه", "و"];
  const lettersEn = ["A", "B", "C", "D", "E", "F"];
  const letters = lang === "en" ? lettersEn : lettersFa;
  // Visited cards stay mounted (hidden) while back-navigation is on, so an
  // answered ExamOtherType keeps its drawing / matching / step state.
  const shownIdxs = navCfg.back ? Array.from({ length: Math.max(idx, reachedIdx) + 1 }, (_, j) => j) : [idx];

  const renderCard = (j) => {
    const c = cards[j];
    const isCur = j === idx;
    const st = stateOf(j);
    const dn = (st.solved || st.revealed) && !st.editing;
    const cHints = lang === "fa" ? (c.hints_fa || []) : (c.hints_en || []);
    const cHintImages = lang === "fa" ? (c.hint_images_fa || []) : (c.hint_images_en || []);
    const cHintText = (h) => (h && typeof h === "object") ? (h.text || h.label || "") : String(h || "");
    const cHintImage = (h, i) => (h && typeof h === "object" && h.imageUrl) ? h.imageUrl : (cHintImages[i] || "");
    const cIsHotspot = c.type === "hotspot";
    const cHotspot = c.hotspot || { x: 50, y: 50, r: 8 };
    const cMode = c.answerMode === "search" ? "search" : "choice";
    const cRowCount = Math.max(1, (cHints.length || 0) + 1);
    // Guess rows (Doctordle-style): wrong attempts first, then the winning pick.
    const cGuesses = [];
    for (const optIdx of st.tried) {
      const o = (c.options || [])[optIdx];
      if (o) cGuesses.push({ label: lang === "fa" ? o.fa : o.en, correct: false });
    }
    if (st.solved) {
      const opts = c.options || [];
      const win = opts.find((o) => o.correct) || opts[st.correctIndex] || opts[st.tried[st.tried.length - 1]];
      if (win) cGuesses.push({ label: lang === "fa" ? win.fa : win.en, correct: true });
    }
    const pickedOpt = st.picked != null ? (c.options || [])[st.picked] : null;
    const pickedLabel = pickedOpt ? (lang === "fa" ? pickedOpt.fa : pickedOpt.en) : "";
    const confirmBtn = isCur && !dn && st.picked != null && (
      <button type="button" className="btn btn-accent btn-block mt16" disabled={gradeBusy.current} onClick={confirmChoice}>{t("confirmAnswer")}</button>
    );
    return (
      <div className="ddle-card">
        {/* The learner sees the QUESTION, not the teacher-facing title. The
            title/category are an admin label for finding cards — never shown
            to students. Falls back to title only if a card has no question. */}
        <h2 className="ddle-title">{biField(c, "questionText", lang) || biField(c, "q", lang) || biField(c, "title", lang)}</h2>
        <div className="ddle-underline" />

        {/* Optional image in the question */}
        {c.imageUrl && !cIsHotspot && (
          <button type="button" className="ddle-img zoomable-img u-tap" title={lang === "fa" ? "برای بزرگ‌نمایی کلیک کنید" : "Click to zoom"} aria-label={lang === "fa" ? "بزرگ‌نمایی تصویر سؤال" : "Zoom the question image"} onClick={() => setZoomSrc(c.imageUrl)}>
            <img loading="lazy" decoding="async" src={c.imageUrl} alt="" />
            <span className="zoom-badge"><Icon name="search" size={14} /> {lang === "fa" ? "بزرگ‌نمایی" : "Zoom"}</span>
          </button>
        )}

        {/* HINTS at the top — each in its own light-blue box (as in the reference) */}
        {settings.showHints && Array.from({ length: st.hintsShown }).map((_, i) => {
          const h = cHints[i];
          const img = cHintImage(h, i);
          return (
            <div className="ddle-question ddle-hint" key={i}>
              <span className="ddle-hint-label">{t("hint")} {i + 1}:</span> {cHintText(h)}
              {img && <button type="button" className="hint-img zoomable-img u-tap" aria-label={lang === "fa" ? "بزرگ‌نمایی تصویر راهنما" : "Zoom the hint image"} onClick={() => setZoomSrc(img)}><img loading="lazy" decoding="async" src={img} alt="" /><span className="zoom-badge"><Icon name="search" size={14} /></span></button>}
            </div>
          );
        })}

        {cIsHotspot ? (
          <>
            <HotspotPlayer
              key={c.id}
              imageUrl={c.imageUrl} hotspot={st.overlayHotspot || cHotspot} lang={lang} done={dn}
              showCorrect={settings.showCorrect} clicks={st.hotspotClicks || []}
              onCommit={isCur ? hotspotClick : undefined}
            />
            {st.fb === "bad" && <div className="ddle-banner bad">{t("incorrect")}</div>}
            {st.fb === "ok" && <div className="ddle-banner ok"><Icon name="check" size={14} style={{ verticalAlign: "-2px" }} /> {t("correct")}</div>}
          </>
        ) : c.type && c.type !== "mcq" && c.type !== "image" ? (
          <ExamOtherType
            key={c.id}
            card={c} lang={lang} done={dn} editing={!!st.editing} showCorrect={settings.showCorrect} showHints={settings.showHints} hints={cHints}
            onGraded={isCur ? (isRight, detail = {}) => {

                  const frac = detail.pointsFrac == null ? (isRight ? 1 : 0) : Math.max(0, Math.min(1, Number(detail.pointsFrac) || 0));
                  const proposedPoints = cardMax * frac;
                  // Strict mode mirrors the server: hints deduct on every card
                  // type; no-penalty mode keeps the full fraction.
                  const pts = detail.requiresApproval ? 0 : (noPenaltyCfg ? proposedPoints : Math.max(0, proposedPoints - state.hintsShown * hintPenaltyUnit));
                  setState((s) => ({ ...s, editing: false, snapshot: null, picked: null, solved: true, revealed: !isRight, fb: detail.requiresApproval ? "ok" : (isRight ? "ok" : "bad") }));
                  setResults((r) => { const n = [...r]; n[idx] = { solved: isRight, points: pts, proposedPoints, pendingApproval: !!detail.requiresApproval, hintsUsed: state.hintsShown, hintLevel: state.hintsShown, responseMs: Math.max(0, Date.now() - (state.startedAt || startRef.current)), ...detail }; return n; });
            } : undefined}
          />
        ) : cMode === "choice" ? (
          <>
            <div className="mc-options">
              {(c.options || []).map((opt, i) => {
                let cls = "mc-opt";
                const isTried = st.tried.includes(i);
                if (dn && (opt.correct || i === st.correctIndex)) cls += " correct";
                else if (isTried) cls += " wrong";
                else if (dn) cls += " dim";
                else if (st.picked === i) cls += " sel";
                return (
                  <button type="button" key={i} className={cls} disabled={!isCur || dn || isTried} aria-pressed={st.picked === i} onClick={() => pick(i)}>
                    <span className="mc-letter">{letters[i]}</span>
                    <span className="mc-opt-body">
                      {opt.imageUrl && <img loading="lazy" decoding="async" className="mc-opt-img" src={opt.imageUrl} alt="" />}
                      <span>{lang === "fa" ? opt.fa : opt.en}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {!dn && st.picked == null && isCur && <div className="small muted mt8">{t("pickFirst")}</div>}
            {confirmBtn}
          </>
        ) : (<>
          {/* Empty guess rows: only shown AFTER the first guess, so a fresh
              question isn't cluttered with confusing blank grey boxes. */}
          {cGuesses.length > 0 && (
            <div className="ddle-rows">
              {Array.from({ length: Math.max(0, cRowCount - cGuesses.length) }).map((_, i) => (
                <div className="ddle-row" key={i}><span className="ddle-row-empty" /></div>
              ))}
            </div>
          )}

          {/* Status banner */}
          {st.fb === "bad" && <div className="ddle-banner bad">{t("incorrect")}</div>}
          {st.fb === "ok" && <div className="ddle-banner ok"><Icon name="check" size={14} style={{ verticalAlign: "-2px" }} /> {t("correct")}</div>}
          {st.revealed && settings.showCorrect && (
            <div className="ddle-banner bad">{t("correctAnswerWas")} <b>{(() => { const cc = (st.correctIndex != null ? (c.options || [])[st.correctIndex] : null) || (c.options || []).find((o) => o.correct); return cc ? (lang === "fa" ? cc.fa : cc.en) : "—"; })()}</b></div>
          )}

          {/* Search: picking only selects; the confirm button commits (R60) */}
          {!dn && <SearchAnswer
            options={c.options} lang={lang} disabled={dn} clearOnPick
            onPick={(i) => { if (isCur) pick(i); }}
          />}
          {!dn && st.picked == null && isCur && <div className="small muted mt8">{t("pickFirst")}</div>}
          {!dn && pickedLabel && <div className="small mt8">{t("yourChoice")}: <b>{pickedLabel}</b></div>}
          {confirmBtn}

          {/* Previous WRONG answers listed BELOW the search box (numbered) */}
          {cGuesses.filter((g) => !g.correct).length > 0 && (
            <div className="ddle-guesses">
              {cGuesses.filter((g) => !g.correct).map((g, i) => (
                <div className="ddle-guess" key={i}>
                  <span className="ddle-guess-no">{i + 1}</span>
                  <span className="ddle-guess-label">{g.label}</span>
                  <span className="ddle-guess-x">✗</span>
                </div>
              ))}
            </div>
          )}
        </>)}

        {isCur && (
          <div className="flash-nav">
            {navCfg.back && idx > 0 && !st.editing && (
              <button type="button" className="btn btn-ghost" onClick={prev}>← {t("prevCard")}</button>
            )}
            {st.editing && <button type="button" className="btn btn-ghost" onClick={cancelEdit}>{t("cancelChange")}</button>}
            {dn && navCfg.change && (
              <button type="button" className="btn btn-ghost" onClick={startEdit}>{t("changeAnswer")}</button>
            )}
            {dn && (
              <button type="button" className="btn btn-accent flash-nav-next" onClick={next}>
                {idx < cards.length - 1 ? `${t("nextCard")} →` : `${((examId || classCombined) ? t("examDone") : t("flashDone"))} →`}
              </button>
            )}
            {dn && idx < reachedIdx && !navCfg.change && <div className="small muted flash-nav-note"><Icon name="lock" size={12} style={{ verticalAlign: "-1px" }} /> {t("lockedAnswer")}</div>}
          </div>
        )}
      </div>
    );
  };

  return flashChrome(embedded, home, (
      <>
      <div className="container">
        <div className="section-title">
          <h2>{t("flashTitle")}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {timeLeft != null && (
              <div style={{ textAlign: "end" }}>
                <div className="small muted">{t("examTimer")}</div>
                <div className="timer">{fmtT(timeLeft)}</div>
                {runResumed && <div className="small muted">{lang === "fa" ? "ادامه جلسه قبلی — پیشرفت بازیابی شد" : "Resumed — progress restored"}</div>}
              </div>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={home}>← {t("back")}</button>
          </div>
        </div>
        <div className="ddle-wrap">
          {inExam && antiCheat && leaves > 0 && (
            <div className="err-banner mb16"><Icon name="warn" size={16} /> {t("antiCheatWarn")} ({leaves})</div>
          )}
          {inExam && noPenaltyCfg && (
            <div className="ddle-banner ok" style={{ marginBottom: 12 }}>
              <Icon name="target" size={14} style={{ verticalAlign: "-2px" }} /> {lang === "fa"
                ? "حالت «بدون کسر نمره» فعال است: استفاده از راهنما (هینت) و پاسخ اشتباه در مرحله‌های سؤال، از نمره شما کم نمی‌کند."
                : "No-penalty mode is on: using hints and wrong stage attempts will not reduce your score."}
            </div>
          )}
          {gradeErr && <div className="err-banner mb16"><Icon name="warn" size={16} /> {lang === "fa" ? "نمره‌دهی این سؤال شکست خورد" : "Grading this question failed"}: {gradeErr}</div>}
          <div className={`progress-dots${cards.length > 20 ? " dense" : ""}`} aria-hidden="true">
            {cards.map((_, i) => (
              <div key={i} className={`dot ${i === idx ? "active" : ""} ${results[i] && results[i].solved ? "solved" : ""}`} />
            ))}
          </div>
          {cards.length > 20 && <div className="progress-count">{idx + 1} / {cards.length}</div>}

          {shownIdxs.map((j) => (
            <div key={cards[j].id} hidden={j !== idx}>{renderCard(j)}</div>
          ))}
        </div>
      </div>
      {zoomSrc && (
        <div className="img-zoom-back" onClick={() => setZoomSrc(null)}>
          <button type="button" className="img-zoom-close" onClick={() => setZoomSrc(null)}>×</button>
          <img loading="lazy" decoding="async" src={zoomSrc} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      </>
  ));
}


// R97: full bodies for the chosen deck, in deck order. The server takes up to 400 ids per request;
// 200 keeps the URL short.
async function loadCardBodies(ids) {
  const byId = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    const rows = await api.get(`/flashcards?ids=${part.join(",")}`, { timeoutMs: 20_000, stage: "boot" });
    for (const row of Array.isArray(rows) ? rows : []) byId.set(row.id, row);
  }
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
const catOf = (c, lang) => biField(c, "category", lang);
const courseOf = (c, lang) => biField(c, "course", lang) || "—";

/* Deck chooser: decks are the courses; a category chip narrows them, search matches
   course or category names, and "practice" runs exactly the decks on screen. */
// topic: {key, label} from a virtual-patient case ("study this subject"), or null.
// onOpenCases(topic): jump to the virtual-patient cases of the same subject.
export function DeckPicker({ allCards: allCardsAll, onStart, home, embedded = false, topic = null, onOpenCases, onClearTopic }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("title");
  // Narrow to the chosen subject first. Cards without a topic key are not shown under a topic.
  const allCards = useMemo(
    () => (topic ? allCardsAll.filter((c) => c.topic === topic.key) : allCardsAll),
    [allCardsAll, topic],
  );

  const categories = useMemo(() => facetCounts(allCards, (c) => catOf(c, lang)), [allCards, lang]);
  const inCategory = useMemo(
    () => (category ? allCards.filter((c) => catOf(c, lang) === category) : allCards),
    [allCards, category, lang],
  );
  const decks = useMemo(() => {
    const groups = new Map();
    for (const c of inCategory) {
      const key = courseOf(c, lang);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    const needle = normalizeSearch(query);
    let list = [...groups].map(([course, cards]) => ({
      course,
      cards,
      cats: [...new Set(cards.map((c) => catOf(c, lang)).filter(Boolean))],
    }));
    if (needle) list = list.filter((d) => normalizeSearch([d.course, ...d.cats].join(" ")).includes(needle));
    return sortBy(list, sort, { title: (d) => d.course, count: (d) => d.cards.length });
  }, [inCategory, query, sort, lang]);

  const shown = useMemo(() => decks.flatMap((d) => d.cards), [decks]);
  const filtered = Boolean(query.trim() || category);
  const resetFilters = () => { setQuery(""); setCategory(""); };

  return flashChrome(embedded, home, (
    <div className="container">
      <div className="section-title">
        <h2><Icon name="flask" size={16} /> {t("flashTitle")}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={home}>← {t("back")}</button>
      </div>
      {topic && (
        <section className="card mb16" aria-labelledby="deck-topic-title" style={{ display: "grid", gap: 8 }}>
          <div className="small muted" id="deck-topic-title">{fa ? "موضوع انتخاب‌شده" : "Selected topic"}</div>
          <strong>{topic.label}</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {onOpenCases && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenCases(topic)}>
                {fa ? "بیماران مجازی این موضوع" : "Virtual patients for this topic"}
              </button>
            )}
            {onClearTopic && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClearTopic}>
                {fa ? "نمایش همه کارت‌ها" : "Show all cards"}
              </button>
            )}
          </div>
        </section>
      )}
      <div className="card mb16" style={{ textAlign: "center" }}>
        <div className="mod-ico" style={{ margin: "0 auto 12px", background: "var(--grad-primary)" }}><Icon name="catalog" size={30} /></div>
        <h3>{t("pickDeck")}</h3>
        <p className="muted small">{t("pickDeckDesc")}</p>
        <button type="button" className="btn btn-primary mt16" disabled={!shown.length} onClick={() => onStart(shown)}>
          ▶ {filtered ? (fa ? `تمرین نتایج نمایش‌داده‌شده (${shown.length.toLocaleString("fa-IR")})` : `Practise shown (${shown.length})`)
            : `${t("practiceAll")} (${allCards.length})`}
        </button>
      </div>

      <div className="case-toolbar" style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <div className="search-input-wrap">
          <span className="search-ico"><Icon name="search" size={16} /></span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={fa ? "جست‌وجوی درس یا دسته…" : "Search course or category…"}
            aria-label={fa ? "جست‌وجوی دسته‌ها" : "Search decks"}
            autoComplete="off"
          />
        </div>
        {categories.length > 1 && (
          <div className="seg" role="radiogroup" aria-label={fa ? "فیلتر دسته‌بندی" : "Category filter"} style={{ flexWrap: "wrap" }}>
            <button type="button" role="radio" aria-checked={!category} className={!category ? "on" : ""} onClick={() => setCategory("")}>
              {fa ? "همه" : "All"} ({allCards.length})
            </button>
            {categories.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={category === c.value}
                className={category === c.value ? "on" : ""} onClick={() => setCategory(c.value)}>
                {c.value} ({c.count})
              </button>
            ))}
          </div>
        )}
        <div className="seg seg-new" role="radiogroup" aria-label={fa ? "مرتب‌سازی دسته‌ها" : "Sort decks"}>
          <button type="button" role="radio" aria-checked={sort === "title"} className={sort === "title" ? "on" : ""} onClick={() => setSort("title")}>{fa ? "نام درس" : "Course"}</button>
          <button type="button" role="radio" aria-checked={sort === "count"} className={sort === "count" ? "on" : ""} onClick={() => setSort("count")}>{fa ? "بیشترین کارت" : "Most cards"}</button>
        </div>
        {filtered && (
          <div className="muted small" role="status" aria-live="polite">
            {fa ? `${decks.length.toLocaleString("fa-IR")} دسته` : `${decks.length} decks`}
          </div>
        )}
      </div>

      {topic && allCards.length === 0 ? (
        <div className="card center" style={{ padding: 32 }} role="status">
          <div style={{ fontWeight: 800 }}>{fa ? "هنوز کارتی برای این موضوع نداریم." : "There are no cards for this topic yet."}</div>
          {onClearTopic && <button type="button" className="btn btn-ghost mt16" onClick={onClearTopic}>{fa ? "نمایش همه کارت‌ها" : "Show all cards"}</button>}
        </div>
      ) : decks.length === 0 && allCards.length > 0 ? (
        <div className="card center" style={{ padding: 32 }} role="status">
          <div style={{ fontWeight: 800 }}>{fa ? "دسته‌ای با این فیلتر پیدا نشد." : "No deck matches these filters."}</div>
          <button type="button" className="btn btn-ghost mt16" onClick={resetFilters}>{fa ? "پاک‌کردن فیلترها" : "Clear filters"}</button>
        </div>
      ) : (
        <div className="grid grid-2">
          {decks.map((d) => (
            <div className="card mod-card" key={d.course} role="button" tabIndex={0}
              aria-label={`${d.course} — ${d.cards.length} ${t("totalCards")}`}
              onClick={() => onStart(d.cards)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStart(d.cards); } }}>
              <div className="mod-ico" style={{ background: "var(--grad-purple)" }}><Icon name="book" size={30} /></div>
              <h3>{d.course}</h3>
              <p>{d.cards.length} {t("totalCards")}</p>
              <div className="case-meta mt8">
                {d.cats.slice(0, 3).map((cat) => (
                  <span className="tag" key={cat}>{cat}</span>
                ))}
                {d.cats.length > 3 && <span className="tag">+{d.cats.length - 3}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  ));
}

function Summary({ cards, results, totalHints, onRestart, onPick, home, examId, classId, onRetry, saving, competition, meUserId, saveErr, noPenalty = false, serverScore = null, embedded = false }) {
  const { t, lang } = useApp();
  const [showLb, setShowLb] = useState(false);
  const solved = results.filter((r) => r && r.solved).length;
  const pct = Math.round(results.reduce((sum, r) => sum + (r ? r.points : 0), 0));
  // The server regrades every submitted deck — its number is the gradebook one.
  const shownScore = (serverScore != null && Number.isFinite(serverScore)) ? Math.round(serverScore) : pct;
  return flashChrome(embedded, home, (
      <div className="container"><div className="flash-wrap">
        <div className="card center">
          <div style={{ fontSize: 44 }}><Icon name="party" size={30} /></div>
          {saveErr ? (
            <div className="err mb8">{lang === "fa"
              ? "نتیجه روی صفحه است، ولی ذخیره روی سرور شکست خورد. دوباره تلاش کنید."
              : "Your summary is on screen, but saving the score failed. Please try again."}</div>
          ) : null}
          {saveErr==='changed'&&<p role="alert">{lang==='fa'?'سؤال‌ها یا تنظیمات کلاس تغییر کرده‌اند؛ پاسخی ثبت نشد. به کلاس برگردید و آزمون جدیدی آغاز کنید.':'Class questions or settings changed. Nothing was recorded. Return to the class and start a new exam.'}</p>}
          {onRetry&&saveErr&&saveErr!=='changed'&&<button type="button" className="btn btn-primary" disabled={saving} onClick={onRetry}>{lang==='fa'?'تلاش مجدد برای ثبت':'Retry saving'}</button>}
          {saving&&<p role="status">{lang==='fa'?'در حال ثبت نتیجه…':'Saving results…'}</p>}
          <h2 className="mt8">{(examId || classId) ? t("examDone") : t("flashDone")}</h2>
          <div className="grid grid-3 mt16">
            <div className="stat-card"><div className="num">{solved}/{cards.length}</div><div className="lbl">{t("solved")}</div></div>
            <div className="stat-card"><div className="num">{totalHints}</div><div className="lbl">{t("hintsUsed")}</div></div>
            <div className="stat-card"><div className="num">{shownScore}</div><div className="lbl">{t("finalScore")}</div></div>
          </div>
          {(examId || noPenalty) && (
            <div className="small muted mt8">
              <Icon name={noPenalty ? "target" : "bulb"} size={14} style={{ verticalAlign: "-2px" }} /> {noPenalty
                ? (lang === "fa" ? "حالت بدون کسر نمره — هینت و تلاش‌های اشتباه مرحله‌ای بدون کسر لحاظ شد." : "No-penalty mode — hints and wrong stage attempts were not deducted.")
                : (lang === "fa" ? "هر هینت بخشی از امتیاز آن کارت را کسر کرد." : "Each hint deducted part of that card's points.")}
            </div>
          )}

          {competition && examId && (
            <div className="mt16">
              <button type="button" className="btn btn-accent" onClick={() => setShowLb((v) => !v)}><Icon name="trophy" size={16} /> {t("viewLeaderboard")}</button>
            </div>
          )}

          <div className="mt16" style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {!examId && !classId && <button type="button" className="btn btn-primary" onClick={onRestart}><Icon name="restart" size={16} /> {t("start")}</button>}
            {!examId && !classId && <button type="button" className="btn btn-ghost" onClick={onPick}><Icon name="catalog" size={16} /> {t("pickDeck")}</button>}
            <button type="button" className="btn btn-ghost" onClick={home}>{t("back")}</button>
          </div>
        </div>

        {competition && examId && showLb && (
          <div className="card mt16"><Leaderboard examId={examId} meUserId={meUserId} /></div>
        )}
      </div></div>
  ));
}
