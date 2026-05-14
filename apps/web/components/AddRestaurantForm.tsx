'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { apiFetch } from '@/lib/api';
import type { BusinessHours } from '@/lib/api';
import { isChainRestaurant } from '@/lib/chains';
import { parseGmapsUrl } from '@/lib/gmaps-parse';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

type Props = {
  initialLat?: number;
  initialLng?: number;
  onClose: () => void;
  onSuccess: () => void;
  onRequestPinSelect: () => void;
};

const MEAL_TYPES = ['早餐', '午餐', '晚餐', '小吃', '甜點', '宵夜', '咖啡廳', '素食', '其他'];
const CUISINE_TYPES = [
  '中式料理', '西式料理', '義式料理', '日式料理', '韓式料理',
  '異國料理', '合菜', '便當', '自助餐', '火鍋', '麵食', '飲品&咖啡', '健康餐', '其他',
];
const BEGGAR_PERKS = ['免費加飯', '免費加菜', '免費飲料', '自助吧'];

type LocationMode = 'url' | 'pin';
type ImageType = 'menu' | 'food';

type FormState = {
  name: string;
  // 位置：兩種模式互斥
  locationMode: LocationMode;
  gmapsUrl: string;
  latitude: string;
  longitude: string;
  googleShortId: string | null;
  resolvedFromUrl: boolean;             // URL 解析後是否成功取得座標
  // 必填
  price_item_name: string;
  price_amount: string;
  // 選填
  meal_types: string[];
  cuisine_types: string[];
  beggar_perks: string[];
  address: string;
  phone: string;
  business_hours: BusinessHours;
  // 圖片（菜單 / 餐點）
  menu_image_keys: string[];
  food_image_keys: string[];
  _hp: string;
};

const EMPTY_HOURS: BusinessHours = {
  mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '',
};

export default function AddRestaurantForm({ initialLat, initialLng, onClose, onSuccess, onRequestPinSelect }: Props) {
  const [form, setForm] = useState<FormState>({
    name: '',
    locationMode: initialLat && initialLng ? 'pin' : 'url',
    gmapsUrl: '',
    latitude: initialLat?.toFixed(6) ?? '',
    longitude: initialLng?.toFixed(6) ?? '',
    googleShortId: null,
    resolvedFromUrl: false,
    price_item_name: '',
    price_amount: '',
    meal_types: [],
    cuisine_types: [],
    beggar_perks: [],
    address: '',
    phone: '',
    business_hours: { ...EMPTY_HOURS },
    menu_image_keys: [],
    food_image_keys: [],
    _hp: '',
  });
  const [uploading, setUploading] = useState<ImageType | null>(null);
  const [imagePreviews, setImagePreviews] = useState<{ menu: string[]; food: string[] }>({ menu: [], food: [] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  // 營業時間：預設「平日 / 週六 / 週日」三組；展開後可逐日設定
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [hoursPreset, setHoursPreset] = useState({
    weekday: { from: '', to: '', closed: false },
    saturday: { from: '', to: '', closed: false },
    sunday: { from: '', to: '', closed: false },
  });

  const isChain = form.name.trim().length > 1 && isChainRestaurant(form.name);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArray(field: 'meal_types' | 'cuisine_types' | 'beggar_perks', val: string) {
    const arr = form[field] as string[];
    setField(field, arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  /** Google Maps 連結 → 解析座標 + 短 ID */
  async function handleResolveUrl() {
    setError(null);
    if (!form.gmapsUrl.trim()) {
      setError('請貼上 Google Maps 連結');
      return;
    }
    setResolvingUrl(true);
    try {
      const result = await parseGmapsUrl(form.gmapsUrl.trim());
      if (result.latitude == null || result.longitude == null) {
        setError('無法從連結解析出座標，請改用地圖點選');
        return;
      }
      setForm((prev) => ({
        ...prev,
        latitude: result.latitude!.toFixed(6),
        longitude: result.longitude!.toFixed(6),
        googleShortId: result.googleShortId ?? null,
        resolvedFromUrl: true,
        name: prev.name || (result.name ?? ''),
        address: prev.address || (result.address ?? ''),
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '連結解析失敗');
    } finally {
      setResolvingUrl(false);
    }
  }

  /** 在新分頁打開 Google Maps 搜尋頁；若已填店名則順便代入 */
  function openGmapsSearch() {
    const query = form.name.trim();
    const url = query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : `https://www.google.com/maps`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** 切換到地圖點選模式 */
  function switchToPinMode() {
    setField('locationMode', 'pin');
    setField('resolvedFromUrl', false);
    setField('googleShortId', null);
    onRequestPinSelect();
  }

  /** 圖片上傳（菜單 or 餐點） */
  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>, type: ImageType) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('只支援 JPG、PNG、WebP 格式');
      return;
    }
    setUploading(type);
    setError(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1, maxWidthOrHeight: 1200, fileType: 'image/webp', useWebWorker: true,
      });

      let key: string;
      if (USE_MOCK) {
        // mock 模式：產生假 key（不真的上傳）
        key = `mock-${type}-${crypto.randomUUID()}.webp`;
      } else {
        const { presignedPutUrl, tempKey } = await apiFetch<{ presignedPutUrl: string; tempKey: string }>(
          '/api/upload/presign',
          { method: 'POST', body: JSON.stringify({ contentType: 'image/webp', sizeBytes: compressed.size }) },
        );
        const uploadRes = await fetch(presignedPutUrl, {
          method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/webp' },
        });
        if (!uploadRes.ok) throw new Error('圖片上傳失敗');
        key = tempKey;
      }

      const fieldName = type === 'menu' ? 'menu_image_keys' : 'food_image_keys';
      setForm((prev) => ({ ...prev, [fieldName]: [...prev[fieldName], key] }));
      setImagePreviews((prev) => ({
        ...prev,
        [type]: [...prev[type], URL.createObjectURL(compressed)],
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '圖片上傳失敗');
    } finally {
      setUploading(null);
      // reset file input 讓同一張圖能重新選
      e.target.value = '';
    }
  }

  function removeImage(type: ImageType, idx: number) {
    const fieldName = type === 'menu' ? 'menu_image_keys' : 'food_image_keys';
    setForm((prev) => ({
      ...prev,
      [fieldName]: (prev[fieldName] as string[]).filter((_, i) => i !== idx),
    }));
    setImagePreviews((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== idx),
    }));
  }

  function setHoursPresetField(group: 'weekday' | 'saturday' | 'sunday', patch: Partial<{ from: string; to: string; closed: boolean }>) {
    setHoursPreset((prev) => ({ ...prev, [group]: { ...prev[group], ...patch } }));
  }

  /** 把 preset 展開為 7 天結構（提交前用） */
  function buildBusinessHours(): BusinessHours {
    if (hoursExpanded) return form.business_hours;
    const fmt = (g: { from: string; to: string; closed: boolean }) =>
      g.closed ? 'closed' : g.from && g.to ? `${g.from}-${g.to}` : null;
    const w = fmt(hoursPreset.weekday);
    return {
      mon: w, tue: w, wed: w, thu: w, fri: w,
      sat: fmt(hoursPreset.saturday),
      sun: fmt(hoursPreset.sunday),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form._hp) return;
    if (!form.name.trim()) { setError('請輸入餐廳名稱'); return; }
    if (!form.latitude || !form.longitude) {
      setError(form.locationMode === 'url' ? '請貼上 Google Maps 連結並按解析' : '請在地圖上選擇位置');
      return;
    }
    if (!form.price_item_name.trim()) { setError('請填寫代表品項名稱'); return; }
    if (!form.price_amount) { setError('請填寫代表品項的價格'); return; }
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (lat < 21 || lat > 26.5 || lng < 119 || lng > 123) {
      setError('位置必須在台灣範圍內'); return;
    }
    const amt = parseInt(form.price_amount);
    if (isNaN(amt) || amt < 1 || amt > 10000) {
      setError('價格請填 1~10000 元'); return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        latitude: lat,
        longitude: lng,
        price_item_name: form.price_item_name.trim(),
        price_amount: amt,
        meal_types: form.meal_types,
        cuisine_types: form.cuisine_types,
        beggar_perks: form.beggar_perks,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        business_hours: buildBusinessHours(),
        google_short_id: form.googleShortId ?? undefined,
        menu_image_keys: form.menu_image_keys,
        food_image_keys: form.food_image_keys,
      };

      if (USE_MOCK) {
        console.log('[MOCK] submit payload:', payload);
        await new Promise((r) => setTimeout(r, 500));
      } else {
        await apiFetch('/api/restaurants', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 429) setError('今日提交次數已達上限，請明天再試');
      else setError(e.message ?? '提交失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">新增餐廳</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Honeypot */}
          <input
            name="_hp" value={form._hp} onChange={(e) => setField('_hp', e.target.value)}
            tabIndex={-1} autoComplete="off"
            style={{ position: 'absolute', opacity: 0, height: 0, pointerEvents: 'none' }}
            aria-hidden="true"
          />

          {/* 餐廳名稱 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              餐廳名稱 <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="例：阿輝牛肉麵" maxLength={50}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
            />
            {isChain && (
              <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <span>「{form.name}」看起來像連鎖餐飲，乞丐地圖以獨立小吃店為主。如確認為獨立店家請繼續送出。</span>
              </div>
            )}
          </div>

          {/* 位置 — URL 模式 / Pin 模式 切換 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {form.locationMode === 'url' ? (
                <>Google Maps 連結 <span className="text-red-500">*</span></>
              ) : (
                <>位置 <span className="text-red-500">*</span></>
              )}
            </label>

            {form.locationMode === 'url' ? (
              <>
                {/* URL 輸入 */}
                <div className="flex gap-2">
                  <input
                    type="url" value={form.gmapsUrl}
                    onChange={(e) => setField('gmapsUrl', e.target.value)}
                    placeholder="貼上 Google Maps 連結"
                    className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
                  />
                  <button
                    type="button" onClick={handleResolveUrl} disabled={resolvingUrl || !form.gmapsUrl.trim()}
                    className="px-3 py-2 text-sm font-medium bg-[#003580] text-white rounded-lg hover:bg-[#002860] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {resolvingUrl ? '解析中…' : '解析'}
                  </button>
                </div>

                {/* 已解析狀態 */}
                {form.resolvedFromUrl && form.latitude && form.longitude && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800 flex items-start gap-2">
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>
                      已解析座標 ({parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)})
                      {form.googleShortId && ` · Google ID: ${form.googleShortId}`}
                    </span>
                  </div>
                )}

                {/* 兩個輔助按鈕 */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button" onClick={openGmapsSearch}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    在 Google Maps 搜尋
                  </button>
                  <button
                    type="button" onClick={switchToPinMode}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 inline-flex items-center gap-1.5 transition-colors"
                  >
                    🗺️ 找不到？改用地圖點選
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Pin 模式 */}
                {form.latitude && form.longitude ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 tabular-nums">
                      {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
                    </span>
                    <button
                      type="button" onClick={onRequestPinSelect}
                      className="px-3 py-2 text-sm border border-[#003580]/40 text-[#003580] rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      重新選點
                    </button>
                  </div>
                ) : (
                  <button
                    type="button" onClick={onRequestPinSelect}
                    className="w-full py-2.5 border-2 border-dashed border-orange-300 text-[#003580] rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
                  >
                    📍 在地圖上選擇位置
                  </button>
                )}
                <button
                  type="button" onClick={() => setField('locationMode', 'url')}
                  className="mt-2 text-xs text-gray-500 hover:text-[#003580] underline"
                >
                  ← 改用 Google Maps 連結
                </button>
              </>
            )}
          </div>

          {/* 代表品項 + 價格（必填）*/}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              代表品項與價格 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text" value={form.price_item_name}
                onChange={(e) => setField('price_item_name', e.target.value)}
                placeholder="例：排骨便當" maxLength={30}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
              />
              <div className="relative w-28">
                <input
                  type="number" value={form.price_amount}
                  onChange={(e) => setField('price_amount', e.target.value)}
                  placeholder="金額" min={1} max={10000}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">元</span>
              </div>
            </div>
          </div>

          {/* 用餐時段 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              用餐時段（可多選）{form.meal_types.length > 0 && <span className="text-[#003580] ml-1">{form.meal_types.length}</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((t) => (
                <button
                  key={t} type="button" onClick={() => toggleArray('meal_types', t)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    form.meal_types.includes(t) ? 'bg-[#003580] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 料理類型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              料理類型（可多選）{form.cuisine_types.length > 0 && <span className="text-[#003580] ml-1">{form.cuisine_types.length}</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {CUISINE_TYPES.map((t) => (
                <button
                  key={t} type="button" onClick={() => toggleArray('cuisine_types', t)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    form.cuisine_types.includes(t) ? 'bg-[#003580] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 乞丐加碼 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">乞丐加碼（可多選）</label>
            <div className="flex flex-wrap gap-2">
              {BEGGAR_PERKS.map((perk) => (
                <button
                  key={perk} type="button" onClick={() => toggleArray('beggar_perks', perk)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    form.beggar_perks.includes(perk) ? 'bg-[#003580] text-white' : 'bg-blue-50 text-[#003580] border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  {perk}
                </button>
              ))}
            </div>
          </div>

          {/* 地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
            <input
              type="text" value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="例：台北市大安區和平東路二段"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
            />
          </div>

          {/* 電話 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電話</label>
            <input
              type="tel" value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="例：02-2553-6803"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
            />
          </div>

          {/* 營業時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">營業時間</label>
            {!hoursExpanded ? (
              <div className="space-y-2">
                <HoursRow
                  label="平日（週一-週五）"
                  preset={hoursPreset.weekday}
                  onChange={(p) => setHoursPresetField('weekday', p)}
                />
                <HoursRow
                  label="週六"
                  preset={hoursPreset.saturday}
                  onChange={(p) => setHoursPresetField('saturday', p)}
                />
                <HoursRow
                  label="週日"
                  preset={hoursPreset.sunday}
                  onChange={(p) => setHoursPresetField('sunday', p)}
                />
                <button
                  type="button" onClick={() => setHoursExpanded(true)}
                  className="text-xs text-[#003580] hover:underline"
                >
                  + 每日設定不同時間
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((k) => (
                  <HoursDayRow
                    key={k}
                    label={({ mon: '週一', tue: '週二', wed: '週三', thu: '週四', fri: '週五', sat: '週六', sun: '週日' })[k]}
                    value={form.business_hours[k] ?? ''}
                    onChange={(v) => setField('business_hours', { ...form.business_hours, [k]: v })}
                  />
                ))}
                <button
                  type="button" onClick={() => setHoursExpanded(false)}
                  className="text-xs text-[#003580] hover:underline"
                >
                  ← 收回簡易設定
                </button>
              </div>
            )}
          </div>

          {/* 圖片上傳 — 菜單 / 餐點 分開（桌機並排，手機堆疊） */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageUploadSection
              label="菜單照片"
              type="menu"
              previews={imagePreviews.menu}
              uploading={uploading === 'menu'}
              anyUploading={uploading !== null}
              onChange={handleImageChange}
              onRemove={removeImage}
            />
            <ImageUploadSection
              label="餐點照片"
              type="food"
              previews={imagePreviews.food}
              uploading={uploading === 'food'}
              anyUploading={uploading !== null}
              onChange={handleImageChange}
              onRemove={removeImage}
            />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pb-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit" disabled={submitting || uploading !== null}
              className="flex-1 py-3 bg-[#003580] text-white rounded-xl text-sm font-medium hover:bg-[#002860] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '提交中...' : '送出審核'}
            </button>
          </div>
          <p className="text-xs text-center text-gray-400">提交後需經管理員審核才會公開顯示</p>
        </form>
      </div>
    </div>
  );
}

// ── 簡易營業時間單行（平日/週六/週日）──
function HoursRow({
  label, preset, onChange,
}: {
  label: string;
  preset: { from: string; to: string; closed: boolean };
  onChange: (patch: Partial<{ from: string; to: string; closed: boolean }>) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-600 w-32 shrink-0">{label}</span>
      {preset.closed ? (
        <span className="flex-1 text-gray-400 italic text-xs">公休</span>
      ) : (
        <>
          <input
            type="time" value={preset.from}
            onChange={(e) => onChange({ from: e.target.value })}
            className="border border-gray-200 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
          />
          <span className="text-gray-400">-</span>
          <input
            type="time" value={preset.to}
            onChange={(e) => onChange({ to: e.target.value })}
            className="border border-gray-200 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
          />
        </>
      )}
      <button
        type="button"
        onClick={() => onChange({ closed: !preset.closed, from: '', to: '' })}
        className={`text-xs px-2 py-1 rounded-full ml-auto transition-colors ${
          preset.closed
            ? 'bg-gray-200 text-gray-700'
            : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
        }`}
      >
        {preset.closed ? '取消公休' : '公休'}
      </button>
    </div>
  );
}

// ── 展開模式：每日獨立 ──
function HoursDayRow({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const closed = value === 'closed';
  const [from, to] = closed || !value ? ['', ''] : value.split('-');
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-600 w-12 shrink-0">{label}</span>
      {closed ? (
        <span className="flex-1 text-gray-400 italic text-xs">公休</span>
      ) : (
        <>
          <input
            type="time" value={from}
            onChange={(e) => onChange(`${e.target.value}-${to}`)}
            className="border border-gray-200 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
          />
          <span className="text-gray-400">-</span>
          <input
            type="time" value={to}
            onChange={(e) => onChange(`${from}-${e.target.value}`)}
            className="border border-gray-200 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
          />
        </>
      )}
      <button
        type="button"
        onClick={() => onChange(closed ? '' : 'closed')}
        className={`text-xs px-2 py-1 rounded-full ml-auto transition-colors ${
          closed ? 'bg-gray-200 text-gray-700' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
        }`}
      >
        {closed ? '取消公休' : '公休'}
      </button>
    </div>
  );
}

// ── 圖片上傳區塊（菜單 / 餐點 共用）──
function ImageUploadSection({
  label, type, previews, uploading, anyUploading, onChange, onRemove,
}: {
  label: string;
  type: ImageType;
  previews: string[];
  uploading: boolean;
  anyUploading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>, t: ImageType) => void;
  onRemove: (t: ImageType, idx: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {previews.map((src, idx) => (
          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button
              type="button" onClick={() => onRemove(type, idx)}
              className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 rounded-full p-1 text-white"
              aria-label="移除"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {previews.length < 5 && (
          <label className={`aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#003580]/50 transition-colors text-gray-400 ${anyUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onChange(e, type)} disabled={anyUploading} className="hidden"
            />
            {uploading ? (
              <span className="text-xs">上傳中…</span>
            ) : (
              <>
                <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">新增</span>
              </>
            )}
          </label>
        )}
      </div>
      {previews.length === 0 && (
        <p className="text-xs text-gray-400 mt-1">JPG、PNG、WebP，最大 1MB（自動壓縮）</p>
      )}
    </div>
  );
}
