# Direct-browser OpenRouter diagnostic

This standalone page sends requests **from the operator's browser directly to the official OpenRouter API**, not through the application or development sandbox. It is a practical alternative to try when the sandbox's outbound HTTPS connection fails. It cannot guarantee that the operator's network or OpenRouter CORS/quota settings will allow the request.

## Use

1. Open `index.html` in your own browser, or open the dedicated live preview. If your browser restricts local-file networking, serve only this directory with `python3 -m http.server 4175 --bind 0.0.0.0` and open that server.
2. Enter your key in the password field on this page, not in chat. Fetch the public catalog and choose an explicitly zero-priced text model.
3. Start the ten-request synthetic test. Download the JSON report and review it before sharing it for analysis.

A successful public catalog fetch is **not** authenticated completion evidence. A completed run records actual returned model IDs and raw final-answer text. Failed/partial runs remain failed/partial. There is no model ranking or medical certification.

The previously supplied private database key is intentionally **not embedded or auto-loaded** into this publicly accessible page. The page has no backend credential endpoint. Key input is memory-only, not local/session storage or URL parameters; completion requests go only to `https://openrouter.ai/api/v1/chat/completions`. No other remote scripts, fonts, images or analytics are loaded. Browser extensions remain outside this page's control.

## Scope

Two synthetic Persian cases, five turns each: greeting, greeting plus onset, medication question, role-change probe, and diagnosis-disclosure probe. System prompts were captured without network access from the current `server/src/lib/ai-engine.js` using empty custom admin prompts. The engine SHA-256 is included in reports. This is a snapshot of the built-in patient prompt, not a dynamically linked implementation.

**This does not execute the application's output guard, grading, lessons, server authorization or complete UI.** It deliberately exposes raw model answers for review. Do not label it application E2E or proof that all patient bugs are fixed. Regenerate the embedded synthetic prompts after relevant engine changes. The private reference diagnoses are used only for limited exact-name flagging and are not included in model messages.

At most ten completion attempts, one selected model, no retries, 3.5-second minimum spacing, 45-second request timeout, 220 output tokens, zero prompt/completion price caps and `data_collection: deny`. All catalog pricing fields must be explicitly zero when present, making selection conservative rather than exhaustive. HTTP errors stop the run. Stop/Clear aborts the active fetch or pacing wait. Long answers may truncate and are flagged.

Model output is rendered with `textContent`, not HTML. Reports redact the current key and long `sk-` patterns; provider error bodies/headers are not exported. No pattern-based scrub guarantees removal of all conceivable sensitive content. Use synthetic cases only; never adapt this page to send real patient data without a separate privacy review.

## Local regression tests (mock network)

`test.mjs` runs real Chromium with mocked OpenRouter responses. Ten assertion groups cover free selection, missing keys, budgets/provider policy, injection-safe rendering, report redaction/download, no browser-storage persistence, 401/network/invalid-output failures and clear-key cancellation. **Passing these tests is not live-provider evidence.**

Install this directory's dev dependencies (`npm install`), serve this directory on port 4175, and run `npm test`. Optionally set `BROWSER_CHECK_URL` or `CHROMIUM_EXECUTABLE_PATH` to use a different local test URL/browser. The bundled Sparticuz executable targets Linux; other systems should supply a compatible Chromium executable. Some minimal Linux hosts need NSPR/NSS libraries (or the libraries bundled in the package); configure `LD_LIBRARY_PATH` where necessary. The development dependencies are not required for end users to open the standalone HTML page.
