# R99 screenshots (2026-11-07)

Captured from the lab build (`2026.11.07-r99-student`) with Playwright. Persian UI, fa-IR locale.
Lab data only. Student 40012345 (no open exam, one class).

| File | Screen | Theme | Viewport |
|---|---|---|---|
| 01-student-home-desktop-light.png | Student home (after R99) | light | 1366×900 |
| 02-student-home-desktop-dark.png | Student home (after R99) | dark | 1366×900 |
| 03-student-home-mobile-light.png | Student home (after R99) | light | 390×844 |
| 04-student-home-mobile-dark.png | Student home (after R99) | dark | 390×844 |

The "before" student home is `screenshots/r98/05-student-home-desktop-light.png` and
`screenshots/r98/06-student-home-mobile-dark.png`.

Not captured: the state with an open exam, or with two or more modules. The lab student has
neither. Those layouts are covered by `client/src/pages/StudentHome.layout.test.jsx` (structure
only, not pixels).
