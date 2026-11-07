/* Matching-question connections (R60).

   State: { pairs: { [leftId]: rightId }, activeLeft: leftId | null }

   Invariants: a right item belongs to at most one left item, and a left item
   has at most one right item. Re-pairing moves the right item; undo unlinks.

   Interaction (touch and mouse alike):
   - tap a LINKED left item  → unlink it and select it, ready to pair again
   - tap a FREE left item    → select it (tap again to clear the selection)
   - tap a RIGHT item while a left item is selected → link them (moving the
     right item away from its previous left item if it had one)
   - tap a LINKED right item with nothing selected → unlink it

   Colours: both items of a pair share PAIR_COLORS[pairIndex], where pairIndex
   is the left item's position in the list. Numbers are shown too, so the pairing
   never depends on colour alone. */

export const PAIR_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

export function emptyMatch() {
  return { pairs: {}, activeLeft: null };
}

export function pairColor(index) {
  const n = PAIR_COLORS.length;
  return PAIR_COLORS[((index % n) + n) % n];
}

/** Left item id linked to a right item id, or null. */
export function leftOwnerOf(sel, rightId) {
  const hit = Object.entries(sel?.pairs || {}).find(([, r]) => String(r) === String(rightId));
  return hit ? hit[0] : null;
}

export function clickLeft(sel, leftId) {
  const s = sel || emptyMatch();
  const pairs = { ...s.pairs };
  if (pairs[leftId] != null) {
    delete pairs[leftId];
    return { pairs, activeLeft: leftId };
  }
  return { pairs, activeLeft: s.activeLeft === leftId ? null : leftId };
}

export function clickRight(sel, rightId) {
  const s = sel || emptyMatch();
  const owner = leftOwnerOf(s, rightId);
  if (s.activeLeft == null) {
    if (owner == null) return s;
    const pairs = { ...s.pairs };
    delete pairs[owner];
    return { pairs, activeLeft: null };
  }
  const pairs = { ...s.pairs };
  for (const k of Object.keys(pairs)) if (String(pairs[k]) === String(rightId)) delete pairs[k];
  pairs[s.activeLeft] = rightId;
  return { pairs, activeLeft: null };
}

/** 0-based pair index of a left item id in the left column, or -1. */
export function pairIndexOfLeft(leftIds, leftId) {
  return leftIds.findIndex((id) => String(id) === String(leftId));
}
