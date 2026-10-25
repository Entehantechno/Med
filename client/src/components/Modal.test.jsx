import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './UI.jsx';

vi.mock('../context.jsx', () => ({
  useApp: () => ({ t: (key) => ({ cancel: 'Cancel', save: 'Save' }[key] || key) }),
}));
afterEach(() => { cleanup(); document.documentElement.classList.remove('overlay-open'); });

describe('Modal', () => {
  it('portals to document.body so no transformed ancestor can trap position:fixed', () => {
    const { unmount } = render(
      <div className="card" style={{ transform: 'translateY(8px)' }}>
        <Modal title="New card" onClose={() => {}}><p>form body</p></Modal>
      </div>
    );
    const dialog = screen.getByRole('dialog');
    // Direct child relationship to body = portal works regardless of ancestors
    expect(document.body.contains(dialog)).toBe(true);
    expect(dialog.closest('.card')).toBeNull();
    expect(screen.getByText('form body')).toBeTruthy();
    expect(document.documentElement.classList.contains('overlay-open')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('overlay-open')).toBe(false);
  });

  it('closes on Escape and on backdrop click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal title="New card" onClose={onClose} />);
    await user.keyboard('[Escape]');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(document.querySelector('.modal-back'));
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
