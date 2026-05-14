# 台灣乞丐地圖 — CLAUDE.md

## 專案概述
以地圖為核心的台灣便宜餐廳社群平台。目標：1M DAU，成本 ~$31/月。

## 技術棧

| 層 | 技術 |
|----|------|
| Frontend | Next.js 16 App Router + TypeScript + Tailwind（shadcn/ui 按需引入）|
| Map | MapLibre GL JS + Protomaps PMTiles (z0-15, ~800MB)，basemap 用 `@protomaps/basemaps` 官方套件 |
| API | Cloudflare Workers + Hono |
| Queue | Cloudflare Queues（寫入緩衝） |
| DB | Supabase PostgreSQL + PostGIS（**尚未建立 project**） |
| Storage | Cloudflare R2 → 統一 URL: `https://img.beggarsmap.tw/{key}` |
| Cache | Cloudflare CDN（GET API + tiles）+ Workers KV（shadow ban + rate limit）|
| Auth | Phase 2（MVP 不做）|

## 專案目錄

```
beggarsmap/
├── apps/
│   ├── web/          # Next.js 16
│   │   ├── app/
│   │   │   ├── page.tsx              # 主地圖頁
│   │   │   └── api/resolve-gmaps/    # 短網址解析 Next.js API route
│   │   ├── components/                # SidePanel / BottomSheet / Form / Panels...
│   │   └── lib/                       # api / favorites / reports / gmaps-parse / chains...
│   └── api/          # Cloudflare Workers (Hono) — schema 完成，routes 尚未完整
└── packages/
    └── db/
        ├── schema.sql                 # PostgreSQL schema（PostGIS + trigger + MV）
        ├── migrations/                # migration 檔案
        └── seeds/                     # Google Maps 清單匯入資料
            ├── gmaps-list-row.txt     # 原始 Google API 回應（XSSI 前綴 + JSON）
            └── gmaps-list.json        # parser 解析後的乾淨 JSON（141 家）
```

## 目前 Phase 進度（截至 2026-05 中）

### ✅ 已完成
**前端（mock 模式可完整跑）**
- 地圖：MapLibre + Protomaps，台灣 maxBounds，初始定位
- Marker：對話框氣泡形（底部尖角指座標）+ 9-patch 拉伸 + cluster
- Marker label：選中時普通 label 自動 filter 避免重疊
- 主面板 / 收藏面板 / 審判台面板（最近 14 天新增 + 被舉報多）
- 餐廳詳細：菜單/餐點圖片切換 + lightbox、編輯 modal（mock）、CP 值高低投票（含長條圖）、價格 X 人回報有誤、近期舉報、電話/營業時間區塊（有資料才顯示）、Google Maps 查看（用店名+座標搜尋）
- 新增餐廳：Google Maps 連結貼上（長/短網址都支援）、菜單/餐點圖片分開上傳、結構化營業時間（平日/週六/週日 簡易模式 + 七日獨立模式）、品項+價格必填
- Mock 資料：141 家台北 / 新北餐廳（從 Google Maps 共享清單「台北乞丐地圖」匯入，僅含基本欄位 name/lat/lng/address/google_short_id）

**後端**
- API schema 草稿、Workers 結構、Hono routes 骨架
- 純函式 100% test coverage：`slug.ts`、`ipHash.ts`、`validateImage.ts`

**測試**
- 前端 + 後端 vitest 設定，CI 強制 100% coverage（限定純函式檔案）
- 詳細測試清單見 `rules/testing.md`

### 🔜 下一步
1. **Supabase 建立 + schema.sql 跑進去** → 才能測 API
2. **API routes 完整實作**（restaurants / reviews / upload / admin）+ Queue consumer
3. **前端切回真實 API**（`NEXT_PUBLIC_USE_MOCK=false`）
4. （選擇性）補 React 元件測試 / E2E

## 重要規則（詳見 rules/）

- **寫入一律走 Queue**，不直接 INSERT → 見 rules/architecture.md
- **圖片 URL 統一格式**：`https://img.beggarsmap.tw/{key}` → 見 rules/architecture.md
- **IP 必須 hash**，絕對不存原始 IP → 見 rules/security.md
- **Secrets 全存 Workers Secret**，不 hardcode → 見 rules/security.md
- **DB 讀取用 Materialized View**，不直查 restaurants 主表 → 見 rules/database.md
- **免費層限制**追蹤 → 見 rules/cost.md
- **測試覆蓋與分層** → 見 rules/testing.md

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
NEXT_PUBLIC_USE_MOCK=true                          # 目前用 mock；接好 API 後改 false
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

- **Supabase project 尚未建立**：schema.sql、seeds 都已就緒，等建立後跑進去
- **API routes 與 DB schema 尚未完全定案**：程式碼中以 `// TODO(schema):` 標記需在定案後同步更新的位置
- **shadcn/ui**：按需引入，不預先全量安裝
- **ReportReason**：前端 localStorage 用 `not_beggar | chain_restaurant | wrong_info`；DB reports 表用不同值（`wrong_info | already_closed | too_expensive | spam | duplicate | other`）；Phase 2 接 API 時需統一
- **代表品項與價格目前為必填，但 Google 匯入的 141 家沒有此資訊**：建立 DB 時要決定是否放寬 nullable，或在匯入時批次標記為 pending
- **編輯餐廳功能尚未接後端**：UI 完整，按「儲存」只顯示 toast，Phase 2 加 PATCH 端點
- **CP 值投票目前只存 localStorage**：之後要接 cp_votes 表（schema 已預留）+ trigger
- **R2 圖片需綁自訂 domain 才能享 CDN edge cache + Range 請求**：MVP 上線前必做
