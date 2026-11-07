# R100 screenshots (2026-11-07)

Captured from the lab build (`2026.11.07-r100-vp`) with Playwright. Persian UI (fa-IR). Lab data only.
Animations are disabled for the capture, so the same screen gives the same pixels on each run.
The pixel comparison is in the report (section 4).

| File | Screen | Theme | Viewport |
|---|---|---|---|
| 01-landing-desktop-light.png | Landing (anonymous) | light | 1366×900 |
| 02-landing-desktop-dark.png | Landing (anonymous) | dark | 1366×900 |
| 03-vp-public-desktop-light.png | `/vp` public virtual-patient page | light | 1366×900 |
| 04-student-home-desktop-light.png | Student home (40012345) | light | 1366×900 |
| 05-student-home-desktop-dark.png | Student home | dark | 1366×900 |
| 06-teacher-home-desktop-light.png | Teacher home | light | 1366×900 |
| 07-admin-home-desktop-light.png | Admin home | light | 1366×900 |
| 08-admin-home-desktop-dark.png | Admin home | dark | 1366×900 |
| 09-learner-home-mobile-light.png | Learner home (learner) | light | 390×844 |
| 10-learner-home-desktop-dark.png | Learner home | dark | 1366×900 |
| 11-vp-list-desktop-light.png | Learner virtual-patient list (case list) | light | 1366×900 |
| 12-vp-case-desktop-light.png | Learner virtual-patient case screen | light | 1366×900 |
| 13-vp-list-desktop-dark.png | Learner virtual-patient list | dark | 1366×900 |
| 14-vp-case-desktop-dark.png | Learner virtual-patient case screen | dark | 1366×900 |
| 15-student-dark-welcome-title-after.png | Crop: student home welcome heading, dark (after) | dark | crop |

## Before (the defects this round fixed)

| File | What it shows |
|---|---|
| before/vp-case-blocked-before.png | The case screen refused to load for a learner: "بارگذاری پرونده — این کیس مال مسیر دانشگاه است". Every learner was blocked (`r.use('/cases')` guard). |
| before/vp-list-duplicate-header-before.png | The learner virtual-patient list showed a second top bar in the middle of the page. |
| before/student-dark-welcome-title-before.png | Crop: the student welcome heading in dark mode was nearly invisible (`#0e1730` on a dark surface). |

## Not captured

- Mobile virtual-patient list and case (the "more" sheet navigation in the lab is not scripted yet).
- Learner home with an open exam (the lab learner has none).
- Screens showing the rotating motivational tip on the learner home differ between runs (the tip text is random). The pixel check excludes them.
