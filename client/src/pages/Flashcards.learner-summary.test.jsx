/* R97 — a learner's deck picker boots on the light summary (GET /flashcards?summary=1), and the
   full bodies are fetched by id only when a deck starts. Other roles keep the full list. */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
const who = vi.hoisted(() => ({ role: 'learner' }));
vi.mock('../api.js', () => ({ api: mocks, getToken: () => '' }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: who.role } }) }));

import Flashcards from './Flashcards.jsx';

const SUMMARY = [
  { id: 1, topic: 'cardio' },
  { id: 2, topic: 'cardio' },
];
const FULL = [
  { id: 1, type: 'mcq', topic: 'cardio', title_en: 'Card one', questionText_en: 'Pick the beta letter',
    options: [{ fa: 'الف', en: 'Alpha', correct: false }, { fa: 'ب', en: 'Beta', correct: true }] },
  { id: 2, type: 'mcq', topic: 'cardio', title_en: 'Card two', questionText_en: 'Pick the alpha letter',
    options: [{ fa: 'الف', en: 'Alpha', correct: true }, { fa: 'ب', en: 'Beta', correct: false }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation(async (path) => {
    if (path === '/flashcards?summary=1') return structuredClone(SUMMARY);
    if (path.startsWith('/flashcards?ids=')) {
      const ids = path.slice('/flashcards?ids='.length).split(',').map(Number);
      return structuredClone(FULL.filter((c) => ids.includes(c.id)));
    }
    if (path === '/flashcards') return structuredClone(FULL);
    return {};
  });
});
afterEach(cleanup);

const mount = () => render(<Flashcards home={() => {}} />);

describe('learner deck summary (R97)', () => {
  it('a learner boots on the summary, not the full bank', async () => {
    who.role = 'learner';
    mount();
    await screen.findByRole('button', { name: /practiceAll/ });
    const paths = mocks.get.mock.calls.map(([p]) => p);
    expect(paths).toContain('/flashcards?summary=1');
    expect(paths).not.toContain('/flashcards');
  });

  it('starting a deck fetches the full bodies by id before the first card is shown', async () => {
    who.role = 'learner';
    mount();
    const btn = await screen.findByRole('button', { name: /practiceAll/ });
    fireEvent.click(btn);
    await screen.findByText('Pick the beta letter');
    const paths = mocks.get.mock.calls.map(([p]) => p);
    expect(paths).toContain('/flashcards?ids=1,2');
  });

  it('a student still boots on the full list and does not fetch by id to start a deck', async () => {
    who.role = 'student';
    mount();
    const btn = await screen.findByRole('button', { name: /practiceAll/ });
    await waitFor(() => expect(mocks.get.mock.calls.map(([p]) => p)).toContain('/flashcards'));
    const before = mocks.get.mock.calls.length;
    fireEvent.click(btn);
    await screen.findByText('Pick the beta letter');
    const after = mocks.get.mock.calls.slice(before).map(([p]) => p);
    expect(after.some((p) => p.startsWith('/flashcards?ids='))).toBe(false);
  });
});

describe('learner session cap (R97)', () => {
  const BIG = Array.from({ length: 250 }, (_, i) => ({ id: 1000 + i, topic: 'cardio' }));
  const body = (id) => ({ id, type: 'mcq', topic: 'cardio', title_en: `Card ${id}`, questionText_en: `Question ${id}`,
    options: [{ fa: 'الف', en: 'Alpha', correct: true }, { fa: 'ب', en: 'Beta', correct: false }] });

  beforeEach(() => {
    who.role = 'learner';
    mocks.get.mockImplementation(async (path) => {
      if (path === '/flashcards?summary=1') return structuredClone(BIG);
      if (path.startsWith('/flashcards?ids=')) {
        return path.slice('/flashcards?ids='.length).split(',').map((n) => body(Number(n)));
      }
      return {};
    });
  });

  it('a learner session is capped at 200 cards: the label says so and only 200 bodies are fetched', async () => {
    mount();
    const btn = await screen.findByRole('button', { name: /practiceAll \(200\)/ });
    fireEvent.click(btn);
    await screen.findByText(/^Question 1\d{3}$/);
    const requested = mocks.get.mock.calls
      .map(([p]) => p)
      .filter((p) => p.startsWith('/flashcards?ids='))
      .flatMap((p) => p.slice('/flashcards?ids='.length).split(',').map(Number));
    expect(requested).toHaveLength(200);
    expect(new Set(requested).size).toBe(200);
    for (const id of requested) expect(id).toBeGreaterThanOrEqual(1000);
  });
});
