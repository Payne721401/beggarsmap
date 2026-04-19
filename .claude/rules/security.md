# 資安規範

## IP 處理：絕對不儲存原始 IP

**規則**：所有使用到 IP 的地方（DB 寫入、KV key）必須先 hash。

**How to apply**：
```typescript
// middleware/ipHash.ts
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(ip + salt);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 取得 IP（Cloudflare 環境）
const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
const ipHash = await hashIp(ip, env.IP_HASH_SALT);
```

**IP_HASH_SALT** 存於 Workers Secret，防 rainbow table 攻擊。

---

## Secrets 管理：全存 Workers Secret，絕不 hardcode

**規則**：以下任何值不得出現在程式碼或 wrangler.toml 的 [vars] 中：
- ADMIN_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- INTERNAL_CRON_SECRET
- IP_HASH_SALT
- SENTRY_DSN

**How to apply**：
```bash
wrangler secret put ADMIN_SECRET
# 在 wrangler.toml 只宣告 binding 名稱，不放值
```

---

## 圖片上傳：magic bytes 驗證

**規則**：後端 Workers 必須讀取上傳檔案前 16 bytes 驗證是合法圖片。

```typescript
// middleware/validateImage.ts
const MAGIC = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png:  [0x89, 0x50, 0x4E, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF...WEBP
};

export function validateMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 12));
  const isJpeg = MAGIC.jpeg.every((b, i) => bytes[i] === b);
  const isPng  = MAGIC.png.every((b, i) => bytes[i] === b);
  const isWebp = MAGIC.webp.every((b, i) => bytes[i] === b) &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return isJpeg || isPng || isWebp;
}
```

---

## R2 Object Key：使用 UUID，不用 filename

**規則**：`presign` 端點生成的 R2 key 必須是 `crypto.randomUUID()` + 副檔名。

**Why**：防止 path traversal；防止覆蓋現有檔案；防止 enumeration。

```typescript
// ✅ 正確
const key = `${crypto.randomUUID()}.webp`;

// ❌ 錯誤
const key = filename; // 用戶控制，危險
```

---

## Admin 驗證：Workers Secret Bearer Token（MVP）

**規則**：管理員 API 用 `Authorization: Bearer {ADMIN_SECRET}` 驗證。
ADMIN_SECRET 存於 Workers Secret（`wrangler secret put ADMIN_SECRET`）。

Phase 2 升級至 DB role 驗證（users.role = 'admin'）。

---

## Supabase RLS

**規則**：前端（瀏覽器）不得持有 `service_role` key。
- 前端用 `anon` key（受 RLS 保護，只能讀 active + 非隱藏資料）
- Workers 後端用 `service_role` key（繞過 RLS，做所有寫入）

---

## Honeypot 欄位

**規則**：新增餐廳表單、評論表單包含隱藏 honeypot input。
Workers 後端若發現該欄位有值，回傳 HTTP 400。

```html
<!-- 用 CSS 隱藏，勿用 display:none（部分 bot 會忽略）-->
<input name="_hp" tabindex="-1" autocomplete="off" style="position:absolute;opacity:0;height:0" />
```

---

## 台灣範圍驗證

**規則**：所有接受座標的端點必須驗證：
- `latitude`: 21.0 ~ 26.5
- `longitude`: 119.0 ~ 123.0

後端同步驗證（不進 Queue），直接回 HTTP 400。
