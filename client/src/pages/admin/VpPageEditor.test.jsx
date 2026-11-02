/* Admin editor for the /VP page: it loads the config, enforces list caps, and
   saves the whole config to the university-content endpoint. */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api.js', () => ({ api: { get: mocks.get, put: mocks.put } }));
vi.mock('../../context.jsx', () => ({ useApp: () => ({ lang: 'en' }) }));
vi.mock('../../components/UI.jsx', () => ({ useToast: () => () => {}, Spinner: () => <div>loading</div> }));

import VpPageEditor from './VpPageEditor.jsx';

const bi = (fa, en = fa) => ({ fa, en });
const LIMITS = { title: 120, line: 400, short: 60, value: 24, vitals: 4, chat: 8, steps: 3, features: 6, faq: 6 };
const CONFIG = {
  enabled: true,
  headline: bi('Hero FA', 'Hero EN'),
  subtitle: bi('s', 's'),
  cta_login: bi('l', 'l'),
  cta_demo: bi('d', 'd'),
  vitals: [1, 2, 3, 4].map((n) => ({ label: bi(`v${n}`, `v${n}`), value: String(n) })),
  chat: [],
  steps: [],
  features: [],
  faq: [],
  login: { title: bi('t', 't'), help: bi('h', 'h'), submit: bi('s', 's') },
  closed: bi('c', 'c'),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ config: CONFIG, defaults: CONFIG, limits: LIMITS });
  mocks.put.mockImplementation((_path, body) => Promise.resolve({ config: body.config }));
});
afterEach(cleanup);

describe('VpPageEditor', () => {
  it('loads the config and saves the edited headline to the admin endpoint', async () => {
    render(<VpPageEditor />);
    const headline = (await screen.findAllByLabelText('Headline (Persian)'))[0];
    expect(headline.value).toBe('Hero FA');
    fireEvent.change(headline, { target: { value: 'New Persian headline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
    const [path, body] = mocks.put.mock.calls[0];
    expect(path).toBe('/admin/vp-page');
    expect(body.config.headline).toEqual({ fa: 'New Persian headline', en: 'Hero EN' });
  });

  it('saves the page switch', async () => {
    render(<VpPageEditor />);
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalled());
    expect(mocks.put.mock.calls[0][1].config.enabled).toBe(false);
  });

  it('disables Add once a list reaches its cap', async () => {
    render(<VpPageEditor />);
    await screen.findByText('Vital signs (max 4)');
    const addButtons = screen.getAllByRole('button', { name: 'Add' });
    expect(addButtons[0].disabled).toBe(true);
    expect(addButtons[1].disabled).toBe(false);
  });

  it('links to the public page for preview', async () => {
    render(<VpPageEditor />);
    const link = await screen.findByRole('link', { name: 'Preview (saved version)' });
    expect(link.getAttribute('href')).toBe('/VP');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});
