import { describe, it, expect } from 'vitest';
import { normalizeSearch, facetCounts, sortBy, difficultyRank } from './catalog-filter.js';

describe('normalizeSearch', () => {
  it('makes Persian and Arabic spellings comparable', () => {
    expect(normalizeSearch('كليه')).toBe(normalizeSearch('کلیه'));
    expect(normalizeSearch('یک')).toBe(normalizeSearch('يك'));
  });
  it('maps Persian and Arabic digits to ASCII and drops ZWNJ and diacritics', () => {
    expect(normalizeSearch('۱۲۳')).toBe('123');
    expect(normalizeSearch('٤٥')).toBe('45');
    expect(normalizeSearch('می\u200cخواهم')).toBe('می خواهم');
    expect(normalizeSearch('سَلام')).toBe('سلام');
  });
  it('handles empty and nullish input', () => {
    expect(normalizeSearch(undefined)).toBe('');
    expect(normalizeSearch('   ')).toBe('');
  });
});

describe('facetCounts', () => {
  it('counts distinct non-empty values and sorts them by name', () => {
    const items = [{ s: 'قلب' }, { s: 'ریه' }, { s: 'قلب' }, { s: '' }, { s: '  ' }, {}];
    // Persian alphabetical order: ر comes before ق.
    expect(facetCounts(items, (i) => i.s)).toEqual([
      { value: 'ریه', count: 1 },
      { value: 'قلب', count: 2 },
    ]);
  });
});

describe('sortBy', () => {
  const cases = [
    { t: 'B', d: 'hard', seen: 0 },
    { t: 'A', d: 'easy', seen: 2 },
    { t: 'C', d: 'medium', seen: 0 },
  ];
  const keys = {
    title: (c) => c.t,
    difficulty: (c) => c.d,
    unattempted: (c) => c.seen === 0,
    count: (c) => c.seen,
  };
  const names = (list) => list.map((c) => c.t);

  it('sorts by difficulty from easy to hard, with unknown levels last', () => {
    expect(names(sortBy(cases, 'difficulty', keys))).toEqual(['A', 'C', 'B']);
    expect(difficultyRank('weird')).toBe(3);
  });
  it('puts unattempted items first, then by name', () => {
    expect(names(sortBy(cases, 'unattempted', keys))).toEqual(['B', 'C', 'A']);
  });
  it('sorts by name and by count', () => {
    expect(names(sortBy(cases, 'title', keys))).toEqual(['A', 'B', 'C']);
    expect(names(sortBy(cases, 'count', keys))).toEqual(['A', 'B', 'C']);
  });
  it('keeps input order for the default mode and never mutates the input', () => {
    const copy = [...cases];
    expect(names(sortBy(cases, 'default', keys))).toEqual(['B', 'A', 'C']);
    expect(cases).toEqual(copy);
  });
});
