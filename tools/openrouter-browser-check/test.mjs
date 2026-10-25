import assert from 'node:assert/strict';
import chromium from '@sparticuz/chromium';
import {chromium as playwright} from 'playwright-core';
const BASE=process.env.BROWSER_CHECK_URL||'http://127.0.0.1:4175/';
const browser=await playwright.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
const passed=[];
const key='synthetic-test-key-not-real';
const free={id:'test/free-model',pricing:{prompt:'0',completion:'0',request:'0'},architecture:{input_modalities:['text'],output_modalities:['text'],tokenizer:'Other'}};
async function setup(mode='ok'){
 const page=await browser.newPage({viewport:{width:1300,height:1000},acceptDownloads:true});
 let posts=0;const destinations=[];
 page.on('request',r=>destinations.push(new URL(r.url()).hostname));
 await page.route('https://openrouter.ai/**',async route=>{
  const req=route.request();
  if(req.url().endsWith('/models')){
   assert.equal(req.headers().authorization,undefined);
   return route.fulfill({json:{data:[free,{...free,id:'paid',pricing:{prompt:'1',completion:'0'}},{...free,id:'empty',pricing:{prompt:'',completion:'0'}},{...free,id:'openrouter/free'},{...free,id:'extra-cost',pricing:{...free.pricing,image:'1'}}]}});
  }
  assert.equal(req.url(),'https://openrouter.ai/api/v1/chat/completions');
  posts++;assert.equal(req.headers().authorization,'Bearer '+key);
  const body=req.postDataJSON();
  assert.equal(body.provider.max_price.prompt,0);assert.equal(body.provider.max_price.completion,0);assert.equal(body.provider.data_collection,'deny');assert.equal(body.model,free.id);assert.equal(body.max_tokens,220);
  assert(!body.messages[0].content.includes('سندرم کرونری حاد'));assert(!body.messages[0].content.includes('آپاندیسیت حاد'));
  if(mode==='401')return route.fulfill({status:401,json:{error:{message:'do not export '+key}}});
  if(mode==='network')return route.abort('connectionreset');
  if(mode==='invalid')return route.fulfill({json:{choices:[{message:{content:null}}]}});
  return route.fulfill({json:{model:'model-'+key,choices:[{message:{content:'<img src="https://attacker.invalid/x"> سلام دکتر '+key},finish_reason:'stop'}]}});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#catalog').click();
 await page.waitForFunction(()=>!document.getElementById('model').disabled);
 assert.equal(await page.locator('#model option').count(),1);
 return {page,posts:()=>posts,destinations};
}
try{
 const s=await setup();passed.push('catalog filters paid/empty-price/router/extra-fee models; catalog carries no key');
 await s.page.locator('#run').click();assert.equal(s.posts(),0);passed.push('missing key never sends completion');
 await s.page.locator('#key').fill(key);await s.page.locator('#run').click();
 await s.page.waitForFunction(()=>report?.status==='completed',{},{timeout:60000});
 const r=await s.page.evaluate(()=>report);assert.equal(r.requests,10);assert.equal(r.successfulCompletions,10);assert.equal(s.posts(),10);passed.push('10-request two-case budget and zero-price/data-denial headers');
 assert(!JSON.stringify(r).includes(key));assert.equal(await s.page.locator('#results img').count(),0);assert(s.destinations.every(h=>[new URL(BASE).hostname,'openrouter.ai'].includes(h)));passed.push('text-only rendering, no attacker requests, reports redact key');
 assert.equal(await s.page.evaluate(()=>localStorage.length+sessionStorage.length),0);passed.push('no browser-storage persistence');
 const downloadPromise=s.page.waitForEvent('download');await s.page.locator('#download').click();const d=await downloadPromise;assert.equal(d.suggestedFilename(),'openrouter-browser-report.json');passed.push('credential-free JSON report download');await s.page.close();
 for(const mode of ['401','network','invalid']){
  const t=await setup(mode);await t.page.locator('#key').fill(key);await t.page.locator('#run').click();await t.page.waitForFunction(()=>report&&report.status!=='running');
  const result=await t.page.evaluate(()=>report);assert.equal(t.posts(),1);assert.equal(result.successfulCompletions,0);assert(!JSON.stringify(result).includes(key));assert.equal(result.status,'failed_or_partial');await t.page.close();passed.push(mode+' stops without retries or fabricated completion');
 }
 const t=await setup();await t.page.locator('#key').fill(key);await t.page.locator('#run').click();await t.page.waitForFunction(()=>report?.successfulCompletions===1);await t.page.locator('#clear').click();await t.page.waitForFunction(()=>report?.status==='cancelled_or_timeout');assert.equal(await t.page.locator('#key').inputValue(),'');assert.equal(t.posts(),1);await t.page.close();passed.push('clear-key aborts the active test before the next request');
 console.log(JSON.stringify({kind:'browser UI/security regression; network mocked, NOT live OpenRouter',passed},null,2));
}finally{await browser.close();}
