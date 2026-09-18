# MED-School-94-round46

Base: round45 (a89463d). Delivery branch: arena/01a0b428-med.
Scope: master-preint part22, questions 31–60, 30 educational enrichments.

## Approved reference-review outcomes

The user requested reference-based correction of Q50, Q53 and Q59. Research overturned the initial proposal to simply rekey Q50: within the 3–36-month range both age and gender can satisfy its negative stem. Q50 and Q53 therefore use the existing multi-answer/keyless mechanism rather than an invented unique answer. Q59 is rekeyed to expiratory chest imaging (index 0), with key_source=registry-corrected.

The original question stems and options are unchanged, including their transcription ambiguities. Q1–30, Q61–220 and all other master-bank payloads are unchanged. English fields and unrelated metadata are preserved. No application/virtual-patient code changes were made.

The full Persian editorial report and source citations are inside the archive at docs/part22-batch2-review.md. It explicitly distinguishes Nelson Textbook indexed evidence and supplementary clinical references from the unavailable full prescribed Nelson Essentials edition and official 1396 answer keys. No claim of official-key verification is made. Clinical qualifications for other ambiguous/historical questions are documented without changing their keys.

## Validation

- Enrichment Python script executed; field-level preservation checks passed.
- Independent comparison to round45: exactly Q31–60 modified, all 220 stems/options equal, unrelated fields preserved except approved key/status metadata for Q50/Q53/Q59.
- Enrichment rerun is byte-identical (idempotent).
- `npx vitest run test/master-bank.test.js`: 15/15 passed, including two new regression tests.
- Exact bank counts updated for the two newly ungraded items: 11,120 preinternship questions = 11,089 keyed + 31 keyless (27 multi-answer + 4 low-confidence).
- `node work/scripts/pack-host-zip.mjs`: 879 archive entries.
- `node work/scripts/check-release-zip.mjs work/MED-School-host.zip`: passed, with all 54 bank payloads and all 70 feature/security/performance markers.
- `unzip -tq`: no compressed-data errors.
- Archive comparison: added only docs/part22-batch2-review.md and tools/enrich_part22_batch2.py; changed only part22 JSON and server/test/master-bank.test.js; no removed entries.
- Full application test suite and live deployment were not performed. Structural tests do not independently certify medical content. Existing production database rows have not been migrated.

Final archive: MED-School-94-round46.zip (approximately 16.1 MiB).
SHA-256: cdbf839436d2b24b4d11644cb5fb0aacc9e4f4f3d9fe5b5d9474e6553ac89105

The previous round45 archive is removed from the current checkout only after successful validation. Git history is preserved; unpacked work remains ignored under the repository's ZIP-delivery convention.
