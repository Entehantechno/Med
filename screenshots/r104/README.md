# R104 screenshots — flat-first style, accessible boundaries, one accent per screen

Lab data (data-ui), 1366×900 desktop and 390×844 mobile, light and dark. Animations off.

- 01 — learner home, light: BEFORE (six coloured side stripes, gradient icons, green CTAs) and AFTER (one solid blue hero CTA, outline list actions, two status stripes kept).
- 02 — learner home, dark: BEFORE and AFTER.
- 03 — learner home, mobile light: BEFORE and AFTER.
- 04 — hero CTA crop, dark: BEFORE is a navy panel-coloured button (the dark `.btn` gradient overrode the CTA fill). AFTER is a blue CTA with dark ink (6.0:1 on #4f93e8).
- 05 — student home, dark, AFTER: the same CTA fix for the student's card button.
- 06 — flashcard picker, mobile dark, AFTER: the selected chip and the 'practise all' button have dark ink on the blue primary.
- 07 — admin home, light, AFTER: the search and ghost buttons have the darker 3:1 control boundary.

Pixel diffs (before → after, `pixdiff`): landing light/dark SAME, student mobile light SAME, teacher dark SAME, learner home changed (intended), admin/teacher light a 3:1 boundary change only (1,226 px and 266 px).
