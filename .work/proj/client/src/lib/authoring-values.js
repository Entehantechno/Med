// Keep existing array entries intact; split only the free-text authoring input.
export function acceptedAnswers(value) {
 const entries=Array.isArray(value)?value:String(value||'').split(/[،,\n]/);
 return entries.map(x=>String(x??'').trim()).filter(Boolean);
}
// Remove an ordering row only when both translations are empty.
export function orderingRows(fa=[],en=[]) {
 const rows=Array.from({length:Math.max(fa.length,en.length)},(_,i)=>[fa[i]??'',en[i]??''])
  .filter(row=>row.some(x=>String(x).trim()));
 return {items_fa:rows.map(row=>row[0]),items_en:rows.map(row=>row[1])};
}
export function drawingRubrics(drawing={}) {
 const rows=orderingRows(drawing.rubric_fa||[],drawing.rubric_en||[]);
 return {rubric_fa:rows.items_fa.map(x=>String(x).trim()),rubric_en:rows.items_en.map(x=>String(x).trim())};
}
export function percentCoordinate(value,fallback=50) {
 const n=value==null||value===''?NaN:Number(value);
 return Number.isFinite(n)?Math.max(0,Math.min(100,n)):fallback;
}
