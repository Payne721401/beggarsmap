'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { imgUrl } from '@/lib/image';
import { isFavorite, toggleFavorite } from '@/lib/favorites';
import { hasReported, addReport, getPriceVote, setPriceVote, getCpVote, setCpVote } from '@/lib/reports';
import type { CpVote } from '@/lib/reports';
import type { RestaurantDetail, ReportReason, BusinessHours } from '@/lib/api';

const EditRestaurantModal = dynamic(() => import('@/components/EditRestaurantModal'), { ssr: false });
const ImageLightbox = dynamic(() => import('@/components/ImageLightbox'), { ssr: false });

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

type Props = {
  restaurant: RestaurantDetail | null;
  onClose: () => void;
  onAddReview?: () => void;
  onToast?: (msg: string) => void;
};

function ScoreBadge({ value }: { value: number }) {
  return (
    <div className="inline-flex items-baseline gap-1">
      <span className="bg-[#003580] text-white font-bold text-base px-2 py-0.5 rounded-md tabular-nums">{value.toFixed(1)}</span>
      <span className="text-xs text-gray-500">/ 5</span>
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
  '免費加飯': '飯', '免費加菜': '菜', '免費飲料': '飲', '自助吧': '吧',
  '免費湯': '湯', '免費加湯': '湯', '免費泡菜': '菜', '免費加泡菜': '菜',
};

const REPORT_OPTIONS: { reason: ReportReason; label: string }[] = [
  { reason: 'not_beggar', label: '價格不符乞丐標準' },
  { reason: 'chain_restaurant', label: '此店家為連鎖餐飲' },
  { reason: 'wrong_info', label: '名稱或位置有誤' },
];

const REPORT_REASON_LABELS: Record<string, string> = {
  'wrong_info': '資訊有誤',
  'already_closed': '已歇業',
  'too_expensive': '價格不符',
  'spam': '垃圾廣告',
  'duplicate': '重複',
  'not_beggar': '價格不符乞丐標準',
  'chain_restaurant': '連鎖餐飲',
  'other': '其他',
};

const DAY_LABELS: { key: keyof BusinessHours; label: string }[] = [
  { key: 'mon', label: '週一' }, { key: 'tue', label: '週二' }, { key: 'wed', label: '週三' },
  { key: 'thu', label: '週四' }, { key: 'fri', label: '週五' },
  { key: 'sat', label: '週六' }, { key: 'sun', label: '週日' },
];

/** 圖片預覽：菜單/餐點 切換，無圖時顯示可點擊新增的 placeholder，點縮圖開全螢幕 lightbox */
function ImageGallery({
  menuUrls, foodUrls, onAddImage,
}: {
  menuUrls: string[];
  foodUrls: string[];
  onAddImage?: (type: 'menu' | 'food', file: File) => void;
}) {
  const hasMenu = menuUrls.length > 0;
  const hasFood = foodUrls.length > 0;
  const [tab, setTab] = useState<'food' | 'menu'>(hasFood ? 'food' : 'menu');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const urls = tab === 'food' ? foodUrls : menuUrls;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onAddImage) onAddImage(tab, file);
    e.target.value = '';
  }

  return (
    <div className="bg-gray-50 border-b border-gray-100">
      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-2.5">
        <button
          onClick={() => setTab('food')}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            tab === 'food'
              ? 'bg-[#003580] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          餐點 {hasFood && <span className="opacity-80">({foodUrls.length})</span>}
        </button>
        <button
          onClick={() => setTab('menu')}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            tab === 'menu'
              ? 'bg-[#003580] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          菜單 {hasMenu && <span className="opacity-80">({menuUrls.length})</span>}
        </button>
      </div>

      {/* Images */}
      <div className="px-3 py-2.5">
        {urls.length === 0 ? (
          /* Placeholder — 整塊可點擊上傳 */
          <label className="block bg-white border border-dashed border-gray-300 rounded-lg h-32 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-[#003580]/50 hover:text-[#003580] hover:bg-blue-50/30 transition-colors">
            <input
              type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect} className="hidden"
              disabled={!onAddImage}
            />
            <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-xs">點擊新增{tab === 'food' ? '餐點' : '菜單'}照片</p>
          </label>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
            {urls.map((url, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setLightboxIdx(i)}
                className="shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:opacity-90 hover:ring-2 hover:ring-[#003580]/40 transition-all"
                aria-label="放大圖片"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
            {/* 末尾「+」新增按鈕 */}
            {onAddImage && (
              <label className="shrink-0 w-32 h-32 rounded-lg border border-dashed border-gray-300 bg-white flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-[#003580]/50 hover:text-[#003580] hover:bg-blue-50/30 transition-colors">
                <input
                  type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect} className="hidden"
                />
                <svg className="w-6 h-6 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">新增</span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <ImageLightbox
          imageUrls={urls}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

/** 營業時間 — 自動把連續同樣時段合併顯示（例：週一-週五 11:00-21:00） */
function BusinessHoursDisplay({ hours }: { hours: BusinessHours }) {
  const days = DAY_LABELS.map(({ key, label }) => ({ key, label, value: hours[key] ?? null }));
  // 簡單合併：把連續相同 value 的 group 合一行
  const groups: { labels: string[]; value: string | null }[] = [];
  for (const d of days) {
    const last = groups[groups.length - 1];
    if (last && last.value === d.value) last.labels.push(d.label);
    else groups.push({ labels: [d.label], value: d.value });
  }

  return (
    <div className="space-y-0.5">
      {groups.map((g, i) => (
        <div key={i} className="flex items-baseline gap-2 text-sm">
          <span className="text-gray-500 min-w-[5em] shrink-0">
            {g.labels.length > 1 ? `${g.labels[0]}-${g.labels[g.labels.length - 1]}` : g.labels[0]}
          </span>
          <span className={g.value === 'closed' ? 'text-gray-400' : 'text-gray-800'}>
            {g.value === 'closed' ? '公休' : g.value ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RestaurantBottomSheet({ restaurant, onClose, onAddReview, onToast }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [favorited, setFavorited] = useState(false);
  const [reportedReason, setReportedReason] = useState<ReportReason | null>(null);
  const [priceVote, setPriceVoteState] = useState<'yes' | 'no' | null>(null);
  const [cpVote, setCpVoteState] = useState<CpVote | null>(null);
  // Mock-only：詳細頁直接上傳的新圖（不送 API，只暫存於 session）
  const [pendingMenu, setPendingMenu] = useState<string[]>([]);
  const [pendingFood, setPendingFood] = useState<string[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setFavorited(isFavorite(restaurant.id));
    setReportedReason(hasReported(restaurant.id));
    setPriceVoteState(getPriceVote(restaurant.id));
    setCpVoteState(getCpVote(restaurant.id));
    setShowReportModal(false);
    setShowEditModal(false);
  }, [restaurant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!restaurant) return null;

  const price = restaurant.price_amount ?? restaurant.price_min;
  // 在 Google Maps 查看此餐廳：用 店名 + 地址（或座標）搜尋，Google 會直接定位到店家資訊頁
  const navSearchQuery = restaurant.address
    ? `${restaurant.name} ${restaurant.address}`
    : `${restaurant.name} ${restaurant.latitude},${restaurant.longitude}`;
  const navigationUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navSearchQuery)}`;

  // 票數顯示（含本機投票的 optimistic update）
  const cpHighDisplay = restaurant.cp_high_votes + (cpVote === 'high' ? 1 : 0);
  const cpLowDisplay = restaurant.cp_low_votes + (cpVote === 'low' ? 1 : 0);
  const cpTotal = cpHighDisplay + cpLowDisplay;
  const cpHighPct = cpTotal > 0 ? Math.round((cpHighDisplay / cpTotal) * 100) : 0;
  const cpLowPct = cpTotal > 0 ? 100 - cpHighPct : 0;

  const priceCorrectDisplay = (restaurant.price_correct_votes ?? 0) + (priceVote === 'yes' ? 1 : 0);
  const priceWrongDisplay = (restaurant.price_wrong_votes ?? 0) + (priceVote === 'no' ? 1 : 0);

  function handleFavorite() { setFavorited(toggleFavorite(restaurant!.id)); }
  function handlePriceVote(vote: 'yes' | 'no') {
    setPriceVote(restaurant!.id, vote);
    setPriceVoteState(vote);
  }
  function handleCpVote(vote: CpVote) {
    setCpVote(restaurant!.id, vote);
    setCpVoteState(vote);
    onToast?.(vote === 'high' ? '已投：CP 值高 👍' : '已投：CP 值低 👎');
  }
  function handleReport(reason: ReportReason) {
    addReport(restaurant!.id, reason);
    setReportedReason(reason);
    setShowReportModal(false);
  }

  const hasBusinessHours = restaurant.business_hours
    && Object.values(restaurant.business_hours).some((v) => v != null);
  const hasRecentReports = (restaurant.recent_reports?.length ?? 0) > 0;

  return (
    <>
      {/* Backdrop mobile */}
      <div className="fixed inset-0 z-30 md:hidden" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed z-40 bg-white shadow-2xl overflow-y-auto bottom-0 left-0 right-0 rounded-t-2xl max-h-[82vh] md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-96 md:rounded-none md:max-h-full"
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
            onClick={() => setShowEditModal(true)}
            className="p-2 rounded-full text-gray-400 hover:text-[#003580] transition-colors"
            aria-label="編輯資訊"
            title="編輯餐廳資訊"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleFavorite}
            className={`px-2 py-2 rounded-full transition-colors flex items-center gap-1 ${favorited ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'}`}
            aria-label={favorited ? '取消收藏' : '收藏'}
            title={favorited ? '取消收藏' : '加入收藏'}
          >
            <svg className="w-5 h-5" fill={favorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {(restaurant.favorite_count + (favorited ? 1 : 0)) > 0 && (
              <span className="text-xs font-medium tabular-nums">
                {restaurant.favorite_count + (favorited ? 1 : 0)}
              </span>
            )}
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

        {/* Image gallery (menu / food tabs) */}
        <ImageGallery
          menuUrls={[
            ...(restaurant.menu_image_keys ?? []).map(imgUrl).filter((u): u is string => Boolean(u)),
            ...pendingMenu,
          ]}
          foodUrls={[
            ...(restaurant.food_image_keys ?? []).map(imgUrl).filter((u): u is string => Boolean(u)),
            ...pendingFood,
          ]}
          onAddImage={(type, file) => {
            const blobUrl = URL.createObjectURL(file);
            if (type === 'menu') setPendingMenu((prev) => [...prev, blobUrl]);
            else setPendingFood((prev) => [...prev, blobUrl]);
            onToast?.(USE_MOCK
              ? `已新增${type === 'menu' ? '菜單' : '餐點'}照片（mock 模式，重新整理會消失）`
              : `已新增${type === 'menu' ? '菜單' : '餐點'}照片，等待審核`);
          }}
        />

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
            <div className="flex items-center gap-2 mb-1 flex-wrap">
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
              {priceWrongDisplay > 0 && (
                <span className="text-xs text-red-600 font-medium ml-auto">
                  已有 {priceWrongDisplay} 人回報有誤
                </span>
              )}
            </div>
            {priceCorrectDisplay + priceWrongDisplay > 0 && (
              <p className="text-[10px] text-gray-400 mb-2.5 tabular-nums">
                {priceCorrectDisplay} 票正確 / {priceWrongDisplay} 票有誤
              </p>
            )}

            {/* CP value vote */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <span className="text-xs text-gray-500">CP 值</span>
                <div className="flex gap-1.5 items-center">
                  <button
                    onClick={() => handleCpVote('high')}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors flex items-center gap-1 ${
                      cpVote === 'high'
                        ? 'bg-[#008009] text-white border-[#008009]'
                        : 'border-gray-300 text-gray-600 hover:border-[#008009] hover:text-[#008009]'
                    }`}
                  >
                    👍 高
                  </button>
                  <button
                    onClick={() => handleCpVote('low')}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors flex items-center gap-1 ${
                      cpVote === 'low'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-500'
                    }`}
                  >
                    👎 低
                  </button>
                </div>
              </div>

              {cpTotal > 0 ? (
                <>
                  {/* 長條圖 */}
                  <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                    {cpHighDisplay > 0 && (
                      <div className="bg-[#008009] transition-all" style={{ width: `${cpHighPct}%` }} aria-label={`高 CP ${cpHighPct}%`} />
                    )}
                    {cpLowDisplay > 0 && (
                      <div className="bg-red-500 transition-all" style={{ width: `${cpLowPct}%` }} aria-label={`低 CP ${cpLowPct}%`} />
                    )}
                  </div>
                  {/* 比例文字 */}
                  <div className="flex justify-between text-xs mt-1 tabular-nums">
                    <span className="text-[#008009] font-medium">
                      👍 {cpHighDisplay} 票 ({cpHighPct}%)
                    </span>
                    <span className="text-red-600 font-medium">
                      ({cpLowPct}%) {cpLowDisplay} 票 👎
                    </span>
                  </div>
                  {cpVote && <p className="text-[10px] text-gray-400 mt-1">已投票（可隨時改投）</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">尚無投票，搶頭香！</p>
              )}
            </div>
          </div>

          {/* Address */}
          {restaurant.address && (
            <div className="flex items-start gap-2 text-sm text-gray-600 mb-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{restaurant.address}</span>
            </div>
          )}

          {/* Phone */}
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="flex items-start gap-2 text-sm text-gray-600 hover:text-[#003580] mb-2 transition-colors"
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="tabular-nums">{restaurant.phone}</span>
            </a>
          )}

          {/* Business hours */}
          {hasBusinessHours && (
            <div className="flex items-start gap-2 mb-3">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <BusinessHoursDisplay hours={restaurant.business_hours!} />
            </div>
          )}

          {/* Recent reports */}
          {hasRecentReports && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs font-semibold text-amber-800">
                  近期被舉報 {restaurant.report_count} 次
                </span>
              </div>
              <ul className="space-y-1 pl-1">
                {restaurant.recent_reports!.map((r, i) => (
                  <li key={i} className="text-xs text-amber-700 flex items-center gap-2">
                    <span className="w-1 h-1 bg-amber-600 rounded-full shrink-0" />
                    <span>{REPORT_REASON_LABELS[r.reason] ?? r.reason}</span>
                    <span className="text-amber-500 ml-auto">{formatRelativeDate(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mb-4 mt-3">
            <a
              href={navigationUrl}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              title="在 Google Maps 查看此餐廳"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              在地圖中查看
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

      {/* Edit modal */}
      {showEditModal && (
        <EditRestaurantModal
          restaurant={restaurant}
          onClose={() => setShowEditModal(false)}
          onSavedToast={onToast}
        />
      )}
    </>
  );
}
