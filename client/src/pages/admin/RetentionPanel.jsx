/* RetentionPanel.jsx — admin: how long stored chats and logs are kept (R83).

   Nothing is removed unless a period is set here or a purge is confirmed.
   Preview counts come from the server (read-only). Every change asks for
   confirmation first; a destructive step names the number of items it removes.
   Full admin only: the server enforces it; this screen mirrors it. */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import { Modal, Spinner, useToast } from "../../components/UI.jsx";

const CAT = {
  vp_chats: {
    fa: "گفت‌وگوهای بیمار مجازی", en: "Virtual-patient chats",
    noteFa: "متن گفت‌وگو و لاگ رویدادها پس از پایان و نمره‌دهی پاک می‌شود. نمره، ارزیابی و درسنامه می‌مانند. گفت‌وگوی باز، در بررسی، یا پژوهشی هرگز پاک نمی‌شود.",
    noteEn: "Chat text and event log go after the encounter is finished and graded. Grade, evaluation and lesson stay. Open, in-review and research chats are never removed.",
  },
  academic_items: {
    fa: "کلاس‌ها و آزمون‌های بایگانی‌شده (همراه نمره‌ها)", en: "Archived classes and exams (with grades)",
    noteFa: "فقط کلاس یا آزمونی که بایگانی (غیرفعال) شده و دوره‌اش گذشته. نمره‌ها، گفت‌وگوها، فهرست اعضا و فرم‌ها با آن پاک می‌شوند و بازگشتی ندارد. کلاس با آزمون فعال یا پژوهشی هرگز پاک نمی‌شود.",
    noteEn: "Only a class or exam that is archived (inactive) and past its period. Its grades, chats, roster and forms are deleted with it, for good. A class used by an active exam or linked to research is never deleted.",
  },
  tutor_chats: {
    fa: "پیام‌های مربی هوشمند", en: "AI tutor messages",
    noteFa: "پیام‌های دانشجو و پاسخ مربی هوشمند.", noteEn: "Student messages and AI tutor replies.",
  },
  security_events: {
    fa: "رویدادهای امنیتی", en: "Security events",
    noteFa: "ورود ناموفق و دسترسی‌های رد‌شده؛ شامل نشانی IP و مسیر است.", noteEn: "Failed sign-ins and refused requests; holds IP addresses and paths.",
  },
  rum_vitals: {
    fa: "سنجش کارایی صفحه", en: "Page performance samples",
    noteFa: "داده‌های پایش کارایی؛ پیش‌فرض ۴۵ روز (رفتار قبلی).", noteEn: "Performance monitoring; default 45 days (previous behaviour).",
  },
};

const REASON = {
  not_archived: ["ابتدا بایگانی کنید", "Archive it first"],
  research_linked: ["به پژوهش متصل است", "Linked to research"],
  used_by_active_exam: ["آزمون فعال از آن استفاده می‌کند", "An active exam uses it"],
  grading_in_progress: ["ارزیابی در جریان است", "Grading is in progress"],
  not_found: ["یافت نشد", "Not found"],
};

const bytes = (n, fa) => {
  const v = Number(n) || 0;
  const unit = v >= 1048576 ? ["MB", v / 1048576] : ["KB", v / 1024];
  const num = unit[1].toLocaleString(fa ? "fa-IR" : "en-US", { maximumFractionDigits: 1 });
  return `${num} ${unit[0]}`;
};

// A period select: 0 = keep, presets, custom days (30 to 3650), and for classes/exams "inherit" (null).
function PeriodSelect({ value, onChange, presets, fa, inherit = false, label }) {
  const isInherit = value === null || value === undefined;
  const isPreset = !isInherit && presets.includes(Number(value));
  const select = isInherit ? "inherit" : isPreset ? String(value) : "custom";
  const names = (d) => (d === 0 ? (fa ? "نگه‌داری (بدون حذف خودکار)" : "Keep (no automatic delete)")
    : d === 90 ? (fa ? "۹۰ روز" : "90 days") : d === 180 ? (fa ? "۶ ماه" : "6 months")
    : d === 365 ? (fa ? "۱۲ ماه" : "12 months") : d === 730 ? (fa ? "۲۴ ماه" : "24 months") : "");
  return (
    <span className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <select aria-label={label} value={select} onChange={(e) => {
        const v = e.target.value;
        if (v === "inherit") onChange(null);
        else if (v === "custom") onChange(isPreset || isInherit ? 365 : value);
        else onChange(Number(v));
      }}>
        {inherit && <option value="inherit">{fa ? "پیش‌فرض سراسری" : "Global default"}</option>}
        {presets.map((d) => <option key={d} value={String(d)}>{names(d)}</option>)}
        <option value="custom">{fa ? "تعداد روز دلخواه…" : "Custom days…"}</option>
      </select>
      {select === "custom" && (
        <input type="number" aria-label={`${label} (${fa ? "روز" : "days"})`} min={30} max={3650} step={1}
          value={isInherit ? "" : value} style={{ width: 90 }}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      )}
    </span>
  );
}

export default function RetentionPanel() {
  const { lang } = useApp();
  const fa = lang !== "en";
  const toast = useToast();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [loadErr, setLoadErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);     // { title, lines[], label, danger, run }
  const [manual, setManual] = useState({ category: "vp_chats", days: 365 });
  const [preview, setPreview] = useState(null);
  const [items, setItems] = useState({ class: [], exam: [] });
  const [picked, setPicked] = useState({ class: new Set(), exam: new Set() });
  const [bulkPeriod, setBulkPeriod] = useState({ class: 180, exam: 180 });
  const [compact, setCompact] = useState(null);
  const num = (n) => Number(n || 0).toLocaleString(fa ? "fa-IR" : "en-US");
  const when = (ms) => (ms ? new Date(ms).toLocaleString(fa ? "fa-IR" : "en-US") : (fa ? "هرگز" : "Never"));

  const load = useCallback(() => {
    setLoadErr("");
    return api.get("/admin/retention").then((d) => { setData(d); setDraft({ ...d.policy }); })
      .catch((e) => setLoadErr(String(e.message || e)));
  }, []);
  const loadItems = useCallback((kind) => api.get(`/admin/retention/items?kind=${kind}`)
    .then((d) => setItems((s) => ({ ...s, [kind]: d.rows || [] }))).catch(() => {}), []);
  useEffect(() => { load(); loadItems("class"); loadItems("exam"); }, [load, loadItems]);

  // Saves the policy. The server asks for confirmation when a category is turned on.
  const savePolicy = async (confirmed = false) => {
    setBusy(true);
    try {
      await api.put("/admin/retention", { policy: draft, confirm: confirmed });
      toast(fa ? "سیاست نگهداری ذخیره شد." : "Retention policy saved.");
      setConfirm(null);
      await load();
    } catch (e) {
      if (e.status === 409 && e.data?.categories) {
        const names = e.data.categories.map((c) => (fa ? CAT[c].fa : CAT[c].en)).join("، ");
        setConfirm({
          title: fa ? "فعال‌سازی حذف خودکار" : "Turn on automatic deletion",
          lines: [fa ? `برای ${names} حذف خودکار روشن می‌شود. داده‌های قدیمی‌تر از دوره انتخابی، هر روز و بدون بازگشت پاک خواهند شد.`
            : `Automatic deletion turns on for ${names}. Data older than the chosen period is removed every day, with no way back.`,
            ...(e.data.categories.includes("academic_items") ? [fa ? "کلاس‌ها و آزمون‌های بایگانی‌شده همراه نمره‌هایشان پاک می‌شوند. اگر نمی‌خواهید نمره‌ها پاک شوند، این گزینه را روشن نکنید." : "Archived classes and exams are deleted together with their grades. Do not turn this on if grades must stay."] : [])],
          label: fa ? "روشن کن و ذخیره" : "Turn on and save",
          danger: true,
          run: () => savePolicy(true),
        });
      } else {
        toast(fa ? "ذخیره نشد. دوباره تلاش کنید." : "Not saved. Try again.");
      }
    } finally { setBusy(false); }
  };

  const runPreview = async () => {
    setBusy(true);
    try { setPreview(await api.post("/admin/retention/preview", manual)); }
    catch { toast(fa ? "پیش‌نمایش انجام نشد." : "Preview failed."); }
    finally { setBusy(false); }
  };

  const runPurge = async () => {
    setBusy(true);
    try {
      const r = await api.post("/admin/retention/run", { ...manual, confirm: true });
      toast(fa ? `پاک شد: ${num(r.sessions ?? r.rows)} مورد.` : `Deleted: ${num(r.sessions ?? r.rows)} items.`);
      setConfirm(null); setPreview(null);
      await load();
    } catch { toast(fa ? "پاک‌سازی انجام نشد." : "Purge failed."); }
    finally { setBusy(false); }
  };

  const askPurge = () => {
    const c = CAT[manual.category];
    const count = preview ? (preview.sessions ?? preview.rows ?? 0) : null;
    setConfirm({
      title: fa ? "پاک‌سازی دستی" : "Manual purge",
      lines: [
        fa ? `${c.fa} قدیمی‌تر از ${num(manual.days)} روز برای همیشه پاک می‌شوند${count !== null ? ` (${num(count)} مورد)` : ""}.` :
          `${c.en} older than ${manual.days} days are deleted for good${count !== null ? ` (${num(count)} items)` : ""}.`,
        fa ? "نمره‌ها و ارزیابی‌ها حفظ می‌شوند. نسخه‌های پشتیبان تا پایان چرخه خودشان نگه داشته می‌شوند." :
          "Grades and evaluations stay. Backups keep their copies until they rotate out.",
      ],
      label: fa ? "پاک کن" : "Delete", danger: true, run: runPurge,
    });
  };

  const runCompact = async () => {
    setBusy(true);
    try {
      const r = await api.post("/admin/retention/compact", {});
      setCompact(r);
      toast(fa ? "فشرده‌سازی انجام شد." : "Compaction done.");
      await load();
    } catch { toast(fa ? "فشرده‌سازی انجام نشد." : "Compaction failed."); }
    finally { setBusy(false); setConfirm(null); }
  };

  const bulkSet = async (kind) => {
    const ids = [...picked[kind]];
    const days = bulkPeriod[kind];
    setBusy(true);
    try {
      const r = await api.put("/admin/retention/items", { kind, ids, days });
      toast(fa ? `${num(r.changed)} مورد به‌روز شد.` : `${r.changed} items updated.`);
      setPicked((p) => ({ ...p, [kind]: new Set() }));
      setConfirm(null);
      await loadItems(kind);
    } catch { toast(fa ? "به‌روزرسانی انجام نشد." : "Update failed."); }
    finally { setBusy(false); }
  };

  const askBulk = (kind) => {
    const n = picked[kind].size;
    const p = bulkPeriod[kind];
    setConfirm({
      title: fa ? "تنظیم دوره نگهداری" : "Set retention period",
      lines: [fa ? `دوره ${p === null ? "پیش‌فرض سراسری" : p === 0 ? "نگه‌داری" : `${num(p)} روز`} برای ${num(n)} مورد تنظیم می‌شود.`
        : `Period ${p === null ? "global default" : p === 0 ? "keep" : `${p} days`} is set for ${n} items.`,
        fa ? "با انتخاب «پیش‌فرض سراسری» دوره‌ی این مورد برداشته می‌شود." : "Choosing the global default removes this item's own period."],
      label: fa ? "اعمال کن" : "Apply", danger: p !== 0 && p !== null, run: () => bulkSet(kind),
    });
  };

  const archivedPicked = (kind) => items[kind].filter((r) => !r.active && picked[kind].has(r.id));

  // Deletes archived classes or exams with their grades. Counts come from the impact endpoint first.
  const deleteItems = async (kind, ids) => {
    setBusy(true);
    try {
      const r = await api.post("/admin/retention/items/delete", { kind, ids, confirm: true });
      const kept = r.skipped?.length || 0;
      toast(fa ? `${num(r.items)} مورد پاک شد${kept ? `؛ ${num(kept)} مورد به‌دلیل قاعده‌ها پاک نشد` : ""}.`
        : `${r.items} deleted${kept ? `; ${kept} kept by the rules` : ""}.`);
      setPicked((p) => ({ ...p, [kind]: new Set() }));
      setConfirm(null);
      await Promise.all([loadItems(kind), load()]);
    } catch { toast(fa ? "حذف انجام نشد." : "Delete failed."); }
    finally { setBusy(false); }
  };

  const askDeleteItems = async (kind, rows) => {
    const ids = rows.map((r) => r.id).slice(0, 100);
    if (!ids.length) return;
    setBusy(true);
    let t;
    try {
      const all = await Promise.all(ids.map((id) => api.get(`/admin/retention/items/impact?kind=${kind}&id=${id}`)));
      t = all.reduce((acc, x) => {
        if (x.blocked) { acc.blocked += 1; return acc; }
        acc.items += 1; acc.attempts += x.attempts; acc.chats += x.chats; acc.members += x.members; acc.responses += x.responses;
        return acc;
      }, { items: 0, blocked: 0, attempts: 0, chats: 0, members: 0, responses: 0 });
    } catch {
      toast(fa ? "بررسی انجام نشد." : "Check failed.");
      return;
    } finally { setBusy(false); }
    setConfirm({
      title: fa ? "حذف دائمی کلاس یا آزمون بایگانی‌شده" : "Delete archived class or exam for good",
      lines: [
        fa ? `${num(t.items)} مورد با همه نمره‌ها و گفت‌وگوهایشان برای همیشه پاک می‌شود. این کار قابل برگشت نیست.`
          : `${t.items} item(s) will be deleted for good, with all their grades and chats. This cannot be undone.`,
        fa ? `نمره‌ها: ${num(t.attempts)} · گفت‌وگوها: ${num(t.chats)} · اعضا: ${num(t.members)} · پاسخ فرم‌ها: ${num(t.responses)}`
          : `Grades: ${t.attempts} · chats: ${t.chats} · members: ${t.members} · form answers: ${t.responses}`,
        ...(t.blocked ? [fa ? `${num(t.blocked)} مورد به‌دلیل پژوهش، آزمون فعال یا بایگانی‌نبودن پاک نمی‌شود.`
          : `${t.blocked} item(s) are kept: linked to research, used by an active exam, or not archived.`] : []),
      ],
      label: fa ? "برای همیشه پاک کن" : "Delete for good", danger: true,
      run: () => deleteItems(kind, ids),
    });
  };

  const togglePick = (kind, id) => setPicked((p) => {
    const s = new Set(p[kind]);
    if (s.has(id)) s.delete(id); else s.add(id);
    return { ...p, [kind]: s };
  });
  const toggleAll = (kind) => setPicked((p) => ({
    ...p, [kind]: p[kind].size === items[kind].length ? new Set() : new Set(items[kind].map((r) => r.id)),
  }));

  if (loadErr) return <div className="card" role="alert"><p>{fa ? "تنظیمات نگهداری بارگذاری نشد:" : "Could not load retention settings:"} {loadErr}</p></div>;
  if (!data) return <Spinner label={fa ? "در حال بارگذاری…" : "Loading…"} />;
  const presets = data.presets || [0, 90, 180, 365, 730];
  const minDays = data.minDays || 30;
  const invalid = Object.values(draft).some((v) => v !== null && (v !== 0 && (v < minDays || v > (data.maxDays || 3650) || !Number.isInteger(v))));
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.policy);

  return (
    <div className="card">
      <div className="section-title">
        <h4>{fa ? "نگهداری داده و فضای ذخیره" : "Data retention and storage"}</h4>
      </div>
      <p className="small muted mb16">
        {fa
          ? "هیچ گفت‌وگو یا لاگی به‌صورت خودکار پاک نمی‌شود، مگر آنکه برای آن دوره‌ای تنظیم کنید. هر تغییر تأیید می‌خواهد و هر حذف در ممیزی ثبت می‌شود؛ ممیزی فقط تعداد را ثبت می‌کند، نه متن."
          : "Nothing is deleted automatically unless you set a period. Every change asks first, and every deletion is audited with counts only, never the text."}
      </p>
      <p className="small muted mb16">{fa ? `آخرین اجرای خودکار: ${when(data.lastRunMs)}` : `Last automatic run: ${when(data.lastRunMs)}`}</p>

      <h4 className="mb8">{fa ? "دوره نگهداری هر دسته" : "Period per category"}</h4>
      <div className="table-wrap"><table>
        <thead><tr>
          <th>{fa ? "داده" : "Data"}</th>
          <th>{fa ? "دوره" : "Period"}</th>
          <th>{fa ? "در صف حذف" : "Due now"}</th>
        </tr></thead>
        <tbody>
          {data.categories.map((c) => (
            <tr key={c}>
              <td><b>{fa ? CAT[c].fa : CAT[c].en}</b><div className="small muted">{fa ? CAT[c].noteFa : CAT[c].noteEn}</div></td>
              <td>
                <PeriodSelect value={draft[c]} presets={presets} fa={fa} label={fa ? CAT[c].fa : CAT[c].en}
                  onChange={(v) => setDraft((d) => ({ ...d, [c]: v === null ? 0 : v }))} />
              </td>
              <td className="small">
                {data.due?.[c] ? (c === "vp_chats"
                  ? `${num(data.due[c].sessions)} ${fa ? "گفت‌وگو" : "chats"}`
                  : `${num(data.due[c].rows)} ${fa ? "ردیف" : "rows"}`) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="row-between mt16" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="small muted">{invalid ? (fa ? `دوره باید صفر (نگه‌داری) یا بین ${num(minDays)} و ${num(data.maxDays)} روز باشد.` : `A period is 0 (keep) or ${minDays} to ${data.maxDays} days.`) : ""}</span>
        <button type="button" className="btn btn-primary" disabled={busy || !dirty || invalid} onClick={() => savePolicy(false)}>
          {fa ? "ذخیره سیاست" : "Save policy"}
        </button>
      </div>

      <h4 className="mt16 mb8">{fa ? "پاک‌سازی دستی بر اساس سن داده" : "Manual purge by age"}</h4>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select aria-label={fa ? "دسته" : "Category"} value={manual.category} onChange={(e) => { setManual((m) => ({ ...m, category: e.target.value })); setPreview(null); }}>
          {data.categories.map((c) => <option key={c} value={c}>{fa ? CAT[c].fa : CAT[c].en}</option>)}
        </select>
        <select aria-label={fa ? "قدیمی‌تر از" : "Older than"} value={String(manual.days)} onChange={(e) => { setManual((m) => ({ ...m, days: Number(e.target.value) })); setPreview(null); }}>
          {presets.filter((d) => d > 0).map((d) => <option key={d} value={String(d)}>{d === 90 ? (fa ? "۹۰ روز" : "90 days") : d === 180 ? (fa ? "۶ ماه" : "6 months") : d === 365 ? (fa ? "۱۲ ماه" : "12 months") : (fa ? "۲۴ ماه" : "24 months")}</option>)}
        </select>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={runPreview}>{fa ? "پیش‌نمایش (بدون حذف)" : "Preview (no change)"}</button>
        <button type="button" className="btn btn-danger" disabled={busy || !preview} onClick={askPurge}>{fa ? "پاک‌سازی…" : "Purge…"}</button>
      </div>
      {preview && <p className="small mt8">{fa ? `این کار ${num(preview.sessions ?? preview.rows)} مورد را پاک می‌کند${preview.events != null ? ` و ${num(preview.events)} رویداد` : ""}.` : `This removes ${num(preview.sessions ?? preview.rows)} items${preview.events != null ? ` and ${num(preview.events)} events` : ""}.`}</p>}

      <h4 className="mt16 mb8">{fa ? "فضای ذخیره" : "Storage"}</h4>
      <p className="small">
        {fa ? `اندازه فایل پایگاه داده: ${bytes(data.storage.fileBytes, fa)} · فضای خالی داخل فایل: ${bytes(data.storage.freeBytes, fa)} · حالت آزادسازی: ${data.storage.autoVacuum === "incremental" ? "افزایشی (فعال)" : "کامل (هنوز فعال نشده)"}`
          : `Database file: ${bytes(data.storage.fileBytes, fa)} · free space inside it: ${bytes(data.storage.freeBytes, fa)} · release mode: ${data.storage.autoVacuum === "incremental" ? "incremental (on)" : "full (not enabled yet)"}`}
      </p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirm({
          title: fa ? "فشرده‌سازی پایگاه داده" : "Compact the database",
          lines: [fa ? "فضای خالی داخل فایل به سیستم فایل برمی‌گردد. فشرده‌سازی اولین بار به فضای آزاد حدود اندازه فایل نیاز دارد و ممکن است چند دقیقه طول بکشد. سیستم در این مدت کند می‌شود."
            : "Free space inside the file goes back to the disk. The first compaction needs free disk about the size of the file and can take minutes; the site slows during it.", ],
          label: fa ? "فشرده کن" : "Compact", danger: false, run: runCompact,
        })}>{fa ? "فشرده‌سازی و آزادسازی فضا" : "Compact and release space"}</button>
        {compact && <span className="small">{fa ? `قبل: ${bytes(compact.before.fileBytes, fa)} ← بعد: ${bytes(compact.after.fileBytes, fa)}` : `Before: ${bytes(compact.before.fileBytes, false)} → after: ${bytes(compact.after.fileBytes, false)}`}</span>}
      </div>

      {["class", "exam"].map((kind) => (
        <div key={kind}>
          <h4 className="mt16 mb8">{kind === "class" ? (fa ? "دوره نگهداری هر کلاس" : "Period per class") : (fa ? "دوره نگهداری هر آزمون" : "Period per exam")}</h4>
          <p className="small muted mb8">{fa ? "پیش‌فرض یعنی دوره سراسری. کلاس بر آزمون مقدم است." : "Global default means the site-wide period. A class period wins over an exam period."}</p>
          {picked[kind].size > 0 && (
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }} role="region" aria-label={fa ? "عملیات گروهی" : "Bulk actions"}>
              <span className="small">{fa ? `${num(picked[kind].size)} مورد انتخاب شد` : `${picked[kind].size} selected`}</span>
              <PeriodSelect value={bulkPeriod[kind]} presets={presets} fa={fa} inherit label={fa ? "دوره گروهی" : "Bulk period"}
                onChange={(v) => setBulkPeriod((b) => ({ ...b, [kind]: v }))} />
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => askBulk(kind)}>{fa ? "اعمال روی انتخاب‌ها" : "Apply to selected"}</button>
              {archivedPicked(kind).length > 0 && (
                <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => askDeleteItems(kind, archivedPicked(kind))}>
                  {fa ? `حذف ${num(archivedPicked(kind).length)} بایگانی‌شده همراه نمره‌ها…` : `Delete ${archivedPicked(kind).length} archived with grades…`}
                </button>
              )}
            </div>
          )}
          {items[kind].length === 0 ? <p className="small muted">{fa ? "موردی نیست." : "Nothing here."}</p> : (
            <div className="table-wrap"><table>
              <thead><tr>
                <th><input type="checkbox" aria-label={fa ? "انتخاب همه" : "Select all"} checked={picked[kind].size === items[kind].length && items[kind].length > 0} onChange={() => toggleAll(kind)} /></th>
                <th>{fa ? "نام" : "Name"}</th>
                <th>{fa ? "وضعیت" : "Status"}</th>
                <th>{fa ? "گفت‌وگوهای پایان‌یافته" : "Finished chats"}</th>
                <th>{fa ? "نمره‌ها" : "Grades"}</th>
                <th>{fa ? "دوره" : "Period"}</th>
                <th>{fa ? "حذف" : "Delete"}</th>
              </tr></thead>
              <tbody>{items[kind].map((r) => (
                <tr key={r.id}>
                  <td><input type="checkbox" aria-label={`${fa ? "انتخاب" : "Select"} ${r.name_fa || r.name_en || r.id}`} checked={picked[kind].has(r.id)} onChange={() => togglePick(kind, r.id)} /></td>
                  <td>{fa ? r.name_fa || r.name_en : r.name_en || r.name_fa}{r.code ? <span className="tag" style={{ marginInlineStart: 6 }}>{r.code}</span> : null}</td>
                  <td><span className={`pill ${r.active ? "pill-active" : "pill-inactive"}`}>{r.active ? (fa ? "فعال" : "Active") : (fa ? "بایگانی" : "Archived")}</span></td>
                  <td>{num(r.chats)}</td>
                  <td>{num(r.attempts)}</td>
                  <td>
                    <PeriodSelect value={r.retention_days} presets={presets} fa={fa} inherit label={`${fa ? "دوره" : "Period"} ${r.name_fa || r.name_en || r.id}`}
                      onChange={async (v) => {
                        try { await api.put("/admin/retention/items", { kind, ids: [r.id], days: v }); await loadItems(kind); }
                        catch { toast(fa ? "ذخیره نشد." : "Not saved."); }
                      }} />
                  </td>
                  <td>
                    {!r.active && !r.study_id ? (
                      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => askDeleteItems(kind, [r])}>
                        {fa ? "حذف همراه نمره‌ها…" : "Delete with grades…"}
                      </button>
                    ) : (
                      <span className="small muted">{r.study_id ? (fa ? REASON.research_linked[0] : REASON.research_linked[1])
                        : (fa ? REASON.not_archived[0] : REASON.not_archived[1])}</span>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      ))}

      {confirm && (
        <Modal title={confirm.title} saveLabel={confirm.label} onClose={() => setConfirm(null)} onSave={confirm.run}>
          {confirm.lines.map((l, i) => <p key={i} className="small" style={{ margin: "0 0 8px" }}>{l}</p>)}
        </Modal>
      )}
    </div>
  );
}
