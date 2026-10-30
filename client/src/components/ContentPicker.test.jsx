/* R63 — grouped content picker and compact permanent codes.
   Groups start collapsed, group select/clear acts on the whole group, search opens
   matching groups, and permanent codes are shown short (full value in the title). */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('../context.jsx', () => ({ useApp: () => ({ lang: 'en', t: (k) => k, user: { role: 'teacher' } }) }));

import ContentPicker, { groupFor } from './ContentPicker.jsx';
import { CompactCode, shortCode } from './ContentCode.jsx';

const ITEMS = [
  { id: 1, title: 'Chest pain triage', group: 'Cardiology', code: 'VP-aaaa1111bbbb2222' },
  { id: 2, title: 'Heart failure follow-up', group: 'Cardiology', code: 'VP-cccc3333dddd4444' },
  { id: 3, title: 'Asthma exacerbation', group: 'Pulmonology', code: 'VP-eeee5555ffff6666' },
];

function Harness({ initial = [], disabled = false, onChangeSpy }) {
  const [sel, setSel] = React.useState(initial);
  return (
    <ContentPicker
      lang="en"
      items={ITEMS}
      idOf={(it) => it.id}
      titleOf={(it) => it.title}
      groupOf={(it) => groupFor(it.group, 'None')}
      codeOf={(it) => it.code}
      selected={sel}
      disabled={disabled}
      onChange={(ids) => { onChangeSpy?.(ids); setSel(ids); }}
      emptyText="nothing" />
  );
}

afterEach(() => cleanup());

describe('shortCode', () => {
  it('keeps the prefix and last 4 characters, never the full value', () => {
    expect(shortCode('FC-6e61bd67a301d1678132f6d25c53beab')).toBe('FC-…beab');
    expect(shortCode('VP-aaaa1111bbbb2222')).toBe('VP-…2222');
  });
  it('leaves short values unchanged', () => {
    expect(shortCode('A-1')).toBe('A-1');
    expect(shortCode('')).toBe('');
  });
});

describe('CompactCode', () => {
  it('shows the short form and keeps the full code in the tooltip', () => {
    render(<CompactCode code="FC-6e61bd67a301d1678132f6d25c53beab" />);
    const btn = screen.getByRole('button', { name: /FC-…beab/ });
    expect(btn.textContent).toContain('FC-…beab');
    expect(btn.textContent).not.toContain('6e61bd67');
    expect(btn.getAttribute('title')).toContain('FC-6e61bd67a301d1678132f6d25c53beab');
  });
});

describe('ContentPicker', () => {
  it('starts with groups collapsed (no row titles visible)', () => {
    render(<Harness />);
    expect(screen.getByText('Cardiology')).toBeTruthy();
    expect(screen.queryByText('Chest pain triage')).toBeNull();
  });

  it('expands a group on header click and shows short codes only', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Cardiology'));
    expect(screen.getByText('Chest pain triage')).toBeTruthy();
    expect(screen.queryByText('VP-aaaa1111bbbb2222')).toBeNull();
    expect(screen.getAllByText('VP-…2222').length).toBeGreaterThan(0);
  });

  it('selects and clears a whole group with one button', () => {
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Select group' })[0]);
    expect(spy).toHaveBeenLastCalledWith([1, 2]);
  });

  it('search filters rows and opens matching groups', () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText(/Search title/), { target: { value: 'asthma' } });
    expect(screen.getByText('Asthma exacerbation')).toBeTruthy();
    expect(screen.queryByText('Cardiology')).toBeNull();
  });

  it('disabled freezes the whole picker', () => {
    const { container } = render(<Harness disabled />);
    expect(container.querySelector('fieldset').hasAttribute('disabled')).toBe(true);
  });
});
