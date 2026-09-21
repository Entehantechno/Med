import { useState, useMemo, useEffect, useDeferredValue } from "react";
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
}) {
  const { t, lang } = useApp();
  const fa = lang !== "en";
  const [q, setQ] = useState("");
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
  useEffect(() => { setPage(0); }, [q, perPage, rows]);

  // Keep the current page valid when the result set shrinks (delete etc.).
  const pageCount = paginate ? Math.max(1, Math.ceil(sorted.length / perPage)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);

  const start = paginate ? safePage * perPage : 0;
  const pageRows = paginate ? sorted.slice(start, start + perPage) : sorted;

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
        <SearchBox compact value={q} onChange={setQ} onSearch={setQ} placeholder={searchPlaceholder || t("searchPlaceholder")}
          storageKey={storageKey || "table"} hotkey={hotkey} helpKinds={["table"]} />
        {dq.trim() && (
          <span className="muted small dt-hits" role="status" aria-live="polite">
            {fa ? `${filtered.length.toLocaleString("fa-IR")} از ${rows.length.toLocaleString("fa-IR")}` : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()}`}
          </span>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            {columns.map((c) => {
              const canSort = c.sortable !== false;
              const active = sort.key === c.key;
              return (
                <th key={c.key} style={{ ...(c.thStyle || {}), ...(canSort ? { cursor: "pointer", userSelect: "none" } : {}) }}
                  onClick={canSort ? () => toggleSort(c.key) : undefined}>
                  {c.label}
                  {canSort && <span className="dt-sort">{active ? (sort.dir === "asc" ? " ▲" : " ▼") : " ⇅"}</span>}
                </th>
              );
            })}
          </tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={columns.length} className="small muted center" style={{ padding: 20 }}>
                {empty || t("noData")}</td></tr>
            ) : pageRows.map((row, i) => (
              <tr key={rowKey ? rowKey(row, start + i) : (row.id ?? start + i)}>
                {columns.map((c) => {
                  const v = c.render ? c.render(row, dq) : row[c.key];
                  const canHl = dq.trim() && (typeof v === "string" || typeof v === "number") && (!highlightKeys || highlightKeys.includes(c.key));
                  return <td key={c.key}>{canHl ? <Highlight text={String(v)} ranges={highlightLocal(String(v), dq)} /> : v}</td>;
                })}
              </tr>
            ))}
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
