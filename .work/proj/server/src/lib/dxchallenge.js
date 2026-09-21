/* dxchallenge.js — Daily Diagnosis Challenge.

   An ORIGINAL clinical-reasoning game in the popular Wordle-style "guess the
   diagnosis" format: the player reads an opening vignette, picks a diagnosis
   from a shortlist, and each wrong guess reveals the next clue (labs, exam,
   history, imaging). Fewer guesses = better. Solving keeps the daily streak.

   IMPORTANT: every case is authored by the admin in our own panel. Nothing is
   copied from any third-party game — only the general daily-puzzle format is
   shared (the same way many "…dle" games share the Wordle mechanic).

   Public state never leaks the answer or unrevealed clues. */
import { db, persistNow } from "../db.js";
import { getGameConfig } from "./gameconfig.js";
import { tehranDay, awardXp, getProfile } from "./gamify.js";

function norm(s) {
  return (s || "").toString().toLowerCase()
    .replace(/[ي]/g, "ی").replace(/[ك]/g, "ک")
    .replace(/[ًٌٍَُِّْ]/g, "").replace(/[.,،؛;:()\-]/g, " ")
    .replace(/\s+/g, " ").trim();
}
const J = (s, d = []) => { try { return JSON.parse(s); } catch { return d; } };
const L = (o, base, lang) => (lang === "fa" ? (o[base + "_fa"] || o[base + "_en"]) : (o[base + "_en"] || o[base + "_fa"])) || "";

/* Deterministically choose today's case:
   1) a case explicitly scheduled for today wins;
   2) otherwise rotate through active cases by day number (stable per day). */
export function todaysCase(day = tehranDay()) {
  const pinned = db.prepare("SELECT * FROM dx_cases WHERE active=1 AND scheduled_day=?").get(day);
  if (pinned) return pinned;
  const cases = db.prepare("SELECT * FROM dx_cases WHERE active=1 AND (scheduled_day IS NULL OR scheduled_day='') ORDER BY ord ASC, id ASC").all();
  if (!cases.length) return null;
  const epoch = Math.floor(new Date(day + "T00:00:00Z").getTime() / 86400000);
  return cases[((epoch % cases.length) + cases.length) % cases.length];
}

function ensureAttempt(userId, caseRow, day) {
  let a = db.prepare("SELECT * FROM dx_attempts WHERE user_id=? AND case_id=?").get(userId, caseRow.id);
  if (!a) {
    db.prepare("INSERT INTO dx_attempts (user_id, case_id, day, guesses_json, revealed, solved, finished) VALUES (?,?,?,?,?,0,0)")
      .run(userId, caseRow.id, day, "[]", 1);
    a = db.prepare("SELECT * FROM dx_attempts WHERE user_id=? AND case_id=?").get(userId, caseRow.id);
  }
  return a;
}

/* Build the SAFE public view for the player (no answer, only revealed clues). */
function publicView(caseRow, attempt, lang) {
  const clues = J(caseRow.clues_json);
  const optionsBiRaw = J(caseRow.options_json);   // [{fa,en}] — for the smart search box
  const options = optionsBiRaw.map((o) => (lang === "fa" ? (o.fa || o.en) : (o.en || o.fa)));
  const maxG = caseRow.max_guesses || getGameConfig().dx.max_guesses || 6;
  const guesses = J(attempt.guesses_json);
  const revealed = Math.min(clues.length, Math.max(1, attempt.revealed) - 1); // clues shown AFTER the vignette
  const view = {
    caseId: caseRow.id,
    day: attempt.day,
    category: L(caseRow, "category", lang),
    vignette: L(caseRow, "vignette", lang),
    difficulty: caseRow.difficulty,
    maxGuesses: maxG,
    // clues revealed so far (one new clue per wrong guess)
    clues: clues.slice(0, revealed).map((c) => (lang === "fa" ? (c.fa || c.en) : (c.en || c.fa))),
    totalClues: clues.length,
    options: shuffleStable(options, caseRow.id),
    // bilingual options (stable order) so the client can render a smart search
    // box like the university flashcards ({fa,en} pairs)
    optionsBi: shuffleStable(optionsBiRaw.filter((o) => o && (o.fa || o.en)), caseRow.id),
    guesses: guesses.map((g) => ({ text: g.text, correct: !!g.correct })),
    guessesLeft: Math.max(0, maxG - guesses.length),
    solved: !!attempt.solved,
    finished: !!attempt.finished,
  };
  // reveal the answer + explanation only once the round is over
  if (attempt.finished) {
    view.answer = L(caseRow, "answer", lang);
    view.explanation = L(caseRow, "explanation", lang);
    view.allClues = clues.map((c) => (lang === "fa" ? (c.fa || c.en) : (c.en || c.fa)));
  }
  return view;
}

// stable per-case shuffle so options don't jump around between requests
function shuffleStable(arr, seed) {
  const a = [...arr];
  let s = seed * 2654435761 % 2147483647;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getDaily(userId, lang = "fa") {
  const day = tehranDay();
  const caseRow = todaysCase(day);
  if (!caseRow) return { available: false };
  const attempt = ensureAttempt(userId, caseRow, day);
  return { available: true, ...publicView(caseRow, attempt, lang) };
}

/* Is `guess` the correct diagnosis? Matches the display answer or any alias. */
function isCorrect(caseRow, guess) {
  const ng = norm(guess);
  if (!ng) return false;
  const candidates = [caseRow.answer_fa, caseRow.answer_en, ...J(caseRow.aliases_json)]
    .filter(Boolean).map(norm);
  return candidates.some((c) => c === ng);
}

/* Submit a guess. Returns the updated public view (+ awards on solve). */
export function submitGuess(userId, caseId, guess, lang = "fa") {
  const caseRow = db.prepare("SELECT * FROM dx_cases WHERE id=? AND active=1").get(caseId);
  if (!caseRow) return { error: "not_found" };
  const day = tehranDay();
  const attempt = ensureAttempt(userId, caseRow, day);
  if (attempt.finished) return publicView(caseRow, attempt, lang);

  const clues = J(caseRow.clues_json);
  const maxG = caseRow.max_guesses || getGameConfig().dx.max_guesses || 6;
  const guesses = J(attempt.guesses_json);
  const correct = isCorrect(caseRow, guess);
  guesses.push({ text: String(guess || "").slice(0, 120), correct });

  let revealed = attempt.revealed;
  let solved = 0, finished = 0;
  if (correct) { solved = 1; finished = 1; }
  else {
    revealed = Math.min(clues.length + 1, attempt.revealed + 1); // reveal next clue
    if (guesses.length >= maxG) finished = 1; // out of guesses
  }

  db.prepare("UPDATE dx_attempts SET guesses_json=?, revealed=?, solved=?, finished=?, updated_at=datetime('now') WHERE id=?")
    .run(JSON.stringify(guesses), revealed, solved, finished, attempt.id);
  persistNow();

  let awards = null;
  if (solved) awards = grantSolveRewards(userId, guesses.length, maxG);
  else if (finished) awards = grantEffortReward(userId);   // consolation for trying

  const fresh = db.prepare("SELECT * FROM dx_attempts WHERE id=?").get(attempt.id);
  const view = publicView(caseRow, fresh, lang);
  view.lastGuessCorrect = correct;
  if (awards) view.awards = awards;
  return view;
}

/* Reward for SOLVING — scaled by how well the learner did. The reward tapers
   from full (first try) down to a smaller amount if it took several guesses, so
   the celebration truly matches the performance. */
function grantSolveRewards(userId, guessCount, maxG = 6) {
  const cfg = getGameConfig().dx;
  const base = cfg.xp_solved || 40;
  const firstBonus = cfg.xp_first_try_bonus || 0;
  // performance factor: 1.0 on the first guess → ~0.5 on the last allowed guess.
  const steps = Math.max(1, (maxG || 6) - 1);
  const factor = Math.max(0.5, 1 - ((guessCount - 1) / steps) * 0.5);
  let xp = Math.round(base * factor);
  if (guessCount === 1) xp += firstBonus;
  if (cfg.counts_for_streak) awardXp(userId, xp, "dx_challenge");
  else {
    db.prepare("INSERT INTO xp_events (user_id, amount, reason, day) VALUES (?,?,?,?)")
      .run(userId, xp, "dx_challenge", tehranDay());
    db.prepare("UPDATE learner_profiles SET xp=xp+?, weekly_xp=weekly_xp+? WHERE user_id=?").run(xp, xp, userId);
  }
  // gems also scale a bit with performance (first try gets the full amount)
  const gemsFull = cfg.gems_solved || 0;
  const gems = guessCount === 1 ? gemsFull : Math.round(gemsFull * factor);
  if (gems) db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(gems, userId);
  persistNow();
  return { xp, gems, firstTry: guessCount === 1, solved: true, factor: Math.round(factor * 100) };
}

/* Consolation reward for a learner who engaged with the case but didn't solve
   it. Small but real — encourages daily participation without over-rewarding a
   miss. Never touches the streak. */
function grantEffortReward(userId) {
  const cfg = getGameConfig().dx;
  const xp = Math.max(0, cfg.xp_attempt != null ? cfg.xp_attempt : Math.round((cfg.xp_solved || 40) * 0.25));
  if (xp > 0) {
    db.prepare("INSERT INTO xp_events (user_id, amount, reason, day) VALUES (?,?,?,?)")
      .run(userId, xp, "dx_attempt", tehranDay());
    db.prepare("UPDATE learner_profiles SET xp=xp+?, weekly_xp=weekly_xp+? WHERE user_id=?").run(xp, xp, userId);
    persistNow();
  }
  return { xp, gems: 0, firstTry: false, solved: false, effort: true };
}

/* ------------------- ADMIN CRUD ------------------- */
export function listCases() {
  return db.prepare("SELECT * FROM dx_cases ORDER BY ord ASC, id DESC").all().map(serializeAdmin);
}
function serializeAdmin(c) {
  return {
    id: c.id, category_fa: c.category_fa, category_en: c.category_en,
    vignette_fa: c.vignette_fa, vignette_en: c.vignette_en,
    clues: J(c.clues_json), aliases: J(c.aliases_json), options: J(c.options_json),
    answer_fa: c.answer_fa, answer_en: c.answer_en,
    explanation_fa: c.explanation_fa, explanation_en: c.explanation_en,
    difficulty: c.difficulty, max_guesses: c.max_guesses,
    scheduled_day: c.scheduled_day || "", active: !!c.active, ord: c.ord,
  };
}
function clean(d) {
  return {
    category_fa: d.category_fa || null, category_en: d.category_en || null,
    vignette_fa: d.vignette_fa || null, vignette_en: d.vignette_en || null,
    clues_json: JSON.stringify(Array.isArray(d.clues) ? d.clues.filter((x) => x && (x.fa || x.en)) : []),
    answer_fa: d.answer_fa || null, answer_en: d.answer_en || null,
    aliases_json: JSON.stringify(Array.isArray(d.aliases) ? d.aliases.filter(Boolean) : []),
    options_json: JSON.stringify(Array.isArray(d.options) ? d.options.filter((x) => x && (x.fa || x.en)) : []),
    explanation_fa: d.explanation_fa || null, explanation_en: d.explanation_en || null,
    difficulty: ["easy", "medium", "hard"].includes(d.difficulty) ? d.difficulty : "medium",
    max_guesses: Math.max(2, Math.min(10, d.max_guesses | 0 || 6)),
    scheduled_day: (d.scheduled_day || "").trim() || null,
    active: d.active === 0 ? 0 : 1, ord: d.ord | 0,
  };
}
const DX_COLS = ["category_fa", "category_en", "vignette_fa", "vignette_en", "clues_json",
  "answer_fa", "answer_en", "aliases_json", "options_json", "explanation_fa", "explanation_en",
  "difficulty", "max_guesses", "scheduled_day", "active", "ord"];

export function createCase(d = {}) {
  const c = clean(d);
  const vals = DX_COLS.map((k) => c[k]);
  const info = db.prepare(
    `INSERT INTO dx_cases (${DX_COLS.join(",")}) VALUES (${DX_COLS.map(() => "?").join(",")})`
  ).run(...vals);
  persistNow();
  return db.prepare("SELECT * FROM dx_cases WHERE id=?").get(info.lastInsertRowid);
}
export function updateCase(id, d = {}) {
  const cur = db.prepare("SELECT * FROM dx_cases WHERE id=?").get(id);
  if (!cur) return null;
  const c = clean({ ...serializeAdmin(cur), ...d });
  const vals = DX_COLS.map((k) => c[k]);
  db.prepare(
    `UPDATE dx_cases SET ${DX_COLS.map((k) => k + "=?").join(",")} WHERE id=?`
  ).run(...vals, id);
  persistNow();
  return db.prepare("SELECT * FROM dx_cases WHERE id=?").get(id);
}
export function deleteCase(id) {
  db.prepare("DELETE FROM dx_cases WHERE id=?").run(id);
  db.prepare("DELETE FROM dx_attempts WHERE case_id=?").run(id);
  persistNow();
  return true;
}
/* Bulk import from CSV rows. Each row = one case. Columns (any subset, both
   languages supported). Clues/options/aliases are pipe-separated lists.
   Header aliases are tolerant. Only YOUR own content should be imported — the
   tool never fetches anything from the web. Returns {imported, errors[]}. */
const importCol = (row, ...names) => {
  for (const n of names) {
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().trim() === n.toLowerCase()) return row[k];
    }
  }
  return "";
};
const splitList = (s) => String(s || "").split(/[|؛;\n]/).map((x) => x.trim()).filter(Boolean);

export function importCases(rows = []) {
  let imported = 0; const errors = [];
  rows.forEach((row, i) => {
    try {
      const answer_fa = importCol(row, "answer_fa", "answer", "تشخیص", "پاسخ");
      const answer_en = importCol(row, "answer_en");
      const vignette_fa = importCol(row, "vignette_fa", "vignette", "وینیت", "شرح");
      if (!answer_fa && !answer_en) { errors.push({ row: i + 1, error: "missing answer" }); return; }
      if (!vignette_fa && !importCol(row, "vignette_en")) { errors.push({ row: i + 1, error: "missing vignette" }); return; }
      const cluesFa = splitList(importCol(row, "clues_fa", "clues", "سرنخ‌ها", "سرنخ"));
      const cluesEn = splitList(importCol(row, "clues_en"));
      const clues = cluesFa.map((fa, j) => ({ fa, en: cluesEn[j] || "" }));
      if (!clues.length && cluesEn.length) cluesEn.forEach((en) => clues.push({ fa: "", en }));
      const optsFa = splitList(importCol(row, "options_fa", "options", "گزینه‌ها"));
      const optsEn = splitList(importCol(row, "options_en"));
      const options = optsFa.map((fa, j) => ({ fa, en: optsEn[j] || "" }));
      if (!options.length && optsEn.length) optsEn.forEach((en) => options.push({ fa: "", en }));
      // ensure the answer is among the options
      const ansInOpts = options.some((o) => norm(o.fa) === norm(answer_fa) || norm(o.en) === norm(answer_en));
      if (!ansInOpts && (answer_fa || answer_en)) options.push({ fa: answer_fa, en: answer_en });
      createCase({
        category_fa: importCol(row, "category_fa", "category", "دسته"),
        category_en: importCol(row, "category_en"),
        vignette_fa, vignette_en: importCol(row, "vignette_en"),
        clues, answer_fa, answer_en,
        aliases: splitList(importCol(row, "aliases", "aliases_fa", "معادل‌ها")),
        options,
        explanation_fa: importCol(row, "explanation_fa", "explanation", "توضیح"),
        explanation_en: importCol(row, "explanation_en"),
        difficulty: (importCol(row, "difficulty", "سختی") || "medium").toLowerCase(),
        max_guesses: parseInt(importCol(row, "max_guesses"), 10) || 6,
        scheduled_day: importCol(row, "scheduled_day", "date", "تاریخ"),
        active: 1,
      });
      imported++;
    } catch (e) { errors.push({ row: i + 1, error: String(e.message || e) }); }
  });
  return { imported, errors };
}

export function importTemplate() {
  return [
    "category_fa,category_en,vignette_fa,vignette_en,clues_fa,clues_en,answer_fa,answer_en,aliases,options_fa,options_en,explanation_fa,explanation_en,difficulty,max_guesses",
    'قلب,Cardiology,مرد ۶۰ ساله با درد قفسه سینه,60-year-old man with chest pain,"درد به بازوی چپ می‌زند | تروپونین بالا","Radiates to left arm | High troponin",سکته قلبی,Myocardial infarction,"mi|stemi","سکته قلبی|آنژین|پریکاردیت","Myocardial infarction|Angina|Pericarditis",توضیح نمونه,Sample explanation,medium,6',
  ].join("\n");
}

export function adminStats() {
  const total = db.prepare("SELECT COUNT(*) c FROM dx_cases").get().c;
  const active = db.prepare("SELECT COUNT(*) c FROM dx_cases WHERE active=1").get().c;
  const played = db.prepare("SELECT COUNT(*) c FROM dx_attempts").get().c;
  const solved = db.prepare("SELECT COUNT(*) c FROM dx_attempts WHERE solved=1").get().c;
  return { total, active, played, solved, solveRate: played ? Math.round((solved / played) * 100) : 0 };
}
