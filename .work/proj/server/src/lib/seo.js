/* seo.js — Native SEO engine (the useful parts of Yoast / RankMath, built in).

   AI-FREE, deterministic. Gives a React single-page app what it otherwise
   lacks: real, crawlable HTML meta tags + structured data for search engines
   and social bots (Google, Telegram, WhatsApp, Twitter/X, LinkedIn), plus a
   sitemap and robots.txt.

   What it provides (equivalent WordPress plugin in brackets):
     • Editable site meta: title template, description, keywords   [Yoast/RankMath]
     • Per-route meta overrides (home, features, pricing, blog...)  [RankMath]
     • Open Graph + Twitter Card tags (rich social previews)        [Yoast]
     • JSON-LD structured data: Organization, WebSite+SearchAction,
       Course, FAQPage, MedicalWebPage/EducationalOrganization      [RankMath Schema]
     • Server-side injection into index.html for bots               [core SEO fix]
     • sitemap.xml + robots.txt generation                          [Yoast/RankMath]
     • noindex master switch (e.g. staging)                         [Yoast]

   Config is stored in the settings table under `seo` and merged over defaults,
   so the admin can edit everything from the panel. */
import { db } from "../db.js";
import { persistNow } from "../db.js";

const SITE_URL_DEFAULT = "https://medschool.ir";

export const DEFAULT_SEO = {
  enabled: true,
  site_url: SITE_URL_DEFAULT,
  site_name: "MED School",
  // {title} placeholder = per-page title; %s style kept simple.
  title_template_fa: "%title% | MED School — آموزش هوشمند پزشکی",
  title_template_en: "%title% | MED School — Smart Medical Education",
  default_title_fa: "MED School — آموزش هوشمند پزشکی",
  default_title_en: "MED School — Smart Medical Education",
  description_fa:
    "بستر حرفه‌ای آموزش و ارزیابی پزشکی: بیمار مجازی، فلش‌کارت هوشمند با مرور فاصله‌دار، و مسیر رقابتی پره‌انترنی و دستیاری.",
  description_en:
    "A professional platform for medical education & assessment: virtual patients, smart spaced-repetition flashcards, and a competitive pre-internship & residency path.",
  keywords_fa: "آموزش پزشکی, پره‌انترنی, بیمار مجازی, فلش‌کارت, مرور فاصله‌دار, آزمون OSCE",
  keywords_en: "medical education, pre-internship, virtual patient, flashcards, spaced repetition, OSCE",
  og_image: "/icon-512.png",     // social share image (absolute-ized at render)
  twitter_handle: "@medschool",
  organization_type: "EducationalOrganization",
  noindex: false,                // master switch: true => tell bots not to index
  // Per-route overrides. Keys are client route names; only fa/en title+desc.
  routes: {
    home:     { title_fa: "خانه", title_en: "Home" },
    features: { title_fa: "امکانات", title_en: "Features" },
    pricing:  { title_fa: "تعرفه‌ها", title_en: "Pricing" },
    blog:     { title_fa: "وبلاگ و مقالات پزشکی", title_en: "Medical blog",
                description_fa: "مقالات آموزشی پزشکی: تشخیص، درمان و آمادگی آزمون — نوشته و بازبینی‌شده توسط پزشکان.",
                description_en: "Medical education articles: diagnosis, treatment and exam prep — written and reviewed by physicians." },
    store:    { title_fa: "فروشگاه دوره‌ها", title_en: "Course store",
                description_fa: "فروشگاه دوره‌ها و بسته‌های آموزشی MED School برای آمادگی آزمون‌های پزشکی، فلش‌کارت و مسیرهای یادگیری.",
                description_en: "MED School course store: medical exam preparation packages, flashcards, and learning paths." },
    verify:   { title_fa: "اعتبارسنجی گواهی", title_en: "Certificate verification",
                description_fa: "اعتبارسنجی گواهی‌های آموزشی MED School.",
                description_en: "Verify MED School educational certificates." },
    login:    { title_fa: "ورود", title_en: "Sign in", noindex: true },
    signup:   { title_fa: "ثبت‌نام", title_en: "Sign up" },
  },
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k]) && typeof base?.[k] === "object") {
      out[k] = deepMerge(base[k], over[k]);
    } else out[k] = over[k];
  }
  return out;
}

export function getSeoConfig() {
  const row = db.prepare("SELECT value FROM settings WHERE key='seo'").get();
  if (!row) return DEFAULT_SEO;
  try { return deepMerge(DEFAULT_SEO, JSON.parse(row.value)); }
  catch { return DEFAULT_SEO; }
}

export function saveSeoConfig(cfg) {
  const merged = deepMerge(DEFAULT_SEO, cfg || {});
  db.prepare("INSERT INTO settings (key,value) VALUES ('seo',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(JSON.stringify(merged));
  persistNow();
  return merged;
}

/* ------------------------------------------------------------------ helpers */
/* JSON that is embedded inside a <script> block must never contain a literal
   "</script" (or "<!--"): the HTML parser closes the block before the JS
   parser ever runs, so a request path such as
   /blog/</script><script>alert(1)</script> — which ends up in the
   BreadcrumbList name — turned into markup. JSON stays valid when "<", ">",
   "&" and the line separators are written as \uXXXX escapes. */
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function absUrl(cfg, pathOrUrl) {
  if (!pathOrUrl) return cfg.site_url;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = String(cfg.site_url || SITE_URL_DEFAULT).replace(/\/+$/, "");
  return base + (pathOrUrl.startsWith("/") ? pathOrUrl : "/" + pathOrUrl);
}
function applyTemplate(tpl, title) {
  if (!tpl) return title;
  return tpl.replace(/%title%/g, title).replace(/%s/g, title);
}

/* Resolve the meta for a given route + language into a flat object. */
export function metaForRoute(routeName = "home", lang = "fa", reqPath = "/") {
  const cfg = getSeoConfig();
  const isFa = lang !== "en";
  const route = (cfg.routes && cfg.routes[routeName]) || {};
  const pageTitle = isFa ? (route.title_fa || "") : (route.title_en || "");
  const tpl = isFa ? cfg.title_template_fa : cfg.title_template_en;
  const title = pageTitle
    ? applyTemplate(tpl, pageTitle)
    : (isFa ? cfg.default_title_fa : cfg.default_title_en);
  const description = (isFa ? (route.description_fa) : (route.description_en))
    || (isFa ? cfg.description_fa : cfg.description_en);
  const keywords = isFa ? cfg.keywords_fa : cfg.keywords_en;
  const noindex = !!(cfg.noindex || route.noindex);
  return {
    enabled: cfg.enabled !== false,
    lang: isFa ? "fa" : "en",
    dir: isFa ? "rtl" : "ltr",
    title, description, keywords, noindex,
    canonical: absUrl(cfg, reqPath),
    site_name: cfg.site_name,
    og_image: absUrl(cfg, cfg.og_image),
    twitter_handle: cfg.twitter_handle,
    site_url: cfg.site_url,
  };
}

/* JSON-LD structured data graph for the site.
   Kept deterministic and lightweight: no network calls, no plugin dependency. */
function breadcrumbJsonLd(cfg, reqPath = "/", lang = "fa") {
  const isFa = lang !== "en";
  const base = String(cfg.site_url || SITE_URL_DEFAULT).replace(/\/+$/, "");
  const cleanPath = String(reqPath || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const parts = cleanPath === "/" ? [] : cleanPath.split("/").filter(Boolean);
  const itemListElement = [{
    "@type": "ListItem", position: 1,
    name: isFa ? "خانه" : "Home", item: base + "/",
  }];
  let acc = "";
  parts.forEach((part, i) => {
    acc += "/" + part;
    const labelMap = {
      blog: isFa ? "وبلاگ" : "Blog",
      store: isFa ? "فروشگاه" : "Store",
      verify: isFa ? "اعتبارسنجی" : "Verification",
      login: isFa ? "ورود" : "Sign in",
      signup: isFa ? "ثبت‌نام" : "Sign up",
    };
    itemListElement.push({
      "@type": "ListItem",
      position: i + 2,
      name: labelMap[part] || decodeURIComponent(part).replace(/-/g, " "),
      item: base + acc,
    });
  });
  return { "@type": "BreadcrumbList", "@id": base + cleanPath + "#breadcrumb", itemListElement };
}

export function buildJsonLd(lang = "fa", routeName = "home", reqPath = "/") {
  const cfg = getSeoConfig();
  const isFa = lang !== "en";
  const url = String(cfg.site_url || SITE_URL_DEFAULT).replace(/\/+$/, "");
  const canonical = absUrl(cfg, reqPath);
  const org = {
    "@type": cfg.organization_type || "EducationalOrganization",
    "@id": url + "/#org",
    name: cfg.site_name,
    url,
    logo: absUrl(cfg, cfg.og_image),
    description: isFa ? cfg.description_fa : cfg.description_en,
    sameAs: [url],
  };
  const website = {
    "@type": "WebSite",
    "@id": url + "/#website",
    url,
    name: cfg.site_name,
    inLanguage: isFa ? "fa-IR" : "en-US",
    publisher: { "@id": url + "/#org" },
    potentialAction: {
      "@type": "SearchAction",
      target: url + "/blog?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };
  const course = {
    "@type": "Course",
    "@id": url + "/#medical-course",
    name: isFa ? "آموزش هوشمند پزشکی MED School" : "MED School Smart Medical Education",
    description: isFa ? cfg.description_fa : cfg.description_en,
    provider: { "@id": url + "/#org" },
    url,
    inLanguage: isFa ? "fa-IR" : "en-US",
    educationalLevel: isFa ? "دانشجوی پزشکی و آمادگی آزمون" : "Medical students and exam preparation",
  };
  const faq = {
    "@type": "FAQPage",
    "@id": canonical + "#faq",
    mainEntity: [
      {
        "@type": "Question",
        name: isFa ? "MED School برای چه کسانی مناسب است؟" : "Who is MED School for?",
        acceptedAnswer: { "@type": "Answer", text: isFa ? "برای دانشجویان پزشکی، استادان، کلاس‌های دانشگاهی و کاربران مسیر رقابتی آمادگی آزمون طراحی شده است." : "It is designed for medical students, teachers, university classes, and competitive exam-preparation learners." },
      },
      {
        "@type": "Question",
        name: isFa ? "آیا بخش‌های حساس مثل تبلیغات و Dr Tutor قابل کنترل هستند؟" : "Are sensitive features like ads and Dr Tutor admin-controlled?",
        acceptedAnswer: { "@type": "Answer", text: isFa ? "بله؛ قابلیت‌های حساس پیش‌فرض خاموش یا محدود هستند و از پنل ادمین کنترل می‌شوند." : "Yes. Sensitive features are off or limited by default and controlled from the admin panel." },
      },
    ],
  };
  const graph = [org, website, course, breadcrumbJsonLd(cfg, reqPath, lang)];
  if (routeName === "home") graph.push(faq);
  if (routeName === "store") {
    graph.push({
      "@type": "Store",
      "@id": url + "/store#store",
      name: isFa ? "فروشگاه دوره‌های MED School" : "MED School Course Store",
      url: url + "/store",
      parentOrganization: { "@id": url + "/#org" },
      description: isFa ? "فروشگاه بسته‌ها و دوره‌های آموزشی پزشکی." : "Storefront for medical education courses and packages.",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: isFa ? "دوره‌ها و بسته‌های آموزشی" : "Courses and learning packages",
        itemListElement: [
          { "@type": "Offer", itemOffered: { "@type": "Course", name: isFa ? "مسیر رقابتی آمادگی آزمون" : "Competitive exam preparation path" } },
          { "@type": "Offer", itemOffered: { "@type": "Course", name: isFa ? "فلش‌کارت و مرور فاصله‌دار" : "Flashcards and spaced repetition" } },
        ],
      },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/* Render the full <head> meta block (string) for injection into index.html. */
export function renderMetaTags(routeName = "home", lang = "fa", reqPath = "/") {
  const m = metaForRoute(routeName, lang, reqPath);
  if (!m.enabled) return "";
  const jsonld = jsonForScript(buildJsonLd(lang, routeName, reqPath));
  const robots = m.noindex ? "noindex, nofollow" : "index, follow";
  return [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<meta name="keywords" content="${esc(m.keywords)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${esc(m.canonical)}" />`,
    `<link rel="alternate" hreflang="fa-IR" href="${esc(absUrl({ site_url: m.site_url }, reqPath) + "?lang=fa")}" />`,
    `<link rel="alternate" hreflang="en-US" href="${esc(absUrl({ site_url: m.site_url }, reqPath) + "?lang=en")}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(m.canonical)}" />`,
    // Open Graph (Facebook, Telegram, WhatsApp, LinkedIn)
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(m.site_name)}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(m.canonical)}" />`,
    `<meta property="og:image" content="${esc(m.og_image)}" />`,
    `<meta property="og:locale" content="${m.lang === "fa" ? "fa_IR" : "en_US"}" />`,
    // Twitter / X card
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${esc(m.og_image)}" />`,
    m.twitter_handle ? `<meta name="twitter:site" content="${esc(m.twitter_handle)}" />` : "",
    // Structured data
    `<script type="application/ld+json">${jsonld}</script>`,
  ].filter(Boolean).join("\n    ");
}

/* Render crawlable meta for a single blog post (title/desc/OG/Article JSON-LD).
   Returns "" if the slug isn't a published post (caller falls back to default). */
export function renderBlogPostMeta(slug, lang = "fa", reqPath = "/") {
  const cfg = getSeoConfig();
  if (cfg.enabled === false) return "";
  const r = db.prepare("SELECT * FROM blog_posts WHERE slug=? AND published=1").get(slug);
  if (!r) return "";
  const isFa = lang !== "en";
  // Prefer the post's dedicated SEO meta fields; fall back to title/excerpt.
  const metaTitle = (isFa ? r.meta_title_fa : r.meta_title_en) || "";
  const title = metaTitle || (isFa ? r.title_fa : r.title_en) || r.title_fa || r.title_en || "";
  const metaDesc = (isFa ? r.meta_desc_fa : r.meta_desc_en) || "";
  const desc = metaDesc || (isFa ? r.excerpt_fa : r.excerpt_en) || r.excerpt_fa || r.excerpt_en || (isFa ? cfg.description_fa : cfg.description_en);
  const tpl = isFa ? cfg.title_template_fa : cfg.title_template_en;
  // if the author set an explicit meta title, use it verbatim; else apply the site template
  const fullTitle = metaTitle ? metaTitle : applyTemplate(tpl, title);
  const canonical = (r.canonical && /^https?:\/\//i.test(r.canonical)) ? r.canonical : absUrl(cfg, reqPath);
  const img = r.cover ? absUrl(cfg, r.cover) : absUrl(cfg, cfg.og_image);
  const robots = cfg.noindex ? "noindex, nofollow" : "index, follow";
  let jsonld = "";
  try {
    const node = postJsonLdInternal(r, lang, cfg);
    if (node) jsonld = `<script type="application/ld+json">${jsonForScript(node)}</script>`;
  } catch (_) { /* */ }
  return [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<link rel="alternate" hreflang="fa-IR" href="${esc(absUrl(cfg, reqPath) + "?lang=fa")}" />`,
    `<link rel="alternate" hreflang="en-US" href="${esc(absUrl(cfg, reqPath) + "?lang=en")}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(canonical)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="${esc(cfg.site_name)}" />`,
    `<meta property="og:title" content="${esc(fullTitle)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:locale" content="${isFa ? "fa_IR" : "en_US"}" />`,
    r.author_name ? `<meta property="article:author" content="${esc(r.author_name)}" />` : "",
    r.published_at ? `<meta property="article:published_time" content="${esc(r.published_at)}" />` : "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(fullTitle)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    jsonld,
  ].filter(Boolean).join("\n    ");
}

/* Internal: Article+MedicalWebPage JSON-LD from a DB row (used by meta render). */
function postJsonLdInternal(r, lang, cfg) {
  const isFa = lang !== "en";
  const base = String(cfg.site_url || SITE_URL_DEFAULT).replace(/\/+$/, "");
  const node = {
    "@context": "https://schema.org",
    "@type": ["Article", "MedicalWebPage"],
    headline: (isFa ? r.title_fa : r.title_en) || r.title_fa,
    description: (isFa ? r.excerpt_fa : r.excerpt_en) || r.excerpt_fa,
    inLanguage: isFa ? "fa-IR" : "en-US",
    datePublished: r.published_at || r.created_at,
    dateModified: r.updated_at || r.published_at || r.created_at,
    mainEntityOfPage: `${base}/blog/${r.slug}`,
    url: `${base}/blog/${r.slug}`,
    publisher: { "@type": "Organization", name: cfg.site_name, url: base },
  };
  if (r.cover) node.image = /^https?:/i.test(r.cover) ? r.cover : base + r.cover;
  if (r.author_name) {
    node.author = { "@type": "Person", name: r.author_name };
    if (r.author_credentials) node.author.jobTitle = r.author_credentials;
    if (r.reviewed) node.reviewedBy = { "@type": "Person", name: r.author_name, jobTitle: r.author_credentials || undefined };
  }
  return node;
}

/* Map an incoming request path to a known client route name (best-effort). */
export function routeNameForPath(reqPath = "/") {
  const p = String(reqPath).split("?")[0].replace(/\/+$/, "") || "/";
  const map = {
    "/": "home", "/features": "features", "/pricing": "pricing",
    "/login": "login", "/signup": "signup", "/blog": "blog", "/store": "store", "/verify": "verify", "/admin": "login",
  };
  return map[p] || "home";
}

/* robots.txt (string). Honors the noindex master switch. */
export function renderRobotsTxt() {
  const cfg = getSeoConfig();
  const url = String(cfg.site_url || SITE_URL_DEFAULT).replace(/\/+$/, "");
  if (cfg.noindex) {
    return `User-agent: *\nDisallow: /\n`;
  }
  return [
    `User-agent: *`,
    `Allow: /`,
    // keep bots out of app-only / private areas
    `Disallow: /api/`,
    `Disallow: /admin`,
    `Disallow: /uploads/`,
    ``,
    `Sitemap: ${url}/sitemap.xml`,
    ``,
  ].join("\n");
}

/* sitemap.xml (string). Lists public, indexable routes + published blog posts. */
export function renderSitemapXml() {
  const cfg = getSeoConfig();
  if (cfg.noindex) {
    // still return a valid (empty) sitemap
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
  }
  const base = String(cfg.site_url || SITE_URL_DEFAULT).replace(/\/+$/, "");
  const today = new Date().toISOString().slice(0, 10);
  const routes = cfg.routes || {};
  const publicRoutes = Object.keys(routes).filter((r) => !routes[r].noindex);
  // ensure home + blog index are present
  if (!publicRoutes.includes("home")) publicRoutes.unshift("home");
  const pathFor = { home: "/", features: "/features", pricing: "/pricing", signup: "/signup", blog: "/blog", store: "/store", verify: "/verify" };
  const urls = [];
  const seen = new Set();
  const addUrl = (path, priority, lastmod) => {
    if (seen.has(path)) return;
    seen.add(path);
    urls.push(
      `  <url>\n    <loc>${esc(base + path)}</loc>\n    <lastmod>${lastmod || today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    );
  };
  for (const r of publicRoutes) addUrl(pathFor[r] || `/${r}`, r === "home" ? "1.0" : "0.7");
  // blog index + each published article (best-effort; blog is optional)
  addUrl("/blog", "0.8");
  try {
    const rows = db.prepare(
      "SELECT slug, updated_at, published_at, created_at FROM blog_posts WHERE published=1 ORDER BY id DESC"
    ).all();
    for (const p of rows) {
      const lm = (p.updated_at || p.published_at || p.created_at || today).slice(0, 10);
      addUrl(`/blog/${p.slug}`, "0.6", lm);
    }
  } catch (_) { /* blog table not available yet */ }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}
