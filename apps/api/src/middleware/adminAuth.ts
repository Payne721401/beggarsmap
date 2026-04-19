import type { Context, Next } from 'hono';
import type { Env } from '../types/env';

// Bearer Token 驗證（Workers Secret）
// MVP 方案：單一 ADMIN_SECRET token
// Phase 2：升級至 DB role 驗證（users.role = 'admin'）
export async function adminAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || token !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
}

// Internal cron 端點保護（X-Internal-Secret header）
export async function internalAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const secret = c.req.header('X-Internal-Secret') ?? '';
  if (secret !== c.env.INTERNAL_CRON_SECRET) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return next();
}
