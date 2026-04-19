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
};

export type RestaurantDetail = MarkerData & {
  address: string | null;
  status: string;
  created_at: string;
  reviews: Review[];
  flag_count?: number;
};

export type Review = {
  id: string;
  rating: number;
  price_paid: number | null;
  comment: string | null;
  created_at: string;
};
