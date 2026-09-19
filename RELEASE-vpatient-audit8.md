# MED-School-94-vpatient-audit8 — ordered multi-model / multi-key AI routing

Date: 2026-09-18. Baseline: audit7 / `ad49667`. Branch: `arena/01a0b428-med`.

## Delivered

- Shared ordered-connection editor in university and competitive virtual-patient AI settings: up to eight rows, independent provider/model/key/base URL, stable IDs, reorder, enable/disable, explicit key clearing, cooldown and OpenRouter account quota group. New rows are disabled; paid connections are used only when explicitly configured and enabled. Legacy single-model settings remain available when ordered mode is off.
- Server persistence preserves keys by stable row ID, validates duplicate IDs/count/cooldowns and supports explicit clear. Empty enabled routing does not silently inherit legacy/environment keys or switch university traffic to the competitive key. An empty competitive configuration can inherit the university routing list; an enabled separate list takes precedence.
- Text-engine failover follows priority, observes Retry-After (seconds/date) and recognized reset headers, cools failures, retries higher priority on the next request after expiry, and allows one half-open recovery probe per connection/process. Explicit daily free quota failures wait at least until the next UTC day.
- Platform/unknown OpenRouter free 429s cool free rows in the same account quota group (including different keys); identified upstream failures permit another free row. Configured paid or independent-provider fallbacks can still run. This does not multiply provider quotas.
- No routing around HTTP 403 or explicit content refusal. Raw provider diagnostics and credentials are not included in routing errors. Redirect following is disabled for text API calls; existing internal-address protection remains.
- Admin test reports the selected fallback and returned model; grading metadata records scoring and teaching routes. Blog generation/rewrite also resolves the shared ordered configuration. Image API configuration is not changed.
- Required-AI grading/lesson finalization from audit7 is preserved. Failed finalization never silently stores a keyword/template final grade.

## Evidence

Final full backend: **1216 passed, one existing protected-bank distractor lint failure / 1217 tests**; 36 passing files, one failing file; 161.55 s. All 21 new backend tests pass (13 routing + eight settings/API integration); the six required-AI tests still pass. No suppression or protected-bank rewriting.

Final client: **28 passed / nine files**, including three new editor tests. Production build succeeds.

Actual Chromium application smoke: admin login, add/edit two disabled rows, reorder both ways, save, reload and verify order, remove rows and restore preview to no-key state. Screenshot included: `docs/evidence/ai-routing-settings.png`. No provider call or real credential in this browser smoke.

Provider responses in the failover tests are mocked: free→paid→free, shared-key quota grouping, upstream-specific limits, daily UTC reset, Retry-After/reset headers, network/402/5xx, refusal, concurrent half-open recovery, exact request/key selection and actual model reporting. No live-model quality, live quota bucket measurement or paid inference is claimed.

## Research and operating guide

`docs/ai-routing-and-free-limits-fa.md` contains Persian findings, official links and setup instructions. Treat OpenRouter's 20 RPM as a general free-usage ceiling for planning, not 20 times the number of free models. Upstream model capacity and platform quota are different; only the former can potentially be solved by another free model. Direct provider free tiers and BYOK retain their own limits/costs; no official guaranteed unlimited hosted free API was found.

## Important limits

- Each routed transport attempt: 15 s maximum; each generation operation: 50 s aggregate budget. Slow failures can exhaust that budget before all eight rows are tried. These limits fit the existing 60 s chat / 180 s evaluation client timeouts; slow models may need future configurable timing.
- Cooldowns are process-local and lost on restart, not synchronized across workers. Configuration itself is persisted. This is not a distributed queue, preemptive rate limiter or spending cap.
- User-supplied quota group must match actual account ownership; the app cannot infer whether different keys share an account. Unidentified 429s are conservatively grouped. Expiry triggers a retry, not a guarantee of recovery; no proactive account quota polling was added.
- Semantic/clinical validity and stage-specific JSON validation are not universally retried across models. A successful transport with invalid grading/teaching still fails required-AI finalization. Patient dialogue retains its previously documented local fallback behavior.
- Switching providers can send the encounter to multiple services and affect grading comparability. Each service's privacy/retention policy and medical quality need independent validation. No at-rest key encryption or per-request billing cap was added.
- Prior cost workbook remains a historical no-failover planning estimate, not a cap including retries. Open clinical issues remain documented.

## Preservation / archive

All 54 compiled banks, deferred manifests and release environment are byte-identical to audit7. No question enrichment or change to the 81-item deferred queue. Only rebuilt hashed frontend assets are removed/replaced. Archive CRC, entry uniqueness, dependency/private-data exclusions and long key-pattern scanning passed; pattern scanning is not universal secret certification.

Artifact: `MED-School-94-vpatient-audit8.zip`
- Entries: 947
- Size: 18,860,379 bytes
- SHA-256: `212dc62986bcffd79b2253e2645b263fc173a32e7d0a6a3718335be954b7e62d`

The previous ZIP is deleted only after this successor passes verification. User credentials, private databases, dependency directories and raw test logs are not shipped.
