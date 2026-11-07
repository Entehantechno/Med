/* Dashboard guards (R87). They read the source, so they run without a browser.
   1) Scroll anchoring is off for the document. Without it, Chrome kept the login page's
      scroll offset (~1350px) after sign-in, so the admin dashboard opened mid-page.
   2) The admin KPI labels are explicit bilingual strings. t(key) has no "learners" entry,
      and the raw key used to show on the Persian screen. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

describe('dashboard guards (R87)', () => {
  it('disables scroll anchoring on the document', () => {
    const css = readFileSync(join(SRC, 'styles.css'), 'utf8');
    expect(css).toMatch(/html\{overflow-anchor:none\}/);
  });

  it('admin KPI labels do not fall back to raw keys', () => {
    const src = readFileSync(join(SRC, 'pages/Admin.jsx'), 'utf8');
    const start = src.indexOf('const kpis = [');
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf('];', start));
    expect(block).not.toMatch(/t\(k\)/);
    // Every KPI row carries a label string (fa and en).
    expect((block.match(/fa \? "/g) || []).length).toBe(6);
  });
});
