# 交接文件

> 最後更新：2026-04-20

---

## 目前狀態：程式碼完成，等待外部服務設定與部署

所有程式碼已完成並推上 GitHub。Next.js build 與 TypeScript type-check 均通過（exit 0）。
**現在卡住的原因**：尚未設定 Supabase、Cloudflare Workers Secrets、PMTiles 等外部服務。

---

## 這次 session 完成的事

| 項目 | 說明 |
|------|------|
| Booking.com 風格 UI 改造 | Marker 改藍色圓角標籤、hover preview popup、側邊欄統一流程 |
| Bug 修復 | API GET 缺少新欄位（meal_types 等）、POST 未傳遞新欄位至 Queue、restaurant-consumer 型別缺漏 |
| ReportReason 不一致標記 | 前端 localStorage 與 DB schema 不同，已加 TODO(schema) 標記 |
| 測試補完 | 99 個測試，chains/reports/favorites 全部 100% coverage（含 SSR 與 localStorage 拋錯邊界） |
| GitHub 準備 | .gitignore、.gitattributes、README.md、HANDOFF.md、.env.local.example、.dev.vars.example |
| CI/CD 更新 | 補上 web-test job（100% coverage）、deploy-web 等待 web-test 通過才執行 |
| 移除 nested git repo | apps/web/.git 是 create-next-app 自動建立的，已移除，讓 monorepo 正常追蹤 |
| 初始 commit + push | 82 個檔案推上 https://github.com/Payne721401/beggarsmap |

---

## 下一步（依優先順序）

### 1. 外部服務設定（必做，才能真正跑起來）

#### Supabase
1. 建立專案（選 Tokyo 或 Singapore）
2. 確認開啟 Extensions：`postgis`、`pg_trgm`
3. SQL Editor 執行：`packages/db/schema.sql`，再執行 `packages/db/migrations/002_add_fields.sql`
4. 取得 Project URL 和 service_role key

#### Cloudflare
1. 建立 KV Namespace：`wrangler kv:namespace create "beggarsmap-kv"` → 填入 `wrangler.toml`
2. R2 bucket 已建立（`beggarsmap`），public URL：`https://pub-8d54860cb5a54b118d3b37dd17cd96ab.r2.dev`
3. 建立 Queues：`restaurant-submissions`、`review-submissions`
4. 設定 Workers Secrets（見下方指令）

#### Workers Secrets 設定指令
```bash
cd apps/api
wrangler secret put ADMIN_SECRET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put INTERNAL_CRON_SECRET
wrangler secret put IP_HASH_SALT
```

### 2. PMTiles 地圖資料

R2 上傳路徑已確認：`beggarsmap/maps/taiwan.pmtiles`
Public URL：`https://pub-8d54860cb5a54b118d3b37dd17cd96ab.r2.dev/maps/taiwan.pmtiles`

上傳指令：
```bash
# 下載台灣範圍（~800MB）
pmtiles extract https://build.protomaps.com/20250401.pmtiles taiwan.pmtiles \
  --bbox=118.0,21.0,124.0,26.5 --maxzoom=15

# 上傳（用 rclone，wrangler 對大檔案不穩定）
rclone copy taiwan.pmtiles r2:beggarsmap/maps/ --progress
```

### 3. GitHub Actions Secrets
```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CF_ANALYTICS_TOKEN（選填）
```

### 4. 部署
```bash
cd apps/api && wrangler deploy
cd apps/web && npm run build
# 前端接 Cloudflare Pages
```

---

## 已知問題 / TODO(schema) 標記位置

| 檔案 | 問題 |
|------|------|
| `apps/api/src/routes/restaurants.ts` | GET select 欄位、POST 欄位在 schema 定案後確認 |
| `apps/api/src/queues/restaurant-consumer.ts` | insertData 欄位同上 |
| `apps/web/lib/api.ts` → `ReportReason` | 前端用 `not_beggar\|chain_restaurant\|wrong_info`；DB reports 表用不同值，Phase 2 接 API 時需統一 |

---

## 沒有進 repo 但必須手動帶走的檔案

| 檔案 | 內容 |
|------|------|
| `apps/web/.env.local` | `NEXT_PUBLIC_TILES_URL`、`NEXT_PUBLIC_IMG_HOST`、`NEXT_PUBLIC_API_URL` 等 |
| `apps/api/.dev.vars` | `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_SECRET` 等 |

範本在 `.env.local.example` 和 `.dev.vars.example`。

---

## 新電腦還原指令

```bash
git clone https://github.com/Payne721401/beggarsmap.git
cd beggarsmap
pnpm install          # 或各 app 目錄執行 npm install

# 還原環境變數（從備份複製）
# apps/web/.env.local
# apps/api/.dev.vars

# 確認可以啟動
cd apps/web && npm run dev        # http://localhost:3000
cd apps/api && wrangler dev       # http://localhost:8787

# 開 mock 模式（不需要 API 也能看 UI）
# apps/web/.env.local → NEXT_PUBLIC_USE_MOCK=true
```

---

## 給新 session 的第一句 prompt

```
我從上次的工作繼續，請先讀 HANDOFF.md 和 .claude/CLAUDE.md 了解專案狀態，
然後幫我繼續設定 Supabase（執行 schema）和 Cloudflare Workers Secrets。
```
