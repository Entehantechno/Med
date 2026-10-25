import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataTable from './DataTable.jsx';

vi.mock('../context.jsx', () => ({
  useApp: () => ({ t: (key) => ({ searchPlaceholder: 'Search...', noData: 'No data' }[key] || key), lang: 'en' }),
}));
afterEach(() => cleanup());

const mkRows = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, q: `Card ${i + 1}` }));
const columns = [{ key: 'q', label: 'Question', render: (c) => c.q }];

describe('DataTable pagination', () => {
  it('shows only the first page and navigates pages', async () => {
    const user = userEvent.setup();
    render(<DataTable rows={mkRows(60)} columns={columns} rowKey={(c) => c.id} />);
    // 25 rows mounted, not all 60
    expect(screen.getByText('Card 1')).toBeTruthy();
    expect(screen.getByText('Card 25')).toBeTruthy();
    expect(screen.queryByText('Card 26')).toBeNull();
    expect(screen.queryByText('Card 60')).toBeNull();
    expect(screen.getByText(/Showing 1–25 of 60/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Card 26')).toBeTruthy();
    expect(screen.getByText('Card 50')).toBeTruthy();
    expect(screen.queryByText('Card 1')).toBeNull();
    expect(screen.getByText(/Showing 26–50 of 60/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Card 1')).toBeTruthy();
  });

  it('hides the pager when everything fits on one page', () => {
    render(<DataTable rows={mkRows(12)} columns={columns} rowKey={(c) => c.id} />);
    expect(screen.getByText('Card 12')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('renders every row when pagination is disabled with pageSize=0', () => {
    render(<DataTable rows={mkRows(120)} columns={columns} rowKey={(c) => c.id} pageSize={0} />);
    expect(screen.getByText('Card 1')).toBeTruthy();
    expect(screen.getByText('Card 120')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('filters with search and paginates the matches', async () => {
    const user = userEvent.setup();
    const rows = [
      ...mkRows(40),
      ...Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, q: `Special ${i + 1}` })),
    ];
    render(<DataTable rows={rows} columns={columns} rowKey={(c) => c.id} searchKeys={[(c) => c.q]} />);
    await user.type(screen.getByPlaceholderText('Search...'), 'Special');
    // 30 matches → 25 on page 1, pager present, generic cards filtered out.
    // The search box debounces (250 ms) and matched text is wrapped in <mark>,
    // so wait and match on the cell's full text content.
    const cellText = (txt) => (_, el) => el.tagName === 'TD' && el.textContent === txt;
    expect(await screen.findByText(cellText('Special 1'), {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByText(cellText('Card 1'))).toBeNull();
    expect(screen.getByText(/Showing 1–25 of 30/)).toBeTruthy();
  });
});
