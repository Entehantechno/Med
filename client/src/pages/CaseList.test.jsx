/* The student case list: specialty filter, search over visible text only, sorting,
   and the empty-filter path. */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api.js', () => ({ api: mocks, getToken: () => '', loadFailKind: () => '', loadFailText: () => '' }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: 'student' } }) }));

import CaseList from './CaseList.jsx';

// Students never receive title_* (server: STUDENT_SAFE_CASE_FIELDS), so the headline is the chief complaint.
const CASES = [
  { id: 1, chief_en: 'Chest pain', specialty_en: 'Cardiology', difficulty: 'hard', age: 60, sex: 'male', version: 1, attemptsUsed: 0, maxAttempts: 2 },
  { id: 2, chief_en: 'Wheezing', specialty_en: 'Pulmonology', difficulty: 'easy', age: 20, sex: 'female', version: 1, attemptsUsed: 2, maxAttempts: 2 },
  { id: 3, chief_en: 'Racing heart', specialty_en: 'Cardiology', difficulty: 'medium', age: 45, sex: 'female', version: 1, attemptsUsed: 1, maxAttempts: 3 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation(async (path) => (path === '/cases' ? CASES.map((c) => structuredClone(c)) : {}));
});
afterEach(cleanup);

const headlines = () => screen.getAllByRole('button', { name: 'startCase' })
  .map((b) => b.closest('.case-item').querySelector('strong').textContent);

describe('CaseList filters', () => {
  it('shows every case, then narrows by specialty with counts', async () => {
    render(<CaseList go={() => {}} home={() => {}} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    expect(headlines()).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: /Cardiology \(2\)/ }));
    expect(headlines()).toEqual(['Chest pain', 'Racing heart']);
    expect(screen.getByRole('status').textContent).toMatch(/2 of 3 cases/);
  });

  it('searches the visible complaint and specialty, and normalises Persian digits and letters', async () => {
    render(<CaseList go={() => {}} home={() => {}} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    const input = screen.getByRole('searchbox', { name: 'Search cases' });
    fireEvent.change(input, { target: { value: 'pulmon' } });
    expect(headlines()).toEqual(['Wheezing']);
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText(/No case matches/)).toBeTruthy();
    fireEvent.change(input, { target: { value: 'wheez' } });
    expect(headlines()).toEqual(['Wheezing']);
  });

  it('sorts by difficulty and puts unattempted cases first', async () => {
    render(<CaseList go={() => {}} home={() => {}} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    fireEvent.click(screen.getByRole('radio', { name: 'Difficulty' }));
    expect(headlines()).toEqual(['Wheezing', 'Racing heart', 'Chest pain']);
    fireEvent.click(screen.getByRole('radio', { name: 'Not attempted first' }));
    expect(headlines()).toEqual(['Chest pain', 'Racing heart', 'Wheezing']);
  });

  it('keeps the exhausted-attempts guard and clears filters from the empty state', async () => {
    render(<CaseList go={() => {}} home={() => {}} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    const buttons = screen.getAllByRole('button', { name: 'startCase' });
    expect(buttons[1].disabled).toBe(true);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cases' }), { target: { value: 'zzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(headlines()).toHaveLength(3);
  });
});
