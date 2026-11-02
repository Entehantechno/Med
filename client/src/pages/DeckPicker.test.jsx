/* Flashcard deck chooser: category filter, search, keyboard activation and the
   practise button following the visible decks. */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('../api.js', () => ({ api: {}, getToken: () => '', loadFailKind: () => '', loadFailText: () => '' }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: 'student' } }) }));

import { DeckPicker } from './Flashcards.jsx';

const CARDS = [
  { id: 1, course_en: 'Anatomy', category_en: 'Upper limb' },
  { id: 2, course_en: 'Anatomy', category_en: 'Lower limb' },
  { id: 3, course_en: 'Physiology', category_en: 'Cardiac' },
  { id: 4, course_en: 'Pharmacology', category_en: 'Cardiac' },
];

afterEach(cleanup);

const deckNames = () => screen.getAllByRole('button').filter((b) => b.classList.contains('mod-card')).map((b) => b.querySelector('h3').textContent);

describe('DeckPicker', () => {
  it('lists one deck per course and starts a deck from the keyboard', () => {
    const onStart = vi.fn();
    render(<DeckPicker allCards={CARDS} onStart={onStart} home={() => {}} embedded />);
    expect(deckNames()).toEqual(['Anatomy', 'Pharmacology', 'Physiology']);
    const anatomy = screen.getByRole('button', { name: /Anatomy/ });
    fireEvent.keyDown(anatomy, { key: 'Enter' });
    expect(onStart).toHaveBeenLastCalledWith(CARDS.filter((c) => c.course_en === 'Anatomy'));
    fireEvent.keyDown(anatomy, { key: ' ' });
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it('narrows decks by category and practises only what is shown', () => {
    const onStart = vi.fn();
    render(<DeckPicker allCards={CARDS} onStart={onStart} home={() => {}} embedded />);
    fireEvent.click(screen.getByRole('radio', { name: /Cardiac \(2\)/ }));
    expect(deckNames()).toEqual(['Pharmacology', 'Physiology']);
    fireEvent.click(screen.getByRole('button', { name: /Practise shown \(2\)/ }));
    expect(onStart.mock.calls[0][0].map((c) => c.id).sort()).toEqual([3, 4]);
  });

  it('searches course and category names, and sorts by card count', () => {
    render(<DeckPicker allCards={CARDS} onStart={() => {}} home={() => {}} embedded />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search decks' }), { target: { value: 'upper' } });
    expect(deckNames()).toEqual(['Anatomy']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search decks' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Most cards' }));
    expect(deckNames()[0]).toBe('Anatomy');
  });

  it('shows a clear-filters path when nothing matches', () => {
    render(<DeckPicker allCards={CARDS} onStart={() => {}} home={() => {}} embedded />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search decks' }), { target: { value: 'zzz' } });
    expect(screen.getByText('No deck matches these filters.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(deckNames()).toHaveLength(3);
  });
});
