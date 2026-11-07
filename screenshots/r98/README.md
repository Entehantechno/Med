# R98 screenshots (2026-11-07)

Captured from the lab build (`2026.11.07-r98-design`) with Playwright. Persian UI, fa-IR locale. Lab data only.

| File | Screen | Theme | Viewport |
|---|---|---|---|
| 01-landing-desktop-light.png | Landing (anonymous) | light | 1366×900 |
| 02-landing-mobile-light.png | Landing (anonymous) | light | 390×844 |
| 03-vp-desktop-light.png | `/vp` public virtual-patient page | light | 1366×900 |
| 04-vp-mobile-dark.png | `/vp` public virtual-patient page | dark | 390×844 |
| 05-student-home-desktop-light.png | Student home (student 40012345) | light | 1366×900 |
| 06-student-home-mobile-dark.png | Student home | dark | 390×844 |
| 07-learner-home-mobile-light.png | Learner home (learner) | light | 390×844 |
| 08-learner-home-mobile-dark.png | Learner home | dark | 390×844 |
| 09-flashcards-picker-mobile-light.png | Flashcards picker, topic cardio (free learner) | light | 390×844 |
| 10-admin-home-desktop-light.png | Admin home | light | 1366×900 |
| 11-admin-home-desktop-dark.png | Admin home | dark | 1366×900 |
| 12-teacher-home-desktop-light.png | Teacher home | light | 1366×900 |

## Review notes (what was looked at)

Reviewed in detail: 04, 05. The rest are captured but not yet reviewed closely.

- **05 Student home (desktop):** sparse. The page ends at about y=430 of 900. Two link tiles
  ("آزمون‌های من", "کلاس‌های من") are buttons with no icon and no visible affordance. The
  progress tile ("پیشرفت من") is not interactive, so it looks the same as the links. R97 already
  flagged this as an owner-priority decision. No layout change was made.
- **04 VP public page (mobile, dark):** clear hierarchy, readable vitals, sensible CTAs. No
  change needed.
