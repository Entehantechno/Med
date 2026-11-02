/* Retention panel (R83): nothing is deleted from the screen without a confirmed
   step; enabling a category asks first (the server answers 409); a purge sends
   confirm:true only after the dialog; class and exam periods are set in bulk. */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('../../api.js', () => ({ api: { get: mocks.get, put: mocks.put, post: mocks.post } }));
vi.mock('../../context.jsx', () => ({ useApp: () => ({ lang: 'en' }) }));
vi.mock('../../components/UI.jsx', () => ({
  useToast: () => () => {},
  Spinner: () => <div>loading</div>,
  Modal: ({ title, children, onSave, saveLabel, onClose }) => (
    <div role="dialog" aria-label={title}>
      {children}
      <button type="button" onClick={onSave}>{saveLabel}</button>
      <button type="button" onClick={onClose}>cancel</button>
    </div>
  ),
}));

import RetentionPanel from './RetentionPanel.jsx';

const BASE = {
  policy: { vp_chats: 0, tutor_chats: 0, security_events: 0, rum_vitals: 45 },
  due: {
    vp_chats: { sessions: 3, events: 40 }, tutor_chats: { rows: 0 }, security_events: { rows: 0 }, rum_vitals: { rows: 2 },
  },
  categories: ['vp_chats', 'tutor_chats', 'security_events', 'rum_vitals'],
  presets: [0, 90, 180, 365, 730],
  minDays: 30,
  maxDays: 3650,
  lastRunMs: 0,
  storage: { fileBytes: 2097152, freeBytes: 524288, autoVacuum: 'none', pageSize: 4096, pageCount: 512, freePages: 128 },
};
const CLASSES = [
  { id: 7, name_en: 'Clinical A', name_fa: 'بالینی الف', code: 'CA1', retention_days: null, chats: 12 },
  { id: 8, name_en: 'Clinical B', name_fa: 'بالینی ب', code: 'CB2', retention_days: 180, chats: 4 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation((path) => {
    if (path === '/admin/retention/items?kind=class') return Promise.resolve({ kind: 'class', rows: CLASSES });
    if (path === '/admin/retention/items?kind=exam') return Promise.resolve({ kind: 'exam', rows: [] });
    return Promise.resolve(BASE);
  });
  mocks.put.mockResolvedValue({ policy: BASE.policy });
  mocks.post.mockResolvedValue({ sessions: 3, events: 40, transcripts: 3 });
});
afterEach(cleanup);

describe('RetentionPanel', () => {
  it('states that nothing is deleted automatically and shows what is due now', async () => {
    render(<RetentionPanel />);
    expect(await screen.findByText(/Nothing is deleted automatically/)).toBeTruthy();
    expect(screen.getByText('3 chats')).toBeTruthy();
  });

  it('asks for confirmation before turning automatic deletion on, then sends confirm:true', async () => {
    mocks.put.mockImplementation((_p, body) => {
      if (!body.confirm) {
        const err = Object.assign(new Error('confirmation_required'), { status: 409, data: { error: 'confirmation_required', categories: ['vp_chats'] } });
        return Promise.reject(err);
      }
      return Promise.resolve({ policy: body.policy });
    });
    render(<RetentionPanel />);
    const select = await screen.findByLabelText('Virtual-patient chats');
    fireEvent.change(select, { target: { value: '365' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
    const dialog = await screen.findByRole('dialog', { name: 'Turn on automatic deletion' });
    expect(mocks.put).toHaveBeenLastCalledWith('/admin/retention', expect.objectContaining({ confirm: false }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Turn on and save' }));
    await waitFor(() => expect(mocks.put).toHaveBeenLastCalledWith('/admin/retention', expect.objectContaining({ confirm: true })));
  });

  it('purges only after a preview and a confirmed dialog', async () => {
    mocks.post.mockImplementation((path, body) => {
      if (path === '/admin/retention/preview') return Promise.resolve({ category: body.category, days: body.days, sessions: 3, events: 40 });
      return Promise.resolve({ category: body.category, days: body.days, sessions: 3, events: 40, transcripts: 3 });
    });
    render(<RetentionPanel />);
    await screen.findByText(/Nothing is deleted automatically/);
    const purge = screen.getByRole('button', { name: 'Purge…' });
    expect(purge.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Preview (no change)' }));
    await screen.findByText(/This removes 3 items and 40 events/);
    fireEvent.click(screen.getByRole('button', { name: 'Purge…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manual purge' });
    expect(mocks.post).not.toHaveBeenCalledWith('/admin/retention/run', expect.anything());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/retention/run', expect.objectContaining({ confirm: true })));
  });

  it('sets one period for many selected classes after confirmation', async () => {
    render(<RetentionPanel />);
    await screen.findByText('Clinical A');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByText('2 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply to selected' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set retention period' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/admin/retention/items', expect.objectContaining({ kind: 'class', ids: [7, 8] })));
  });
});
