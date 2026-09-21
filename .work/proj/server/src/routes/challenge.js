/* challenge.js — asynchronous 1v1 challenges (Duolingo-style match).
   A learner creates a challenge on a topic → gets a share code. Another learner
   joins with the code → both face the SAME fixed question set separately →
   scores (correct, then time) are compared → winner gets XP. */
import { Router } from "express";
import crypto from "crypto";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { getProfile, awardXp } from "../lib/gamify.js";
import { serializeCard } from "../lib/cardserialize.js";
import { notify } from "../lib/notify.js";
import { isEnabled } from "../lib/flags.js";

const r = Router();
const flagGate = (key) => (req, res, next) => isEnabled(key) ? next() : res.status(403).json({ error: "feature disabled", flag: key });
const learner = [authRequired, requireRole("learner"), flagGate("challenges")];
const L = (req) => (req.query.lang === "en" ? "en" : "fa");
// Join codes are bearer secrets (anyone holding one joins the match) → CSPRNG.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code6 = () => Array.from({ length: 6 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join("");
const nameOf = (uid, lang) => {
  const u = db.prepare("SELECT name_fa, name_en FROM users WHERE id=?").get(uid);
  return !u ? "" : (lang === "fa" ? (u.name_fa || u.name_en) : (u.name_en || u.name_fa));
};

// pick N random active cards from a topic (fallback: any active cards)
function pickCards(topicId, n = 5) {
  let nodes = db.prepare("SELECT card_ids FROM path_nodes WHERE topic_id=? AND active=1").all(topicId);
  let ids = [];
  for (const nd of nodes) { try { ids.push(...JSON.parse(nd.card_ids || "[]")); } catch { /* */ } }
  ids = [...new Set(ids)];
  if (ids.length < n) {
    const extra = db.prepare("SELECT id FROM flashcards WHERE active=1 ORDER BY RANDOM() LIMIT ?").all(n).map((x) => x.id);
    ids = [...new Set([...ids, ...extra])];
  }
  // shuffle & slice
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, n);
}

/* create a challenge */
r.post("/create", ...learner, (req, res) => {
  const topicId = parseInt(req.body?.topicId, 10) || null;
  const cards = pickCards(topicId, 5);
  const code = code6();
  const info = db.prepare(`INSERT INTO challenges (code, topic_id, card_ids, creator_id, status, xp_stake)
    VALUES (?,?,?,?,'open',?)`).run(code, topicId, JSON.stringify(cards), req.user.id, 30);
  persistNow();
  res.json({ id: info.lastInsertRowid, code });
});

/* QUICK MATCH — auto-matchmaking that competitors don't offer:
   join any waiting opponent's open challenge, or create one and wait. */
r.post("/quick", ...learner, (req, res) => {
  // find an open challenge created by SOMEONE ELSE with no opponent yet
  const open = db.prepare(
    "SELECT * FROM challenges WHERE status='open' AND creator_id<>? AND opponent_id IS NULL ORDER BY id ASC LIMIT 1"
  ).get(req.user.id);
  if (open) {
    db.prepare("UPDATE challenges SET opponent_id=?, status='active' WHERE id=?").run(req.user.id, open.id);
    persistNow();
    notify(open.creator_id, {
      kind: "challenge", icon: "trophy", link: "challenge",
      title_fa: "⚔️ حریف پیدا شد!", title_en: "⚔️ Opponent joined!",
      body_fa: `${nameOf(req.user.id, "fa")} به مبارزهٔ سریع تو پیوست.`,
      body_en: `${nameOf(req.user.id, "en")} joined your quick match.`,
    });
    return res.json({ id: open.id, matched: true });
  }
  // none waiting → create one and wait for an opponent
  const cards = pickCards(null, 5);
  const info = db.prepare(`INSERT INTO challenges (code, topic_id, card_ids, creator_id, status, xp_stake)
    VALUES (?,?,?,?,'open',?)`).run(code6(), null, JSON.stringify(cards), req.user.id, 30);
  persistNow();
  res.json({ id: info.lastInsertRowid, matched: false, waiting: true });
});

/* list my challenges (created or joined) */
r.get("/mine", ...learner, (req, res) => {
  const lang = L(req);
  const rows = db.prepare(`
    SELECT * FROM challenges WHERE creator_id=? OR opponent_id=? ORDER BY id DESC LIMIT 30`).all(req.user.id, req.user.id);
  const out = rows.map((c) => {
    const results = db.prepare("SELECT * FROM challenge_results WHERE challenge_id=?").all(c.id);
    const mine = results.find((x) => x.user_id === req.user.id);
    const other = results.find((x) => x.user_id !== req.user.id);
    const otherId = c.creator_id === req.user.id ? c.opponent_id : c.creator_id;
    return {
      id: c.id, code: c.code, status: c.status, xp_stake: c.xp_stake,
      role: c.creator_id === req.user.id ? "creator" : "opponent",
      opponentName: otherId ? nameOf(otherId, lang) : null,
      myDone: !!mine?.finished_at, myScore: mine ? `${mine.correct}/${mine.total}` : null,
      otherDone: !!other?.finished_at, otherScore: other ? `${other.correct}/${other.total}` : null,
      winnerId: c.winner_id, iWon: c.winner_id === req.user.id, tie: c.status === "finished" && !c.winner_id,
    };
  });
  res.json({ challenges: out });
});

/* join a challenge by code */
r.post("/join", ...learner, (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  const c = db.prepare("SELECT * FROM challenges WHERE code=?").get(code);
  if (!c) return res.status(404).json({ error: "not found" });
  if (c.creator_id === req.user.id) return res.status(400).json({ error: "cannot join own" });
  if (c.opponent_id && c.opponent_id !== req.user.id) return res.status(409).json({ error: "already full" });
  if (!c.opponent_id) {
    db.prepare("UPDATE challenges SET opponent_id=?, status='active' WHERE id=?").run(req.user.id, c.id);
    persistNow();
    notify(c.creator_id, {
      kind: "challenge", icon: "trophy", link: "challenge",
      title_fa: "⚔️ حریف پیدا شد!", title_en: "⚔️ Opponent joined!",
      body_fa: `${nameOf(req.user.id, "fa")} چالش تو را پذیرفت.`, body_en: `${nameOf(req.user.id, "en")} accepted your challenge.`,
    });
  }
  res.json({ id: c.id });
});

/* get the challenge's question set to play */
r.get("/:id/play", ...learner, (req, res) => {
  const lang = L(req);
  const c = db.prepare("SELECT * FROM challenges WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  if (c.creator_id !== req.user.id && c.opponent_id !== req.user.id) return res.status(403).json({ error: "not a participant" });
  const done = db.prepare("SELECT * FROM challenge_results WHERE challenge_id=? AND user_id=?").get(c.id, req.user.id);
  if (done?.finished_at) return res.status(409).json({ error: "already played" });
  let ids = []; try { ids = JSON.parse(c.card_ids || "[]"); } catch { ids = []; }
  const cards = ids.map((id) => db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=?").get(id)).filter(Boolean).map((x) => serializeCard(x, lang));
  res.json({ challenge: { id: c.id, code: c.code, xp_stake: c.xp_stake }, cards });
});

/* submit my result → compute winner when both have played */
r.post("/:id/submit", ...learner, (req, res) => {
  const c = db.prepare("SELECT * FROM challenges WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  if (c.creator_id !== req.user.id && c.opponent_id !== req.user.id) return res.status(403).json({ error: "not a participant" });
  // Both players face the same fixed set (c.card_ids) — bound the self-reported
  // tally by it so nobody "wins" with correct=999 on a 10-question duel.
  let setSize = 0;
  try { setSize = JSON.parse(c.card_ids || "[]").length; } catch { setSize = 0; }
  let total = Math.max(1, parseInt(req.body?.total ?? 1, 10) || 1);
  if (setSize > 0) total = setSize;              // the duel's real size wins
  const correct = Math.min(total, Math.max(0, parseInt(req.body?.correct ?? 0, 10) || 0));
  const timeMs = Math.max(0, parseInt(req.body?.time_ms ?? 0, 10) || 0);
  db.prepare(`INSERT OR REPLACE INTO challenge_results (id, challenge_id, user_id, correct, total, time_ms, finished_at)
    VALUES ((SELECT id FROM challenge_results WHERE challenge_id=? AND user_id=?), ?,?,?,?,?, datetime('now'))`)
    .run(c.id, req.user.id, c.id, req.user.id, correct, total, timeMs);

  const results = db.prepare("SELECT * FROM challenge_results WHERE challenge_id=? AND finished_at IS NOT NULL").all(c.id);
  let outcome = { finished: false };
  if (results.length >= 2 && c.opponent_id) {
    // winner: more correct, tie-break by faster time
    const [a, b] = results;
    let winner = null;
    if (a.correct !== b.correct) winner = a.correct > b.correct ? a.user_id : b.user_id;
    else if (a.time_ms !== b.time_ms) winner = a.time_ms < b.time_ms ? a.user_id : b.user_id;
    db.prepare("UPDATE challenges SET status='finished', winner_id=? WHERE id=?").run(winner, c.id);
    // award XP: winner full stake, loser gets a small consolation; tie splits
    if (winner) {
      awardXp(winner, c.xp_stake, "challenge_win", null);
      const loser = winner === a.user_id ? b.user_id : a.user_id;
      awardXp(loser, Math.round(c.xp_stake / 3), "challenge_played", null);
      [winner, loser].forEach((uid) => notify(uid, {
        kind: "challenge", icon: "trophy", link: "challenge",
        title_fa: uid === winner ? "🏆 بردی!" : "چالش تمام شد", title_en: uid === winner ? "🏆 You won!" : "Challenge finished",
        body_fa: uid === winner ? "در چالش برنده شدی و XP گرفتی." : "این بار نشد؛ دوباره امتحان کن!",
        body_en: uid === winner ? "You won the challenge and earned XP." : "Not this time — try again!",
      }));
    } else {
      results.forEach((rr) => awardXp(rr.user_id, Math.round(c.xp_stake / 2), "challenge_tie", null));
    }
    outcome = { finished: true, winnerId: winner, tie: !winner };
  }
  persistNow();
  res.json({ ...outcome, myScore: `${correct}/${total}` });
});

export default r;
