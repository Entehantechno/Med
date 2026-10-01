/* seed-emergency-ten.js — idempotent injector for the 10 Emergency cases.
   Run: node src/seed-emergency-ten.js  (inside server/)
   Safe to run repeatedly: skips any case whose title already exists. */
import { initDb, db, persistNow } from "./db.js";
import { EMERGENCY_TEN } from "./data/vp-emergency-ten.js";

await initDb();
const existing = db.prepare("SELECT data_json FROM cases WHERE active=1").all();
const titles = new Set(existing.map(r => {
  try { const d = JSON.parse(r.data_json); return (d.title_fa||"").trim(); } catch { return ""; }
}));

let inserted = 0, skipped = 0;
for (const c of EMERGENCY_TEN) {
  const title = (c.data.title_fa||"").trim();
  if (titles.has(title)) { skipped++; continue; }
  db.prepare(`INSERT INTO cases (version,difficulty,checklist_id,data_json,active) VALUES (1,?,?,?,1)`)
    .run(c.difficulty, c.checklist_id, JSON.stringify(c.data));
  inserted++;
  titles.add(title);
}
persistNow({ force: true });
console.log(`[emergency-ten] inserted=${inserted} skipped=${skipped} total=${EMERGENCY_TEN.length}`);
