# 乞丐地圖 — 台灣便宜餐廳地圖

以地圖為核心的台灣便宜餐廳社群平台。

## 技術棧

| 層 | 技術 |
|----|------|
| Frontend | Next.js 16 App Router · TypeScript · Tailwind CSS |
| Map | MapLibre GL JS · Protomaps PMTiles |
| API | Cloudflare Workers · Hono |
| Queue | Cloudflare Queues |
| DB | Supabase PostgreSQL + PostGIS |
| Storage | Cloudflare R2 |
| Cache | Cloudflare CDN · Workers KV |

## 專案結構

```
beggarsmap/
├── apps/
│   ├── web/          # Next.js 16 前端
│   └── api/          # Cloudflare Workers API
└── packages/
    └── db/           # schema.sql + migrations
```

## 開始開發

### 環境需求

- Node.js 20+
- pnpm 9+

### 安裝

```bash
pnpm install
```

### 環境變數

```bash
# 前端
cp apps/web/.env.local.example apps/web/.env.local
# 編輯 apps/web/.env.local，填入 R2 URL 等

# API
cp apps/api/.dev.vars.example apps/api/.dev.vars
# 編輯 apps/api/.dev.vars，填入 Supabase、Secrets 等
```

### 啟動開發伺服器

```bash
# 前端（http://localhost:3000）
pnpm dev:web

# API（http://localhost:8787）
pnpm dev:api
```

開發初期可先用 Mock 模式跳過 API：
```bash
# apps/web/.env.local
NEXT_PUBLIC_USE_MOCK=true
```

### 執行測試

```bash
# API 單元測試（100% coverage 要求）
cd apps/api && pnpm test:coverage

# Web 單元測試（chains / reports / favorites）
cd apps/web && pnpm test:coverage
```

## 地圖資料（PMTiles）

台灣 PMTiles 檔案約 800MB，存放於 Cloudflare R2，不進 git repo。

```bash
# 從 Protomaps 裁切台灣範圍
pmtiles extract \
  https://build.protomaps.com/20250401.pmtiles \
  taiwan.pmtiles \
  --bbox=118.0,21.0,124.0,26.5 \
  --maxzoom=15

# 上傳至 R2
rclone copy taiwan.pmtiles r2:beggarsmap/maps/ --progress
```

## 部署

### API（Cloudflare Workers）

```bash
# 設定 Secrets
wrangler secret put ADMIN_SECRET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put INTERNAL_CRON_SECRET
wrangler secret put IP_HASH_SALT

# 部署
cd apps/api && pnpm deploy
```

### 前端（Cloudflare Pages）

```bash
cd apps/web && pnpm build
# 於 Cloudflare Dashboard 設定 Pages 部署，或使用 wrangler pages deploy
```

## 資料庫

```bash
# 在 Supabase SQL Editor 依序執行：
packages/db/schema.sql            # 初次建立
packages/db/migrations/002_add_fields.sql  # 欄位更新
```

## 架構重點

- **寫入走 Queue**：所有 POST 業務寫入推入 Cloudflare Queue，不直接打 Supabase
- **讀取查 MV**：`GET /api/restaurants` 查 `restaurant_markers` Materialized View，每 10 分鐘更新
- **IP 必須 hash**：任何使用 IP 的地方都先 SHA-256 hash，不存原始 IP
- **Secrets 存 Workers Secret**：不 hardcode、不放 wrangler.toml

詳細規範見 `.claude/rules/`。

## 注意事項

> ⚠️ API routes 與 DB schema 尚未完全定案。程式碼中以 `// TODO(schema):` 標記待確認位置。
