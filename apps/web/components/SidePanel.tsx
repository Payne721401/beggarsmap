'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { MarkerData, Filters, SortBy } from '@/lib/api';
import { imgUrl } from '@/lib/image';
import { MOCK_MARKERS } from '@/lib/mock-data';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

const MEAL_TYPES = ['早餐', '午餐', '晚餐', '小吃', '甜點', '宵夜', '咖啡廳', '素食'];
const CUISINE_TYPES = ['中式', '日式', '韓式', '西式', '義式', '便當', '自助餐', '火鍋', '麵食', '飲品'];

// Quick-filter chips: label → what filter it sets
type ChipDef = { label: string; apply: Partial<Filters> };
const QUICK_CHIPS: ChipDef[] = [
  { label: 'TWD 100內', apply: { priceMax: 100 } },
  { label: 'TWD 150內', apply: { priceMax: 150 } },
  { label: '高評分', apply: { minRating: 4 } },
  { label: '正餐', apply: { meal_types: ['午餐', '晚餐'] } },
  { label: '小吃', apply: { meal_types: ['小吃'] } },
  { label: '早餐', apply: { meal_types: ['早餐'] } },
  { label: '宵夜', apply: { meal_types: ['宵夜'] } },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  markers: MarkerData[];
  filters: Filters;
  onFiltersChange: (patch: Partial<Filters>) => void;
  onRestaurantSelect: (r: MarkerData) => void;
};

// ── Score Badge (9.2 style) ──
function ScoreBadge({ value }: { value: number }) {
  const score = (value * 2).toFixed(1); // convert 0-5 → 0-10
  return (
    <div className="bg-[#003580] text-white font-bold text-xs px-1.5 py-0.5 rounded-md tabular-nums min-w-[32px] text-center">
      {score}
    </div>
  );
}

// ── Restaurant Card ──
function RestaurantCard({ r, rank, onClick }: {
  r: MarkerData;
  rank?: number;
  onClick: () => void;
}) {
  const cover = imgUrl(r.cover_image_key);
  const price = r.price_amount ?? r.price_min;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex gap-3 px-4 py-3 border-b border-gray-100 hover:bg-blue-50/50 transition-colors group"
    >
      {/* 排名 */}
      {rank !== undefined && (
        <div className="w-5 shrink-0 pt-1 text-xs font-bold text-gray-400 text-right">
          {rank + 1}
        </div>
      )}

      {/* 縮圖 */}
      <div className="w-[72px] h-[72px] rounded-md shrink-0 overflow-hidden bg-gray-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#003580]/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#003580]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5l.75-3h16.5l.75 3M3 10.5h18M3 10.5v7.5a.75.75 0 00.75.75h16.5a.75.75 0 00.75-.75V10.5M9 7.5V6a.75.75 0 01.75-.75h4.5A.75.75 0 0115 6v1.5" />
            </svg>
          </div>
        )}
      </div>

      {/* 資訊 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 flex-1">{r.name}</p>
          <ScoreBadge value={r.beggar_index} />
        </div>

        {/* 分類 */}
        {(r.meal_types?.length > 0 || r.cuisine_types?.length > 0) && (
          <p className="text-xs text-gray-400 mb-1 truncate">
            {[...r.meal_types.slice(0, 2), ...r.cuisine_types.slice(0, 1)].join(' · ')}
          </p>
        )}

        {/* 價格 */}
        {price ? (
          <p className="text-sm font-bold text-[#008009]">
            TWD {price}
            {r.price_item_name && (
              <span className="font-normal text-xs text-[#008009]/80"> {r.price_item_name}</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-gray-400">未知價位</p>
        )}
      </div>
    </button>
  );
}

// ── Sort options ──
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'composite', label: '綜合排序' },
  { value: 'price', label: '依價格' },
  { value: 'rating', label: '依評分' },
];

// ── Filter Drawer (slide-in from side) ──
function FilterDrawer({
  filters, onFiltersChange, onClose,
}: {
  filters: Filters;
  onFiltersChange: (p: Partial<Filters>) => void;
  onClose: () => void;
}) {
  const toggle = (field: 'meal_types' | 'cuisine_types', val: string) => {
    const arr = filters[field];
    onFiltersChange({ [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] });
  };

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="font-semibold text-gray-900">篩選條件</h3>
        <button
          onClick={() => onFiltersChange({ priceMax: null, minRating: 0, meal_types: [], cuisine_types: [] })}
          className="ml-auto text-xs text-[#003580] hover:underline"
        >
          全部清除
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 最高價格 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            最高價格：{filters.priceMax ? `TWD ${filters.priceMax}` : '不限'}
          </label>
          <input
            type="range" min={50} max={500} step={50}
            value={filters.priceMax ?? 500}
            onChange={e => {
              const v = Number(e.target.value);
              onFiltersChange({ priceMax: v >= 500 ? null : v });
            }}
            className="w-full"
            style={{ accentColor: '#003580' }}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>TWD 50</span><span>無上限</span>
          </div>
        </div>

        {/* 最低乞丐指數 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">最低評分</label>
          <div className="flex gap-2">
            {([0, 7, 8, 9] as const).map(v => (
              <button
                key={v}
                onClick={() => onFiltersChange({ minRating: v === 0 ? 0 : v / 2 })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  (v === 0 ? filters.minRating === 0 : filters.minRating === v / 2)
                    ? 'bg-[#003580] text-white border-[#003580]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#003580]'
                }`}
              >
                {v === 0 ? '不限' : `${v}+`}
              </button>
            ))}
          </div>
        </div>

        {/* 用餐時段 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            用餐時段{filters.meal_types.length > 0 && ` (${filters.meal_types.length})`}
          </label>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map(t => (
              <button
                key={t}
                onClick={() => toggle('meal_types', t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filters.meal_types.includes(t)
                    ? 'bg-[#003580] text-white border-[#003580]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#003580]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 料理類型 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            料理類型{filters.cuisine_types.length > 0 && ` (${filters.cuisine_types.length})`}
          </label>
          <div className="flex flex-wrap gap-2">
            {CUISINE_TYPES.map(t => (
              <button
                key={t}
                onClick={() => toggle('cuisine_types', t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filters.cuisine_types.includes(t)
                    ? 'bg-[#003580] text-white border-[#003580]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#003580]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main SidePanel ──
export default function SidePanel({
  isOpen, onClose, markers, filters, onFiltersChange, onRestaurantSelect,
}: Props) {
  const [q, setQ] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const searchResultsRef = useRef<MarkerData[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchResults, setSearchResults] = useState<MarkerData[]>([]);
  const isSearching = q.trim().length > 0;

  // Debounce search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    timerRef.current = setTimeout(() => {
      const lower = q.toLowerCase();
      const results = (USE_MOCK ? MOCK_MARKERS : markers).filter(m =>
        m.name.toLowerCase().includes(lower) ||
        m.meal_types.some(t => t.includes(q)) ||
        m.cuisine_types.some(t => t.includes(q)) ||
        m.categories.some(t => t.includes(q)),
      ).slice(0, 30);
      setSearchResults(results);
      searchResultsRef.current = results;
    }, 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q, markers]);

  // Sorted list
  const sortedMarkers = useMemo(() => {
    const arr = [...markers];
    if (filters.sortBy === 'price') return arr.sort((a, b) => (a.price_amount ?? a.price_min ?? 9999) - (b.price_amount ?? b.price_min ?? 9999));
    if (filters.sortBy === 'rating') return arr.sort((a, b) => b.avg_rating - a.avg_rating);
    return arr.sort((a, b) => b.beggar_index - a.beggar_index);
  }, [markers, filters.sortBy]);

  const displayList = isSearching ? searchResults : sortedMarkers;
  const activeChipCount = (filters.priceMax ? 1 : 0) + (filters.minRating ? 1 : 0) +
    filters.meal_types.length + filters.cuisine_types.length;

  // Check if chip is active
  function isChipActive(chip: ChipDef): boolean {
    const a = chip.apply;
    if (a.priceMax !== undefined && a.priceMax !== filters.priceMax) return false;
    if (a.minRating !== undefined && a.minRating !== filters.minRating) return false;
    if (a.meal_types !== undefined) {
      if (a.meal_types.some(t => !filters.meal_types.includes(t))) return false;
    }
    return true;
  }

  function applyChip(chip: ChipDef) {
    const a = chip.apply;
    if (isChipActive(chip)) {
      // Toggle off
      const off: Partial<Filters> = {};
      if (a.priceMax !== undefined) off.priceMax = null;
      if (a.minRating !== undefined) off.minRating = 0;
      if (a.meal_types !== undefined) off.meal_types = filters.meal_types.filter(t => !a.meal_types!.includes(t));
      onFiltersChange(off);
    } else {
      onFiltersChange(a);
    }
  }

  const currentSortLabel = SORT_OPTIONS.find(s => s.value === filters.sortBy)?.label ?? '綜合排序';

  const panelContent = (
    <div className="flex flex-col h-full bg-[#F5F5F5] relative overflow-hidden">
      {/* Filter drawer (slides over) */}
      <div className={`absolute inset-0 transition-transform duration-250 z-10 ${showFilter ? 'translate-x-0' : 'translate-x-full'}`}>
        <FilterDrawer filters={filters} onFiltersChange={onFiltersChange} onClose={() => setShowFilter(false)} />
      </div>

      {/* ── 頂部搜尋框 ── */}
      <div className="bg-white px-3 pt-3 pb-2 shadow-sm shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="搜尋餐廳或料理..."
              className="w-full pl-8 pr-8 py-2 text-sm bg-gray-100 rounded-lg border border-transparent focus:outline-none focus:border-[#FFB700] focus:bg-white transition-colors"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* 篩選按鈕 */}
          <button
            onClick={() => setShowFilter(true)}
            className={`relative flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              activeChipCount > 0
                ? 'bg-[#003580] text-white border-[#003580]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#003580]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            篩選
            {activeChipCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#FFB700] text-[#1a1a1a] text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">
                {activeChipCount}
              </span>
            )}
          </button>

          {/* 關閉 */}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="關閉">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Quick Filter Chips ── */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
          {QUICK_CHIPS.map(chip => (
            <button
              key={chip.label}
              onClick={() => applyChip(chip)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                isChipActive(chip)
                  ? 'bg-[#003580] text-white border-[#003580]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#003580] hover:text-[#003580]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sort Bar ── */}
      {!isSearching && (
        <div className="bg-white border-t border-gray-100 px-4 py-2 shrink-0 flex items-center justify-between relative">
          <span className="text-xs text-gray-500">
            {displayList.length > 0 ? `${displayList.length} 家餐廳` : '點「搜尋此區域」載入結果'}
          </span>
          <div className="relative">
            <button
              onClick={() => setSortOpen(v => !v)}
              className="flex items-center gap-1 text-xs text-[#003580] font-medium hover:underline"
            >
              {currentSortLabel}
              <svg className={`w-3 h-3 transition-transform ${sortOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                {SORT_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => { onFiltersChange({ sortBy: value }); setSortOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                      filters.sortBy === value
                        ? 'bg-[#003580]/10 text-[#003580] font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Result List ── */}
      <div className="flex-1 overflow-y-auto bg-white">
        {isSearching && searchResults.length === 0 && q.length > 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <svg className="w-10 h-10 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm text-gray-500">找不到「{q}」</p>
          </div>
        )}

        {!isSearching && displayList.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center px-4">
            <svg className="w-10 h-10 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-sm text-gray-500">在地圖上點「搜尋此區域」<br />載入附近餐廳</p>
          </div>
        )}

        {displayList.map((r, i) => (
          <RestaurantCard
            key={r.id}
            r={r}
            rank={!isSearching ? i : undefined}
            onClick={() => onRestaurantSelect(r)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* ── 桌機：左側固定 ── */}
      <div className={[
        'hidden md:flex flex-col fixed left-0 top-0 h-full z-20 w-80 shadow-xl',
        'transition-transform duration-300',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        {panelContent}
      </div>

      {/* ── 手機：Bottom Sheet ── */}
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <div className={[
        'md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-xl',
        'max-h-[80vh] flex flex-col transition-transform duration-300',
        isOpen ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}>
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="flex-1 overflow-hidden">
          {panelContent}
        </div>
      </div>
    </>
  );
}
