import type { Env } from '../types/env';
import { getDb } from '../db/client';

type ReviewMessage = {
  restaurant_id: string;
  ip_hash: string;
  rating: number;
  price_paid: number | null;
  comment: string | null;
  is_hidden: boolean;
};

export async function handleReviewQueue(
  batch: MessageBatch<ReviewMessage>,
  env: Env
): Promise<void> {
  const db = getDb(env);

  // 批次插入（同一 batch 內的評論）
  const reviews = batch.messages.map(m => m.body);

  const { error } = await db.from('reviews').insert(
    reviews.map(r => ({
      restaurant_id: r.restaurant_id,
      ip_hash: r.ip_hash,
      rating: r.rating,
      price_paid: r.price_paid,
      comment: r.comment,
      is_hidden: r.is_hidden,
    }))
  );

  if (error) {
    console.error('Review batch insert error:', error);
    // 整批 retry
    batch.messages.forEach(m => m.retry());
  } else {
    batch.messages.forEach(m => m.ack());
  }
}
