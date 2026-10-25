// Shared tabs belong to more than one area. Stay in the current area when
// possible; only cross areas for a tab that is not present in the current one.
export function adminTabMode(id, currentMode, groups) {
  if (groups[currentMode]?.some(([tab]) => tab === id)) return currentMode;
  return Object.keys(groups).find(mode => groups[mode].some(([tab]) => tab === id)) || null;
}
