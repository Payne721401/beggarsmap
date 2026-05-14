'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { MarkerData } from '@/lib/api';
import { imgUrl } from '@/lib/image';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  markers: MarkerData[];                          // bbox 內的 markers
  onRestaurantSelect: (r: MarkerData) => void;
};

type TabKey = 'recent' | 'reported';

export default function TribunalPanel({ isOpen, onClose, markers, onRestaurantSelect }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabKey>('recent');

  // 點 panel 外面關閉
  useEffect(() => {
    if (!isOpen) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const t = e.target as HTMLElement;
        if (t.closest('[data-tribunal-button]')) return;
        onClose();
      }
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [isOpen, onClose]);

  // 計算「最近 14 天新增」與「被舉報多」清單
  const { recent, reported } = useMemo(() => {
    const now = Date.now();
    const recent = markers
      .filter((m) => {
        const t = new Date(m.created_at).getTime();
        return !isNaN(t) && now - t <= FOURTEEN_DAYS_MS;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 30);

    const reported = markers
      .filter((m) => m.report_count > 0)
      .sort((a, b) => b.report_count - a.report_count)
      .slice(0, 30);

    return { recent, reported };
  }, [markers]);

  if (!isOpen) return null;

  const list = tab === 'recent' ? recent : reported;
  const formatRelative = (iso: string): string => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days} 天前`;
    if (days < 14) return `${Math.floor(days / 7)} 週前`;
    return `${days} 天前`;
  };

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full right-0 mb-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-30"
      style={{ maxHeight: '60vh' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#003580]">審判台</h2>
          <p className="text-xs text-gray-500 mt-0.5">這區最近的動態</p>
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

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white">
        <button
          onClick={() => setTab('recent')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === 'recent'
              ? 'text-[#003580] border-b-2 border-[#003580]'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          最近新增
          {recent.length > 0 && (
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === 'recent' ? 'bg-[#003580] text-white' : 'bg-gray-100 text-gray-600'
            }`}>{recent.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('reported')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === 'reported'
              ? 'text-red-600 border-b-2 border-red-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          被舉報
          {reported.length > 0 && (
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === 'reported' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>{reported.length}</span>
          )}
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 120px)' }}>
        {list.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-500 leading-relaxed">
              {tab === 'recent'
                ? '這區最近 14 天沒有新增餐廳'
                : '這區沒有被舉報的餐廳'}<br />
              <span className="text-xs text-gray-400">試試移動地圖或縮小範圍</span>
            </p>
          </div>
        ) : (
          list.map((r) => {
            const cover = imgUrl(r.cover_image_key);
            const price = r.price_amount ?? r.price_min;
            return (
              <div
                key={r.id}
                onClick={() => { onRestaurantSelect(r); onClose(); }}
                className="flex gap-3 px-3 py-3 border-b border-gray-50 hover:bg-blue-50/50 transition-colors cursor-pointer"
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
                  <div className="flex items-center gap-2 mt-1">
                    {price && <span className="text-sm font-bold text-[#003580]">${price}</span>}
                    {tab === 'recent' ? (
                      <span className="text-xs text-gray-500">{formatRelative(r.created_at)}加入</span>
                    ) : (
                      <span className="text-xs text-red-600 font-medium">被舉報 {r.report_count} 次</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
