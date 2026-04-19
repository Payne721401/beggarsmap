const KEY = 'beggarsmap_favorites';

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id);
}

/** Returns the new isFavorite state */
export function toggleFavorite(id: string): boolean {
  const current = getFavorites();
  const exists = current.includes(id);
  const next = exists ? current.filter((x) => x !== id) : [...current, id];
  localStorage.setItem(KEY, JSON.stringify(next));
  return !exists;
}
