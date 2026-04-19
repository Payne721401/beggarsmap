import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types/env';
import restaurantsRouter from './routes/restaurants';
import reviewsRouter from './routes/reviews';
import uploadRouter from './routes/upload';
import adminRouter from './routes/admin';
import { internalAuth } from './middleware/adminAuth';
import { handleRestaurantQueue } from './queues/restaurant-consumer';
import { handleReviewQueue } from './queues/review-consumer';
import { getDb } from './db/client';

type RestaurantMessage = Parameters<typeof handleRestaurantQueue>[0]['messages'][0]['body'];
type ReviewMessage = Parameters<typeof handleReviewQueue>[0]['messages'][0]['body'];

const app = new Hono<{ Bindings: Env }>();

// CORS（Next.js 前端）
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'https://beggarsmap.tw',
      'https://www.beggarsmap.tw',
      'http://localhost:3000',
    ];
    return allowed.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Routes
app.route('/api/restaurants', restaurantsRouter);
app.route('/api/restaurants', reviewsRouter);
app.route('/api/upload', uploadRouter);
app.route('/api/admin', adminRouter);

// Internal Cron Endpoint（Cloudflare Workers Cron 呼叫）
app.post('/internal/refresh-markers', internalAuth, async (c) => {
  const db = getDb(c.env);
  const { error } = await db.rpc('refresh_restaurant_markers');
  if (error) {
    console.error('Refresh markers error:', error);
    return c.json({ error: 'refresh failed' }, 500);
  }
  return c.json({ success: true, timestamp: new Date().toISOString() });
});

// Health Check
app.get('/internal/health', (c) => {
  return c.json({
    status: 'ok',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
});

// 404
app.notFound((c) => c.json({ error: 'not found' }, 404));

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default {
  // HTTP handler
  fetch: app.fetch,

  // Queue consumer
  async queue(
    batch: MessageBatch<RestaurantMessage | ReviewMessage>,
    env: Env
  ): Promise<void> {
    if (batch.queue === 'restaurant-submissions') {
      await handleRestaurantQueue(batch as MessageBatch<RestaurantMessage>, env);
    } else if (batch.queue === 'review-submissions') {
      await handleReviewQueue(batch as MessageBatch<ReviewMessage>, env);
    }
  },

  // Cron trigger（每 10 分鐘更新 Materialized View）
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const db = getDb(env);
        const { error } = await db.rpc('refresh_restaurant_markers');
        if (error) console.error('Cron refresh error:', error);
        else console.log('Materialized view refreshed at', new Date().toISOString());
      })()
    );
  },
};
