/* ================================================================
   master-bank.test.js — guards for the authoritative competitive
   question bank that ships in tools/master-bank.

   The bank is the bilingual pre-internship collection plus the
   residency (دستیاری) collection taken from the official medschool
   archive, split by tools/master-bank/build.mjs into numbered import
   payload parts. These tests lock the structural and editorial
   invariants the importer, curator and exam simulator rely on:

     1. part files exist, are numbered contiguously and match the
        bankbootstrap filename family;
     2. every question has a Persian stem, four Persian options and a
        valid single key — or is explicitly marked keyless (no official
        key / multi-answer item), in which case it never enters a graded
        surface;
     3. subjects/chapters/years cover the full competitive syllabus;
     4. residency classification is stable (the distribution is the
        audited anchor set);
     5. no stem is duplicated within a bank.
   ================================================================ */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const bank = join(here, "../../tools/master-bank");

/* Same family grammar as bankbootstrap.js payloadFiles(). */
const PART_RE = /^import-payload\.(master-preint|master-residency)\.part(\d+)\.json$/;

function loadFamily(family) {
  const files = readdirSync(bank)
    .filter((n) => PART_RE.test(n))
    .sort();
  const parts = [];
  for (const n of files) {
    const m = n.match(PART_RE);
    if (m[1] !== family) continue;
    const body = JSON.parse(readFileSync(join(bank, n), "utf8"));
    parts.push({ name: n, index: Number(m[2]), body });
  }
  return parts.sort((a, b) => a.index - b.index);
}

describe("master bank payload structure", () => {
  it("ships contiguous numbered parts for both exam families", () => {
    for (const [family, expectedParts] of [["master-preint", 51], ["master-residency", 3]]) {
      const parts = loadFamily(family);
      expect(parts.map((p) => p.index)).toEqual(Array.from({ length: expectedParts }, (_, i) => i + 1));
      for (const p of parts) expect(Array.isArray(p.body.questions)).toBe(true);
    }
  });

  it("keeps every part at or below the 220-question split (last part carries the remainder)", () => {
    for (const family of ["master-preint", "master-residency"]) {
      const parts = loadFamily(family);
      for (const p of parts.slice(0, -1)) expect(p.body.questions.length).toBe(220);
      expect(parts.at(-1).body.questions.length).toBeGreaterThan(0);
      expect(parts.at(-1).body.questions.length).toBeLessThanOrEqual(220);
    }
  });

  it("declares the competitive program, exam type and overflow-to-premium on every part", () => {
    const pre = loadFamily("master-preint");
    for (const p of pre) {
      expect(p.body.program).toBe("preint");
      expect(p.body.exam_type).toBe("preinternship");
      expect(p.body.overflowToPremium).toBe(true);
      expect(p.body.maxPerLesson).toBeGreaterThan(0);
      expect(p.body.part.n).toBe(p.index);
    }
    const res = loadFamily("master-residency");
    for (const p of res) {
      // both competitive banks run under the app's "preint" program; the
      // residency collection is distinguished by exam_type
      expect(p.body.program).toBe("preint");
      expect(p.body.exam_type).toBe("residency");
      expect(p.body.overflowToPremium).toBe(true);
      expect(p.body.part.n).toBe(p.index);
    }
  });
});

describe("master pre-internship bank", () => {
  const parts = loadFamily("master-preint");
  const rows = parts.flatMap((p) => p.body.questions);

  it("contains 11,120 audited questions (11,089 keyed + 31 explicitly keyless)", () => {
    expect(rows).toHaveLength(11120);
    const keyless = rows.filter((r) => r.keyless === true || r.correct_index === null);
    expect(keyless).toHaveLength(31);
    const lowConf = keyless.filter((r) => r.key_source === "low-confidence");
    expect(lowConf.map((r) => r.tags[0]).sort()).toEqual(
      ["QB-00584", "QB-00707", "QB-01104", "QB-01248"].sort()
    );
    const multi = keyless.filter((r) => r.key_source === "multi-answer");
    expect(multi).toHaveLength(27);
    for (const r of multi) expect(r.tags).toContain("multi-answer");
    expect(rows.filter((r) => !r.keyless).length).toBe(11089);
  });

  it("keeps part22 reviewed multi-answer items ungraded and the imaging correction explicit", () => {
    for (const id of ["QB-04877", "QB-04880"]) {
      const q = rows.find((r) => r.tags[0] === id);
      expect(q.keyless).toBe(true);
      expect(q.correct_index).toBeNull();
      expect(q.key_source).toBe("multi-answer");
      expect(q.tags).toContain("multi-answer");
      expect(q.options_why_fa.filter((w) => w.startsWith("گزینه صحیح: "))).toHaveLength(2);
    }
    const imaging = rows.find((r) => r.tags[0] === "QB-04886");
    expect(imaging.correct_index).toBe(0);
    expect(imaging.key_source).toBe("registry-corrected");
    expect(imaging.options_fa[0]).toBe("گرافی قفسه ی صدری در حالت بازدم عمیق");
  });

  it("keeps part22 batch2 educational structure and explicit option reasoning", () => {
    const batch = parts.find((p) => p.index === 22).body.questions.slice(30, 60);
    expect(batch).toHaveLength(30);
    for (const q of batch) {
      expect(q.explanation_fa.length).toBeGreaterThan(300);
      expect(q.micro.lead_fa.length).toBeGreaterThan(20);
      expect(q.micro.golden_fa.length).toBeGreaterThan(20);
      expect(q.micro.points_fa).toHaveLength(4);
      expect(new Set(q.micro.points_fa).size).toBe(4);
      expect(q.micro.points_fa.every((p) => p.length > 20)).toBe(true);
      expect(q.options_why_fa).toHaveLength(4);
      q.options_why_fa.forEach((why, i) => {
        if (!q.keyless) {
          expect(why.startsWith(i === q.correct_index ? "گزینه صحیح: " : "دلیل رد گزینه: ")).toBe(true);
        } else {
          expect(/^(گزینه صحیح: |دلیل رد گزینه: )/.test(why)).toBe(true);
        }
      });
    }
  });

  it("gives every card a Persian stem, four options and a usable key", () => {
    for (const r of rows) {
      expect((r.question_fa || "").trim().length).toBeGreaterThan(12);
      expect(Array.isArray(r.options_fa)).toBe(true);
      expect(r.options_fa).toHaveLength(4);
      expect(r.options_fa.every((o) => String(o || "").trim().length > 0)).toBe(true);
      if (r.keyless === true) {
        expect(r.correct_index === null).toBe(true);
      } else {
        expect(Number.isInteger(r.correct_index)).toBe(true);
        expect(r.correct_index).toBeGreaterThanOrEqual(0);
        expect(r.correct_index).toBeLessThanOrEqual(3);
        expect(["official", "rapid", "registry-corrected"]).toContain(r.key_source);
      }
    }
  });

  it("attaches four option rationales and a lesson to every keyed card", () => {
    for (const r of rows.filter((x) => !x.keyless)) {
      expect(Array.isArray(r.options_why_fa)).toBe(true);
      expect(r.options_why_fa).toHaveLength(4);
      expect((r.explanation_fa || "").trim().length).toBeGreaterThan(40);
    }
  });

  it("has no duplicated stems and no duplicated question tags", () => {
    const stems = new Set();
    const tags = new Set();
    for (const r of rows) {
      expect(stems.has(r.question_fa)).toBe(false);
      stems.add(r.question_fa);
      const id = (r.tags || [])[0];
      expect(id).toBeTruthy();
      expect(tags.has(id)).toBe(false);
      tags.add(id);
    }
  });

  it("covers every competitive exam year 1393–1400 and 1402–1403", () => {
    const byYear = {};
    for (const r of rows) byYear[r.year_num] = (byYear[r.year_num] || 0) + 1;
    for (const y of [1393, 1394, 1395, 1396, 1397, 1398, 1399, 1400, 1402, 1403]) {
      expect(byYear[y]).toBeGreaterThan(100);
    }
  });

  it("labels every question with a subject (chapter when the booklet gives one)", () => {
    for (const r of rows) {
      expect((r.subject_fa || "").trim()).toBeTruthy();
      expect(["major", "minor"]).toContain(r.subject_track);
    }
    // chapters are populated wherever the booklet grouped questions by them;
    // the newer 1402/1403 sittings were not chapter-headed in the source
    expect(rows.filter((r) => (r.chapter_fa || "").trim()).length).toBeGreaterThan(3000);
  });
});

describe("master residency (دستیاری) bank", () => {
  const parts = loadFamily("master-residency");
  const rows = parts.flatMap((p) => p.body.questions);

  it("contains 484 questions, all keyed, in 220/220/44 parts", () => {
    expect(parts.map((p) => p.body.questions.length)).toEqual([220, 220, 44]);
    expect(rows).toHaveLength(484);
    expect(rows.every((r) => r.keyless !== true && Number.isInteger(r.correct_index))).toBe(true);
    for (const r of rows) {
      expect(r.key_source).toBe("official");
      expect(r.options_fa).toHaveLength(4);
      expect(Array.isArray(r.options_why_fa) && r.options_why_fa).toHaveLength(4);
    }
  });

  it("holds the audited subject distribution (classification anchors)", () => {
    const counts = {};
    for (const r of rows) counts[r.subject_fa] = (counts[r.subject_fa] || 0) + 1;
    expect(counts).toEqual({
      "داخلی": 114,
      "جراحی": 49,
      "اورولوژی": 22,
      "کودکان": 76,
      "نورولوژی": 20,
      "زنان و زایمان": 50,
      "بیماری‌های عفونی": 30,
      "رادیولوژی": 8,
      "پاتولوژی": 14,
      "روانپزشکی": 16,
      "پوست": 14,
      "ارتوپدی": 14,
      "چشم‌پزشکی": 12,
      "گوش و حلق و بینی": 12,
      "آمار و اپیدمیولوژی": 14,
      "فارماکولوژی": 13,
      "اخلاق پزشکی": 5,
      "ایمنی‌شناسی": 1,
    });
  });

  it("covers all three audited residency courses (51, 52, 53)", () => {
    const tags = rows.flatMap((r) => r.tags || []);
    expect(tags.filter((t) => t === "residency-course-۵۱").length).toBe(158);
    expect(tags.filter((t) => t === "residency-course-۵۲").length).toBe(126);
    expect(tags.filter((t) => t === "residency-course-۵۳").length).toBe(200);
  });
});

describe("master bank sources", () => {
  it("keeps the raw extraction sources out of the payload directory listing contract", () => {
    // sources/ is a build input (~100 MB) and must never be treated as a payload.
    // Since v66 the lean release ships only the numbered payload parts (the
    // build script and raw sources stay in the dev tree), so build.mjs is
    // optional here — what matters is that no stray JSON sits next to the parts.
    expect(existsSync(join(bank, "sources"))).toBe(false);
    const stray = readdirSync(bank).filter(
      (n) => n.endsWith(".json") && !PART_RE.test(n)
    );
    expect(stray).toEqual([]);
  });
});


// round48 is a versioned continuation, not permission to weaken historical guards.
// For later edited records the old full hash must equal the new PRE-EDIT full
// hash; round48 then checks all protected fields against that baseline.
const round50Baseline = JSON.parse(readFileSync(join(here, "fixtures/round50-preservation.json"), "utf8"));
// round51 (part26 rows 1-45) is the next versioned continuation, captured
// from the untouched payload before its edit, chained exactly like round48/50.
const round51Baseline = JSON.parse(readFileSync(join(here, "fixtures/round51-preservation.json"), "utf8"));
// round52 (part26 rows 46-220 + part27 rows 1-25 except Q23) is the next
// versioned continuation, captured from the untouched payloads before its
// edit, chained exactly like round48/50/51.
const round52Baseline = JSON.parse(readFileSync(join(here, "fixtures/round52-preservation.json"), "utf8"));
// round53 (part27 rows 26-220 except 52 deferred + part28 rows 1-5) is the
// next versioned continuation, captured from the untouched payloads before
// its edit, chained exactly like round50/51/52.
const round53Baseline = JSON.parse(readFileSync(join(here, "fixtures/round53-preservation.json"), "utf8"));
// New part25 edits are allowed only if its PRE-EDIT raw hash equals each
// historical fixture. The round50 suite then protects every field/record.
function checkHistoricalOtherBank(name, expected) {
  if (name === "import-payload.master-preint.part25.json") {
    expect(round50Baseline.original_file_hashes[`tools/master-bank/${name}`], name).toBe(expected);
  } else if (name === "import-payload.master-preint.part26.json") {
    // round51 continuation: the file was legitimately re-written, but its
    // PRE-EDIT hash (stored in the round51 fixture) must equal the history.
    expect(round51Baseline.original_file_hashes[`tools/master-bank/${name}`], name).toBe(expected);
  } else if (name === "import-payload.master-preint.part27.json") {
    // round52 continuation: the file was legitimately re-written (rows 1-25
    // except Q23), but its PRE-EDIT hash (round52 fixture) must equal the
    // history.
    expect(round52Baseline.original_file_hashes[`tools/master-bank/${name}`], name).toBe(expected);
  } else if (name === "import-payload.master-preint.part28.json") {
    // round53 continuation: the file was legitimately re-written (rows 1-5),
    // but its PRE-EDIT hash (round53 fixture) must equal the history.
    expect(round53Baseline.original_file_hashes[`tools/master-bank/${name}`], name).toBe(expected);
  } else {
    expect(createHash("sha256").update(readFileSync(join(bank, name))).digest("hex"), name).toBe(expected);
  }
}

const round49Baseline = JSON.parse(readFileSync(join(here, "fixtures/round49-preservation.json"), "utf8"));
const round48Baseline = JSON.parse(readFileSync(join(here, "fixtures/round48-preservation.json"), "utf8"));

// round47: the user explicitly deferred six items. Hashes were taken from
// round46 BEFORE normalising away only the authorised Persian teaching fields.
describe("round47 exact editorial boundaries", () => {
  const fixture = JSON.parse(readFileSync(join(here, "fixtures/round47-preservation.json"), "utf8"));
  const stable = (x) => Array.isArray(x) ? x.map(stable)
    : x && typeof x === "object"
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, stable(x[k])])) : x;
  const digest = (x) => createHash("sha256").update(JSON.stringify(stable(x))).digest("hex");
  const current = Object.fromEntries([22, 23].map((part) => [part,
    JSON.parse(readFileSync(join(bank, `import-payload.master-preint.part${part}.json`), "utf8"))]));

  it("preserves every non-educational field, all keys and every out-of-scope question", () => {
    let changed = 0;
    for (const part of [22, 23]) {
      const { questions, ...metadata } = current[part];
      expect(digest(metadata)).toBe(fixture.parts[part].metadata);
      expect(questions).toHaveLength(fixture.parts[part].questions.length);
      questions.forEach((q, index) => {
        const baseline = fixture.parts[part].questions[index];
        const check = JSON.parse(JSON.stringify(q));
        if (baseline.edited) {
          expect(digest(q), baseline.id).not.toBe(baseline.full);
          changed++;
          delete check.explanation_fa;
          delete check.options_why_fa;
          for (const key of ["lead_fa", "golden_fa", "points_fa"]) delete check.micro[key];
        }
        const later = round48Baseline.parts[part].questions[index];
        let expected = baseline.protected;
        if (later.edited) {
          expect(baseline.edited, baseline.id).toBe(false); // disjoint releases
          expect(later.full, baseline.id).toBe(baseline.full); // baseline continuity
          delete check.explanation_fa;
          delete check.options_why_fa;
          for (const key of ["lead_fa", "golden_fa", "points_fa"]) delete check.micro[key];
          expected = later.protected;
        }
        expect(digest(check), baseline.id).toBe(expected);
      });
    }
    expect(changed).toBe(194);
  });

  it("keeps all six deferred questions entirely identical to round46", () => {
    expect(fixture.scope).toHaveLength(200);
    expect(fixture.deferred.sort()).toEqual(["22:142", "22:145", "22:166", "22:174", "22:214", "23:32"].sort());
    for (const id of fixture.deferred) {
      const [part, number] = id.split(":").map(Number);
      expect(digest(current[part].questions[number - 1])).toBe(fixture.parts[part].questions[number - 1].full);
      expect(fixture.parts[part].questions[number - 1].edited).toBe(false);
    }
  });

  it("provides 194 case interpretations, four explicit rationales and four clinical points", () => {
    const explanations = new Set();
    const leads = new Set();
    for (const part of [22, 23]) {
      current[part].questions.forEach((q, index) => {
        if (!fixture.parts[part].questions[index].edited) return;
        expect(q.explanation_fa.length).toBeGreaterThan(300);
        expect(q.options_why_fa).toHaveLength(4);
        expect(new Set(q.options_why_fa).size).toBe(4);
        q.options_why_fa.forEach((why, i) => {
          expect(why.startsWith(i === q.correct_index ? "گزینه صحیح: " : "دلیل رد گزینه: ")).toBe(true);
          expect(why.length).toBeGreaterThan(35);
        });
        expect(q.micro.lead_fa.length).toBeGreaterThan(20);
        expect(q.micro.lead_fa).not.toContain("\n");
        expect(q.micro.golden_fa.length).toBeGreaterThan(20);
        expect(q.micro.points_fa).toHaveLength(4);
        expect(new Set(q.micro.points_fa).size).toBe(4);
        expect(q.micro.points_fa.every((point) => point.includes(":") && point.length > 20)).toBe(true);
        explanations.add(q.explanation_fa);
        leads.add(q.micro.lead_fa);
      });
    }
    expect(explanations.size).toBe(194);
    expect(leads.size).toBe(194);
  });

  it("preserves other payloads except hash-chained round48/round50 continuations", () => {
    expect(Object.keys(fixture.otherBanks)).toHaveLength(52);
    for (const [name, expected] of Object.entries(fixture.otherBanks)) {
      if (name === "import-payload.master-preint.part24.json") {
        // Every part24 record/field is checked below. Its pre-edit file must
        // still be byte-identical to the round46/round47 historical file.
        expect(round48Baseline.originalFullBanks[name], name).toBe(expected);
      } else {
        checkHistoricalOtherBank(name, expected);
      }
    }
  });
});

// round48 baseline is from the SHA-256-verified round47 ZIP, never post-edit data.
describe("round48 exact editorial boundaries", () => {
  const fixture = round48Baseline;
  const stable = (x) => Array.isArray(x) ? x.map(stable)
    : x && typeof x === "object"
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, stable(x[k])])) : x;
  const digest = (x) => createHash("sha256").update(JSON.stringify(stable(x))).digest("hex");
  const current = Object.fromEntries([22, 23, 24].map((part) => [part,
    JSON.parse(readFileSync(join(bank, `import-payload.master-preint.part${part}.json`), "utf8"))]));
  const scope = [
    ...Array.from({ length: 180 }, (_, i) => `23:${i + 41}`),
    ...Array.from({ length: 20 }, (_, i) => `24:${i + 1}`),
  ];
  const deferred = [68, 77, 88, 95, 98, 102, 118, 137, 144, 152, 157, 163, 176, 182, 190, 195, 202, 203].map((n) => `23:${n}`);
  const edited = scope.filter((id) => !deferred.includes(id));

  it("changes exactly 182 approved records and only the five Persian teaching fields", () => {
    expect(fixture.baseline_sha256).toBe("97e6bebdf7d9f501384f6a9e80c9311be9b928254c2384c8040cd60e45ced666");
    expect(fixture.scope).toEqual(scope);
    expect(fixture.deferred).toEqual(deferred);
    expect(fixture.edited).toEqual(edited);
    const changed = [];
    for (const part of [22, 23, 24]) {
      const { questions, ...metadata } = current[part];
      expect(digest(metadata)).toBe(fixture.parts[part].metadata);
      expect(questions).toHaveLength(fixture.parts[part].questions.length);
      questions.forEach((q, index) => {
        const baseline = fixture.parts[part].questions[index];
        const id = `${part}:${index + 1}`;
        expect(baseline.id).toBe(id);
        expect(baseline.edited).toBe(edited.includes(id));
        const check = JSON.parse(JSON.stringify(q));
        if (baseline.edited) {
          expect(digest(q), id).not.toBe(baseline.full);
          changed.push(id);
          delete check.explanation_fa;
          delete check.options_why_fa;
          for (const key of ["lead_fa", "golden_fa", "points_fa"]) delete check.micro[key];
        }
        const later = round49Baseline.parts[part].questions[index];
        let expected = baseline.protected;
        if (later.edited) {
          expect(baseline.edited, id).toBe(false);
          expect(later.full, id).toBe(baseline.full);
          delete check.explanation_fa;
          delete check.options_why_fa;
          for (const key of ["lead_fa", "golden_fa", "points_fa"]) delete check.micro[key];
          expected = later.protected;
        }
        expect(digest(check), id).toBe(expected);
      });
    }
    expect(changed).toEqual(edited);
    expect(changed).toHaveLength(182);
  });

  it("keeps the 18 newly deferred and six earlier deferred records entirely unchanged", () => {
    const prior = ["22:142", "22:145", "22:166", "22:174", "22:214", "23:32"];
    expect(fixture.prior_deferred).toEqual(prior);
    for (const id of [...prior, ...deferred]) {
      const [part, number] = id.split(":").map(Number);
      const baseline = fixture.parts[part].questions[number - 1];
      expect(baseline.edited).toBe(false);
      expect(digest(current[part].questions[number - 1]), id).toBe(baseline.full);
    }
  });

  it("provides 182 distinct case explanations and leads with four rationales and structured points", () => {
    const explanations = new Set(), leads = new Set();
    for (const id of edited) {
      const [part, number] = id.split(":").map(Number);
      const q = current[part].questions[number - 1];
      expect(q.explanation_fa.length, id).toBeGreaterThan(300);
      expect(q.options_why_fa, id).toHaveLength(4);
      expect(new Set(q.options_why_fa).size, id).toBe(4);
      q.options_why_fa.forEach((why, i) => {
        expect(why.startsWith(i === q.correct_index ? "گزینه صحیح: " : "دلیل رد گزینه: "), id).toBe(true);
        expect(why.length, id).toBeGreaterThan(35);
      });
      expect(q.micro.lead_fa.length, id).toBeGreaterThan(20);
      expect(q.micro.lead_fa, id).not.toContain("\n");
      expect(q.micro.golden_fa.length, id).toBeGreaterThan(20);
      expect(q.micro.points_fa, id).toHaveLength(4);
      expect(new Set(q.micro.points_fa).size, id).toBe(4);
      expect(q.micro.points_fa.every((point) => point.includes(":") && point.length > 20), id).toBe(true);
      explanations.add(q.explanation_fa);
      leads.add(q.micro.lead_fa);
    }
    expect(explanations.size).toBe(182);
    expect(leads.size).toBe(182);
  });

  it("preserves other-bank bytes except hash-chained round50 and keeps filename inventory", () => {
    expect(Object.keys(fixture.otherBanks)).toHaveLength(51);
    expect(readdirSync(bank).filter((name) => PART_RE.test(name)).sort()).toEqual(Object.keys(fixture.originalFullBanks).sort());
    for (const [name, expected] of Object.entries(fixture.otherBanks)) {
      checkHistoricalOtherBank(name, expected);
    }
  });
});

// round49 baseline is from the SHA-256-verified round48 ZIP, never post-edit data.
describe("round49 exact editorial boundaries", () => {
  const fixture = round49Baseline;
  const stable = (x) => Array.isArray(x) ? x.map(stable)
    : x && typeof x === "object"
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, stable(x[k])])) : x;
  const digest = (x) => createHash("sha256").update(JSON.stringify(stable(x))).digest("hex");
  const current = Object.fromEntries([22, 23, 24].map((part) => [part,
    JSON.parse(readFileSync(join(bank, `import-payload.master-preint.part${part}.json`), "utf8"))]));
  const scope = Array.from({ length: 200 }, (_, i) => `24:${i + 21}`);
  const deferred = [48, 50, 58, 66, 76, 85, 97, 102, 108, 113, 123, 146, 147, 171, 193, 201, 213].map((n) => `24:${n}`);
  const edited = scope.filter((id) => !deferred.includes(id));

  it("changes exactly 183 approved records and only the five Persian teaching fields", () => {
    expect(fixture.baseline_sha256).toBe("fc90ff35ecb1ff9706aa751e27b043cfd6c7e0b84de07d42a058f559a745c4c9");
    expect(fixture.scope).toEqual(scope);
    expect(fixture.deferred).toEqual(deferred);
    expect(fixture.edited).toEqual(edited);
    const changed = [];
    for (const part of [22, 23, 24]) {
      const { questions, ...metadata } = current[part];
      expect(digest(metadata)).toBe(fixture.parts[part].metadata);
      expect(questions).toHaveLength(fixture.parts[part].questions.length);
      questions.forEach((q, index) => {
        const baseline = fixture.parts[part].questions[index];
        const id = `${part}:${index + 1}`;
        expect(baseline.id).toBe(id);
        expect(baseline.edited).toBe(edited.includes(id));
        const check = JSON.parse(JSON.stringify(q));
        if (baseline.edited) {
          expect(digest(q), id).not.toBe(baseline.full);
          changed.push(id);
          delete check.explanation_fa;
          delete check.options_why_fa;
          for (const key of ["lead_fa", "golden_fa", "points_fa"]) delete check.micro[key];
        }
        expect(digest(check), id).toBe(baseline.protected);
      });
    }
    expect(changed).toEqual(edited);
    expect(changed).toHaveLength(183);
  });

  it("keeps the 17 newly deferred and 24 earlier deferred records entirely unchanged", () => {
    const prior = ["22:142", "22:145", "22:166", "22:174", "22:214", "23:32", "23:68", "23:77", "23:88", "23:95", "23:98", "23:102", "23:118", "23:137", "23:144", "23:152", "23:157", "23:163", "23:176", "23:182", "23:190", "23:195", "23:202", "23:203"];
    expect(fixture.prior_deferred).toEqual(prior);
    for (const id of [...prior, ...deferred]) {
      const [part, number] = id.split(":").map(Number);
      const baseline = fixture.parts[part].questions[number - 1];
      expect(baseline.edited).toBe(false);
      expect(digest(current[part].questions[number - 1]), id).toBe(baseline.full);
    }
  });

  it("provides 183 distinct case explanations and leads with four rationales and structured points", () => {
    const explanations = new Set(), leads = new Set();
    for (const id of edited) {
      const [part, number] = id.split(":").map(Number);
      const q = current[part].questions[number - 1];
      expect(q.explanation_fa.length, id).toBeGreaterThan(300);
      expect(q.options_why_fa, id).toHaveLength(4);
      expect(new Set(q.options_why_fa).size, id).toBe(4);
      q.options_why_fa.forEach((why, i) => {
        expect(why.startsWith(i === q.correct_index ? "گزینه صحیح: " : "دلیل رد گزینه: "), id).toBe(true);
        expect(why.length, id).toBeGreaterThan(35);
      });
      expect(q.micro.lead_fa.length, id).toBeGreaterThan(20);
      expect(q.micro.lead_fa, id).not.toContain("\n");
      expect(q.micro.golden_fa.length, id).toBeGreaterThan(20);
      expect(q.micro.points_fa, id).toHaveLength(4);
      expect(new Set(q.micro.points_fa).size, id).toBe(4);
      expect(q.micro.points_fa.every((point) => point.includes(":") && point.length > 20), id).toBe(true);
      explanations.add(q.explanation_fa);
      leads.add(q.micro.lead_fa);
    }
    expect(explanations.size).toBe(183);
    expect(leads.size).toBe(183);
  });

  it("preserves other-bank bytes except hash-chained round50 and keeps filename inventory", () => {
    expect(Object.keys(fixture.otherBanks)).toHaveLength(51);
    expect(readdirSync(bank).filter((name) => PART_RE.test(name)).sort()).toEqual(Object.keys(fixture.originalFullBanks).sort());
    for (const [name, expected] of Object.entries(fixture.otherBanks)) {
      checkHistoricalOtherBank(name, expected);
    }
  });
});

// round50 fixture captured before any edit from the checksum-verified round49 ZIP.
describe("round50 exact editorial boundaries", () => {
  const f = round50Baseline;
  const body = JSON.parse(readFileSync(join(bank, "import-payload.master-preint.part25.json"), "utf8"));
  const edited = new Set(f.edited_numbers);
  const newlyDeferred = [17,19,23,27,31,55,68,74,83,84,90,91,93,94,96,98,105,106,107,121,126,129,135,136,139,143,144,145,149,157,162,164,166,167,173,175,189,192,198,200];
  const protectedFields = (q) => {
    const copy = structuredClone(q);
    delete copy.explanation_fa; delete copy.options_why_fa;
    for (const name of ["lead_fa", "golden_fa", "points_fa"]) delete copy.micro[name];
    return copy;
  };

  it("locks exact 200 scope, 160 edits, all protected fields and every untouched record", () => {
    expect(f.baseline_sha256).toBe("c1359bc715b20d1f94ac96edc9206618ec1010cb1a384a02414154a8fac0a227");
    expect(f.deferred_numbers).toEqual(newlyDeferred);
    expect(f.edited_numbers).toEqual(Array.from({length:200},(_,i)=>i+1).filter(n=>!newlyDeferred.includes(n)));
    expect(edited.size).toBe(160);
    const {questions, ...meta} = body;
    const {questions:original, ...originalMeta} = f.original_part25;
    expect(meta).toEqual(originalMeta);
    expect(questions).toHaveLength(220);
    let count=0;
    questions.forEach((q,i)=>{
      if (edited.has(i+1)) {
        expect(protectedFields(q), `25:${i+1}`).toEqual(protectedFields(original[i]));
        expect(q).not.toEqual(original[i]); count++;
      } else expect(q, `untouched 25:${i+1}`).toEqual(original[i]);
    });
    expect(count).toBe(160);
  });

  it("ships individualized explanations, four rationales and four clinical points", () => {
    const explanations = new Set(), leads = new Set();
    for (const n of edited) {
      const q=body.questions[n-1];
      expect(q.explanation_fa.length).toBeGreaterThan(300);
      expect(q.options_why_fa).toHaveLength(4);
      q.options_why_fa.forEach((reason,i)=>{
        expect(reason.startsWith(i===q.correct_index ? "گزینه صحیح: " : "دلیل رد گزینه: ")).toBe(true);
        expect(reason.length).toBeGreaterThan(30);
      });
      expect(new Set(q.options_why_fa).size).toBe(4);
      expect(q.micro.lead_fa.includes("\n")).toBe(false);
      expect(q.micro.golden_fa.length).toBeGreaterThan(20);
      expect(q.micro.points_fa).toHaveLength(4);
      expect(new Set(q.micro.points_fa).size).toBe(4);
      expect(q.micro.points_fa.every(p=>p.includes(":") && p.length>20)).toBe(true);
      explanations.add(q.explanation_fa); leads.add(q.micro.lead_fa);
    }
    expect(explanations.size).toBe(160); expect(leads.size).toBe(160);
  });

  it("keeps previous 41 queue entries and records 40 new unchanged graded entries", () => {
    const previous=JSON.parse(readFileSync(join(here,"../../docs/round49-deferred.json"),"utf8"));
    const queue=JSON.parse(readFileSync(join(here,"../../docs/round50-deferred.json"),"utf8"));
    expect(queue.deferred.slice(0,41)).toEqual(previous.deferred);
    expect(queue.scope_count).toBe(200); expect(queue.enriched_count).toBe(160);
    expect(queue.new_deferred_count).toBe(40); expect(queue.cumulative_deferred_count).toBe(81);
    expect(queue.deferred).toHaveLength(81);
    expect(queue.deferred.slice(41).map(x=>x.local_question)).toEqual(newlyDeferred);
    for (const entry of queue.deferred.slice(41)) {
      expect(entry.part).toBe(25);
      expect(body.questions[entry.local_question-1]).toEqual(f.original_part25.questions[entry.local_question-1]);
      expect(entry.original_correct_index).toBe(body.questions[entry.local_question-1].correct_index);
    }
  });

  it("keeps the other 53 banks byte-identical (part26 chained via round51) including all previous deferred records", () => {
    const names=Object.keys(f.original_file_hashes);
    expect(names).toHaveLength(54);
    expect(readdirSync(bank).filter(n=>PART_RE.test(n)).sort()).toEqual(names.map(n=>n.split("/").at(-1)).sort());
    for (const [name,hash] of Object.entries(f.original_file_hashes)) {
      if (name.endsWith("master-preint.part25.json")) continue;
      if (name.endsWith("master-preint.part26.json")) {
        // round51 legitimately re-wrote part26 rows 1-45; its PRE-EDIT hash
        // (round51 fixture) must still match this round50-era snapshot.
        expect(round51Baseline.original_file_hashes[name], name).toBe(hash);
        continue;
      }
      if (name.endsWith("master-preint.part27.json")) {
        // round52 legitimately re-wrote part27 rows 1-25 except Q23; its
        // PRE-EDIT hash (round52 fixture) must match this round50-era
        // snapshot.
        expect(round52Baseline.original_file_hashes[name], name).toBe(hash);
        continue;
      }
      if (name.endsWith("master-preint.part28.json")) {
        // round53 legitimately re-wrote part28 rows 1-5; its PRE-EDIT hash
        // (round53 fixture) must match this round50-era snapshot.
        expect(round53Baseline.original_file_hashes[name], name).toBe(hash);
        continue;
      }
      expect(createHash("sha256").update(readFileSync(join(here,"../..",name))).digest("hex"),name).toBe(hash);
    }
  });
});

// round51 fixture captured in this workspace before the part26 (paediatrics
// 1395, rows 1-45) edit; pre-edit payload hash chains back to the round46-50
// historical fixtures (verified identical in all of them).
describe("round51 exact editorial boundaries", () => {
  const f = round51Baseline;
  const body = JSON.parse(readFileSync(join(bank, "import-payload.master-preint.part26.json"), "utf8"));
  const edited = new Set(f.edited_numbers);
  const protectedFields = (q) => {
    const copy = structuredClone(q);
    delete copy.explanation_fa; delete copy.options_why_fa;
    for (const name of ["lead_fa", "golden_fa", "points_fa"]) delete copy.micro[name];
    return copy;
  };

  it("locks exact 45-row scope, all protected fields and every untouched record", () => {
    expect(f.edited_numbers).toEqual(Array.from({length:45},(_,i)=>i+1));
    expect(f.deferred_numbers).toEqual(Array.from({length:175},(_,i)=>i+46));
    expect(edited.size).toBe(45);
    const {questions, ...meta} = body;
    const {questions:original, ...originalMeta} = f.original_part26;
    expect(meta).toEqual(originalMeta);
    expect(questions).toHaveLength(220);
    let count=0;
    questions.forEach((q,i)=>{
      if (edited.has(i+1)) {
        expect(protectedFields(q), `26:${i+1}`).toEqual(protectedFields(original[i]));
        expect(q).not.toEqual(original[i]); count++;
      } else {
        // rows 46-220 were legitimately re-written by round52; the round52
        // fixture's PRE-EDIT snapshot must still match round51's untouched
        // rows (round51 left them exactly as the pre-edit file had them).
        expect(round52Baseline.original_parts["26"].questions[i], `untouched 26:${i+1}`).toEqual(original[i]);
      }
    });
    expect(count).toBe(45);
  });

  it("ships individualized explanations, four rationales and four clinical points", () => {
    const explanations = new Set(), leads = new Set();
    for (const n of edited) {
      const q=body.questions[n-1];
      expect(q.explanation_fa.length).toBeGreaterThan(300);
      expect(q.options_why_fa).toHaveLength(4);
      q.options_why_fa.forEach((reason,i)=>{
        expect(reason.startsWith(i===q.correct_index ? "گزینه صحیح: " : "دلیل رد گزینه: ")).toBe(true);
        expect(reason.length).toBeGreaterThan(30);
      });
      expect(new Set(q.options_why_fa).size).toBe(4);
      expect(q.micro.lead_fa.includes("\n")).toBe(false);
      expect(q.micro.lead_fa.length).toBeGreaterThan(20);
      expect(q.micro.golden_fa.length).toBeGreaterThan(20);
      expect(q.micro.points_fa).toHaveLength(4);
      expect(new Set(q.micro.points_fa).size).toBe(4);
      expect(q.micro.points_fa.every(p=>p.length>20)).toBe(true);
      explanations.add(q.explanation_fa); leads.add(q.micro.lead_fa);
    }
    expect(explanations.size).toBe(45); expect(leads.size).toBe(45);
  });

  it("carries the previous 81 deferred entries unchanged and adds none", () => {
    const previous=JSON.parse(readFileSync(join(here,"../../docs/round50-deferred.json"),"utf8"));
    const queue=JSON.parse(readFileSync(join(here,"../../docs/round51-deferred.json"),"utf8"));
    expect(queue.deferred).toEqual(previous.deferred);
    expect(queue.scope_count).toBe(45); expect(queue.enriched_count).toBe(45);
    expect(queue.new_deferred_count).toBe(0);
    expect(queue.cumulative_deferred_count).toBe(81);
    expect(queue.deferred).toHaveLength(81);
    for (const n of f.deferred_numbers) {
      // round52 legitimately re-wrote part26 rows 46-220 (round51's deferred
      // set); its PRE-EDIT snapshot must equal the rows round51 left behind.
      expect(round52Baseline.original_parts["26"].questions[n-1], `26:${n}`).toEqual(f.original_part26.questions[n-1]);
    }
  });

  it("keeps the other 53 banks byte-identical", () => {
    const names=Object.keys(f.original_file_hashes);
    expect(names).toHaveLength(54);
    expect(readdirSync(bank).filter(n=>PART_RE.test(n)).sort()).toEqual(names.map(n=>n.split("/").at(-1)).sort());
    for (const [name,hash] of Object.entries(f.original_file_hashes)) {
      if (name.endsWith("master-preint.part26.json")) continue;
      if (name.endsWith("master-preint.part27.json")) {
        // round52 legitimately re-wrote part27 rows 1-25 except Q23; its
        // PRE-EDIT hash (round52 fixture) must match this round51-era
        // snapshot.
        expect(round52Baseline.original_file_hashes[name], name).toBe(hash);
        continue;
      }
      if (name.endsWith("master-preint.part28.json")) {
        // round53 legitimately re-wrote part28 rows 1-5; its PRE-EDIT hash
        // (round53 fixture) must match this round51-era snapshot.
        expect(round53Baseline.original_file_hashes[name], name).toBe(hash);
        continue;
      }
      expect(createHash("sha256").update(readFileSync(join(here,"../..",name))).digest("hex"),name).toBe(hash);
    }
  });
});

// round52 fixture captured in this workspace before the part26 (paediatrics,
// rows 46-220) and part27 (rows 1-25, except the deferred Q23) payload edits;
// pre-edit payload hashes chain back through the round50/51 fixtures.
describe("round52 exact editorial boundaries", () => {
  const f = round52Baseline;
  const protectedFields = (q) => {
    const copy = structuredClone(q);
    delete copy.explanation_fa; delete copy.options_why_fa;
    for (const name of ["lead_fa", "golden_fa", "points_fa"]) delete copy.micro[name];
    return copy;
  };
  const expectedScopes = {
    26: Array.from({ length: 175 }, (_, i) => i + 46),
    27: Array.from({ length: 25 }, (_, i) => i + 1).filter((n) => n !== 23),
  };

  for (const part of ["26", "27"]) {
    const body = JSON.parse(readFileSync(join(bank, `import-payload.master-preint.part${part}.json`), "utf8"));
    const original = f.original_parts[part];
    const edited = new Set(f.edited_numbers[part]);

    it(`locks exact part${part} scope, all protected fields and every untouched record`, () => {
      expect(f.edited_numbers[part]).toEqual(expectedScopes[part]);
      expect(f.deferred_numbers[part]).toEqual(part === "26" ? Array.from({ length: 45 }, (_, i) => i + 1) : [23]);
      const { questions, ...meta } = body;
      const { questions: originalQuestions, ...originalMeta } = original;
      expect(meta).toEqual(originalMeta);
      expect(questions).toHaveLength(220);
      let count = 0;
      questions.forEach((q, i) => {
        if (edited.has(i + 1)) {
          expect(protectedFields(q), `${part}:${i + 1}`).toEqual(protectedFields(originalQuestions[i]));
          expect(q).not.toEqual(originalQuestions[i]); count++;
        } else if (part === "27" && round53Baseline.edited_numbers["27"].includes(i + 1)) {
          // round53 legitimately re-wrote part27 rows 26-220 (except its 52
          // deferred records); its PRE-EDIT snapshot must equal the rows
          // round52 left behind.
          expect(round53Baseline.original_parts["27"].questions[i], `chained untouched 27:${i + 1}`).toEqual(originalQuestions[i]);
        } else expect(q, `untouched ${part}:${i + 1}`).toEqual(originalQuestions[i]);
      });
      expect(count).toBe(expectedScopes[part].length);
    });

    it(`ships individualized explanations, four rationales and four clinical points for part${part}`, () => {
      const explanations = new Set(), leads = new Set();
      for (const n of edited) {
        const q = body.questions[n - 1];
        expect(q.explanation_fa.length).toBeGreaterThan(300);
        expect(q.options_why_fa).toHaveLength(4);
        q.options_why_fa.forEach((reason, i) => {
          expect(reason.startsWith(i === q.correct_index ? "گزینه صحیح: " : "دلیل رد گزینه: ")).toBe(true);
          expect(reason.length).toBeGreaterThan(30);
        });
        expect(new Set(q.options_why_fa).size).toBe(4);
        expect(q.micro.lead_fa.includes("\n")).toBe(false);
        expect(q.micro.lead_fa.length).toBeGreaterThan(20);
        expect(q.micro.golden_fa.length).toBeGreaterThan(20);
        expect(q.micro.points_fa).toHaveLength(4);
        expect(new Set(q.micro.points_fa).size).toBe(4);
        expect(q.micro.points_fa.every((p) => p.length > 20)).toBe(true);
        explanations.add(q.explanation_fa); leads.add(q.micro.lead_fa);
      }
      expect(explanations.size).toBe(edited.size); expect(leads.size).toBe(edited.size);
    });
  }

  it("keeps the previous 81 queue entries and records exactly one new unchanged graded entry (27:23)", () => {
    const previous = JSON.parse(readFileSync(join(here, "../../docs/round51-deferred.json"), "utf8"));
    const queue = JSON.parse(readFileSync(join(here, "../../docs/round52-deferred.json"), "utf8"));
    expect(queue.deferred.slice(0, 81)).toEqual(previous.deferred);
    expect(queue.scope_count).toBe(200); expect(queue.enriched_count).toBe(199);
    expect(queue.new_deferred_count).toBe(1); expect(queue.cumulative_deferred_count).toBe(82);
    expect(queue.deferred).toHaveLength(82);
    const entry = queue.deferred[81];
    expect(entry.part).toBe(27); expect(entry.local_question).toBe(23);
    const body27 = JSON.parse(readFileSync(join(bank, "import-payload.master-preint.part27.json"), "utf8"));
    expect(body27.questions[22]).toEqual(f.original_parts["27"].questions[22]);
    expect(entry.original_correct_index).toBe(body27.questions[22].correct_index);
  });

  it("keeps part26 rows 1-45 (round51 work) byte-identical to the fixture baseline", () => {
    const body26 = JSON.parse(readFileSync(join(bank, "import-payload.master-preint.part26.json"), "utf8"));
    for (const n of f.deferred_numbers["26"]) {
      expect(body26.questions[n - 1], `26:${n}`).toEqual(f.original_parts["26"].questions[n - 1]);
    }
  });

  it("keeps the other 52 banks byte-identical", () => {
    const names = Object.keys(f.original_file_hashes);
    expect(names).toHaveLength(54);
    expect(readdirSync(bank).filter((n) => PART_RE.test(n)).sort()).toEqual(names.map((n) => n.split("/").at(-1)).sort());
    for (const [name, hash] of Object.entries(f.original_file_hashes)) {
      if (name.endsWith("master-preint.part26.json") || name.endsWith("master-preint.part27.json")) continue;
      if (name.endsWith("master-preint.part28.json")) {
        // round53 legitimately re-wrote part28 rows 1-5; its PRE-EDIT hash
        // (round53 fixture) must match this round52-era snapshot.
        expect(round53Baseline.original_file_hashes[name], name).toBe(hash);
        continue;
      }
      expect(createHash("sha256").update(readFileSync(join(here, "../..", name))).digest("hex"), name).toBe(hash);
    }
  });
});

// round53 fixture captured in this workspace before the part27 (paediatrics,
// rows 26-220, except the 52 deferred records) and part28 (paediatrics,
// rows 1-5) payload edits; pre-edit payload hashes chain back through the
// round50/51/52 fixtures.
describe("round53 exact editorial boundaries", () => {
  const f = round53Baseline;
  const protectedFields = (q) => {
    const copy = structuredClone(q);
    delete copy.explanation_fa; delete copy.options_why_fa;
    for (const name of ["lead_fa", "golden_fa", "points_fa"]) delete copy.micro[name];
    return copy;
  };
  const deferred27 = [100, 114, 121, 126, 128, 129, 130, 132, 133, 134, 135,
    137, 138, 139, 140, 141, 142, 143, 145, 146, 148, 150, 151, 153, 154,
    156, 160, 161, 162, 163, 164, 166, 167, 169, 170, 171, 172, 173, 174,
    175, 176, 178, 179, 180, 183, 184, 185, 186, 195, 198, 203, 204];
  const expectedScopes = {
    27: Array.from({ length: 195 }, (_, i) => i + 26).filter((n) => !deferred27.includes(n)),
    28: [1, 2, 3, 4, 5],
  };

  for (const part of ["27", "28"]) {
    const body = JSON.parse(readFileSync(join(bank, `import-payload.master-preint.part${part}.json`), "utf8"));
    const original = f.original_parts[part];
    const edited = new Set(f.edited_numbers[part]);

    it(`locks exact part${part} scope, all protected fields and every untouched record`, () => {
      expect(f.edited_numbers[part]).toEqual(expectedScopes[part]);
      expect(f.deferred_numbers[part]).toEqual(part === "27" ? deferred27 : []);
      const { questions, ...meta } = body;
      const { questions: originalQuestions, ...originalMeta } = original;
      expect(meta).toEqual(originalMeta);
      expect(questions).toHaveLength(220);
      let count = 0;
      questions.forEach((q, i) => {
        if (edited.has(i + 1)) {
          expect(protectedFields(q), `${part}:${i + 1}`).toEqual(protectedFields(originalQuestions[i]));
          expect(q).not.toEqual(originalQuestions[i]); count++;
        } else expect(q, `untouched ${part}:${i + 1}`).toEqual(originalQuestions[i]);
      });
      expect(count).toBe(expectedScopes[part].length);
    });

    it(`ships individualized explanations, four rationales and four clinical points for part${part}`, () => {
      const explanations = new Set(), leads = new Set();
      for (const n of edited) {
        const q = body.questions[n - 1];
        expect(q.explanation_fa.length).toBeGreaterThan(300);
        expect(q.options_why_fa).toHaveLength(4);
        q.options_why_fa.forEach((reason, i) => {
          expect(reason.startsWith(i === q.correct_index ? "گزینه صحیح: " : "دلیل رد گزینه: ")).toBe(true);
          expect(reason.length).toBeGreaterThan(30);
        });
        expect(new Set(q.options_why_fa).size).toBe(4);
        expect(q.micro.lead_fa.includes("\n")).toBe(false);
        expect(q.micro.lead_fa.length).toBeGreaterThan(20);
        expect(q.micro.golden_fa.length).toBeGreaterThan(20);
        expect(q.micro.points_fa).toHaveLength(4);
        expect(new Set(q.micro.points_fa).size).toBe(4);
        expect(q.micro.points_fa.every((r) => r.length > 20)).toBe(true);
        explanations.add(q.explanation_fa); leads.add(q.micro.lead_fa);
      }
      expect(explanations.size).toBe(edited.size); expect(leads.size).toBe(edited.size);
    });
  }

  it("keeps the previous 82 queue entries and records exactly 52 new unchanged graded entries", () => {
    const previous = JSON.parse(readFileSync(join(here, "../../docs/round52-deferred.json"), "utf8"));
    const queue = JSON.parse(readFileSync(join(here, "../../docs/round53-deferred.json"), "utf8"));
    expect(queue.deferred.slice(0, 82)).toEqual(previous.deferred);
    expect(queue.scope_count).toBe(200); expect(queue.enriched_count).toBe(148);
    expect(queue.new_deferred_count).toBe(52); expect(queue.cumulative_deferred_count).toBe(134);
    expect(queue.deferred).toHaveLength(134);
    const body27 = JSON.parse(readFileSync(join(bank, "import-payload.master-preint.part27.json"), "utf8"));
    const newEntries = queue.deferred.slice(82);
    expect(newEntries).toHaveLength(52);
    expect(newEntries.map((e) => e.local_question).sort((a, b) => a - b)).toEqual(deferred27);
    for (const entry of newEntries) {
      expect(entry.part).toBe(27);
      expect(body27.questions[entry.local_question - 1]).toEqual(f.original_parts["27"].questions[entry.local_question - 1]);
      expect(entry.original_correct_index).toBe(body27.questions[entry.local_question - 1].correct_index);
    }
  });

  it("keeps part26 (round51/52 work) and part27 rows 1-25 (round52 work) unchanged", () => {
    const body26 = JSON.parse(readFileSync(join(bank, "import-payload.master-preint.part26.json"), "utf8"));
    expect(createHash("sha256").update(readFileSync(join(bank, "import-payload.master-preint.part26.json"))).digest("hex"))
      .toBe(f.original_file_hashes["tools/master-bank/import-payload.master-preint.part26.json"]);
    const body27 = JSON.parse(readFileSync(join(bank, "import-payload.master-preint.part27.json"), "utf8"));
    for (const n of Array.from({ length: 25 }, (_, i) => i + 1)) {
      expect(body27.questions[n - 1], `earlier 27:${n}`).toEqual(f.original_parts["27"].questions[n - 1]);
    }
    expect(body26.questions).toHaveLength(220);
  });

  it("keeps the other 52 banks byte-identical", () => {
    const names = Object.keys(f.original_file_hashes);
    expect(names).toHaveLength(54);
    expect(readdirSync(bank).filter((n) => PART_RE.test(n)).sort()).toEqual(names.map((n) => n.split("/").at(-1)).sort());
    for (const [name, hash] of Object.entries(f.original_file_hashes)) {
      if (name.endsWith("master-preint.part27.json") || name.endsWith("master-preint.part28.json")) continue;
      expect(createHash("sha256").update(readFileSync(join(here, "../..", name))).digest("hex"), name).toBe(hash);
    }
  });
});
