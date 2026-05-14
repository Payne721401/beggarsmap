'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { apiFetch, DEFAULT_FILTERS } from '@/lib/api';
import type { MarkerData, RestaurantDetail, Filters } from '@/lib/api';
import { MOCK_MARKERS, getMockDetail } from '@/lib/mock-data';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#F5F5F5]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#003580] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-gray-500">載入地圖中...</p>
      </div>
    </div>
  ),
});

const RestaurantBottomSheet = dynamic(() => import('@/components/RestaurantBottomSheet'), { ssr: false });
const ReviewModal = dynamic(() => import('@/components/ReviewModal'), { ssr: false });
const AddRestaurantForm = dynamic(() => import('@/components/AddRestaurantForm'), { ssr: false });
const SidePanel = dynamic(() => import('@/components/SidePanel'), { ssr: false });
const FavoritesPanel = dynamic(() => import('@/components/FavoritesPanel'), { ssr: false });
const TribunalPanel = dynamic(() => import('@/components/TribunalPanel'), { ssr: false });

type UIState =
  | { mode: 'map' }
  | { mode: 'detail'; restaurant: RestaurantDetail }
  | { mode: 'review'; restaurant: RestaurantDetail }
  | { mode: 'add' }
  | { mode: 'pin-select' };

function applyMockFilters(
  all: MarkerData[],
  filters: Filters,
  bbox?: [number, number, number, number],
): MarkerData[] {
  let result = [...all];
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    result = result.filter(
      (m) => m.longitude >= minLng && m.longitude <= maxLng &&
             m.latitude >= minLat && m.latitude <= maxLat,
    );
  }
  if (filters.priceMax) result = result.filter((m) => !m.price_amount || m.price_amount <= filters.priceMax!);
  if (filters.meal_types.length) result = result.filter((m) => filters.meal_types.some((t) => m.meal_types.includes(t)));
  if (filters.cuisine_types.length) result = result.filter((m) => filters.cuisine_types.some((t) => m.cuisine_types.includes(t)));
  if (filters.minRating) result = result.filter((m) => m.beggar_index >= filters.minRating);
  if (filters.sortBy === 'price') result.sort((a, b) => (a.price_amount ?? a.price_min ?? 9999) - (b.price_amount ?? b.price_min ?? 9999));
  else if (filters.sortBy === 'rating') result.sort((a, b) => b.avg_rating - a.avg_rating);
  else result.sort((a, b) => b.beggar_index - a.beggar_index);
  return result;
}

export default function HomePage() {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [ui, setUi] = useState<UIState>({ mode: 'map' });
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [tribunalOpen, setTribunalOpen] = useState(false);
  const mapFlyToRef = useRef<((lng: number, lat: number, zoom?: number) => void) | null>(null);
  const currentBboxRef = useRef<[number, number, number, number] | null>(null);
  const currentCenterRef = useRef<{ lng: number; lat: number } | null>(null);
  const autoZoomDoneRef = useRef(false);

  const selectedId = ui.mode === 'detail' ? ui.restaurant.id : null;

  // 審判台徽章數：「最近 14 天新增」+「被舉報」合計（去重）
  const tribunalCount = useMemo(() => {
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const ids = new Set<string>();
    for (const m of markers) {
      const isRecent = !isNaN(new Date(m.created_at).getTime())
        && now - new Date(m.created_at).getTime() <= FOURTEEN_DAYS_MS;
      const isReported = m.report_count > 0;
      if (isRecent || isReported) ids.add(m.id);
    }
    return ids.size;
  }, [markers]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function triggerSearch(bbox: [number, number, number, number], f: Filters) {
    currentBboxRef.current = bbox;
    if (USE_MOCK) {
      const filtered = applyMockFilters(MOCK_MARKERS, f, bbox);
      setMarkers(filtered.length > 0 ? filtered : applyMockFilters(MOCK_MARKERS, f));
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      bbox: bbox.join(','),
      limit: '200',
      sort: f.sortBy,
      ...(f.priceMax ? { price_max: String(f.priceMax) } : {}),
      ...(f.meal_types.length ? { meal_types: f.meal_types.join(',') } : {}),
      ...(f.cuisine_types.length ? { cuisine_types: f.cuisine_types.join(',') } : {}),
      ...(f.minRating ? { min_rating: String(f.minRating) } : {}),
    });
    apiFetch<MarkerData[]>(`/api/restaurants?${params}`)
      .then(setMarkers)
      .catch(() => showToast('載入失敗，請稍後再試'))
      .finally(() => setLoading(false));
  }

  // 自動縮放：首次搜尋 < 10 家 → zoom out to 14 重搜
  useEffect(() => {
    if (markers.length === 0 || autoZoomDoneRef.current) return;
    if (markers.length < 10 && currentCenterRef.current) {
      autoZoomDoneRef.current = true;
      const { lng, lat } = currentCenterRef.current;
      mapFlyToRef.current?.(lng, lat, 14);
    } else if (markers.length >= 10) {
      autoZoomDoneRef.current = true;
    }
  }, [markers]);

  // 初始 bbox（地圖載入完成後第一次觸發）
  const handleInitialBounds = useCallback((bbox: [number, number, number, number]) => {
    triggerSearch(bbox, filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleRequestSearch = useCallback((bbox: [number, number, number, number]) => {
    autoZoomDoneRef.current = true; // 手動搜尋不再自動縮放
    triggerSearch(bbox, filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleBoundsChange = useCallback((
    bbox: [number, number, number, number],
    center: { lng: number; lat: number },
  ) => {
    currentBboxRef.current = bbox;
    currentCenterRef.current = center;
  }, []);

  function handleFiltersChange(patch: Partial<Filters>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (currentBboxRef.current) triggerSearch(currentBboxRef.current, next);
      return next;
    });
  }

  const handleRestaurantClick = useCallback(async (marker: MarkerData) => {
    if (USE_MOCK) {
      const detail = getMockDetail(marker.id);
      if (detail) setUi({ mode: 'detail', restaurant: detail });
      return;
    }
    try {
      const detail = await apiFetch<RestaurantDetail>(`/api/restaurants/${marker.id}`);
      setUi({ mode: 'detail', restaurant: detail });
    } catch {
      showToast('載入失敗，請稍後再試');
    }
  }, []);

  const handleRestaurantSelectFromPanel = useCallback((r: MarkerData) => {
    mapFlyToRef.current?.(r.longitude, r.latitude, 16);
    handleRestaurantClick(r);
  }, [handleRestaurantClick]);

  const handlePinSelect = useCallback((lat: number, lng: number) => {
    setPinCoords({ lat, lng });
    setUi({ mode: 'add' });
  }, []);

  return (
    <div className="relative w-full h-screen flex overflow-hidden bg-[#F5F5F5]">
      {/* ── 左側面板 ── */}
      <SidePanel
        isOpen={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        markers={markers}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onRestaurantSelect={handleRestaurantSelectFromPanel}
      />

      {/* ── 地圖 ── */}
      <div className={[
        'relative flex-1 transition-[margin] duration-300',
        sidePanelOpen ? 'md:ml-96' : '',
      ].join(' ')}>
        <Map
          markers={markers}
          selectedId={selectedId}
          onRestaurantClick={handleRestaurantClick}
          onRequestSearch={handleRequestSearch}
          pinSelectMode={ui.mode === 'pin-select'}
          onPinSelect={handlePinSelect}
          sidePanelOpen={sidePanelOpen}
          onMapReady={(flyTo) => { mapFlyToRef.current = flyTo; }}
          onBoundsChange={handleBoundsChange}
          onInitialBounds={handleInitialBounds}
        />

        {/* Spinner */}
        {loading && (
          <div className="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md z-10">
            <div className="w-4 h-4 border-2 border-[#003580] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* 左上：Logo + 搜尋 + 收藏 */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2.5">
          <div className="bg-white rounded-xl px-4 py-3 shadow-md">
            <h1 className="text-lg font-bold text-[#003580] leading-tight">乞丐地圖</h1>
            <p className="text-sm text-gray-500 leading-tight mt-0.5">台灣便宜餐廳</p>
          </div>
          {!sidePanelOpen && (
            <button
              onClick={() => setSidePanelOpen(true)}
              className="bg-white rounded-lg px-4 py-2.5 shadow-md text-sm font-medium text-[#003580] hover:bg-blue-50 transition-colors flex items-center gap-2 border border-gray-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              搜尋
              {markers.length > 0 && (
                <span className="bg-[#003580] text-white text-xs px-2 py-0.5 rounded-full font-semibold">{markers.length}</span>
              )}
            </button>
          )}

          {/* 我的收藏 (愛心) + 浮動 panel */}
          <div className="relative">
            <button
              data-favorites-button
              onClick={() => setFavoritesOpen((v) => !v)}
              className="w-full bg-white rounded-lg px-4 py-2.5 shadow-md text-sm font-medium text-[#003580] hover:bg-red-50 transition-colors flex items-center gap-2 border border-gray-200"
              aria-label="我的收藏"
            >
              <svg className="w-4 h-4" fill={favoritesOpen ? '#dc2626' : 'none'} viewBox="0 0 24 24" stroke={favoritesOpen ? '#dc2626' : 'currentColor'} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              我的收藏
            </button>
            <FavoritesPanel
              isOpen={favoritesOpen}
              onClose={() => setFavoritesOpen(false)}
              markers={markers}
              onRestaurantSelect={handleRestaurantSelectFromPanel}
            />
          </div>
        </div>

        {/* 右下角浮動按鈕組：審判台 + 新增餐廳 */}
        {(ui.mode === 'map' || ui.mode === 'detail') && (
          <div className="absolute bottom-6 right-4 z-20 flex flex-col items-end gap-2.5">
            {/* 審判台按鈕 + 浮動 panel */}
            <div className="relative">
              <button
                data-tribunal-button
                onClick={() => setTribunalOpen((v) => !v)}
                className="relative bg-white text-[#003580] rounded-full px-6 py-3.5 shadow-lg flex items-center gap-2 text-base font-medium hover:bg-blue-50 border border-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                審判台
                {tribunalCount > 0 && (
                  <span
                    className="absolute -top-1.5 -left-1.5 bg-red-500 text-white text-xs font-semibold px-1.5 min-w-[1.4rem] h-[1.4rem] rounded-full flex items-center justify-center shadow-md ring-2 ring-white tabular-nums"
                    aria-label={`${tribunalCount} 家需要關注`}
                  >
                    {tribunalCount > 99 ? '99+' : tribunalCount}
                  </span>
                )}
              </button>
              <TribunalPanel
                isOpen={tribunalOpen}
                onClose={() => setTribunalOpen(false)}
                markers={markers}
                onRestaurantSelect={handleRestaurantSelectFromPanel}
              />
            </div>

            {/* 新增餐廳 FAB — 直接開表單（URL 模式預設） */}
            <button
              onClick={() => setUi({ mode: 'add' })}
              className="bg-[#003580] hover:bg-[#002860] text-white rounded-full px-6 py-3.5 shadow-lg flex items-center gap-2 text-base font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              新增餐廳
            </button>
          </div>
        )}

        {/* 請我喝咖啡 */}
        <a
          href="https://ko-fi.com/beggarsmap"
          target="_blank" rel="noopener noreferrer"
          className="absolute bottom-6 left-4 z-10 bg-[#FFB700] hover:bg-[#e6a500] text-[#1a1a1a] text-sm font-semibold px-4 py-2.5 rounded-full shadow-md transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 21h18v-2H2v2zm2-4h4v-2H4v2zm6 0h4v-2h-4v2zM20 3H4v2l16 8V3z"/>
          </svg>
          請我喝咖啡
        </a>
      </div>

      {/* ── 餐廳詳細 ── */}
      {ui.mode === 'detail' && (
        <RestaurantBottomSheet
          restaurant={ui.restaurant}
          onClose={() => setUi({ mode: 'map' })}
          onAddReview={() => setUi({ mode: 'review', restaurant: ui.restaurant })}
          onToast={showToast}
        />
      )}

      {/* ── 評論 ── */}
      {ui.mode === 'review' && (
        <ReviewModal
          restaurantId={ui.restaurant.id}
          restaurantName={ui.restaurant.name}
          onClose={() => setUi({ mode: 'detail', restaurant: ui.restaurant })}
          onSuccess={() => showToast('評論已送出，感謝回饋！')}
        />
      )}

      {/* ── 新增表單 ── */}
      {ui.mode === 'add' && (
        <AddRestaurantForm
          initialLat={pinCoords?.lat}
          initialLng={pinCoords?.lng}
          onClose={() => { setUi({ mode: 'map' }); setPinCoords(null); }}
          onSuccess={() => showToast('餐廳已送出審核，感謝貢獻！')}
          onRequestPinSelect={() => setUi({ mode: 'pin-select' })}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
