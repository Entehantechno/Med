/* The landing page links to /VP in the hero and the phone menu, and warms the
   /VP chunk on intent (hover, focus, touch) so the click is instant. */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ warm: vi.fn() }));
vi.mock('../lib/routes-prefetch.js', () => ({ warm: mocks.warm, onIdle: () => () => {} }));
vi.mock('../api.js', () => ({ api: { get: () => new Promise(() => {}) } }));
vi.mock('../context.jsx', () => ({
  useApp: () => ({
    t: (k) => k, tc: (k) => k, siteContent: {}, lang: 'fa', theme: 'light',
    toggleTheme: () => {}, toggleLang: () => {},
  }),
}));

import Landing from './Landing.jsx';

const noop = () => {};
const renderLanding = () => render(
  <Landing publicConfig={null} onGetStarted={noop} onSignIn={noop} onStore={noop} onBlog={noop} />,
);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('landing → /VP', () => {
  it('keeps the link out of the hero', () => {
    const { container } = renderLanding();
    expect(container.querySelector('.lp-hero a[href="/VP"]')).toBeNull();
  });

  it('has a showcase section that links to /VP', () => {
    renderLanding();
    const section = document.querySelector('section[aria-labelledby="landing-vp-title"]');
    expect(section).toBeTruthy();
    const link = screen.getByTestId('vp-showcase-cta');
    expect(section.contains(link)).toBe(true);
    expect(link.getAttribute('href')).toBe('/VP');
    expect(link.textContent).toContain('landVpCta');
    expect(section.textContent).toContain('landVpPrereq');
  });

  it('keeps the same link in the phone menu', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'منو' }));
    expect(screen.getByTestId('menu-vp').getAttribute('href')).toBe('/VP');
  });

  it('warms the /VP chunk on hover, focus and touch', () => {
    renderLanding();
    const link = screen.getByTestId('vp-showcase-cta');
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);
    fireEvent.touchStart(link);
    expect(mocks.warm).toHaveBeenCalledWith('vp');
  });
});
