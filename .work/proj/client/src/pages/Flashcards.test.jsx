/* R60 — the flashcard runner must never grade on selection, must grade only on
   the confirm button, and must not offer "next" before a confirmed answer. */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('../api.js', () => ({ api: mocks, getToken: () => '' }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: 'student' } }) }));

import Flashcards from './Flashcards.jsx';

const CARDS = [
  { id: 1, type: 'mcq', title_en: 'Card one', questionText_en: 'Pick the beta letter',
    options: [{ fa: 'الف', en: 'Alpha', correct: false }, { fa: 'ب', en: 'Beta', correct: true }] },
  { id: 2, type: 'mcq', title_en: 'Card two', questionText_en: 'Pick the alpha letter',
    options: [{ fa: 'الف', en: 'Alpha', correct: true }, { fa: 'ب', en: 'Beta', correct: false }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation(async (path) => (path.startsWith('/flashcards')
    ? CARDS.map((c) => structuredClone(c)) : {}));
  mocks.post.mockResolvedValue({ ok: true, reveal: { index: 1 } });
});
afterEach(cleanup);

const mount = (extra = {}) => render(
  <Flashcards examId="7" flashcardIds={[1, 2]} home={() => {}} {...extra} />,
);

describe('Flashcards confirm gate (R60)', () => {
  it('selecting an option does not grade it; only the confirm button does', async () => {
    mount();
    await screen.findByText('Pick the beta letter');
    fireEvent.click(screen.getByText('Beta').closest('button'));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /nextCard/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'confirmAnswer' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.post.mock.calls[0][0]).toBe('/flashcards/check');
    expect(mocks.post.mock.calls[0][1]).toMatchObject({ cardId: 1, optionIndex: 1, type: 'mcq' });
  });

  it('does not show a next button until the answer is confirmed', async () => {
    mount();
    await screen.findByText('Pick the beta letter');
    fireEvent.click(screen.getByText('Beta').closest('button'));
    expect(screen.queryByText(/nextCard/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'confirmAnswer' }));
    await screen.findByText(/nextCard/);
  });

  it('offers no back or change controls when the teacher disabled them', async () => {
    mount({ allowBack: false, allowChange: false });
    await screen.findByText('Pick the beta letter');
    fireEvent.click(screen.getByText('Beta').closest('button'));
    fireEvent.click(screen.getByRole('button', { name: 'confirmAnswer' }));
    await screen.findByText(/nextCard/);
    expect(screen.queryByText(/prevCard/)).toBeNull();
    expect(screen.queryByText('changeAnswer')).toBeNull();
  });

  it('shows back and change controls when the teacher enabled them', async () => {
    mount({ allowBack: true, allowChange: true });
    await screen.findByText('Pick the beta letter');
    fireEvent.click(screen.getByText('Beta').closest('button'));
    fireEvent.click(screen.getByRole('button', { name: 'confirmAnswer' }));
    await screen.findByText(/nextCard/);
    expect(screen.getByText('changeAnswer')).toBeTruthy();
  });

  it('going back shows a locked, already-confirmed card when changes are disabled', async () => {
    mount({ allowBack: true, allowChange: false });
    await screen.findByText('Pick the beta letter');
    fireEvent.click(screen.getByText('Beta').closest('button'));
    fireEvent.click(screen.getByRole('button', { name: 'confirmAnswer' }));
    fireEvent.click(await screen.findByText(/nextCard/));
    await screen.findByText('Pick the alpha letter');
    fireEvent.click(screen.getByText(/prevCard/));
    await screen.findByText(/lockedAnswer/);
    expect(screen.queryByText('changeAnswer')).toBeNull();
  });
});
