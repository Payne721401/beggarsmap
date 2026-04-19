# 乞丐地圖 — 開發進度 & 待辦清單

> 最後更新：2026-04-12

---

## 目前狀態：程式碼完成，等待外部服務設定

所有程式碼已寫完，TypeScript 零錯誤，24 個單元測試全過（100% coverage）。
**現在卡住的原因**：wrangler.toml 裡有幾個 placeholder ID 需要你去 Cloudflare/Supabase 建立服務後填入，才能部署。

---

## 已完成的程式碼

### 前端 `apps/web/`
| 檔案 | 說明 |
|------|------|
| `app/layout.tsx` | Root layout，zh-TW，Cloudflare Web Analytics placeholder |
| `app/page.tsx` | 首頁，地圖 + 狀態機（地圖/詳情/評論/新增/選座標）|
| `app/r/[slug]/page.tsx` | ISR 餐廳頁（revalidate=3600）+ OG tags + JSON-LD |
| `app/admin/page.tsx` | 管理後台（token 登入、審核通過/拒絕/靜默）|
| `app/privacy/page.tsx` | 隱私政策靜態頁 |
| `app/sitemap.ts` | 動態 sitemap（每日更新）|
| `components/Map.tsx` | MapLibre + PMTiles + cluster + 搜尋此區域按鈕 + 選座標模式 |
| `components/RestaurantBottomSheet.tsx` | 手機 Bottom Sheet / 桌機 Side Panel |
| `components/ReviewModal.tsx` | 評論表單（honeypot + 星等 + 價格 + 留言）|
| `components/AddRestaurantForm.tsx` | 新增餐廳（圖片壓縮 + R2 兩段式上傳）|
| `lib/image.ts` | `imgUrl(key)` helper |
| `lib/maplibre.ts` | 地圖常數、PMTiles style、beggar index 顏色 |
| `lib/api.ts` | API fetch helper |

### 後端 `apps/api/`
| 檔案 | 說明 |
|------|------|
| `src/index.ts` | Hono 主入口，CORS，所有 routes，queue handler，cron |
| `src/routes/restaurants.ts` | GET bbox / by-slug / search / :id，POST 新增（→ Queue）|
| `src/routes/reviews.ts` | POST 評論（→ Queue）|
| `src/routes/upload.ts` | POST /presign（R2 presigned URL）|
| `src/routes/admin.ts` | GET/PUT 餐廳審核，POST shadow-ban |
| `src/queues/restaurant-consumer.ts` | Queue consumer：insert 餐廳 |
| `src/queues/review-consumer.ts` | Queue consumer：批次 insert 評論 |
| `src/middleware/adminAuth.ts` | Bearer token 驗證 |
| `src/middleware/shadowBan.ts` | IP hash → KV 查詢 |
| `src/middleware/rateLimit.ts` | KV 軟性限速（3/day 餐廳，10/day 評論）|
| `src/middleware/validateImage.ts` | Magic bytes 驗證（JPEG/PNG/WebP）|
| `src/lib/slug.ts` | `toBaseSlug()` 中文→拼音 slug（純函式）|
| `src/lib/ipHash.ts` | SHA-256 IP hash（純函式）|
| `src/db/client.ts` | Supabase client + 台灣範圍驗證 |
| `src/db/insertWithSlug.ts` | DB insert + unique slug retry |
| `wrangler.toml` | Workers 設定（**KV ID 尚未填入**）|

### 基礎設施
| 檔案 | 說明 |
|------|------|
| `packages/db/schema.sql` | 完整 PostgreSQL schema（需在 Supabase 執行）|
| `.github/workflows/ci.yml` | CI/CD：type-check + 100% test coverage + wrangler deploy |
| `pnpm-workspace.yaml` | Monorepo 工作區設定 |
| `.claude/CLAUDE.md` + `rules/` | AI 協作規範（已完成）|

---

## 你需要做的事（依順序）

### 第一步：Cloudflare 設定

#### 1-A. 建立 KV Namespace
```bash
cd apps/api
npx wrangler kv:namespace create "beggarsmap-kv"
npx wrangler kv:namespace create "beggarsmap-kv" --preview
```
把輸出的兩個 ID 填入 `wrangler.toml`：
```toml
[[kv_namespaces]]
binding = "KV"
id = "填入正式 ID"
preview_id = "填入 preview ID"
```

#### 1-B. 建立 R2 Bucket
Cloudflare Dashboard → R2 → 建立 bucket，名稱：`beggarsmap`
- 開啟 Custom Domain：`img.beggarsmap.tw` → CNAME 到 `beggarsmap.{account}.r2.dev`

#### 1-C. 建立 Queues
Cloudflare Dashboard → Workers & Pages → Queues：
- 建立 `restaurant-submissions`
- 建立 `review-submissions`

#### 1-D. 設定 Workers Secrets(尚未)
```bash
cd apps/api
npx wrangler secret put ADMIN_SECRET           # 你自己設定的管理員密碼
npx wrangler secret put SUPABASE_URL           # https://xxx.supabase.co
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put INTERNAL_CRON_SECRET   # 任意隨機字串
npx wrangler secret put IP_HASH_SALT           # 任意隨機字串（防 rainbow table）
npx wrangler secret put SENTRY_DSN             # 選填(建立sentry.io帳號後再填)
```

#### 1-E. Cloudflare 安全設定（Dashboard 手動設定）
- Security → Rate Limiting：200 req/min/IP → Block（**免費只有 1 條 rule，不要浪費**）
- Security → Bots → Bot Fight Mode：**開啟**
- Security → WAF → Cloudflare Free Ruleset：開啟
- SSL/TLS → Edge Certs → Always Use HTTPS：開啟
- Scrape Shield → Hotlink Protection：開啟

---

### 第二步：Supabase 設定

#### 2-A. 建立專案
Supabase Dashboard → New Project → 選台灣最近的 region（Tokyo 或 Singapore）

#### 2-B. 執行 Schema
Supabase Dashboard → SQL Editor → 貼上 `packages/db/schema.sql` → Run(尚未)

**確認 Extensions 有開啟：**
- `postgis`（地理位置查詢）
- `pg_trgm`（中文模糊搜尋）

#### 2-C. 取得連線資訊
Supabase Dashboard → Settings → API：
- `Project URL` → `SUPABASE_URL`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`（**絕不放前端**）

#### 2-D. 建立 Grafana 唯讀帳號（選填）
```sql
-- 在 Supabase SQL Editor 執行
CREATE USER grafana_readonly WITH PASSWORD '你的密碼';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_readonly;
```

---

### 第三步：PMTiles 地圖 Tiles

#### 3-A. 下載台灣 PMTiles
從 Protomaps 下載台灣範圍 z0-15（約 800MB）：
- 網址：https://maps.protomaps.com/builds/ （選最新版，下載台灣 bounding box）
- 或用 pmtiles CLI：
```bash
pmtiles extract https://build.protomaps.com/20240101.pmtiles taiwan.pmtiles \
  --bbox=119,21,123,26.5 --maxzoom=15
```

#### 3-B. 上傳到 R2
```bash
npx wrangler r2 object put beggarsmap/taiwan.pmtiles --file taiwan.pmtiles
```

#### 3-C. 更新前端 PMTiles URL
`apps/web/lib/maplibre.ts` 裡的 `getTilesUrl()` 應回傳：
```
https://img.beggarsmap.tw/taiwan.pmtiles
```
確認 `NEXT_PUBLIC_IMG_HOST` 環境變數設正確。

---

### 第四步：前端環境變數

建立 `apps/web/.env.local`：
```env
NEXT_PUBLIC_IMG_HOST=https://img.beggarsmap.tw
NEXT_PUBLIC_API_URL=https://beggarsmap-api.{your-subdomain}.workers.dev
```

（部署 Workers 後會拿到 API URL；或綁定自訂域名 `api.beggarsmap.tw`）

---

### 第五步：GitHub Actions Secrets

去 GitHub repo → Settings → Secrets and variables → Actions：
```
CLOUDFLARE_API_TOKEN    # Cloudflare API Token（需要 Workers + Pages 部署權限）
CLOUDFLARE_ACCOUNT_ID   # Cloudflare Dashboard 右上角
```

建立 Cloudflare API Token：
- Cloudflare Dashboard → My Profile → API Tokens → Create Token
- 使用 "Edit Cloudflare Workers" 模板
- 加上 "Cloudflare Pages:Edit" 權限

---

### 第六步：部署

#### API（Workers）
```bash
cd apps/api
npm install
npx wrangler deploy
```

#### 前端（Cloudflare Pages）
```bash
cd apps/web
npm install
npm run build
npx wrangler pages deploy .next --project-name beggarsmap-web
```

---

### 第七步：監控設定（全免費）

| 服務 | 動作 |
|------|------|
| **Sentry** | 到 sentry.io 建立 Next.js + Cloudflare Workers 專案，取得 DSN |
| **UptimeRobot** | 監控 `https://beggarsmap.tw` + `https://api.beggarsmap.tw/internal/health` |
| **Discord** | 建立 Server → #系統通知 → 取得 Webhook URL，設定到 Sentry + UptimeRobot |
| **Grafana Cloud** | 連接 Supabase PostgreSQL datasource，建立 KPI dashboard |
| **Cloudflare Web Analytics** | Dashboard → Analytics → Web Analytics → 取得 token，填入 `app/layout.tsx` |

---

## 還需要寫的程式碼

目前沒有待寫的程式碼，**所有功能都已實作完成**。

以下是上線後 Phase 2/3 的功能：

### Phase 2（使用者系統）
- [ ] Better Auth + Google OAuth / LINE Login
- [ ] 用 users.role 替換 ADMIN_SECRET
- [ ] 餐廳舉報功能（需登入）
- [ ] GET /api/users/me/data（個資匯出）
- [ ] DELETE /api/users/me（帳號刪除）

### Phase 3（成長）
- [ ] Google AdSense 整合（Consent Banner）
- [ ] Booking.com 側欄廣告
- [ ] Beggar Index 加入 price_paid 加權演算法
- [ ] Durable Objects 原子性 rate limit（替換 KV 軟限制）
- [ ] Cloudflare Images（替換前端手動壓縮）

---

## 快速驗證清單（上線前）

部署完成後，用以下方式確認系統正常：

```bash
# 1. API 健康檢查
curl https://api.beggarsmap.tw/internal/health

# 2. 地圖資料
curl "https://api.beggarsmap.tw/api/restaurants?bbox=121.4,25.0,121.6,25.1"

# 3. Admin 登入（換成你的 ADMIN_SECRET）
# 打開 https://beggarsmap.tw/admin → 輸入密碼

# 4. 確認 PMTiles 載入
# 打開 https://beggarsmap.tw → DevTools Network → 找 taiwan.pmtiles → 確認 HTTP 206
```

---

## 本機開發流程

```bash
# 安裝依賴（在 repo 根目錄）
pnpm install

# 啟動 Workers API（本機 port 8787）
cd apps/api && npx wrangler dev

# 啟動 Next.js（本機 port 3000）
cd apps/web && npm run dev

# 跑測試
cd apps/api && npm test

# TypeScript 型別檢查
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```
