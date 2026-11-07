/* Flashcards <-> virtual patient (R88): a deck can be narrowed to one subject
   (the topic key the case carries), and the learner can jump from there to the
   cases of that subject or clear the filter. */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('../api.js', () => ({ api: {}, getToken: () => '', loadFailKind: () => '', loadFailText: () => '' }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: 'learner' } }) }));

import { DeckPicker } from './Flashcards.jsx';

const CARDS = [
  { id: 1, topic: 'cardio', course_en: 'Internal Medicine', category_en: 'Cardiology' },
  { id: 2, topic: 'cardio', course_en: 'Internal Medicine', category_en: 'Cardiology' },
  { id: 3, topic: 'gi', course_en: 'Internal Medicine', category_en: 'Gastroenterology' },
  { id: 4, course_en: 'Anatomy', category_en: 'Upper limb' },
];
const CARDIO = { key: 'cardio', label: 'Cardiology' };

afterEach(cleanup);

describe('DeckPicker with a topic', () => {
  it('shows only the cards of the chosen subject and says which subject it is', () => {
    render(<DeckPicker allCards={CARDS} onStart={() => {}} home={() => {}} embedded topic={CARDIO} />);
    expect(screen.getByText('Cardiology', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /practiceAll \(2\)/ })).toBeTruthy();
  });

  it('jumps to the virtual-patient cases of the same subject', () => {
    const onOpenCases = vi.fn();
    render(<DeckPicker allCards={CARDS} onStart={() => {}} home={() => {}} embedded topic={CARDIO} onOpenCases={onOpenCases} />);
    fireEvent.click(screen.getByRole('button', { name: 'Virtual patients for this topic' }));
    expect(onOpenCases).toHaveBeenCalledWith(CARDIO);
  });

  it('clears the subject filter from the banner', () => {
    const onClearTopic = vi.fn();
    render(<DeckPicker allCards={CARDS} onStart={() => {}} home={() => {}} embedded topic={CARDIO} onClearTopic={onClearTopic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show all cards' }));
    expect(onClearTopic).toHaveBeenCalledTimes(1);
  });

  it('says so, instead of an empty grid, when the subject has no cards yet', () => {
    render(<DeckPicker allCards={CARDS} onStart={() => {}} home={() => {}} embedded topic={{ key: 'neuro', label: 'Neurology' }} />);
    expect(screen.getByText('There are no cards for this topic yet.')).toBeTruthy();
  });

  it('without a topic it lists everything, as before', () => {
    render(<DeckPicker allCards={CARDS} onStart={() => {}} home={() => {}} embedded />);
    expect(screen.queryByRole('button', { name: 'Virtual patients for this topic' })).toBeNull();
    expect(screen.getByRole('button', { name: /practiceAll \(4\)/ })).toBeTruthy();
  });
});
