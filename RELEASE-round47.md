# MED-School-94-round47

Baseline: MED-School-94-round46.zip (commit 3d378cd).
Session branch: arena/01a0b428-med.

## Scope and user decision

The nominal 200-item scope is part22 Q61–220 plus part23 Q1–40. The user explicitly deferred the six previously flagged items until the end and requested completion of the rest.

**194 questions enriched:** part22 155 + part23 39.
**Six completely unchanged:** part22 Q142, Q145, Q166, Q174, Q214; part23 Q32.

No question stem, option, key, English field, grading status or other metadata changed in this release. The only payload changes are explanation_fa, options_why_fa, micro.lead_fa, micro.golden_fa and micro.points_fa in the 194 allowed records. The deferred items retain even their old explanations and keys; this is not endorsement of their content and they have not been made ungraded.

## Content

194 distinct case-specific explanations and leads; four explicit option rationales and four structured clinical points each. Shared concepts draw on 112 authored clinical teaching units, with separately written interpretation and reasoning for every question. Ambiguous transcription, historical practices and non-unique wording are flagged in the education rather than silently repaired in stems/options or rationalized as certain clinical facts.

Detailed Persian report and selected clinical references: `docs/round47-review.md` inside the ZIP.
Persistent deferred queue: `docs/round47-deferred.json` inside the ZIP.
There is no claim that all items were independently matched to the exact prescribed Nelson Essentials edition or official examination key. These remain unavailable for some disputed items.

## Validation

- `python work/tools/enrich_round47.py` passed its scope and field allow-list assertions.
- Independent baseline comparison: exactly 155 + 39 changed questions; all 440 stems/options/keys in the two parts unchanged; all six deferred records identical; no non-permitted field edits.
- Re-running enrichment produced byte-identical payloads.
- `npx vitest run test/master-bank.test.js`: **19/19 passed** (15 existing + 4 new regression tests).
- Baseline fixture generated from round46, not from edited payloads: protects all non-editable fields/records, metadata and raw SHA-256 hashes of the other 52 master-bank files.
- Existing total/keyless counts are unchanged.
- `node work/scripts/pack-host-zip.mjs`: **885 entries**.
- `node work/scripts/check-release-zip.mjs work/MED-School-host.zip`: passed; **54 bank payloads, 70 product/security/performance markers**.
- `unzip -tq`: no compressed-data errors.
- Final archive diff: changed only part22 JSON, part23 JSON and master-bank.test.js. Added only three editor Python modules, the baseline test fixture, Persian review and deferred queue. No removed archive entries.
- Full application suite was not run. Structural test success is not independent medical certification.

## Artifact and progress

Final: `MED-School-94-round47.zip`, 17,069,884 bytes (about 16.3 MiB).
SHA-256: `97e6bebdf7d9f501384f6a9e80c9311be9b928254c2384c8040cd60e45ced666`.

Part22 now has 215/220 enriched records, with five deferred. Part23 has 39 enriched records from its first 40, with one deferred. Next ordinary continuation starts at part23 Q41; retain the six-item deferred queue for final source review. Do not label part22 fully complete yet.

Previous root ZIP removed only after final artifact verification. Git history preserved. No application/virtual-patient/UI code changed; no production deployment or database migration performed.
