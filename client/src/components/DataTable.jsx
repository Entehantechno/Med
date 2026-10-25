import { useState, useMemo, useEffect, useDeferredValue, useRef } from "react";
import { useApp } from "../context.jsx";
import Icon from "./Icon.jsx";
import SearchBox, { Highlight, highlightLocal, normFa } from "./SearchBox.jsx";

/* Reusable table with a search box, click-to-sort column headers and PAGINATION.
   Props:
     columns: [{ key, label, render?(row), sortValue?(row), sortable?=true, thStyle? }]
     rows:    array of objects
     searchKeys: optional array of keys/functions to match the search text against
                 (defaults to every column's sortValue/text)
     initialSort: { key, dir } — dir "asc" | "desc"
     empty:   node shown when there are no rows after filtering
     rowKey:  (row,i) => key
     pageSize: rows per page (default 25). Pass 0 to disable pagination and
               render every row on one page (legacy behaviour).
     pageSizeOptions: choices offered in the per-page selector.
   Why pagination: banks with hundreds of flashcards/questions rendered every
   <tr> at once, producing a multi-screen-long admin page (slow DOM and endless
   scrolling). Only the current page's rows are mounted now; sorting/search
   still operate on the FULL filtered dataset.
*/
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/* Compact page list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 42 */
function pageList(current, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const out = new Set([0, count - 1, current - 1, current, current + 1]);
  const nums = [...out].filter((n) => n >= 0 && n < count).sort((a, b) => a - b);
  const withGaps = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) withGaps.push("…");
    withGaps.push(n);
  });
  return withGaps;
}

export default function DataTable({
  columns, rows, searchKeys, initialSort, empty, rowKey, searchPlaceholder,
  storageKey, hotkey = false, highlightKeys,
  pageSize: pageSizeProp = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  selectable = false, selectedIds = null, onSelectionChange = null,
  showRowNumbers = true, columnPicker = true, exportable = false,
  defaultHiddenColumns = [], searchable = true,
}) {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const [q, setQ] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState(() => new Set(defaultHiddenColumns));
  const visibleColumns = columns.filter(c => !hiddenColumns.has(c.key) || c.key === 'actions');
  const allBox = useRef(null);
  const [sort, setSort] = useState(initialSort || { key: null, dir: "asc" });
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(pageSizeProp || DEFAULT_PAGE_SIZE);
  const paginate = pageSizeProp > 0;

  const textOf = (row, col) => {
    if (col.sortValue) return col.sortValue(row);
    const v = row[col.key];
    return v == null ? "" : v;
  };

  // Deferred so typing never blocks on a 10 000-row filter (React 18 INP fix).
  const dq = useDeferredValue(q);
  const filtered = useMemo(() => {
    const raw = dq.trim();
    if (!raw) return rows;
    // Same mini-grammar as the bank search: every term must match (AND),
    // "quoted phrase", -exclude; Persian/Arabic letters + digits normalised.
    const toks = raw.match(/-?"[^"]+"|\S+/g) || [];
    const must = [], not = [];
    for (const tk of toks) {
      const neg = tk.startsWith("-");
      const v = normFa(tk.replace(/^-/, "").replace(/^"|"$/g, ""));
      if (!v) continue;
      (neg ? not : must).push(v);
    }
    if (!must.length && !not.length) return rows;
    const keys = searchKeys || columns.map((c) => (row) => textOf(row, c));
    return rows.filter((row) => {
      const hay = normFa(keys.map((k) => String((typeof k === "function" ? k(row) : row[k]) ?? "")).join(" \u0001 "));
      for (const n of not) if (hay.includes(n)) return false;
      for (const m of must) if (!hay.includes(m)) return false;
      return true;
    });
  }, [rows, dq, columns, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const arr = [...filtered].sort((a, b) => {
      let x = textOf(a, col), y = textOf(b, col);
      const nx = Number(x), ny = Number(y);
      if (!isNaN(nx) && !isNaN(ny) && x !== "" && y !== "") { x = nx; y = ny; }
      else { x = String(x).toLowerCase(); y = String(y).toLowerCase(); }
      if (x < y) return -1; if (x > y) return 1; return 0;
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort, columns]);

  // Back to the first page whenever the user searches, changes the page size,
  // or the parent supplies a new dataset (reload / new filter values).
  useEffect(() => { setPage(0); }, [q, perPage, rows, sort]);

  // Keep the current page valid when the result set shrinks (delete etc.).
  const pageCount = paginate ? Math.max(1, Math.ceil(sorted.length / perPage)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);

  const start = paginate ? safePage * perPage : 0;
  const pageRows = paginate ? sorted.slice(start, start + perPage) : sorted;

  const pageIds = pageRows.map((row, i) => rowKey ? rowKey(row, start+i) : (row.id ?? start+i));
  const pageSelected = pageIds.filter(id => selectedIds?.has(id)).length;
  useEffect(() => { if (allBox.current) allBox.current.indeterminate = pageSelected > 0 && pageSelected < pageIds.length; }, [pageSelected, pageIds.length]);
  const exportCsv = () => {
    const cols = visibleColumns.filter(c => c.key !== 'actions' && typeof c.label === 'string');
    const cell = value => {
      let text = String(value ?? '');
      if (/^(?:\s*[=+\-@]|[\t\r])/.test(text)) text = "'" + text; // spreadsheet formula safety
      return '"' + text.replaceAll('"','""') + '"';
    };
    const lines = [cols.map(c => cell(c.label)).join(',')];
    for (const row of sorted) lines.push(cols.map(c => cell(c.exportValue ? c.exportValue(row) : textOf(row,c))).join(','));
    const url = URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')], { type:'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href=url; link.download='filtered-table.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const from = sorted.length ? start + 1 : 0;
  const to = Math.min(start + perPage, sorted.length);
  const rangeLabel = fa
    ? `نمایش ${from.toLocaleString("fa-IR")} تا ${to.toLocaleString("fa-IR")} از ${sorted.length.toLocaleString("fa-IR")}`
    : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${sorted.length.toLocaleString()}`;

  return (
    <div>
      <div className="dt-search-wrap">
        {searchable && <SearchBox compact value={q} onChange={setQ} onSearch={setQ} placeholder={searchPlaceholder || t("searchPlaceholder")}
          storageKey={storageKey || "table"} hotkey={hotkey} helpKinds={["table"]} />}
        {dq.trim() && (
          <span className="muted small dt-hits" role="status" aria-live="polite">
            {fa ? `${filtered.length.toLocaleString("fa-IR")} از ${rows.length.toLocaleString("fa-IR")}` : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()}`}
          </span>
        )}
      </div>
      <div className="dt-tools" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBlock:8}}>
        {columnPicker && <details><summary>{fa ? 'ستون‌های جدول' : 'Table columns'}</summary>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',padding:10}}>{columns.filter(c => c.key !== 'actions' && typeof c.label === 'string').map(c => <label key={c.key}>
            <input type="checkbox" checked={!hiddenColumns.has(c.key)} onChange={() => setHiddenColumns(prev => { const next = new Set(prev); next.has(c.key) ? next.delete(c.key) : next.add(c.key); return next; })} /> {fa ? 'ستون: ' : 'Column: '}{c.label}
          </label>)}</div>
        </details>}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => {setQ('');setSort(initialSort || {key:null,dir:'asc'});setHiddenColumns(new Set(defaultHiddenColumns));setPage(0);}}>{fa ? 'بازنشانی نمایش' : 'Reset view'}</button>
        {exportable && <button type="button" className="btn btn-sm btn-ghost" onClick={exportCsv}>{fa ? `CSV نتایج فیلترشده (${sorted.length})` : `Filtered CSV (${sorted.length})`}</button>}
        {selectable && <span role="status" className="small">{fa ? `${selectedIds?.size || 0} انتخاب‌شده (شامل صفحات دیگر)` : `${selectedIds?.size || 0} selected (including other pages)`}
          {!!selectedIds?.size && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onSelectionChange?.(new Set())}>{fa ? 'پاک‌کردن انتخاب' : 'Clear selection'}</button>}
        </span>}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            {selectable && (
              <th style={{ width: 38, textAlign: "center" }}>
                <input type="checkbox" ref={allBox}
                  checked={pageIds.length > 0 && pageSelected === pageIds.length}
                  onChange={(e)=>{
                    const next=new Set(selectedIds||[]);
                    pageIds.forEach(id => e.target.checked ? next.add(id) : next.delete(id));
                    onSelectionChange?.(next);
                  }}
                  aria-label={fa?"انتخاب همه در این صفحه":"Select all on page"}
                />
              </th>
            )}
            {showRowNumbers && <th scope="col" title={fa ? 'ردیف در نتایج فعلی؛ کد محتوا نیست' : 'Position in current results, not an identity'}>{fa ? 'ردیف' : 'Row'}</th>}
            {visibleColumns.map((c) => {
              const canSort = c.sortable !== false;
              const active = sort.key === c.key;
              return (
                <th key={c.key} scope="col" style={c.thStyle} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {canSort ? <button type="button" className="dt-sort-button" onClick={() => toggleSort(c.key)} style={{font:'inherit',color:'inherit',background:'none',border:0,padding:6,cursor:'pointer'}}>
                    {c.label}<span className="dt-sort" aria-hidden="true">{active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}</span>
                  </button> : c.label}
                </th>
              );
            })}
          </tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={visibleColumns.length + (selectable?1:0) + (showRowNumbers?1:0)} className="small muted center" style={{ padding: 20 }}>
                {empty || t("noData")}</td></tr>
            ) : pageRows.map((row, i) => {
              const rid = rowKey ? rowKey(row, start + i) : (row.id ?? start + i);
              const checked = selectedIds?.has(rid);
              return (
              <tr key={rid} style={checked?{background:"var(--primaryGlow)"}:undefined}>
                {selectable && <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={fa ? `انتخاب ردیف ${start+i+1}` : `Select row ${start+i+1}`} checked={!!checked} onChange={(e)=>{
                  const next=new Set(selectedIds||[]);
                  if(e.target.checked) next.add(rid); else next.delete(rid);
                  onSelectionChange?.(next);
                }} /></td>}
                {showRowNumbers && <td className="muted small" data-row-number={start+i+1}>{(start+i+1).toLocaleString(fa ? 'fa-IR' : 'en-US')}</td>}
                {visibleColumns.map((c) => {
                  const v = c.render ? c.render(row, dq) : row[c.key];
                  const canHl = dq.trim() && (typeof v === "string" || typeof v === "number") && (!highlightKeys || highlightKeys.includes(c.key));
                  return <td key={c.key}>{canHl ? <Highlight text={String(v)} ranges={highlightLocal(String(v), dq)} /> : v}</td>;
                })}
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      {paginate && sorted.length > 0 && (
        <div className="dt-pager">
          <div className="dt-pager-info">
            <span>{rangeLabel}</span>
            <select className="dt-pager-size" value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              title={fa ? "تعداد ردیف در هر صفحه" : "Rows per page"}
              aria-label={fa ? "تعداد ردیف در هر صفحه" : "Rows per page"}>
              {pageSizeOptions.map((n) => <option key={n} value={n}>{fa ? n.toLocaleString("fa-IR") : n}</option>)}
            </select>
            <span className="muted small">{fa ? "در هر صفحه" : "per page"}</span>
          </div>
          {pageCount > 1 && (
            <div className="dt-pager-btns">
              <button type="button" className="btn btn-sm btn-ghost dt-page-btn"
                disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                {fa ? "قبلی" : "Previous"}
              </button>
              {pageList(safePage, pageCount).map((p, i) =>
                p === "…"
                  ? <span key={`g${i}`} className="dt-page-gap">…</span>
                  : <button key={p} type="button"
                      className={`btn btn-sm dt-page-btn ${p === safePage ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setPage(p)} aria-current={p === safePage ? "page" : undefined}>
                      {fa ? (p + 1).toLocaleString("fa-IR") : (p + 1).toLocaleString()}
                    </button>
              )}
              <button type="button" className="btn btn-sm btn-ghost dt-page-btn"
                disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                {fa ? "بعدی" : "Next"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
