/* Learner path of the virtual-patient list: data comes from /learn/vpatient, and an
   off/premium gate replaces the list instead of looking like an empty filter. */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api.js', () => ({ api: mocks, getToken: () => '', loadFailKind: () => '', loadFailText: () => '' }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: 'learner' } }) }));

import CaseList from './CaseList.jsx';

const PLAYABLE = [
  { id: 7, difficulty: 'hard', title: '', specialty: 'Cardiology', chief: 'Chest pain', age: 60, sex: 'male', best: null },
];

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('learner VP case list', () => {
  it('loads the playable cases from /learn/vpatient and shows the chief complaint', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: true, reason: null, cases: PLAYABLE });
    render(<CaseList go={() => {}} home={() => {}} />);
    expect(await screen.findByText('Chest pain')).toBeTruthy();
    expect(mocks.get).toHaveBeenCalledWith('/learn/vpatient?lang=en', expect.anything());
    expect(mocks.get).not.toHaveBeenCalledWith('/cases', expect.anything());
  });

  it('shows the off state (not an empty filter) when the admin switch is off', async () => {
    mocks.get.mockResolvedValue({ enabled: false, access: false, reason: 'off', cases: undefined });
    render(<CaseList go={() => {}} home={() => {}} />);
    expect(await screen.findByText('The virtual patient is not available right now')).toBeTruthy();
    expect(screen.queryByText('No case matches these filters.')).toBeNull();
  });

  it('shows the premium gate for a non-premium learner', async () => {
    mocks.get.mockResolvedValue({ enabled: true, access: false, reason: 'premium', cases: undefined });
    render(<CaseList go={() => {}} home={() => {}} />);
    expect(await screen.findByText('This section is for premium learners')).toBeTruthy();
  });
});
