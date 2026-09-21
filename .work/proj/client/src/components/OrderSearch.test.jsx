import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('../context.jsx', () => ({ useApp: () => ({ t: (k) => k, lang: 'en' }) }));
import OrderSearch from './OrderSearch.jsx';
afterEach(cleanup);

const catalog = [
  { fa: 'شمارش کامل خون (CBC)', en: 'Complete blood count (CBC)', aliases: ['cbc'] },
  { fa: 'نوار قلب (ECG)', en: 'Electrocardiogram (ECG)', aliases: ['ecg'] },
];

describe('OrderSearch', () => {
  it('does not add the first catalog item when Add or Enter is used on an empty query', () => {
    const onAdd = vi.fn();
    render(<OrderSearch catalog={catalog} lang="en" onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('adds the highlighted match after the student types', () => {
    const onAdd = vi.fn();
    render(<OrderSearch catalog={catalog} lang="en" onAdd={onAdd} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ECG' } });
    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].en).toMatch(/ECG/i);
  });
});
