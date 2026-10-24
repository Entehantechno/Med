import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api.js', () => ({ api: { get: mocks.get } }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k }) }));
vi.mock('./Confetti.jsx', () => ({ default: () => null }));
import Leaderboard from './Leaderboard.jsx';

const board = (score) => ({
  exam: { id: 7, title_en: 'Live exam', title_fa: 'آزمون' },
  ranked: [{ user_id: 1, rank: 1, name_en: 'Ali', name_fa: 'علی', student_no: '1', score, vp: null, flash: score, attempts: 1, fastest: 5 }],
});

describe('Leaderboard live refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(() => cb(Date.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
    mocks.get.mockReset();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('re-fetches on an interval and shows the newer ranking', async () => {
    mocks.get.mockResolvedValueOnce(board(40)).mockResolvedValue(board(85));
    render(<Leaderboard examId={7} meUserId={1} />);
    await act(async () => { await Promise.resolve(); });
    // the podium counts up to the score; let the animation finish
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('40')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(5000); await Promise.resolve(); });
    expect(mocks.get.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mocks.get.mock.calls[1][1]).toMatchObject({ revalidate: true });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('85')).toBeTruthy();
  });

  it('keeps the last good ranking when a poll fails', async () => {
    mocks.get.mockResolvedValueOnce(board(60)).mockRejectedValue(new Error('network'));
    render(<Leaderboard examId={7} meUserId={1} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(5000); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/last ranking/);
  });

  it('stops polling after unmount', async () => {
    mocks.get.mockResolvedValue(board(10));
    const { unmount } = render(<Leaderboard examId={7} meUserId={1} />);
    await act(async () => { await Promise.resolve(); });
    unmount();
    const before = mocks.get.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(mocks.get.mock.calls.length).toBe(before);
  });
});
