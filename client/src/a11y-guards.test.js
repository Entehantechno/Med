/* Accessibility guards (R84). They read the source, so they run without a browser.
   1) A clickable <div> or <span> must have a role, unless it is a modal backdrop or a
      sheet that stops propagation (those are dismissed with Escape or a close button).
   2) `transition: all` is banned: it animates every property and costs frames.
   Real controls must be <button> elements, or carry role + keyboard handling. */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Vitest runs from client/, so the source root is client/src.
const SRC = join(process.cwd(), 'src');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx|css)$/.test(name) && !/\.test\.jsx$/.test(name)) out.push(p);
  }
  return out;
}

// Backdrops and sheets: a click on the dimmed area closes them, and a stopPropagation
// container keeps clicks inside the sheet from closing it. Keyboard users close them with
// a button or Escape. Keep this list short and explain each entry when you add one.
const BACKDROP = /modal-back|modal-overlay|lab-modal-overlay|lab-modal-shell|modal-body|modal-shell|overlay|backdrop|sheet|zoom-back|fsheet-back|pwa-ios|"modal"|pm-topic/;

function clickableWithoutRole(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const bad = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/<(div|span)\b/g)) {
      // The tag starts at this match and ends at the first `>` that is not part of `=>`.
      const chunk = [line.slice(m.index), ...lines.slice(i + 1, i + 4)].join('\n');
      const tagEnd = chunk.search(/(?<!=)>/);
      const tag = tagEnd === -1 ? chunk : chunk.slice(0, tagEnd);
      if (!/onClick=/.test(tag)) continue;
      if (/\brole=/.test(tag)) continue;
      if (/stopPropagation/.test(tag) || BACKDROP.test(tag)) continue;
      bad.push(`${relative(SRC, file)}:${i + 1}`);
    }
  });
  return bad;
}

describe('accessibility guards', () => {
  const files = walk(SRC);

  it('no clickable div or span without a role outside backdrops and sheets', () => {
    const bad = files.filter((f) => f.endsWith('.jsx')).flatMap(clickableWithoutRole);
    expect(bad).toEqual([]);
  });

  it('no transition: all anywhere in the stylesheets or inline styles', () => {
    const bad = files
      .filter((f) => /\.(css|jsx)$/.test(f))
      .filter((f) => /transition\s*:\s*all\b/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    expect(bad).toEqual([]);
  });
});
