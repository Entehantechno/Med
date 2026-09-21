/* learn.js — Gamified pre-internship learner track API (role = 'learner').
   Path map, lessons, XP/streak/hearts, weekly leagues, country ranking,
   achievements, ads, and premium (simulated). */
import { Router } from "express";
import { searchPool, normalizeText, highlightRanges, snippet as searchSnippet, suggest as suggestValues } from "../lib/textsearch.js";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import {
  getProfile, awardXp, loseHeart, refillHearts, maxHearts, heartRefillGems,
  getLeague, countryRanking, provinceRanking, checkAchievements, TIER_LABEL, tierForXp, STREAK_SOCIETY,
  getAnonSettings, setAnonSettings,
} from "../lib/gamify.js";
import {
  DAILY_GOALS, SHOP, setDailyGoal, todayXp, buyItem, getQuests, progressQuests,
  claimQuest, getChests, openChest, streakCalendar, personalRecords, streakStatus,
} from "../lib/gameplus.js";
import { recordAnswers, performanceDashboard, mistakeCardIds, flaggedCardIds, difficultyLabel, classifyErrors, confidenceQuizScore, calibrationReport } from "../lib/analytics.js";
import { emojiForTopic } from "../lib/topicemoji.js";
import { serializeCard } from "../lib/cardserialize.js";
import { glossaryPayload } from "../lib/glossary.js";
import { lessonSummary, programSummaries } from "../lib/chaptersummary.js";
import { cardFacets, buildFacetIndex, matchFacets, sortCards, fullYear, cardIsBankOnly } from "../lib/cardfacets.js";
import { notify, vapidPublicKey, pushConfigured } from "../lib/notify.js";
import { review as srsReview, dueCards, dueCount, ensureTracked, lapseWrongCards, previewSchedule, srsStats, tehranDay } from "../lib/srs.js";
import { checkMasteryForCards, masteryOverview } from "../lib/mastery.js";
import { getCalmSettings, setCalmSettings, effectiveReviewCap, takeRestDay, calmOptOutLeagues } from "../lib/calm.js";
import { isEnabled } from "../lib/flags.js";
import { getPlans } from "./payments.js";
import { maybeNudgePremiumRenewal } from "../lib/entitlement.js";
import { applyPremiumDays } from "../lib/entitlement.js";
import { optionStats, withOptionStats, percentileFor, dailyReport, takeHint, hasHint, saveExplainAsCard, checkStreakTrial, jumpAllowed, jumpUnlockedTopics, buildJumpQuiz, submitJumpQuiz, peerCfg } from "../lib/peerstats.js";
import { createSim, finishSim, simHistory } from "../lib/examsim.js";
import { normalizeConfig, builderOptions, pickCards, createCustomTest, getCustomTest, answerCustomTest, finishCustomTest, customHistory } from "../lib/customtest.js";
import { gradeFlashcard, bodyFromClientSel } from "../lib/flashcard-grade.js";
import { buildMindmap, mindmapTopics } from "../lib/mindmap.js";
import { buildStudyPlan, getStudyPlan } from "../lib/studyplan.js";
import { getSetting } from "./content.js";
import { studyNote, resolveAiConfig } from "../lib/ai-engine.js";
import { shareCard, browseCommunity, voteCommunity, importCommunity } from "../lib/community.js";
import { hardestQuestions, crowdSummary, crowdForCard } from "../lib/crowd.js";
import { activePrograms, activeProgramFor, setActiveProgram, programLabel } from "../lib/programs.js";
import { myCertificates, myProgress as certProgress, maybeAutoIssueProgram, issueCertificate } from "../lib/certificates.js";
import { listCheckpoints, buildCheckpoint, finishCheckpoint, checkpointGate } from "../lib/checkpoint.js";
import { calibrateLessonOrder, calibrationSnapshot } from "../lib/calibration.js";
import {
  wagerStatus, placeWager, settleWagers, monthlyStatus, bumpMonthly, claimMonthly,
  getBadges, eventDef, startEvent, finishEvent, revivalStatus, claimRevival,
} from "../lib/duoplus.js";
import { pickAd, claimRewardedAd, rewardedViewsToday } from "../lib/rewardedads.js";
import { serveAds, isNewLearner, adsGloballyOn } from "../lib/ads-control.js";
import { getGameConfig } from "../lib/gameconfig.js";
import {
  legendaryStatus, startLegendary, finishLegendary, legendaryCount,
  tournamentStandings, ensureTournament, settleTournamentFinals, championBadges,
} from "../lib/elite.js";
import { buildSession, practiceSummary } from "../lib/practice.js";
import { onboardingStatus, dismissOnboarding, claimOnboarding, markGoalSet } from "../lib/onboarding.js";
import { buildPlacement, placementStatus, submitPlacement, skipPlacement, dismissPlacement, nextAdaptiveCard } from "../lib/placement.js";
import { getDaily as dxGetDaily, submitGuess as dxSubmitGuess } from "../lib/dxchallenge.js";
import { referralStatus, referralLeaderboard, qualifyReferral, recordShare, ensureCode } from "../lib/referral.js";
import {
  follow, unfollow, following, followers, searchLearners, friendStreaks, nudge,
  startFriendQuest, friendQuests, claimFriendQuest, getFeed, highFive, friendsLeaderboard,
  markFriendActivity, progressFriendQuests, postFeed,
} from "../lib/friends.js";

// feature-flag gate: 404 the feature cleanly when an admin turns it off
const flagGate = (key) => (req, res, next) => isEnabled(key) ? next() : res.status(403).json({ error: "feature disabled", flag: key });

const r = Router();
const learner = [authRequired, requireRole("learner")];
const L = (req) => ((req.query?.lang === "en" || req.body?.lang === "en") ? "en" : "fa");

function parseCardIds(raw) {
  try { return JSON.parse(raw || "[]").map(Number).filter(Boolean); } catch { return []; }
}
function liveCardCount(ids, activeSet) {
  if (!ids.length) return 0;
  if (activeSet) return ids.filter((id) => activeSet.has(id)).length;
  const ph = ids.map(() => "?").join(",");
  return db.prepare(`SELECT COUNT(*) n FROM flashcards WHERE active=1 AND id IN (${ph})`).get(...ids).n;
}
function nextPathNode(node) {
  return db.prepare(`SELECT id, title_fa, title_en FROM path_nodes
    WHERE topic_id=? AND active=1 AND (ord > ? OR (ord = ? AND id > ?))
      AND COALESCE(premium,0)=0
    ORDER BY ord, id LIMIT 1`).get(node.topic_id, node.ord, node.ord, node.id);
}
function rememberNode(userId, nodeId) {
  try {
    db.prepare("UPDATE learner_profiles SET last_node_id=? WHERE user_id=?").run(nodeId, userId);
    persistNow();
  } catch { /* column may be missing on a very old DB */ }
}

/* ---------------- profile / dashboard ---------------- */
r.get("/profile", ...learner, (req, res) => {
  const p = getProfile(req.user.id);
  maybeNudgePremiumRenewal(p);
  // surface Calm Mode flags so the HUD can hide the streak / soften pressure
  const calm = isEnabled("calm_mode") ? getCalmSettings(req.user.id) : null;
  res.json({ profile: p, tierLabel: TIER_LABEL, calm });
});

/* Home dashboard: profile + today progress + next lesson + top-of-league */
r.get("/home", ...learner, (req, res) => {
  const lang = L(req);
  const p = getProfile(req.user.id);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
  const todayXp = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM xp_events WHERE user_id=? AND day=?").get(req.user.id, today).s;
  const program = activeProgramFor(req.user.id);
  // scope node counts to the learner's active program's topics
  const progNodes = db.prepare(`SELECT COUNT(*) AS c FROM path_nodes pn
    JOIN topics t ON t.id = pn.topic_id WHERE pn.active=1 AND t.active=1 AND t.program=?`).get(program).c;
  const doneProg = db.prepare(`SELECT COUNT(*) AS c FROM node_progress np
    JOIN path_nodes pn ON pn.id = np.node_id JOIN topics t ON t.id = pn.topic_id
    WHERE np.user_id=? AND np.completed_at IS NOT NULL AND t.program=?`).get(req.user.id, program).c;
  const done = doneProg;
  const totalNodes = progNodes;
  const ads = serveAds({ userId: req.user.id, premium: p.premium_effective, isNew: isNewLearner(p), lang, slot: "home" });
  const country = countryRanking(req.user.id, lang, 3);
  const dueReviews = dueCount(req.user.id);
  // quest + chest teasers for the home
  const quests = getQuests(req.user.id);
  const questsClaimable = quests.filter((q) => q.progress >= q.goal && !q.claimed).length;
  const chestsReady = getChests(req.user.id).filter((c) => c.available).length;
  let resume = null;
  if (p.last_node_id) {
    const rn = db.prepare(`SELECT pn.id, pn.title_fa, pn.title_en, pn.topic_id, t.slug, t.name_fa, t.name_en
      FROM path_nodes pn JOIN topics t ON t.id = pn.topic_id
      WHERE pn.id=? AND pn.active=1 AND t.active=1`).get(p.last_node_id);
    if (rn) {
      resume = {
        nodeId: rn.id,
        title: lang === "en" ? (rn.title_en || rn.title_fa) : (rn.title_fa || rn.title_en),
        topic: lang === "fa" ? rn.name_fa : rn.name_en,
        slug: rn.slug,
      };
    }
  }
  res.json({ profile: p, todayXp, done, totalNodes, ads, topCountry: country.list, myRank: country.myRank,
    dueReviews, questsClaimable, chestsReady, tierLabel: TIER_LABEL,
    program, programLabel: programLabel(program, lang), programs: activePrograms(lang), resume });
});

/* ---------------- programs (Duolingo-style courses) ---------------- */
r.get("/programs", ...learner, (req, res) => {
  const lang = L(req);
  res.json({ programs: activePrograms(lang), active: activeProgramFor(req.user.id) });
});
r.post("/program", ...learner, (req, res) => {
  const out = setActiveProgram(req.user.id, req.body?.program);
  if (out.error) return res.status(400).json(out);
  persistNow();
  res.json({ ...out, label: programLabel(out.program, L(req)) });
});

/* ---------------- learning path map ---------------- */
r.get("/path", ...learner, (req, res) => {
  const lang = L(req);
  const program = activeProgramFor(req.user.id);
  const topics = db.prepare("SELECT * FROM topics WHERE active=1 AND program=? ORDER BY ord, id").all(program);
  const nodes = db.prepare("SELECT * FROM path_nodes WHERE active=1 ORDER BY topic_id, ord, id").all();
  const prog = db.prepare("SELECT node_id, stars, completed_at, legendary FROM node_progress WHERE user_id=?").all(req.user.id);
  const pmap = Object.fromEntries(prog.map((x) => [x.node_id, x]));
  const isPremium = !!getProfile(req.user.id).premium_effective;
  const activeCards = new Set(db.prepare("SELECT id FROM flashcards WHERE active=1").all().map((r) => r.id));
  const byTopic = {};
  for (const n of nodes) {
    const ids = parseCardIds(n.card_ids);
    const cardCount = liveCardCount(ids, activeCards);
    if (!cardCount) continue; // hide empty leftover nodes (deleted cards, demo purge)
    const pr = pmap[n.id];
    (byTopic[n.topic_id] ||= []).push({
      id: n.id, title: (lang === "en" ? (n.title_en || n.title_fa) : (n.title_fa || n.title_en)),
      // Explicit concept list so the learner knows exactly what a stage tests
      // before opening it.
      subtitle: (lang === "en" ? (n.subtitle_en || n.subtitle_fa) : (n.subtitle_fa || n.subtitle_en)) || "",
      ord: n.ord, kind: n.kind,
      xp: n.xp_reward, cards: cardCount, stars: pr?.stars || 0, done: !!pr?.completed_at,
      legendary: !!pr?.legendary, emoji: n.emoji || "",
      // Round 7: «تمرین بیشتر 👑» nodes are premium-only. They never gate the
      // sequence: the free core continues past them.
      premium: !!n.premium,
    });
  }
  // topics unlocked by the placement test (learner tested strong) → their
  // lessons aren't gated by sequence, so a knowledgeable learner can jump in.
  const plUnlocked = new Set(
    db.prepare("SELECT topic_id FROM placement_unlocks WHERE user_id=?").all(req.user.id).map((r) => r.topic_id)
  );
  // Round 9: topics unlocked by a passed «پرش از واحد» quiz behave the same way.
  for (const tid of jumpUnlockedTopics(req.user.id)) plUnlocked.add(tid);
  const jumpOk = jumpAllowed(getProfile(req.user.id));
  // unlock logic: a node is unlocked if it's the first, the previous node in the
  // topic is done, OR the whole topic was placement-unlocked.
  const out = topics.map((t) => {
    const list = (byTopic[t.id] || []);
    const openTopic = plUnlocked.has(t.id);
    // Sequence gating ignores premium extras (a free learner is never blocked
    // by a node they cannot open); a premium node is "premiumLocked" for
    // non-subscribers and opens the premium page on tap.
    let prevFreeDone = true;
    list.forEach((n) => {
      n.locked = openTopic ? false : !prevFreeDone;
      n.premiumLocked = n.premium && !isPremium;
      if (!n.premium) prevFreeDone = n.done;
    });
    const targetNodes = isPremium ? list : list.filter((n) => !n.premium);
    const total = targetNodes.length, dn = targetNodes.filter((n) => n.done).length;
    const topicEmoji = t.emoji || emojiForTopic(t.slug);
    // jump-ahead offer: ≥2 free stages still undone and not already unlocked
    const freeLeft = list.filter((n) => !n.premium && !n.done).length;
    const canJump = jumpOk && !openTopic && freeLeft >= 2;
    return {
      id: t.id, slug: t.slug, name: lang === "fa" ? t.name_fa : t.name_en, parent: t.parent,
      budget: t.budget, color: t.color, icon: t.icon, emoji: topicEmoji, nodes: list, total, done: dn, canJump,
    };
  });
  res.json({ topics: out });
});

/* ---------------- start a lesson (returns its cards) ---------------- */
r.get("/lesson/:nodeId", ...learner, (req, res) => {
  const lang = L(req);
  const node = db.prepare("SELECT * FROM path_nodes WHERE id=? AND active=1").get(req.params.nodeId);
  if (!node) return res.status(404).json({ error: "node not found" });
  const p = getProfile(req.user.id);
  if (node.premium && !p.premium_effective) return res.status(403).json({ error: "premium only", premiumRequired: true, premium: false });
  if (!p.premium_effective && p.hearts <= 0) return res.status(402).json({ error: "no hearts", hearts: 0 });
  rememberNode(req.user.id, node.id);
  const nodeIds = parseCardIds(node.card_ids);
  const ownSet = new Set(nodeIds);
  const requested = String(req.query.ids || "").split(",").map((x) => parseInt(x, 10)).filter(Boolean);
  const keepOrder = requested.length > 0;
  const rawIds = keepOrder ? requested : nodeIds;
  const ids = rawIds.filter((id) => {
    if (ownSet.has(id)) return true;
    const cRow = db.prepare("SELECT data_json FROM flashcards WHERE id=? AND active=1").get(id);
    if (!cRow) return false;
    try {
      const d = JSON.parse(cRow.data_json || "{}");
      return d.track === "learn";
    } catch {
      return false;
    }
  });
  let cards = ids.map((id) => db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id))
    .filter(Boolean)
    .map((c) => ({ ...serializeCard(c, lang), crowd: crowdForCard(c.id), hasHint: peerCfg().hint !== false && hasHint(c) }))
    .filter((c) => String(c.q || "").trim());
  cards = withOptionStats(cards);
  // Duolingo-style: present questions in a random order each attempt.
  // Language switch sends ?ids= so the same deck (and order) is restored.
  if (!keepOrder) {
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  }

  // --- Cumulative interleaving (medical): blend in a few DUE review cards from
  // OTHER already-studied topics in the SAME program. This is spaced retrieval
  // that forces discrimination between similar diseases/mechanisms. AI-free. ---
  try {
    const srsCfg = getGameConfig().srs || {};
    const maxReview = keepOrder ? 0 : (Number(srsCfg.interleave_max) || 0);
    if (maxReview > 0) {
      const program = activeProgramFor(req.user.id);
      const sameTopicOnly = srsCfg.interleave_same_topic !== false;
      // Build the precise set of card ids that belong to OTHER nodes.
      // Default: SAME topic only — a neurology lesson must never serve a
      // nephrology review card (that was a real English-path bug).
      const programCardIds = new Set();
      const otherNodes = db.prepare(`
        SELECT pn.card_ids FROM path_nodes pn
        JOIN topics t ON t.id = pn.topic_id
        WHERE t.program = ? AND pn.active = 1 AND pn.id <> ?
          ${sameTopicOnly ? "AND pn.topic_id = ?" : ""}`).all(
        ...(sameTopicOnly ? [program, node.id, node.topic_id] : [program, node.id])
      );
      for (const on of otherNodes) {
        try { JSON.parse(on.card_ids || "[]").forEach((cid) => programCardIds.add(cid)); } catch { /* */ }
      }
      // Due SRS cards for this learner, newest-forgetting first.
      const dueRows = db.prepare(`
        SELECT s.card_id FROM srs_state s
        JOIN flashcards f ON f.id = s.card_id AND f.active = 1
        WHERE s.user_id = ? AND s.due <= ?
        ORDER BY s.due ASC LIMIT 60`).all(req.user.id, tehranDay());
      const reviewCards = [];
      for (const r of dueRows) {
        const cid = r.card_id;
        if (ownSet.has(cid) || !programCardIds.has(cid)) continue;
        if (reviewCards.length >= maxReview) break;
        const c = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(cid);
        if (!c) continue;
        reviewCards.push({ ...serializeCard(c, lang), crowd: crowdForCard(c.id), review: true });
        ownSet.add(cid);
      }
      if (reviewCards.length) {
        if ((srsCfg.interleave_position || "spread") === "end") {
          cards = [...cards, ...reviewCards];
        } else {
          // spread: insert each review card at an interior position so the
          // learner must switch topics mid-lesson (true interleaving).
          for (const rc of reviewCards) {
            const pos = 1 + Math.floor(Math.random() * Math.max(1, cards.length));
            cards.splice(Math.min(pos, cards.length), 0, rc);
          }
        }
      }
    }
  } catch { /* interleaving is best-effort; never break the lesson */ }

  // --- Automatic difficulty calibration (Challenge Point Framework) ---
  // Reorder the deck so the learner eases in and then works inside their
  // optimal challenge zone (effortful but usually successful). Best-effort:
  // any failure just leaves the (already shuffled) order untouched. AI-free.
  let calibration = null;
  try {
    if (!keepOrder && isEnabled("calibration")) {
      const program = activeProgramFor(req.user.id);
      const out = calibrateLessonOrder(req.user.id, cards, program);
      cards = out.cards;
      calibration = out.calibration;
    }
  } catch { /* calibration is best-effort; never break the lesson */ }

  const prior = db.prepare("SELECT stars FROM node_progress WHERE user_id=? AND node_id=?").get(req.user.id, node.id);
  const nxt = nextPathNode(node, !!p.premium_effective);
  res.json({
    node: { id: node.id, title: lang === "en" ? (node.title_en || node.title_fa) : (node.title_fa || node.title_en),
      subtitle: lang === "en" ? (node.subtitle_en || node.subtitle_fa || "") : (node.subtitle_fa || node.subtitle_en || ""),
      xp: node.xp_reward, kind: node.kind, bestStars: prior?.stars || 0 },
    cards, hearts: p.hearts, premium: !!p.premium_effective, calibration,
    glossary: glossaryPayload(lang),
    nextNode: nxt ? { id: nxt.id, title: lang === "fa" ? nxt.title_fa : nxt.title_en } : null,
  });
});

/* Learner calibration snapshot: ability estimate + current challenge zone.
   Powers the medical guide/mascot and the progress dashboard. AI-free. */
r.get("/calibration", ...learner, (req, res) => {
  if (!isEnabled("calibration")) return res.json({ enabled: false });
  const program = activeProgramFor(req.user.id);
  res.json(calibrationSnapshot(req.user.id, program));
});

/* lose a heart on a wrong answer (server-authoritative energy) */
r.post("/heart/lose", ...learner, (req, res) => {
  const p = loseHeart(req.user.id);
  res.json({ hearts: p.hearts, premium: !!p.premium_effective });
});

/* finish a lesson: body { nodeId, correct, total } -> award XP, stars, streak */
r.post("/lesson/:nodeId/finish", ...learner, (req, res) => {
  const node = db.prepare("SELECT * FROM path_nodes WHERE id=? AND active=1").get(req.params.nodeId);
  if (!node) return res.status(404).json({ error: "node not found" });
  if (node.premium && !getProfile(req.user.id).premium_effective) return res.status(403).json({ error: "premium only", premiumRequired: true });
  // The client reports its own tally, so bound it by reality: a lesson has a
  // known card count and `correct` can never exceed `total`. Before this, a
  // direct POST with correct=1e6,total=1 credited millions of XP (ratio 1e6).
  let cardCount = 0;
  try { cardCount = JSON.parse(node.card_ids || "[]").length; } catch { cardCount = 0; }
  // A lesson may also serve up to `interleave_max` review cards from other
  // nodes, so the ceiling is the node's own cards plus that allowance.
  let interleave = 0;
  try { interleave = Math.max(0, Number(getGameConfig().srs?.interleave_max) || 0); } catch { interleave = 0; }
  let total = Math.max(1, parseInt(req.body?.total ?? 1, 10) || 1);
  if (cardCount > 0) total = Math.min(total, cardCount + interleave);
  const correct = Math.min(total, Math.max(0, parseInt(req.body?.correct ?? 0, 10) || 0));
  const ratio = correct / total;
  const stars = ratio >= 1 ? 5 : ratio >= 0.8 ? 4 : ratio >= 0.6 ? 3 : ratio >= 0.4 ? 2 : ratio > 0 ? 1 : 0;
  const baseXp = node.xp_reward;
  const perfectBonus = ratio >= 1 ? Math.round(baseXp * 0.5) : 0;
  const xp = Math.round(baseXp * Math.max(0.25, ratio)) + perfectBonus;

  const prior = db.prepare("SELECT * FROM node_progress WHERE user_id=? AND node_id=?").get(req.user.id, node.id);
  const bestStars = Math.max(prior?.stars || 0, stars);
  if (prior) {
    db.prepare("UPDATE node_progress SET stars=?, attempts=attempts+1, last_score=?, completed_at=COALESCE(completed_at, ?) WHERE id=?")
      .run(bestStars, Math.round(ratio * 100), stars > 0 ? new Date().toISOString() : prior.completed_at, prior.id);
  } else {
    db.prepare("INSERT INTO node_progress (user_id, node_id, stars, attempts, last_score, completed_at) VALUES (?,?,?,?,?,?)")
      .run(req.user.id, node.id, stars, 1, Math.round(ratio * 100), stars > 0 ? new Date().toISOString() : null);
  }
  // enter this lesson's cards into the spaced-repetition pipeline
  try { JSON.parse(node.card_ids || "[]").forEach((cid) => ensureTracked(req.user.id, cid)); } catch { /* */ }

  // Record per-card telemetry (correctness + response time) for analytics,
  // crowd difficulty and the mistakes hub. body.answers = [{cardId,correct,responseMs}]
  let errorReport = null;   // deterministic error-taxonomy for this lesson
  let srsAdded = 0;         // cards auto-pushed back into the review queue
  let confidence = null;    // confidence-based assessment summary for this lesson
  let newMastery = [];      // topic-mastery badges newly earned this lesson
  if (Array.isArray(req.body?.answers)) {
    const norm = req.body.answers.map((a) => ({
      cardId: parseInt(a.cardId, 10), nodeId: node.id,
      correct: !!a.correct, responseMs: parseInt(a.responseMs, 10) || 0,
      flagged: !!a.flagged, guessed: !!a.guessed, confidence: a.confidence | 0,
      sel: Number.isInteger(a.sel) ? a.sel : null, hintUsed: !!a.hintUsed,
    })).filter((a) => a.cardId);
    recordAnswers(req.user.id, norm);
    // Error taxonomy is computed AFTER recording so crowd stats include this run.
    errorReport = classifyErrors(norm);
    // UWorld×Anki bridge: every wrong card is scheduled to reappear soon.
    srsAdded = lapseWrongCards(req.user.id, norm);
    // Confidence-based assessment (only when the learner declared confidence).
    const cq = confidenceQuizScore(norm);
    if (cq.declared > 0) confidence = cq;
    // Topic Mastery Badges — grant any newly-earned mastery for the answered cards.
    if (isEnabled("mastery")) {
      try { newMastery = checkMasteryForCards(req.user.id, norm.map((a) => a.cardId)); } catch { /* never break finish */ }
    }
  }

  const profile = awardXp(req.user.id, xp, "lesson", node.id);
  const streakInfo = profile._streak || null;   // { incremented, usedFreeze, milestone }
  const tierUp = profile._tierUp || null;        // { from, to } when a tier promotion happened
  // Advance daily quests: XP earned, a lesson completed, and perfect lessons.
  progressQuests(req.user.id, "xp", xp);
  if (stars > 0) progressQuests(req.user.id, "lessons", 1);
  // Qualify a pending referral once the new friend completes their first lesson
  // (only matters when the admin set referral.qualify_on = "first_lesson").
  if (stars > 0 && isEnabled("referral") && getGameConfig().referral?.qualify_on === "first_lesson") {
    try { qualifyReferral(req.user.id); } catch { /* ignore */ }
  }
  if (ratio >= 1) progressQuests(req.user.id, "perfect", 1);
  // Settle any active Streak Wager now that the streak has moved.
  const wager = settleWagers(req.user.id);
  if (wager?.result === "won") {
    notify(req.user.id, {
      kind: "streak", icon: "gem", link: "quests",
      title_fa: "🎉 شرط استریک را بردی!", title_en: "🎉 You won your Streak Wager!",
      body_fa: `+${wager.reward} جم به کیف پول تو اضافه شد.`, body_en: `+${wager.reward} gems added to your wallet.`,
    });
  }
  // Friend system: mark today's activity (advances shared friend streaks),
  // progress any weekly friend quests, and post feed events friends can high-five.
  if (isEnabled("friends")) {
    try {
      markFriendActivity(req.user.id);
      progressFriendQuests(req.user.id, xp);
      // milestone feed events (de-duped per day inside postFeed)
      if (ratio >= 1) postFeed(req.user.id, "perfect_day", "یک درس بی‌نقص زد ⭐", "aced a perfect lesson ⭐", "star");
      if (streakInfo?.milestone) postFeed(req.user.id, "streak", `به استریک ${streakInfo.milestone.days} روزه رسید 🔥`, `hit a ${streakInfo.milestone.days}-day streak 🔥`, "flame");
    } catch { /* never break the lesson flow */ }
  }
  const unlocked = checkAchievements(req.user.id);
  for (const a of unlocked) {
    notify(req.user.id, {
      kind: "achievement", icon: a.icon || "medal", link: "achievements",
      title_fa: "🎖️ دستاورد جدید!", title_en: "🎖️ New achievement!",
      body_fa: a.name_fa, body_en: a.name_en,
    });
  }
  // Notify + celebrate a Streak Society milestone (identity + reward chest).
  if (streakInfo?.milestone) {
    notify(req.user.id, {
      kind: "streak", icon: "flame", link: "home",
      title_fa: `🔥 ${streakInfo.milestone.days} روز استریک!`, title_en: `🔥 ${streakInfo.milestone.days}-day streak!`,
      body_fa: `عضو باشگاه استریک شدی: +${streakInfo.milestone.gems} جم و ${streakInfo.milestone.freezes} محافظ استریک.`,
      body_en: `Streak Society: +${streakInfo.milestone.gems} gems and ${streakInfo.milestone.freezes} streak freezes.`,
    });
  }
  // Round 9 (Duolingo Super-style): a taste of premium at big streak milestones.
  let premiumTrial = null;
  if (streakInfo?.incremented || streakInfo?.milestone) {
    try {
      const tr = checkStreakTrial(req.user.id, profile.streak);
      if (tr) {
        applyPremiumDays(req.user.id, tr.days, { source: "streak_trial" });
        premiumTrial = tr;
        notify(req.user.id, {
          kind: "premium", icon: "crown", link: "premium",
          title_fa: `👑 ${tr.days} روز پرمیوم هدیه!`, title_en: `👑 ${tr.days} free premium days!`,
          body_fa: `به‌خاطر استریک ${tr.milestone} روزه، ${tr.days} روز همهٔ امکانات پرمیوم برایت باز شد.`,
          body_en: `Your ${tr.milestone}-day streak unlocked ${tr.days} days of every premium feature.`,
        });
      }
    } catch { /* never block the lesson */ }
  }
  // Auto-issue a completion certificate if this lesson finished the program.
  let certSerial = null;
  if (isEnabled("certificates")) {
    try {
      certSerial = maybeAutoIssueProgram(req.user.id);
      if (certSerial) {
        notify(req.user.id, {
          kind: "system", icon: "medal", link: "certificates",
          title_fa: "🎓 گواهی‌نامهٔ پایان دوره صادر شد!", title_en: "🎓 Your completion certificate is ready!",
          body_fa: "دوره‌ات را کامل کردی. گواهی‌نامهٔ قابل‌استعلام‌ات را ببین و به اشتراک بگذار.",
          body_en: "You finished the program. View and share your verifiable certificate.",
        });
      }
    } catch { /* never break the lesson flow */ }
  }
  // Celebrate a tier promotion (a real "level up") in the notification center.
  if (tierUp) {
    notify(req.user.id, {
      kind: "system", icon: "trophy", link: "home",
      title_fa: "🏆 ارتقای رتبه!", title_en: "🏆 Rank up!",
      body_fa: `به رتبهٔ ${TIER_LABEL[tierUp.to]?.fa || tierUp.to} رسیدی!`,
      body_en: `You reached the ${TIER_LABEL[tierUp.to]?.en || tierUp.to} tier!`,
    });
  }
  // Celebrate any newly-earned Topic Mastery badge (real mastery-learning win).
  for (const b of newMastery) {
    notify(req.user.id, {
      kind: "achievement", icon: "medal", link: "mastery",
      title_fa: "🏅 تسلط بر مبحث!", title_en: "🏅 Topic mastered!",
      body_fa: `به تسلط بر «${b.name_fa || b.name_en}» رسیدی (${b.accuracy}٪ دقت پایدار). +${b.reward_xp} XP و +${b.reward_gems} جم.`,
      body_en: `You mastered "${b.name_en || b.name_fa}" (${b.accuracy}% durable accuracy). +${b.reward_xp} XP and +${b.reward_gems} gems.`,
    });
  }
  persistNow();
  const profile2 = (newMastery.length || premiumTrial) ? getProfile(req.user.id) : profile;   // reflect mastery gems / trial
  const lang = L(req);
  let summary = null;
  try { summary = lessonSummary(node.id, lang); } catch { /* */ }
  const nextRow = nextPathNode(node, !!profile2.premium_effective);
  if (nextRow) rememberNode(req.user.id, nextRow.id);
  res.json({
    xp, stars, profile: profile2, unlocked, tierLabel: TIER_LABEL, streak: streakInfo, tierUp, wager, certificate: certSerial, errorReport, srsAdded, confidence, newMastery, premiumTrial,
    summary, nextNode: nextRow ? { id: nextRow.id, title: lang === "fa" ? nextRow.title_fa : nextRow.title_en } : null,
  });
});

/* ---------------- certificates (course/program completion) ---------------- */
// My earned certificates + progress toward the next one.
r.get("/certificates", ...learner, flagGate("certificates"), (req, res) => {
  if (!isEnabled("certificates")) return res.json({ enabled: false, certificates: [], progress: [] });
  const lang = req.query.lang === "en" ? "en" : "fa";
  res.json({ enabled: true, certificates: myCertificates(req.user.id, lang), progress: certProgress(req.user.id, lang) });
});
// Claim a certificate the learner is eligible for (idempotent).
r.post("/certificates/claim", ...learner, (req, res) => {
  if (!isEnabled("certificates")) return res.status(403).json({ error: "disabled" });
  const kind = req.body?.kind === "course" ? "course" : "program";
  const out = issueCertificate({ userId: req.user.id, kind, courseId: req.body?.courseId || null });
  res.status(out.ok ? 200 : 400).json(out);
});

/* ---------------- section Checkpoint exams (shelf-exam style) ---------------- */
// List every section in the active program with unlock status + best score.
r.get("/checkpoints", ...learner, flagGate("checkpoint"), (req, res) => {
  res.json(listCheckpoints(req.user.id, L(req)));
});
// Build a fresh mixed exam for one section (fails with a reason if locked).
r.get("/checkpoint/:section", ...learner, flagGate("checkpoint"), (req, res) => {
  const out = buildCheckpoint(req.user.id, req.params.section, L(req));
  if (out?.error) {
    const code = out.error === "locked" ? 403 : out.error === "cooldown" ? 429 : out.error === "unknown section" ? 404 : 400;
    return res.status(code).json(out);
  }
  res.json(out);
});
// Finish a checkpoint: record the result, award XP, advance quests & achievements.
r.post("/checkpoint/:section/finish", ...learner, flagGate("checkpoint"), (req, res) => {
  // A result may only be recorded for a section the learner could actually
  // open (unlocked, known, not disabled) — the same gate GET /checkpoint uses.
  // Cooldown is deliberately not re-checked here: the exam was built before it.
  const gate = checkpointGate(req.user.id, req.params.section);
  if (gate?.error) {
    const code = gate.error === "locked" ? 403 : gate.error === "unknown section" ? 404 : 400;
    return res.status(code).json(gate);
  }
  const out = finishCheckpoint(req.user.id, req.params.section, {
    correct: req.body?.correct, total: req.body?.total, durationMs: req.body?.durationMs,
  });
  // Feed the answered cards into the SRS pipeline + per-card telemetry, exactly
  // like a lesson, so a checkpoint also strengthens spaced repetition.
  let cpErrorReport = null, cpSrsAdded = 0, cpNewMastery = [];
  if (Array.isArray(req.body?.answers)) {
    for (const a of req.body.answers) { try { ensureTracked(req.user.id, parseInt(a.cardId, 10)); } catch { /* */ } }
    const norm = req.body.answers.map((a) => ({
      cardId: parseInt(a.cardId, 10), nodeId: null,
      correct: !!a.correct, responseMs: parseInt(a.responseMs, 10) || 0,
      flagged: !!a.flagged, guessed: !!a.guessed,
    })).filter((a) => a.cardId);
    recordAnswers(req.user.id, norm);
    cpErrorReport = classifyErrors(norm);
    cpSrsAdded = lapseWrongCards(req.user.id, norm);
    if (isEnabled("mastery")) {
      try { cpNewMastery = checkMasteryForCards(req.user.id, norm.map((a) => a.cardId)); } catch { /* */ }
    }
  }
  const profile = awardXp(req.user.id, out.xp, "checkpoint", null);
  progressQuests(req.user.id, "xp", out.xp);
  const unlocked = checkAchievements(req.user.id);
  for (const a of unlocked) {
    notify(req.user.id, {
      kind: "achievement", icon: a.icon || "medal", link: "achievements",
      title_fa: "🎖️ دستاورد جدید!", title_en: "🎖️ New achievement!",
      body_fa: a.name_fa, body_en: a.name_en,
    });
  }
  if (out.passed) {
    notify(req.user.id, {
      kind: "system", icon: "medal", link: "checkpoint",
      title_fa: `✅ آزمون Checkpoint «${out.label}» را قبول شدی!`, title_en: "✅ Checkpoint passed!",
      body_fa: `نمرهٔ تو: ${out.score}٪ (حد قبولی ${out.passPct}٪). +${out.xp} XP`,
      body_en: `Your score: ${out.score}% (pass ${out.passPct}%). +${out.xp} XP`,
    });
  }
  for (const b of cpNewMastery) {
    notify(req.user.id, {
      kind: "achievement", icon: "medal", link: "mastery",
      title_fa: "🏅 تسلط بر مبحث!", title_en: "🏅 Topic mastered!",
      body_fa: `به تسلط بر «${b.name_fa || b.name_en}» رسیدی. +${b.reward_xp} XP و +${b.reward_gems} جم.`,
      body_en: `You mastered "${b.name_en || b.name_fa}". +${b.reward_xp} XP and +${b.reward_gems} gems.`,
    });
  }
  persistNow();
  const cpProfile = cpNewMastery.length ? getProfile(req.user.id) : profile;
  res.json({ ...out, profile: cpProfile, unlocked, errorReport: cpErrorReport, srsAdded: cpSrsAdded, newMastery: cpNewMastery });
});

/* ---------------- hearts refill (gems) ---------------- */
r.post("/hearts/refill", ...learner, (req, res) => {
  const p = getProfile(req.user.id);
  const cost = heartRefillGems();
  if (!p.premium_effective && p.gems < cost) return res.status(402).json({ error: "not enough gems", gems: p.gems });
  const np = refillHearts(req.user.id, p.premium_effective ? 0 : cost);
  res.json({ profile: np });
});

/* ---------------- league (weekly) ---------------- */
r.get("/league", ...learner, flagGate("leagues"), (req, res) => {
  // Calm Mode: a learner who opted out of competition isn't placed in a league.
  if (isEnabled("calm_mode") && calmOptOutLeagues(req.user.id)) {
    return res.json({ optedOut: true, members: [] });
  }
  res.json(getLeague(req.user.id, L(req)));
});

/* ---------------- country / province ranking ---------------- */
r.get("/ranking", ...learner, flagGate("ranking"), (req, res) => {
  res.json(countryRanking(req.user.id, L(req), 100));
});
r.get("/ranking/province", ...learner, flagGate("ranking"), (req, res) => {
  res.json(provinceRanking(req.user.id, L(req), 100));
});

/* ---------------- achievements ---------------- */
r.get("/achievements", ...learner, flagGate("achievements"), (req, res) => {
  const lang = L(req);
  checkAchievements(req.user.id);
  const rows = db.prepare(`
    SELECT a.*, ua.progress, ua.unlocked_at FROM achievements a
    LEFT JOIN user_achievements ua ON ua.achievement_id=a.id AND ua.user_id=?
    ORDER BY a.ord, a.id`).all(req.user.id);
  res.json({
    achievements: rows.map((a) => ({
      slug: a.slug, name: lang === "fa" ? a.name_fa : a.name_en,
      desc: lang === "fa" ? a.desc_fa : a.desc_en, icon: a.icon,
      metric: a.metric, threshold: a.threshold, progress: a.progress || 0, unlocked: !!a.unlocked_at,
    })),
  });
});

/* ---------------- daily goal ---------------- */
r.get("/daily", ...learner, (req, res) => {
  const p = getProfile(req.user.id);
  res.json({ goal: p.daily_goal || 30, today: todayXp(req.user.id), options: DAILY_GOALS });
});
r.post("/daily/goal", ...learner, (req, res) => {
  const profile = setDailyGoal(req.user.id, parseInt(req.body?.value, 10) || 30);
  markGoalSet(req.user.id);   // ticks the onboarding "set your daily goal" step
  res.json({ profile });
});

/* First-time welcome flow: mark the one-time welcome modal as seen. */
r.post("/welcome/seen", ...learner, (req, res) => {
  db.prepare("UPDATE learner_profiles SET welcome_seen=1 WHERE user_id=?").run(req.user.id);
  persistNow();
  res.json({ ok: true });
});

/* ---------------- onboarding checklist (getting started) ---------------- */
r.get("/onboarding", ...learner, flagGate("onboarding"), (req, res) => {
  res.json(onboardingStatus(req.user.id, L(req)));
});
r.post("/onboarding/dismiss", ...learner, flagGate("onboarding"), (req, res) => {
  dismissOnboarding(req.user.id);
  res.json({ ok: true });
});
r.post("/onboarding/claim", ...learner, flagGate("onboarding"), (req, res) => {
  const r2 = claimOnboarding(req.user.id);
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});

/* ---------------- placement test (entry quiz) ---------------- */
r.get("/placement", ...learner, flagGate("placement"), (req, res) => {
  res.json(placementStatus(req.user.id, L(req)));
});
r.get("/placement/start", ...learner, flagGate("placement"), (req, res) => {
  const cards = buildPlacement(req.user.id, L(req));
  if (!cards.length) return res.status(400).json({ error: "no cards" });
  res.json({ cards });
});
// Adaptive: get the next question given the client-tracked answer history.
// body.history = [{ cardId, topicSlug, correct, difficulty }]
r.post("/placement/next", ...learner, flagGate("placement"), (req, res) => {
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  res.json(nextAdaptiveCard(req.user.id, L(req), history));
});
r.post("/placement/submit", ...learner, flagGate("placement"), (req, res) => {
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const result = submitPlacement(req.user.id, answers, L(req));
  res.json({ result });
});
r.post("/placement/skip", ...learner, flagGate("placement"), (req, res) => {
  skipPlacement(req.user.id);
  res.json({ ok: true });
});
r.post("/placement/dismiss", ...learner, flagGate("placement"), (req, res) => {
  dismissPlacement(req.user.id);
  res.json({ ok: true });
});

/* ---------------- Daily Diagnosis Challenge (Wordle-style) ---------------- */
r.get("/dx/daily", ...learner, flagGate("dx_challenge"), (req, res) => {
  res.json(dxGetDaily(req.user.id, L(req)));
});
r.post("/dx/guess", ...learner, flagGate("dx_challenge"), (req, res) => {
  const caseId = parseInt(req.body?.caseId, 10);
  const guess = String(req.body?.guess || "");
  const view = dxSubmitGuess(req.user.id, caseId, guess, L(req));
  if (view?.error) return res.status(404).json(view);
  res.json(view);
});

/* ---------------- Referral (invite a friend) ---------------- */
r.get("/referral", ...learner, flagGate("referral"), (req, res) => {
  res.json(referralStatus(req.user.id, L(req)));
});
r.get("/referral/leaderboard", ...learner, flagGate("referral"), (req, res) => {
  res.json({ leaders: referralLeaderboard(L(req), 20) });
});

/* ---------------- Social sharing (share-to-earn + config for story cards) ---------------- */
r.get("/social/config", ...learner, (req, res) => {
  const cfg = getGameConfig().social || {};
  res.json({
    enabled: !!(cfg.enabled && isEnabled("social_share")),
    brandTag: cfg.brand_tag || "", siteUrl: cfg.site_url || "",
    rewardGems: cfg.reward_gems || 0, dailyCap: cfg.daily_reward_cap || 0,
    inviteCode: isEnabled("referral") ? ensureCode(req.user.id) : null,
  });
});
r.post("/social/share", ...learner, (req, res) => {
  if (!isEnabled("social_share")) return res.status(403).json({ error: "disabled" });
  const result = recordShare(req.user.id, req.body?.kind || "generic", req.body?.channel || "copy");
  res.json(result);
});

/* ---------------- daily quests ---------------- */
r.get("/quests", ...learner, flagGate("quests"), (req, res) => {
  const lang = L(req);
  const labels = {
    xp: { fa: "امتیاز جمع کن", en: "Earn XP" },
    lessons: { fa: "درس کامل کن", en: "Complete lessons" },
    perfect: { fa: "درس بی‌نقص بزن", en: "Perfect lessons" },
    review: { fa: "کارت مرور کن", en: "Review cards" },
  };
  const icons = { xp: "medal", lessons: "book", perfect: "star", review: "repeat" };
  const quests = getQuests(req.user.id).map((q) => ({
    id: q.id, slug: q.slug, goal: q.goal, progress: q.progress, reward_gems: q.reward_gems,
    claimed: !!q.claimed, done: q.progress >= q.goal,
    label: lang === "fa" ? labels[q.slug]?.fa : labels[q.slug]?.en, icon: icons[q.slug] || "target",
  }));
  res.json({ quests });
});
r.post("/quests/:id/claim", ...learner, flagGate("quests"), (req, res) => {
  const r2 = claimQuest(req.user.id, parseInt(req.params.id, 10));
  if (!r2.ok) return res.status(400).json({ error: "cannot claim" });
  // A completed daily quest counts toward the monthly quest → badge.
  bumpMonthly(req.user.id);
  res.json({ ...r2, monthly: monthlyStatus(req.user.id) });
});

/* ---------------- Streak Wager (stake gems, commit to N days, double back) ---------------- */
r.get("/wager", ...learner, flagGate("streak_wager"), (req, res) => {
  res.json(wagerStatus(req.user.id));
});
r.post("/wager", ...learner, flagGate("streak_wager"), (req, res) => {
  const r2 = placeWager(req.user.id);
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});

/* ---------------- Monthly Quest → collectible badge ---------------- */
r.get("/monthly", ...learner, flagGate("monthly_quest"), (req, res) => {
  res.json({ monthly: monthlyStatus(req.user.id), badges: getBadges(req.user.id) });
});
r.post("/monthly/claim", ...learner, flagGate("monthly_quest"), (req, res) => {
  const r2 = claimMonthly(req.user.id);
  if (!r2.ok) return res.status(400).json({ error: "cannot claim" });
  res.json(r2);
});

/* ---------------- XP Ramp-Up timed challenge event ---------------- */
r.get("/event", ...learner, flagGate("ramp_event"), (req, res) => {
  const lang = L(req);
  const def = eventDef();
  res.json({
    enabled: def.enabled, slug: def.slug,
    title: lang === "fa" ? def.title_fa : def.title_en,
    questions: def.questions, duration_s: def.duration_s,
    xp_per_correct: def.xp_per_correct, bonus_all_correct: def.bonus_all_correct,
  });
});
r.post("/event/start", ...learner, flagGate("ramp_event"), (req, res) => {
  const def = eventDef();
  if (!def.enabled) return res.status(403).json({ error: "disabled" });
  // Build a card pool from the learner's active program's lessons.
  const program = activeProgramFor(req.user.id);
  const nodes = db.prepare(`
    SELECT pn.card_ids FROM path_nodes pn JOIN topics t ON t.id = pn.topic_id
    WHERE pn.active=1 AND t.active=1 AND t.program=?`).all(program);
  let pool = [];
  for (const n of nodes) { try { pool.push(...JSON.parse(n.card_ids || "[]")); } catch { /* */ } }
  pool = [...new Set(pool)];
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const ids = pool.slice(0, def.questions);
  if (!ids.length) return res.status(400).json({ error: "no cards" });
  const started = startEvent(req.user.id, ids);
  // serialize the cards for the client (same shape lessons use)
  const cards = ids.map((cid) => {
    const c = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(cid);
    return c ? serializeCard(c, L(req)) : null;
  }).filter(Boolean);
  res.json({ runId: started.runId, duration_s: started.duration_s, cards });
});
r.post("/event/:id/finish", ...learner, flagGate("ramp_event"), (req, res) => {
  const r2 = finishEvent(req.user.id, parseInt(req.params.id, 10), req.body?.correct);
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});

/* ---------------- Streak Revival (free comeback for lapsed learners) ---------------- */
r.get("/revival", ...learner, flagGate("streak_revival"), (req, res) => {
  res.json(revivalStatus(req.user.id));
});
r.post("/revival/claim", ...learner, flagGate("streak_revival"), (req, res) => {
  const r2 = claimRevival(req.user.id);
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});

/* ---------------- Friends / social system ---------------- */
// overview: friends list, friend streaks, friend quests, feed, leaderboard
r.get("/friends", ...learner, flagGate("friends"), (req, res) => {
  const lang = L(req);
  res.json({
    following: following(req.user.id, lang),
    followers: followers(req.user.id, lang),
    streaks: friendStreaks(req.user.id, lang),
    quests: friendQuests(req.user.id, lang),
    leaderboard: friendsLeaderboard(req.user.id, lang),
  });
});
r.get("/friends/search", ...learner, flagGate("friends"), (req, res) => {
  res.json({ results: searchLearners(req.user.id, String(req.query.q || ""), L(req)) });
});
r.post("/friends/follow/:id", ...learner, flagGate("friends"), (req, res) => {
  const r2 = follow(req.user.id, parseInt(req.params.id, 10));
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});
r.post("/friends/unfollow/:id", ...learner, flagGate("friends"), (req, res) => {
  res.json(unfollow(req.user.id, parseInt(req.params.id, 10)));
});
r.post("/friends/nudge/:id", ...learner, flagGate("friends"), (req, res) => {
  const r2 = nudge(req.user.id, parseInt(req.params.id, 10), L(req));
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});
r.post("/friends/quest/:id", ...learner, flagGate("friends"), (req, res) => {
  const r2 = startFriendQuest(req.user.id, parseInt(req.params.id, 10));
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});
r.post("/friends/quest/:id/claim", ...learner, flagGate("friends"), (req, res) => {
  // :id here is the friend_quests row id
  const r2 = claimFriendQuest(req.user.id, parseInt(req.params.id, 10));
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});
r.get("/friends/feed", ...learner, flagGate("friends"), (req, res) => {
  res.json({ feed: getFeed(req.user.id, L(req)) });
});
r.post("/friends/feed/:id/highfive", ...learner, flagGate("friends"), (req, res) => {
  const r2 = highFive(req.user.id, parseInt(req.params.id, 10), L(req));
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});

/* ---------------- Legendary levels (crown 6) ---------------- */
r.get("/legendary/:nodeId", ...learner, flagGate("legendary"), (req, res) => {
  res.json(legendaryStatus(req.user.id, parseInt(req.params.nodeId, 10)));
});
// begin a legendary run: charges gems (free for premium), returns the harder card set
r.post("/legendary/:nodeId/start", ...learner, flagGate("legendary"), (req, res) => {
  const nodeId = parseInt(req.params.nodeId, 10);
  const node = db.prepare("SELECT * FROM path_nodes WHERE id=? AND active=1").get(nodeId);
  if (!node) return res.status(404).json({ error: "node not found" });
  const r2 = startLegendary(req.user.id, nodeId);
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  const lang = L(req);
  let ids = []; try { ids = JSON.parse(node.card_ids || "[]"); } catch { ids = []; }
  let cards = ids.map((id) => db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id))
    .filter(Boolean).map((c) => serializeCard(c, lang));
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  res.json({ ok: true, cards, node: { id: node.id, title: lang === "fa" ? node.title_fa : node.title_en } });
});
r.post("/legendary/:nodeId/finish", ...learner, flagGate("legendary"), (req, res) => {
  const r2 = finishLegendary(req.user.id, parseInt(req.params.nodeId, 10), req.body?.correct, req.body?.total);
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});

/* ---------------- Diamond Tournament ---------------- */
r.get("/tournament", ...learner, flagGate("leagues"), (req, res) => {
  res.json(tournamentStandings(req.user.id, L(req)));
});
// dev/admin trigger to settle the current finals room (also safe to call anytime)
r.post("/tournament/settle", ...learner, flagGate("leagues"), (req, res) => {
  const leagueId = ensureTournament(req.user.id);
  if (!leagueId) return res.status(400).json({ error: "not in tournament" });
  res.json(settleTournamentFinals(leagueId));
});

/* ---------------- Smart Practice Hub (targeted weak-area sessions) ---------------- */
// landing summary: what's available + weak-topic report
r.get("/practice", ...learner, flagGate("smart_practice"), (req, res) => {
  res.json(practiceSummary(req.user.id, L(req)));
});
// build + start a targeted session (returns serialized cards with a source tag)
r.post("/practice/start", ...learner, flagGate("smart_practice"), (req, res) => {
  const lang = L(req);
  const { cardIds, sources } = buildSession(req.user.id);
  if (!cardIds.length) return res.status(400).json({ error: "no data" });
  const cards = cardIds.map((id) => {
    const c = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id);
    if (!c) return null;
    return { ...serializeCard(c, lang), source: sources[id] || "weak", crowd: crowdForCard(c.id) };
  }).filter(Boolean);
  res.json({ cards, count: cards.length });
});
// grade a practice answer (records telemetry + SRS + small XP + quest progress)
r.post("/practice/answer", ...learner, flagGate("smart_practice"), (req, res) => {
  const cardId = parseInt(req.body?.cardId, 10);
  const correct = !!req.body?.correct;
  const responseMs = parseInt(req.body?.responseMs, 10) || 0;
  if (!cardId) return res.status(400).json({ error: "no card" });
  recordAnswers(req.user.id, [{ cardId, nodeId: null, correct, responseMs, sel: Number.isInteger(req.body?.sel) ? req.body.sel : null }]);
  // feed the spaced-repetition scheduler too (a review counts as a review quest)
  try { srsReview(req.user.id, cardId, correct ? 3 : 1); } catch { /* card may not be tracked */ }
  progressQuests(req.user.id, "review", 1);
  let profile = getProfile(req.user.id);
  if (correct) {
    const xp = getGameConfig().practice.xp_per_correct;
    profile = awardXp(req.user.id, xp, "practice", cardId);
  }
  res.json({ profile });
});

/* ---------------- timed daily chests ---------------- */
r.get("/chests", ...learner, (req, res) => {
  const lang = L(req);
  const chests = getChests(req.user.id).map((c) => ({
    slug: c.slug, name: lang === "fa" ? c.fa : c.en, gems: c.gems, opened: c.opened, available: c.available,
    from: c.from, to: c.to,
  }));
  res.json({ chests });
});
r.post("/chests/:slug/open", ...learner, (req, res) => {
  const r2 = openChest(req.user.id, req.params.slug);
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});

/* ---------------- gem shop / powerups ---------------- */
r.get("/shop", ...learner, (req, res) => {
  const lang = L(req);
  const p = getProfile(req.user.id);
  res.json({
    gems: p.gems, freezes: p.freezes, timer_boosts: p.timer_boosts || 0,
    xp_boost_until: p.xp_boost_until,
    items: SHOP.map((s) => ({ slug: s.slug, cost: s.cost, icon: s.icon,
      name: lang === "fa" ? s.fa : s.en, desc: lang === "fa" ? s.descFa : s.descEn })),
  });
});
r.post("/shop/buy", ...learner, (req, res) => {
  const r2 = buyItem(req.user.id, String(req.body?.slug || ""));
  if (!r2.ok) return res.status(400).json({ error: r2.error });
  res.json(r2);
});

/* ---------------- streak calendar + personal records ---------------- */
r.get("/streak", ...learner, (req, res) => {
  res.json({
    days: streakCalendar(req.user.id, 35),
    records: personalRecords(req.user.id),
    status: streakStatus(req.user.id),
    society: STREAK_SOCIETY,
  });
});

/* ---------------- premium card library (categorized, outside the path) ----------------
   A promised premium benefit: licensed admin cards shown to premium users,
   grouped by category, independent of the learning path. */
// ---------------------------------------------------------------------------
// Question browser (learner-facing faceted search)
// ---------------------------------------------------------------------------
// Learners get the same classification the admin has: pick a subject, then a
// chapter, then narrow by exam year / sitting / question style — and combine
// them freely. Facet counts come back with the list so the UI can show how
// many questions each option would yield and hide the empty ones.
//
// Demo/seeded sample cards are excluded by default: once a subject has real
// past-exam questions, practising on invented ones is actively misleading.
// Browse re-reads and re-parses every learn card on each request, which is the
// single most expensive thing this route does once the bank passes a few
// hundred questions. The parsed pool only changes when a card is written, so we
// memoise it behind a cheap signature (row count + newest write + max id) taken
// straight from SQLite. Any create, edit, import or activity toggle bumps one of
// those three, so the cache invalidates itself without needing hooks anywhere.
let browsePoolCache = { sig: null, all: null };

function browsePool() {
  const s = db.prepare(
    `SELECT COUNT(*) AS n,
            COALESCE(MAX(COALESCE(content_updated_at, updated_at)), '') AS t,
            COALESCE(MAX(id), 0) AS m,
            COALESCE(SUM(revision), 0) AS r
       FROM flashcards WHERE active=1`
  ).get();
  const sig = `${s.n}|${s.t}|${s.m}|${s.r}`;
  if (browsePoolCache.sig === sig) return browsePoolCache.all;

  // Extract only the handful of fields the list needs INSIDE SQLite instead of
  // JSON.parse-ing every full card in JS. Parsing 11 000+ cards (options,
  // explanations, micro-lessons, sources — ~50 MB of JSON) allocated ~250 MB
  // of V8 heap that the runtime never handed back to the OS: the process sat
  // at ~400 MB RSS on a 1 GB cPanel plan. Now the pool costs ~15 MB.
  const rows = db.prepare(
    `SELECT id, difficulty, created_at, content_updated_at, updated_at, revision,
            json_extract(data_json, '$.q_fa') AS q_fa,
            json_extract(data_json, '$.q_en') AS q_en,
            json_extract(data_json, '$.title_fa') AS title_fa,
            json_extract(data_json, '$.title_en') AS title_en,
            json_extract(data_json, '$.premium') AS premium,
            json_extract(data_json, '$.topic') AS topic,
            json_extract(data_json, '$.difficulty') AS d_difficulty,
            json_extract(data_json, '$.content_origin') AS content_origin,
            json_extract(data_json, '$.source_meta') AS source_meta,
            (SELECT group_concat(COALESCE(json_extract(o.value,'$.fa'),'') || ' ' || COALESCE(json_extract(o.value,'$.en'),''), ' ')
               FROM json_each(COALESCE(json_extract(data_json,'$.options'), '[]')) o) AS opts_text
       FROM flashcards
      WHERE active=1 AND json_valid(data_json) AND json_extract(data_json, '$.track') = 'learn'`
  ).all();
  const all = [];
  for (const c of rows) {
    let sm = {};
    if (c.source_meta) { try { sm = JSON.parse(c.source_meta) || {}; } catch { sm = {}; } }
    const d = { source_meta: sm, content_origin: c.content_origin || undefined, difficulty: c.d_difficulty || undefined };
    const facets = cardFacets(d, { ...c, updated_at: c.content_updated_at || c.updated_at });
    // Pre-lowercase the searchable stem once instead of rebuilding and
    // lowercasing it for every card on every keystroke.
    // Normalised once (ی/ک/ه, digits, ZWNJ, diacritics) so every keystroke is
    // a plain indexOf over pre-cleaned text; `extra` = weaker fields.
    const hay = normalizeText(`${c.q_fa || ""} ${c.q_en || ""} ${c.title_fa || ""} ${c.title_en || ""}`);
    const extra = normalizeText(`${sm.chapter_fa || ""} ${sm.chapter_en || ""} ${sm.concept_fa || ""} ${sm.concept_en || ""} ${c.opts_text || ""}`);
    const data = { q_fa: c.q_fa || "", q_en: c.q_en || "", title_fa: c.title_fa || "", title_en: c.title_en || "", topic: c.topic || "" };
    all.push({ id: c.id, facets, premium: c.premium === 1 || c.premium === true || c.premium === "true", data, hay, extra });
  }
  browsePoolCache = { sig, all };
  return all;
}

/* The three premium cards a non-subscriber is allowed to preview. Computed
 * from the global newest-exam ordering so the list page and the detail route
 * agree no matter which filters the learner applied. */
function lockedTeaserIds(pool = browsePool()) {
  // Round 5: there is no premium question tier any more — every path
  // question is free to LEARN on the path. Browsing/searching the whole bank
  // is the premium perk, so non-subscribers preview the three newest cards.
  return sortCards(pool.filter((c) => !c.facets.demo), "newest_exam")
    .slice(0, 3).map((c) => c.id);
}

r.get("/browse", ...learner, flagGate("bank_browse"), (req, res) => {
  const lang = L(req);
  const q = req.query || {};
  const p = getProfile(req.user.id);
  const bankLocked = isEnabled("full_bank") && !p.premium_effective;
  const all = browsePool();

  // Default view = real exam questions only. `includeDemo=1` is available for
  // completeness but is never the default.
  const pool = q.includeDemo === "1" ? all : all.filter((c) => !c.facets.demo);

  const asList = (v) => (v == null ? null : Array.isArray(v) ? v : String(v).split(",").filter(Boolean));
  const filt = {
    subject: asList(q.subject), chapter: asList(q.chapter), concept: asList(q.concept),
    year: asList(q.year), month: asList(q.month), sitting: asList(q.sitting),
    scope: asList(q.scope), style: asList(q.style), difficulty: asList(q.difficulty),
    exam: asList(q.exam), examType: asList(q.examType),
    yearFrom: q.yearFrom, yearTo: q.yearTo,
    updatedFrom: q.updatedFrom, updatedTo: q.updatedTo,
  };
  let hits = pool.filter((c) => matchFacets(c.facets, filt));

  // Free-text search across the stem, in whichever language is on screen.
  // Free-text search: Google-like grammar (AND terms, "phrase", -exclude,
  // سال:1399 / year:1399 field filters, #id), Persian-normalised, ranked.
  const term = String(q.q || "").trim().slice(0, 200);
  let pq = null, ranked = false;
  if (term) {
    const r = searchPool(hits, term);
    hits = r.hits; pq = r.pq; ranked = !pq.empty;
  }

  // Facet counts: for each facet, count over the pool narrowed by every OTHER
  // active filter. This is the standard faceted-search behaviour — after
  // choosing a subject, the year counts reflect that subject rather than the
  // whole bank, so a learner never picks an option that returns nothing.
  const facetKeys = ["subject", "chapter", "concept", "year", "month", "sitting", "scope", "style", "difficulty", "exam", "examType"];
  const facets = {};
  // When a facet is NOT one of the active filters, "the pool narrowed by every
  // other filter" is just the current hit set, so all such facets share one
  // index instead of re-filtering the pool ten times. Only the handful of
  // facets the learner has actually clicked need their own pass.
  const activeKeys = facetKeys.filter((k) => filt[k] != null && filt[k] !== "" && !(Array.isArray(filt[k]) && !filt[k].length));
  const baseIndex = buildFacetIndex(hits, lang);
  for (const k of facetKeys) {
    if (!activeKeys.includes(k)) { facets[k] = baseIndex[k] || []; continue; }
    const others = { ...filt, [k]: null };
    facets[k] = buildFacetIndex(pool.filter((c) => matchFacets(c.facets, others)), lang)[k] || [];
  }

  // With a text query the default order is relevance; an explicit sort wins.
  const sortKey = String(q.sort || (ranked ? "relevance" : "newest_exam"));
  if (sortKey !== "relevance") hits = sortCards(hits, sortKey);
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const per = Math.min(Math.max(parseInt(q.per, 10) || 20, 1), 100);
  const total = hits.length;
  let slice, responseTotal;
  if (bankLocked) {
    // Free users may open every card that is also on the free curated path
    // (premium=false), plus exactly three global premium teasers. Gating at
    // the CARD level keeps the list and the detail route in lock-step (the old
    // first-3-of-the-filtered-view rule 402'd cards the filtered list showed).
    // The accessible set is still paginated normally; the premium gate card
    // explains that the reported facet counts cover the full bank.
    const teaserIds = new Set(lockedTeaserIds(pool));
    const visibleTeasers = hits.filter((c) => teaserIds.has(c.id));
    // Round 5: bank browse/search is a premium perk (the path itself is
    // free). Free learners only preview the global teasers here.
    const accessible = visibleTeasers;
    responseTotal = accessible.length;
    slice = accessible.slice((page - 1) * per, page * per);
  } else {
    responseTotal = total;
    slice = hits.slice((page - 1) * per, page * per);
  }

  const saved = new Set(
    db.prepare("SELECT card_id FROM user_notes WHERE user_id=? AND highlight=1").all(req.user.id).map((x) => x.card_id)
  );
  const attempted = new Set(
    db.prepare("SELECT DISTINCT card_id FROM card_attempts WHERE user_id=?").all(req.user.id).map((x) => x.card_id)
  );

  res.json({
    total: bankLocked ? responseTotal : total,
    bankTotal: total,
    page, per,
    premiumRequired: bankLocked, preview: bankLocked,
    sort: sortKey,
    query: pq && !pq.empty ? { terms: pq.terms, phrases: pq.phrases, excludes: pq.excludes, fields: pq.fields, id: pq.id } : null,
    cards: slice.map((c) => ({
      id: c.id,
      q: lang === "fa" ? (c.data.q_fa || c.data.title_fa || "") : (c.data.q_en || c.data.title_en || ""),
      // highlight ranges (UTF-16 offsets into `q`) so the UI can <mark> hits
      hl: pq && !pq.empty ? highlightRanges(lang === "fa" ? (c.data.q_fa || c.data.title_fa || "") : (c.data.q_en || c.data.title_en || ""), pq) : undefined,
      // Show the subject/chapter chips in the reading language. The facet
      // *values* stay Persian (they are the filter keys and must match what
      // /browse?subject=… expects), but the label a learner reads should not.
      subject: lang === "fa" ? c.facets.subject : (c.facets.subjectEn || c.facets.subject),
      chapter: lang === "fa" ? c.facets.chapter : (c.facets.chapterEn || c.facets.chapter),
      concept: lang === "fa" ? c.facets.conceptFa : c.facets.conceptEn,
      exam: lang === "fa" ? c.facets.examLabel : c.facets.examLabelEn,
      year: c.facets.year, month: c.facets.month, sitting: c.facets.sitting,
      style: c.facets.style, difficulty: c.facets.difficulty,
      examType: c.facets.examType, keyless: c.facets.keyless,
      official: c.facets.official,
      updatedAt: c.facets.updatedAt, createdAt: c.facets.createdAt,
      saved: saved.has(c.id),
      attempted: attempted.has(c.id),
      premium: c.premium,
    })),
    facets,
  });
});

/* Autocomplete for the bank search box: subject / chapter / concept / exam
   values + a few matching question stems, all starting with the typed text.
   Cheap (facet index is cached with the pool) so it can run per keystroke. */
r.get("/browse/suggest", ...learner, flagGate("bank_browse"), (req, res) => {
  const lang = L(req);
  const term = String(req.query.q || "").trim().slice(0, 80);
  if (term.length < 2) return res.json({ suggestions: [] });
  const pool = browsePool().filter((c) => !c.facets.demo);
  const idx = buildFacetIndex(pool, lang);
  const facetSrc = (key, kind) => (idx[key] || []).map((o) => ({ kind, key, value: o.value, label: o.label, count: o.count }));
  const facetSug = suggestValues(term, [
    facetSrc("subject", "subject"), facetSrc("chapter", "chapter"), facetSrc("concept", "concept"), facetSrc("exam", "exam"),
  ], { limit: 6 });
  // a few stems for "did you mean this question" — ranked by the same core
  const { hits } = searchPool(pool, term, { limit: 4 });
  const stems = hits.slice(0, 4).map((c) => ({
    kind: "card", id: c.id,
    label: searchSnippet(lang === "fa" ? (c.data.q_fa || c.data.title_fa) : (c.data.q_en || c.data.title_en), { terms: [normalizeText(term)], phrases: [], excludes: [], empty: false }, 110),
  }));
  res.set("Cache-Control", "private, max-age=30");
  res.json({ suggestions: [...facetSug, ...stems] });
});

// Serve one browsed question in full (same shape the lesson player uses).
r.get("/browse/:cardId", ...learner, flagGate("bank_browse"), (req, res) => {
  const lang = L(req);
  const p = getProfile(req.user.id);
  const bankLocked = isEnabled("full_bank") && !p.premium_effective;
  const cardId = Number(req.params.cardId);
  if (bankLocked) {
    // Card-level gate, identical to the list rule: free path cards are always
    // open; only the same three global premium teasers are previewable.
    const previewIds = new Set(lockedTeaserIds());
    const previewRow = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(cardId);
    let preview = {}; try { preview = JSON.parse(previewRow?.data_json || "{}"); } catch { /* */ }
    // Round 5: bank browse is premium; free learners open only the teasers
    // (they still study every question for free on the path itself).
    if (preview.source_meta?.kind === "past_exam_import" && !previewIds.has(cardId)) {
      return res.status(402).json({ error: "premium only", premium: false });
    }
  }
  const c = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(req.params.cardId);
  if (!c) return res.status(404).json({ error: "not found" });
  let d = {}; try { d = JSON.parse(c.data_json); } catch { /* */ }
  if (d.track !== "learn") return res.status(404).json({ error: "not found" });
  res.json({ card: serializeCard(c, lang), facets: cardFacets(d, c) });
});

/* Chapter-summary bank: one recap per lesson, grouped by topic.
   Premium by default; admin can flip `summaries_free` for free users. */
r.get("/summaries", ...learner, flagGate("summaries"), (req, res) => {
  const lang = L(req);
  const p = getProfile(req.user.id);
  const open = !!p.premium_effective || isEnabled("summaries_free");
  if (!open) return res.status(402).json({ error: "premium only", premium: false });
  const program = activeProgramFor(req.user.id);
  res.json({ topics: programSummaries(program, lang) });
});

r.get("/library", ...learner, flagGate("library"), (req, res) => {
  const lang = L(req);
  const p = getProfile(req.user.id);
  if (!p.premium_effective) return res.status(402).json({ error: "premium only", premium: false });
  const rows = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE active=1").all();
  const groups = new Map();   // group name -> [{ card, year }]
  const addTo = (name, entry) => {
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
  };
  for (const c of rows) {
    let d = {}; try { d = JSON.parse(c.data_json); } catch { continue; }
    // Round 5: the premium library is the whole official bank (no premium
    // question tier any more); user-authored/demo cards stay out.
    if (d.track !== "learn" || d.source_meta?.kind !== "past_exam_import") continue;
    const sm = d.source_meta || {};
    // Official past-exam cards group by EXAM SUBJECT so premium users get the
    // promised subject browsing instead of a single "uncategorised" pile.
    const subject = lang === "en" ? (sm.subject_en || sm.subject_fa || "") : (sm.subject_fa || sm.subject_en || "");
    addTo(subject || d.category || (lang === "fa" ? "دسته‌بندی‌نشده" : "Uncategorized"),
      { card: serializeCard(c, lang), year: sm.year || "", sitting: fullYear(sm.year) || 0 });
  }
  const categories = [...groups.entries()].map(([name, entries]) => {
    entries.sort((a, b) => b.sitting - a.sitting || String(b.year).localeCompare(String(a.year), "fa"));
    const years = [...new Set(entries.map((e) => e.year).filter(Boolean))];
    const label = years.length ? `${name} — ${years.slice(0, 6).join("، ")}${years.length > 6 ? "…" : ""}` : name;
    return { name: label, count: entries.length, cards: entries.map((e) => e.card) };
  });
  categories.sort((a, b) => b.count - a.count);
  res.json({ categories });
});
// bookmark/save a card for later review (uses the notes/highlight table)
r.post("/library/save/:cardId", ...learner, flagGate("library"), (req, res) => {
  const cardId = parseInt(req.params.cardId, 10);
  if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ error: "invalid_card" });
  const cur = db.prepare("SELECT highlight FROM user_notes WHERE user_id=? AND card_id=?").get(req.user.id, cardId);
  const next = cur?.highlight ? 0 : 1;
  db.prepare(`INSERT INTO user_notes (user_id, card_id, note, highlight, updated_at)
    VALUES (?,?,?,?,datetime('now'))
    ON CONFLICT(user_id, card_id) DO UPDATE SET highlight=excluded.highlight, updated_at=datetime('now')`)
    .run(req.user.id, cardId, "", next);
  persistNow();
  res.json({ saved: !!next });
});
r.get("/library/save/:cardId", ...learner, flagGate("library"), (req, res) => {
  const n = db.prepare("SELECT highlight FROM user_notes WHERE user_id=? AND card_id=?").get(req.user.id, req.params.cardId);
  res.json({ saved: !!n?.highlight });
});

/* ---------------- performance dashboard ---------------- */
r.get("/analytics", ...learner, flagGate("progress"), (req, res) => {
  res.json(performanceDashboard(req.user.id));
});

/* ---------------- mistakes practice hub ---------------- */
r.get("/mistakes", ...learner, flagGate("mistakes_hub"), (req, res) => {
  const lang = L(req);
  const ids = mistakeCardIds(req.user.id, 20);
  const cards = ids.map((id) => {
    const c = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id);
    return c ? serializeCard(c, lang) : null;
  }).filter(Boolean);
  res.json({ cards, count: cards.length });
});
// grade a mistake-hub answer (records telemetry + small XP on success)
r.post("/mistakes/answer", ...learner, flagGate("mistakes_hub"), (req, res) => {
  const cardId = parseInt(req.body?.cardId, 10);
  const correct = !!req.body?.correct;
  const responseMs = parseInt(req.body?.responseMs, 10) || 0;
  if (!cardId) return res.status(400).json({ error: "no card" });
  recordAnswers(req.user.id, [{ cardId, nodeId: null, correct, responseMs, sel: Number.isInteger(req.body?.sel) ? req.body.sel : null }]);
  let profile = getProfile(req.user.id);
  if (correct) profile = awardXp(req.user.id, 3, "mistake_fix", cardId);
  res.json({ profile });
});

/* ---------------- flagged / lucky-guess review hub ----------------
   Cards the learner flagged to revisit OR got right but admitted was a guess. */
r.get("/flagged", ...learner, flagGate("flagged_review"), (req, res) => {
  const lang = L(req);
  const ids = flaggedCardIds(req.user.id, 30);
  const cards = ids.map((id) => {
    const c = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id);
    return c ? serializeCard(c, lang) : null;
  }).filter(Boolean);
  res.json({ cards, count: cards.length });
});
// grade a flagged-review answer; a clean correct answer clears it from the list
r.post("/flagged/answer", ...learner, flagGate("flagged_review"), (req, res) => {
  const cardId = parseInt(req.body?.cardId, 10);
  const correct = !!req.body?.correct;
  const responseMs = parseInt(req.body?.responseMs, 10) || 0;
  const flagged = !!req.body?.flagged;
  const guessed = !!req.body?.guessed;
  if (!cardId) return res.status(400).json({ error: "no card" });
  recordAnswers(req.user.id, [{ cardId, nodeId: null, correct, responseMs, flagged, guessed, sel: Number.isInteger(req.body?.sel) ? req.body.sel : null }]);
  let profile = getProfile(req.user.id);
  if (correct && !guessed) profile = awardXp(req.user.id, 3, "flag_review", cardId);
  res.json({ profile });
});

/* ---------------- EXAM SIMULATOR (timed, exam-like, pass probability) ----------------
   Pure statistics — no AI, no per-question cost. */
r.post("/exam-sim/start", ...learner, flagGate("exam_sim"), (req, res) => {
  const lang = L(req);
  const slugs = Array.isArray(req.body?.topics) ? req.body.topics.filter(Boolean) : [];
  const n = Math.min(60, Math.max(5, parseInt(req.body?.n, 10) || 20));
  const durationS = Math.min(7200, Math.max(60, parseInt(req.body?.durationS, 10) || n * 60));
  const profile0 = getProfile(req.user.id);
  const sim = createSim(req.user.id, {
    topicSlugs: slugs, n, durationS, program: activeProgramFor(req.user.id),
    premium: !!profile0.premium_effective,
  });
  const cards = sim.cardIds
    .map((id) => db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id))
    .filter(Boolean)
    .map((c) => { const s = serializeCard(c, lang); delete s.micro; return s; }); // hide درسنامه during the exam
  res.json({ id: sim.id, durationS: sim.durationS, n: cards.length, cards });
});
r.post("/exam-sim/:id/finish", ...learner, flagGate("exam_sim"), (req, res) => {
  const out = finishSim(req.user.id, parseInt(req.params.id, 10), {
    correct: req.body?.correct, total: req.body?.total, timeMs: req.body?.timeMs,
  });
  if (out.error) return res.status(400).json(out);
  // Round 9: percentile vs peers — premium analytics (UWorld/AMBOSS-style)
  out.peer = peerBlock(req.user.id, "sim", out.profile, parseInt(req.body?.correct, 10) || 0, parseInt(req.body?.total, 10) || 0, parseInt(req.body?.timeMs, 10) || 0);
  res.json(out);
});
r.get("/exam-sim/history", ...learner, flagGate("exam_sim"), (req, res) => {
  res.json({ history: simHistory(req.user.id, 10) });
});

/* ---------------- Round 9: peer benchmark & premium extras ----------------
   UWorld/AMBOSS-style analytics + مدوفست daily report + Duolingo Super perks.
   Admin switches live in game-config → peer. Premium gating rule (round 9):
   option stats are FREE (they teach), percentile / daily report / hint /
   one-tap flashcard are PREMIUM. */
function peerBlock(userId, kind, profile, correct, total, timeMs) {
  const isPremium = !!(profile?.premium_effective);
  if (peerCfg().percentile === false) return null;
  if (!isPremium) return { premiumRequired: true };
  return percentileFor(userId, kind, correct, total, timeMs);
}
const premiumGate = (req, res, next) => {
  const p = getProfile(req.user.id);
  if (!p.premium_effective) return res.status(402).json({ error: "premium only", premiumRequired: true });
  next();
};
// «شناسنامهٔ سؤال» — free
r.get("/card/:id/option-stats", ...learner, flagGate("option_stats"), (req, res) => {
  const row = db.prepare("SELECT id, data_json FROM flashcards WHERE id=? AND active=1").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  let n = 0; try { n = (JSON.parse(row.data_json || "{}").options || []).length; } catch { n = 0; }
  res.json({ stats: optionStats(row.id, n) });
});
// daily performance report — premium
r.get("/daily-report", ...learner, flagGate("daily_report"), (req, res) => {
  if (peerCfg().daily_report === false) return res.json({ enabled: false });
  const p = getProfile(req.user.id);
  if (!p.premium_effective) return res.json({ enabled: true, premiumRequired: true });
  res.json({ enabled: true, report: dailyReport(req.user.id, L(req)) });
});
// pre-answer hint — premium free of charge; free users may pay gems (admin knob)
r.post("/card/:id/hint", ...learner, flagGate("hint"), (req, res) => {
  const cfg = peerCfg();
  if (cfg.hint === false) return res.status(403).json({ error: "feature disabled" });
  const p = getProfile(req.user.id);
  if (!p.premium_effective && !(Number(cfg.hint_gems) > 0)) return res.status(402).json({ error: "premium only", premiumRequired: true });
  const out = takeHint(req.user.id, parseInt(req.params.id, 10), L(req));
  if (out.error === "not enough gems") return res.status(402).json(out);
  if (out.error) return res.status(400).json(out);
  res.json(out);
});
// one-tap personal flashcard from a question — premium
r.post("/card/:id/save-flashcard", ...learner, flagGate("save_flashcard"), premiumGate, flagGate("learner_cards"), (req, res) => {
  const out = saveExplainAsCard(req.user.id, parseInt(req.params.id, 10), L(req));
  if (out.error) return res.status(400).json(out);
  res.json(out);
});
// jump ahead («پرش از واحد»)
r.get("/jump/:topicId", ...learner, flagGate("jump_ahead"), (req, res) => {
  if (!jumpAllowed(getProfile(req.user.id))) return res.status(403).json({ error: "feature disabled" });
  const out = buildJumpQuiz(req.user.id, parseInt(req.params.topicId, 10), L(req));
  if (out.error) return res.status(400).json(out);
  res.json(out);
});
r.post("/jump/:topicId", ...learner, flagGate("jump_ahead"), (req, res) => {
  if (!jumpAllowed(getProfile(req.user.id))) return res.status(403).json({ error: "feature disabled" });
  const out = submitJumpQuiz(req.user.id, parseInt(req.params.topicId, 10), req.body?.answers);
  if (out.error) return res.status(400).json(out);
  res.json({ ...out, profile: getProfile(req.user.id) });
});

/* ---------------- CUSTOM TEST BUILDER (premium «آزمون‌ساز») ----------------
   UWorld/AMBOSS-style: scope (subject / path chapter / exam / year / style)
   × question status (unused / incorrect / marked / all) × size × mode
   (tutor | timed). Live counts so an empty test can never be built. */
const customGate = (req, res, next) => {
  if (!isEnabled("custom_test")) return res.status(403).json({ error: "feature disabled", flag: "custom_test" });
  const p = getProfile(req.user.id);
  if (!p.premium_effective && isEnabled("full_bank")) return res.status(402).json({ error: "premium only", premiumRequired: true });
  next();
};
function customPool() { return browsePool().filter((c) => !c.facets.demo && !c.facets.keyless); }
r.get("/custom-test/options", ...learner, customGate, (req, res) => {
  const cfg = normalizeConfig(req.query);
  res.json({ config: cfg, ...builderOptions(req.user.id, customPool(), cfg, L(req)) });
});
r.post("/custom-test/options", ...learner, customGate, (req, res) => {
  const cfg = normalizeConfig(req.body || {});
  res.json({ config: cfg, ...builderOptions(req.user.id, customPool(), cfg, L(req)) });
});
function serveCustom(t, lang, res) {
  const cards = t.ids.map((id) => db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id))
    .filter(Boolean).map((c) => serializeCard(c, lang));
  // timed mode = exam-like: hide درسنامه/پاسخنامه until finished
  if (t.cfg.mode === "timed" && t.row.status === "active") for (const c of cards) { delete c.micro; delete c.explain; delete c.attending; }
  res.json({ id: t.row.id, status: t.row.status, config: { ...t.cfg, answers: undefined }, answers: t.answers,
    durationS: t.row.duration_s, startedAt: t.row.started_at, cards });
}
r.post("/custom-test/start", ...learner, customGate, (req, res) => {
  const cfg = normalizeConfig(req.body || {});
  const ids = pickCards(req.user.id, customPool(), cfg);
  if (!ids.length) return res.status(400).json({ error: "no questions match", empty: true });
  const s = createCustomTest(req.user.id, cfg, ids);
  serveCustom(getCustomTest(req.user.id, s.id), L(req), res);
});
r.get("/custom-test/history", ...learner, flagGate("custom_test"), (req, res) => res.json({ history: customHistory(req.user.id, 20) }));
r.get("/custom-test/:id", ...learner, customGate, (req, res) => {
  const t = getCustomTest(req.user.id, parseInt(req.params.id, 10));
  if (!t) return res.status(404).json({ error: "not found" });
  serveCustom(t, L(req), res);
});
r.post("/custom-test/:id/answer", ...learner, customGate, (req, res) => {
  const b = req.body || {};
  const cardId = parseInt(b.cardId, 10);
  if (!cardId) return res.status(400).json({ error: "no card" });
  const t = getCustomTest(req.user.id, parseInt(req.params.id, 10));
  if (!t) return res.status(404).json({ error: "not found" });
  // grade server-side from the stored key so a client cannot self-award
  const row = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(cardId);
  if (!row) return res.status(404).json({ error: "card not found" });
  let d = {}; try { d = JSON.parse(row.data_json || "{}"); } catch { d = {}; }
  const card = serializeCard(row, L(req));
  const full = { id: row.id, ...d };
  // Competitive UI posts `{ sel }` (fill string, match {pairs}, order [{id}],
  // compare {featureId: belongs}). University grader wants typed fields, and
  // serializeCard uses positional ids — allowLegacy is required here.
  const g = gradeFlashcard(full, bodyFromClientSel(full, { ...b, lang: L(req) }), { allowLegacy: true });
  const correct = !!g.ok && !g.pendingApproval;
  const out = answerCustomTest(req.user.id, t.row.id, { cardId, correct, sel: b.sel, responseMs: parseInt(b.responseMs, 10) || 0, flagged: !!b.flagged });
  if (out.error) return res.status(400).json(out);
  // tutor mode: attach «شناسنامهٔ سؤال» (option pick %) to the revealed card
  const tutorCard = t.cfg.mode === "tutor" ? { ...card, optionStats: Array.isArray(card.options) ? optionStats(card.id, card.options.length) : null } : undefined;
  res.json({ ...out, correct, card: tutorCard });
});
r.post("/custom-test/:id/finish", ...learner, customGate, (req, res) => {
  const out = finishCustomTest(req.user.id, parseInt(req.params.id, 10), { timeMs: parseInt(req.body?.timeMs, 10) || 0 });
  if (out.error) return res.status(400).json(out);
  const t = getCustomTest(req.user.id, parseInt(req.params.id, 10));
  const lang = L(req);
  const placeholders = (t.ids || []).map(() => "?").join(",");
  const cardRows = placeholders ? db.prepare(`SELECT id, data_json, difficulty FROM flashcards WHERE id IN (${placeholders}) AND active=1`).all(...t.ids) : [];
  const cardRowMap = new Map(cardRows.map((r) => [r.id, r]));
  const cards = withOptionStats((t.ids || []).map((id) => cardRowMap.get(id)).filter(Boolean).map((c) => serializeCard(c, lang)));
  const peer = peerBlock(req.user.id, "custom", out.profile, out.correct, out.total, parseInt(req.body?.timeMs, 10) || 0);
  res.json({ ...out, answers: t.answers, cards, peer });
});

/* ---------------- MIND-MAPS (built from hand-written درسنامه; no AI) ---------------- */
r.get("/mindmap/topics", ...learner, flagGate("mindmap"), (req, res) => {
  res.json({ topics: mindmapTopics(L(req), activeProgramFor(req.user.id)) });
});
r.get("/mindmap/:slug", ...learner, flagGate("mindmap"), (req, res) => {
  const map = buildMindmap(req.params.slug, L(req));
  if (!map) return res.status(404).json({ error: "not found" });
  res.json(map);
});

/* Is an AI provider configured? Boolean only — never leaks the key. Lets the
   client offer the optional AI note without exposing admin AI settings. */
r.get("/ai-status", ...learner, (req, res) => {
  const aiCfg = resolveAiConfig(getSetting("ai", {}));
  res.json({ available: !!aiCfg?.apiKey });
});

/* ---------------- SMART STUDY PLAN (deterministic; AI only for a short note) ---------------- */
r.get("/study-plan", ...learner, flagGate("study_plan"), (req, res) => {
  const plan = getStudyPlan(req.user.id, L(req));
  res.json(plan || { plan: null });
});
r.post("/study-plan", ...learner, flagGate("study_plan"), async (req, res) => {
  const lang = L(req);
  const examDate = (req.body?.examDate || "").slice(0, 10) || null;
  const minutesPerDay = Math.min(600, Math.max(15, parseInt(req.body?.minutesPerDay, 10) || 60));
  const program = activeProgramFor(req.user.id);
  // Optionally spend ONE AI call for a personal motivational note (mock-safe).
  const { rankedTopics } = await import("../lib/studyplan.js");
  const ranked = rankedTopics(req.user.id, lang, program);
  const weakest = ranked[0]?.title || "";
  const daysLeft = examDate ? Math.max(0, Math.round((new Date(examDate) - new Date()) / 86400000)) : 14;
  let aiNote = null;
  if (req.body?.useAi) {
    const aiCfg = resolveAiConfig(getSetting("ai", {}));
    aiNote = await studyNote({ daysLeft, weakest, minutesPerDay, lang, aiCfg });
  }
  const built = buildStudyPlan(req.user.id, {
    examDate, minutesPerDay, lang, program,
    aiNoteFa: lang === "fa" ? (aiNote || "") : "",
    aiNoteEn: lang === "en" ? (aiNote || "") : "",
  });
  res.json(built);
});

/* ---------------- COMMUNITY DECKS (shared, moderated, votable) ---------------- */
r.get("/community", ...learner, flagGate("community"), (req, res) => {
  const topicId = req.query.topic ? parseInt(req.query.topic, 10) : null;
  const sort = req.query.sort === "new" ? "new" : "top";
  res.json({ cards: browseCommunity(req.user.id, { topicId, lang: L(req), sort }) });
});
r.post("/community/share", ...learner, flagGate("community"), (req, res) => {
  const fid = parseInt(req.body?.flashcardId, 10);
  if (!fid) return res.status(400).json({ error: "no card" });
  const out = shareCard(req.user.id, fid, parseInt(req.body?.topicId, 10) || null);
  if (out.error) return res.status(400).json(out);
  res.json(out);
});
r.post("/community/:id/vote", ...learner, flagGate("community"), (req, res) => {
  const out = voteCommunity(req.user.id, parseInt(req.params.id, 10), parseInt(req.body?.value, 10) || 1);
  if (out.error) return res.status(404).json(out);
  res.json(out);
});
r.post("/community/:id/import", ...learner, flagGate("community"), (req, res) => {
  const out = importCommunity(req.user.id, parseInt(req.params.id, 10));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

/* ---------------- VISUAL MNEMONICS (Sketchy-style; teacher-authored, no AI) ---------------- */
r.get("/mnemonics", ...learner, flagGate("mnemonics"), (req, res) => {
  const lang = L(req);
  const program = activeProgramFor(req.user.id);
  // only cards used by the ACTIVE program's lessons (so courses don't mix)
  const programCardIds = new Set();
  const nodes = db.prepare(`SELECT pn.card_ids FROM path_nodes pn JOIN topics t ON t.id = pn.topic_id
    WHERE pn.active=1 AND t.active=1 AND t.program=?`).all(program);
  for (const n of nodes) { try { JSON.parse(n.card_ids || "[]").forEach((id) => programCardIds.add(id)); } catch { /* */ } }
  const items = [];
  for (const cid of programCardIds) {
    const r0 = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(cid);
    if (!r0) continue;
    let d = {}; try { d = JSON.parse(r0.data_json); } catch { continue; }
    if (!d.mnemonic) continue;
    const c = serializeCard(r0, lang);
    if (c.mnemonic) items.push({ id: c.id, q: c.q, mnemonic: c.mnemonic });
  }
  res.json({ items, count: items.length });
});

/* ---------------- CROWD DIFFICULTY INSIGHTS (learned from real data; no AI) ---------------- */
r.get("/crowd/hardest", ...learner, flagGate("crowd_insights"), (req, res) => {
  res.json({ summary: crowdSummary(), cards: hardestQuestions(L(req), { minSeen: 3, limit: 20, program: activeProgramFor(req.user.id) }) });
});
r.get("/crowd/card/:id", ...learner, (req, res) => {
  res.json({ crowd: crowdForCard(parseInt(req.params.id, 10)) });
});

/* ---------------- personal notes + highlights ---------------- */
r.get("/notes", ...learner, flagGate("notes"), (req, res) => {
  const rows = db.prepare(`
    SELECT n.card_id, n.note, n.highlight, f.data_json
    FROM user_notes n JOIN flashcards f ON f.id = n.card_id
    WHERE n.user_id=? AND (n.note != '' OR n.highlight=1)
    ORDER BY n.updated_at DESC`).all(req.user.id);
  const lang = L(req);
  res.json({ notes: rows.map((r) => {
    let d = {}; try { d = JSON.parse(r.data_json); } catch { /* */ }
    const q = (lang === "fa" ? (d.q_fa || d.title_fa) : (d.q_en || d.title_en)) || `#${r.card_id}`;
    return { card_id: r.card_id, note: r.note, highlight: !!r.highlight, question: q };
  }) });
});
r.get("/notes/:cardId", ...learner, flagGate("notes"), (req, res) => {
  const n = db.prepare("SELECT note, highlight FROM user_notes WHERE user_id=? AND card_id=?").get(req.user.id, req.params.cardId);
  res.json({ note: n?.note || "", highlight: !!n?.highlight });
});
r.put("/notes/:cardId", ...learner, flagGate("notes"), (req, res) => {
  const cardId = parseInt(req.params.cardId, 10);
  if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ error: "invalid_card" });
  // Free-text with a ceiling: the whole DB lives in memory (sql.js), so an
  // unbounded note (body limit is 2 MB per request) is a cheap way to bloat it.
  const note = String(req.body?.note ?? "").slice(0, 5000);
  const highlight = req.body?.highlight ? 1 : 0;
  db.prepare(`INSERT INTO user_notes (user_id, card_id, note, highlight, updated_at)
    VALUES (?,?,?,?,datetime('now'))
    ON CONFLICT(user_id, card_id) DO UPDATE SET note=excluded.note, highlight=excluded.highlight, updated_at=datetime('now')`)
    .run(req.user.id, cardId, note, highlight);
  persistNow();
  res.json({ ok: true });
});

/* ---------------- ads ----------------
   All ad serving now goes through the central ad-control policy (master switch,
   premium exemption, scheduling, frequency caps, audience, weighted rotation). */
function getAds(lang, premium, slot, nodeId = null, userId = null, isNew = false) {
  return serveAds({ userId, premium, isNew, lang, slot, nodeId });
}
r.get("/ads", ...learner, (req, res) => {
  const p = getProfile(req.user.id);
  const nodeId = req.query.node != null && req.query.node !== "" ? (Number(req.query.node) || null) : null;
  res.json({ ads: serveAds({ userId: req.user.id, premium: p.premium_effective, isNew: isNewLearner(p), lang: L(req), slot: req.query.slot || "path", nodeId }) });
});
r.post("/ads/:id/click", ...learner, (req, res) => {
  db.prepare("UPDATE ads SET clicks=clicks+1 WHERE id=?").run(req.params.id);
  persistNow();
  res.json({ ok: true });
});

/* ---- Duolingo-Ads formats: rewarded video, interstitial, pre-lesson ---- */
// Fetch one ad of a given FORMAT (rewarded | interstitial | prelesson).
r.get("/ad", ...learner, (req, res) => {
  const p = getProfile(req.user.id);
  const format = ["rewarded", "interstitial", "prelesson"].includes(req.query.format) ? req.query.format : "rewarded";
  const nodeId = req.query.node != null && req.query.node !== "" ? (Number(req.query.node) || null) : null;
  const ad = pickAd(L(req), p.premium_effective, format, nodeId);
  const cfg = getGameConfig().ads;
  res.json({
    ad,
    rewardedToday: rewardedViewsToday(req.user.id),
    rewardCap: cfg.daily_reward_cap,
  });
});
// Claim the reward after watching a rewarded / pre-lesson ad to the end.
r.post("/ad/reward", ...learner, (req, res) => {
  const format = ["rewarded", "prelesson"].includes(req.body?.format) ? req.body.format : "rewarded";
  const adId = Number(req.body?.adId) || null;
  const r2 = claimRewardedAd(req.user.id, adId, format);
  if (!r2.ok) return res.status(r2.capped ? 429 : 400).json(r2);
  res.json(r2);
});

/* ---------------- spaced repetition (SRS) review ---------------- */
// due-card queue to review today
r.get("/review", ...learner, flagGate("srs_review"), (req, res) => {
  const lang = L(req);
  // Calm Mode: cap the due-review pile so it never overwhelms (anti-burnout).
  // A learner in Calm Mode sees at most their chosen daily cap of due cards.
  const cap = isEnabled("calm_mode") ? effectiveReviewCap(req.user.id) : null;
  const totalDue = dueCount(req.user.id);
  const sessionLimit = cap ? Math.min(20, cap) : 20;
  // SRS reviews grade the learner, so the queue is limited to curated path
  // cards; premium bank-only overflow and keyless cards are study/browse
  // material and never gradeable. Fetch a few extra so the filter stays at cap.
  const due = dueCards(req.user.id, sessionLimit * 4);
  const cards = [];
  for (const d of due) {
    const c = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(d.card_id);
    if (!c) continue;
    let data = null;
    try { data = JSON.parse(c.data_json); } catch { data = null; }
    if (data && cardIsBankOnly(data)) continue;
    // FSRS "next interval per button" preview shown on the grade buttons
    const preview = previewSchedule(req.user.id, d.card_id);
    cards.push({ ...serializeCard(c, lang), interval: d.interval_days, reps: d.reps, stability: d.stability, preview });
    if (cards.length >= sessionLimit) break;
  }
  res.json({
    cards, count: cards.length, stats: srsStats(req.user.id),
    // let the UI reassure the learner when Calm Mode is trimming the pile
    calm: cap ? { capped: totalDue > cap, cap, totalDue } : null,
  });
});

// SRS memory dashboard (scheduler, retention target, avg stability/difficulty)
r.get("/srs/stats", ...learner, (req, res) => {
  res.json(srsStats(req.user.id));
});

// Confidence-Based Assessment: lifetime calibration report — for each declared
// confidence level, how often the learner was actually right ("do you know what
// you know?"). A key clinical-safety metacognition skill. Fully AI-free.
r.get("/calibration/confidence", ...learner, (req, res) => {
  res.json(calibrationReport(req.user.id));
});

// Topic Mastery: every topic in the active program with mastery status
// (earned badge or progress toward Bloom's ≥90% + durable-memory criteria).
r.get("/mastery", ...learner, flagGate("mastery"), (req, res) => {
  const program = activeProgramFor(req.user.id);
  res.json(masteryOverview(req.user.id, program, L(req)));
});

// Calm Mode (anti-burnout, opt-in): read / update the learner's protections.
r.get("/calm", ...learner, flagGate("calm_mode"), (req, res) => {
  res.json(getCalmSettings(req.user.id));
});
r.put("/calm", ...learner, flagGate("calm_mode"), (req, res) => {
  res.json(setCalmSettings(req.user.id, req.body || {}));
});
// Take a guilt-free planned REST DAY that preserves today's streak.
r.post("/calm/rest-day", ...learner, flagGate("calm_mode"), (req, res) => {
  const out = takeRestDay(req.user.id);
  res.status(out.ok ? 200 : 400).json(out);
});

// Anonymous / stealth ranking (opt-in privacy): read / update the pseudonym.
r.get("/anon", ...learner, flagGate("anon_ranking"), (req, res) => {
  res.json(getAnonSettings(req.user.id, L(req)));
});
r.put("/anon", ...learner, flagGate("anon_ranking"), (req, res) => {
  res.json(setAnonSettings(req.user.id, req.body || {}, L(req)));
});

// cards the learner explicitly SAVED (bookmarked) for later review
r.get("/review/saved", ...learner, (req, res) => {
  const lang = L(req);
  const rows = db.prepare(`
    SELECT f.id, f.data_json, f.difficulty FROM user_notes n
    JOIN flashcards f ON f.id = n.card_id
    WHERE n.user_id=? AND n.highlight=1 AND f.active=1 ORDER BY n.updated_at DESC LIMIT 50`).all(req.user.id);
  const cards = rows.map((c) => serializeCard(c, lang));
  res.json({ cards, count: cards.length });
});

// grade a reviewed card (0 wrong, 1 hard, 2 good, 3 easy); awards small XP on success
r.post("/review/grade", ...learner, flagGate("srs_review"), (req, res) => {
  const cardId = parseInt(req.body?.cardId, 10);
  const grade = Math.max(0, Math.min(3, parseInt(req.body?.grade ?? 0, 10) || 0));
  if (!cardId) return res.status(400).json({ error: "no card" });
  const sched = srsReview(req.user.id, cardId, grade);
  let profile = getProfile(req.user.id);
  if (grade >= 2) profile = awardXp(req.user.id, 5, "review", cardId); // reward correct reviews
  progressQuests(req.user.id, "review", 1);
  res.json({ sched, profile });
});

/* ---------------- notifications (in-app bell feed) ---------------- */
r.get("/notifications", ...learner, (req, res) => {
  const lang = L(req);
  const rows = db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 40").all(req.user.id);
  const unseen = db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND seen=0").get(req.user.id).c;
  res.json({
    unseen,
    items: rows.map((n) => ({
      id: n.id, kind: n.kind, icon: n.icon, link: n.link, seen: !!n.seen, created_at: n.created_at,
      title: lang === "fa" ? n.title_fa : n.title_en, body: lang === "fa" ? n.body_fa : n.body_en,
    })),
  });
});
r.post("/notifications/seen", ...learner, (req, res) => {
  db.prepare("UPDATE notifications SET seen=1 WHERE user_id=?").run(req.user.id);
  persistNow();
  res.json({ ok: true });
});

/* ---------------- web push subscription ---------------- */
r.get("/push/key", ...learner, (req, res) => {
  res.json({ publicKey: vapidPublicKey(), configured: pushConfigured() });
});
r.post("/push/subscribe", ...learner, (req, res) => {
  const s = req.body || {};
  if (!s.endpoint) return res.status(400).json({ error: "no endpoint" });
  db.prepare(`INSERT OR IGNORE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?,?,?,?)`)
    .run(req.user.id, s.endpoint, s.keys?.p256dh || "", s.keys?.auth || "");
  persistNow();
  res.json({ ok: true });
});
// Fire a test streak reminder for the current user (demo/testing convenience)
r.post("/push/test", ...learner, async (req, res) => {
  await notify(req.user.id, {
    kind: "system", icon: "clock", link: "path",
    title_fa: "🔔 نوتیفیکیشن آزمایشی", title_en: "🔔 Test notification",
    body_fa: "نوتیفیکیشن‌های شما فعال است!", body_en: "Your notifications are working!",
  });
  res.json({ ok: true });
});

/* ---------------- learner-authored flashcards (with hints) ---------------- */
// list my own cards
r.get("/mycards", ...learner, flagGate("learner_cards"), (req, res) => {
  const lang = L(req);
  const rows = db.prepare(`
    SELECT lc.id AS link_id, lc.topic_id, f.id, f.data_json, f.difficulty
    FROM learner_cards lc JOIN flashcards f ON f.id = lc.flashcard_id
    WHERE lc.user_id = ? AND f.active = 1 ORDER BY lc.id DESC`).all(req.user.id);
  res.json({
    cards: rows.map((r) => {
      let d = {}; try { d = JSON.parse(r.data_json); } catch { d = {}; }
      return {
        linkId: r.link_id, id: r.id, topic_id: r.topic_id, type: d.type || "mcq",
        q: lang === "fa" ? (d.q_fa || d.title_fa) : (d.q_en || d.title_en),
        hints: (lang === "fa" ? d.hints_fa : d.hints_en) || [],
      };
    }),
  });
});

// create a personal MCQ flashcard WITH hints (learn-phase card builder)
r.post("/mycards", ...learner, flagGate("learner_cards"), (req, res) => {
  const raw = req.body || {};
  // Learner-authored cards go straight into the shared flashcards table, so
  // bound every free-text field (question 2000, option 500, hint/explanation
  // 1000 chars; ≤ 8 options / hints) — otherwise one user can grow the
  // in-memory DB by megabytes per request.
  const S = (v, n) => (v == null ? "" : String(v).slice(0, n));
  const b = {
    q_fa: S(raw.q_fa, 2000), q_en: S(raw.q_en, 2000),
    ex_fa: S(raw.ex_fa, 1000), ex_en: S(raw.ex_en, 1000),
    difficulty: ["easy", "medium", "hard"].includes(raw.difficulty) ? raw.difficulty : "medium",
    hints_fa: (Array.isArray(raw.hints_fa) ? raw.hints_fa : []).slice(0, 8).map((h) => S(h, 500)),
    hints_en: (Array.isArray(raw.hints_en) ? raw.hints_en : []).slice(0, 8).map((h) => S(h, 500)),
    options: (Array.isArray(raw.options) ? raw.options : []).slice(0, 8)
      .map((o) => ({ fa: S(o?.fa, 500), en: S(o?.en, 500), correct: !!o?.correct })),
  };
  const opts = b.options;
  if (!b.q_fa && !b.q_en) return res.status(400).json({ error: "no question" });
  if (opts.filter((o) => o.fa || o.en).length < 2) return res.status(400).json({ error: "need 2+ options" });
  if (!opts.some((o) => o.correct)) return res.status(400).json({ error: "mark a correct option" });
  const data = {
    course_fa: "کارت من", course_en: "My card", type: "mcq", track: "learn", owner: req.user.id,
    q_fa: b.q_fa || b.q_en, q_en: b.q_en || b.q_fa,
    title_fa: b.q_fa || b.q_en, title_en: b.q_en || b.q_fa,
    questionText_fa: b.q_fa || b.q_en, questionText_en: b.q_en || b.q_fa,
    options: opts.map((o) => ({ fa: o.fa || o.en, en: o.en || o.fa, correct: !!o.correct })),
    hints_fa: (b.hints_fa || []).filter(Boolean),
    hints_en: (b.hints_en || []).filter(Boolean),
    ex_fa: b.ex_fa || "", ex_en: b.ex_en || "",
    micro: { lead_fa: b.ex_fa || "", lead_en: b.ex_en || "", golden_fa: "", golden_en: "", points_fa: (b.hints_fa || []).filter(Boolean), points_en: (b.hints_en || []).filter(Boolean), options_fa: [], options_en: [], source_fa: "", source_en: "" },
  };
  const info = db.prepare("INSERT INTO flashcards (version, difficulty, data_json, active) VALUES (1,?,?,1)")
    .run(b.difficulty || "medium", JSON.stringify(data));
  const fid = info.lastInsertRowid;
  db.prepare("INSERT INTO learner_cards (user_id, flashcard_id, topic_id) VALUES (?,?,?)")
    .run(req.user.id, fid, b.topic_id || null);
  ensureTracked(req.user.id, fid); // include personal cards in SRS immediately
  persistNow();
  res.json({ id: fid });
});

r.delete("/mycards/:linkId", ...learner, (req, res) => {
  const link = db.prepare("SELECT * FROM learner_cards WHERE id=? AND user_id=?").get(req.params.linkId, req.user.id);
  if (!link) return res.status(404).json({ error: "not found" });
  db.prepare("UPDATE flashcards SET active=0 WHERE id=?").run(link.flashcard_id);
  db.prepare("DELETE FROM learner_cards WHERE id=?").run(link.id);
  db.prepare("DELETE FROM srs_state WHERE user_id=? AND card_id=?").run(req.user.id, link.flashcard_id);
  persistNow();
  res.json({ ok: true });
});

/* practice my own cards as a mini-lesson (returns hint-bearing cards) */
r.get("/mycards/practice", ...learner, (req, res) => {
  const lang = L(req);
  const rows = db.prepare(`
    SELECT f.id, f.data_json, f.difficulty FROM learner_cards lc
    JOIN flashcards f ON f.id = lc.flashcard_id
    WHERE lc.user_id = ? AND f.active = 1 ORDER BY RANDOM() LIMIT 10`).all(req.user.id);
  res.json({ cards: rows.map((c) => serializeCard(c, lang)) });
});

/* ---------------- premium (simulated) ---------------- */
r.get("/premium/plans", ...learner, flagGate("premium"), (req, res) => {
  const lang = L(req);
  // prices come from the admin-configurable catalog (Rial -> Toman for display)
  const catalog = getPlans();
  const toToman = (rial) => Math.round(rial / 10);
  const plans = [
    { id: "monthly", price: `${toToman(catalog.monthly.amount).toLocaleString("fa-IR")} تومان`, priceEn: `${toToman(catalog.monthly.amount).toLocaleString("en-US")} T`, period: lang === "fa" ? "ماهانه" : "per month", best: false },
    { id: "yearly", price: `${toToman(catalog.yearly.amount).toLocaleString("fa-IR")} تومان`, priceEn: `${toToman(catalog.yearly.amount).toLocaleString("en-US")} T`, period: lang === "fa" ? "سالانه" : "per year", best: true },
  ];
  const perks = lang === "fa"
    ? ["قلب نامحدود (بدون توقف تمرین)", "حذف کامل تبلیغات", "بانک کامل سؤالات با جست‌وجو و فیلتر درس/سال/فصل", "بانک خلاصهٔ فصل‌ها بدون محدودیت", "دسترسی به همه دروس و آزمون‌های شبیه‌ساز", "آمار پیشرفته و تحلیل ضعف‌ها", "نشان ویژه پریمیوم در رتبه‌بندی"]
    : ["Unlimited hearts (never stop practicing)", "No ads at all", "Full question bank with search and subject/year/chapter filters", "Unlimited chapter-summary bank", "Access to all subjects & mock exams", "Advanced analytics & weakness insights", "Premium badge on leaderboards"];
  res.json({ plans, perks });
});
// NOTE: real checkout now goes through POST /api/pay/subscribe (Zarinpal / mock).
// This endpoint is kept only for automated tests / admin overrides.
r.post("/premium/cancel", ...learner, (req, res) => {
  db.prepare("UPDATE learner_profiles SET premium=0, premium_until=NULL WHERE user_id=?").run(req.user.id);
  persistNow();
  res.json({ profile: getProfile(req.user.id) });
});

/* ---------------- Virtual Patient (competitive side) ----------------
   Gated by the `virtual_patient` flag + an admin config (enabled / premium_only).
   The actual play (chat, orders, evaluation) reuses the shared /exam engine.
   Here we expose: access status, the playable case list, and the case of the
   day for the daily challenge + a reward hook on completion. */
r.get("/vpatient", ...learner, async (req, res) => {
  try {
    const { getVpatientConfig, vpatientAccess, playableCases, caseOfTheDay } = await import("../lib/vpatient.js");
    const lang = req.query.lang === "en" ? "en" : "fa";
    const p = getProfile(req.user.id);
    const access = vpatientAccess(p, req.user.role);
    const cfg = getVpatientConfig();
    const out = {
      enabled: access.reason !== "off",
      access: access.ok,
      reason: access.reason,           // "off" | "premium" | null
      premium_only: cfg.premium_only,
      in_path: cfg.in_path,
      in_daily: cfg.in_daily,
      daily_gems: cfg.daily_gems,
    };
    // only reveal the case list to learners who actually have access
    if (access.ok) {
      out.cases = playableCases(lang, req.user.id);
      if (cfg.in_daily) out.daily_case_id = caseOfTheDay();
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: "vpatient_boot_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

// Reward hook — called once per day after finishing the "case of the day".
// Deterministic, server-authoritative (client can't fake the reward amount).
r.post("/vpatient/daily-reward", ...learner, async (req, res) => {
  try {
    const { vpatientAccess, getVpatientConfig, caseOfTheDay } = await import("../lib/vpatient.js");
    const p = getProfile(req.user.id);
    const access = vpatientAccess(p, req.user.role);
    if (!access.ok) return res.status(403).json({ error: access.reason || "unavailable", stage: "boot" });
    const cfg = getVpatientConfig();
    if (!cfg.in_daily) return res.status(400).json({ error: "daily disabled", stage: "boot" });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    const claimedKey = `vp_daily_${req.user.id}`;
    const row = db.prepare("SELECT value FROM settings WHERE key=?").get(claimedKey);
    let claimed = null; try { claimed = row ? JSON.parse(row.value) : null; } catch { claimed = null; }
    if (claimed?.day === today) {
      return res.json({ ok: true, alreadyClaimed: true, gems: 0, profile: getProfile(req.user.id) });
    }
    const dailyId = caseOfTheDay();
    if (!dailyId) return res.status(400).json({ error: "no_daily_case", stage: "report" });
    const requested = Number(req.body?.caseId || 0);
    // Client always sends the case just finished. A mismatch means they did
    // not complete today's case — do not pay. Empty body (legacy) still pays.
    if (requested && requested !== Number(dailyId)) {
      return res.status(400).json({ error: "not_daily_case", stage: "report" });
    }
    const gems = Math.max(0, cfg.daily_gems | 0);
    if (gems > 0) db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(gems, req.user.id);
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(claimedKey, JSON.stringify({ day: today, caseId: dailyId }));
    persistNow();
    res.json({ ok: true, alreadyClaimed: false, gems, profile: getProfile(req.user.id) });
  } catch (e) {
    res.status(500).json({ error: "vpatient_boot_failed", stage: "boot", message: String(e.message || e).slice(0, 200) });
  }
});

/* Warm the browse pool right after boot (off the request path) so the first
   learner does not pay the ~1 s JSON parse of the whole bank. */
export function prewarmLearnCaches() {
  try { browsePool(); } catch { /* best-effort */ }
}
export default r;
