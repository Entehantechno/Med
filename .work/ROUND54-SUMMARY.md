# Round 54 — publication summary (2026-09-23)

## Scope
- part28 (زنان و زایمان) rows **6–220** = 215 rows; **196 enriched** with **168 shared clinical units** (21 topics reused across 2–4 rows each)
- **19 deferred** (protected text untouched): 8, 23, 25, 27, 28, 30, 32, 50, 55, 57, 66, 87, 91, 94, 113, 118, 151, 189, 218
- Deferred queue: `docs/round54-deferred.json` — 134 previous + 19 = **153 cumulative**

## Content files
- `tools/round54_items.py` (196 items) · `tools/round54_lessons.py` (168 units) · `tools/enrich_round54.py`
- Authored batches: `.work/round54-drafts/r54_b1..b6.py` (29+32+32+35+35+33)
- Only `explanation_fa`, `options_why_fa`, `micro.lead_fa/golden_fa/points_fa` were written; every other field protected and hash-verified for the other 53 payload files.
- Key alignment was machine-verified for **all 196** items: the rationale marked «پاسخ صحیح» matches `correct_index` in every case.

## Verification
- `npx vitest run test/master-bank.test.js` → **54/54 green** (round54 boundary suite + part28 hash chain through round50–53 fixtures + all earlier suites).
- `server/test/fixtures/round54-preservation.json` captures the pre-edit payload state.
- `node scripts/check-release-zip.mjs` passed: 54 bank payloads, required root files, 79 feature markers.

## Release
- `MED-School-100-round54.zip` — 19.4 MB, 994 files (previous `MED-School-100-round53.zip` deleted)
- sha256: `e8b90612a2183c2cd05e2d41f81c65512f259b7b818894e0c3b38ac419d1be71`
- Branch `arena/01a0be99-med` pushed (commits: text repair → b6 authoring → enrichment/tests → release).

## Incident & recovery (recorded for transparency)
- The sandbox workspace was wiped mid-round (reset to the remote tip `a52c72e`); the local b6 draft and every post-b6 artifact (items/lessons/enrich/fixture/deferred/test patch/zip) were lost and were re-created in this session on top of the pushed b1–b5.
- During recovery the pushed b1–b5 drafts were found to contain script contamination and garbled spans (Bengali/katakana/stray Latin inside Persian words, mistransliterated terms). `.work/round54-fix/repairs.py` + `apply.py` + `fix2.py` record the full repair map that was applied; the drafts now contain only Persian/Latin-typography characters, and units/numbers were normalised to Persian.
- Shared-unit count is 168 (the pre-wipe build had 174) because the units were re-derived from the repaired drafts; every unit is still one clinical concept shared by sibling rows.

## Language policy
Persian-first lessons; Latin only for established international names/abbreviations (BHCG, GTG/GTN, HPV, ASC-US, MMR, NST, OCT, VBAC, …) or parenthesised next to the Persian equivalent.
