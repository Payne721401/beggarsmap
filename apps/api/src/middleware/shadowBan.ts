import type { Env } from '../types/env';
import { hashIp, getClientIp } from '../lib/ipHash';

// 回傳 true 表示已被 shadow ban
export async function checkShadowBan(env: Env, request: Request): Promise<boolean> {
  const ip = getClientIp(request);
  if (ip === 'unknown') return false;
  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  const val = await env.KV.get(`shadow_ban:${ipHash}`);
  return val !== null;
}
