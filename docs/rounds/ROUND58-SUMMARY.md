# Round 58 — publication summary (2026-09-24)

## What this round did
Round 56 left a 106-row deferred queue with a verdict per row. Round 58 turns that audit into an
**actionable, verified remediation pack** — and applies **nothing**. No `correct_index`, no stem and
no option changed anywhere; the payloads are byte-identical to the round57 release.

## Deliverables
| File | Contents |
|---|---|
| `docs/round58-key-proposals.json` | 58 wrong-key rows with the corrected option, matched against the printed text, plus a manual second pass over the riskiest rows |
| `docs/round58-outdated-rows.json` | 8 guideline-drift rows: 6 decided (meconium-resuscitation family), 2 left open with reasons |
| `docs/round58-broken-rows.json` | 27 rows that cannot be fixed by moving a key (missing tables/figures, truncated options, several correct options) |
| `docs/round58-disputed-rows.json` | 13 rows that need the original booklet |
| `tools/apply_round58_keys.py` | preview by default; `--apply` writes only the index + an audit trail; refuses a stale pack; output format keeps the future diff minimal |
| `server/test/master-bank.test.js` | new five-test pack-integrity block, two-state (pending or applied) |

## Verification
- Machine match of every proposal against the printed option it names: **56/58 exact**, 2 re-checked by
  hand (`27:141`, `27:204`) because the audit phrase was too short to auto-match.
- Manual full read (stem + four options) of the ten riskiest rows, including `23:98` — where the audit's
  proposal turned out to be correct precisely because the question asks for the **least** likely cause.
- 7 of the 58 rows carry garbled option text (e.g. `27:163`, «سلlatent»); each is recorded in the pack.
- `npx vitest run test/master-bank.test.js` → **70/70 green**; full suite → **49 files / 1402 tests green**.
- `node scripts/check-release-zip.mjs` passed: 54 bank payloads, required root files, 79 feature markers.

## Release
- `MED-School-100-round58.zip` — 21,781,547 B, **1009 files**
- sha256: `5cbf53aacc3e01be2086d2a1592c0da431d5379c78bc6b30200fc22a30828a3a`
- Previous `MED-School-100-round57.zip` deleted (workspace-storage policy).

## Why the 66 key rows were not enriched
`options_why_fa` writes «گزینه صحیح: » on the keyed option. Enriching a row whose key is wrong would
freeze that wrong key into the teaching text, so the order has to be: approve + apply the key, then
enrich the row in a later round.

## Awaiting one decision
1. Apply the 58 key corrections (+ optionally the 6 guideline rows) — one command, audit-trailed.
2. Or run a content round for the 27 broken rows first.
3. Or leave the pack as documentation and stop touching the bank.
