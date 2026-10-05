/* import-arak-from-word.js — حذف دانشجویان دمو و ورود 85 دانشجوی اراک از دو فایل ورد */
import { initDb, db, persistNow } from "../server/src/db.js";
import { hashPasswordSync } from "../server/src/lib/password.js";
import { audit } from "../server/src/lib/audit.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
// Word files are at repo root after upload
const WORD_FILES = [
  path.join(PROJECT_ROOT, "..", "..", "لیست دانشجویان اتاق عمل.docx"),
  path.join(PROJECT_ROOT, "..", "..", "لیست دانشجویان کارآموز.docx"),
  // fallback if moved to uploads
  path.join(PROJECT_ROOT, "..", "..", "uploads", "لیست دانشجویان اتاق عمل.docx"),
  path.join(PROJECT_ROOT, "..", "..", "uploads", "لیست دانشجویان کارآموز.docx"),
];

async function main() {
  await initDb();
  // ensure schema
  const { initSchema } = await import("../server/src/db.js");
  initSchema();

  // Find universities
  const arak = db.prepare("SELECT id, code, name_fa FROM universities WHERE code='ARAK'").get() || db.prepare("SELECT id, code, name_fa FROM universities WHERE name_fa LIKE '%اراک%'").get();
  const demo = db.prepare("SELECT id, code, name_fa FROM universities WHERE code='DEFAULT'").get() || db.prepare("SELECT id FROM universities WHERE id=1").get();
  console.log("[info] Arak university:", arak);
  console.log("[info] Demo university:", demo);

  if (!arak) {
    console.error("Arak university not found! Creating...");
    const r = db.prepare("INSERT INTO universities (name_fa, name_en, city_fa, city_en, code, active) VALUES (?,?,?,?,?,1)").run("دانشگاه علوم پزشکی اراک", "Arak University of Medical Sciences", "اراک", "Arak", "ARAK");
    console.log("created Arak id", r.lastInsertRowid);
  }
  const arakId = arak?.id || db.prepare("SELECT id FROM universities WHERE code='ARAK'").get().id;
  const demoId = demo?.id || 1;

  // --- 1) حذف کامل دانشجویان دمو ---
  console.log(`\n[step] حذف دانشجویان دمو (university_id=${demoId})...`);
  const demoStudents = db.prepare("SELECT id, username, student_no, name_fa FROM users WHERE role='student' AND university_id=?").all(demoId);
  console.log(`  found ${demoStudents.length} demo students`);
  let deleted = 0;
  const delTx = db.transaction(() => {
    for (const u of demoStudents) {
      // cascade deletes
      db.prepare("DELETE FROM class_members WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM exam_participants WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM attempts WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM learner_profiles WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM xp_events WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM node_progress WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM srs_state WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM card_attempts WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM notifications WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM support_tickets WHERE user_id=?").run(u.id);
      db.prepare("DELETE FROM audit_log WHERE actor_id=?").run(u.id);
      db.prepare("DELETE FROM users WHERE id=?").run(u.id);
      deleted++;
    }
  });
  if (demoStudents.length) {
    delTx();
    console.log(`  deleted ${deleted} demo students`);
    // also delete any students with NULL university_id as demo legacy
    const nullStudents = db.prepare("SELECT id FROM users WHERE role='student' AND university_id IS NULL").all();
    if (nullStudents.length) {
      console.log(`  also found ${nullStudents.length} students with NULL university, deleting...`);
      for (const u of nullStudents) {
        db.prepare("DELETE FROM users WHERE id=?").run(u.id);
        deleted++;
      }
    }
  } else {
    console.log("  no demo students to delete");
  }

  // --- 2) استخراج از ورد ---
  console.log("\n[step] استخراج از فایل‌های ورد...");
  let allStudents = [];
  // Use python-docx via child process for robust extraction, fallback to simple zip parsing
  // We'll try node docx if available, else use python
  const { execSync } = await import("child_process");
  let usePython = true;
  try {
    execSync("python3 -c 'import docx; print(1)'", { stdio: "ignore" });
  } catch { usePython = false; }

  for (const f of WORD_FILES) {
    if (!fs.existsSync(f)) continue;
    console.log(`  reading ${f} ...`);
    try {
      const out = execSync(`python3 ${JSON.stringify(path.join(__dirname, "extract-word.py"))} ${JSON.stringify(f)}`, { encoding: "utf-8" });
      const parsed = JSON.parse(out);
      console.log(`    -> ${parsed.length} دانشجو`);
      allStudents.push(...parsed);
    } catch (e) {
      console.error(`    failed for ${f}:`, e.message);
      console.error(e.stdout || e.stderr || "");
    }
  }
  // If python failed, try direct extraction via simple method
  if (!allStudents.length) {
    console.error("No students extracted via python, trying fallback...");
    // fallback: try to read via Node (if we had mammoth) - skip
  }

  console.log(`\n[info] مجموع استخراج شده: ${allStudents.length}`);
  // deduplicate by student_no
  const byNo = new Map();
  for (const s of allStudents) {
    const no = String(s.student_no || "").trim();
    if (!no) continue;
    if (!byNo.has(no)) byNo.set(no, s);
    else {
      // keep first, log duplicate
      console.log(`  duplicate in files ignored: ${no}`);
    }
  }
  const uniq = Array.from(byNo.values());
  console.log(`  یکتا: ${uniq.length}`);

  // --- 3) ورود به اراک ---
  console.log(`\n[step] ورود به دانشگاه اراک (id=${arakId})...`);
  let inserted = 0, skippedExists = 0, skippedInvalid = 0, healed = 0;
  const existingNos = new Set(db.prepare("SELECT student_no FROM users WHERE student_no IS NOT NULL").all().map(r=>String(r.student_no)));
  const toInsert = [];
  for (const s of uniq) {
    const no = String(s.student_no).trim().replace(/\u200c/g, "");
    if (!/^\d{8,16}$/.test(no)) {
      console.log(`  invalid no skipped: ${no} (${s.first} ${s.family})`);
      skippedInvalid++;
      continue;
    }
    if (existingNos.has(no)) {
      // check if existing is same university? if different, we will update university_id to Arak and count as healed
      const existing = db.prepare("SELECT id, university_id, name_fa FROM users WHERE student_no=?").get(no);
      if (existing && existing.university_id !== arakId) {
        console.log(`  healing ${no} from uni ${existing.university_id} -> ${arakId} (${existing.name_fa})`);
        db.prepare("UPDATE users SET university_id=? WHERE id=?").run(arakId, existing.id);
        healed++;
        // also ensure name is correct? update if missing
        if (!existing.name_fa || existing.name_fa === no) {
          const fullName = [s.first, s.family].filter(Boolean).join(" ").trim() || no;
          db.prepare("UPDATE users SET name_fa=?, name_en=? WHERE id=?").run(fullName, fullName, existing.id);
        }
        inserted++; // count as handled
      } else {
        skippedExists++;
      }
      continue;
    }
    toInsert.push(s);
  }

  console.log(`  to insert new: ${toInsert.length}, already exists (healed): ${healed}, skipped invalid: ${skippedInvalid}`);

  const insTx = db.transaction(() => {
    for (const s of toInsert) {
      const fullName = [s.first, s.family].filter(Boolean).join(" ").trim() || s.student_no;
      // username = student_no, password = student_no hashed
      const hash = hashPasswordSync(String(s.student_no));
      try {
        db.prepare("INSERT INTO users (username, password_hash, name_fa, name_en, student_no, role, status, university_id) VALUES (?,?,?,?,?,?,?,?)")
          .run(String(s.student_no), hash, fullName, fullName, String(s.student_no), "student", "active", arakId);
        inserted++;
        existingNos.add(String(s.student_no));
      } catch (e) {
        if (String(e.message).includes("UNIQUE") || String(e.message).includes("student_no")) {
          skippedExists++;
        } else {
          console.error("  insert failed for", s.student_no, e.message);
          skippedInvalid++;
        }
      }
    }
  });
  if (toInsert.length) insTx();

  console.log(`\n[result] حذف دمو: ${deleted} نفر`);
  console.log(`[result] استخراج: ${allStudents.length} ردیف از ورد`);
  console.log(`[result] یکتا: ${uniq.length}`);
  console.log(`[result] وارد شده جدید: ${inserted - healed} نفر`);
  console.log(`[result] ترمیم دانشگاه (موجود بود): ${healed} نفر`);
  console.log(`[result] تکراری موجود (بدون تغییر): ${skippedExists} نفر`);
  console.log(`[result] نامعتبر: ${skippedInvalid} نفر`);

  // verify
  const arakCount = db.prepare("SELECT COUNT(*) c FROM users WHERE role='student' AND university_id=?").get(arakId).c;
  const demoCountAfter = db.prepare("SELECT COUNT(*) c FROM users WHERE role='student' AND university_id=?").get(demoId).c;
  console.log(`\n[verify] دانشجویان اراک اکنون: ${arakCount}`);
  console.log(`[verify] دانشجویان دمو باقیمانده: ${demoCountAfter}`);

  // sample
  const sample = db.prepare("SELECT student_no, name_fa, university_id FROM users WHERE university_id=? ORDER BY student_no LIMIT 5").all(arakId);
  console.log("[sample Arak]", sample);

  persistNow({ force: true });
  console.log("\n[done] persistNow done");

  // audit
  try {
    audit({ user: { id: 1, username: "system" } }, "arak.import", `universities:${arakId}`, { deletedDemo: deleted, inserted, healed, totalArak: arakCount });
  } catch {}

  // write report
  const report = {
    demoDeleted: deleted,
    extracted: allStudents.length,
    unique: uniq.length,
    insertedNew: inserted - healed,
    healed,
    skippedExists,
    skippedInvalid,
    arakTotal: arakCount,
    demoRemaining: demoCountAfter,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(PROJECT_ROOT, "..", "..", "ARAK-IMPORT-REPORT-2026-10-04.json"), JSON.stringify(report, null, 2), "utf-8");
  console.log("[report] written to ARAK-IMPORT-REPORT-2026-10-04.json");
}

main().catch(e => { console.error(e); process.exit(1); });
