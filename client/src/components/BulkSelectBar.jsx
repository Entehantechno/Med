/* Bulk selection tools for pick lists (cases, flashcards, students).
   - select every item currently shown (respects the search box)
   - invert the shown items
   - clear everything
   - pick a whole group at once (e.g. all patients of one university) */
export function groupsBy(items, labelFn, idFn) {
  const map = new Map();
  for (const it of items || []) {
    const key = String(labelFn(it) ?? "");
    if (!key) continue;
    if (!map.has(key)) map.set(key, { key, label: key, ids: [] });
    map.get(key).ids.push(idFn(it));
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export default function BulkSelectBar({ lang = "fa", shownIds = [], selectedIds = [], onChange, groups = [], extra = null }) {
  const fa = lang === "fa";
  const selected = new Set(selectedIds);
  const shown = [...new Set(shownIds)];
  const selectShown = () => onChange([...new Set([...selectedIds, ...shown])]);
  const invertShown = () => {
    const shownSet = new Set(shown);
    const kept = selectedIds.filter((id) => !shownSet.has(id));
    const added = shown.filter((id) => !selected.has(id));
    onChange([...kept, ...added]);
  };
  const clearAll = () => onChange([]);
  const addGroup = (g) => onChange([...new Set([...selectedIds, ...g.ids])]);
  const removeGroup = (g) => { const drop = new Set(g.ids); onChange(selectedIds.filter((id) => !drop.has(id))); };
  const groupFull = (g) => g.ids.length > 0 && g.ids.every((id) => selected.has(id));
  return (
    <div className="bulk-select-bar" role="toolbar" aria-label={fa ? "ابزار انتخاب گروهی" : "Bulk selection"} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", margin: "6px 0 10px" }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={selectShown} disabled={!shown.length}>{fa ? `انتخاب همه‌ی نمایش‌داده‌شده (${shown.length})` : `Select all shown (${shown.length})`}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={invertShown} disabled={!shown.length}>{fa ? "معکوس نمایش‌داده‌شده" : "Invert shown"}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll} disabled={!selectedIds.length}>{fa ? "لغو انتخاب همه" : "Clear all"}</button>
      {extra}
      <span className="small muted">{fa ? `${selectedIds.length} مورد انتخاب شده` : `${selectedIds.length} selected`}</span>
      {groups.length > 0 && (
        <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span className="small muted">{fa ? "گروه‌ها:" : "Groups:"}</span>
          {groups.map((g) => (
            <button key={g.key} type="button" className={`chip-btn ${groupFull(g) ? "on" : ""}`} onClick={() => (groupFull(g) ? removeGroup(g) : addGroup(g))}>
              {groupFull(g) ? "✓ " : "+ "}{g.label} ({g.ids.length})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
