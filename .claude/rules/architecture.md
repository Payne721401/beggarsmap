# 架構規範

## 寫入操作：一律走 Cloudflare Queue

**規則**：所有 POST/PUT 業務寫入（新增餐廳、新增評論）必須推入 Queue，不直接呼叫 Supabase。

**Why**：防止高流量直接打爆 Supabase 免費版連線池；Queue Consumer 批次寫入。

**How to apply**：
```typescript
// ✅ 正確
await env.RESTAURANT_QUEUE.send({ type: 'add_restaurant', payload });
return c.json({ status: 'queued' }, 202);

// ❌ 錯誤
await supabase.from('restaurants').insert(payload);
```

**例外**：GET 讀取、Admin 後台操作、內部 Cron 可直連 Supabase。

---

## 地圖讀取：查 Materialized View，不查主表

**規則**：`GET /api/restaurants?bbox=` 必須查 `restaurant_markers` MV，不查 `restaurants` 主表。

**Why**：MV 有最佳化的 GIST 索引，主表含所有欄位（包含 pending/rejected），直查主表效能差且可能洩漏未審核資料。

**How to apply**：
```typescript
// ✅ 正確
await supabase.from('restaurant_markers').select('...')
  .filter(bboxCondition);

// ❌ 錯誤
await supabase.from('restaurants').select('...').eq('status', 'active');
```

---

## 圖片 URL 統一格式

**規則**：DB 只存 R2 object key（例：`abc123.webp`），不存完整 URL。

**Why**：domain 可能變更；統一從環境變數組合 URL。

**How to apply**：
```typescript
// lib/image.ts
export function imgUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `${process.env.NEXT_PUBLIC_IMG_HOST}/${key}`;
}
// 使用：imgUrl(restaurant.cover_image_key)
```

**生產**：`NEXT_PUBLIC_IMG_HOST=https://img.beggarsmap.tw`
**開發**：`NEXT_PUBLIC_IMG_HOST=https://pub-xxx.r2.dev`

---

## 「搜尋此區域」按鈕：不自動載入

**規則**：地圖拖動、縮放時不自動觸發 API 請求。必須等使用者點擊「搜尋此區域」按鈕。

**Why**：最小化 API 請求數，節省 Cloudflare Workers 免費配額（100k/day）。

---

## BBox 查詢：limit 硬上限 200

**規則**：`GET /api/restaurants?bbox=` 回傳上限 200 筆，忽略任何更大的 limit 參數。

**Why**：防止爬蟲一次拉全量資料。

---

## cursor-based 分頁（搜尋列表）

**規則**：搜尋 API 使用 cursor 分頁，response **不含** total count。

**Why**：防止爬蟲透過 total 計算出全量資料量；cursor 也更適合 infinite scroll。
