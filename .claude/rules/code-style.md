# 程式碼風格規範

## TypeScript

- 嚴格模式：`"strict": true`
- 不用 `any`，用 `unknown` 或精確型別
- 函式回傳型別明確標示（非 trivial 的函式）
- 用 `type` 而非 `interface`（除非需要 extend/implement）

## 命名規範

```
檔案：kebab-case.ts（例：rate-limit.ts, map-pin-selector.tsx）
元件：PascalCase.tsx（例：MapPinSelector.tsx）
函式/變數：camelCase
常數：UPPER_SNAKE_CASE（僅全域常數）
DB 欄位：snake_case（PostgreSQL 慣例）
API 路徑：kebab-case（/api/restaurants, /api/upload/presign）
```

## Import 順序

```typescript
// 1. Node/Cloudflare 內建
// 2. 第三方套件
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

// 3. 內部 absolute imports（@ alias）
import { getDb } from '@/db/client';

// 4. 相對 imports
import { hashIp } from '../middleware/ipHash';
```

## 錯誤處理

```typescript
// Workers：統一 JSON 錯誤格式
return c.json({ error: 'message', code: 'ERROR_CODE' }, statusCode);

// 驗證錯誤：400
// 未授權：401
// 禁止：403
// 找不到：404
// Rate limited：429
// 伺服器錯誤：500
```

## React / Next.js

- Server Components 優先，只在需要 interactivity 時加 `'use client'`
- 圖片用 `imgUrl()` helper（見 rules/architecture.md），不 hardcode URL
- 地圖元件必須 dynamic import + `ssr: false`（MapLibre 不支援 SSR）

```typescript
const Map = dynamic(() => import('@/components/Map'), { ssr: false });
```

## Cloudflare Workers / Hono

- 路由函式保持簡短，邏輯放 middleware 或 service 層
- 所有 env 透過 `c.env` 取得，不用全域變數
- Binding 型別在 `wrangler.toml` 定義後，同步更新 `src/types/env.d.ts`

## 測試

詳見 rules/testing.md
