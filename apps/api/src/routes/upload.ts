import { Hono } from 'hono';
import type { Env } from '../types/env';
import { validateMagicBytes, MAX_IMAGE_SIZE } from '../middleware/validateImage';
import { checkRateLimit, RATE_LIMITS } from '../middleware/rateLimit';

const app = new Hono<{ Bindings: Env }>();
const PRESIGNED_TTL_SECONDS = 300; // 5 分鐘有效

// POST /api/upload/presign
// 兩段式上傳：Worker 驗證 → 回傳 R2 presigned PUT URL
app.post('/presign', async (c) => {
  // Rate limit
  const { allowed } = await checkRateLimit(c.env, c.req.raw, 'upload', RATE_LIMITS.upload);
  if (!allowed) return c.json({ error: '今日上傳次數已達上限' }, 429);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'invalid request' }, 400);

  const { contentType, sizeBytes } = body;

  // MIME type 白名單
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(contentType)) {
    return c.json({ error: '只支援 JPEG、PNG、WebP 格式' }, 400);
  }

  // 大小限制
  if (typeof sizeBytes !== 'number' || sizeBytes > MAX_IMAGE_SIZE) {
    return c.json({ error: `檔案大小不得超過 ${MAX_IMAGE_SIZE / 1024 / 1024}MB` }, 400);
  }

  // 驗證 magic bytes（若前端有傳 base64 header）
  if (body.magicBytes) {
    const bytes = Uint8Array.from(atob(body.magicBytes), c => c.charCodeAt(0));
    if (!validateMagicBytes(bytes.buffer)) {
      return c.json({ error: '無效的圖片格式' }, 400);
    }
  }

  // 生成 R2 presigned URL
  // R2 object key 使用 UUID（不用 filename，防 path traversal）
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/jpeg' ? 'jpg' : 'webp';
  const tempKey = `${crypto.randomUUID()}.${ext}`;

  const presignedPutUrl = await c.env.R2.createMultipartUpload
    ? await createR2PresignedUrl(c.env.R2, tempKey, contentType, PRESIGNED_TTL_SECONDS)
    : null;

  if (!presignedPutUrl) {
    // Fallback：Workers 直接接收並上傳至 R2
    // （本地開發環境 R2 可能不支援 presigned URL）
    return c.json({ presignedPutUrl: null, tempKey, directUpload: true });
  }

  return c.json({ presignedPutUrl, tempKey });
});

// 直接上傳 endpoint（fallback，用於本地開發）
app.put('/direct/:key', async (c) => {
  const key = c.req.param('key');
  const buffer = await c.req.arrayBuffer();

  // Magic bytes 驗證
  if (!validateMagicBytes(buffer)) {
    return c.json({ error: '無效的圖片格式' }, 400);
  }
  if (buffer.byteLength > MAX_IMAGE_SIZE) {
    return c.json({ error: '檔案過大' }, 400);
  }

  const contentType = c.req.header('Content-Type') ?? 'image/webp';
  await c.env.R2.put(key, buffer, { httpMetadata: { contentType } });
  return c.json({ success: true, key });
});

// Cloudflare Workers R2 presigned URL helper
async function createR2PresignedUrl(
  r2: R2Bucket,
  key: string,
  contentType: string,
  expiresIn: number
): Promise<string | null> {
  try {
    // @ts-expect-error: createPresignedUrl is available in Workers runtime
    return await r2.createPresignedUrl(key, {
      method: 'PUT',
      expiresIn,
      httpFields: { 'content-type': contentType },
    });
  } catch {
    return null;
  }
}

export default app;
