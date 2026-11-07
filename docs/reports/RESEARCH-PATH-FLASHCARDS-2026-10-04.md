# ریسرچ عمیق — مسیر یادگیری و فلش‌کارت‌های مسیر (2026-10-04)

## 1) مسیر یادگیری — Duolingo Path & Habit

- **Shifting from Tree to Single Path (2022)**: Duolingo replaced branching tree with single swirling path to reduce choice paralysis; each circle = one crown level, levels from different skills interleaved for spaced repetition [blog.duolingo.com](https://blog.duolingo.com/new-duolingo-home-screen-design/). Science: spaced repetition interleaving boosts long-term retention vs cramming [gdg-vit medium](https://medium.com/gdg-vit/decoding-duolingo-how-technology-design-can-shape-learning-journeys-8a37f48138fc).

- **Visual language**: Pastel gradients for unit headers, pebble-shaped circles with icon, winding S-curve (6-step offset), golden completed vs grey locked, START flag on current, floating arrow to jump to current, progress bar tweak to 80% to trigger perfectionism & signal spaced repetition [gdg-vit](https://medium.com/gdg-vit/decoding-duolingo-how-technology-design-can-shape-learning-journeys-8a37f48138fc)[duolingoguides](https://duolingoguides.com/ui-change-that-duolingo-users-want/).

- **Gamification stack**: XP (20 per lesson, streak bonus), streak (7-day → 3.6× retention, freeze -21% churn, widget +60% commitment), hearts (5 lives), leagues (30-person weekly, +25% completion), guidebook per unit, stories built into path [uinkits](https://www.uinkits.com/blog-post/how-to-design-like-duolingo-gamification-engagement)[digia.tech](https://www.digia.tech/post/duolingo-habit-forming-reminders-retention-architecture/) [screensdesign](https://screensdesign.com/showcase/duolingo-language-lessons).

- **Pain points**: New path 200 units ×10 exercises, 20s scroll to old content, colors now for characters not progress → harder tracking [duolingoguides](https://duolingoguides.com/ui-change-that-duolingo-users-want/). Lesson: keep compact sticky continue, jump-to-current, collapsible old units.

- **Telemetry**: Half-life regression per word to schedule review optimally; XP bars & skill cues as guiding companion [gdg-vit](https://medium.com/gdg-vit/decoding-duolingo-how-technology-design-can-shape-learning-journeys-8a37f48138fc).

## 2) فلش‌کارت — Anki vs Quizlet 2026

- **Anki SRS**: SM-2/FSRS, 37% better retention vs traditional (J Cogn Sci 2025), 86.2% US med students use, 50-80% retention at 30 days vs 10-25% [aitooldiscovery](https://www.aitooldiscovery.com/guides/quizlet-vs-anki)[learnlog](https://learnlog.app/vs/anki-vs-quizlet/) ; UI functional not polished.

- **Quizlet**: Modern, beginner-friendly, games, but no true SRS (removed 2020, new mode Aug 2026 too new), $35.99/yr, ads [learnlog](https://learnlog.app/vs/anki-vs-quizlet/) ; Good mobile sync, rich templates.

- **Design best practice**: Question-first (not title), hints in separate blue boxes, image zoom, progress dots dense handling, Doctordle-style guess rows, no-penalty banner, immediate feedback with gentle red not alarming; card flip 3D, swipe.

- **Osmosis/Memorang**: Integrated video + flashcards with strength meter, multiple learning modes (flashcard/MCQ/fill), gamification points/levels [whitecoathub](https://www.whitecoathub.com/post/best-spaced-repetition-platforms-for-medical-school-usmle-step-1-2-3-prep).

## 3) شکاف فعلی و پیشنهاد

**LearnPath**: already has winding, unit-header, mascot, but lacks: glass hero with floating constellation, sticky glass continue bar, pulsing current node, confetti per unit, collapsible windowed path.

**Flashcards (Flashcards.jsx & Lesson)**: functional but lacks: glass 3D card, swipe, FSRS buttons (Again/Hard/Good/Easy) with interval preview, strength meter, zoomable image overlay, no-penalty glass banner.

**Implement**: Path → glass constellation hero, pulsing node, windowed collapse; Flashcards → glass flip, FSRS footer, zoom, progress dots.
