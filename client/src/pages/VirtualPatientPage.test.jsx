/* /VP page: copy comes from the admin config, the sign-in form reports errors
   inline, motion is skipped under reduced motion, and Persian stays RTL. */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), login: vi.fn(), warm: vi.fn() }));
vi.mock('../api.js', () => ({ api: { get: mocks.get } }));
vi.mock('../lib/routes-prefetch.js', () => ({ warm: mocks.warm }));
const ctx = vi.hoisted(() => ({ lang: 'fa' }));
vi.mock('../context.jsx', () => ({
  useApp: () => ({ lang: ctx.lang, toggleLang: () => {}, login: mocks.login }),
}));

import VirtualPatientPage from './VirtualPatientPage.jsx';

const bi = (fa, en = fa) => ({ fa, en });
const CONFIG = {
  enabled: true,
  headline: bi('بیمار مجازی را ببینید', 'Meet the virtual patient'),
  subtitle: bi('گفت‌وگو و تشخیص', 'Talk and diagnose'),
  cta_login: bi('ورود با شماره دانشجویی', 'Sign in with student number'),
  cta_demo: bi('نمونه', 'Sample'),
  vitals: [{ label: bi('فشار خون', 'Blood pressure'), value: '148/92' }],
  chat: [{ role: 'student', text: bi('سلام', 'Hello') }, { role: 'patient', text: bi('سلام دکتر', 'Hi doctor') }],
  steps: [{ title: bi('گام', 'Step'), text: bi('متن', 'Text') }],
  features: [{ title: bi('مهارت', 'Skill'), text: bi('توضیح', 'Detail') }],
  faq: [{ q: bi('پرسش', 'Question'), a: bi('پاسخ', 'Answer') }],
  login: { title: bi('ورود دانشجویان', 'Student sign-in'), help: bi('راهنما', 'Help'), submit: bi('ورود', 'Sign in') },
  closed: bi('بسته است', 'Closed'),
};

function mockMatchMedia(reduce) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.lang = 'fa';
  mockMatchMedia(false);
  Element.prototype.animate = vi.fn(() => ({ cancel() {} }));
  mocks.get.mockResolvedValue({ config: CONFIG });
});
afterEach(cleanup);

const sn = () => screen.getByLabelText('شماره دانشجویی');
const pw = () => document.getElementById('vp-password');

describe('/VP virtual-patient page', () => {
  it('renders the admin copy in Persian with RTL and the student-number form', async () => {
    const { container } = render(<VirtualPatientPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'بیمار مجازی را ببینید' })).toBeTruthy();
    expect(container.firstChild.getAttribute('dir')).toBe('rtl');
    expect(sn().getAttribute('inputmode')).toBe('numeric');
    expect(sn().getAttribute('autocomplete')).toBe('username');
    expect(pw().getAttribute('autocomplete')).toBe('current-password');
    expect(mocks.get).toHaveBeenCalledWith('/site-content/vp-page');
  });

  it('renders English with LTR when the visitor switches language', async () => {
    ctx.lang = 'en';
    const { container } = render(<VirtualPatientPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Meet the virtual patient' })).toBeTruthy();
    expect(container.firstChild.getAttribute('dir')).toBe('ltr');
  });

  it('asks for the student number inline and never calls login with an empty form', async () => {
    render(<VirtualPatientPage />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));
    expect((await screen.findByRole('alert')).textContent).toBe('شماره دانشجویی را وارد کنید.');
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('shows the wrong-credentials message when the server rejects the sign-in', async () => {
    mocks.login.mockRejectedValue(new Error('invalid_credentials'));
    render(<VirtualPatientPage />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.change(sn(), { target: { value: '  ۱۲۳۴۵۶  ' } });
    fireEvent.change(pw(), { target: { value: 'secret-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('شماره دانشجویی یا رمز عبور درست نیست.'));
    expect(mocks.login).toHaveBeenCalledWith('۱۲۳۴۵۶', 'secret-pass');
    expect(mocks.warm).toHaveBeenCalledWith('studentHome');
  });

  it('maps a rate-limit answer to its own sentence', async () => {
    mocks.login.mockRejectedValue(new Error('too_many_attempts'));
    render(<VirtualPatientPage />);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.change(sn(), { target: { value: '1001' } });
    fireEvent.change(pw(), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));
    expect(await screen.findByText('تلاش‌های ورود بیش از حد. کمی بعد دوباره تلاش کنید.')).toBeTruthy();
  });

  it('plays the entrance sequence when motion is allowed', async () => {
    render(<VirtualPatientPage />);
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(Element.prototype.animate).toHaveBeenCalled());
  });

  it('skips every animation under prefers-reduced-motion', async () => {
    mockMatchMedia(true);
    render(<VirtualPatientPage />);
    await screen.findByRole('heading', { level: 1 });
    expect(Element.prototype.animate).not.toHaveBeenCalled();
  });

  it('shows the closed message and no form when the admin switches the page off', async () => {
    mocks.get.mockResolvedValue({ config: { ...CONFIG, enabled: false } });
    render(<VirtualPatientPage />);
    expect(await screen.findByText('بسته است')).toBeTruthy();
    expect(screen.queryByLabelText('شماره دانشجویی')).toBeNull();
  });

  it('shows a retry when the config cannot load, and retries on click', async () => {
    mocks.get.mockRejectedValueOnce(new Error('network'));
    render(<VirtualPatientPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('بارگذاری صفحه انجام نشد');
    mocks.get.mockResolvedValueOnce({ config: CONFIG });
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'بیمار مجازی را ببینید' })).toBeTruthy();
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
});
