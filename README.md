# 乞丐地圖 · BeggarsMap

以地圖為核心的台灣便宜餐廳社群平台。使用者可以瀏覽、新增、評論餐廳，並對價格與 CP 值進行投票。

## 特色

- 自託管 Protomaps PMTiles 台灣圖磚，無第三方地圖 API 限制
- 寫入經 Cloudflare Queue 緩衝，承受流量尖峰
- 讀取走 Materialized View，地圖 bbox 查詢延遲極低
- 匿名評論、IP hash 去重，符合個資合規

## 技術棧

| 層 | 技術 |
|----|------|
| Frontend | Next.js 16 App Router · TypeScript · Tailwind CSS |
| Map | MapLibre GL JS · Protomaps PMTiles |
| API | Cloudflare Workers · Hono |
| Queue | Cloudflare Queues |
| Database | Supabase PostgreSQL + PostGIS |
| Storage | Cloudflare R2 |
| Cache | Cloudflare CDN · Workers KV |

## 專案結構

```
beggarsmap/
├── apps/
│   ├── web/          Next.js 16 前端
│   └── api/          Cloudflare Workers API
└── packages/
    └── db/
        ├── schema.sql
        ├── migrations/
        └── seeds/
```

## 快速開始

### 必要環境
- Node.js 20+
- pnpm 9+

### 安裝

```bash
pnpm install
```

### 環境變數

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

填入兩個檔案中的 Supabase URL、R2 endpoint、Workers Secrets 等值。

### 啟動 dev server

```bash
pnpm dev:web    # http://localhost:3000
pnpm dev:api    # http://localhost:8787
```

不需要 API 也能瀏覽 UI，使用 mock 資料：

```env
# apps/web/.env.local
NEXT_PUBLIC_USE_MOCK=true
```

### 測試

```bash
cd apps/api && pnpm test:coverage
cd apps/web && pnpm test:coverage
```

純函式檔案 (`lib/slug`, `lib/ipHash`, `middleware/validateImage`,
`lib/chains`, `lib/favorites`, `lib/reports`, `lib/gmaps-parse`) 強制 100%
line / branch / function / statement coverage。

完整測試規範見 [`.claude/rules/testing.md`](.claude/rules/testing.md)。

## 部署

### Cloudflare 服務建立

```bash
cd apps/api

npx wrangler kv:namespace create "beggarsmap-kv"
npx wrangler kv:namespace create "beggarsmap-kv" --preview
# 把回傳的 ID 填入 wrangler.toml 的 [[kv_namespaces]]

npx wrangler queues create restaurant-submissions
npx wrangler queues create review-submissions
```

Dashboard 手動設定：

- R2 → 建立 bucket `beggarsmap` → 綁定 custom domain `img.beggarsmap.tw`
- Security → Rate Limiting：200 req/min/IP → Block
- Security → Bots → Bot Fight Mode：開啟
- Security → WAF → Cloudflare Free Ruleset：開啟
- SSL/TLS → Edge Certs → Always Use HTTPS：開啟
- Scrape Shield → Hotlink Protection：開啟

### Workers Secrets

```bash
cd apps/api
wrangler secret put ADMIN_SECRET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put INTERNAL_CRON_SECRET
wrangler secret put IP_HASH_SALT
wrangler secret put SENTRY_DSN
```

### Supabase

1. 建立 project（建議選用 Tokyo 或 Singapore region）
2. 確認 Extensions 已啟用：`postgis`、`pg_trgm`
3. SQL Editor 依序執行：
   - `packages/db/schema.sql`
   - `packages/db/migrations/002_add_fields.sql`

Grafana 連接用唯讀角色：

```sql
CREATE USER grafana_readonly WITH PASSWORD 'YOUR_PASSWORD';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_readonly;
```

### 圖磚上傳

```bash
pmtiles extract \
  https://build.protomaps.com/20250401.pmtiles \
  taiwan.pmtiles \
  --bbox=118.0,21.0,124.0,26.5 \
  --maxzoom=15

rclone copy taiwan.pmtiles r2:beggarsmap/maps/ --progress
```

### 部署 API 與前端

```bash
cd apps/api && pnpm deploy

cd apps/web && pnpm build
npx wrangler pages deploy .next --project-name beggarsmap-web
```

### 上線驗證

```bash
curl https://api.beggarsmap.tw/internal/health
curl "https://api.beggarsmap.tw/api/restaurants?bbox=121.4,25.0,121.6,25.1"
```

## GitHub Actions

CI/CD pipeline 定義於 `.github/workflows/ci.yml`，於 push 至 `main`
觸發。需於 GitHub repo Settings → Secrets and variables → Actions
設定：

```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CF_ANALYTICS_TOKEN
```

API Token 權限需求：Edit Cloudflare Workers + Cloudflare Pages:Edit。

## 監控

| 服務 | 用途 |
|------|------|
| Sentry | 例外追蹤（Next.js + Workers） |
| UptimeRobot | 端點可用性監控 |
| Discord Webhook | 告警通知接收 |
| Grafana Cloud | Supabase metrics dashboard |
| Cloudflare Web Analytics | 前端 PV / 訪客數 |

## 架構規範

- 業務寫入經 Cloudflare Queue 緩衝，不直接 INSERT 至 Supabase
- 地圖讀取查 `restaurant_markers` Materialized View，不直查主表
- 任何 IP 在使用前必經 SHA-256 + salt hash，原始 IP 不入庫
- Secrets 一律使用 `wrangler secret`，不寫入 `wrangler.toml` 或程式碼

詳見 [`.claude/rules/`](.claude/rules/)。

## License

TBD
