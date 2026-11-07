# R91 — owner decisions on R90 follow-ups

Version: `2026.11.06-r91-font-and-decisions`. Base: `3f9dde0` (R90).

## Decisions
1. **Tutor AI default:** unchanged. Turned on manually by the admin (`ai_enabled`, default off).
2. **Estedad 800 face:** not added. The current look stays; adding it would change about 185 rules without a visual review. Revisit only with a design review.
3. **Inter Variable:** it was never loaded, and the LTR body stack named it first. It is removed from `styles.css` (LTR body stack is now `"Segoe UI","Vazirmatn Variable","Vazirmatn",system-ui,sans-serif`). Correction to R90: Persian (RTL) pages already used Vazirmatn first through `[dir="rtl"] body` (styles.css line 62), so Persian text was not affected. This change only affects English (LTR) pages.
4. **Legal sign-off:** not a gate. The per-student inspection-hold scope is still a technical reading of 34 CFR §99.10(e) and §99.12(a); the docs say so.

## Verification
- Client `npm run build`: exit 0 (service-worker stamp r91).
- Browser (375 px, student): computed RTL body font is `Vazirmatn Variable` first; Vazirmatn loaded (100–900 variable); Estedad 900 loaded.
- `perf:budget`: pass (entry JS 25.00 KB, entry CSS 58.89, total CSS 65.21, learn 24.10).
