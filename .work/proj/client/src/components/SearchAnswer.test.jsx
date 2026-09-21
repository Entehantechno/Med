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
  it('does not submit immediately in withSubmit mode', async () => {
    const user = userEvent.setup(); const onPick = vi.fn();
    render(<SearchAnswer options={options} lang="en" onPick={onPick} withSubmit />);
    await user.type(screen.getByPlaceholderText('جستجوی پاسخ'), 'App');
    await user.click(screen.getByText('آپاندیسیت').closest('button'));
    expect(onPick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ثبت' }));
    expect(onPick).toHaveBeenCalledWith(0);
  });
  it('does not throw when options is missing', () => {
    expect(() => render(<SearchAnswer options={undefined} lang="fa" onPick={() => {}} />)).not.toThrow();
  });
  it('submits immediately in normal mode', async () => {
    const user = userEvent.setup(); const onPick = vi.fn();
    render(<SearchAnswer options={options} lang="en" onPick={onPick} />);
    await user.type(screen.getByPlaceholderText('جستجوی پاسخ'), 'Pneu');
    const list = screen.getByText('پنومونی').closest('.search-list');
    await user.click(within(list).getByText('پنومونی').closest('button'));
    expect(onPick).toHaveBeenCalledWith(1);
  });
});
