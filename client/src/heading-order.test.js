/* R95 heading order. The admin and teacher home screens put an h4 directly under an h2
   (no h3 in between), which Lighthouse flags as heading-order. The dashboard titles are
   now h3 and keep their look through `.card > h3.card-title` (mirrors `.card h4`).
   This reads the source, so it runs without a browser; the browser check is in the R95 report. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const admin = readFileSync(join(SRC, 'pages/Admin.jsx'), 'utf8');
const styles = readFileSync(join(SRC, 'styles.css'), 'utf8');

describe('R95 heading order on the admin and teacher home screens', () => {
  it('the system overview section title is an h3, not an h4 under the page h2', () => {
    expect(admin).toMatch(/<div className="section-title"><h3 className="overview-title"><Icon name="dashboard" size=\{18\} \/> \{t\("overview"\)\}<\/h3><\/div>/);
  });
  it('the dashboard chart and list card titles are h3.card-title', () => {
    const n = (admin.match(/<h3 className="card-title/g) || []).length;
    expect(n).toBeGreaterThanOrEqual(4);
  });
  it('the dashboard card titles no longer use a bare h4 for those four cards', () => {
    for (const key of ['scoreTrend', 'activityByType', 'scoreDistribution', 'recentActivity']) {
      expect(admin).not.toMatch(new RegExp(`<h4[^>]*>[^<]*<Icon[^>]*/> \\{t\\("${key}"\\)\\}`));
    }
  });
  it('the card-title rule mirrors the .card h4 look (same colour, rule, spacing)', () => {
    expect(styles).toMatch(/\.card > h3\.card-title\s*\{[^}]*color:\s*var\(--primary\)/);
    expect(styles).toMatch(/\.card > h3\.card-title\s*\{[^}]*border-bottom:\s*2px solid var\(--panel3\)/);
  });
});
