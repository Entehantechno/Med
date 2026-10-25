# Research — Perf + Mobile + UI/UX — 2026-10-03

## 1) Perf Audit (vite build)

- `dist/assets/index-*.js` gz 22.6KB > budget 22KB (+0.6KB)
- `dist/assets/*.css` gz 56.29KB > budget 47KB (+9.3KB)
- `LearnApp-*.js` gz 22.89KB > budget 16KB (+6.9KB)
- Fonts raw 126KB OK (<150)
- Build output: `index-*.css` 286KB raw = single monolithic CSS (all pages + admin + learner)

Root causes:
- `vite.config.js` manualChunks only splits JS, not CSS — all CSS from `src/styles*.css`, `mobile-learn.css`, `design-refresh.css`, component CSS is bundled into one `index-*.css`
- No CSS code-splitting per route; admin styles (tables, pickers) shipped to learners on first paint
- Large `styles-speed-fixes.css` (14KB) + `design-refresh.css` + `styles.css` (≈80KB raw) + Tailwind-like utilities not purged
- `LearnApp` chunk 22.9KB gz is over budget; it lazy-loads Mindmap but Mindmap itself is  ~120KB js? Actually `Mindmap-D-bl8ToE.js` is separate, but LearnApp still large due to many imports (Charts, Flashcards, etc. preloaded via routeChunks warm)
- No font subsetting; Vazirmatn variable + Estedad 900 imported globally, even though only landing uses 900 weight
- No image lazy-loading for mindmaps covers (covers/*.webp) — all covers preloaded via manifest?

## 2) Mobile Responsiveness

Checked via `client/src/pages/learn/Mindmap.jsx`, `LearnApp.jsx`, `components/*`, `styles.css` media queries:

- Mindmap: uses `grid-template-columns: 240px 1fr` on desktop, collapses to single column at 760px via `@media(max-width:760px)` — OK but toolbar buttons 28px tap target (< 44px WCAG), and canvas pan not using `touch-action: manipulation`
- Question bank (Exam/Flashcards): `VirtualList` row height 72px, but option buttons have 28px strike-through btn, and checkboxes 22px (increases to 28px at 640px, but still <44px recommended). Admin tables have dense checkboxes 22px.
- Viewport meta exists in `index.html`: `width=device-width, initial-scale=1` — OK
- No `loading="lazy"` on mindmap thumbnails in `Mindmap.jsx` — all thumbnails load eagerly, causing LCP delay on mobile
- Offline `sw.js` caches all assets, but no `stale-while-revalidate` for mindmap covers
- No `content-visibility` on question list beyond `.path-section-wrap` — VirtualList already virtualizes, but flashcards notes panel not

## 3) UI/UX Deep Dive

- Landing: good motion (`styles-motion-ads.css` 104 variants), but LCP image (hero) not preloaded with `fetchpriority=high`
- LearnApp tabs: 5 tabs with icons, but no haptic feedback on mobile, and tab bar overflows at 360px (needs horizontal scroll)
- Mindmap viewer: premium motion (104 b4f5405) but no pinch-zoom, no fullscreen, and connection bi-directional button (admin → bank) is text-only, low affordance
- Question bank search: faceted advanced search (33 maps) — UI is dense, filters grid 4 columns on desktop collapses to 2 at 760px, but at 375px it still 2 columns causing cramped selects (need 1 column)
- Dark mode: `prefers-color-scheme` not respected; only manual toggle
- Accessibility: missing `aria-label` on icon buttons (Mindmap zoom, hotspot), and focus ring is `--ring` 3px but not visible on high-contrast

## 4) Plan — Highest Impact First (No Major Site Change Without Permission)

**Perf (speed to highest):**
- P0: Enable CSS code-splitting via `cssCodeSplit: true` (Vite default) and move admin-only CSS (`admin/*`, `PathManager`, `OrderCatalogAdmin`) to lazy admin chunk via `import("./styles-admin.css")` inside Admin.jsx
- P0: Purge unused CSS: add `css.postcss` with `postcss-purge` or manually remove dead rules; quick win: split `styles-speed-fixes.css` into `base.css` (critical) vs `enhancements.css` (deferred via `media="print" onload`)
- P0: Reduce LearnApp chunk: remove eager `import("./pages/learn/LearnApp.jsx")` from `App.jsx` idle prefetch for learner? Actually prefetch is idle, but still counts to LearnApp budget? Budget measures LearnApp chunk file size, not prefetch. Reduce by code-splitting Mindmap, Charts, Flashcards further (already lazy, but LearnApp still imports many icons)
- P1: Font subset: import only `woff2` for weights 400,700,900 needed; use `font-display: swap` already, but limit unicode-range to FA subset (already) — keep 900 only for landing, lazy-load it
- P1: Add `loading="lazy"` + `decoding="async"` to mindmap covers and question images; add `fetchpriority=high` to LCP hero
- P1: Compress `dist/assets` already does `.br` + `.gz`, but add `Cache-Control: immutable` for hashed assets via `sw.js` update

**Mobile:**
- P0: Increase tap targets to 44px: `opt-strike-btn`, `hotspot-click`, `qtype-chip`, `btn-sm` at <640px
- P0: Mindmap thumbnails: `loading="lazy"`, grid `1fr` at 480px, toolbar `flex-wrap` and `touch-action: manipulation`
- P0: Search filters: at 480px, `picker-filters` to 1 column (not 2), and selects `min-height:44px`
- P1: Add `viewport` `interactive-widget=resizes-content` for iOS, and `touch-action: manipulation` globally for buttons

**UI/UX:**
- P0: Mindmap connection bi-directional button: make primary pill with icon + tooltip, reverse auto-create already implemented backend
- P0: Improve empty states for question bank (illustrated, not text)
- P1: Add `prefers-reduced-motion` already, but add `prefers-color-scheme` dark variant
- P1: Add `aria-label` to icon-only buttons, and improve focus visible for keyboard

**Implementation order:** Perf P0 → Mobile P0 → UI P0, each as small, reversible commit.
