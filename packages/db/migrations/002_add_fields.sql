-- Migration 002: 新增價格品項、乞丐加碼、雙層分類欄位

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS price_item_name  TEXT,
  ADD COLUMN IF NOT EXISTS price_amount     INTEGER CHECK (price_amount > 0 AND price_amount <= 10000),
  ADD COLUMN IF NOT EXISTS price_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS beggar_perks     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meal_types       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cuisine_types    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flag_count       INTEGER DEFAULT 0;

-- 更新 Materialized View（包含新欄位）
DROP MATERIALIZED VIEW IF EXISTS restaurant_markers;

CREATE MATERIALIZED VIEW restaurant_markers AS
SELECT
  id, name, slug, latitude, longitude,
  price_min, price_max,
  price_item_name, price_amount, price_reported_at,
  beggar_index, beggar_perks,
  categories, meal_types, cuisine_types,
  cover_image_key, avg_rating, review_count
FROM restaurants
WHERE status = 'active';

CREATE UNIQUE INDEX ON restaurant_markers(id);
CREATE INDEX ON restaurant_markers USING GIST(
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
);
CREATE INDEX ON restaurant_markers(beggar_index DESC);
CREATE INDEX ON restaurant_markers(price_amount);
