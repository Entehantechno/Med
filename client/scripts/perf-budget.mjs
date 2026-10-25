#!/usr/bin/env node
import fs from "fs";import path from "path";import zlib from "zlib";const assets=path.resolve("dist/assets");const kb=n=>n/1024;const gz=f=>zlib.gzipSync(fs.readFileSync(f)).length;const files=fs.existsSync(assets)?fs.readdirSync(assets):[];const js=files.filter(f=>f.endsWith('.js')),css=files.filter(f=>f.endsWith('.css')),fonts=files.filter(f=>/\.(woff2?|ttf|otf)$/i.test(f));const entry=js.find(f=>/^index-.*\.js$/.test(f)),learn=js.find(f=>/^LearnApp-.*\.js$/.test(f));const entryCss=css.find(f=>/^index-.*\.css$/.test(f));const report={entryJsGzipKb:entry?kb(gz(path.join(assets,entry))):0,entryCssGzipKb:entryCss?kb(gz(path.join(assets,entryCss))):0,totalCssGzipKb:kb(css.reduce((s,f)=>s+gz(path.join(assets,f)),0)),learnAppGzipKb:learn?kb(gz(path.join(assets,learn))):0,fontsRawKb:kb(fonts.reduce((s,f)=>s+fs.statSync(path.join(assets,f)).size,0))};console.log('[perf-budget]',JSON.stringify(report,null,2));
// Budgets (gzip KB unless noted). History:
//  - entry JS 24 (was 22, relaxed for code-split reality); learnApp 24 (was 16, shell + nav).
//  - R56 (user-approved, documented): entry JS 24 -> 25, entry CSS 47 -> 60, total CSS 65 -> 66,
//    learnApp 24 -> 25. Reason: the CSS grew across R52-R55 (design refresh, motion/ads, keyboard-safe
//    fixes, mobile learn, scroll unlock) and all six files load in the entry via main.jsx. The
//    measured R56 build was entry JS 24.80, entry CSS 59.69, total CSS 65.49, learnApp 24.16.
//    Backlog to bring these back down: split CSS per route (keep cascade order) and dedupe
//    overridden rules across styles.css / design-refresh.css / styles-speed-fixes.css.
if(report.entryJsGzipKb>25||report.entryCssGzipKb>60||report.totalCssGzipKb>66||report.learnAppGzipKb>25||report.fontsRawKb>150)process.exit(1);console.log('✅ Performance budget passed');
