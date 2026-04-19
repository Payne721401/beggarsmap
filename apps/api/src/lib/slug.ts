import { pinyin } from 'pinyin-pro';

// 純函式：中文名稱 → URL-safe slug（100% unit test coverage 要求）
export function toBaseSlug(name: string): string {
  // nonZh: 'consecutive' 讓非中文字元（英文、數字）保持連續，不被逐字拆開
  const withPinyin = pinyin(name, { toneType: 'none', type: 'string', nonZh: 'consecutive' });
  return withPinyin
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')  // 非英數字 → 空格
    .replace(/\s+/g, '-')            // 空格 → 連字號
    .replace(/-+/g, '-')             // 多個連字號 → 單個
    .replace(/^-|-$/g, '')           // 去除首尾連字號
    .slice(0, 60) || 'restaurant';
}
