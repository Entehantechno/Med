// Explicit academic provisioning. Stable source claims prevent re-import after
// edits or deletion. Never creates competitive virtual patients.
import { initDb, initSchema, db, persistNow } from './db.js';
import { EMERGENCY_TEN } from './data/vp-emergency-ten.js';
await initDb(); initSchema();
const universityId = Number(process.env.UNIVERSITY_ID) || db.prepare("SELECT id FROM universities WHERE code='ARAK'").get()?.id;
if (!universityId || !db.prepare('SELECT id FROM universities WHERE id=?').get(universityId)) throw new Error('University required');
let inserted = 0;
for (const [i,c] of EMERGENCY_TEN.entries()) {
  const key = `medschool:emergency:${i+1}:university:${universityId}`;
  if (db.prepare("SELECT 1 FROM content_identity_registry WHERE kind='cases' AND source_key=?").get(key)) continue;
  const legacy = db.prepare('SELECT id,data_json FROM cases WHERE university_id=?').all(universityId)
    .find(r => JSON.parse(r.data_json).title_fa === c.data.title_fa);
  if (legacy) db.prepare('UPDATE cases SET source_key=? WHERE id=? AND source_key IS NULL').run(key,legacy.id);
  else {
    db.prepare('INSERT INTO cases(difficulty,checklist_id,data_json,university_id,source_key) VALUES (?,?,?,?,?)')
      .run(c.difficulty,c.checklist_id,JSON.stringify({...c.data,track:'uni'}),universityId,key);
    inserted++;
  }
}
persistNow({throwOnError:true}); console.log({inserted});
