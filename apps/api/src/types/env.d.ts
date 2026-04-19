export type Env = {
  // KV Namespace
  KV: KVNamespace;
  // R2 Bucket
  R2: R2Bucket;
  // Queues
  RESTAURANT_QUEUE: Queue;
  REVIEW_QUEUE: Queue;
  // Secrets（wrangler secret put）
  ADMIN_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  INTERNAL_CRON_SECRET: string;
  IP_HASH_SALT: string;
  SENTRY_DSN?: string;
  // Vars
  ENVIRONMENT: string;
};
