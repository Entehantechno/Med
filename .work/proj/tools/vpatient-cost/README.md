# Offline full-workflow token meter

This tool measures actual request strings constructed by the application engine, with **synthetic responses replacing fetch**. No OpenRouter credentials are needed. It is not a live benchmark, billing report, clinical validation or model ranking.

## Reproduce

Use Node compatible with the server and Python 3. Install the server dependencies as described in the application's README, then install the isolated measurement dependency:

```sh
# From the release/application root
npm --prefix tools/vpatient-cost install
VP_COST_DIR="$PWD/e2e-data/cost-measurement" VP_PATIENT_OUTPUT_FLOOR=0 node tools/vpatient-cost/measure.mjs
VP_COST_DIR="$PWD/e2e-data/cost-60" VP_PATIENT_OUTPUT_FLOOR=60 node tools/vpatient-cost/measure.mjs
VP_COST_DIR="$PWD/e2e-data/cost-120" VP_PATIENT_OUTPUT_FLOOR=120 node tools/vpatient-cost/measure.mjs
python -m venv e2e-data/report-venv
e2e-data/report-venv/bin/pip install xlsxwriter==3.2.9
e2e-data/report-venv/bin/python tools/vpatient-cost/report.py
```

Do not set DATA_DIR to a production database directory. By default the meter isolates it under its output directory. The report builder expects the three directories above. On Windows, use equivalent environment variable assignment and virtual-environment executables.

`measure.mjs` writes raw synthetic request/response traces (`samples.json`) and aggregate statistics (`summary.json`). `report.py` writes `docs/vpatient-costs/calculator.xlsx`, `samples-summary.json`, `per-request-tokens.csv`, and `price-examples.json`. The workbook has five RTL sheets and cached formula values for viewers without a calculation engine. Blue cells are editable. Model-price comparisons do not apply the calculator's cache discount: they use the displayed uncached model rates.

## Method and limitations

- Three synthetic educational seed cases × two languages × three encounter lengths = 18 configurations per response-length scenario; three scenarios = 54 runs, **not 54 different clinical cases**.
- 14 / 27 / 51 requests for short / standard / long encounters. Each includes one AI checklist request and one combined feedback/microlearning request. Two already-recorded lab results add no direct API calls.
- Fixtures contain no patient records or user settings. Checklist responses are authored for sizing, not clinically adjudicated. Lessons and baseline responses are synthetic/local-engine output.
- Output-floor 60/120 scenarios add explicit filler, not plausible new clinical dialogue. They demonstrate sensitivity to response length and history retransmission.
- `js-tiktoken` 1.0.21 counts content with o200k_base and cl100k_base. Chat overhead is estimated as 3 priming tokens plus 3 + role tokens per message. Native provider framing and tokenizers can differ.
- o200k is relevant to GPT-4.1 text tokenization; neither encoding is asserted to be Gemini's or DeepSeek's native tokenizer.
- No real model replies, billed usage, reasoning, cache hits, retries or real student behavior were measured. The comparison rates were observed on 2026-09-18, not guaranteed for future routing.
- Raw traces/runtime data and dependencies are intentionally excluded from deployment archives; compact reproducible results and tool source are included.

See `docs/vpatient-ai-cost-report-fa.md` for Persian analysis, official quota/pricing sources, test outcomes and unresolved clinical risks.
