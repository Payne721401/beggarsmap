'use client';

import { useEffect, useRef, useState } from 'react';
import { imgUrl } from '@/lib/image';
import { isFavorite, toggleFavorite } from '@/lib/favorites';
import { hasReported, addReport, getPriceVote, setPriceVote } from '@/lib/reports';
import type { RestaurantDetail, ReportReason } from '@/lib/api';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

type Props = {
  restaurant: RestaurantDetail | null;
  onClose: () => void;
  onAddReview?: () => void;
};

function ScoreBadge({ value }: { value: number }) {
  const score = (value * 2).toFixed(1);
  return (
    <div className="inline-flex items-baseline gap-1">
      <span className="bg-[#003580] text-white font-bold text-base px-2 py-0.5 rounded-md tabular-nums">{score}</span>
      <span className="text-xs text-gray-500">/ 10</span>
    </div>
  );
}

function ReviewCount({ count }: { count: number }) {
  return <span className="text-xs text-gray-500 underline">{count} 則評論</span>;
}

function StarRow({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} className={`w-3.5 h-3.5 ${i < full ? 'text-[#FFB700]' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-xs text-gray-500">{value.toFixed(1)}</span>
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今日';
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 個月前`;
  return `${Math.floor(months / 12)} 年前`;
}

const PERK_ICONS: Record<string, string> = {
  '免費加飯': '飯',
  '免費加菜': '菜',
  '免費飲料': '飲',
  '自助吧': '吧',
  '免費湯': '湯',
  '免費加湯': '湯',
  '免費泡菜': '菜',
  '免費加泡菜': '菜',
};

const REPORT_OPTIONS: { reason: ReportReason; label: string }[] = [
  { reason: 'not_beggar', label: '價格不符乞丐標準' },
  { reason: 'chain_restaurant', label: '此店家為連鎖餐飲' },
  { reason: 'wrong_info', label: '名稱或位置有誤' },
];

export default function RestaurantBottomSheet({ restaurant, onClose, onAddReview }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [favorited, setFavorited] = useState(false);
  const [reportedReason, setReportedReason] = useState<ReportReason | null>(null);
  const [priceVote, setPriceVoteState] = useState<'yes' | 'no' | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setFavorited(isFavorite(restaurant.id));
    setReportedReason(hasReported(restaurant.id));
    setPriceVoteState(getPriceVote(restaurant.id));
    setShowReportModal(false);
  }, [restaurant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!restaurant) return null;

  const cover = imgUrl(restaurant.cover_image_key);
  const price = restaurant.price_amount ?? restaurant.price_min;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`;

  function handleFavorite() { setFavorited(toggleFavorite(restaurant!.id)); }
  function handlePriceVote(vote: 'yes' | 'no') {
    setPriceVote(restaurant!.id, vote);
    setPriceVoteState(vote);
  }
  function handleReport(reason: ReportReason) {
    addReport(restaurant!.id, reason);
    setReportedReason(reason);
    setShowReportModal(false);
  }

  return (
    <>
      {/* Backdrop mobile */}
      <div className="fixed inset-0 z-30 md:hidden" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed z-40 bg-white shadow-2xl overflow-y-auto bottom-0 left-0 right-0 rounded-t-2xl max-h-[72vh] md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-96 md:rounded-none md:max-h-full"
        role="dialog"
        aria-label={restaurant.name}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-0 md:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Top action bar */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-end gap-1 px-3 pt-2 pb-1">
          <button
            onClick={handleFavorite}
            className={`p-2 rounded-full transition-colors ${favorited ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'}`}
            aria-label={favorited ? '取消收藏' : '收藏'}
          >
            <svg className="w-5 h-5" fill={favorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="關閉"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cover image */}
        {cover && (
          <div className="w-full h-44 overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={restaurant.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="px-4 pt-3 pb-6">
          {/* Name + Score */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-lg font-bold text-gray-900 leading-tight flex-1">{restaurant.name}</h2>
            <ScoreBadge value={restaurant.beggar_index} />
          </div>

          <div className="flex items-center gap-3 mb-3">
            <StarRow value={restaurant.avg_rating} />
            <ReviewCount count={restaurant.review_count} />
          </div>

          {/* Tags */}
          {((restaurant.meal_types?.length ?? 0) + (restaurant.cuisine_types?.length ?? 0)) > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {restaurant.meal_types?.map(t => (
                <span key={t} className="text-xs bg-blue-50 text-[#003580] border border-blue-100 px-2 py-0.5 rounded-full">{t}</span>
              ))}
              {restaurant.cuisine_types?.map(t => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}

          {/* Beggar perks */}
          {(restaurant.beggar_perks?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {restaurant.beggar_perks.map(perk => (
                <span key={perk} className="inline-flex items-center gap-1 text-xs bg-[#FFB700]/10 text-[#7a5800] border border-[#FFB700]/30 px-2 py-0.5 rounded-full font-medium">
                  <span className="bg-[#FFB700] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {PERK_ICONS[perk] ?? '免'}
                  </span>
                  {perk}
                </span>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100 my-3" />

          {/* Price section */}
          <div className="mb-3">
            {price ? (
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-[#008009]">TWD {price}</span>
                {restaurant.price_item_name && (
                  <span className="text-sm text-[#008009]/80">{restaurant.price_item_name}</span>
                )}
                {restaurant.price_reported_at && (
                  <span className="text-xs text-gray-400 ml-auto">{formatRelativeDate(restaurant.price_reported_at)}更新</span>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm mb-2">未知價位</p>
            )}

            {/* Price vote */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">價格正確嗎？</span>
              <button
                onClick={() => handlePriceVote('yes')}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                  priceVote === 'yes'
                    ? 'bg-[#008009] text-white border-[#008009]'
                    : 'border-gray-300 text-gray-600 hover:border-[#008009] hover:text-[#008009]'
                }`}
              >
                正確
              </button>
              <button
                onClick={() => handlePriceVote('no')}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                  priceVote === 'no'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-500'
                }`}
              >
                有誤
              </button>
            </div>
          </div>

          {/* Address */}
          {restaurant.address && (
            <div className="flex items-start gap-2 text-sm text-gray-500 mb-4">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {restaurant.address}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mb-4">
            <a
              href={mapsUrl}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              導航
            </a>
            <button
              onClick={onAddReview}
              className="flex-1 bg-[#003580] hover:bg-[#002860] text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              撰寫評論
            </button>
          </div>

          {!USE_MOCK && (
            <a href={`/r/${restaurant.slug}`} className="block text-center text-xs text-[#003580] hover:underline mb-4">
              查看完整頁面
            </a>
          )}

          {/* Reviews */}
          {restaurant.reviews.length > 0 && (
            <>
              <div className="border-t border-gray-100 pt-4 mb-3">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">近期評論</h3>
                <div className="space-y-3">
                  {restaurant.reviews.map(review => (
                    <div key={review.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <StarRow value={review.rating} />
                        {review.price_paid && (
                          <span className="text-xs text-[#008009] font-medium">TWD {review.price_paid}</span>
                        )}
                      </div>
                      {review.comment && <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>}
                      <p className="text-xs text-gray-400 mt-1">{new Date(review.created_at).toLocaleDateString('zh-TW')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Report section */}
          <div className="border-t border-gray-100 pt-3 relative">
            {reportedReason ? (
              <p className="text-xs text-amber-700 flex items-center gap-2 py-1">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                已舉報：{REPORT_OPTIONS.find(o => o.reason === reportedReason)?.label}
              </p>
            ) : (
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-amber-700 transition-colors py-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                舉報此店家
              </button>
            )}

            {/* Report modal */}
            {showReportModal && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-800">選擇舉報原因</h4>
                </div>
                <div className="py-1">
                  {REPORT_OPTIONS.map(({ reason, label }) => (
                    <button
                      key={reason}
                      onClick={() => handleReport(reason)}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-gray-100">
                  <button onClick={() => setShowReportModal(false)} className="text-xs text-gray-400 hover:text-gray-600">
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
