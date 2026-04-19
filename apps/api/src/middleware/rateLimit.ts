import type { Env } from '../types/env';
import { hashIp, getClientIp } from '../lib/ipHash';

type RateLimitConfig = {
  limit: number;
  ttlSeconds: number;
};

// KV-based 軟限制（已知 race condition，見 rules/architecture.md）
// 補充：Cloudflare 全域 1 Rule 做硬 DoS 防護
export async function checkRateLimit(
  env: Env,
  request: Request,
  endpoint: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number }> {
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  const key = `rate:${endpoint}:${ipHash}`;

  const current = parseInt((await env.KV.get(key)) ?? '0');
  if (current >= config.limit) {
    return { allowed: false, remaining: 0 };
  }

  await env.KV.put(key, String(current + 1), { expirationTtl: config.ttlSeconds });
  return { allowed: true, remaining: config.limit - current - 1 };
}

export const RATE_LIMITS = {
  add_restaurant: { limit: 3, ttlSeconds: 86400 },    // 3 次/天
  add_review: { limit: 10, ttlSeconds: 86400 },        // 10 次/天
  upload: { limit: 10, ttlSeconds: 86400 },            // 10 次/天
} as const;
