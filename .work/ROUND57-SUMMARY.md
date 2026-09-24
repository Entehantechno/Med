# Round 57 — publication summary (2026-09-24)

## Что это / What this round did
Round 56 audited the 161-row deferred queue. Its recommendation #4 — the 55 rows whose key is
sound (verdict **K** or **K_EXC**) could be enriched with **no change to any key** — was executed here.
Rows with a wrong/outdated key (KEY_WRONG/OUTDATED), damaged stems (BROKEN) or open disputes
(DISPUTED) were left untouched, exactly as the user decided after the audit.

## Scope
- **55 rows enriched** in six payloads: part22 ×2, part23 ×10, part24 ×5, part25 ×29, part27 ×3, part28 ×6
- **No `correct_index`, `question_fa` or `options_fa` was modified.** Only `explanation_fa`,
  `options_why_fa` and `micro.lead_fa/golden_fa/points_fa` were written, with the standard prefixes
  «گزینه صحیح: » and «دلیل رد گزینه: ».
- Deferred queue: **161 → 106** (`docs/round57-deferred.json`, with each enriched row's audit verdict
  and Persian note recorded in `enriched_from_queue`).

## Content files
- `tools/round57_items.py` (55 items) · `tools/round57_lessons.py` (55 units) · `tools/enrich_round57.py`
- Authored batches: `.work/round57-drafts/r57_b1..b3.py` (17+19+19)
- 55 unique explanations and 55 unique leads; every key marker machine-verified against
  `correct_index` before the payload edit.

## Verification
- `npx vitest run test/master-bank.test.js` → **65/65 green**, including the new round57 boundary suite
  (scope, cross-fixture chain, remaining 106 rows byte-identical) and the updated earlier-era suites.
- Full server suite: **49 files / 1397 tests green** (freshly built client dist).
- `node scripts/check-release-zip.mjs` passed: 54 bank payloads, required root files, 79 feature markers.

## Release
- `MED-School-100-round57.zip` — 21,765,413 B, **1004 files**
- sha256: `ac11e79fa6ef050a789a939404d95cedb4880199b2c28af24bbf132980489c86`
- Previous `MED-School-100-round55.zip` deleted (workspace-storage policy).

## Still waiting for an explicit decision
- **58 rows with a clear key error** + **8 outdated-guideline rows** — the audit report lists the exact
  replacement option for each; applying them only moves `correct_index`.
- **27 broken rows** (missing lab tables/figures, truncated options, several correct statements) need a
  content-rewrite round.
- **13 disputed rows** need the original booklet/official key.
