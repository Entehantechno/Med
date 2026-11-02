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
  policy: { vp_chats: 0, academic_items: 0, tutor_chats: 0, security_events: 0, rum_vitals: 45 },
  due: {
    vp_chats: { sessions: 3, events: 40 }, academic_items: { rows: 0 }, tutor_chats: { rows: 0 }, security_events: { rows: 0 }, rum_vitals: { rows: 2 },
  },
  categories: ['vp_chats', 'academic_items', 'tutor_chats', 'security_events', 'rum_vitals'],
  presets: [0, 90, 180, 365, 730],
  minDays: 30,
  maxDays: 3650,
  lastRunMs: 0,
  storage: { fileBytes: 2097152, freeBytes: 524288, autoVacuum: 'none', pageSize: 4096, pageCount: 512, freePages: 128 },
};
const CLASSES = [
  { id: 7, name_en: 'Clinical A', name_fa: 'بالینی الف', code: 'CA1', retention_days: null, chats: 12, active: 1, attempts: 30, study_id: null },
  { id: 8, name_en: 'Clinical B', name_fa: 'بالینی ب', code: 'CB2', retention_days: 180, chats: 4, active: 1, attempts: 9, study_id: null },
  { id: 9, name_en: 'Old Module', name_fa: 'واحد قدیمی', code: 'OM0', retention_days: null, chats: 2, active: 0, attempts: 5, study_id: null, inspection_hold: 0 },
  { id: 10, name_en: 'Held Module', name_fa: 'واحد نگه‌داشته', code: 'HM0', retention_days: 30, chats: 1, active: 0, attempts: 3, study_id: null, inspection_hold: 1 },
];
const IMPACT = { 9: { kind: 'class', id: 9, blocked: null, attempts: 5, chats: 2, members: 3, responses: 1 } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation((path) => {
    if (path === '/admin/retention/items?kind=class') return Promise.resolve({ kind: 'class', rows: CLASSES });
    if (path === '/admin/retention/items?kind=exam') return Promise.resolve({ kind: 'exam', rows: [] });
    const m = /items\/impact\?kind=(\w+)&id=(\d+)/.exec(path);
    if (m) return Promise.resolve(IMPACT[m[2]] || { kind: m[1], id: Number(m[2]), blocked: 'not_archived', attempts: 0, chats: 0, members: 0, responses: 0 });
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
    expect(screen.getByText('4 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply to selected' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set retention period' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/admin/retention/items', expect.objectContaining({ kind: 'class', ids: [7, 8, 9, 10] })));
  });

  it('shows status and grades, and offers the delete only for archived classes', async () => {
    render(<RetentionPanel />);
    await screen.findByText('Old Module');
    expect(screen.getAllByText('Archived')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Delete with grades…' })).toHaveLength(1);
    expect(screen.getAllByText('Archive it first')).toHaveLength(2);
    expect(screen.getByText('An inspection request is open')).toBeTruthy();
  });

  it('shows the impact counts before deleting an archived class, and needs confirmation', async () => {
    render(<RetentionPanel />);
    await screen.findByText('Old Module');
    fireEvent.click(screen.getByRole('button', { name: 'Delete with grades…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete archived class or exam for good' });
    expect(within(dialog).getByText(/Grades: 5 · chats: 2 · members: 3 · form answers: 1/)).toBeTruthy();
    expect(within(dialog).getByText(/cannot be undone/)).toBeTruthy();
    expect(mocks.post).not.toHaveBeenCalledWith('/admin/retention/items/delete', expect.anything());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete for good' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/retention/items/delete', { kind: 'class', ids: [9], confirm: true }));
  });

  it('tells the admin when a selected item is kept by the rules, and does not count it', async () => {
    IMPACT[9] = { ...IMPACT[9], blocked: 'used_by_active_exam' };
    try {
      render(<RetentionPanel />);
      await screen.findByText('Old Module');
      fireEvent.click(screen.getByRole('button', { name: 'Delete with grades…' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete archived class or exam for good' });
      expect(within(dialog).getByText(/1 item\(s\) are kept/)).toBeTruthy();
      expect(within(dialog).getByText(/^0 item\(s\) will be deleted/)).toBeTruthy();
    } finally {
      IMPACT[9] = { kind: 'class', id: 9, blocked: null, attempts: 5, chats: 2, members: 3, responses: 1 };
    }
  });

  it('bulk delete sends only the selected archived items', async () => {
    mocks.post.mockResolvedValue({ items: 1, attempts: 5, chats: 2, members: 3, responses: 1, skipped: [] });
    render(<RetentionPanel />);
    await screen.findByText('Old Module');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: /Delete 1 archived with grades/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete archived class or exam for good' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete for good' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/retention/items/delete', { kind: 'class', ids: [9], confirm: true }));
  });

  it('places an inspection hold on one row at once, without a confirmation', async () => {
    render(<RetentionPanel />);
    await screen.findByText('Old Module');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inspection hold for Old Module' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/admin/retention/items/hold', { kind: 'class', ids: [9], hold: true, confirm: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('releasing a hold asks first, and a held row cannot be deleted', async () => {
    render(<RetentionPanel />);
    await screen.findByText('Held Module');
    const box = screen.getByRole('checkbox', { name: 'Inspection hold for Held Module' });
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    const dialog = await screen.findByRole('dialog', { name: 'Release the inspection hold' });
    expect(mocks.put).not.toHaveBeenCalledWith('/admin/retention/items/hold', expect.anything());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Release' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/admin/retention/items/hold', { kind: 'class', ids: [10], hold: false, confirm: true }));
  });

  it('the bulk hold covers every selected row, and archived delete skips held rows', async () => {
    render(<RetentionPanel />);
    await screen.findByText('Held Module');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByRole('button', { name: /Delete 1 archived with grades/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Place inspection hold' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/admin/retention/items/hold', { kind: 'class', ids: [7, 8, 9, 10], hold: true, confirm: true }));
  });
});
