import { Hono } from 'hono';
import type { Env } from '../types/env';
import { adminAuth } from '../middleware/adminAuth';
import { getDb } from '../db/client';

const app = new Hono<{ Bindings: Env }>();

// 所有 admin 路由需要 Bearer Token 驗證
app.use('*', adminAuth);

// GET /api/admin/restaurants?status=pending
app.get('/restaurants', async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const validStatuses = ['pending', 'active', 'rejected', 'shadow_banned'];
  if (!validStatuses.includes(status)) {
    return c.json({ error: 'invalid status' }, 400);
  }

  const db = getDb(c.env);
  const { data, error } = await db
    .from('restaurants')
    .select('id, name, slug, latitude, longitude, price_min, price_max, categories, address, cover_image_key, status, report_count, review_count, submitted_by, created_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return c.json({ error: 'query failed' }, 500);
  return c.json(data ?? []);
});

// PUT /api/admin/restaurants/:id/status
app.put('/restaurants/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'invalid request' }, 400);

  const validStatuses = ['active', 'pending', 'rejected', 'shadow_banned'];
  if (!validStatuses.includes(body.status)) {
    return c.json({ error: 'invalid status' }, 400);
  }

  const db = getDb(c.env);
  const { error } = await db
    .from('restaurants')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return c.json({ error: 'update failed' }, 500);
  return c.json({ success: true });
});

// POST /api/admin/shadow-ban
// 對特定 ip_hash 設定 shadow ban
app.post('/shadow-ban', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.ip_hash) return c.json({ error: 'ip_hash required' }, 400);

  const ttl = 60 * 60 * 24 * 30; // 30 天
  await c.env.KV.put(`shadow_ban:${body.ip_hash}`, '1', { expirationTtl: ttl });

  return c.json({ success: true, message: `shadow ban set for ${body.ip_hash}` });
});

// DELETE /api/admin/shadow-ban/:ipHash
app.delete('/shadow-ban/:ipHash', async (c) => {
  const ipHash = c.req.param('ipHash');
  await c.env.KV.delete(`shadow_ban:${ipHash}`);
  return c.json({ success: true });
});

// GET /api/admin/stats
app.get('/stats', async (c) => {
  const db = getDb(c.env);

  const [pendingRes, activeRes, reviewsRes] = await Promise.all([
    db.from('restaurants').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('restaurants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('reviews').select('id', { count: 'exact', head: true }),
  ]);

  return c.json({
    pending_restaurants: pendingRes.count ?? 0,
    active_restaurants: activeRes.count ?? 0,
    total_reviews: reviewsRes.count ?? 0,
  });
});

export default app;
