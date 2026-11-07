/* Learner virtual-patient list (R88): the topic filter, the "today's patient" card from
   /learn/vpatient, and the shortcut from a case to the flashcards of its subject. */
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api.js', () => ({ api: mocks, getToken: () => '', loadFailKind: () => '', loadFailText: () => '' }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: 'learner' } }) }));

import CaseList from './CaseList.jsx';

const PLAYABLE = [
  { id: 7, difficulty: 'hard', title: '', specialty: 'Cardiology', topic: 'cardio', topic_label: 'Cardiology', chief: 'Chest pain', age: 60, sex: 'male', best: null },
  { id: 8, difficulty: 'easy', title: '', specialty: 'Gastroenterology', topic: 'gi', topic_label: 'Gastroenterology', chief: 'Vomiting blood', age: 52, sex: 'male', best: null },
  { id: 9, difficulty: 'easy', title: '', specialty: 'Cardiology', topic: 'cardio', topic_label: 'Cardiology', chief: 'Palpitations', age: 30, sex: 'female', best: null },
];
const heads = () => screen.queryAllByRole('button', { name: 'startCase' }).map((b) => b.closest('.case-item').querySelector('strong').textContent);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('learner VP list: topic filter, daily case, related cards', () => {
  it('filters the cases by topic and clears the filter', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: PLAYABLE, daily_case_id: null });
    render(<CaseList go={() => {}} home={() => {}} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    expect(heads()).toEqual(['Chest pain', 'Vomiting blood', 'Palpitations']);
    fireEvent.click(screen.getByRole('radio', { name: 'Gastroenterology (1)' }));
    expect(heads()).toEqual(['Vomiting blood']);
    fireEvent.click(screen.getByRole('radio', { name: 'All (3)' }));
    expect(heads()).toHaveLength(3);
  });

  it('starts from a topic handed in by a flashcard deck', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: PLAYABLE, daily_case_id: null });
    render(<CaseList go={() => {}} home={() => {}} initialTopic={{ key: 'cardio', label: 'Cardiology' }} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    expect(heads()).toEqual(['Chest pain', 'Palpitations']);
  });

  it('shows the case of the day first, when it is playable for this learner', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: PLAYABLE, daily_case_id: 8 });
    const go = vi.fn();
    render(<CaseList go={go} home={() => {}} />);
    await screen.findByText("Today's patient");
    const region = screen.getByText("Today's patient").closest('section');
    expect(region.textContent).toContain('Vomiting blood');
    fireEvent.click(region.querySelector('button'));
    expect(go).toHaveBeenCalledWith('exam', { caseId: 8 });
  });

  it('does not show a daily card for a case the learner cannot play', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: PLAYABLE, daily_case_id: 99 });
    render(<CaseList go={() => {}} home={() => {}} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    expect(screen.queryByText("Today's patient")).toBeNull();
  });

  it('offers the subject\'s flashcards from a case', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: PLAYABLE, daily_case_id: null });
    const onOpenCards = vi.fn();
    render(<CaseList go={() => {}} home={() => {}} onOpenCards={onOpenCards} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    const related = screen.getAllByRole('button', { name: 'Related flashcards' });
    expect(related).toHaveLength(3);
    fireEvent.click(related[1]);
    expect(onOpenCards).toHaveBeenCalledWith({ key: 'gi', label: 'Gastroenterology' });
  });

  it('keeps the related-cards action out of the way when no handler is given', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: PLAYABLE, daily_case_id: null });
    render(<CaseList go={() => {}} home={() => {}} />);
    await waitFor(() => expect(heads()).toHaveLength(3));
    expect(screen.queryByRole('button', { name: 'Related flashcards' })).toBeNull();
  });
});

describe('learner VP list: filter visibility', () => {
  it('still shows the active topic when only one subject exists, so it can be cleared', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: [PLAYABLE[0]], daily_case_id: null });
    render(<CaseList go={() => {}} home={() => {}} initialTopic={{ key: 'cardio', label: 'Cardiology' }} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    expect(screen.getByRole('radio', { name: 'Cardiology (1)' }).getAttribute('aria-checked')).toBe('true');
  });

  it('hides the duplicate specialty row for learners whose cases carry topics', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: PLAYABLE, daily_case_id: null });
    render(<CaseList go={() => {}} home={() => {}} />);
    await screen.findAllByRole('button', { name: 'startCase' });
    expect(screen.queryByRole('radiogroup', { name: 'Specialty filter' })).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Topic filter' })).toBeTruthy();
  });
});
