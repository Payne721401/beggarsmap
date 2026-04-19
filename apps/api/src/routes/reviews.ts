import { Hono } from 'hono';
import type { Env } from '../types/env';
import { checkRateLimit, RATE_LIMITS } from '../middleware/rateLimit';
import { checkShadowBan } from '../middleware/shadowBan';
import { hashIp, getClientIp } from '../lib/ipHash';
import { getDb } from '../db/client';

const app = new Hono<{ Bindings: Env }>();

// POST /api/restaurants/:restaurantId/reviews
app.post('/:restaurantId/reviews', async (c) => {
  const restaurantId = c.req.param('restaurantId');

  const body = await c.req.json().catch(() => null);
  if (!body || body._hp) return c.json({ error: 'invalid request' }, 400);

  const { rating, price_paid, comment } = body;

  // 同步驗證
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return c.json({ error: 'rating 必須是 1~5 的整數' }, 400);
  }
  if (price_paid !== undefined && (price_paid < 1 || price_paid > 10000)) {
    return c.json({ error: 'price_paid 必須在 1~10000 TWD' }, 400);
  }
  if (comment !== undefined && typeof comment === 'string' && comment.length > 500) {
    return c.json({ error: '評論不得超過 500 字' }, 400);
  }

  // 確認餐廳存在且 active
  const db = getDb(c.env);
  const { data: restaurant } = await db
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('status', 'active')
    .single();
  if (!restaurant) return c.json({ error: 'restaurant not found' }, 404);

  // Shadow ban + Rate limit
  const isBanned = await checkShadowBan(c.env, c.req.raw);
  const { allowed } = await checkRateLimit(c.env, c.req.raw, 'add_review', RATE_LIMITS.add_review);
  if (!allowed && !isBanned) {
    return c.json({ error: '今日評論次數已達上限' }, 429);
  }

  const ip = getClientIp(c.req.raw);
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT);

  await c.env.REVIEW_QUEUE.send({
    restaurant_id: restaurantId,
    ip_hash: ipHash,
    rating,
    price_paid: price_paid ?? null,
    comment: comment?.trim() ?? null,
    is_hidden: isBanned,
  });

  return c.json({ status: 'queued', message: '評論已送出' }, 202);
});

export default app;
