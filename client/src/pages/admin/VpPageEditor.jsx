/* VpPageEditor.jsx — admin editor for the public /VP page (university content).
   It edits the same shape the server normalizes (server/src/lib/vp-page.js).
   Saving sends the whole config; the server normalizes it again, so this
   editor only has to keep the layout tidy. Field caps come from the server. */
import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import { useToast, Spinner } from "../../components/UI.jsx";

const ROLES = [["student", "دانشجو", "Student"], ["patient", "بیمار", "Patient"]];

// Two inputs side by side: Persian and English. `value` is { fa, en }.
function Bi({ label, value, onChange, max, multiline = false, fa }) {
  const Field = multiline ? "textarea" : "input";
  const rows = multiline ? { rows: 3 } : {};
  const set = (lang) => (e) => onChange({ ...value, [lang]: e.target.value });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
      <label className="field">
        <span>{label} ({fa ? "فارسی" : "Persian"})</span>
        <Field dir="rtl" maxLength={max} value={value.fa} onChange={set("fa")} {...rows} />
      </label>
      <label className="field">
        <span>{label} (English)</span>
        <Field dir="ltr" maxLength={max} value={value.en} onChange={set("en")} {...rows} />
      </label>
    </div>
  );
}

// Add / remove / reorder for a capped list of items.
function ListEditor({ title, items, max, onChange, blank, renderItem, fa }) {
  const update = (i, next) => onChange(items.map((x, j) => (j === i ? next : x)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong>{title}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-sm btn-ghost" disabled={items.length >= max} onClick={() => onChange([...items, blank()])}>
            {fa ? "افزودن" : "Add"}
          </button>
        </div>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "grid", gap: 10, padding: 12, borderRadius: 12, border: "1px solid var(--border, rgba(127,127,127,.25))" }}>
          {renderItem(item, (next) => update(i, next))}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-sm btn-ghost" disabled={i === 0} onClick={() => move(i, -1)}>{fa ? "بالا" : "Up"}</button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={i === items.length - 1} onClick={() => move(i, 1)}>{fa ? "پایین" : "Down"}</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(items.filter((_, j) => j !== i))}>{fa ? "حذف" : "Remove"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const blankBi = () => ({ fa: "", en: "" });

export default function VpPageEditor() {
  const { lang } = useApp();
  const toast = useToast();
  const fa = lang === "fa";
  const [loaded, setLoaded] = useState(null); // { config, defaults, limits }
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/admin/vp-page")
      .then((d) => { setLoaded(d); setCfg(d.config); })
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  if (err && !cfg) return <div className="card err-banner">{err}</div>;
  if (!cfg || !loaded) return <Spinner />;

  const L = loaded.limits;
  const set = (key) => (value) => setCfg({ ...cfg, [key]: value });

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const d = await api.put("/admin/vp-page", { config: cfg });
      setCfg(d.config);
      toast(fa ? "ذخیره شد" : "Saved");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const restoreDefaults = () => {
    if (!confirm(fa ? "متن‌ها به پیش‌فرض برگردند؟ تا ذخیره نکنید، تغییری ثبت نمی‌شود." : "Reset all text to the defaults? Nothing changes until you save.")) return;
    setCfg(loaded.defaults);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => set("enabled")(e.target.checked)} />
          <span>{fa ? "صفحه روشن باشد" : "Page is on"}</span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a className="btn btn-ghost" href="/VP" target="_blank" rel="noopener noreferrer">
            {fa ? "پیش‌نمایش (نسخهٔ ذخیره‌شده)" : "Preview (saved version)"}
          </a>
          <button type="button" className="btn btn-ghost" onClick={restoreDefaults}>{fa ? "بازگردانی پیش‌فرض" : "Restore defaults"}</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? (fa ? "در حال ذخیره…" : "Saving…") : (fa ? "ذخیره" : "Save")}</button>
        </div>
      </div>
      {err && <div className="err-banner" role="alert">{err}</div>}

      <div className="card" style={{ display: "grid", gap: 14 }}>
        <strong>{fa ? "متن اصلی" : "Hero"}</strong>
        <Bi fa={fa} label={fa ? "عنوان" : "Headline"} value={cfg.headline} max={L.title} onChange={set("headline")} />
        <Bi fa={fa} label={fa ? "توضیح" : "Subtitle"} value={cfg.subtitle} max={L.line} multiline onChange={set("subtitle")} />
        <Bi fa={fa} label={fa ? "دکمهٔ ورود" : "Sign-in button"} value={cfg.cta_login} max={L.short} onChange={set("cta_login")} />
        <Bi fa={fa} label={fa ? "دکمهٔ نمونه" : "Sample button"} value={cfg.cta_demo} max={L.short} onChange={set("cta_demo")} />
        <Bi fa={fa} label={fa ? "پیام وقتی صفحه خاموش است" : "Message when the page is off"} value={cfg.closed} max={L.line} multiline onChange={set("closed")} />
      </div>

      <ListEditor fa={fa} title={fa ? `علائم حیاتی (حداکثر ${L.vitals})` : `Vital signs (max ${L.vitals})`} items={cfg.vitals} max={L.vitals}
        onChange={set("vitals")} blank={() => ({ label: blankBi(), value: "" })}
        renderItem={(v, up) => (
          <>
            <Bi fa={fa} label={fa ? "نام" : "Label"} value={v.label} max={L.short} onChange={(label) => up({ ...v, label })} />
            <label className="field">
              <span>{fa ? "مقدار (عدد و نماد)" : "Value (numbers and symbols)"}</span>
              <input dir="ltr" maxLength={L.value} value={v.value} onChange={(e) => up({ ...v, value: e.target.value })} />
            </label>
          </>
        )} />

      <ListEditor fa={fa} title={fa ? `گفت‌وگوی نمونه (حداکثر ${L.chat} خط)` : `Sample conversation (max ${L.chat} lines)`} items={cfg.chat} max={L.chat}
        onChange={set("chat")} blank={() => ({ role: "student", text: blankBi() })}
        renderItem={(m, up) => (
          <>
            <label className="field">
              <span>{fa ? "گوینده" : "Speaker"}</span>
              <select value={m.role} onChange={(e) => up({ ...m, role: e.target.value })}>
                {ROLES.map(([v, f, e]) => <option key={v} value={v}>{fa ? f : e}</option>)}
              </select>
            </label>
            <Bi fa={fa} label={fa ? "متن" : "Text"} value={m.text} max={L.line} multiline onChange={(text) => up({ ...m, text })} />
          </>
        )} />

      <ListEditor fa={fa} title={fa ? `مراحل (حداکثر ${L.steps})` : `Steps (max ${L.steps})`} items={cfg.steps} max={L.steps}
        onChange={set("steps")} blank={() => ({ title: blankBi(), text: blankBi() })}
        renderItem={(s, up) => (
          <>
            <Bi fa={fa} label={fa ? "عنوان" : "Title"} value={s.title} max={L.short} onChange={(title) => up({ ...s, title })} />
            <Bi fa={fa} label={fa ? "توضیح" : "Text"} value={s.text} max={L.line} multiline onChange={(text) => up({ ...s, text })} />
          </>
        )} />

      <ListEditor fa={fa} title={fa ? `مهارت‌ها (حداکثر ${L.features})` : `Skills (max ${L.features})`} items={cfg.features} max={L.features}
        onChange={set("features")} blank={() => ({ title: blankBi(), text: blankBi() })}
        renderItem={(f, up) => (
          <>
            <Bi fa={fa} label={fa ? "عنوان" : "Title"} value={f.title} max={L.short} onChange={(title) => up({ ...f, title })} />
            <Bi fa={fa} label={fa ? "توضیح" : "Text"} value={f.text} max={L.line} multiline onChange={(text) => up({ ...f, text })} />
          </>
        )} />

      <ListEditor fa={fa} title={fa ? `پرسش‌های متداول (حداکثر ${L.faq})` : `FAQ (max ${L.faq})`} items={cfg.faq} max={L.faq}
        onChange={set("faq")} blank={() => ({ q: blankBi(), a: blankBi() })}
        renderItem={(f, up) => (
          <>
            <Bi fa={fa} label={fa ? "پرسش" : "Question"} value={f.q} max={L.title} onChange={(q) => up({ ...f, q })} />
            <Bi fa={fa} label={fa ? "پاسخ" : "Answer"} value={f.a} max={L.line} multiline onChange={(a) => up({ ...f, a })} />
          </>
        )} />

      <div className="card" style={{ display: "grid", gap: 14 }}>
        <strong>{fa ? "فرم ورود" : "Sign-in form"}</strong>
        <Bi fa={fa} label={fa ? "عنوان فرم" : "Form title"} value={cfg.login.title} max={L.short} onChange={(title) => set("login")({ ...cfg.login, title })} />
        <Bi fa={fa} label={fa ? "راهنما زیر عنوان" : "Help text"} value={cfg.login.help} max={L.line} multiline onChange={(help) => set("login")({ ...cfg.login, help })} />
        <Bi fa={fa} label={fa ? "متن دکمهٔ ورود" : "Button text"} value={cfg.login.submit} max={L.short} onChange={(submit) => set("login")({ ...cfg.login, submit })} />
      </div>
    </div>
  );
}
