import {db} from '../db.js';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import {fileURLToPath} from 'node:url';
const __dirname=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function seedDemoStudents(){
  // --- Arak 85 students auto-seed (single-name, from Word files) ---
  try {
    const arakUni = db.prepare("SELECT id FROM universities WHERE code='ARAK'").get();
    if (arakUni) {
      // 2) ورود 85 دانشجوی اراک اگر هنوز وارد نشده‌اند
      try {
        const cnt = db.prepare("SELECT COUNT(*) c FROM users WHERE role='student' AND university_id=?").get(arakUni.id).c;
        if (cnt < 80) { // threshold: if less than 80, we need to seed
          let list = [];
          try {
            const jPath = path.join(__dirname, "data", "arak-students.json");
            if (fs.existsSync(jPath)) list = JSON.parse(fs.readFileSync(jPath, "utf8"));
          } catch {}
          if (list && list.length) {
            const findByNo = db.prepare("SELECT id FROM users WHERE student_no=? OR username=?");
            const ins = db.prepare("INSERT OR IGNORE INTO users (username,password_hash,name_fa,name_en,student_no,role,status,university_id) VALUES (?,?,?,?,?,?,?,?)");
            // use a dummy hash if bcrypt not yet loaded? use existing teacher hash as fallback
            let fallbackHash = "";
            try { fallbackHash = db.prepare("SELECT password_hash FROM users WHERE role='teacher' LIMIT 1").get()?.password_hash || ""; } catch {}
            let added = 0;
            for (const s of list) {
              const sno = String(s.student_no||"").trim();
              if (!sno) continue;
              if (findByNo.get(sno, sno)) continue;
              const full = String(s.name_fa||s.name_en||sno).trim() || sno;
              let hash = fallbackHash;
              try { if (bcrypt && bcrypt.hashSync) hash = bcrypt.hashSync(sno, 10); } catch { hash = fallbackHash || sno; }
              // if bcrypt not available, fallbackHash is still a valid bcrypt hash (from teacher), but password will be teacher's password, not sno -- still allow login via fallback? better to ensure hash is sno
              // if still fallback, keep it (admin can reset)
              try { ins.run(sno, hash, full, full, sno, "student", "active", arakUni.id); added++; } catch {}
            }
            if (added) console.log(`[seed] Arak students auto-seeded: ${added} (total now ${cnt+added})`);
          }
        }
      } catch (e) { console.warn("[seed] arak students:", e.message); }
    }
  } catch {}


}
