const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status });
  }
  return res.json();
}

export type SortBy = 'composite' | 'rating' | 'price';

export type ReportReason = 'not_beggar' | 'chain_restaurant' | 'wrong_info';

export type Filters = {
  q: string;
  priceMax: number | null;
  meal_types: string[];
  cuisine_types: string[];
  minRating: number;
  sortBy: SortBy;
};

export const DEFAULT_FILTERS: Filters = {
  q: '',
  priceMax: null,
  meal_types: [],
  cuisine_types: [],
  minRating: 0,
  sortBy: 'composite',
};

/**
 * 結構化營業時間：每天獨立。
 *   - "11:00-21:00"  → 該日營業時段（可多段，例：午休型店家 "11:00-14:00,17:00-21:00"）
 *   - "closed"       → 公休
 *   - null / undefined → 未知（不顯示）
 */
export type BusinessHours = {
  mon?: string | null;
  tue?: string | null;
  wed?: string | null;
  thu?: string | null;
  fri?: string | null;
  sat?: string | null;
  sun?: string | null;
};

export type MarkerData = {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  price_min: number | null;
  price_max: number | null;
  price_item_name: string | null;
  price_amount: number | null;
  price_reported_at: string | null;
  beggar_index: number;
  beggar_perks: string[];
  categories: string[];       // legacy — kept for API compatibility
  meal_types: string[];
  cuisine_types: string[];
  cover_image_key: string | null;
  avg_rating: number;
  review_count: number;
  // ── 用於審判台 / 投票顯示 ──
  created_at: string;          // ISO timestamp（餐廳被新增至本平台的時間）
  report_count: number;        // 被舉報次數（denormalized）
  cp_high_votes: number;       // 高 CP 票數
  cp_low_votes: number;        // 低 CP 票數
  price_correct_votes: number; // 價格正確票數
  price_wrong_votes: number;   // 價格有誤票數
  favorite_count: number;      // 被收藏次數（denormalized；trigger 維護）
};

export type RestaurantDetail = MarkerData & {
  address: string | null;
  status: string;
  reviews: Review[];
  flag_count?: number;
  // ── 詳細頁專屬欄位 ──
  phone: string | null;
  business_hours: BusinessHours | null;
  google_short_id: string | null;        // 例："/g/1tg76rm7" → 用於跳轉 Google 餐廳頁
  menu_image_keys: string[];             // R2 keys（菜單照）
  food_image_keys: string[];             // R2 keys（餐點照）
  recent_reports?: { reason: string; created_at: string }[];   // 近期被舉報記錄（最多 5 筆）
};

export type Review = {
  id: string;
  rating: number;
  price_paid: number | null;
  comment: string | null;
  created_at: string;
};
