/* R98 — text-ink token guard.
   Status colours used as TEXT (danger, ok, warn, heart) and the secondary muted tones must
   reach WCAG AA (4.5:1) on every surface they sit on, in both themes. The fill tokens
   (--danger, --ok, --warn) are unchanged; the *-ink tokens are the text-only variants.
   Reads the source, so it runs without a browser. The axe audit (R98 report) is the
   browser-level check. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';

// Every .css/.jsx/.js source file under src, excluding tests.
function listSources(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((f) => /\.(css|jsx|js)$/.test(f) && !/\.test\./.test(f));
}

const SRC = join(process.cwd(), 'src');
const read = (rel) => readFileSync(join(SRC, rel), 'utf8');

function lum(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Body of the first `selector{ ... }` block (no nested braces in these files).
function block(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}
function declared(body, name) {
  const m = body.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1] : null;
}

const r98Start = read('design-refresh.css').indexOf('R98 text-ink tokens');
const refresh = read('design-refresh.css');
const styles = read('styles.css');

// The R98 block: the light :root and dark [data-theme="dark"] declarations that follow the marker.
const r98 = r98Start < 0 ? '' : refresh.slice(r98Start);
const r98Light = block(r98, ':root{');
const r98Dark = block(r98, '[data-theme="dark"]{');

const TEXT_TOKENS = ['danger-ink', 'ok-ink', 'warn-ink', 'heart-ink', 'muted', 'muted2'];
const SURFACES = ['bg', 'panel', 'panel2', 'panel3'];

// Surfaces come from styles.css: the first :root block is light, the first dark block is dark.
const lightSurf = block(styles, ':root{');
const darkSurf = block(styles, '[data-theme="dark"]{');

describe('text-ink tokens (R98)', () => {
  it('the R98 token block exists in design-refresh.css', () => {
    expect(r98Start).toBeGreaterThanOrEqual(0);
    expect(r98Light).not.toBe('');
    expect(r98Dark).not.toBe('');
  });

  for (const [theme, body, surf] of [['light', () => r98Light, () => lightSurf], ['dark', () => r98Dark, () => darkSurf]]) {
    it(`${theme}: every text-ink token defines a value`, () => {
      for (const name of TEXT_TOKENS) expect(declared(body(), name), `${theme} --${name}`).not.toBeNull();
    });
    it(`${theme}: every text-ink token reaches 4.5:1 on every surface`, () => {
      const failures = [];
      for (const name of TEXT_TOKENS) {
        const value = declared(body(), name);
        if (!value) continue;
        for (const s of SURFACES) {
          const bg = declared(surf(), s);
          if (!bg) { failures.push(`no --${s} in ${theme} surface block`); continue; }
          const ratio = contrast(value, bg);
          if (ratio < 4.5) failures.push(`${theme} --${name} ${value} on --${s} ${bg} = ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it('text uses the ink tokens, not the fill tokens (CSS and JSX style strings)', () => {
    // Fill tokens may still colour backgrounds and borders; they must not colour text.
    const offenders = [];
    for (const rel of listSources(SRC)) {
      const src = readFileSync(join(SRC, rel), 'utf8');
      const re = /(?<![\w-])color:\s*["'`]?var\(--(danger|ok|warn|heart|green2|accent2)\)/g;
      let m;
      while ((m = re.exec(src))) offenders.push(`${rel}: color:var(--${m[2]})`);
    }
    expect(offenders).toEqual([]);
  });
});
