import type { Env } from '../types/env';
import { getDb } from '../db/client';
import { insertWithUniqueSlug } from '../db/insertWithSlug';

// TODO(schema): 欄位清單需在 DB schema 定案後確認
type RestaurantMessage = {
  name: string;
  latitude: number;
  longitude: number;
  price_min: number | null;
  price_max: number | null;
  price_item_name: string | null;
  price_amount: number | null;
  beggar_perks: string[];
  meal_types: string[];
  cuisine_types: string[];
  categories: string[];
  address: string | null;
  cover_image_key: string | null;
  ip_hash: string;
  shadow_banned: boolean;
};

export async function handleRestaurantQueue(
  batch: MessageBatch<RestaurantMessage>,
  env: Env
): Promise<void> {
  const db = getDb(env);

  for (const message of batch.messages) {
    try {
      const payload = message.body;

      // R2 head() 確認圖片已上傳（若有 cover_image_key）
      let cover_image_key = payload.cover_image_key;
      if (cover_image_key) {
        const obj = await env.R2.head(cover_image_key);
        if (!obj) {
          // 圖片不存在，繼續但不設圖片
          console.warn(`Image not found in R2: ${cover_image_key}`);
          cover_image_key = null;
        }
      }

      // TODO(schema): 欄位清單需在 DB schema 定案後確認
      const insertData = {
        latitude: payload.latitude,
        longitude: payload.longitude,
        price_min: payload.price_min,
        price_max: payload.price_max,
        price_item_name: payload.price_item_name,
        price_amount: payload.price_amount,
        beggar_perks: payload.beggar_perks,
        meal_types: payload.meal_types,
        cuisine_types: payload.cuisine_types,
        categories: payload.categories,
        address: payload.address,
        cover_image_key,
        status: payload.shadow_banned ? 'shadow_banned' : 'pending',
      };

      await insertWithUniqueSlug(db, 'restaurants', payload.name, insertData);
      message.ack();
    } catch (err) {
      console.error('Restaurant queue error:', err);
      message.retry();
    }
  }
}
