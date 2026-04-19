import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../types/env';

// Workers 後端使用 service_role key，繞過 RLS
export function getDb(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 台灣座標範圍驗證
export function isInTaiwan(lat: number, lng: number): boolean {
  return lat >= 21.0 && lat <= 26.5 && lng >= 119.0 && lng <= 123.0;
}
