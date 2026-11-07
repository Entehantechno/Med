/* R97 — landmark and heading guards (axe-core audit of the live screens, 2026-11-07).
   The signed-in learner and student homes had no <main> landmark (axe: landmark-one-main,
   region). The premium banner title jumped from h2 to h4 (heading-order). The /vp sign-in
   block was a labelled region twice with the same name (landmark-unique). These guards read
   the source, so they run without a browser. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const read = (rel) => readFileSync(join(SRC, rel), 'utf8');

describe('landmarks (R97)', () => {
  it('the learner home content is the page main landmark', () => {
    const src = read('pages/learn/LearnApp.jsx');
    expect(src).toMatch(/<div id="learn-main"[^>]*role="main"/);
  });

  it('the learner top bar row sits inside a labelled region (axe: region)', () => {
    const src = read('pages/learn/LearnApp.jsx');
    expect(src).toMatch(/<section className=\{`learn-topline[^`]*`\} aria-label=/);
    expect(src).toMatch(/<\/section>\s*\n\s*<div className="learn-layout">/);
  });

  it('the student home content is the page main landmark', () => {
    const src = read('pages/StudentHome.jsx');
    expect(src).toMatch(/<div className="container" role="main"/);
  });

  it('the /vp sign-in wrapper is not a second labelled region with the same name', () => {
    const src = read('pages/VirtualPatientPage.jsx');
    // LoginCard already renders <section id="vp-login"> with its own heading.
    expect(src).not.toMatch(/<section aria-label=\{tx\(cfg\.login\.title, lang\)\}/);
  });
});

describe('heading order (R97)', () => {
  it('the premium banner title is an h3 (directly under the page h2)', () => {
    const src = read('pages/learn/PremiumBanner.jsx');
    expect(src).toMatch(/<h3 className="premium-banner__title"/);
    expect(src).not.toMatch(/<h4 className="premium-banner__title"/);
  });
});
