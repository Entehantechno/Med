# Round 55 — publication summary (2026-09-24)

## Scope
- part29 (زنان و زایمان، ۱۳۹۳–۱۳۹۵) rows **1–220** = 220 rows; **212 enriched** with **195 shared clinical units**
  (12 topics reused across 2–5 rows each: abortionTypes×5, earlyPregSerialHcg×4, …)
- **8 deferred** (protected text untouched): 59, 103, 110, 132, 166, 183, 191, 218
- Deferred queue: `docs/round55-deferred.json` — 153 previous + 8 = **161 cumulative**

## Why the eight rows were deferred
| row | reason |
|-----|--------|
| 59  | key (induction) vs heavy bleeding with placenta praevia |
| 103 | frothy discharge ⇒ trichomoniasis (metronidazole), key says azithromycin |
| 110 | CMV *prevention* question, key names the treatment drug (ganciclovir) |
| 132 | stem states fetal distress, key is «تحت نظر» |
| 166 | key option is not a recognised drug (شیاف اسیدیوریک) vs candidiasis vignette |
| 183 | sperm count 10 M/mL is also below reference, key marks only motility |
| 191 | key names placenta praevia (a consequence, not a predisposing cause) |
| 218 | key = surgery after MTX, conflicts with the day-4/7 hCG plateau rule |

## Content files
- `tools/round55_items.py` (212 items) · `tools/round55_lessons.py` (195 units) · `tools/enrich_round55.py`
- Authored batches (pushed before the wipe, recovered from remote): `.work/round55-drafts/r55_b1..b6.py`
  (40+39+38+39+37+19 = 212)
- Only `explanation_fa`, `options_why_fa`, `micro.lead_fa/golden_fa/points_fa` were written; every other field
  is protected and hash-verified for the other 53 payload files.
- Key alignment machine-verified for all 212 items: the rationale marked «پاسخ صحیح» matches `correct_index`.
- For the 12 shared topics the unit is a general teaching text (not a copy of one row's case), so
  `explanation_fa` stays unique for all 212 rows.

## Verification
- `npx vitest run test/master-bank.test.js` → **59/59 green** (new round55 boundary suite + part29 hash chain
  through the round50–54 fixtures).
- Full server suite: **49 files / 1391 tests green** (with the freshly built client dist).
- `node scripts/check-release-zip.mjs` passed: 54 bank payloads, required root files, 79 feature markers.

## Release
- `MED-School-100-round55.zip` — 20,612,673 B, **999 files**
- sha256: `aa549cf92fd7ec3489d3dd543a2ea778c56ef9e09148e19996d5ecba6a35bfb2`
- Previous `MED-School-100-round54.zip` deleted (workspace-storage policy).
- Branch `arena/01a0be99-med` (commits: b1…b6 authoring → enrichment/tests → release zip).

## Incident & recovery (recorded for transparency)
- Mid-round the workspace was wiped again (checkout reset to `57a831c`, `.work/` removed). The six authoring
  batches were already pushed, so `git fetch origin arena/01a0be99-med` + `git reset --hard 55bbd54`
  restored them; the un-pushed post-b6 artifacts (items/lessons/enricher/fixture/queue/test patch) were
  regenerated deterministically from the drafts and re-verified before this commit.
- `MED-School-100-FINAL-DELIVERY.zip` reappeared with the wipe and was deleted again.

## Language policy
Persian-first lessons; Latin only for established international names/abbreviations (IUD, IUGR, HELLP, LDH,
NST, AFP, VZIG, HPV …) or parenthesised next to the Persian equivalent.
