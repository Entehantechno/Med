import { useState } from 'react';
import '../styles-r63.css';
import Icon from './Icon.jsx';
import { CompactCode } from './ContentCode.jsx';

/* Round 63 — grouped, collapsible picker for large content banks (VP cases,
   flashcards) used when a teacher or admin attaches content to a class.

   - Rows are grouped by one attribute (specialty, category…). Groups start
     collapsed, show "selected / total", and can be selected or cleared as a unit.
   - Search matches title, group, short code and id, and opens matching groups.
   - The permanent code is shown only in short form (CompactCode); the full value
     is in the tooltip and is copied on click.
   - renderExtra(item) adds per-row controls (e.g. weight) only for selected rows.

   Props: lang, items, idOf, titleOf, groupOf -> {key,label}, metaOf?, codeOf?,
   selected (ids), onChange(ids), renderExtra?, emptyText, disabled?. */
export function groupFor(label, fallback) {
  const l = String(label || '').trim();
  return { key: l || '__none', label: l || fallback };
}

export default function ContentPicker({ lang = 'fa', items = [], idOf, titleOf, groupOf, metaOf, codeOf, selected = [], onChange, renderExtra, emptyText, disabled = false }) {
  const fa = lang !== 'en';
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});
  const sel = new Set(selected);
  const needle = q.trim().toLowerCase();

  const matches = (it) => !needle || [titleOf(it), groupOf(it).label, codeOf ? codeOf(it) : '', idOf(it), metaOf ? metaOf(it) : '']
    .join(' ').toLowerCase().includes(needle);
  const visible = items.filter(matches);

  const byKey = new Map();
  for (const it of visible) {
    const g = groupOf(it);
    if (!byKey.has(g.key)) byKey.set(g.key, { key: g.key, label: g.label, items: [] });
    byKey.get(g.key).items.push(it);
  }
  const groups = [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, fa ? 'fa' : 'en'));
  const isOpen = (g) => (needle ? true : !!open[g.key]);

  const toggleRow = (id) => onChange(sel.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const toggleGroup = (g) => {
    const ids = g.items.map(idOf);
    const allOn = ids.every((id) => sel.has(id));
    onChange(allOn ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };
  const shownIds = visible.map(idOf);
  const setAllOpen = (value) => setOpen(Object.fromEntries(groups.map((g) => [g.key, value])));

  if (items.length === 0) return <div className="small muted center cpk-empty">{emptyText}</div>;

  return (
    <fieldset className="cpk" disabled={disabled}>
      <div className="cpk-toolbar">
        <div className="cpk-search">
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={fa ? 'جستجو در عنوان، گروه یا کد…' : 'Search title, group or code…'}
            aria-label={fa ? 'جستجو' : 'Search'} />
          {q && <button type="button" className="cpk-clear" onClick={() => setQ('')} aria-label={fa ? 'پاک کردن جستجو' : 'Clear search'}><Icon name="close" size={13} /></button>}
        </div>
        <div className="cpk-actions">
          <span className="small muted">{visible.length}/{items.length}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAllOpen(true)} disabled={!groups.length}>{fa ? 'باز کردن همه' : 'Expand all'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAllOpen(false)} disabled={!groups.length}>{fa ? 'بستن همه' : 'Collapse all'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...new Set([...selected, ...shownIds])])} disabled={!shownIds.length}>{fa ? 'انتخاب نمایش‌داده‌شده' : 'Select shown'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([])} disabled={!selected.length}>{fa ? 'لغو همه' : 'Clear all'}</button>
          <span className="small cpk-count-total"><b>{selected.length}</b> {fa ? 'انتخاب‌شده' : 'selected'}</span>
        </div>
      </div>

      {groups.length === 0 && <div className="small muted center cpk-empty">{fa ? 'موردی با این جستجو یافت نشد.' : 'No matches.'}</div>}

      {groups.map((g) => {
        const ids = g.items.map(idOf);
        const nSel = ids.filter((id) => sel.has(id)).length;
        const allOn = nSel === ids.length;
        const expanded = isOpen(g);
        return (
          <section key={g.key} className="cpk-group">
            <div className="cpk-head">
              <button type="button" className="cpk-toggle" aria-expanded={expanded}
                onClick={() => setOpen((o) => ({ ...o, [g.key]: !expanded }))}>
                <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} />
                <b>{g.label}</b>
                <span className={`cpk-badge ${nSel ? 'on' : ''}`}>{nSel}/{ids.length}</span>
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleGroup(g)}>
                {allOn ? (fa ? 'لغو گروه' : 'Clear group') : (fa ? 'انتخاب گروه' : 'Select group')}
              </button>
            </div>
            {expanded && (
              <div className="cpk-rows">
                {g.items.map((it) => {
                  const id = idOf(it);
                  const on = sel.has(id);
                  const meta = metaOf ? metaOf(it) : null;
                  return (
                    <div key={id} className={`cpk-row ${on ? 'on' : ''}`}>
                      <label className="cpk-main">
                        <input type="checkbox" checked={on} onChange={() => toggleRow(id)} />
                        <span className="cpk-title">{titleOf(it)}</span>
                        {meta && <span className="cpk-meta">{meta}</span>}
                      </label>
                      {on && renderExtra && <div className="cpk-extra">{renderExtra(it)}</div>}
                      {codeOf && <CompactCode code={codeOf(it)} />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </fieldset>
  );
}
