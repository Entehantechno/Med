import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchAnswer from './SearchAnswer.jsx';

vi.mock('../context.jsx', () => ({
  useApp: () => ({ t: (key) => ({ submit: 'ثبت', searchAnswerPh: 'جستجوی پاسخ', noMatch: 'موردی پیدا نشد' }[key] || key) }),
}));
afterEach(() => cleanup());
const options = [{ fa:'آپاندیسیت', en:'Appendicitis' }, { fa:'پنومونی', en:'Pneumonia' }, { fa:'آسم', en:'Asthma' }];

describe('SearchAnswer', () => {
  it('reports the pick without committing anything else (host confirms)', async () => {
    const user = userEvent.setup(); const onPick = vi.fn();
    render(<SearchAnswer options={options} lang="en" onPick={onPick} clearOnPick />);
    await user.type(screen.getByPlaceholderText('جستجوی پاسخ'), 'App');
    await user.click(screen.getByText('آپاندیسیت').closest('button'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(0);
    expect(screen.queryByRole('button', { name: 'ثبت' })).toBeNull();
  });
  it('does not throw when options is missing', () => {
    expect(() => render(<SearchAnswer options={undefined} lang="fa" onPick={() => {}} />)).not.toThrow();
  });
  it('keeps the chosen label in the input when clearOnPick is off', async () => {
    const user = userEvent.setup(); const onPick = vi.fn();
    render(<SearchAnswer options={options} lang="en" onPick={onPick} />);
    await user.type(screen.getByPlaceholderText('جستجوی پاسخ'), 'Pneu');
    const list = screen.getByText('پنومونی').closest('.search-list');
    await user.click(within(list).getByText('پنومونی').closest('button'));
    expect(onPick).toHaveBeenCalledWith(1);
    expect(screen.getByPlaceholderText('جستجوی پاسخ').value).toBe('Pneumonia');
  });
});
