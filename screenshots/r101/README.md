# R101: AI outage does not restrict students (screenshots)

- `01-learner-case-after-queued-encounter.png`: learner account in the lab, AI unavailable
  (no key, grading required). A previous encounter on this case is queued for grading. The case
  screen opens normally with a new encounter: no "previous encounter still being recorded" (409)
  message, the timer is running, and the chat is live.

Before the fix (same lab steps, HEAD `a48c0cd`): the second start returned
`409 evaluation_in_progress`. The response is recorded in the report (docs/rounds/R101-REPORT.md),
not as a screenshot.
