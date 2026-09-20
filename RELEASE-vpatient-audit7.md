# MED-School-94-vpatient-audit7 — required AI evaluation and cost research

Date: 2026-09-18. Baseline audit6 / `cc80a14`. Branch: `arena/01a0b428-med`.

## Behavioral changes

- Finalization now requires valid AI checklist scoring **and** valid AI feedback/microlearning by default. Weighted arithmetic remains deterministic. Missing configuration, invalid scorer output, failed provider calls or failed teaching return sanitized HTTP 503 `ai_evaluation_unavailable`, with stage and `attemptStored: false`, before inserting the attempt. No silent keyword/template final grade.
- `.env.ready` and packaged `.env` explicitly enable `VP_REQUIRE_AI_EVALUATION=1`. Only the explicit value `0` enables legacy offline diagnostic finalization. Existing offline regression tests explicitly use that mode; dedicated integration tests verify required/default mode.
- Frontend explains required-AI failures and retains the encounter on the open page. This is not a durable evaluation queue: refresh/closing the page can lose unsaved work; partial-success retries can repeat scoring.
- `spokenHistory` preserves teacher provenance and examination mode rather than relabeling all non-student messages as patient speech.

## Verification

- Required-AI integration: six tests pass (four failed before the fix).
- Client: 25 tests in eight files pass, including four new history tests; production Vite build passes.
- Backend: **1195 pass, one known protected-bank lint failure / 1196 tests**, 34 passing test files and one failing file. The distractor-concession lint failure was not suppressed or fixed by rewriting protected booklet wording.
- Actual Chromium local application smoke: student opens case, sends three locally simulated patient messages, finalizes, receives the expected configuration 503; error is visible and the encounter remains open. Screenshot shipped at `docs/evidence/ai-evaluation-required.png`. This is no-key/offline behavior, not live-model validation.

## Research deliverables

- `docs/vpatient-ai-cost-report-fa.md`: Persian report with official quota, billing, tokenizer and pricing sources; implementation/test results and open risks.
- `docs/vpatient-costs/calculator.xlsx`: five RTL worksheets, editable inputs and cached formulas; no external workbook links.
- Same directory: 54-run summary JSON, 1656-request CSV and price examples JSON.
- `tools/vpatient-cost/`: reproducible meter, safe synthetic fixtures, pinned tokenizer dependency, workbook generator and README.

**54 offline runs are 18 combinations of three seed cases × two languages × three encounter lengths, plus 36 output-length sensitivity runs. They are not 54 distinct clinical cases. All 1656 calls have synthetic outputs; zero live completions and zero measured provider usage/charges.** Real engine request construction is captured and tokenized locally with estimated chat overhead. Raw large traces, runtime databases and dependencies are excluded.

Standard Persian example: 20 patient turns + three exam calls + two unrecorded-report calls + checklist + lesson = 27 requests. With authored patient responses padded to at least 60 o200k tokens, means are 40,096 input / 3,159 output. This is a planning scenario, not an observed live-model average. At published 50/1000 daily free quotas this admits 1/37 complete encounters per day before retries and other traffic. The 1000 tier requires the documented historical credit purchase threshold; quota is shared account-wide. Actual account quota could not be retrieved.

At observed GPT-4.1 mini rates ($0.40/$1.60 per million), the assumed volume is $2.10928 per 100 encounters, or $2.742064 with a discretionary 30% reserve, before purchase fees/tax. Gemini/DeepSeek comparisons use proxy token volume, not native measured tokenization. Prices, availability and reasoning behavior vary; no model is recommended as clinically validated.

## Remaining limitations

Authorized official OpenRouter requests previously failed before HTTP/TLS completion. No working live-provider route, live grading/lesson quality, all-free-model ranking or bug-free claim is made. The user is not asked to perform the tests. Normal-by-default unrecorded results, incomplete exam findings, clinical evidence/fairness, durable retry/idempotency and per-stage billing/output caps remain open. With broken AI connectivity, required-AI finalization intentionally refuses a final grade.

## Preservation and archive

All 54 compiled bank files and all deferred manifests are byte-identical to audit6; the 81-item deferred queue remains untouched. No question enrichment this round. Only rebuilt hashed client assets were removed/replaced. ZIP CRC, unique entries, expected exclusions and long key-like pattern scan passed; pattern scanning is not universal secret certification. No private database, e2e-data, dependency directory, logs or user API key shipped.

Artifact: `MED-School-94-vpatient-audit7.zip`
- Entries: 940
- Size: 18,698,091 bytes
- SHA-256: `671eeb366c03c62a37cb776fcd48eee231665fbab72f0f96ea05024ed644d807`

The previous ZIP is removed after validation of this successor; older commits retain release history.
