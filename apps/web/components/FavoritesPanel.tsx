'use client';

import { useState, useEffect, useRef } from 'react';
import type { MarkerData } from '@/lib/api';
import { imgUrl } from '@/lib/image';
import { MOCK_MARKERS } from '@/lib/mock-data';
import { getFavorites, toggleFavorite } from '@/lib/favorites';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  markers: MarkerData[];                          // 目前地圖載入的 markers（找得到時用）
  onRestaurantSelect: (r: MarkerData) => void;
};

export default function FavoritesPanel({ isOpen, onClose, markers, onRestaurantSelect }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [favIds, setFavIds] = useState<string[]>([]);

  // 每次開啟重新讀 localStorage
  useEffect(() => {
    if (isOpen) setFavIds(getFavorites());
  }, [isOpen]);

  // 點 panel 外面關閉
  useEffect(() => {
    if (!isOpen) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // 排除「愛心按鈕」本身造成的 toggle 衝突 — 父層處理
        const t = e.target as HTMLElement;
        if (t.closest('[data-favorites-button]')) return;
        onClose();
      }
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [isOpen, onClose]);

  // 從 markers + mock 全集裡找出收藏的（mock 模式下用全集，正式模式用 markers）
  const pool: MarkerData[] = USE_MOCK ? MOCK_MARKERS : markers;
  const favorites = favIds
    .map((id) => pool.find((m) => m.id === id))
    .filter((m): m is MarkerData => Boolean(m));

  function handleRemove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    toggleFavorite(id);
    setFavIds((prev) => prev.filter((x) => x !== id));
  }

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-20"
      style={{ maxHeight: '70vh' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50">
        <div>
          <h2 className="text-base font-bold text-[#003580]">我的收藏</h2>
          <p className="text-xs text-gray-500 mt-0.5">{favorites.length} 家餐廳</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
          aria-label="關閉"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 64px)' }}>
        {favorites.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <p className="text-sm text-gray-500 leading-relaxed">
              還沒有收藏的餐廳<br />
              <span className="text-xs">點擊餐廳詳細頁右上角的 ♡ 即可收藏</span>
            </p>
          </div>
        ) : (
          favorites.map((r) => {
            const cover = imgUrl(r.cover_image_key);
            const price = r.price_amount ?? r.price_min;
            return (
              <div
                key={r.id}
                onClick={() => { onRestaurantSelect(r); onClose(); }}
                className="flex gap-3 px-3 py-3 border-b border-gray-50 hover:bg-blue-50/50 transition-colors cursor-pointer group"
              >
                {/* 縮圖 */}
                <div className="w-14 h-14 rounded-md shrink-0 overflow-hidden bg-gray-100">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#003580]/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#003580]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5l.75-3h16.5l.75 3M3 10.5h18M3 10.5v7.5a.75.75 0 00.75.75h16.5a.75.75 0 00.75-.75V10.5" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* 內容 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{r.name}</p>
                  {price ? (
                    <p className="text-sm font-bold text-[#003580] mt-1">${price}</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">未定價</p>
                  )}
                </div>

                {/* Remove */}
                <button
                  onClick={(e) => handleRemove(r.id, e)}
                  className="self-start w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="移除收藏"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
