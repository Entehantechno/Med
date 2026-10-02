import { useEffect, useState } from "react";
import { api } from "../../api.js";

export default function MindmapBankAdmin() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ slug: "", title_fa: "", title_en: "", type: "mind", system: "cardio", level: "core", summary_fa: "", cover_url: "", graph_json: '{"nodes":[],"edges":[]}', is_premium: 1 });
  const [msg, setMsg] = useState("");

  const load = () => {
    api.get(`/admin/mindmap-bank?q=${encodeURIComponent(q)}`).then(d => { setItems(d.items || []); setTotal(d.total || 0); }).catch(() => {});
  };
  useEffect(load, []);
  useEffect(() => { const id = setTimeout(load, 400); return () => clearTimeout(id); }, [q]);

  const save = async () => {
    try {
      const payload = { ...form, graph_json: JSON.parse(form.graph_json) };
      if (editing) await api.put(`/admin/mindmap-bank/${editing}`, payload);
      else await api.post("/admin/mindmap-bank", payload);
      setMsg("ذخیره شد ✓"); setEditing(null); setForm({ slug: "", title_fa: "", title_en: "", type: "mind", system: "cardio", level: "core", summary_fa: "", cover_url: "", graph_json: '{"nodes":[],"edges":[]}', is_premium: 1 }); load();
    } catch (e) { setMsg(String(e.message || e)); }
  };
  const del = async (slug) => {
    if (!confirm(`حذف ${slug}؟`)) return;
    await api.del(`/admin/mindmap-bank/${slug}`); load();
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-black">مدیریت بانک مایندمپ — ۵۰</h1>
      <p className="text-sm text-slate-600">جستجو + CRUD + import/export + لینک‌دهی به سؤالات</p>

      <div className="mt-4 flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو..." className="flex-1 rounded-xl border px-3 py-2 text-sm" />
        <button onClick={load} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">جستجو</button>
      </div>

      <div className="mt-4 rounded-2xl border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="slug" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={form.title_fa} onChange={e => setForm({ ...form, title_fa: e.target.value })} placeholder="عنوان فارسی" className="rounded-xl border px-3 py-2 text-sm" />
          <input value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} placeholder="Title EN" className="rounded-xl border px-3 py-2 text-sm" />
          <select value={form.system} onChange={e => setForm({ ...form, system: e.target.value })} className="rounded-xl border px-3 py-2 text-sm">
            <option value="cardio">cardio</option><option value="pulmo">pulmo</option><option value="gastro">gastro</option><option value="nephro">nephro</option><option value="endo">endo</option><option value="neuro">neuro</option><option value="heme">heme</option><option value="rheum">rheum</option><option value="infect">infect</option><option value="emergency">emergency</option><option value="other">other</option>
          </select>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="rounded-xl border px-3 py-2 text-sm"><option value="mind">mind</option><option value="approach">approach</option></select>
          <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className="rounded-xl border px-3 py-2 text-sm"><option value="core">core</option><option value="high_yield">high_yield</option><option value="emergency">emergency</option></select>
          <textarea value={form.summary_fa} onChange={e => setForm({ ...form, summary_fa: e.target.value })} placeholder="خلاصه" className="sm:col-span-2 rounded-xl border px-3 py-2 text-sm" rows={2} />
          <textarea value={form.graph_json} onChange={e => setForm({ ...form, graph_json: e.target.value })} placeholder='{"nodes":[],"edges":[]}' className="sm:col-span-2 rounded-xl border px-3 py-2 font-mono text-xs" rows={6} />
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={save} className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-black text-white hover:bg-sky-700">{editing ? "به‌روزرسانی" : "ایجاد"}</button>
          {editing && <button onClick={() => { setEditing(null); setForm({ slug: "", title_fa: "", title_en: "", type: "mind", system: "cardio", level: "core", summary_fa: "", cover_url: "", graph_json: '{"nodes":[],"edges":[]}', is_premium: 1 }); }} className="rounded-xl border px-5 py-2 text-sm">لغو</button>}
          <span className="ms-auto text-sm text-emerald-700">{msg}</span>
        </div>
      </div>

      <div className="mt-4 text-sm font-bold text-slate-700">{total} نقشه</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {items.map(it => (
          <div key={it.slug} className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-black">{it.title_fa} <span className="font-normal text-slate-500">({it.slug})</span></div>
            <div className="text-xs text-slate-600">{it.system} • {it.type} • {it.level} {it.is_premium ? "🔒" : "✓"}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { setEditing(it.slug); setForm({ slug: it.slug, title_fa: it.title_fa, title_en: it.title_en, type: it.type, system: it.system, level: it.level, summary_fa: it.summary_fa || "", cover_url: it.cover_url || "", graph_json: it.graph_json || '{"nodes":[],"edges":[]}', is_premium: it.is_premium }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-full border px-3 py-1.5 text-xs font-bold">ویرایش</button>
              <button onClick={() => del(it.slug)} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white">حذف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
