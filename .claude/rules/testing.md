# 測試規範

## 測試分層

```
單元測試（Vitest）← 重要功能 100% coverage
  ├── src/lib/slug.ts          → toBaseSlug() 所有情境
  ├── src/lib/ipHash.ts        → hashIp() + getClientIp()
  └── src/middleware/validateImage.ts → magic bytes 所有格式

整合測試（手動 + CI smoke test）
  ├── API routes（需 Supabase + KV mock）
  └── Queue consumers

E2E（未來：Playwright）
  └── Phase 2 加入
```

## Coverage 要求

**以下檔案必須達到 100% line/branch/function coverage（CI 強制驗證）：**

| 檔案 | 原因 |
|------|------|
| `src/lib/slug.ts` → `toBaseSlug()` | 資安：slug 衝突處理的核心邏輯 |
| `src/lib/ipHash.ts` | 資安：IP hash 若有 bug，會洩漏或無法保護隱私 |
| `src/middleware/validateImage.ts` | 資安：magic bytes 若有 bug，惡意檔案可能上傳 |

**以下檔案採整合測試，不列入 coverage（有外部依賴）：**
- `src/routes/**`（需 Supabase、KV）
- `src/queues/**`（需 Cloudflare Queues mock）
- `src/index.ts`（Hono 主入口）

## 執行測試

```bash
# 進入 api 目錄
cd apps/api

# 執行所有測試
npm test

# 執行 + coverage 報告
npm run test:coverage

# Watch mode（開發中）
npm run test:watch
```

## CI/CD Pipeline（GitHub Actions）

**`.github/workflows/ci.yml`**

| Job | 觸發 | 內容 |
|-----|------|------|
| `api-test` | push/PR | TypeScript type check + Vitest coverage（100% 未達到 → fail）|
| `web-build` | push/PR | TypeScript type check + Next.js build check |
| `deploy-api` | push to main（api-test 通過後）| `wrangler deploy` |
| `deploy-web` | push to main（web-build 通過後）| `wrangler pages deploy` |

**必須設定的 GitHub Secrets：**
```
CLOUDFLARE_API_TOKEN    # Cloudflare API Token（Workers + Pages 部署權限）
CLOUDFLARE_ACCOUNT_ID   # Cloudflare Account ID
CF_ANALYTICS_TOKEN      # Cloudflare Web Analytics Token（選填）
```

## 手動測試清單（上線前驗證）

### 地圖
- [ ] PMTiles 從 R2/CDN 載入（DevTools Network → HTTP 206）
- [ ] 第二次載入走 Service Worker（`(ServiceWorker)`）
- [ ] 台灣範圍限制（`maxBounds` 生效）
- [ ] z15 縮放顯示街道/建物

### 新增餐廳
- [ ] 點「新增餐廳」→ 選點模式啟動（crosshair 游標）
- [ ] z15 點選地標，座標誤差 < 5m
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

### 評論
- [ ] 提交 rating:4 → HTTP 202，avg_rating 更新（trigger 驗證）
- [ ] rating:6 → HTTP 400
- [ ] comment 501 字 → HTTP 400
- [ ] Shadow ban 後提交 → HTTP 202，DB `is_hidden=TRUE`

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

### 監控
- [ ] 造訪首頁 → Cloudflare Web Analytics 有 PV
- [ ] Workers throw Error → Sentry 收到 + Discord 通知
- [ ] /internal/health → UptimeRobot 顯示 UP
- [ ] Grafana 連接 Supabase → 可查每日新增餐廳數

### Mobile
- [ ] 手機點擊 pin → Bottom Sheet 從底部滑出
- [ ] 雙指縮放地圖正常
- [ ] PWA：Chrome「加入主畫面」→ Standalone 模式
