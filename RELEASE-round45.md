# MED-School-94-round45

- Base: MED-School-94-round44.zip retrieved from commit b869a3fe865f8f3a1eff1a95e68bae836bed6e2f on arena/01a0a606-med.
- Delivery branch: arena/01a0b428-med (current Arena session).
- Scope: master-preint part22, questions 1–30 of 220.
- Persian explanations, four per-option rationales, micro lead/golden/four clinical points enriched individually.
- All Persian stems and options preserved exactly. All English fields, other micro fields and question metadata preserved, except the explicitly approved key below.
- Questions 31–220 and every other master-bank payload unchanged.

## Approved key exception

Question 14 (Hirschsprung disease): correct_index changed from 2 to 3, following explicit user approval. Absent rectoanal inhibitory reflex supports Hirschsprung disease; the reversed contrast-enema transition pattern is the intended negative answer. The educational explanation also flags imprecise wording in other choices. This is a medically reasoned correction, not a claim of independent verification against an official examination answer key.

## Clinical qualifications retained

- Q1: NBT is not routine initial testing without suggestive phagocyte-defect history; not a blanket ban on immunologic evaluation.
- Q2: total IgE/eosinophilia can support atopy but are nonspecific; positive skin testing requires clinical correlation.
- Q5: shock resuscitation must be cautious with anuria/respiratory distress; urgent electrolyte management and renal consultation emphasized.
- Q6/Q15: developmental ages are approximate and table-dependent; no other keys changed.
- Q21: observation applies to mild laryngomalacia, not absence of follow-up; indications for laryngoscopy and urgent review stated.
- Q28/Q30: additional pneumococcal risk indications distinguished from routine vaccination; live-vaccine restrictions depend on immune-defect type and severity.

## Small release-tool bug fix (announced before editing)

Moved errors initialization ahead of the missing-bank check in scripts/check-release-zip.mjs. Previously a bank-less ZIP raised ReferenceError instead of the intended diagnostic. No application or virtual-patient code changed.

## Validation

- Python enrichment script executed with field-level preservation assertions.
- Independent comparison against round44: exactly questions 1–30 changed; all 220 Persian stems/options identical; other master-bank files byte-identical.
- `npx vitest run test/master-bank.test.js`: 13/13 passed (Vitest 2.1.9). Initial attempt could not resolve the locally absent test dependency; rerun after environment setup passed. Full application test suite was not run.
- `node work/scripts/pack-host-zip.mjs`: 877 files.
- `node work/scripts/check-release-zip.mjs work/MED-School-host.zip`: passed, including 54 bank payloads and 70 product/security/performance markers.
- Negative regression test: ZIP without bank rejected with the intended diagnostic and no ReferenceError.
- `unzip -tq`: no compressed-data errors.
- Final ZIP compared to round44: one added Python enrichment script; only part22 JSON and the release-check script changed; no removed archive entries.

Previous root release ZIPs removed only after the new archive passed validation. Unpacked work/ is ignored by Git to retain this repository's ZIP-based delivery convention and avoid duplicate source/runtime-environment uploads. No deployment to medschool.ir was performed.
