// Run against a disposable demo installation; creates one MCQ in that database.
// CHROMIUM_PATH may point to a separately installed headless Chromium.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:4000';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote'],headless:true});
const errors=[];let prompts=0;
async function login(page){
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{prompts++;await d.accept();});
 await page.addInitScript(()=>localStorage.setItem('medlab_lang','en'));
 await page.goto(base+'/admin');await page.getByTestId('login-username').fill('admin');await page.getByTestId('login-password').fill('demo');await page.getByTestId('login-submit').click();await page.getByRole('button',{name:'University accounts',exact:true}).click();
}
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});await login(page);await page.getByRole('button',{name:'Flashcards',exact:true}).click();
 for(const type of [/4-option MCQ/,/Key Feature/,/True \/ False/,/Fill blank/,/Match puzzle/,/Compare two entities/,/Image-label puzzle/,/^Order$/,/Hotspot/,/Drawing/,/^Stepwise$/]){
  await page.getByRole('button',{name:/New flashcard/}).click();const d=page.getByRole('dialog');await d.getByRole('button',{name:type}).click();await d.getByRole('button',{name:'Show all',exact:true}).click();assert(await d.getByRole('button',{name:'Save content',exact:true}).isVisible());await d.getByRole('button',{name:'Cancel',exact:true}).click();await d.waitFor({state:'hidden'});
 }
 console.log('PASS: 11 academic editors render in real Chromium');
 await page.getByRole('button',{name:/New flashcard/}).click();const d=page.getByRole('dialog');await d.getByRole('button',{name:'Show all',exact:true}).click();
 const en=d.locator('input[aria-label="Title (EN) (EN)"]'),fa=d.locator('input[aria-label="Title (FA) (FA)"]');await en.fill('R8 browser MCQ');await d.getByRole('button',{name:'فارسی',exact:true}).click();assert.equal(await en.isVisible(),false);await fa.fill('سؤال مرورگر');await d.getByRole('button',{name:'Both',exact:true}).click();assert.equal(await en.inputValue(),'R8 browser MCQ');assert.equal(await fa.inputValue(),'سؤال مرورگر');
 await d.getByPlaceholder('EN #1',{exact:true}).fill('A');await d.getByPlaceholder('EN #2',{exact:true}).fill('B');
 let release,entered;const gate=new Promise(r=>{release=r;}),seen=new Promise(r=>{entered=r;});
 await page.route('**/api/flashcards',async route=>{if(route.request().method()!=='POST')return route.continue();entered();await gate;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'audit_offline'})});});
 await d.getByRole('button',{name:'Save content',exact:true}).click();await seen;assert(await en.isDisabled());assert(await d.getByPlaceholder('EN #1',{exact:true}).isDisabled());release();await d.getByRole('alert').waitFor();assert.equal(await en.isDisabled(),false);assert.equal(await en.inputValue(),'R8 browser MCQ');await page.unroute('**/api/flashcards');
 const posted=page.waitForResponse(r=>r.url().endsWith('/api/flashcards')&&r.request().method()==='POST');await d.getByRole('button',{name:'Save content',exact:true}).click();const result=await posted;assert.equal(result.status(),200);const {id}=await result.json();await d.waitFor({state:'hidden'});
 const stored=await page.evaluate(async id=>{const r=await fetch('/api/flashcards/'+id,{headers:{Authorization:'Bearer '+localStorage.getItem('medlab_token')}});return r.json();},id);
 assert.equal(stored.title_en,'R8 browser MCQ');assert.equal(stored.title_fa,'سؤال مرورگر');assert.equal(stored.options.length,2);
 console.log('PASS: independent language visibility, pending-save lock, failed-save retention, successful retry and API readback');
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const mobile=await context.newPage();await login(mobile);await mobile.locator('.sidenav-mobile-toggle').click();await mobile.getByRole('button',{name:'Patient Bank',exact:true}).click();await mobile.getByRole('button',{name:/New case/}).click();const md=mobile.getByRole('dialog');const field=md.getByLabel('Case title (EN)',{exact:true});await field.click();await field.pressSequentially('Continuous typing retains focus');assert.equal(await field.inputValue(),'Continuous typing retains focus');assert(await field.evaluate(el=>el===document.activeElement));
 await md.getByRole('button',{name:'Show all',exact:true}).click();const box=await md.boundingBox();assert(box.x>=-1&&box.x+box.width<=391);await md.getByRole('button',{name:'Cancel',exact:true}).click();await md.waitFor({state:'hidden'});assert(prompts>0);assert.deepEqual(errors,[]);console.log('PASS: mobile viewport modal bounds, clinical typing/focus, dirty-close prompt; zero page errors');
}finally{await browser.close();}
