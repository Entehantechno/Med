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

