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
