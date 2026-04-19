-- 台灣乞丐地圖 — PostgreSQL Schema
-- 在 Supabase SQL Editor 執行
-- 需要 PostGIS 擴充套件（Supabase 預設已啟用）

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 中文模糊搜尋

-- ============================================================
-- 使用者表（Phase 2 加入，MVP 先建立備用）
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT UNIQUE,
  username          TEXT UNIQUE,
  display_name      TEXT,
  avatar_url        TEXT,
  auth_provider     TEXT DEFAULT 'email' CHECK (auth_provider IN ('email','google','line')),
  role              TEXT DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  is_banned         BOOLEAN DEFAULT FALSE,
  shadow_banned     BOOLEAN DEFAULT FALSE,
  contribution_score INTEGER DEFAULT 0,
  deleted_at        TIMESTAMPTZ,  -- 軟刪除（個資法合規）
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 餐廳主表
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  latitude        DECIMAL(9,6) NOT NULL CHECK (latitude BETWEEN 21 AND 26.5),
  longitude       DECIMAL(9,6) NOT NULL CHECK (longitude BETWEEN 119 AND 123),
  -- 地理空間欄位（自動從經緯度計算）
  location        GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
                    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                  ) STORED,
  price_min       INTEGER CHECK (price_min > 0 AND price_min <= 3000),
  price_max       INTEGER CHECK (price_max > 0 AND price_max <= 10000),
  -- 代表品項價格（新版）
  price_item_name TEXT,
  price_amount    INTEGER CHECK (price_amount > 0 AND price_amount <= 10000),
  price_reported_at TIMESTAMPTZ,
  -- 乞丐指數：0.0~5.0，同 Google 五星評分
  -- Phase 1：= avg_rating
  -- Phase 3：加入 price_paid CP 值加權
  beggar_index    DECIMAL(2,1) DEFAULT 0.0 CHECK (beggar_index >= 0 AND beggar_index <= 5),
  -- 乞丐加碼：免費加飯/加菜/飲料/自助吧
  beggar_perks    TEXT[] DEFAULT '{}',
  -- 分類（legacy）：便當/麵食/小吃等
  categories      TEXT[] DEFAULT '{}',
  -- 雙層分類
  meal_types      TEXT[] DEFAULT '{}',   -- 早餐/午餐/晚餐/小吃/甜點/宵夜/咖啡廳/素食/其他
  cuisine_types   TEXT[] DEFAULT '{}',   -- 中式/西式/義式/日式/韓式/異國/合菜/便當/自助餐/火鍋/麵食/飲品&咖啡/健康餐/其他
  flag_count      INTEGER DEFAULT 0,
  cover_image_key TEXT,        -- R2 object key（顯示：IMG_HOST + key）
  image_keys      TEXT[] DEFAULT '{}',  -- 最多 5 張
  address         TEXT,        -- 手動輸入地址（選填）
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('active', 'pending', 'rejected', 'shadow_banned')),
  report_count    INTEGER DEFAULT 0,
  review_count    INTEGER DEFAULT 0,  -- denormalized，by trigger 維護
  avg_rating      DECIMAL(2,1) DEFAULT 0,  -- denormalized，by trigger 維護
  submitted_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_restaurants_location
  ON restaurants USING GIST(location);  -- bbox 空間查詢核心索引

CREATE INDEX IF NOT EXISTS idx_restaurants_status
  ON restaurants(status);

CREATE INDEX IF NOT EXISTS idx_restaurants_beggar
  ON restaurants(beggar_index DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_restaurants_price
  ON restaurants(price_min)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm
  ON restaurants USING GIN(name gin_trgm_ops);  -- 中文模糊搜尋

-- ============================================================
-- 評論表（MVP 匿名）
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,  -- Phase 2
  session_id      TEXT,         -- 匿名 session 指紋（選填）
  ip_hash         TEXT NOT NULL,  -- SHA-256(IP + SALT)，不存原始 IP
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  price_paid      INTEGER CHECK (price_paid > 0 AND price_paid <= 10000),
  comment         TEXT CHECK (char_length(comment) <= 500),
  is_hidden       BOOLEAN DEFAULT FALSE,  -- shadow ban 隱藏
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant
  ON reviews(restaurant_id, is_hidden, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_dedup
  ON reviews(restaurant_id, ip_hash);  -- 防同 IP 重複評論

-- ============================================================
-- 舉報表（Phase 2，需登入）
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reporter_id     UUID NOT NULL REFERENCES users(id),
  reason          TEXT NOT NULL CHECK (reason IN (
                    'wrong_info',     -- 資訊錯誤
                    'already_closed', -- 已歇業
                    'too_expensive',  -- 價格不符
                    'spam',           -- 垃圾/廣告
                    'duplicate',      -- 重複
                    'other'
                  )),
  details         TEXT CHECK (char_length(details) <= 300),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, reporter_id)  -- 每人每店只能舉報一次
);

-- ============================================================
-- 地圖標記 Materialized View（快取，每 10 分鐘更新）
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS restaurant_markers AS
SELECT
  id, name, slug, latitude, longitude,
  price_min, price_max,
  price_item_name, price_amount, price_reported_at,
  beggar_index, beggar_perks,
  categories, meal_types, cuisine_types,
  cover_image_key, avg_rating, review_count
FROM restaurants
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_restaurants_id ON restaurant_markers(id);

CREATE INDEX IF NOT EXISTS idx_mv_restaurants_location ON restaurant_markers
USING GIST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography);

-- ============================================================
-- Supabase RPC function（讓 Workers Cron 可以呼叫更新 MV）
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_restaurant_markers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- 以 owner 身份執行，繞過 RLS
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY restaurant_markers;
END;
$$;

-- ============================================================
-- Stats Trigger（評論新增/更新時自動更新 denormalized 欄位）
-- beggar_index Phase 1 = avg_rating
-- Phase 3 預留：加入 price_paid CP 值計算
-- ============================================================
CREATE OR REPLACE FUNCTION update_restaurant_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE restaurants SET
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE restaurant_id = NEW.restaurant_id AND is_hidden = FALSE
    ),
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews
      WHERE restaurant_id = NEW.restaurant_id AND is_hidden = FALSE
    ), 0),
    beggar_index = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews
      WHERE restaurant_id = NEW.restaurant_id AND is_hidden = FALSE
    ), 0),
    updated_at = NOW()
  WHERE id = NEW.restaurant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stats ON reviews;
CREATE TRIGGER trg_update_stats
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_restaurant_stats();

-- ============================================================
-- Row Level Security（RLS）
-- Workers 後端使用 service_role key 繞過 RLS
-- 前端使用 anon key，受 RLS 保護
-- ============================================================
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 公開讀取 active 餐廳
CREATE POLICY IF NOT EXISTS "public_read_active_restaurants"
  ON restaurants FOR SELECT
  USING (status = 'active');

-- 公開讀取非隱藏評論
CREATE POLICY IF NOT EXISTS "public_read_visible_reviews"
  ON reviews FOR SELECT
  USING (is_hidden = FALSE);

-- 唯讀用戶（Grafana 監控用）
-- 執行：在 Supabase Dashboard → Database → Roles 建立
-- CREATE ROLE readonly_user WITH LOGIN PASSWORD '...';
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
