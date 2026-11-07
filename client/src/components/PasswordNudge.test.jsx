/* The first-sign-in password suggestion: shown only while the password is still
   staff-set; "Later" hides it for the session; the button opens the profile. */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const ctx = vi.hoisted(() => ({ user: null }));
vi.mock('../context.jsx', () => ({ useApp: () => ({ t: (k) => k, user: ctx.user }) }));

import PasswordNudge from './PasswordNudge.jsx';

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { cleanup(); ctx.user = null; });

describe('PasswordNudge', () => {
  it('stays hidden once the user has chosen their own password', () => {
    ctx.user = { id: 1, initial_password: false };
    const { container } = render(<PasswordNudge />);
    expect(container.innerHTML).toBe('');
  });

  it('suggests a change while the password is still the initial one', () => {
    ctx.user = { id: 2, initial_password: true };
    render(<PasswordNudge />);
    expect(screen.getByRole('region', { name: 'pwNudgeTitle' })).toBeTruthy();
  });

  it('"Later" hides it for this session only', () => {
    ctx.user = { id: 7, initial_password: true };
    render(<PasswordNudge />);
    fireEvent.click(screen.getByRole('button', { name: 'pwNudgeLater' }));
    expect(screen.queryByRole('region')).toBeNull();
    expect(sessionStorage.getItem('pwNudge:7')).toBe('1');
  });

  it('stays hidden for the rest of the session, even after a reload', () => {
    ctx.user = { id: 9, initial_password: true };
    sessionStorage.setItem('pwNudge:9', '1');
    const { container } = render(<PasswordNudge />);
    expect(container.innerHTML).toBe('');
  });

  it('"Change password" asks the app to open the profile', () => {
    ctx.user = { id: 8, initial_password: true };
    render(<PasswordNudge />);
    const seen = [];
    const onNav = (e) => seen.push(e.detail);
    window.addEventListener('medlab-nav', onNav);
    fireEvent.click(screen.getByRole('button', { name: 'pwNudgeChange' }));
    window.removeEventListener('medlab-nav', onNav);
    expect(seen).toEqual(['profile']);
  });
});
