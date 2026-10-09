import {sealEncounter,readEncounter} from "../src/lib/vp-encounter.js";
import {normalizeRubric} from "../src/lib/grading-rubric.js";
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { initDb, db, initSchema } from "../src/db.js";
import { createApp } from "../src/app.js";
import { ACADEMIC_DIR, ensureDataDirs } from "../src/lib/paths.js";
import {
  createUniversityBundle,
  validateUniversityBundle,
  importUniversityBundle,
  createLearningBundle,
  importLearningBundle,
} from "../src/routes/portable.js";

describe("complete academic portable backup, transactional restore & tenant isolation", () => {
  let app;
  beforeEach(async () => {
    await initDb();
    initSchema();
    app = createApp();
  });

  it("exports full v2 bundle with media and historical versions, validates and imports atomically into fresh university", async () => {
    ensureDataDirs();
    // 1. Setup rich test data for university 1
    const uni = db.prepare("SELECT * FROM universities WHERE id=1").get();
    expect(uni).toBeDefined();

    const { randomUUID } = await import('node:crypto');
    const uniqueUser = `test_prof_restore_${randomUUID().slice(0,8)}`;
    // Insert user, case, policy for uni 1
    const uIns = db.prepare("INSERT INTO users (username, password_hash, name_fa, role, status, university_id) VALUES (?, ?, ?, ?, ?, ?)").run(
      uniqueUser, "hash", "استاد آزمون", "teacher", "active", uni.id
    );
    const teacherId = Number(uIns.lastInsertRowid);

    const uniqueCode = `internal-medicine-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const polIns = db.prepare("INSERT INTO course_reference_policies (university_id, course_code, course_name_fa, course_name_en, specialty_fa, specialty_en, source_anchor, citation_label_fa, citation_label_en, teaching_basis_fa, teaching_basis_en, content_mode, status, approval_note, approved_by, approved_at, version, active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      uni.id, uniqueCode, "طب داخلی", "Internal Medicine", "داخلی", "Internal", "Harrison 22e ch 10", "هاریسون فصل ۱۰", "Harrison ch 10", "نکات تشخیصی و درمانی", "Diagnostic pearls", "teacher_authored", "approved", "تأیید شد", teacherId, new Date().toISOString(), 1, 1, teacherId
    );
    const polId = Number(polIns.lastInsertRowid);

    const cIns = db.prepare("INSERT INTO cases (version, difficulty, data_json, active, university_id, reference_policy_id) VALUES (?, ?, ?, ?, ?, ?)").run(
      1, "medium", JSON.stringify({ title_fa: "کیس بیمار داخلی", specialty: "internal" }), 1, uni.id, polId
    );
    const caseId = Number(cIns.lastInsertRowid);

    // Add media to university 1
    const uniNs = `university-${uni.id}`;
    const mediaDir = path.join(ACADEMIC_DIR, uniNs, "media");
    fs.mkdirSync(mediaDir, { recursive: true });
    const dummyImage = Buffer.from("FAKE_IMAGE_DATA_PNG_FOR_TESTING");
    fs.writeFileSync(path.join(mediaDir, "test_diagram.png"), dummyImage);

    // Preserve a pinned faculty chart when every relational ID is remapped.
    db.prepare("INSERT INTO vp_sessions (user_id,case_id,started_ms,encounter_snapshot_json) VALUES (?,?,?,?)").run(teacherId,caseId,Date.now(),sealEncounter({caseData:{id:caseId,meds_en:"Pinned portable chart"},checklist:{items:[]},gradingScope:"overall",gradingRubric:normalizeRubric(null)}));

    // Create full v2 bundle
    const bundle = createUniversityBundle(uni, { full: true });
    expect(bundle.manifest.schema).toBe("medschool.university-portable.v2");
    expect(bundle.manifest.scope.complete).toBe(true);
    expect(bundle.manifest.scope.restorable).toBe(true);

    // Validate bundle
    const val = validateUniversityBundle(bundle.buffer);
    expect(val.ok).toBe(true);
    expect(val.restorable).toBe(true);
    expect(val.mediaEntries.some((m) => m.name === "test_diagram.png")).toBe(true);

    // 2. Perform Restore into a brand new university via importUniversityBundle
    const res = await importUniversityBundle(bundle.buffer);
    expect(res.ok).toBe(true);
    expect(res.university_id).toBeGreaterThan(1);
    const newUniId = res.university_id;

    // Verify media was restored into new university's namespace
    const newNs = res.namespace;
    const restoredMediaFile = path.join(ACADEMIC_DIR, newNs, "media", "test_diagram.png");
    expect(fs.existsSync(restoredMediaFile)).toBe(true);
    expect(fs.readFileSync(restoredMediaFile).toString()).toBe("FAKE_IMAGE_DATA_PNG_FOR_TESTING");

    // Verify database entities were remapped and isolated
    const cases = db.prepare("SELECT * FROM cases WHERE university_id=?").all(newUniId);
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every((c) => c.university_id === newUniId)).toBe(true);
    const originalCode = db.prepare('SELECT public_code FROM cases WHERE id=?').get(caseId).public_code;
    expect(cases.every(c=>c.public_code?.startsWith('VP-') && c.public_code !== originalCode)).toBe(true);

    const users = db.prepare("SELECT * FROM users WHERE university_id=?").all(newUniId);
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.university_id === newUniId)).toBe(true);

    const policies = db.prepare("SELECT * FROM course_reference_policies WHERE university_id=?").all(newUniId);
    expect(policies.length).toBeGreaterThan(0);
    expect(policies.every((p) => p.university_id === newUniId)).toBe(true);

    const sessions = db.prepare("SELECT s.* FROM vp_sessions s JOIN cases c ON c.id=s.case_id WHERE c.university_id=?").all(newUniId);
    const pinnedSession = sessions.find(s=>s.encounter_snapshot_json && JSON.parse(s.encounter_snapshot_json).caseData.meds_en === "Pinned portable chart");
    expect(pinnedSession).toBeTruthy();
    const pinned = readEncounter(pinnedSession);
    expect(pinned.caseData.id).toBe(pinnedSession.case_id);
    expect(pinned.caseData.id).not.toBe(caseId);
    expect(pinned.caseData.university_id).toBe(newUniId);
    expect(pinned.caseData.public_code).toBe(db.prepare("SELECT public_code FROM cases WHERE id=?").get(pinnedSession.case_id).public_code);

    // Clean up test media
    try {
      fs.rmSync(path.join(ACADEMIC_DIR, uniNs), { recursive: true, force: true });
      fs.rmSync(path.join(ACADEMIC_DIR, newNs), { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("rolls back completely on invalid bundle data and leaves DB unchanged", async () => {
    const uni = db.prepare("SELECT * FROM universities WHERE id=1").get();
    const casesBefore = db.prepare("SELECT COUNT(*) n FROM cases").get().n;
    const unisBefore = db.prepare("SELECT COUNT(*) n FROM universities").get().n;

    // Corrupt zip buffer
    const badBuffer = Buffer.from("NOT_A_VALID_ZIP_ARCHIVE_DATA");
    await expect(async () => await importUniversityBundle(badBuffer)).rejects.toThrow();

    expect(db.prepare("SELECT COUNT(*) n FROM cases").get().n).toBe(casesBefore);
    expect(db.prepare("SELECT COUNT(*) n FROM universities").get().n).toBe(unisBefore);
  });

  it("supports full learning package export and import", async () => {
    const pkg = createLearningBundle();
    expect(pkg.manifest.schema).toBe("medschool.learning-package.v1");
    expect(pkg.manifest.scope.complete).toBe(true);

    const result = importLearningBundle(pkg.buffer);
    expect(result.ok).toBe(true);
    expect(result.topics_imported).toBeGreaterThanOrEqual(0);
  });

  it("generates and verifies physical standalone database files for university tenant and learning domain", async () => {
    const { syncUniversityTenantDatabase, syncLearningDomainDatabase } = await import("../src/lib/domain-storage.js");
    const { LEARNING_DB_PATH, tenantDatabasePath } = await import("../src/lib/paths.js");

    const uniRes = await syncUniversityTenantDatabase(1);
    expect(uniRes.size).toBeGreaterThan(1000);
    expect(fs.existsSync(tenantDatabasePath("university-1"))).toBe(true);

    const learnRes = await syncLearningDomainDatabase();
    expect(learnRes.size).toBeGreaterThan(1000);
    expect(fs.existsSync(LEARNING_DB_PATH)).toBe(true);
  });
});
