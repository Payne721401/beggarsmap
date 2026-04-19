import type { SupabaseClient } from '@supabase/supabase-js';
import { toBaseSlug } from '../lib/slug';

type InsertData = Record<string, unknown>;

// DB INSERT + catch 23505（unique_violation）retry
// 最多 3 次，超過加 UUID 後綴。
// 此函式有 DB 依賴，不列入單元測試 coverage，由整合測試驗證。
export async function insertWithUniqueSlug(
  db: SupabaseClient,
  table: string,
  name: string,
  data: InsertData
): Promise<{ slug: string }> {
  const base = toBaseSlug(name);

  for (let i = 0; i < 3; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { error } = await db.from(table).insert({ ...data, slug });

    if (!error) return { slug };
    // 23505 = unique_violation（PostgreSQL error code）
    if (error.code !== '23505') throw new Error(error.message);
  }

  // 3 次碰撞後加 UUID 後綴（極罕見）
  const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await db.from(table).insert({ ...data, slug });
  if (error) throw new Error(error.message);
  return { slug };
}
