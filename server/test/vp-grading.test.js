// R82: grading-state helpers of the virtual-patient encounter (lib/vp-grading.js).
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { db, initDb } from "../src/db.js";
import { startSession } from "../src/lib/vplogging.js";
import {
  backoffMs, failureKind, accessRevoked, claimGrading, releaseGrading, writeDraft, readDraft, evaluationFingerprint, LEASE_MS,
} from "../src/lib/vp-grading.js";

describe("retry policy", () => {
  it("backs off from 30 s, doubling, and never beyond 15 minutes", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(20)).toBe(15 * 60_000);
  });

  it("classifies failures: provider and network trouble retry, access and context problems need staff", () => {
    expect(failureKind(503, "ai_evaluation_unavailable")).toBe("transient");
    expect(failureKind(500, "evaluate_failed")).toBe("transient");
    expect(failureKind(429, "rate_limited")).toBe("transient");
    expect(failureKind(429, "rate_limited")).toBe("transient");
    expect(failureKind(undefined, undefined)).toBe("transient");
    expect(failureKind(409, "evaluation_in_progress")).toBe("busy");
    expect(failureKind(403, "consent_required")).toBe("permanent");
    // Access withdrawn during grading: staff review, and the chat is not logged.
    expect(accessRevoked(401, "authorization_changed")).toBe(true);
    expect(accessRevoked(409, "study_context_changed")).toBe(true);
    expect(failureKind(401, "authorization_changed")).toBe("permanent");
    expect(accessRevoked(503, "ai_evaluation_unavailable")).toBe(false);
    expect(failureKind(409, "session_context_mismatch")).toBe("permanent");
    expect(failureKind(404, "session_not_found")).toBe("permanent");
  });

  it("uses a lease longer than any single grading call", () => {
    expect(LEASE_MS).toBeGreaterThanOrEqual(5 * 60_000);
  });
});

describe("durable draft and claim", () => {
  let sid;
  beforeAll(async () => {
    execSync("node src/seed.js --force", { stdio: "ignore" });
    await initDb();
    const t = db.prepare("SELECT id, university_id FROM users WHERE username='40012345'").get();
    const s = startSession({ userId: t.id, caseId: 1, classId: null, examId: null, studyId: null, lang: "fa", limitSec: 0 });
    sid = Number(s.sessionId);
  });

  it("keeps the AI draft until the attempt is written, and binds it to the exact inputs", () => {
    const fp = evaluationFingerprint({ session: { messages: ["x"] } });
    expect(writeDraft(sid, { fingerprint: fp, result: { source: "llm", score: 70 }, scoringRoute: null })).toBe(true);
    const row = db.prepare("SELECT * FROM vp_sessions WHERE id=?").get(sid);
    const d = readDraft(row);
    expect(d.fingerprint).toBe(fp);
    expect(d.result.score).toBe(70);
    expect(evaluationFingerprint({ session: { messages: ["changed"] } })).not.toBe(fp);
  });

  it("refuses an oversized draft instead of truncating it", () => {
    const big = { fingerprint: "x", result: { text: "a".repeat(600 * 1024) } };
    expect(writeDraft(sid, big)).toBe(false);
  });

  it("grants one claim at a time, and a stale token cannot release a newer claim", () => {
    const first = claimGrading(sid, 1_000_000);
    expect(first).toBeTruthy();
    expect(claimGrading(sid, 1_000_001)).toBeNull();          // held
    releaseGrading(sid, first + 1);                            // wrong token: no effect
    expect(claimGrading(sid, 1_000_002)).toBeNull();
    releaseGrading(sid, first);
    expect(claimGrading(sid, 1_000_003)).toBeTruthy();         // free again
  });

  it("lets a crashed holder's claim expire, so the encounter is not stuck", () => {
    db.prepare("UPDATE vp_sessions SET grading_lease_until=? WHERE id=?").run(1, sid);
    expect(claimGrading(sid, 5_000)).toBeTruthy();
  });

  it("a deleted student's open encounter is kept and goes to staff review once, not retried forever", async () => {
    const { gradeOpenEncounter } = await import("../src/lib/timed-expiry.js");
    const uid = Number(db.prepare("INSERT INTO users(username,password_hash,role,name_en,university_id) SELECT ?,password_hash,'student',?,university_id FROM users WHERE username='40012345'").run(`gone-${Date.now()}`, "Gone").lastInsertRowid);
    const id = Number(startSession({ userId: uid, caseId: 1, classId: null, examId: null, studyId: null, lang: "fa", limitSec: 0 }).sessionId);
    db.prepare("DELETE FROM users WHERE id=?").run(uid);
    const out = await gradeOpenEncounter(db.prepare("SELECT * FROM vp_sessions WHERE id=?").get(id));
    expect(out.error).toBe("owner_deleted");
    const row = db.prepare("SELECT review_required, next_try_ms FROM vp_sessions WHERE id=?").get(id);
    expect(row.review_required).toBe(1);
    expect(row.next_try_ms).toBeNull();
  });
});
