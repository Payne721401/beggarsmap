import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFavorites, isFavorite, toggleFavorite } from './favorites';

const KEY = 'beggarsmap_favorites';

beforeEach(() => {
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────
// getFavorites
// ─────────────────────────────────────────────────────────────────
describe('getFavorites', () => {
  it('尚無收藏時回傳空陣列', () => {
    expect(getFavorites()).toEqual([]);
  });

  it('localStorage 損壞（非 JSON）時回傳空陣列', () => {
    localStorage.setItem(KEY, 'NOT_VALID_JSON');
    expect(getFavorites()).toEqual([]);
  });

  it('正確讀取已儲存的收藏清單', () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b', 'c']));
    expect(getFavorites()).toEqual(['a', 'b', 'c']);
  });

  it('SSR 環境（window 不存在）時回傳空陣列', () => {
    vi.stubGlobal('window', undefined);
    expect(getFavorites()).toEqual([]);
    vi.unstubAllGlobals();
  });
});

// ─────────────────────────────────────────────────────────────────
// isFavorite
// ─────────────────────────────────────────────────────────────────
describe('isFavorite', () => {
  it('尚未收藏時回傳 false', () => {
    expect(isFavorite('rest-1')).toBe(false);
  });

  it('加入收藏後回傳 true', () => {
    toggleFavorite('rest-1');
    expect(isFavorite('rest-1')).toBe(true);
  });

  it('移除收藏後回傳 false', () => {
    toggleFavorite('rest-1');
    toggleFavorite('rest-1');
    expect(isFavorite('rest-1')).toBe(false);
  });

  it('不同 ID 互不影響', () => {
    toggleFavorite('rest-1');
    expect(isFavorite('rest-2')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// toggleFavorite
// ─────────────────────────────────────────────────────────────────
describe('toggleFavorite', () => {
  it('首次呼叫 → 加入收藏，回傳 true', () => {
    expect(toggleFavorite('rest-1')).toBe(true);
  });

  it('第二次呼叫 → 移除收藏，回傳 false', () => {
    toggleFavorite('rest-1');
    expect(toggleFavorite('rest-1')).toBe(false);
  });

  it('第三次呼叫 → 再次加入，回傳 true', () => {
    toggleFavorite('rest-1');
    toggleFavorite('rest-1');
    expect(toggleFavorite('rest-1')).toBe(true);
  });

  it('加入後 getFavorites() 包含該 ID', () => {
    toggleFavorite('rest-1');
    expect(getFavorites()).toContain('rest-1');
  });

  it('移除後 getFavorites() 不包含該 ID', () => {
    toggleFavorite('rest-1');
    toggleFavorite('rest-1');
    expect(getFavorites()).not.toContain('rest-1');
  });

  it('多個 ID 可分別加入收藏', () => {
    toggleFavorite('rest-1');
    toggleFavorite('rest-2');
    toggleFavorite('rest-3');
    expect(getFavorites()).toEqual(['rest-1', 'rest-2', 'rest-3']);
  });

  it('移除其中一個不影響其他收藏', () => {
    toggleFavorite('rest-1');
    toggleFavorite('rest-2');
    toggleFavorite('rest-1'); // 移除 rest-1
    expect(getFavorites()).toEqual(['rest-2']);
    expect(isFavorite('rest-2')).toBe(true);
  });

  it('加入順序保持穩定', () => {
    toggleFavorite('c');
    toggleFavorite('a');
    toggleFavorite('b');
    expect(getFavorites()).toEqual(['c', 'a', 'b']);
  });
});
