# 台灣乞丐地圖 — CLAUDE.md

## 專案概述
以地圖為核心的台灣便宜餐廳社群平台。目標：1M DAU，成本 ~$31/月。

## 技術棧

| 層 | 技術 |
|----|------|
| Frontend | Next.js 16 App Router + TypeScript + Tailwind（shadcn/ui 按需引入）|
| Map | MapLibre GL JS + Protomaps PMTiles (z0-15, ~800MB) |
| API | Cloudflare Workers + Hono |
| Queue | Cloudflare Queues（寫入緩衝） |
| DB | Supabase PostgreSQL + PostGIS |
| Storage | Cloudflare R2 → 統一 URL: `https://img.beggarsmap.tw/{key}` |
| Cache | Cloudflare CDN（GET API + tiles）+ Workers KV（shadow ban + rate limit）|
| Auth | Phase 2（MVP 不做）|

## 專案目錄

```
beggarsmap/
├── apps/
│   ├── web/          # Next.js 16
│   └── api/          # Cloudflare Workers (Hono)
└── packages/
    └── db/           # schema.sql + migrations
```

## 重要規則（詳見 rules/）

- **寫入一律走 Queue**，不直接 INSERT → 見 rules/architecture.md
- **圖片 URL 統一格式**：`https://img.beggarsmap.tw/{key}` → 見 rules/architecture.md
- **IP 必須 hash**，絕對不存原始 IP → 見 rules/security.md
- **Secrets 全存 Workers Secret**，不 hardcode → 見 rules/security.md
- **DB 讀取用 Materialized View**，不直查 restaurants 主表 → 見 rules/database.md
- **免費層限制**追蹤 → 見 rules/cost.md

## 環境變數（Workers Secret）

```
ADMIN_SECRET              # 管理員 Bearer Token
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY # 跳過 RLS
INTERNAL_CRON_SECRET      # Cron 端點保護
IP_HASH_SALT              # 防 rainbow table
SENTRY_DSN
```

```
# apps/web/.env.local（開發用）
NEXT_PUBLIC_IMG_HOST=https://pub-xxx.r2.dev        # 生產: https://img.beggarsmap.tw
NEXT_PUBLIC_R2_HOST=https://pub-xxx.r2.dev         # 同上（tiles 也從這裡抓）
NEXT_PUBLIC_TILES_URL=https://pub-xxx.r2.dev/maps/taiwan.pmtiles  # 直接指定完整 URL
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_USE_MOCK=false                         # true = 使用 mock-data，不呼叫 API
```

```
# apps/api/.dev.vars（Workers 本機開發用，等同 wrangler secret）
ADMIN_SECRET=dev-admin-secret
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
INTERNAL_CRON_SECRET=dev-cron-secret
IP_HASH_SALT=dev-salt-change-in-production
```

## ⚠️ 待定事項

- **API routes 與 DB schema 尚未完全定案**：程式碼中以 `// TODO(schema):` 標記需在定案後同步更新的位置
- **shadcn/ui**：按需引入，不預先全量安裝
- **ReportReason**：前端 localStorage 用 `not_beggar | chain_restaurant | wrong_info`；DB reports 表用不同值，Phase 2 接 API 時需統一
