import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { XpIcon } from "../../components/StatIcons.jsx";
import { DrMed, Microbe, MascotSay } from "../../components/PathMascots.jsx";
import { loadMascots, currentMascots, drLine, microbeLine, guideImg, DEFAULT_MASCOTS } from "../../lib/mascotConfig.js";
import Confetti from "../../components/Confetti.jsx";
import { AdCard } from "./AdCard.jsx";
import { safeLocal } from "../../lib/storage.js";
import JumpAhead from "./JumpAhead.jsx";

/* A coherent accent color per SECTION (topic parent group). Each section gets
   its own identity color that tints its label, progress bar and node trail. */
const SECTION_THEME = {
  internal: "#2569b0",   // internal medicine — clinical blue
  major:    "#e0568a",   // major subjects — rose
  minor:    "#6d5bd0",   // minor subjects — violet
  floating: "#22a06b",   // floating subjects — green
  basic:    "#e0912e",   // basic sciences — amber
  other:    "#647184",
};
const sectionColor = (parent) => SECTION_THEME[parent] || SECTION_THEME.other;

/* Redesigned learning path — a Duolingo-style winding node path grouped into
   colored UNIT headers. Research-informed 2025 improvements:
     • a sticky "continue" bar that always surfaces the very next lesson,
     • an overall progress header (total %) with a motivating message,
     • per-section (parent group) progress, and a "jump to current" affordance,
     • clearer done/locked/boss/legendary states + aria-current for a11y.
   Pure client redesign — same /learn/path data as before, so nothing regresses. */

const PARENT_LABEL = {
  internal: { fa: "دروس داخلی", en: "Internal Medicine" },
  major: { fa: "دروس ماژور", en: "Major Subjects" },
  minor: { fa: "دروس مینور", en: "Minor Subjects" },
  floating: { fa: "دروس شناور", en: "Floating Subjects" },
  basic: { fa: "علوم پایه", en: "Basic Sciences" },
};

function Stars({ n }) {
  return <div className="stars">{[1, 2, 3, 4, 5].map((i) => <XpIcon key={i} size={13} muted={i > n} />)}</div>;
}

/* Pairs premium extra practice stages as satellite mini-nodes attached beside
   their corresponding parent core lesson, keeping the main path continuous,
   uncluttered, and beautiful. */
function prepareTopicNodes(rawNodes = []) {
  const coreNodes = [];
  let lastCore = null;
  for (const n of rawNodes) {
    if (n.premium && lastCore) {
      lastCore.satellites = lastCore.satellites || [];
      lastCore.satellites.push(n);
    } else {
      const core = { ...n, satellites: [] };
      coreNodes.push(core);
      if (!n.premium) lastCore = core;
    }
  }
  return coreNodes;
}

export default function LearnPath({ openLesson, openLegendary, focusSlug, onFocused, onProfile }) {
  const { t, lang, flag } = useApp();
  const fa = lang === "fa";
  const [topics, setTopics] = useState(null);
  const [ads, setAds] = useState([]);
  const [celebrate, setCelebrate] = useState(false);   // fire confetti once per newly-completed unit
  const [mascots, setMascots] = useState(currentMascots());  // admin-editable character config
  const [highlightSlug, setHighlightSlug] = useState(null);  // briefly glow the deep-linked topic
  // Round 5: a unit can hold 40–60 stages now. Keep the map light by showing a
  // window around the learner's frontier (last few done + next few) and let the
  // learner expand the full unit on demand.
  const [expanded, setExpanded] = useState({});
  // Duolingo-style: the big "up next" card shrinks to a slim sticky bar once
  // the learner scrolls into the path, so the map — not the chrome — owns the screen.
  const [compact, setCompact] = useState(false);
  const [popNode, setPopNode] = useState(null);   // tapped locked node → small hint bubble
  const [popSat, setPopSat] = useState(null);     // tapped satellite node → small hint bubble
  const [jumpTopic, setJumpTopic] = useState(null); // Round 9: «پرش از واحد» quiz modal
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 140);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { if (!popNode) return; const h = setTimeout(() => setPopNode(null), 2600); return () => clearTimeout(h); }, [popNode]);
  useEffect(() => {
    if (!popSat) return;
    const onClickAway = (e) => {
      if (!e.target.closest(".satellite-mini-node") && !e.target.closest(".satellite-pop")) {
        setPopSat(null);
      }
    };
    window.addEventListener("pointerdown", onClickAway);
    const h = setTimeout(() => setPopSat(null), 6000);
    return () => {
      window.removeEventListener("pointerdown", onClickAway);
      clearTimeout(h);
    };
  }, [popSat]);
  const currentRef = useRef(null);
  const autoScrolledRef = useRef(false); // one-time smart resume scroll per path mount
  const topicRefs = useRef({});   // slug → DOM node, so we can scroll to a specific topic

  useEffect(() => { loadMascots().then(setMascots).catch(() => setMascots(DEFAULT_MASCOTS)); }, []);

  useEffect(() => {
    api.get(`/learn/path?lang=${lang}`).then((d) => {
      setTopics(d.topics);
      // Celebrate when a unit is completed that we haven't celebrated before.
      // We remember celebrated unit ids in localStorage so the shower fires only
      // the FIRST time a unit turns 100% — never on every visit.
      try {
        const seen = new Set(JSON.parse(safeLocal.getItem("medlab_units_done") || "[]"));
        const nowDone = (d.topics || []).filter((tp) => tp.total > 0 && tp.done >= tp.total).map((tp) => tp.id);
        const fresh = nowDone.filter((id) => !seen.has(id));
        if (fresh.length && seen.size /* not the very first load with pre-seeded progress */ >= 0) {
          // only celebrate if there IS a previously-stored baseline (avoids a
          // confetti storm on a brand-new device seeing seeded completions).
          const hadBaseline = safeLocal.getItem("medlab_units_done") !== null;
          if (hadBaseline && fresh.length) setCelebrate(true);
          safeLocal.setItem("medlab_units_done", JSON.stringify(nowDone));
        }
      } catch { /* celebration is best-effort */ }
    }).catch(() => setTopics([]));
    api.get(`/learn/ads?slot=path&lang=${lang}`).then((d) => setAds(d.ads || [])).catch(() => {});
  }, [lang, reloadKey]);

  // auto-clear the celebration flag after the shower finishes
  useEffect(() => {
    if (!celebrate) return;
    const id = setTimeout(() => setCelebrate(false), 3600);
    return () => clearTimeout(id);
  }, [celebrate]);

  // Deep-link: when we arrive with a focus topic (from the placement "start
  // here" recommendation), scroll to it and glow it briefly, then consume it.
  useEffect(() => {
    if (!focusSlug || !topics) return;
    const el = topicRefs.current[focusSlug];
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
      setHighlightSlug(focusSlug);
      const t1 = setTimeout(() => setHighlightSlug(null), 2600);
      onFocused?.();   // clear the parent's focus so it doesn't re-fire on re-render
      return () => clearTimeout(t1);
    }
    onFocused?.();
  }, [focusSlug, topics]);

  // Smart resume: when the learner opens the path, automatically scroll to the
  // first available not-done lesson (the lesson after their last completed one).
  // It runs only once per mount, so after the first guided scroll the learner is
  // free to scroll manually without the page fighting them.
  useEffect(() => {
    if (!topics || focusSlug || autoScrolledRef.current) return;
    const id = setTimeout(() => {
      const el = currentRef.current;
      if (!el) return;
      autoScrolledRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightSlug("__current__");
      setTimeout(() => setHighlightSlug(null), 2200);
    }, 450);
    return () => clearTimeout(id);
  }, [topics, focusSlug]);

  if (!topics) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  // find the single "current" node across the whole path (first not-done, not-locked core lesson)
  let currentId = null, currentNode = null, currentTopic = null;
  for (const tp of topics) {
    const n = (tp.nodes || []).find((x) => !x.done && !x.locked && !x.premium);
    if (n) { currentId = n.id; currentNode = n; currentTopic = tp; break; }
  }

  // overall progress across the whole path
  const totalNodes = topics.reduce((s, tp) => s + (tp.total || 0), 0);
  const doneNodes = topics.reduce((s, tp) => s + (tp.done || 0), 0);
  const totalPct = totalNodes ? Math.round((doneNodes / totalNodes) * 100) : 0;
  const allDone = totalNodes > 0 && doneNodes >= totalNodes;

  // per-section (parent) progress + the list of sibling topics (for the
  // "related subjects" emoji row shown on each unit header)
  const sectionAgg = {};
  const sectionTopics = {};
  for (const tp of topics) {
    const k = tp.parent || "other";
    sectionAgg[k] = sectionAgg[k] || { done: 0, total: 0 };
    sectionAgg[k].done += tp.done || 0;
    sectionAgg[k].total += tp.total || 0;
    (sectionTopics[k] ||= []).push(tp);
  }

  const jumpToCurrent = () => {
    if (currentRef.current) currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const startCurrent = () => { if (currentId) openLesson(currentId); };

  // motivating message based on progress
  const motivate = allDone
    ? (fa ? "تمام مسیر را کامل کردی! 🏆" : "You finished the whole path! 🏆")
    : totalPct >= 66 ? (fa ? "به خط پایان نزدیکی — ادامه بده!" : "Almost there — keep going!")
    : totalPct >= 33 ? (fa ? "عالی پیش می‌روی!" : "Great progress!")
    : totalPct > 0 ? (fa ? "قدم‌های اول برداشته شد 💪" : "You're off to a strong start 💪")
    : (fa ? "سفر یادگیری‌ات همین‌جا شروع می‌شود" : "Your learning journey starts here");

  let lastParent = null;
  return (
    <div className="page path-page">
      {celebrate && <Confetti duration={3400} pieces={180} />}
      {jumpTopic && <JumpAhead topic={jumpTopic} onClose={() => setJumpTopic(null)} onDone={() => setReloadKey((k) => k + 1)} onProfile={onProfile} />}
      <div className="section-title"><h2><Icon name="book" size={22} /> {t("learnPath")}</h2></div>

      {/* ---- Overall progress + continue bar (always shows what's next) ---- */}
      <div className={`path-progress-card ${compact ? "ppc-compact" : ""}`}>
        {compact && currentNode && (
          <div className="ppc-mini">
            <span className="ppc-mini-title">{currentTopic?.emoji || "📘"} {currentNode.title}</span>
            <span className="ppc-mini-pct">{totalPct}%</span>
            <button className="btn btn-primary btn-sm" onClick={startCurrent}><Icon name="play" size={13} /> {fa ? "ادامه" : "Continue"}</button>
          </div>
        )}
        <div className="ppc-top">
          <div className="ppc-msg">{motivate}</div>
          <div className="ppc-pct">{totalPct}%</div>
        </div>
        <div className="ppc-bar"><span style={{ width: `${totalPct}%` }} /></div>
        <div className="ppc-sub">{doneNodes} / {totalNodes} {fa ? "درس تکمیل‌شده" : "lessons done"}</div>
        {currentNode && (
          <div className="ppc-continue">
            <div className="ppc-continue-info">
              <div className="ppc-continue-label">{fa ? "قدم بعدی" : "Up next"}</div>
              <div className="ppc-continue-title">{currentTopic?.emoji || "📘"} {currentNode.title}</div>
              {currentNode.subtitle && <div className="ppc-continue-subtitle small muted">{currentNode.subtitle}</div>}
            </div>
            <div className="ppc-continue-actions">
              <button className="btn btn-ghost btn-sm" onClick={jumpToCurrent}>{fa ? "نمایش روی مسیر" : "Show on path"}</button>
              <button className="btn btn-primary" onClick={startCurrent}><Icon name="play" size={15} /> {fa ? "ادامهٔ یادگیری" : "Continue"}</button>
            </div>
          </div>
        )}
      </div>

      {topics.map((topic, ti) => {
        const parentHead = topic.parent !== lastParent ? topic.parent : null;
        lastParent = topic.parent;
        const pct = topic.total ? Math.round((topic.done / topic.total) * 100) : 0;
        const complete = topic.total > 0 && topic.done >= topic.total;
        const hasCurrent = currentTopic && currentTopic.id === topic.id;
        const sec = parentHead ? sectionAgg[parentHead] : null;
        const secPct = sec && sec.total ? Math.round((sec.done / sec.total) * 100) : 0;
        const secColor = sectionColor(topic.parent);
        // Dr. Med mood + phase for this section (deterministic per section id).
        const secPhase = secPct >= 100 ? "done" : secPct > 0 ? "mid" : "start";
        const drMood = secPct >= 100 ? "celebrate" : secPct > 0 ? "cheer" : "wave";
        return (
          <div key={topic.id} className={`path-section-wrap ${highlightSlug === topic.slug || (highlightSlug === "__current__" && hasCurrent) ? "topic-focus-glow" : ""}`}
            ref={(el) => { if (topic.slug) topicRefs.current[topic.slug] = el; }}
            style={{ "--sec": secColor }}>
            {parentHead && (
              <div className="path-section-label">
                <span className="psl-name">{fa ? PARENT_LABEL[parentHead]?.fa : PARENT_LABEL[parentHead]?.en}</span>
                {sec && sec.total > 0 && (
                  <span className="path-section-prog" aria-hidden="true">
                    <span className="psp-bar"><span style={{ width: `${secPct}%` }} /></span>
                    <span className="psp-pct">{secPct}%</span>
                  </span>
                )}
              </div>
            )}

            {/* ---- Dr. Med greets each new section (Duolingo-style side character) ---- */}
            {parentHead && mascots.enabled && mascots.dr.enabled && (
              <div className="path-mascot path-mascot-dr">
                <DrMed size={92} mood={drMood} src={guideImg(mascots, parentHead)} speed={mascots.speed} />
                <MascotSay side="start">{drLine(mascots, lang, secPhase, parentHead)}</MascotSay>
              </div>
            )}

            {/* ---- Unit header (colored banner) — clean & Duolingo-like:
                 icon + title + a small progress count. No extra clutter. ---- */}
            <div className={`unit-header ${complete ? "unit-header-done" : ""}`} style={{ background: topic.color || "var(--grad-primary)" }}>
              <div className="unit-header-ico">
                {topic.emoji ? <span className="node-emoji">{topic.emoji}</span> : <Icon name={topic.icon} size={22} />}
              </div>
              <div className="unit-header-body">
                <div className="unit-header-title">{topic.name}{complete && " ✓"}</div>
                {topic.canJump && flag("jump_ahead") && (
                  <button type="button" className="unit-jump-btn" onClick={() => setJumpTopic(topic)} title={fa ? "با یک آزمون کوتاه، از این واحد بپر" : "Skip this unit with a short quiz"}>
                    🚀 {fa ? "پرش از واحد" : "Jump ahead"}
                  </button>
                )}
              </div>
              <div className="unit-header-prog">
                <div className="uhp-count">{topic.done}/{topic.total}</div>
                <div className="uhp-bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
            </div>

            {/* ---- Winding node path ---- */}
            <div className="unit-path">
              {(() => {
                const WINDOW_BEFORE = 2, WINDOW_AFTER = 6, COLLAPSE_AT = 12;
                const coreNodes = prepareTopicNodes(topic.nodes);
                const all = coreNodes;
                if (all.length <= COLLAPSE_AT || expanded[topic.id]) return null;
                const frontier = Math.max(0, all.findIndex((n) => !n.done));
                const from = Math.max(0, frontier - WINDOW_BEFORE);
                if (from === 0) return null;
                return (
                  <button type="button" className="unit-window-more" onClick={() => setExpanded((e) => ({ ...e, [topic.id]: true }))}>
                    <Icon name="check" size={13} /> {fa ? `${from} مرحلهٔ قبلی تکمیل شده — نمایش همه` : `${from} earlier stages done — show all`}
                  </button>
                );
              })()}
              {(() => {
                const coreNodes = prepareTopicNodes(topic.nodes);
                return coreNodes.map((n, ni) => {
                  if (!expanded[topic.id] && coreNodes.length > 12) {
                    const frontier = Math.max(0, coreNodes.findIndex((x) => !x.done));
                    if (ni < frontier - 2 || ni > frontier + 6) return null;
                  }
                  const mastered = n.stars >= 5;
                  const isCurrent = n.id === currentId;
                  // gentle winding S-curve (Duolingo-style): a smooth 6-step
                  // left↔right sway so the eye follows the path down the column.
                  const sway = [0, 46, 74, 46, 0, -46, -74, -46];
                  const offset = sway[ni % sway.length];
                  const goPremium = () => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }));
                  const openNode = () => {
                    if (n.locked) { setPopNode(n.id); return; }
                    if (mastered && !n.legendary && openLegendary && flag("legendary")) openLegendary(n.id);
                    else openLesson(n.id);
                  };
                  const openSatellite = (sat) => {
                    if (popSat === sat.id) { setPopSat(null); return; }
                    if (sat.premiumLocked) { setPopSat(sat.id); return; }
                    if (sat.locked) { setPopSat(sat.id); return; }
                    openLesson(sat.id);
                  };
                  return (
                    <div className={`unit-node-row ${n.done ? "row-done" : ""}`} key={n.id} style={{ "--offset": `${offset}px`, "--i": ni }} ref={isCurrent ? currentRef : null}>
                      <div className="unit-node-main-wrap">
                        <button
                          className={`unit-node node ${n.done ? "done" : ""} ${n.locked ? "locked" : ""} ${n.kind === "boss" ? "boss" : ""} ${n.legendary ? "legendary" : ""} ${isCurrent ? "current" : ""}`}
                          aria-disabled={n.locked}
                          aria-current={isCurrent ? "step" : undefined}
                          aria-label={`${n.title}${n.locked ? (fa ? " (قفل)" : " (locked)") : n.legendary ? (fa ? " (افسانه‌ای)" : " (legendary)") : n.done ? `${fa ? " تکمیل‌شده" : " done"} ${n.stars}/5` : isCurrent ? (fa ? " (درس فعلی)" : " (current)") : ""}${mastered && !n.legendary ? (fa ? " — برای چالش افسانه‌ای بزن" : " — tap for legendary") : ""}`}
                          onClick={openNode}
                          title={n.title}
                        >
                          {isCurrent && <div className="node-start-flag">{fa ? "شروع" : "START"}</div>}
                          {popNode === n.id && <div className="node-pop" role="status">{fa ? "اول درس قبلی را تمام کن" : "Finish the previous lesson first"}</div>}
                          <span className={`node-ring ${isCurrent ? "on" : ""}`} aria-hidden="true" />
                          <span className="unit-bubble bubble" style={!n.done && !n.locked && n.kind !== "boss" && !n.legendary ? { background: topic.color } : undefined}>
                            <span className="bubble-gloss" aria-hidden="true" />
                            {n.locked ? <Icon name="lock" size={26} />
                              : n.legendary ? <span className="node-emoji">👑</span>
                              : n.done ? <Icon name="check" size={30} />
                              : n.kind === "boss" ? <Icon name="trophy" size={26} />
                              : (n.emoji || topic.emoji)
                                ? <span className="node-emoji">{n.emoji || topic.emoji}</span>
                                : <Icon name="play" size={24} />}
                          </span>
                          {/* tiny star pips under DONE nodes — subtle, not a full label */}
                          {n.done && !n.legendary && <Stars n={n.stars} />}
                        </button>

                        {/* Compact satellite mini-node for extra practice */}
                        {n.satellites && n.satellites.length > 0 && (
                          <div className={`node-satellites-slot ${offset > 20 ? "side-start" : "side-end"}`}>
                            <span className="satellite-bridge" aria-hidden="true" />
                            {n.satellites.map((sat) => {
                              const satMastered = sat.stars >= 5;
                              return (
                                <div key={sat.id} style={{ position: "relative" }}>
                                  <button
                                    type="button"
                                    className={`satellite-mini-node ${sat.done ? "done" : ""} ${sat.locked && !sat.premiumLocked ? "locked" : ""} ${sat.premiumLocked ? "premium-locked" : ""}`}
                                    onClick={(e) => { e.stopPropagation(); openSatellite(sat); }}
                                    title={sat.title}
                                    aria-label={sat.title}
                                  >
                                    {sat.done ? (satMastered ? "👑" : "✓") : "👑"}
                                  </button>
                                  {popSat === sat.id && (
                                    <div className="satellite-pop" role="status">
                                      {sat.premiumLocked ? (
                                        <div>
                                          <div style={{ fontWeight: 800 }}>👑 {sat.title || (fa ? "تمرین تکمیلی" : "Extra Practice")}</div>
                                          <div className="small muted mt2" style={{ fontSize: ".72rem" }}>
                                            {fa ? `${sat.cards || 20} سؤال مفهومی تکمیلی` : `${sat.cards || 20} bonus practice questions`}
                                          </div>
                                          <button type="button" className="btn btn-primary btn-xs mt6" onClick={goPremium} style={{ width: "100%", padding: "4px 8px", fontSize: ".72rem" }}>
                                            {fa ? "👑 ارتقا به پلاس" : "👑 Upgrade to Plus"}
                                          </button>
                                        </div>
                                      ) : sat.locked ? (
                                        <div>
                                          <div style={{ fontWeight: 800 }}>🔒 {sat.title || (fa ? "آزمون ماهواره‌ای" : "Satellite Test")}</div>
                                          <div className="small muted mt2">{fa ? "اول درس اصلی را کامل کن" : "Finish main lesson first"}</div>
                                        </div>
                                      ) : (
                                        <div>
                                          <div style={{ fontWeight: 800 }}>👑 {sat.title}</div>
                                          <div className="small muted mt2">{sat.cards} {fa ? "سؤال تکمیلی" : "practice questions"}</div>
                                          <div className="small mt4" style={{ color: "var(--accent,#22a06b)", fontWeight: 700 }}>
                                            {sat.done ? (fa ? "تکرار تمرین" : "Practice again") : (fa ? "شروع آزمون" : "Start")}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Explicit stage label: the learner must know what this
                          stage quizzes before opening it (title + concepts). */}
                      <div className="unit-node-label" aria-hidden={n.locked}>
                        <div className="unl-title">{n.title}</div>
                        {n.subtitle && <div className="unl-subtitle">{n.subtitle}</div>}
                      </div>

                      {/* ---- Microbe rival guards an UN-DONE boss / checkpoint node. ---- */}
                      {n.kind === "boss" && !n.done && mascots.enabled && mascots.microbe.enabled && (
                        <div className="path-mascot path-mascot-boss">
                          <Microbe size={60} mood="smirk" src={mascots.microbe.img} speed={mascots.speed} />
                          {!n.locked && <MascotSay side="start">{microbeLine(mascots, lang, n.id)}</MascotSay>}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              {(() => {
                const coreNodes = prepareTopicNodes(topic.nodes);
                const all = coreNodes;
                if (all.length <= 12 || expanded[topic.id]) return null;
                const frontier = Math.max(0, all.findIndex((n) => !n.done));
                const hidden = all.length - 1 - (frontier + 6);
                if (hidden <= 0) return null;
                return (
                  <button type="button" className="unit-window-more" onClick={() => setExpanded((e) => ({ ...e, [topic.id]: true }))}>
                    <Icon name="lock" size={13} /> {fa ? `${hidden} مرحلهٔ دیگر — نمایش همه` : `${hidden} more stages — show all`}
                  </button>
                );
              })()}
              {complete && (
                <div className="unit-complete-chip" aria-label={fa ? "این واحد کامل شد" : "Unit complete"}>
                  <Icon name="check" size={13} /> {fa ? "کامل شد" : "Complete"}
                </div>
              )}
            </div>

            {/* interleave an ad between subject groups */}
            {ti === 2 && ads[0] && <div className="mb16"><AdCard ad={ads[0]} /></div>}
          </div>
        );
      })}

      {allDone && (
        <div className="path-finish-card">
          🏆 <div>{fa ? "تبریک! کل مسیر یادگیری را کامل کردی." : "Congratulations! You completed the entire path."}</div>
        </div>
      )}
    </div>
  );
}
