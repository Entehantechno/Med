import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

export default function BugHunt() {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [scans, setScans] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [newBug, setNewBug] = useState({ title: "", description: "", severity: "medium" });

  const load = async () => {
    try {
      const s = await api.get("/admin/bug-hunt/stats");
      setStats(s);
      const r = await api.get(`/admin/bug-hunt/reports?status=${filterStatus}&kind=${filterKind}&limit=50`);
      setReports(r.reports || []);
      const sc = await api.get("/admin/bug-hunt/scans?limit=10");
      setScans(sc.scans || []);
    } catch {}
  };

  useEffect(() => { load(); }, [filterStatus, filterKind]);

  const doScan = async () => {
    if (busy) return; setBusy(true);
    try { await api.post("/admin/bug-hunt/scan", {}); await load(); } catch {} finally { setBusy(false); }
  };

  const updateStatus = async (id, status) => {
    await api.put(`/admin/bug-hunt/report/${id}`, { status });
    load();
  };

  const submitManual = async () => {
    if (!newBug.title.trim() || !newBug.description.trim()) return;
    await api.post("/admin/bug-hunt/report", newBug);
    setNewBug({ title: "", description: "", severity: "medium" });
    load();
  };

  const sevColor = (s) => s === "critical" ? "#dc2626" : s === "high" ? "#ea580c" : s === "medium" ? "#d97706" : "#16a34a";
  const statusColor = (st) => st === "open" ? "#dc2626" : st === "fixed" ? "#16a34a" : "#6b7280";

  return (
    <div className="page">
      <div className="section-title"><h2>🐛 {fa ? "سامانهٔ باگیابی تکرارشونده" : "Recurring Bug Hunt"}</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={doScan} disabled={busy}>{busy ? "…" : (fa ? "اسکن فوری" : "Run scan now")}</button>
      </div>

      {stats && (
        <div className="card mb16" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12 }}>
          <div><b style={{ fontSize: "1.6rem", color: "#dc2626" }}>{stats.open}</b><div className="small muted">{fa ? "باز" : "Open"}</div></div>
          <div><b>{stats.total}</b><div className="small muted">{fa ? "کل گزارش‌ها" : "Total reports"}</div></div>
          <div><b>{stats.auto}</b><div className="small muted">{fa ? "خودکار" : "Auto"}</div></div>
          <div><b>{stats.lastScan ? new Date(stats.lastScan.created_at).toLocaleDateString(fa ? "fa-IR" : "en-US") : "—"}</b><div className="small muted">{fa ? "آخرین اسکن" : "Last scan"}</div></div>
        </div>
      )}

      {/* filters */}
      <div className="card mb16" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input" style={{ maxWidth: 160 }}>
          <option value="">{fa ? "همهٔ وضعیت‌ها" : "All statuses"}</option>
          {["open","triaged","in_progress","fixed","closed"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterKind} onChange={e => setFilterKind(e.target.value)} className="input" style={{ maxWidth: 160 }}>
          <option value="">{fa ? "همهٔ انواع" : "All kinds"}</option>
          <option value="manual">manual</option>
          <option value="auto">auto</option>
        </select>
        <span className="small muted">{fa ? "فیلتر گزارش‌ها" : "Filter reports"}</span>
      </div>

      {/* manual report form */}
      <div className="card mb16">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "ثبت گزارش دستی" : "File a manual report"}</div>
        <div className="grid grid-2">
          <input className="input" placeholder={fa ? "عنوان کوتاه" : "Short title"} value={newBug.title} onChange={e => setNewBug({ ...newBug, title: e.target.value })} maxLength={200} />
          <select className="input" value={newBug.severity} onChange={e => setNewBug({ ...newBug, severity: e.target.value })}>
            <option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option>
          </select>
        </div>
        <textarea className="input mt8" rows={3} placeholder={fa ? "شرح کامل باگ" : "Full description"} value={newBug.description} onChange={e => setNewBug({ ...newBug, description: e.target.value })} maxLength={5000} />
        <button type="button" className="btn btn-accent btn-sm mt8" onClick={submitManual}>{fa ? "ثبت" : "Submit"}</button>
      </div>

      {/* reports table */}
      <div className="card mb16">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "گزارش‌ها" : "Reports"} ({reports.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>#</th><th>{fa ? "عنوان" : "Title"}</th><th>{fa ? "شدت" : "Sev"}</th><th>{fa ? "وضعیت" : "Status"}</th><th>{fa ? "نوع" : "Kind"}</th><th>{fa ? "تاریخ" : "Date"}</th><th>{fa ? "عملیات" : "Actions"}</th></tr></thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.description}>{r.title}</td>
                  <td><span className="tag" style={{ background: sevColor(r.severity), color: "#fff" }}>{r.severity}</span></td>
                  <td><span className="tag" style={{ background: statusColor(r.status), color: "#fff" }}>{r.status}</span></td>
                  <td>{r.kind}</td>
                  <td className="small muted">{new Date(r.created_at).toLocaleDateString(fa ? "fa-IR" : "en-US")}</td>
                  <td style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {r.status === "open" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateStatus(r.id, "triaged")}>{fa ? "بررسی" : "Triage"}</button>}
                    {r.status !== "fixed" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateStatus(r.id, "fixed")}>{fa ? "حل‌شده" : "Fixed"}</button>}
                    {r.status !== "closed" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateStatus(r.id, "closed")}>{fa ? "بستن" : "Close"}</button>}
                  </td>
                </tr>
              ))}
              {reports.length === 0 && <tr><td colSpan={7} className="small muted" style={{ textAlign: "center", padding: 16 }}>{fa ? "گزارشی نیست" : "No reports"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* scans */}
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "اسکن‌های اخیر" : "Recent scans"} ({scans.length})</div>
        {scans.map(s => (
          <div key={s.id} className="card mb8" style={{ borderLeft: `4px solid ${s.findings?.length ? "#f59e0b" : "#10b981"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>#{s.id} — {new Date(s.created_at).toLocaleString(fa ? "fa-IR" : "en-US")}</b>
              <span className="tag" style={{ background: s.findings?.length ? "#fef3c7" : "#dcfce7", color: "#333" }}>{s.findings?.length || 0} {fa ? "یافته" : "findings"}</span>
            </div>
            {s.findings?.length > 0 && (
              <ul className="small mt8" style={{ margin: 0, paddingInlineStart: 18 }}>
                {s.findings.map((f, i) => <li key={i} style={{ marginBottom: 4 }}><b style={{ color: sevColor(f.severity) }}>{f.title}</b> — {f.description}</li>)}
              </ul>
            )}
          </div>
        ))}
        {scans.length === 0 && <div className="small muted">{fa ? "هنوز اسکنی انجام نشده" : "No scans yet"}</div>}
      </div>
    </div>
  );
}
