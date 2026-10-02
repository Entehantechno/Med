/* bughunt.js — Recurring automated QA + manual bug reports
   Scans for common findings without AI:
     - orphan cards (flashcards not in any path_nodes)
     - broken references (micro.reference code not in reference_catalog)
     - missing golden/points (micro lesson empty)
     - keyless bank cards
     - suspended/buried counts
     - tenant isolation drift (cards without university_id but track!=learn)
   Manual reports are filed by learners/admins via POST /bug-report
   Auto-scans run on demand and on a timer (auto_scan_hours from gameconfig)
*/
import { db, persistNow } from "../db.js";
import { getGameConfig } from "./gameconfig.js";
import { notify } from "./notify.js";

export function listReports({ status, kind, limit = 50 } = {}) {
  let sql = "SELECT b.*, u.name_fa, u.name_en FROM bug_reports b LEFT JOIN users u ON u.id=b.reporter_id WHERE 1=1";
  const params = [];
  if (status) { sql += " AND b.status=?"; params.push(status); }
  if (kind) { sql += " AND b.kind=?"; params.push(kind); }
  sql += " ORDER BY b.created_at DESC LIMIT ?";
  params.push(limit);
  return db.prepare(sql).all(...params);
}

export function createReport({ reporter_id, title, description, severity = "medium", kind = "manual", meta = {} }) {
  const info = db.prepare("INSERT INTO bug_reports (reporter_id,title,description,severity,status,kind,meta_json) VALUES (?,?,?,?,?,?,?)")
    .run(reporter_id || null, String(title).slice(0, 200), String(description).slice(0, 5000), severity, "open", kind, JSON.stringify(meta || {}));
  persistNow();
  // notify admins if enabled
  try {
    const cfg = getGameConfig().bug_hunt;
    if (cfg?.notify_admin !== false) {
      const admins = db.prepare("SELECT id FROM users WHERE role='admin'").all();
      for (const a of admins) {
        notify(a.id, {
          kind: "system", icon: "bug", link: "bugHunt",
          title_fa: `🐛 گزارش باگ جدید: ${title.slice(0, 40)}`,
          title_en: `🐛 New bug report: ${title.slice(0, 40)}`,
          body_fa: `شدت: ${severity} — ${kind === "auto" ? "اسکن خودکار" : "کاربر"}`,
          body_en: `Severity: ${severity} — ${kind === "auto" ? "auto-scan" : "manual"}`,
        });
      }
    }
  } catch {}
  return { id: info.lastInsertRowid };
}

export function updateReport(id, { status, severity }) {
  const cur = db.prepare("SELECT * FROM bug_reports WHERE id=?").get(id);
  if (!cur) return { error: "not found" };
  const ns = status || cur.status;
  const sev = severity || cur.severity;
  db.prepare("UPDATE bug_reports SET status=?, severity=?, updated_at=datetime('now') WHERE id=?").run(ns, sev, id);
  persistNow();
  return { ok: true };
}

export function scanOnce() {
  const findings = [];
  const add = (title, description, severity = "low", meta = {}) => findings.push({ title, description, severity, meta });

  // 1) orphan flashcards (active learn cards not in any path_nodes)
  try {
    const allCards = new Set(db.prepare("SELECT id FROM flashcards WHERE active=1").all().map(r => r.id));
    const referenced = new Set();
    for (const row of db.prepare("SELECT card_ids FROM path_nodes WHERE active=1").all()) {
      try { JSON.parse(row.card_ids || "[]").forEach(id => referenced.add(id)); } catch {}
    }
    // also check learner_cards etc not considered orphan for learn track?
    let orphans = 0;
    for (const id of allCards) {
      if (!referenced.has(id)) {
        const d = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(id);
        try { const j = JSON.parse(d.data_json); if (j.track === "learn") orphans++; } catch {}
      }
    }
    if (orphans > 50) add("کارت‌های یتیم زیاد است", `تعداد کارت فعال learn که در هیچ مسیر نیست: ${orphans}`, "medium", { orphans });
  } catch {}

  // 2) missing micro golden/points (empty lesson)
  try {
    const rows = db.prepare("SELECT id, data_json FROM flashcards WHERE active=1").all();
    let emptyMicro = 0;
    for (const r of rows) {
      try {
        const j = JSON.parse(r.data_json);
        if (j.track === "learn" && j.micro) {
          const hasGolden = !!(j.micro.golden_fa || j.micro.golden_en);
          const hasPoints = (j.micro.points_fa?.length || 0) + (j.micro.points_en?.length || 0) > 0;
          const hasLead = !!(j.micro.lead_fa || j.micro.lead_en);
          if (!hasGolden && !hasPoints && !hasLead) emptyMicro++;
        }
      } catch {}
    }
    if (emptyMicro > 20) add("درسنامه‌های خالی", `تعداد کارت با micro خالی: ${emptyMicro}`, "low", { emptyMicro });
  } catch {}

  // 3) keyless bank cards
  try {
    const n = db.prepare("SELECT COUNT(*) c FROM flashcards WHERE active=1 AND json_extract(data_json,'$.source_meta.kind')='past_exam_import' AND json_extract(data_json,'$.source_meta.keyless')=1").get().c;
    if (n > 0) add("کارت‌های بدون کلید در بانک", `تعداد: ${n} — نیاز به بازبینی ادمین`, "medium", { keyless: n });
  } catch {}

  // 4) broken micro references
  try {
    const refs = new Set(db.prepare("SELECT code FROM reference_catalog").all().map(r => r.code));
    const rows = db.prepare("SELECT id, data_json FROM flashcards WHERE active=1").all();
    let broken = 0;
    for (const r of rows) {
      try {
        const j = JSON.parse(r.data_json);
        const code = j.micro?.reference?.code || j.micro?.reference?.book_code;
        if (code && !refs.has(code)) broken++;
      } catch {}
    }
    if (broken > 0) add("ارجاع شکسته در میکرولرنینگ", `تعداد کارت با کد رفرنس نامعتبر: ${broken}`, "high", { brokenRefs: broken });
  } catch {}

  // 5) tenant isolation drift
  try {
    const n = db.prepare("SELECT COUNT(*) c FROM flashcards WHERE active=1 AND university_id IS NULL AND json_extract(data_json,'$.track')!='learn' AND json_extract(data_json,'$.track') IS NOT NULL").get().c;
    if (n > 0) add("انحراف tenant", `تعداد کارت بدون university_id خارج از learn: ${n}`, "high", { tenantDrift: n });
  } catch {}

  // 6) suspended/buried counts (info)
  try {
    const sus = db.prepare("SELECT COUNT(*) c FROM srs_state WHERE suspended=1").get().c;
    const buried = db.prepare("SELECT COUNT(*) c FROM srs_state WHERE buried_until IS NOT NULL AND buried_until > date('now')").get().c;
    if (sus > 100) add("تعداد تعلیق‌شده بالا", `suspended: ${sus}`, "low", { suspended: sus });
    if (buried > 100) add("تعداد bury بالا", `buried_until آینده: ${buried}`, "low", { buried });
  } catch {}

  // persist scan
  const info = db.prepare("INSERT INTO bug_scans (findings, report_json, finished_at) VALUES (?,?,datetime('now'))")
    .run(findings.length, JSON.stringify(findings));
  persistNow();

  // auto-file critical/high findings as bug_reports (kind=auto)
  for (const f of findings) {
    if (f.severity === "high" || f.severity === "critical") {
      createReport({ reporter_id: null, title: f.title, description: f.description, severity: f.severity, kind: "auto", meta: f.meta });
    }
  }

  return { scanId: info.lastInsertRowid, findings };
}

export function listScans(limit = 20) {
  return db.prepare("SELECT * FROM bug_scans ORDER BY created_at DESC LIMIT ?").all(limit).map(r => ({
    ...r,
    findings: JSON.parse(r.report_json || "[]"),
  }));
}

export function stats() {
  const open = db.prepare("SELECT COUNT(*) c FROM bug_reports WHERE status='open'").get().c;
  const total = db.prepare("SELECT COUNT(*) c FROM bug_reports").get().c;
  const auto = db.prepare("SELECT COUNT(*) c FROM bug_reports WHERE kind='auto'").get().c;
  const lastScan = db.prepare("SELECT * FROM bug_scans ORDER BY id DESC LIMIT 1").get();
  return { open, total, auto, lastScan: lastScan ? { ...lastScan, findings: JSON.parse(lastScan.report_json || "[]") } : null };
}
