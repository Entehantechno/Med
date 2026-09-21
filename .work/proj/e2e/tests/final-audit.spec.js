import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ART = path.resolve('../qa-artifacts');
const dangerRe = /حذف|پاک|delete|remove|logout|خروج|پرداخت|pay|غیرفعال|خاموش|reject|رد|impersonate|ورود به جای/i;
function stamp(){return new Date().toISOString().replace(/[:.]/g,'-')}
function handlers(page,bucket,name){
  page.on('console', msg => { if(['error','warning'].includes(msg.type())) bucket.console.push({page:name,type:msg.type(),text:msg.text().slice(0,400)}); });
  page.on('pageerror', e => bucket.pageErrors.push({page:name,error:String(e.message||e).slice(0,400)}));
  page.on('response', res => { const st=res.status(), url=res.url(); if(st>=400 && !/favicon|csp-report|\.map$/.test(url)) bucket.network.push({page:name,status:st,url:url.slice(0,260)}); });
  page.on('dialog', d => d.dismiss().catch(()=>{}));
}
async function loginToken(request, username){ const r=await request.post('/api/auth/login',{data:{username,password:'demo'}}); expect(r.ok()).toBeTruthy(); return (await r.json()).token; }
async function setToken(page, token){ await page.addInitScript(t=>localStorage.setItem('medlab_token',t), token); }
async function screenshot(page,bucket,name){ const p=path.join(ART,`${name}-${stamp()}.png`); await page.screenshot({path:p,fullPage:true}); bucket.screenshots.push(p); }
async function auditButtons(page,bucket,context){
  const result = await page.locator('button, a[role="button"], input[type="button"], input[type="submit"]').evaluateAll((els, dangerSource) => {
    const danger = new RegExp(dangerSource,'i'); const items=[]; let clicked=0, skipped=0, failed=0;
    for(const [i,el] of els.entries()){
      const text=(el.innerText||el.value||el.getAttribute('aria-label')||el.getAttribute('title')||'').replace(/\s+/g,' ').trim();
      const visible=!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length); const disabled=!!el.disabled; const dangerous=danger.test(text);
      items.push({i,tag:el.tagName,text,visible,disabled,dangerous,cls:String(el.className||'').slice(0,80)});
      if(!visible||disabled||dangerous){skipped++; continue;}
      try{el.click(); clicked++;}catch(e){failed++;}
    }
    return {items,clicked,skipped,failed};
  }, dangerRe.source);
  bucket.buttonAudits.push({context,count:result.items.length,visible:result.items.filter(x=>x.visible).length,clicked:result.clicked,skipped:result.skipped,failed:result.failed,items:result.items});
  await page.waitForTimeout(500);
}

test('final visual, button, header and role smoke audit', async ({ page, request, browser }) => {
  test.setTimeout(120000); fs.mkdirSync(ART,{recursive:true});
  const bucket={startedAt:new Date().toISOString(),screenshots:[],buttonAudits:[],console:[],pageErrors:[],network:[],headerChecks:{},notes:[]};
  handlers(page,bucket,'public');

  const health=await request.get('/api/health'); expect(health.ok()).toBeTruthy(); expect((await health.json()).ok).toBe(true);
  const robots=await request.get('/robots.txt'); expect(robots.ok()).toBeTruthy();
  const html=await request.get('/'); expect(html.ok()).toBeTruthy();
  bucket.headerChecks.homeCache=html.headers()['cache-control']||'';
  bucket.headerChecks.csp=html.headers()['content-security-policy']||html.headers()['content-security-policy-report-only']||'';

  await page.goto('/'); await expect(page.locator('#root')).toBeVisible(); await expect(page.locator('body')).toContainText(/MED|School|شروع|پزشک/i,{timeout:15000}); await screenshot(page,bucket,'public'); await auditButtons(page,bucket,'public landing');

  const adminToken=await loginToken(request,'admin'); const admin=await browser.newPage(); handlers(admin,bucket,'admin'); await setToken(admin,adminToken); await admin.goto('/'); await expect(admin.getByRole('heading',{name:/پنل مدیریت|Admin/i})).toBeVisible({timeout:20000}); await screenshot(admin,bucket,'admin'); await auditButtons(admin,bucket,'admin overview');

  const studentToken=await loginToken(request,'40012345'); const stu=await browser.newPage(); handlers(stu,bucket,'student'); await setToken(stu,studentToken); await stu.goto('/'); await stu.waitForTimeout(700); await screenshot(stu,bucket,'student'); await auditButtons(stu,bucket,'student home');

  const blog=await request.get('/api/site-content/blog?lang=fa'); expect(blog.ok()).toBeTruthy();
  bucket.blogPostCount=(await blog.json()).posts?.length || 0;

  bucket.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(ART,'final-audit-report.json'),JSON.stringify(bucket,null,2));
  const severeConsole=bucket.console.filter(x=>x.type==='error'&&!/favicon|ResizeObserver|Failed to load resource/i.test(x.text));
  const severeNetwork=bucket.network.filter(x=>!/\/api\/auth\/me|\/api\/auth\/password|\/api\/pwa\/|\/api\/site-content|\/api\/support\/unread|\/blog/.test(x.url));
  expect(bucket.pageErrors, JSON.stringify(bucket.pageErrors,null,2)).toHaveLength(0);
  expect(severeConsole, JSON.stringify(severeConsole.slice(0,10),null,2)).toHaveLength(0);
  expect(severeNetwork, JSON.stringify(severeNetwork.slice(0,10),null,2)).toHaveLength(0);
});
