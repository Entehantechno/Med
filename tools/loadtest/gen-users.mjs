#!/usr/bin/env node
// Fill a COPY of medlab.db with synthetic users and activity to test scale.
//
//   node tools/loadtest/gen-users.mjs <copy-of-medlab.db> [users=50000] --i-know-this-is-a-copy
//
// Safety: refuses to run without --i-know-this-is-a-copy, and refuses a path
// that looks like a live data folder. Never point it at production data.
// Passwords reuse the seeded "demo" hash so every synthetic login works.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const Database = require(path.join(path.dirname(new URL(import.meta.url).pathname), "../../server/node_modules/better-sqlite3"));

const args = process.argv.slice(2);
const dbPath = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const count = Number(args.find((a) => /^\d+$/.test(a))) || 50000;
if (!dbPath || !args.includes("--i-know-this-is-a-copy")) {
  console.error("usage: gen-users.mjs <copy.db> [users] --i-know-this-is-a-copy");
  process.exit(2);
}
if (/(^|\/)(data|backups)(\/|$)/.test(path.resolve(dbPath)) && !/scratch|loadtest|copy/i.test(dbPath)) {
  console.error("refusing: path looks like live data; use a scratch copy");
  process.exit(2);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = OFF"); // synthetic data on a scratch copy: speed over durability
const rnd = (n) => Math.floor(Math.random() * n);
const pastDay = (days) => { const d = new Date(Date.now() - days * 864e5); return d.toISOString().slice(0, 10); };
const pastTs = (days) => new Date(Date.now() - days * 864e5 - rnd(864e5)).toISOString().replace("T", " ").slice(0, 19);

const hash = db.prepare("SELECT password_hash h FROM users WHERE username='teacher'").get()?.h;
if (!hash) { console.error("no seeded teacher row; seed the copy first"); process.exit(2); }
const uniIds = db.prepare("SELECT id FROM universities").all().map((r) => r.id);
const cardCount = db.prepare("SELECT COUNT(*) c FROM flashcards").get().c;
const existingUsers = db.prepare("SELECT COUNT(*) c FROM users").get().c;

const tx = (fn) => db.transaction(fn)();
const insUser = db.prepare(`INSERT INTO users (username, password_hash, name_fa, name_en, student_no, role, status, university_id, is_expert)
  VALUES (@username, @hash, @name, @name, @student_no, @role, 'active', @uni, 0)`);
const insProfile = db.prepare(`INSERT OR REPLACE INTO learner_profiles (user_id, xp, weekly_xp, streak, best_streak, last_active, hearts)
  VALUES (?, ?, ?, ?, ?, ?, 5)`);
const insMember = db.prepare("INSERT OR IGNORE INTO class_members (class_id, user_id) VALUES (?, ?)");
const insAttempt = db.prepare("INSERT INTO attempts (user_id, type, score, turns, created_at) VALUES (?, 'case', ?, 0, ?)");
const insXp = db.prepare("INSERT INTO xp_events (user_id, amount, reason, day, created_at) VALUES (?, ?, 'lesson', ?, ?)");
const insCard = db.prepare("INSERT INTO card_attempts (user_id, card_id, node_id, correct, response_ms, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
const insSrs = db.prepare("INSERT OR IGNORE INTO srs_state (user_id, card_id, ease, interval_days, reps, lapses, due, last_reviewed) VALUES (?, ?, 2.5, ?, ?, 0, ?, ?)");

const started = Date.now();
const CHUNK = 5000;
const ids = [];
for (let start = 0; start < count; start += CHUNK) {
  tx(() => {
    for (let i = start; i < Math.min(count, start + CHUNK); i++) {
      const learner = i % 5 === 0; // 20% competitive learners, 80% academic students
      const uid = existingUsers + i + 1;
      const r = insUser.run({
        username: `lt${uid}`, hash, name: `کاربر ${uid}`, student_no: learner ? null : `99${String(uid).padStart(8, "0")}`,
        role: learner ? "learner" : "student", uni: uniIds.length ? uniIds[i % uniIds.length] : null,
      });
      ids.push({ id: Number(r.lastInsertRowid), learner });
    }
  });
}
// Activity: students get attempts, cards, SRS rows; learners get xp and profile rows.
for (let start = 0; start < ids.length; start += CHUNK) {
  tx(() => {
    for (const { id, learner } of ids.slice(start, start + CHUNK)) {
      const streak = rnd(40);
      insProfile.run(id, learner ? rnd(30000) : rnd(3000), rnd(800), streak, streak + rnd(10), pastDay(rnd(3)));
      if (learner) {
        for (let k = 0; k < 15; k++) insXp.run(id, 10 + rnd(40), pastDay(rnd(60)), pastTs(rnd(60)));
      } else {
        insMember.run(1 + (id % 200), id);
        for (let k = 0; k < 3; k++) insAttempt.run(id, rnd(100), pastTs(rnd(90)));
      }
      for (let k = 0; k < 30; k++) {
        const days = rnd(90);
        insCard.run(id, 1 + rnd(cardCount), 1 + rnd(400), rnd(3) ? 1 : 0, 2000 + rnd(15000), pastDay(days), pastTs(days));
      }
      for (let k = 0; k < 20; k++) {
        const due = pastDay(-rnd(30));
        insSrs.run(id, 1 + rnd(cardCount), 1 + rnd(60), rnd(6), due, pastDay(rnd(60)));
      }
    }
  });
}
db.pragma("wal_checkpoint(TRUNCATE)");
const counts = Object.fromEntries(["users", "learner_profiles", "attempts", "xp_events", "card_attempts", "srs_state", "class_members"]
  .map((t) => [t, db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c]));
console.log(JSON.stringify({ added_users: count, seconds: Math.round((Date.now() - started) / 1000), counts }));
db.close();
