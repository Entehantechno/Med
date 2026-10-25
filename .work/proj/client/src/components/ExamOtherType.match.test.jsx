/* R60 — matching questions: students can re-pair or undo a connection, and both
   items of a pair share one colour and the same number badge. */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('../api.js', () => ({ api: { get: vi.fn(), post: vi.fn() }, getToken: () => '' }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: 'student' } }) }));

import ExamOtherType from './ExamOtherType.jsx';

const CARD = {
  id: 9, type: 'match', questionText_en: 'Match the pairs',
  pairs: [['', 'Left one', '', 'Right one'], ['', 'Left two', '', 'Right two']],
};
afterEach(cleanup);
const btn = (text) => screen.getByText(text).closest('button');

describe('matching — connect, re-pair, undo (R60)', () => {
  it('connects a left item to a right item and shows a shared colour and number', () => {
    render(<ExamOtherType card={CARD} lang="en" onGraded={vi.fn()} />);
    fireEvent.click(btn('Left one'));
    fireEvent.click(btn('Right one'));
    expect(btn('Left one').classList.contains('connected')).toBe(true);
    expect(btn('Right one').classList.contains('connected')).toBe(true);
    const leftColor = btn('Left one').style.borderColor;
    expect(leftColor).not.toBe('');
    expect(btn('Right one').style.borderColor).toBe(leftColor);
    expect(btn('Left one').querySelector('.pair-no').textContent).toBe('1');
    expect(btn('Right one').querySelector('.pair-no').textContent).toBe('1');
    expect(btn('Right two').classList.contains('connected')).toBe(false);
  });

  it('tapping a connected left item undoes its link', () => {
    render(<ExamOtherType card={CARD} lang="en" onGraded={vi.fn()} />);
    fireEvent.click(btn('Left one'));
    fireEvent.click(btn('Right one'));
    fireEvent.click(btn('Left one'));
    expect(btn('Left one').classList.contains('connected')).toBe(false);
    expect(btn('Right one').classList.contains('connected')).toBe(false);
  });

  it('re-pairs a right item to another left item, leaving no duplicate link', () => {
    render(<ExamOtherType card={CARD} lang="en" onGraded={vi.fn()} />);
    fireEvent.click(btn('Left one'));
    fireEvent.click(btn('Right one'));
    fireEvent.click(btn('Left two'));
    fireEvent.click(btn('Right one'));
    expect(btn('Left one').classList.contains('connected')).toBe(false);
    expect(btn('Left two').classList.contains('connected')).toBe(true);
    expect(btn('Right one').style.borderColor).toBe(btn('Left two').style.borderColor);
  });
});
