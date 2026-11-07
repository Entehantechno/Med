# MED School — Design System (R97)

Reference: the Notion entry in [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
(`design-md/notion/DESIGN.md`). Process: `ui-ux-pro-max` skill (`--design-system`, RTL-aware).

## Why this direction

- The users are medical students and clinicians who read dense Persian content for long
  sessions. The product must feel calm, trustworthy and quiet, not playful.
- The generic `--design-system` output for "medical education" suggested claymorphism and
  a children's typeface (Baloo 2). It was rejected: it does not fit a clinical audience and
  Baloo has no Persian coverage.
- Notion was chosen because its structure fits a study tool: a warm neutral canvas, hairline
  borders instead of heavy shadows, 8px buttons, 12px cards, and a clear type scale with
  generous line height.

## What we keep from the MED identity

- Blue primary (`--primary #2569b0` in light, 5.6:1 on white — AA).
- Persian display face (Estedad) for headings, Vazirmatn for body.
- Tactile primary buttons (solid bottom edge) — the one playful signal, used only on primary CTAs.
- Self-hosted fonts only (no external font CDN).

## Tokens (light theme)

| Role | Value | Note |
|---|---|---|
| Canvas | `--bg #eef1f6` | existing |
| Surface (card) | `#ffffff` | existing |
| Hairline border | `--border #dbe3ee` | use instead of shadows on flat cards |
| Text | `--text #1e2b3d` | |
| Muted | `--muted #5a6578` | 5.2:1 on canvas (AA) |
| Primary | `--primary #2569b0` | single brand accent |
| Success / warning / danger | `--green`, `--warn`, `--danger` | status only, never decoration |

## Rules

1. **No emoji as icons.** Use the `Icon` set (SVG, `currentColor`). Emoji render as empty
   boxes on some Persian system fonts. Guarded by `LearnHome.icons.test.js`.
2. **One accent per card.** Decorative coloured borders are reserved for status
   (at-risk streak, placement recommendation). Do not stack many accents on one screen.
3. **Hairlines over shadows** for flat content cards.
4. **44px touch targets**, visible focus rings, `prefers-reduced-motion` respected.
5. **RTL first.** Persian is the default; logical properties (`inline-start`) only.
6. **No raw hex in new components** — use tokens.

## Scope of R97

- Done: learner home emoji → SVG icons; regression guard; this document.
- Not done (open, recorded in `docs/rounds/R97-REPORT.md`): the public `/vp` landing is a
  dark theme while the app is light (needs an owner decision on theme); learner home has
  many cards with competing gradients (a product decision on the premium banner); the
  student home is sparse; the virtual-patient case screen was not re-audited in this round.

## R98 — text-ink tokens (measured in both themes)

Status colours are fills (backgrounds, borders) or text. Text needs 4.5:1 on every surface
it sits on. The fill tokens (`--danger`, `--ok`, `--warn`, `--heart`) keep their values. The
text-only variants are the `-ink` tokens. Defined in `client/src/design-refresh.css`, after
the marker `R98 text-ink tokens`. Guarded by `client/src/design-tokens.test.js`, which checks
each token on `--bg`, `--panel`, `--panel2` and `--panel3` in both themes.

| Token | Light | Dark | Lowest contrast, light / dark (over bg, panel, panel2, panel3) |
|---|---|---|---|
| `--danger-ink` | `#b3322d` | `#ff9a94` | 5.33 / 6.36 |
| `--ok-ink` | `#17702f` | `#3ecb86` | 5.35 / 6.23 |
| `--warn-ink` | `#815000` | `#f0a640` | 5.90 / 6.32 |
| `--heart-ink` | `#b7362f` | `#ff9a94` | 5.07 / 6.36 |
| `--muted` | `#5a6578` | `#9fadc9` | 5.09 / 5.74 |
| `--muted2` | `#5f6b7e` | `#8fa0c0` | 4.67 / 4.91 |

Rules that follow from this:

1. Colour a text element with `-ink`. Do not use the fill token as the text colour.
   Guarded: no `color: var(--danger|ok|warn|heart|green2|accent2)` remains in CSS or JSX.
2. A `<button>` does not inherit `color` by default. Set `color: inherit` on any button that
   carries text on a themed surface (the landing brand did, and rendered black on the dark footer).
3. Decorative surfaces that are darker than the panel (the landing mock card) may need a
   scoped token override (`[data-theme="dark"] .mock-league{ --muted: #b4c1d9 }`).


## R99 — student dashboard (hero, stats column, compact modules)

The student home (`client/src/pages/StudentHome.jsx`) follows these rules. Classes are in
`client/src/design-refresh.css` under the marker `R99 student dashboard`. Layout is guarded by
`client/src/pages/StudentHome.layout.test.jsx`.

1. **One primary action.** A hero card shows the open exam (with `btn-accent`), or otherwise the
   first module with one explicit button. The button sits at the bottom of the hero.
2. **Stats are a side column,** not a row of full-width boxes. From 900 px, hero 2fr beside stats 1fr.
   On mobile the three stats sit in a row.
3. **Only interactive tiles look interactive.** Link tiles are `<button>` with an icon and a
   pointer cursor. The progress tile is a plain `div`.
4. **Other modules are compact cards** in an `auto-fit` grid (`minmax(240px, 1fr)`). A single
   module must never span the full width. Do not use `grid-N` by module count.
5. **Focus order equals visual order.** Do not use `grid-auto-flow: dense` on interactive tiles.
6. **Empty state** guides the next step (kept from R97).

Budget: `design-refresh.css` entry CSS is at 59.331 KB of a 60 KB limit. Trim before adding.

## R100 — solid text, header ink, learner case screen

1. **Text on a solid fill** uses `var(--on-solid)` (white in both themes). Do not write `color: #fff`.
   Guarded by `client/src/on-solid-token.test.js`.
2. **`--header` is a background, never a text colour.** For headings and timers use `var(--header-ink)`:
   `#26527a` in light, `#eaf1ff` in dark. The dark `--header` (`#0e1730`) is invisible as text on a dark surface.
   Guarded by the same test.
3. **Scrollable content** that a keyboard user must reach is a labelled region: `role="region"`,
   `tabIndex={0}`, `aria-label`. The learner case panel is the example.
4. **Embedded screens** (`CaseList`, `Exam`, `Flashcards`) take `embedded` and do not draw a second top bar
   inside LearnApp.
5. **Verify dark mode with a screenshot and `getComputedStyle`.** axe reports some low-contrast text as
   "incomplete", not as a violation, so a clean axe run does not prove the text is readable.

## R104 — style decision: flat-first, accessible boundaries

Research (ui-ux-pro-max `--domain style` / `--domain product` / `--domain color` searches, plus sources
listed in `docs/rounds/R104-REPORT.md`):

| Style | Decision for MED | Reason (measured or cited) |
|---|---|---|
| Flat (solid surfaces, hairlines, one elevation scale) | **Base** | Most accessible base; lowest GPU cost; the skill's default for dashboards and corporate/health. |
| Neumorphism | **Rejected** | Relies on shadow steps with 1.7:1 contrast; fails 1.4.3/1.4.11 in every review found. |
| Claymorphism | **Rejected** | Playful; the skill itself lists it for kids' and onboarding products. R97 already rejected it for a clinical audience. |
| Glassmorphism | **Overlays only** | Text on translucent blur fails contrast when the background changes; backdrop-filter adds GPU cost. 95 uses on the site; reduce to overlays in a later round. |
| Skeuomorphic gloss (hover sheen on buttons) | **Removed** | Decoration. Removed from `.btn-primary` and `.btn-accent`. |
| Gradients on controls and icon tiles | **Removed on the learner home and the green CTA** | One accent per screen. Gradients were the main source of visual noise. |

### Tokens (measured, WCAG 2.2)

| Token | Light | Dark | Used for | Ratio |
|---|---|---|---|---|
| `--control-line` (new) | `#7a879d` | `#6b7fa5` | input, select, textarea, `.btn-ghost` boundary | 3.63:1 / 4.15:1 on panel (1.4.11 ≥ 3:1) |
| `--border` (unchanged) | `#dbe3ee` | `#2a3757` | hairline dividers only | 1.29:1 / 1.42:1 (decoration, not a control) |
| `--accent-btn` (new) | `#1a7a4c` | `#1a7a4c` | solid green CTA fill | white label 5.34:1 (old gradient ends 2.45–4.05:1) |
| dark primary CTA label | — | `var(--bg)` `#0b1020` | blue CTA in dark | 6.0:1 on `#4f93e8`, 4.7:1 on `#3f7fd6` (white 3.2 / 4.0) |

### Rules (R104)

1. **One accent per screen.** Coloured side stripes are reserved for status: the placement offer and
   the placement recommendation. Decorative stripes (dx teaser, quest, review, rewarded) are removed.
2. **One solid CTA per screen.** The hero "continue" action is the solid primary. List actions are
   outline buttons in the primary colour (`.btn-ghost`).
3. **Controls have a 3:1 boundary.** Inputs and outline buttons use `--control-line`. A hairline
   `--border` is not enough when the border is the only cue.
4. **Flat surfaces.** No hover gloss on buttons. Icon tiles are one solid tint, not a gradient.
5. **Guarded.** `client/src/r104-style.test.js` checks the ratios, the declared tokens, and the
   one-accent rule on the learner home.

### Known open items (not in R104)

- The daily-report card and the streak card still carry a gold stripe and a gradient banner.
- The XP and warning non-text colours are below 3:1 on white (`--warn` 2.54:1, gold 2.19:1). They need
  separate `-line` tokens, applied only where the colour is the only cue.
- Glassmorphism on 95 rules: reduce to overlays in a later round.
- Okabe-Ito is the verified colour-blind-safe set for charts and categories. Status colour pairs are not yet audited for red-green.
