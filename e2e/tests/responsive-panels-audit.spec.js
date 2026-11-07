import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ART = path.resolve('../qa-artifacts');
const REPORT = path.join(ART, 'responsive-panels-audit-report.json');
const MD = path.join('..', 'گزارش-بازبینی-کامل-صفحات-پنل‌ها-موبایل.md');

async function loginToken(request, username) {
  const r = await request.post('/api/auth/login', { data: { username, password: 'demo' } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).token;
}
async function setToken(page, token) {
  await page.addInitScript((tk) => localStorage.setItem('medlab_token', tk), token);
}
function watch(page, bucket, label) {
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) bucket.console.push({ label, type: msg.type(), text: msg.text().slice(0, 500) });
  });
  page.on('pageerror', (e) => bucket.pageErrors.push({ label, error: String(e.message || e).slice(0, 500) }));
  page.on('response', (res) => {
    const st = res.status(), url = res.url();
    if (st >= 400 && !/favicon|csp-report|\.map$|\/api\/auth\/me|\/api\/support\/unread|\/api\/pwa\//.test(url)) {
      bucket.network.push({ label, status: st, url: url.slice(0, 320) });
    }
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
}
async function layoutMetrics(page, label, viewport) {
  await page.waitForTimeout(180);
  return await page.evaluate(({ label, viewport }) => {
    const doc = document.documentElement;
    const body = document.body;
    const vw = window.innerWidth;
    const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - vw;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const interactives = [...document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')].filter(visible);
    const tooSmall = interactives.map((el) => {
      const r = el.getBoundingClientRect();
      const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.tagName).replace(/\s+/g, ' ').trim();
      return { tag: el.tagName, text: text.slice(0, 80), w: Math.round(r.width), h: Math.round(r.height), cls: String(el.className || '').slice(0, 100) };
    }).filter((x) => x.w < (viewport === 'mobile' ? 32 : 24) || x.h < (viewport === 'mobile' ? 32 : 24));
    const cards = [...document.querySelectorAll('.card,.ddle-card,.lp-feature,.lp-aud-card,.lp-step,.lp-testi,.mod-card,.case-item,.live-rank-row,.step-card')].filter(visible);
    const weakCards = cards.map((el) => {
      const st = getComputedStyle(el), r = el.getBoundingClientRect();
      const hasFrame = st.borderStyle !== 'none' || parseFloat(st.borderWidth) > 0 || st.boxShadow !== 'none' || st.backgroundColor !== 'rgba(0, 0, 0, 0)';
      const radius = parseFloat(st.borderRadius || '0') || 0;
      return { cls: String(el.className || '').slice(0, 120), w: Math.round(r.width), h: Math.round(r.height), hasFrame, radius };
    }).filter((x) => !x.hasFrame || x.radius < 4);
    const badFixed = [...document.querySelectorAll('.app,.container,.card,.modal,.table-wrap,.sidenav,.section-title,.grid,.ddle-card,.lp-hero,.lp-section,.live-rank-row')].filter(visible).map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, cls: String(el.className || '').slice(0, 80), x: Math.round(r.x), w: Math.round(r.width) };
    }).filter((x) => x.x < -8 || x.x + x.w > vw + 8).slice(0, 20);
    return {
      label, viewport, path: location.pathname, width: vw,
      overflowX: Math.round(overflowX),
      interactiveCount: interactives.length,
      tooSmall: tooSmall.slice(0, 25),
      tooSmallCount: tooSmall.length,
      cardCount: cards.length,
      weakCards: weakCards.slice(0, 20),
      weakCardsCount: weakCards.length,
      badFixed,
    };
  }, { label, viewport });
}
async function auditPoint(page, bucket, label, viewport) {
  const m = await layoutMetrics(page, label, viewport);
  bucket.metrics.push(m);
  if (m.overflowX > 6) bucket.layoutIssues.push(m);
}
async function openMobileNavIfNeeded(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('.sidenav-mobile-toggle');
    if (!btn) return;
    const st = getComputedStyle(btn);
    const visible = st.display !== 'none' && st.visibility !== 'hidden' && btn.getBoundingClientRect().height > 0;
    if (visible && btn.getAttribute('aria-expanded') !== 'true') btn.click();
  });
}
async function auditAdminPanels(page, bucket, viewport) {
  await page.goto('/admin');
  await page.waitForTimeout(600);
  await auditPoint(page, bucket, `admin-initial-${viewport}`, viewport);
  const modes = await page.locator('.mode-switch button').count().catch(() => 0);
  for (let mi = 0; mi < Math.max(1, modes); mi++) {
    if (modes) {
      await page.evaluate((i) => document.querySelectorAll('.mode-switch button')[i]?.click(), mi);
      await page.waitForTimeout(220);
    }
    await openMobileNavIfNeeded(page);
    let safety = 0;
    while (safety++ < 90) {
      await openMobileNavIfNeeded(page);
      const ids = await page.locator('.nav-tab-btn').evaluateAll((els) => els.map((el, i) => ({ i, text: (el.innerText || '').trim(), active: el.classList.contains('active'), visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) })).filter(x => x.visible));
      const next = ids.find((x) => !bucket.adminVisited.includes(`${viewport}:${mi}:${x.text}`));
      if (!next) break;
      bucket.adminVisited.push(`${viewport}:${mi}:${next.text}`);
      await openMobileNavIfNeeded(page);
      await page.evaluate((i) => document.querySelectorAll('.nav-tab-btn')[i]?.click(), next.i);
      await page.waitForTimeout(300);
      await auditPoint(page, bucket, `admin-${viewport}-${next.text || next.i}`, viewport);
    }
  }
}

function markdown(bucket) {
  const severeNet = bucket.network.filter((x) => !/404.*blog|\/api\/ads\/external\/public/.test(`${x.status} ${x.url}`));
  const lines = [];
  lines.push('# گزارش بازبینی کامل صفحات، پنل‌ها و موبایل');
  lines.push('');
  lines.push(`تاریخ: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## خلاصه');
  lines.push(`- نقاط بررسی‌شده: ${bucket.metrics.length}`);
  lines.push(`- پنل‌های ادمین بازشده: ${bucket.adminVisited.length}`);
  lines.push(`- خطاهای layout جدی: ${bucket.layoutIssues.length}`);
  lines.push(`- Page errors: ${bucket.pageErrors.length}`);
  lines.push(`- Network errors مهم: ${severeNet.length}`);
  lines.push(`- Console warnings/errors ثبت‌شده: ${bucket.console.length}`);
  lines.push('');
  lines.push('## صفحات و پنل‌های بررسی‌شده');
  for (const m of bucket.metrics) lines.push(`- ${m.label}: overflowX=${m.overflowX}px, cards=${m.cardCount}, smallTargets=${m.tooSmallCount}`);
  lines.push('');
  lines.push('## موارد نیازمند توجه');
  if (!bucket.layoutIssues.length && !bucket.pageErrors.length && !severeNet.length) lines.push('- مورد بحرانی پیدا نشد.');
  for (const m of bucket.layoutIssues) lines.push(`- ${m.label}: overflowX=${m.overflowX}px / عناصر خارج از عرض: ${m.badFixed.length}`);
  for (const e of bucket.pageErrors) lines.push(`- PageError ${e.label}: ${e.error}`);
  for (const e of severeNet.slice(0, 20)) lines.push(`- Network ${e.status} ${e.label}: ${e.url}`);
  return lines.join('\n');
}

test('responsive framing audit for public pages, admin panels, student and learner surfaces', async ({ browser, request }) => {
  test.setTimeout(420000);
  fs.mkdirSync(ART, { recursive: true });
  const bucket = { startedAt: new Date().toISOString(), metrics: [], layoutIssues: [], console: [], pageErrors: [], network: [], adminVisited: [] };

  const health = await request.get('/api/health'); expect(health.ok()).toBeTruthy();
  const adminToken = await loginToken(request, 'admin');
  const studentToken = await loginToken(request, '40012345');
  const learnerToken = await loginToken(request, 'learner');

  const viewports = [
    { name: 'desktop', width: 1440, height: 1000, mobile: false },
    { name: 'mobile', width: 390, height: 844, mobile: true },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, locale: 'fa-IR' });
    const page = await context.newPage(); watch(page, bucket, vp.name);

    for (const route of ['/', '/store', '/blog', '/admin']) {
      await page.goto(route);
      await page.waitForTimeout(450);
      await auditPoint(page, bucket, `${route}-${vp.name}`, vp.name);
    }

    await setToken(page, adminToken);
    await auditAdminPanels(page, bucket, vp.name);

    const student = await context.newPage(); watch(student, bucket, `student-${vp.name}`); await setToken(student, studentToken);
    await student.goto('/'); await student.waitForTimeout(600); await auditPoint(student, bucket, `student-home-${vp.name}`, vp.name);
    for (const txt of [/کلاس|Classes/i, /آزمون|Exam/i, /پروفایل|Profile/i]) {
      const b = student.getByRole('button', { name: txt }).first();
      if (await b.isVisible().catch(() => false)) { await b.click(); await student.waitForTimeout(300); await auditPoint(student, bucket, `student-${txt}-${vp.name}`, vp.name); }
    }

    const learner = await context.newPage(); watch(learner, bucket, `learner-${vp.name}`); await setToken(learner, learnerToken);
    await learner.goto('/'); await learner.waitForTimeout(400); await auditPoint(learner, bucket, `learner-home-${vp.name}`, vp.name);
    const navTexts = [/مسیر|Path/i, /تمرین|Practice/i, /فروشگاه|Store/i, /پیشرفت|Progress/i, /رتبه|League|Ranking/i];
    for (const txt of navTexts) {
      const el = learner.getByRole('button', { name: txt }).first();
      if (await el.isVisible().catch(() => false)) { await el.click(); await learner.waitForTimeout(400); await auditPoint(learner, bucket, `learner-${txt}-${vp.name}`, vp.name); }
    }
    await context.close();
  }

  bucket.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT, JSON.stringify(bucket, null, 2));
  fs.writeFileSync(MD, markdown(bucket));

  const severeConsole = bucket.console.filter((x) => x.type === 'error' && !/favicon|ResizeObserver|Failed to load resource|DevTools/i.test(x.text));
  const severeNetwork = bucket.network.filter((x) => !/\/api\/auth\/me|\/api\/site-content\/blog|\/api\/ads\/external\/public/.test(x.url));
  expect(bucket.pageErrors, JSON.stringify(bucket.pageErrors, null, 2)).toHaveLength(0);
  expect(severeConsole, JSON.stringify(severeConsole.slice(0, 10), null, 2)).toHaveLength(0);
  expect(severeNetwork, JSON.stringify(severeNetwork.slice(0, 10), null, 2)).toHaveLength(0);
  expect(bucket.layoutIssues, JSON.stringify(bucket.layoutIssues.slice(0, 10), null, 2)).toHaveLength(0);
});
