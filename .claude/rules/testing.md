# 測試規範

## 測試分層

```
單元測試（Vitest）← 安全性 / 純邏輯函式 100% coverage
  Backend (apps/api)
    ├── src/lib/slug.ts          → toBaseSlug() 中文 slug 產生
    ├── src/lib/ipHash.ts        → hashIp() + getClientIp()
    └── src/middleware/validateImage.ts → magic bytes 驗證

  Frontend (apps/web)
    ├── lib/chains.ts            → 連鎖店名稱判斷
    ├── lib/favorites.ts         → localStorage 收藏
    ├── lib/reports.ts           → localStorage 舉報 / 價格投票 / CP 投票
    └── lib/gmaps-parse.ts       → Google Maps URL parser（含短網址 API 整合）

整合測試（手動 + 上線前 smoke test）
  ├── API routes（需 Supabase + KV mock）
  ├── Queue consumers
  └── Next.js API routes（如 /api/resolve-gmaps）

E2E（Phase 2 加入）
  └── Playwright
```

## Coverage 要求

**以下檔案必須達到 100% line/branch/function/statement coverage（CI 強制驗證）：**

### Backend
| 檔案 | 原因 |
|------|------|
| `apps/api/src/lib/slug.ts` | 資安：slug 衝突處理的核心邏輯 |
| `apps/api/src/lib/ipHash.ts` | 資安：IP hash 若有 bug，會洩漏或無法保護隱私 |
| `apps/api/src/middleware/validateImage.ts` | 資安：magic bytes 若有 bug，惡意檔案可能上傳 |

### Frontend
| 檔案 | 原因 |
|------|------|
| `apps/web/lib/chains.ts` | 內容：連鎖店過濾邏輯，誤判直接影響使用者新增體驗 |
| `apps/web/lib/favorites.ts` | 使用者資料：localStorage 寫入若失敗會丟資料 |
| `apps/web/lib/reports.ts` | 同上；含 SSR fallback、QuotaExceeded 例外、JSON 損壞回復 |
| `apps/web/lib/gmaps-parse.ts` | 輸入正規化：使用者貼上的 Google Maps URL 解析容錯 |

**以下檔案採整合測試，不列入 coverage（有外部依賴）：**

### Backend
- `apps/api/src/routes/**`（需 Supabase、KV）
- `apps/api/src/queues/**`（需 Cloudflare Queues mock）
- `apps/api/src/index.ts`（Hono 主入口）
- `apps/api/src/db/**`（外部依賴）

### Frontend
- `apps/web/app/**`（React 元件 + Next.js routing）
- `apps/web/components/**`（React 元件）
- `apps/web/lib/api.ts`（fetch wrapper，外部 API 依賴）
- `apps/web/lib/mock-data.ts`（純靜態資料）
- `apps/web/lib/maplibre.ts`（依賴 maplibre-gl 模組）
- `apps/web/lib/image.ts`（純字串組合，無分支邏輯）
- `apps/web/lib/flags.ts`（feature flag 讀取）

## 測試環境

| Workspace | environment | 為什麼 |
|-----------|-------------|--------|
| `apps/api` | `node` | Workers runtime 行為類似 Node |
| `apps/web` | `jsdom` | 需要 `window` / `localStorage` 模擬 |

## 各測試檔的覆蓋範圍

### `apps/api/src/__tests__/slug.test.ts`
- 中文輸入轉拼音 slug
- 英數混合輸入
- 特殊字元清理
- 重複 base slug 的後綴遞增策略

### `apps/api/src/__tests__/ipHash.test.ts`
- 同 IP 相同 salt → 相同 hash（穩定性）
- 不同 salt → 不同 hash
- `getClientIp()` 從 CF-Connecting-IP / X-Forwarded-For 多 header 優先順序

### `apps/api/src/__tests__/validateImage.test.ts`
- JPEG / PNG / WebP magic bytes 通過
- 偽造副檔名（.exe 改 .jpg）被擋下
- 截斷檔案、空檔案、過短 buffer

### `apps/web/lib/chains.test.ts`
- 已知連鎖名稱（麥當勞 / 7-11 / 全家 / 星巴克...）→ true
- 非連鎖名稱 → false
- 大小寫不敏感

### `apps/web/lib/favorites.test.ts`
- `toggleFavorite()` 雙向切換
- `isFavorite()` 讀取
- SSR 環境（`window` undefined）回傳 `[]`
- localStorage 損壞 / quota 超限 容錯

### `apps/web/lib/reports.test.ts`
- `hasReported()` / `addReport()`：每店每 IP 只能舉報一次，不可覆蓋原因
- `getPriceVote()` / `setPriceVote()`：可改投，含 SSR + 損壞容錯
- `getCpVote()` / `setCpVote()`：CP 高低投票，可改投，含 SSR + 損壞容錯

### `apps/web/lib/gmaps-parse.test.ts`
- 純座標格式 `lat,lng` / `@lat,lng` / 含負數
- 長網址 `@lat,lng` 抓座標
- 長網址 `!3d!4d` 優先（更精確的目標點）
- 店名 URL decode + `+` 轉空白；解碼失敗靜默忽略
- `/g/xxx` Knowledge Graph ID
- 短網址呼叫 `/api/resolve-gmaps`（fetch mock）
- API 失敗的錯誤訊息傳遞
- 不支援的 host / 無效 URL 拋錯

## 執行測試

```bash
# Frontend
cd apps/web
npm test                # 一次性執行
npm run test:watch      # 開發時 watch mode
npm run test:coverage   # 含 coverage 報告（CI 模式）

# Backend
cd apps/api
npm test
npm run test:watch
npm run test:coverage
```

## CI/CD Pipeline（GitHub Actions）

**`.github/workflows/ci.yml`**

| Job | 觸發 | 內容 |
|-----|------|------|
| `api-test` | push/PR | TypeScript type check + Vitest coverage（100% 未達到 → fail）|
| `web-test` | push/PR | TypeScript type check + Vitest coverage（100% 未達到 → fail）|
| `web-build` | push/PR | Next.js build check |
| `deploy-api` | push to main（api-test 通過後）| `wrangler deploy` |
| `deploy-web` | push to main（web-test + web-build 通過後）| `wrangler pages deploy` |

**必須設定的 GitHub Secrets：**
```
CLOUDFLARE_API_TOKEN    # Cloudflare API Token（Workers + Pages 部署權限）
CLOUDFLARE_ACCOUNT_ID   # Cloudflare Account ID
CF_ANALYTICS_TOKEN      # Cloudflare Web Analytics Token（選填）
```

## 加入新測試的決策準則

加新測試前先問：

1. **這個函式有外部依賴嗎？**
   - 有（fetch、Supabase、Cloudflare API）→ 整合測試，不放入 coverage include
   - 沒有（純邏輯、純資料轉換）→ 單元測試 100% coverage
2. **bug 的後果是？**
   - 資安 / 隱私 / 資料完整性 → **必須** 100% coverage
   - UI 視覺 / 體驗 → 不一定要寫測試，靠手動驗收 + UI 穩定後再補
3. **測試成本 vs. 改 bug 成本**
   - 純函式：寫 5 分鐘，避免無限 debug 時間 → 值得
   - React 元件：寫 30 分鐘，UI 改動就過期 → MVP 階段不值得

## 手動測試清單（上線前驗證）

### 地圖
- [ ] PMTiles 從 R2/CDN 載入（DevTools Network → HTTP 206）
- [ ] 第二次載入走 Service Worker（`(ServiceWorker)`）
- [ ] 台灣範圍限制（`maxBounds` 生效）
- [ ] z15 縮放顯示街道/建物
- [ ] Marker 底部尖角對齊座標
- [ ] 選中時餐廳名 label 不重疊（普通 label 被 filter 排除）

### 新增餐廳
- [ ] 點「新增餐廳」FAB → 直接開表單（預設 URL 模式）
- [ ] 貼上長網址 → 點「解析」→ 綠色框出現「已解析座標」
- [ ] 貼上短網址 `maps.app.goo.gl/xxx` → 透過 `/api/resolve-gmaps` 成功取得最終座標
- [ ] 「在 Google Maps 搜尋」按鈕 → 新分頁開啟
- [ ] 「找不到？改用地圖點選」→ 切換到 pin 模式
- [ ] 代表品項 / 價格未填 → 擋下並顯示錯誤
- [ ] 表單填寫 + 提交 → HTTP 202，DB 30 秒內出現 pending 資料
- [ ] 台灣範圍外座標 → HTTP 400（同步驗證，不進 Queue）
- [ ] Honeypot 欄位填值 → HTTP 400
- [ ] 快速提交 4 次 → 第 4 次 HTTP 429（±1 因 race condition）
- [ ] Slug 生成：「牛肉麵大王」→ `niu-rou-mian-da-wang`

### 圖片上傳
- [ ] 正常 JPEG → presigned URL 取得 → R2 PUT 成功
- [ ] 偽造格式（.exe 改名 .jpg）→ HTTP 400
- [ ] 超過 1MB（後端強制）→ HTTP 400
- [ ] Presigned URL 5 分鐘後過期 → R2 403
- [ ] 詳細頁無圖 placeholder 點擊 → 開啟檔案選擇器
- [ ] 上傳後 lightbox 能放大顯示
- [ ] 菜單 / 餐點分開上傳

### 評論
- [ ] 提交 rating:4 → HTTP 202，avg_rating 更新（trigger 驗證）
- [ ] rating:6 → HTTP 400
- [ ] comment 501 字 → HTTP 400
- [ ] Shadow ban 後提交 → HTTP 202，DB `is_hidden=TRUE`

### CP 值 / 收藏 / 舉報（前端 localStorage）
- [ ] 投票 CP 值「高」→ localStorage 寫入 `beggarsmap_cp_votes`
- [ ] 改投 CP 值「低」→ 覆蓋原值
- [ ] 點愛心收藏 → localStorage 寫入 `beggarsmap_favorites`
- [ ] 收藏 panel 顯示已收藏清單，可點擊跳轉
- [ ] 舉報後同店不能再舉報

### 審判台
- [ ] 按鈕左上紅色徽章顯示「最近新增 + 被舉報」總數
- [ ] Tab 切換：「最近新增」(14 天內) / 「被舉報」(report_count > 0)
- [ ] 點 panel 外面關閉

### Admin 後台
- [ ] 無 token → 401；錯誤 token → 401；正確 → 200
- [ ] 審核通過 → DB status 更新
- [ ] Shadow ban → KV 寫入

### SEO
- [ ] GET /r/niu-rou-mian-da-wang 首次 → `x-nextjs-cache: MISS`
- [ ] 第二次 → `x-nextjs-cache: HIT`
- [ ] OG 標籤包含 `img.beggarsmap.tw` 圖片
- [ ] JSON-LD LocalBusiness schema 存在

### 資安
- [ ] HTTP 請求 → 301 重導 HTTPS
- [ ] BBox 超大範圍 → 回傳 ≤ 200 筆
- [ ] CF-Connecting-IP header 不出現在 response 或 log
- [ ] ADMIN_SECRET 不出現在任何 log（wrangler tail 確認）
- [ ] RLS：anon key 無法讀取 pending 餐廳
- [ ] `/api/resolve-gmaps` 不接受非白名單 host

### 監控
- [ ] 造訪首頁 → Cloudflare Web Analytics 有 PV
- [ ] Workers throw Error → Sentry 收到 + Discord 通知
- [ ] /internal/health → UptimeRobot 顯示 UP
- [ ] Grafana 連接 Supabase → 可查每日新增餐廳數

### Mobile
- [ ] 手機點擊 pin → Bottom Sheet 從底部滑出
- [ ] 雙指縮放地圖正常
- [ ] PWA：Chrome「加入主畫面」→ Standalone 模式
