/* The learner's virtual-patient tab (R88). Before this tab existed no learner screen
   mounted CaseList or Exam, so competitive learners could not reach a case at all.
   These tests check the list -> exam -> list round trip inside the hub. */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../api.js', () => ({ api: mocks, getToken: () => '', loadFailKind: () => '', loadFailText: () => '' }));
vi.mock('../../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: 'learner' } }) }));
vi.mock('../Exam.jsx', () => ({
  default: ({ caseId, go, home }) => (
    <div>
      <div>EXAM {caseId}</div>
      <button type="button" onClick={() => go('caseList')}>leave exam</button>
      <button type="button" onClick={home}>exam home</button>
    </div>
  ),
}));

import VpatientHub from './VpatientHub.jsx';

const PLAYABLE = [
  { id: 7, difficulty: 'hard', title: '', specialty: 'Cardiology', topic: 'cardio', topic_label: 'Cardiology', chief: 'Chest pain', age: 60, sex: 'male', best: null },
  { id: 8, difficulty: 'easy', title: '', specialty: 'Gastroenterology', topic: 'gi', topic_label: 'Gastroenterology', chief: 'Vomiting blood', age: 52, sex: 'male', best: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: PLAYABLE, daily_case_id: null });
});
afterEach(cleanup);

describe('VpatientHub', () => {
  it('opens the case list first, then the exam for the chosen case', async () => {
    render(<VpatientHub home={() => {}} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'startCase' }))[0]);
    expect(screen.getByText('EXAM 7')).toBeTruthy();
  });

  it('returns to the list when the exam hands back to it', async () => {
    render(<VpatientHub home={() => {}} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'startCase' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'leave exam' }));
    expect((await screen.findAllByRole('button', { name: 'startCase' })).length).toBeGreaterThan(0);
    expect(screen.queryByText('EXAM 7')).toBeNull();
  });

  it('the exam home button also returns to the list, not to the learner home', async () => {
    const home = vi.fn();
    render(<VpatientHub home={home} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'startCase' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'exam home' }));
    expect((await screen.findAllByRole('button', { name: 'startCase' })).length).toBeGreaterThan(0);
    expect(home).not.toHaveBeenCalled();
  });

  it('passes a cross-link topic from a flashcard deck into the list', async () => {
    render(<VpatientHub home={() => {}} topic={{ key: 'cardio', label: 'Cardiology' }} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    expect(screen.getAllByRole('button', { name: 'startCase' })).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Cardiology (1)' }).getAttribute('aria-checked')).toBe('true');
  });
});
