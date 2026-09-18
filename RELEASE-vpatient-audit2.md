# MED-School-94-vpatient-audit2 — QA candidate, not all bugs resolved

Date: 2026-09-18. Baseline: `MED-School-94-vpatient-audit1.zip`, commit `5cca0b1`.
Branch: `arena/01a0b428-med`.

## Actual scope and changes

- Preserve failed JSON/system compatibility retry responses rather than ignoring terminal 401/402/429/500 responses and retrying a stale 400.
- Sanitize malformed conversation histories and exclude teacher turns from the patient conversation context.
- Replace invented chest/abdominal clinical fallback templates with conservative same-language chart excerpts or an explicit unavailable-information response. No diagnosis-derived symptom/severity invention or automatic negative social history. This remains heuristic extraction, not clinically validated language understanding.
- Fix radiation-versus-location matching (`anywhere` contains `where`), greeting substring matching (`this` contains `hi`), and drug-use-versus-medication routing.
- Remove a legacy fixed provider key from seed and bundled environment configuration. Seed settings no longer claim a verified connection. The old key is NOT reproduced here.

**Security action required:** the owner must revoke the old key at its provider. Removing it from this release does not remove it from existing deployments, old downloads or Git history. Existing installation environment/database settings are not migrated automatically; update those saved settings after revocation. The new release `.env` intentionally differs from audit1: its AI key is empty. No production database was accessed.

## Direct dialogue evidence

Real local Express API routes were exercised via Supertest on seeded synthetic cases, not substituted response mocks: three cases in Persian and English, **6 encounters, 48 chat turns, 18 order requests and 6 evaluations**. Twelve in-catalog orders succeeded; six deliberately unsupported orders correctly returned HTTP 400. This was an admin-path API smoke run, not browser E2E or a full student access-path test.

An initial local run inherited the old seed provider configuration and failed on outbound connections, falling back locally. After discovery, AI settings were cleared in the isolated test database and outbound fetch explicitly blocked. The final six encounters were repeated with **zero outbound requests**, using the actual deterministic patient engine. Only that final run is included in `docs/vpatient-audit2-dialogues.json`.

Observed examples: the dyspnea case previously invented a two-hour exertional chest-pain onset and left-arm/jaw radiation, even switching to English in Persian mode. It now uses the recorded one-hour history and reports unavailable radiation details. The English abdominal radiation question now returns the recorded right-shoulder radiation instead of pain location.

## OpenRouter remains blocked

Python, curl and Node retries failed at TLS. DNS resolved, but IPv4, HTTP/1.1, TLS 1.2 and the second official DNS address did not establish a connection. An independent HTTPS control also failed. `OPENROUTER_API_KEY` was not configured in the execution environment. TLS verification was not disabled, and no third-party credential relay was used.

**Zero live OpenRouter completions and no model ranking.** Working outbound HTTPS and a securely configured replacement key are prerequisites for the existing live benchmark harness. The local transcript must not be presented as live model evidence.

## Validation

- 8 new contract regressions failed before correction and passed afterward.
- 11 initial chart-fallback regressions failed before correction and passed afterward; one additional chief-complaint disclosure regression was added (12 total in the new file).
- 3 new seed/environment security tests; 23 additional backend tests overall.
- Final stable backend run: **1172 passed, 1 failed, 1173 total**, 33 files, 174.50 seconds.
- The sole remaining failure is the previously reproduced immutable-bank distractor lint, flagging 28 strings. It is not proof of 28 wrong clinical questions. No test was skipped or removed to conceal it.
- Client rerun: **21 passed**, 7 files. UI source and production build are byte-identical to audit1; no new browser run or build claimed.
- Independent archive checks: CRC, unique entries, no old paths removed, exactly 54 protected bank payloads plus round50 queue/preservation fixture byte-identical.
- Only existing archive files changed: `.env.ready`, `.env`, `server/src/lib/ai-engine.js`, `server/src/seed.js`, `server/test/vp-model-contract.test.js`. Four new report/test files added.
- `.env` equals sanitized `.env.ready`, not local test configuration. No runtime data, logs, dependency/cache directories or general `sk-` key pattern followed by at least 30 key-like characters in archive contents. This pattern scan is not a universal secret certification.

## Unresolved blockers

The direct dialogue confirms that missing lab results can still be represented as normal (TSH in all six encounters). Equivalent-intent Persian/English encounters on case2 scored 0 versus 12, demonstrating remaining keyword-grading sensitivity. Cases1/3 both scored 27 in both languages; this does not establish fairness. Neither rubric weights nor case data were changed to hide the discrepancy.

Clinical unknown-data policy for labs/exams, indication ground truth, negation-aware scoring, server-authoritative encounter evidence, heterogeneous rubric criteria, structured management/dose/contraindication assessment, real model quality/safety and browser/mobile checks remain open. See `docs/vpatient-audit2-review.md` and the prior audit report. No claim that all bugs are fixed or that this version is clinically certified.

Question enrichment remains paused; 81 deferrals unchanged. Next question batch remains part25 Q201–220 and part26 Q1–180.

## Artifact

`MED-School-94-vpatient-audit2.zip`: **914 entries; 17,756,022 bytes**.

SHA-256: `c1f700ff200dc072d00b95221bfa9c5b9940c24cb50263acc085f834b0c6b9c2`.

The previous audit1 ZIP is removed after this independent validation, per the standing storage instruction. Prior release notes remain historical records.
