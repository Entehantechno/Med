# R103 screenshots

Mobile virtual-patient flow (390×844, learner account, lab data), captured with the fixed `vp-flow.mjs` harness.

- 01 / 04 — VP case list, light and dark. Axe: 0 violations.
- 02 / 03 — VP case screen, light and dark. Axe: 0 violations. One top bar. Title contrast OK in both themes.

The previous mobile failure was a harness problem, not an app bug. The "بیمار مجازی" item lives in the More sheet (`.learn-more-item`) below the fold, and the old locator matched a hidden tab-bar button first.
