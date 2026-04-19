/**
 * 「本店不符乞丐標準」本機標記
 * MVP：純 localStorage 防重複
 * Phase 2：同步後端 POST /api/restaurants/:id/flag + KV ipHash 防重
 */

const KEY = 'beggarsmap_flags';

function getFlags(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function hasFlagged(id: string): boolean {
  return getFlags().includes(id);
}

/** Returns true if this is the first flag (allowed). False = already flagged. */
export function flagRestaurant(id: string): boolean {
  if (hasFlagged(id)) return false;
  const next = [...getFlags(), id];
  localStorage.setItem(KEY, JSON.stringify(next));
  return true;
}
