/* The admin password card: only a full admin sees the reveal; setting a password
   works for any staff member who can reset the user; the status says why a copy
   is missing. */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: vi.fn() }));
vi.mock('../api.js', () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock('./UI.jsx', () => ({ useToast: () => mocks.toast }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ t: (k) => k }) }));

import PasswordCard from './PasswordCard.jsx';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('PasswordCard', () => {
  it('hides the reveal from staff who are not full admins, but still lets them set a password', async () => {
    mocks.post.mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    render(<PasswordCard userId={5} initial={false} canReveal={false} onSaved={onSaved} />);
    expect(screen.queryByRole('button', { name: 'pwCardShow' })).toBeNull();
    fireEvent.change(screen.getByLabelText('pwCardSetLabel'), { target: { value: 'New-Pass-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'pwCardSave' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/users/5/password', { password: 'New-Pass-2026!' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('reveals the password for a full admin and reads it from the credentials endpoint', async () => {
    mocks.get.mockResolvedValue({ available: true, stale: false, initial: true, password: 'Shown-Pass-2026!' });
    render(<PasswordCard userId={9} initial canReveal />);
    fireEvent.click(screen.getByRole('button', { name: 'pwCardShow' }));
    expect(await screen.findByTestId('shown-password')).toBeTruthy();
    expect(screen.getByTestId('shown-password').textContent).toBe('Shown-Pass-2026!');
    expect(mocks.get).toHaveBeenCalledWith('/admin/users/9/credentials');
  });

  it('says why a password cannot be shown when no copy is recorded', async () => {
    mocks.get.mockResolvedValue({ available: false, stale: false, initial: false, password: null });
    render(<PasswordCard userId={3} initial={false} canReveal />);
    fireEvent.click(screen.getByRole('button', { name: 'pwCardShow' }));
    expect(await screen.findByText('pwCardUnavailable')).toBeTruthy();
    expect(screen.queryByTestId('shown-password')).toBeNull();
  });

  it('flags a copy that no longer matches the current password', async () => {
    mocks.get.mockResolvedValue({ available: false, stale: true, initial: false, password: null });
    render(<PasswordCard userId={4} initial={false} canReveal />);
    fireEvent.click(screen.getByRole('button', { name: 'pwCardShow' }));
    expect(await screen.findByText('pwCardStale')).toBeTruthy();
  });

  it('shows the initial-password status from the profile', () => {
    render(<PasswordCard userId={2} initial canReveal={false} />);
    expect(screen.getByText('pwCardInitial')).toBeTruthy();
  });
});
