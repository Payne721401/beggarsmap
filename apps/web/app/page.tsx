'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useEffect } from 'react';
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
  const mapFlyToRef = useRef<((lng: number, lat: number, zoom?: number) => void) | null>(null);
  const currentBboxRef = useRef<[number, number, number, number] | null>(null);
  const currentCenterRef = useRef<{ lng: number; lat: number } | null>(null);
  const autoZoomDoneRef = useRef(false);

  const selectedId = ui.mode === 'detail' ? ui.restaurant.id : null;

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
        sidePanelOpen ? 'md:ml-80' : '',
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

        {/* 左上：Logo + Panel toggle */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          <div className="bg-white rounded-xl px-3 py-2 shadow-md">
            <h1 className="text-sm font-bold text-[#003580]">乞丐地圖</h1>
            <p className="text-xs text-gray-400">台灣便宜餐廳</p>
          </div>
          {!sidePanelOpen && (
            <button
              onClick={() => setSidePanelOpen(true)}
              className="bg-white rounded-lg px-3 py-2 shadow-md text-xs font-medium text-[#003580] hover:bg-blue-50 transition-colors flex items-center gap-1.5 border border-gray-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              搜尋
              {markers.length > 0 && (
                <span className="bg-[#003580] text-white text-xs px-1.5 py-0.5 rounded-full">{markers.length}</span>
              )}
            </button>
          )}
        </div>

        {/* 新增餐廳 FAB */}
        {(ui.mode === 'map' || ui.mode === 'detail') && (
          <button
            onClick={() => setUi({ mode: 'pin-select' })}
            className="absolute bottom-6 right-4 z-20 bg-[#003580] hover:bg-[#002860] text-white rounded-full px-5 py-3 shadow-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            新增餐廳
          </button>
        )}

        {/* 請我喝咖啡 */}
        <a
          href="https://ko-fi.com/beggarsmap"
          target="_blank" rel="noopener noreferrer"
          className="absolute bottom-6 left-3 z-10 bg-[#FFB700] hover:bg-[#e6a500] text-[#1a1a1a] text-xs font-semibold px-3 py-2 rounded-full shadow-md transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
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
