#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const zipPath = process.argv[2];
if (!zipPath) {
  console.error("Usage: node scripts/check-release-zip.mjs /path/to/MED-School.zip");
  process.exit(2);
}
if (!existsSync(zipPath)) {
  console.error(`Release ZIP not found: ${zipPath}`);
  process.exit(2);
}

let entries;
try {
  entries = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
} catch (e) {
  console.error("Could not inspect ZIP. Make sure the `unzip` command is available.");
  console.error(e.message || e);
  process.exit(2);
}

const errors = [];
const has = (p) => entries.includes(p);
const required = ["package.json", "app.cjs", "server/src/start.cjs", "server/src/index.js", ".env.ready", "client/dist/index.html"];

// The question banks are DATA the running site needs, not build artefacts.
// A release once shipped without them because the packaging command excluded
// `import-payload*.json`; the site then came up with an empty learning path and
// an empty content table, with no error anywhere to explain why. Fail the
// release check instead of letting that ship again.
// Matches all three shapes a bank may ship: a single payload, numbered parts,
// and a named part family (import-payload.book.part01.json) used when a bank
// carries more than one source.
const bankPayloads = entries.filter((n) => /^tools\/[^/]+-bank\/import-payload(\.[a-z0-9-]+)?(\.part\d+)?\.json$/i.test(n));
if (!bankPayloads.length) {
  errors.push(
    "No question-bank payloads in the ZIP (tools/*-bank/import-payload*.json). " +
    "Without them the deployed site has no exam questions."
  );
} else {
  console.log(`Question banks: ${bankPayloads.length} payload file(s) present.`);
}
for (const r of required) {
  if (!has(r)) errors.push(`Missing required file at ZIP root: ${r}`);
}

if (!has("package.json")) {
  const topPackages = entries.filter((e) => /^[^/]+\/package\.json$/.test(e));
  if (topPackages.length) {
    errors.push(`package.json is inside a wrapper folder (${topPackages[0]}). Files must be directly in ZIP root.`);
  }
}

const forbiddenMatchers = [
  { name: "node_modules", test: (e) => e === "node_modules/" || e.includes("/node_modules/") || e.startsWith("node_modules/") },
  { name: "runtime data folder medschool-data", test: (e) => e === "medschool-data/" || e.startsWith("medschool-data/") },
  { name: "runtime data folder data", test: (e) => e === "data/" || e.startsWith("data/") },
  { name: "SQLite/sql.js database file", test: (e) => /(^|\/)[^/]+\.(db|sqlite|sqlite3)(-|$|\.)?/i.test(e) },
  { name: "Playwright report/test-results", test: (e) => e.includes("playwright-report/") || e.includes("test-results/") },
  // Lean release: raw question-bank build inputs must never ship (payloads only).
  { name: "raw bank build inputs (sources/scrapers)", test: (e) => /^tools\/[^/]+-bank\/sources\//.test(e) || /^tools\/exam-booklets\//.test(e) },
  { name: "non-payload bank files", test: (e) => /^tools\/[^/]+-bank\//.test(e) && !/import-payload(\.[a-z0-9-]+)?(\.part\d+)?\.json$/i.test(e) },
  // Internal/dev docs must not reach the operator.
  { name: "internal agent file AGENTS.md", test: (e) => e === "AGENTS.md" },
  { name: "dev planning/chat artifacts", test: (e) => /^(پلن-تحقیق|پلن-توسعه|ادامه-در-چت|گزارش\.md)/.test(e) },
];
for (const f of forbiddenMatchers) {
  const found = entries.find(f.test);
  if (found) errors.push(`Forbidden ${f.name} found in ZIP: ${found}`);
}

const rootNames = new Set(entries.map((e) => e.split("/")[0]).filter(Boolean));
if (rootNames.size === 1 && !has("package.json")) {
  errors.push(`ZIP seems to contain one extra top-level folder (${[...rootNames][0]}). cPanel needs files directly in the application root.`);
}


const readEntry = (entry) => {
  if (!entries.includes(entry)) return "";
  try {
    return execFileSync("unzip", ["-p", zipPath, entry], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  } catch {
    return "";
  }
};

// Feature-level release audit. This prevents a recurring class of mistakes:
// a ZIP can have the right cPanel structure but still miss important product
// features restored in earlier rounds. Keep this list lightweight and based on
// stable source-code markers so it runs fast on small cPanel-oriented releases.
const featureChecks = [
  {
    name: "independent /admin route",
    file: "client/src/App.jsx",
    tests: [/initialAdmin/, /\/admin\(\\\/\|\$\)/, /window\.history\.replaceState\(\{\}, "", "\/admin"\)/],
  },
  {
    name: "independent /store route",
    file: "client/src/App.jsx",
    tests: [/initialStore/, /\/store\(\\\/\|\$\)/, /window\.history\.pushState\(\{\}, "", "\/store"\)/],
  },
  {
    name: "admin public-site controls in General section",
    file: "client/src/pages/Admin.jsx",
    tests: [/navGroupPublicSite/, /\["siteContent", "edit", "learn\.settings"\]/, /\["landingManager", "medal", "learn\.content"\]/],
  },
  {
    name: "landing total site users statistic",
    file: "server/src/lib/landing.js",
    tests: [/SELECT COUNT\(\*\) c FROM users/, /learnerAccounts/, /raw:\s*\{[^}]*users[^}]*learners:\s*users/s],
  },
  {
    name: "default university education blog posts",
    file: "server/src/lib/blog.js",
    tests: [/virtual-patient-osce-medical-education/, /hint-based-questions-scaffolded-learning/, /ensureDefaultEducationPosts/],
  },
  {
    name: "university article sign-in CTA without free-start marker",
    file: "client/src/pages/Blog.jsx",
    tests: [/UNIVERSITY_ARTICLE_SLUGS/, /Sign in to use the university features|برای استفاده از امکانات دانشگاهی وارد شوید/],
  },
  {
    name: "CMS testimonials on landing",
    file: "client/src/pages/Landing.jsx",
    tests: [/cmsTestimonials/, /landTesti\$\{i\}/, /landTesti\$\{i\}Name/],
  },
  {
    name: "daily users analytics",
    file: "server/src/routes/admin.js",
    tests: [/analytics\/daily-users/, /daily-users\.csv/, /GROUP BY substr\(created_at,1,10\)/],
  },
  {
    name: "external ads admin-controlled and off by default",
    file: "server/src/lib/external-ads.js",
    tests: [/external_ads_config/, /enabled[^\n]+DEFAULT 0|enabled[^\n]+0/, /provider[^\n]+none/],
  },
  {
    name: "questionnaires module",
    file: "server/src/routes/questionnaires.js",
    tests: [/questionnaire_forms/, /questionnaire_responses/, /\/admin\/forms/],
  },
  {
    name: "Dr Tutor controlled module",
    file: "server/src/routes/tutor.js",
    tests: [/tutor_settings/, /context-settings/, /ai_enabled/],
  },
  {
    name: "educational research module",
    file: "server/src/routes/research.js",
    tests: [/research_studies/, /research_events/, /express\.Router\(\)|export default r/],
  },
  {
    name: "histology/image hotspot question type",
    file: "client/src/pages/Flashcards.jsx",
    tests: [/type === "hotspot"/, /HotspotPlayer/, /hotspotClicks/],
  },
  {
    name: "professional micro-interactions restored",
    file: "client/src/styles-speed-fixes.css",
    tests: [/Restored professional functional micro-interactions/, /prefers-reduced-motion/, /--motion-fast/],
  },
  {
    name: "SSRF IPv6-mapped and redirect-safe fetch",
    file: "server/src/lib/security.js",
    tests: [/extractIpv4/, /safeFetch/, /jsonReviver/, /::ffff:/],
  },
  {
    name: "JWT token_ver revocation after password change",
    file: "server/src/lib/auth.js",
    tests: [/bumpTokenVer/, /token_ver/, /issuer: JWT_ISS/, /audience: JWT_AUD/, /revokeJti/, /jti:/],
  },
  {
    name: "SSRF IPFuscation + HIBP k-anonymity",
    file: "server/src/lib/security.js",
    tests: [/parseOctet/, /0x7f/, /2002:/, /passwordPwned/, /parseHibpRange/, /api\.pwnedpasswords\.com/],
  },
  {
    name: "logout-all and Google account-takeover guard",
    file: "server/src/routes/auth.js",
    tests: [/logout-all/, /email exists unverified/, /passwordPwned/, /tokenHash/],
  },
  {
    name: "Google GIS CSP and JWKS verification",
    file: "server/src/lib/google.js",
    tests: [/verifyWithJwks/, /oauth2\/v3\/certs/, /google_client_id/, /nonce/],
  },
  {
    name: "Google button FedCM + nonce",
    file: "client/src/components/GoogleButton.jsx",
    tests: [/use_fedcm_for_prompt/, /medlab_gis_nonce/, /accounts\.google\.com\/gsi\/client/],
  },
  {
    name: "purge unsigned cards in official subjects",
    file: "server/src/routes/admin.js",
    tests: [/purgeUnsignedInOfficialSubjects/, /demo-cards\/purge-unsigned/],
  },
  {
    name: "suspicious input guard",
    file: "server/src/app.js",
    tests: [/suspicious_input/, /recordSuspiciousInput/, /flattenInput/],
  },
  {
    name: "dangerous HTTP methods blocked",
    file: "server/src/app.js",
    tests: [/TRACE/, /TRACK/, /CONNECT/, /method_not_allowed/],
  },
  {
    name: "full questionnaire admin control",
    file: "server/src/routes/questionnaires.js",
    tests: [/\/admin\/forms\/:id/, /require_after_finish/, /questionnaire_responses/],
  },
  {
    name: "questionnaire admin UI editor",
    file: "client/src/pages/Admin.jsx",
    tests: [/Create\/edit questionnaire|ساخت\/ویرایش پرسشنامه/, /questions:\[\{type:"rating"/, /\/questionnaires\/admin\/responses/],
  },
  {
    name: "full research admin control",
    file: "server/src/routes/research.js",
    tests: [/\/studies\/:id/, /\/events/, /research_events/],
  },
  {
    name: "research admin UI editor",
    file: "client/src/pages/Admin.jsx",
    tests: [/Create\/edit educational study|ساخت\/ویرایش مطالعه آموزشی/, /\/research\/events/, /consent_required/],
  },
  {
    name: "Dr Tutor per-context admin UI",
    file: "client/src/pages/Admin.jsx",
    tests: [/Global Dr Tutor control|کنترل کلی دکتر راهنما/, /\/tutor\/context-settings/, /Context-specific tutor prompt|راهنمای اختصاصی/],
  },
  {
    name: "External AdSense admin UI",
    file: "client/src/pages/Admin.jsx",
    tests: [/AdSense \/ external ads settings|تنظیمات AdSense \/ تبلیغات خارجی/, /Enable external ads|فعال‌سازی تبلیغات خارجی/, /\/ads\/external-config/],
  },
  {
    name: "advanced public SEO schema",
    file: "server/src/lib/seo.js",
    tests: [/FAQPage/, /BreadcrumbList/, /OfferCatalog/, /hreflang/, /Course Store/],
  },
  {
    name: "store and certificate public SEO routes",
    file: "server/src/lib/seo.js",
    tests: [/store:\s*\{[^}]*Course store/s, /verify:\s*\{[^}]*Certificate verification/s, /"\/store":\s*"store"/, /"\/verify":\s*"verify"/],
  },
  {
    name: "landing accessibility skip link and main landmark",
    file: "client/src/pages/Landing.jsx",
    tests: [/skip-link/, /main-content/, /landing-hero-title/, /aria-labelledby="landing-hero-title"/],
  },
  {
    name: "drawing flashcard type with mobile canvas and rubric",
    file: "client/src/components/ExamOtherType.jsx",
    tests: [/card\.type === "drawing"/, /DrawingQuestion/, /drawing-canvas/, /rubricChecked/, /touch-action|pointer/i],
  },
  {
    name: "admin authoring for drawing flashcards",
    file: "client/src/pages/Admin.jsx",
    tests: [/نقاشی \/ رسم بافت|Drawing prompt/, /setDrawing/, /rubric_fa/, /referenceImageUrl/],
  },
  {
    name: "stepwise scaffolded flashcard type",
    file: "client/src/components/ExamOtherType.jsx",
    tests: [/card\.type === "stepwise"/, /StepwiseQuestion/, /stepResults/, /pointsFrac/],
  },
  {
    name: "admin authoring for stepwise questions",
    file: "client/src/pages/Admin.jsx",
    tests: [/مرحله‌به‌مرحله|Stepwise/, /setStep/, /accept_fa/, /explanation_fa/],
  },
  {
    name: "teacher live classroom competition board",
    file: "server/src/routes/classes.js",
    tests: [/\/live-board/, /live_board_enabled/, /live_board_anonymous/, /class_flashcard_attempts/],
  },
  {
    name: "admin UI for live classroom board",
    file: "client/src/pages/Admin.jsx",
    tests: [/ClassLiveBoard/, /\/classes\/\$\{classId\}\/live-board/, /صفحه زنده رقابت کلاس|Live classroom board/],
  },
  {
    name: "responsive containment and mobile tap-target polish",
    file: "client/src/styles-speed-fixes.css",
    tests: [/Responsive containment audit fixes/, /Final mobile tap-target pass/, /overflow-x:hidden/, /min-width:34px!important/],
  },
  {
    name: "automated responsive panels audit",
    file: "e2e/tests/responsive-panels-audit.spec.js",
    tests: [/responsive framing audit/, /overflowX/, /adminVisited/, /mobile/, /desktop/],
  },
  {
    name: "duplicate student number prevention",
    file: "server/src/routes/admin.js",
    tests: [/student_no_exists/, /studentNoConflict/, /duplicateStudentPayload/, /university_required/],
  },
  {
    name: "university tenant isolation for classes",
    file: "server/src/routes/classes.js",
    tests: [/currentUniversityId/, /wrong_university/, /members\/resolve/, /createMissing/, /COALESCE\(university_id,1\)/],
  },
  {
    name: "university tenant isolation for exams",
    file: "server/src/routes/exams.js",
    tests: [/currentUniversityId/, /participants\/resolve/, /filterContentForUniversity/, /wrong_university/, /createMissing/],
  },
  {
    name: "university tenant isolation for content bank",
    file: "server/src/routes/content.js",
    tests: [/tenantFilterFor/, /canManageUniResource/, /wrong_university/, /university_id/],
  },
  {
    name: "bulk enrollment UI with missing-student creation",
    file: "client/src/pages/Admin.jsx",
    tests: [/MemberManageModal/, /members\/resolve/, /Create missing|ساخت missingها/, /participants.*createMissing|createMissing/],
  },
  {
    name: "enhanced drawing tools",
    file: "client/src/components/ExamOtherType.jsx",
    tests: [/tool === "eraser"/, /highlighter/, /redoStack/, /Redo|بازگشت دوباره/, /destination-out/],
  },
  {
    name: "drawing teacher approval workflow backend",
    file: "server/src/routes/exams.js",
    tests: [/drawing-reviews/, /approval/, /approved/, /rejected/, /transcript_json/],
  },
  {
    name: "class drawing teacher approval workflow backend",
    file: "server/src/routes/classes.js",
    tests: [/drawing-reviews/, /approval/, /approved/, /rejected/, /answers_json/],
  },
  {
    name: "drawing review UI for teachers",
    file: "client/src/pages/Admin.jsx",
    tests: [/DrawingReviewsModal/, /Review drawings|بررسی تصاویر/, /Approve & score|تأیید و ثبت نمره/, /Reject|رد نقاشی/],
  },
  {
    name: "question taxonomy family and answer interaction",
    file: "client/src/pages/Admin.jsx",
    tests: [/نوع پاسخ این مرحله|Step answer type/, /answerType/, /accept_fa/, /HotspotEditor/],
  },
  {
    name: "hints available for all non-MCQ question types",
    file: "client/src/components/ExamOtherType.jsx",
    tests: [/LocalHints/, /showHints/, /hints=\{hints\}|hints/, /Show hint|نمایش هینت/],
  },
  {
    name: "live leaderboard student answer drilldown backend",
    file: "server/src/routes/classes.js",
    tests: [/live-board\/:userId\/details/, /answers_json/, /transcript_json/, /attempts:/],
  },
  {
    name: "live leaderboard clickable student answer drilldown UI",
    file: "client/src/pages/Admin.jsx",
    tests: [/LiveStudentDetail/, /classes\/\$\{classId\}\/live-board\/\$\{row\.user_id\}\/details/, /live-answer-drawing/, /click a student name|روی نام دانشجو/],
  },
  {
    name: "tenant and live-board performance indexes",
    file: "server/src/db.js",
    tests: [/idx_users_uni_role_no/, /idx_classes_uni_active/, /idx_exams_uni_active/, /idx_cases_uni_active/, /idx_flashcards_uni_active/, /idx_class_flash_attempts_live/, /idx_attempts_class_live/, /idx_attempts_exam_live/, /PRAGMA optimize/],
  },
  {
    name: "defense-in-depth unique student number index",
    file: "server/src/db.js",
    tests: [/idx_users_student_no_unique/, /dupStudentNo/, /best-effort duplicate hardening/],
  },
  {
    name: "tenant and enrollment regression tests",
    file: "server/test/api.test.js",
    tests: [/university tenancy, duplicate student numbers, and live board details/, /blocks duplicate student_no/, /class bulk member resolve/, /exam participant import/, /live board student details endpoint/],
  },
  {
    name: "competitive path smart resume auto-scroll",
    file: "client/src/pages/learn/LearnPath.jsx",
    tests: [/autoScrolledRef/, /Smart resume/, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/, /__current__/],
  },
  {
    name: "official past-exam import preview and commit API",
    file: "server/src/routes/admin.js",
    tests: [/official-question-import\/preview/, /official-question-import\/commit/, /officialImportPlan/, /officialFingerprint/, /premium_duplicate/, /competitive_path/],
  },
  {
    name: "official question import UI and dry-run workflow",
    file: "client/src/pages/admin/PathManager.jsx",
    tests: [/OfficialQuestionImportModal/, /Dry-run \/ پیش‌نمایش/, /maxPerLesson/, /overflowToPremium/, /official-question-import\/preview/, /official-question-import\/commit/],
  },
  {
    name: "admin bilingual tombstones so FA/EN deletes survive reimport",
    file: "server/src/lib/adminbilingual.js",
    tests: [/fillPair/, /tombstoneNode/, /cardIsTombstoned/, /admin_deleted/],
  },
  {
    name: "admin path edits survive official reimport",
    file: "server/src/routes/admin.js",
    tests: [/Include inactive rows/, /nodeIsTombstoned\(topic, title_fa, title_en\)/, /Never tombstone the node id/],
  },
  {
    name: "mobile learner thumb-zone tab bar",
    file: "client/src/pages/learn/LearnApp.jsx",
    tests: [/learn-tabbar/, /navMore/, /moreOpen/, /is-immersive-lesson/, /navTabHome/, /tab-badge/],
  },
  {
    name: "immersive mobile lesson and thumb-zone CSS",
    file: "client/src/mobile-learn.css",
    tests: [/is-immersive-lesson/, /kb-open/, /home-quick/, /opt-letter/, /100dvh/],
  },
  {
    name: "document scroll unlock (signup overlay was the only scroller)",
    file: "client/src/scroll-unlock.css",
    tests: [/overflow-y:\s*scroll\s*!important/, /overflow:\s*visible\s*!important/, /html\.overlay-open/, /login-modal-overlay/],
  },
  {
    name: "booklet option letters follow UI language",
    file: "client/src/lib/optionLetter.js",
    tests: [/الف/, /optionLetter/, /\"A\"/, /\"ب\"/],
  },
  {
    name: "class teaching analytics API",
    file: "server/src/routes/classes.js",
    tests: [/classAnalyticsPayload/, /\/analytics/, /strengths/, /weaknesses/, /supportNeeded/, /itemWeaknesses/],
  },
  {
    name: "exam teaching analytics API",
    file: "server/src/routes/exams.js",
    tests: [/examAnalyticsPayload/, /\/analytics/, /strengths/, /weaknesses/, /supportNeeded/, /itemWeaknesses/],
  },
  {
    name: "VP client fetch timeout and named path stage on network errors",
    file: "client/src/api.js",
    tests: [/timeoutMs/, /AbortController/, /stage: opts.stage/, /error: timeout \? "timeout" : "network"/],
  },
  {
    name: "VP exam spoken-history filter and consent-from-denial",
    file: "client/src/pages/Exam.jsx",
    tests: [/spokenHistory/, /consentFromDenial/, /timeoutMs: 180_000/, /boot.status === "consent"/],
  },
  {
    name: "teacher analytics UI for class and exam",
    file: "client/src/pages/Admin.jsx",
    tests: [/TeachingAnalyticsPanel/, /تحلیل آموزشی برای تصمیم‌گیری استاد|Teaching analytics/, /Topic weaknesses|نقاط ضعف موضوعی/, /At-risk learners|دانشجویان در معرض خطر/],
  },
  {
    name: "classroom live-board ETag 304",
    file: "server/src/routes/classes.js",
    tests: [/sendPrivateJson/, /JOIN cases c ON c.id = cc.case_id WHERE cc.class_id=\? AND c.active=1/],
  },
  {
    name: "exam competition leaderboard ETag and JOIN",
    file: "server/src/routes/exams.js",
    tests: [/sendPrivateJson/, /LEFT JOIN attempts a ON a.exam_id = p.exam_id AND a.user_id = p.user_id/, /GROUP BY u.id/],
  },
  {
    name: "live board VirtualList and hidden-tab skip",
    file: "client/src/pages/Admin.jsx",
    tests: [/ClassLiveBoard/, /VirtualList/, /document.hidden/, /revalidate: true/],
  },
  {
    name: "opt-in API 304 revalidate",
    file: "client/src/api.js",
    tests: [/opts.revalidate/, /If-None-Match/, /res.status === 304/],
  },
  {
    name: "exam flashcard ids query (not full bank)",
    file: "client/src/pages/Flashcards.jsx",
    tests: [/flashcards\?ids=/, /card.options \|\| \[\]/],
  },
  {
    name: "VP nested lesson + extra rubric rows + paraclinic workup",
    file: "server/src/lib/ai-engine.js",
    tests: [/function lessonTextFrom/, /extra commentary rows from free models/, /session\.paraclinic/, /paraclinicResults/],
  },
  {
    name: "VP ECG accepted from imaging or paraclinic catalog",
    file: "server/src/routes/exam.js",
    tests: [/kindN !== "lab" && \(catalogContainsQuery\(imaging, q\) \|\| catalogContainsQuery\(paraclinic, q\)\)/],
  },
  {
    name: "VP client retries evaluation_in_progress and records paraclinic orders",
    file: "client/src/pages/Exam.jsx",
    tests: [/evaluation_in_progress/, /postEval/, /paraclinic: snap\.paraclinic/, /retryableEval/, /mergeOrderCatalog/],
  },
  {
    name: "VP student session-to-evaluate regression",
    file: "server/test/vp-stages-99.test.js",
    tests: [/opens a session, replies as the patient/, /stores AI score \+ lesson/, /session_id_required/],
  },
];
for (const check of featureChecks) {
  const body = readEntry(check.file);
  if (!body) {
    errors.push(`Feature audit failed (${check.name}): missing ${check.file}`);
    continue;
  }
  for (const rx of check.tests) {
    if (!rx.test(body)) {
      errors.push(`Feature audit failed (${check.name}): marker ${rx} not found in ${check.file}`);
    }
  }
}

const sizeMb = statSync(zipPath).size / 1024 / 1024;
if (errors.length) {
  console.error(`❌ Release ZIP check failed for ${path.basename(zipPath)} (${sizeMb.toFixed(1)} MB):`);
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log(`✅ Release ZIP check passed: ${path.basename(zipPath)} (${sizeMb.toFixed(1)} MB, ${entries.length} files)`);
console.log("Required root files are present; node_modules and runtime database/data folders are absent.");
console.log(`Feature audit passed: ${featureChecks.length} key product/security/performance markers are present.`);
