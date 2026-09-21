import { useState, useEffect } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import { Spinner } from "../components/UI.jsx";
import { fmtDateLong } from "../utils/date.js";

/* Public medical-education blog: list + single post. Reachable at /blog and
   /blog/:slug without login (for SEO traffic). Uses window.history so direct
   links work and the URL updates as the reader navigates. */

const CAT_LABEL = {
  general: { fa: "عمومی", en: "General" },
  cardiology: { fa: "قلب", en: "Cardiology" },
  internal: { fa: "داخلی", en: "Internal medicine" },
  surgery: { fa: "جراحی", en: "Surgery" },
  pediatrics: { fa: "اطفال", en: "Pediatrics" },
  emergency: { fa: "اورژانس", en: "Emergency" },
  "study-skills": { fa: "مهارت مطالعه", en: "Study skills" },
  "exam-prep": { fa: "آمادگی آزمون", en: "Exam prep" },
};
const UNIVERSITY_ARTICLE_SLUGS = new Set(["virtual-patient-osce-medical-education","hint-based-questions-scaffolded-learning"]);

export default function Blog({ slug, onHome, onGetStarted, onSignIn }) {
  const { lang } = useApp();
  const fa = lang !== "en";
  const [current, setCurrent] = useState(slug || null);

  const goPost = (s) => {
    setCurrent(s);
    window.history.pushState({}, "", `/blog/${s}`);
    window.scrollTo(0, 0);
  };
  const goList = () => {
    setCurrent(null);
    window.history.pushState({}, "", "/blog");
    window.scrollTo(0, 0);
  };

  // support browser back/forward
  useEffect(() => {
    const onPop = () => {
      const m = /^\/blog\/([^/?]+)/.exec(window.location.pathname);
      setCurrent(m ? decodeURIComponent(m[1]) : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div className="blog-wrap">
      <header className="blog-top">
        <button className="blog-brand" onClick={onHome}>
          <span className="lp-logo"><Icon name="cap" size={22} /></span>
          <span className="lp-brand-name">MED School</span>
        </button>
        <div className="blog-top-actions">
          <button className="lp-btn-ghost" onClick={goList}>{fa ? "همهٔ مقالات" : "All articles"}</button>
          <button className="lp-btn-primary" onClick={onGetStarted}>{fa ? "شروع رایگان" : "Start free"}</button>
        </div>
      </header>
      {current ? <BlogPost slug={current} onBack={goList} onOpen={goPost} onGetStarted={onGetStarted} onSignIn={onSignIn} />
               : <BlogList onOpen={goPost} />}
      <footer className="blog-foot">
        <div className="blog-disclaimer">
          {fa
            ? "⚕️ سلب مسئولیت: مطالب این وبلاگ صرفاً برای آموزش پزشکی است و جایگزین مشاورهٔ بالینی حرفه‌ای نیست."
            : "⚕️ Disclaimer: content here is for medical education only and is not a substitute for professional clinical advice."}
        </div>
      </footer>
    </div>
  );
}

function catLabel(c, fa) { return (CAT_LABEL[c] || { fa: c, en: c })[fa ? "fa" : "en"]; }

function BlogList({ onOpen }) {
  const { lang } = useApp();
  const fa = lang !== "en";
  const [d, setD] = useState(null);
  const [cat, setCat] = useState("");
  useEffect(() => {
    let alive = true;
    setD(null);
    api.get(`/site-content/blog?lang=${fa ? "fa" : "en"}${cat ? `&category=${cat}` : ""}`)
      .then((r) => { if (alive) setD(r); }).catch(() => { if (alive) setD({ posts: [], categories: [] }); });
    return () => { alive = false; };
  }, [cat, fa]);
  if (!d) return <div className="blog-body"><Spinner /></div>;

  const featured = d.posts.find((p) => p.featured);
  const rest = d.posts.filter((p) => p !== featured);

  return (
    <div className="blog-body">
      <div className="blog-hero">
        <h1>{fa ? "وبلاگ و مقالات پزشکی" : "Medical education blog"}</h1>
        <p>{fa ? "مقالات آموزشی دربارهٔ تشخیص، درمان و آمادگی آزمون — نوشته و بازبینی‌شده توسط پزشکان." : "Educational articles on diagnosis, treatment and exam prep — written and reviewed by physicians."}</p>
      </div>

      {(d.categories || []).length > 0 && (
        <div className="blog-cats">
          <button className={`blog-cat ${!cat ? "on" : ""}`} onClick={() => setCat("")}>{fa ? "همه" : "All"}</button>
          {d.categories.map((c) => (
            <button key={c} className={`blog-cat ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{catLabel(c, fa)}</button>
          ))}
        </div>
      )}

      {d.posts.length === 0 && <div className="blog-empty">{fa ? "هنوز مقاله‌ای منتشر نشده است." : "No articles published yet."}</div>}

      {featured && !cat && (
        <button className="blog-card blog-card-featured" onClick={() => onOpen(featured.slug)}>
          <div className="blog-card-badge">⭐ {fa ? "ویژه" : "Featured"}</div>
          <div className="blog-card-cat">{catLabel(featured.category, fa)}</div>
          <h2>{featured.title}</h2>
          <p>{featured.excerpt}</p>
          <PostMeta p={featured} fa={fa} />
        </button>
      )}

      <div className="blog-grid">
        {rest.map((p) => (
          <button key={p.slug} className="blog-card" onClick={() => onOpen(p.slug)}>
            <div className="blog-card-cat">{catLabel(p.category, fa)}</div>
            <h3>{p.title}</h3>
            <p>{p.excerpt}</p>
            <PostMeta p={p} fa={fa} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PostMeta({ p, fa }) {
  return (
    <div className="blog-meta">
      {p.reviewed && <span className="blog-reviewed">✓ {fa ? "بازبینی پزشکی" : "Medically reviewed"}</span>}
      {p.author && <span className="blog-author">{p.author}{p.credentials ? `، ${p.credentials}` : ""}</span>}
      <span className="blog-rt">🕒 {p.reading_time} {fa ? "دقیقه" : "min"}</span>
    </div>
  );
}

function BlogPost({ slug, onBack, onOpen, onGetStarted, onSignIn }) {
  const { lang } = useApp();
  const fa = lang !== "en";
  const [p, setP] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    setP(null); setErr(false);
    api.get(`/site-content/blog/${encodeURIComponent(slug)}?lang=${fa ? "fa" : "en"}`)
      .then((r) => { if (alive) { setP(r); document.title = r.title + " | MED School"; } })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [slug, fa]);

  if (err) return <div className="blog-body"><div className="blog-empty">{fa ? "مقاله یافت نشد." : "Article not found."} <button className="lp-btn-ghost" onClick={onBack}>{fa ? "بازگشت" : "Back"}</button></div></div>;
  if (!p) return <div className="blog-body"><Spinner /></div>;

  return (
    <article className="blog-article">
      <button className="blog-back" onClick={onBack}>← {fa ? "همهٔ مقالات" : "All articles"}</button>
      <div className="blog-card-cat">{catLabel(p.category, fa)}</div>
      <h1>{p.title}</h1>
      <div className="blog-article-meta">
        {p.author && <span className="blog-author">{p.author}{p.credentials ? `، ${p.credentials}` : ""}</span>}
        {p.reviewed && <span className="blog-reviewed">✓ {fa ? "بازبینی پزشکی" : "Medically reviewed"}</span>}
        <span className="blog-rt">🕒 {p.reading_time} {fa ? "دقیقه مطالعه" : "min read"}</span>
        {p.published_at && <span className="blog-date">{fmtDateLong(p.published_at, fa ? "fa" : "en")}</span>}
      </div>

      {p.toc && p.toc.length > 1 && (
        <nav className="blog-toc">
          <div className="blog-toc-title">{fa ? "فهرست مطالب" : "Contents"}</div>
          <ul>
            {p.toc.map((h) => (
              <li key={h.id} className={h.level === 3 ? "sub" : ""}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="blog-content" dangerouslySetInnerHTML={{ __html: p.body_html }} />

      {p.related && p.related.length > 0 && (
        <div className="blog-related">
          <h3>{fa ? "مقالات مرتبط" : "Related articles"}</h3>
          <div className="blog-grid">
            {p.related.map((r) => (
              <button key={r.slug} className="blog-card" onClick={() => onOpen(r.slug)}>
                <div className="blog-card-cat">{catLabel(r.category, fa)}</div>
                <h3>{r.title}</h3>
                <p>{r.excerpt}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="blog-cta">
        {UNIVERSITY_ARTICLE_SLUGS.has(slug) ? <><h3>{fa ? "برای استفاده از امکانات دانشگاهی وارد شوید" : "Sign in to use the university features"}</h3><p>{fa ? "این مقاله‌ها مربوط به اکانت‌های دانشگاهی هستند؛ حساب دانشجو توسط استاد یا ادمین ساخته می‌شود." : "These articles are for university accounts; student accounts are created by faculty or admins."}</p><button className="lp-btn-primary lp-btn-lg" onClick={onSignIn || onGetStarted}>{fa ? "ورود" : "Sign in"}</button></> : <><h3>{fa ? "آمادهٔ یادگیری عملی هستی؟" : "Ready to practice?"}</h3><p>{fa ? "با بیمار مجازی و فلش‌کارت هوشمند، دانشت را به مهارت تبدیل کن." : "Turn knowledge into skill with virtual patients and smart flashcards."}</p><button className="lp-btn-primary lp-btn-lg" onClick={onGetStarted}>{fa ? "شروع رایگان" : "Start free"}</button></>}
      </div>
    </article>
  );
}
