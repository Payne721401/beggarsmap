'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

type Props = {
  restaurantId: string;
  restaurantName: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ReviewModal({ restaurantId, restaurantName, onClose, onSuccess }: Props) {
  const [rating, setRating] = useState(0);
  const [pricePaid, setPricePaid] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Honeypot
  const [_hp, setHp] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (_hp) return; // honeypot triggered
    if (rating === 0) { setError('請選擇評分'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/restaurants/${restaurantId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          rating,
          price_paid: pricePaid ? parseInt(pricePaid) : undefined,
          comment: comment.trim() || undefined,
        }),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交失敗，請稍後再試';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md p-6 shadow-xl">
        <h3 className="text-lg font-bold mb-1">撰寫評論</h3>
        <p className="text-sm text-gray-500 mb-4">{restaurantName}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot（隱藏） */}
          <input
            name="_hp"
            value={_hp}
            onChange={e => setHp(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            style={{ position: 'absolute', opacity: 0, height: 0, pointerEvents: 'none' }}
            aria-hidden="true"
          />

          {/* 星等評分 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">評分</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`text-2xl transition-transform hover:scale-110 ${
                    n <= rating ? 'text-amber-400' : 'text-gray-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* 實際消費 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              實際消費（選填）
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={pricePaid}
                onChange={e => setPricePaid(e.target.value)}
                placeholder="0"
                min={1}
                max={10000}
                className="w-full pl-7 pr-12 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">TWD</span>
            </div>
          </div>

          {/* 評論內文 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              評論（選填，最多 500 字）
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 500))}
              placeholder="分享你的用餐體驗..."
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{comment.length}/500</p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '提交中...' : '送出評論'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
