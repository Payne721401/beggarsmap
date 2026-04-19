# 資料庫規範

## Supabase Client 使用規範

```typescript
// apps/api/src/db/client.ts
import { createClient } from '@supabase/supabase-js';

// Workers 後端：service_role（跳過 RLS）
export function getDb(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
```

**絕對不要**：
- 把 service_role key 傳到前端
- 在前端建立 supabase client（MVP 階段，無 auth）

---

## Materialized View 更新

**規則**：`restaurant_markers` MV 每 10 分鐘更新一次，由 Cloudflare Workers Cron 呼叫。

```typescript
// wrangler.toml
[[triggers]]
crons = ["*/10 * * * *"]

// queues/cron.ts
export async function handleCron(env: Env) {
  const db = getDb(env);
  await db.rpc('refresh_restaurant_markers');
}
```

```sql
-- Supabase Function（讓 Workers 可以 RPC 呼叫）
CREATE OR REPLACE FUNCTION refresh_restaurant_markers()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY restaurant_markers;
END;
$$;
```

---

## Slug 生成：DB UNIQUE retry（不預先查表）

**規則**：使用 DB INSERT + catch 23505（unique_violation）的方式處理衝突。最多重試 3 次，第 4 次加 UUID 後綴。

詳見 `apps/api/src/lib/slug.ts`。

---

## Trigger 注意事項

`trg_update_stats` trigger 在每次 INSERT/UPDATE review 後：
- 更新 `restaurants.review_count`
- 更新 `restaurants.avg_rating`
- 更新 `restaurants.beggar_index`（Phase 1 = avg_rating）

**注意**：Queue Consumer 批次寫入 review 時，trigger 會多次執行。這是預期行為，最終數值正確。

---

## Schema 更新流程

1. 在 `packages/db/migrations/` 新增 SQL 檔案（格式：`001_description.sql`）
2. 在 Supabase Dashboard SQL Editor 執行
3. 更新 `packages/db/schema.sql`（保持最新全量 schema）
4. 若影響 `restaurant_markers` MV，同步更新 MV 定義

---

## 個資法合規：users 表

- `email`：NULLABLE，只在用戶明確提供時儲存
- `deleted_at`：帳號刪除時設為 NOW()，同時清空 email、display_name、avatar_url
- 評論關聯的 user_id：ON DELETE SET NULL（保留評論內容，但斷開與用戶的關聯）

---

## 價格欄位限制

```
price_min: 1 ~ 3000 TWD
price_max: 1 ~ 10000 TWD
price_paid: 1 ~ 10000 TWD
```

超出範圍的資料在 Workers 同步驗證階段拒絕（不進 Queue）。
