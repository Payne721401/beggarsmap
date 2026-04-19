import { Hono } from 'hono';
import type { Env } from '../types/env';
import { getDb, isInTaiwan } from '../db/client';
import { checkRateLimit, RATE_LIMITS } from '../middleware/rateLimit';
import { checkShadowBan } from '../middleware/shadowBan';
import { hashIp, getClientIp } from '../lib/ipHash';
// Note: insertWithUniqueSlug 已移至 db/insertWithSlug.ts
// 目前 POST /api/restaurants 推入 Queue，slug 在 consumer 生成

const app = new Hono<{ Bindings: Env }>();

// GET /api/restaurants?bbox=lng1,lat1,lng2,lat2&limit=200
// 查詢 Materialized View（CDN cache 2 min）
app.get('/', async (c) => {
  const bboxStr = c.req.query('bbox');
  if (!bboxStr) return c.json({ error: 'bbox required' }, 400);

  const parts = bboxStr.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return c.json({ error: 'invalid bbox' }, 400);
  }
  const [west, south, east, north] = parts;

  const limit = Math.min(200, parseInt(c.req.query('limit') ?? '200'));

  const db = getDb(c.env);
  // TODO(schema): select 欄位需在 DB schema 定案後確認
  const { data, error } = await db
    .from('restaurant_markers')
    .select('id, name, slug, latitude, longitude, price_min, price_max, price_item_name, price_amount, price_reported_at, beggar_index, beggar_perks, categories, meal_types, cuisine_types, cover_image_key, avg_rating, review_count')
    .gte('longitude', west)
    .lte('longitude', east)
    .gte('latitude', south)
    .lte('latitude', north)
    .limit(limit);

  if (error) {
    console.error('bbox query error:', error);
    return c.json({ error: 'query failed' }, 500);
  }

  c.header('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
  return c.json(data ?? []);
});

// GET /api/restaurants/search?q=&sort=price|beggar|rating&min_price=&max_price=&cursor=
app.get('/search', async (c) => {
  const q = c.req.query('q') ?? '';
  const sort = c.req.query('sort') ?? 'beggar';
  const minPrice = c.req.query('min_price') ? parseInt(c.req.query('min_price')!) : undefined;
  const maxPrice = c.req.query('max_price') ? parseInt(c.req.query('max_price')!) : undefined;
  const cursor = c.req.query('cursor') ? parseInt(c.req.query('cursor')!) : 0;
  const pageSize = 20;

  const db = getDb(c.env);
  // TODO(schema): select 欄位需在 DB schema 定案後確認
  let query = db
    .from('restaurant_markers')
    .select('id, name, slug, latitude, longitude, price_min, price_max, price_item_name, price_amount, price_reported_at, beggar_index, beggar_perks, categories, meal_types, cuisine_types, cover_image_key, avg_rating, review_count');

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }
  if (minPrice !== undefined) {
    query = query.gte('price_min', minPrice);
  }
  if (maxPrice !== undefined) {
    query = query.lte('price_min', maxPrice);
  }

  const orderMap: Record<string, string> = {
    price: 'price_min',
    beggar: 'beggar_index',
    rating: 'avg_rating',
  };
  const orderCol = orderMap[sort] ?? 'beggar_index';
  query = query.order(orderCol, { ascending: sort === 'price' }).range(cursor, cursor + pageSize - 1);

  const { data, error } = await query;
  if (error) return c.json({ error: 'query failed' }, 500);

  const nextCursor = (data?.length ?? 0) === pageSize ? cursor + pageSize : null;

  c.header('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=60');
  return c.json({ data: data ?? [], nextCursor });
});

// GET /api/restaurants/by-slug/:slug
app.get('/by-slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);

  const { data: restaurant, error } = await db
    .from('restaurants')
    .select('id, name, slug, latitude, longitude, price_min, price_max, beggar_index, categories, cover_image_key, address, avg_rating, review_count, status, created_at')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error || !restaurant) return c.json({ error: 'not found' }, 404);

  const { data: reviews } = await db
    .from('reviews')
    .select('id, rating, price_paid, comment, created_at')
    .eq('restaurant_id', restaurant.id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(10);

  c.header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  return c.json({ ...restaurant, reviews: reviews ?? [] });
});

// GET /api/restaurants/:id
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb(c.env);

  const { data: restaurant, error } = await db
    .from('restaurants')
    .select('id, name, slug, latitude, longitude, price_min, price_max, beggar_index, categories, cover_image_key, address, avg_rating, review_count, status, created_at')
    .eq('id', id)
    .eq('status', 'active')
    .single();

  if (error || !restaurant) return c.json({ error: 'not found' }, 404);

  const { data: reviews } = await db
    .from('reviews')
    .select('id, rating, price_paid, comment, created_at')
    .eq('restaurant_id', id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(10);

  c.header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  return c.json({ ...restaurant, reviews: reviews ?? [] });
});

// POST /api/restaurants（匿名，Queue 緩衝）
app.post('/', async (c) => {
  // Honeypot 檢查
  const body = await c.req.json().catch(() => null);
  if (!body || body._hp) return c.json({ error: 'invalid request' }, 400);

  // 同步驗證（不進 Queue）
  // TODO(schema): 欄位清單需在 DB schema 定案後確認
  const {
    name, latitude, longitude,
    price_min, price_max,
    price_item_name, price_amount,
    beggar_perks,
    meal_types, cuisine_types,
    categories, address, cover_image_key,
  } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return c.json({ error: '請輸入餐廳名稱' }, 400);
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return c.json({ error: '無效座標' }, 400);
  }
  if (!isInTaiwan(latitude, longitude)) {
    return c.json({ error: '位置必須在台灣範圍內' }, 400);
  }
  if (price_min !== undefined && (price_min < 1 || price_min > 3000)) {
    return c.json({ error: 'price_min 必須在 1~3000 TWD' }, 400);
  }

  // Shadow ban 檢查
  const isBanned = await checkShadowBan(c.env, c.req.raw);

  // KV Rate limit
  const { allowed } = await checkRateLimit(c.env, c.req.raw, 'add_restaurant', RATE_LIMITS.add_restaurant);
  if (!allowed && !isBanned) {
    return c.json({ error: '今日提交次數已達上限，請明天再試' }, 429);
  }

  const ip = getClientIp(c.req.raw);
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT);

  // 推入 Queue（含 shadow_banned 標記）
  await c.env.RESTAURANT_QUEUE.send({
    name: name.trim(),
    latitude,
    longitude,
    price_min: price_min ?? null,
    price_max: price_max ?? null,
    price_item_name: typeof price_item_name === 'string' ? price_item_name.trim() : null,
    price_amount: typeof price_amount === 'number' ? price_amount : null,
    beggar_perks: Array.isArray(beggar_perks) ? beggar_perks : [],
    meal_types: Array.isArray(meal_types) ? meal_types : [],
    cuisine_types: Array.isArray(cuisine_types) ? cuisine_types : [],
    categories: Array.isArray(categories) ? categories : [],
    address: address?.trim() ?? null,
    cover_image_key: cover_image_key ?? null,
    ip_hash: ipHash,
    shadow_banned: isBanned,
  });

  return c.json({ status: 'queued', message: '餐廳已送出審核' }, 202);
});

export default app;
