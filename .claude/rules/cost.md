# 成本控制規範

## 免費層限制（MVP 初期）

| 服務 | 免費限制 | 目前用量追蹤 |
|------|---------|------------|
| Cloudflare Workers | 100k req/day | 查 Cloudflare Dashboard |
| Cloudflare KV | 100k read+write ops/day | 查 KV Analytics |
| Cloudflare R2 | 10GB storage, 1M Class A ops/month | 查 R2 Usage |
| Cloudflare Queues | 1M msg/month | 查 Queues Metrics |
| Supabase | 500MB DB, 2GB bandwidth/month | 查 Supabase Dashboard |
| Sentry | 5k errors/month | 查 Sentry Usage |

## 升級觸發條件

| 觸發 | 行動 |
|------|------|
| Workers > 80k req/day | 升級至 Workers Paid ($5/月) |
| KV > 80k ops/day | 審查 KV 使用，優化或升級 |
| R2 storage > 8GB | 考慮圖片壓縮策略或升級 |
| Supabase DB > 400MB | 考慮清理舊資料或升級 Pro ($25/月) |
| Supabase bandwidth > 1.5GB/月 | 檢查 CDN cache 設定，或升級 |

## 成本最小化原則

### GET 請求（最多）
- CDN cache 保護所有 GET API：`s-maxage=120~300`
- 目標 cache hit rate > 70%
- PMTiles 完全走 CDN，不過 Workers

### 寫入請求（少）
- 全走 Queue 緩衝，避免 Supabase 連線尖峰
- KV 寫入：只在 POST 端點執行（rate limit check）

### 圖片
- 前端壓縮至 ≤1MB 再上傳
- 使用 presigned URL 直接上傳 R2（不過 Workers，節省 invocations）
- 長期：升級後改用 Cloudflare Images（自動 WebP + resize）

### DB 查詢
- 地圖 markers 查 Materialized View（預計算，快）
- 搜尋用 GIN trigram index（中文模糊搜尋）
- 避免 N+1 查詢

## 監控告警

Cloudflare Dashboard 設定 Notification：
- Workers Error Rate > 5% → Email + Discord
- Workers Requests > 80k/day → Email

Sentry → Discord Webhook（ERROR 等級即時通知）
UptimeRobot → Discord（停機通知）
