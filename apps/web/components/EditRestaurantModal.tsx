'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { imgUrl } from '@/lib/image';
import type { RestaurantDetail, BusinessHours } from '@/lib/api';

type Props = {
  restaurant: RestaurantDetail;
  onClose: () => void;
  onSavedToast?: (msg: string) => void;
};

const MEAL_TYPES = ['早餐', '午餐', '晚餐', '小吃', '甜點', '宵夜', '咖啡廳', '素食', '其他'];
const CUISINE_TYPES = [
  '中式料理', '西式料理', '義式料理', '日式料理', '韓式料理',
  '異國料理', '合菜', '便當', '自助餐', '火鍋', '麵食', '飲品&咖啡', '健康餐', '其他',
];
const BEGGAR_PERKS = ['免費加飯', '免費加菜', '免費飲料', '自助吧'];

type PresetHours = {
  weekday: { from: string; to: string; closed: boolean };
  saturday: { from: string; to: string; closed: boolean };
  sunday: { from: string; to: string; closed: boolean };
};

/** 把 BusinessHours 拆成 preset 三行（嘗試偵測平日是否相同） */
function detectPreset(hours: BusinessHours | null): { mode: 'preset' | 'expanded'; preset: PresetHours } {
  const empty: PresetHours = {
    weekday: { from: '', to: '', closed: false },
    saturday: { from: '', to: '', closed: false },
    sunday: { from: '', to: '', closed: false },
  };
  if (!hours) return { mode: 'preset', preset: empty };

  const parse = (v: string | null | undefined): { from: string; to: string; closed: boolean } => {
    if (!v) return { from: '', to: '', closed: false };
    if (v === 'closed') return { from: '', to: '', closed: true };
    const [from, to] = v.split('-');
    return { from: from?.trim() ?? '', to: to?.trim() ?? '', closed: false };
  };

  const weekdays = [hours.mon, hours.tue, hours.wed, hours.thu, hours.fri];
  const allWeekdaysEqual = weekdays.every((v) => v === weekdays[0]);

  if (allWeekdaysEqual) {
    return {
      mode: 'preset',
      preset: {
        weekday: parse(weekdays[0]),
        saturday: parse(hours.sat),
        sunday: parse(hours.sun),
      },
    };
  }

  return { mode: 'expanded', preset: empty };
}

export default function EditRestaurantModal({ restaurant, onClose, onSavedToast }: Props) {
  // ── 基本資訊 ──
  const [name, setName] = useState(restaurant.name);
  const [priceItemName, setPriceItemName] = useState(restaurant.price_item_name ?? '');
  const [priceAmount, setPriceAmount] = useState(
    restaurant.price_amount?.toString() ?? restaurant.price_min?.toString() ?? '',
  );
  const [address, setAddress] = useState(restaurant.address ?? '');
  const [phone, setPhone] = useState(restaurant.phone ?? '');

  // ── 分類 chips ──
  const [mealTypes, setMealTypes] = useState<string[]>(restaurant.meal_types ?? []);
  const [cuisineTypes, setCuisineTypes] = useState<string[]>(restaurant.cuisine_types ?? []);
  const [beggarPerks, setBeggarPerks] = useState<string[]>(restaurant.beggar_perks ?? []);

  // ── 營業時間 ──
  const initialHours = detectPreset(restaurant.business_hours);
  const [hoursExpanded, setHoursExpanded] = useState(initialHours.mode === 'expanded');
  const [hoursPreset, setHoursPreset] = useState<PresetHours>(initialHours.preset);
  const [hoursPerDay, setHoursPerDay] = useState<BusinessHours>(restaurant.business_hours ?? {});

  // ── 圖片 ──
  // 舊圖：唯讀（不可移除）
  const existingMenu = restaurant.menu_image_keys ?? [];
  const existingFood = restaurant.food_image_keys ?? [];
  // 新增的圖：可移除（送出前才存）
  const [newMenuKeys, setNewMenuKeys] = useState<string[]>([]);
  const [newFoodKeys, setNewFoodKeys] = useState<string[]>([]);
  const [newMenuPreviews, setNewMenuPreviews] = useState<string[]>([]);
  const [newFoodPreviews, setNewFoodPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState<'menu' | 'food' | null>(null);

  function toggle(field: 'meal' | 'cuisine' | 'perk', val: string) {
    if (field === 'meal') setMealTypes((arr) => (arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]));
    else if (field === 'cuisine') setCuisineTypes((arr) => (arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]));
    else setBeggarPerks((arr) => (arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]));
  }

  function setHoursPresetField(group: keyof PresetHours, patch: Partial<{ from: string; to: string; closed: boolean }>) {
    setHoursPreset((prev) => ({ ...prev, [group]: { ...prev[group], ...patch } }));
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>, type: 'menu' | 'food') {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    setUploading(type);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1, maxWidthOrHeight: 1200, fileType: 'image/webp', useWebWorker: true,
      });
      const key = `mock-edit-${type}-${crypto.randomUUID()}.webp`;   // mock-only：不真上傳
      const preview = URL.createObjectURL(compressed);
      if (type === 'menu') {
        setNewMenuKeys((prev) => [...prev, key]);
        setNewMenuPreviews((prev) => [...prev, preview]);
      } else {
        setNewFoodKeys((prev) => [...prev, key]);
        setNewFoodPreviews((prev) => [...prev, preview]);
      }
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  }

  function removeNewImage(type: 'menu' | 'food', idx: number) {
    if (type === 'menu') {
      setNewMenuKeys((prev) => prev.filter((_, i) => i !== idx));
      setNewMenuPreviews((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setNewFoodKeys((prev) => prev.filter((_, i) => i !== idx));
      setNewFoodPreviews((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSavedToast?.('編輯功能尚未開放（mock 模式）');
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 pointer-events-none">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:w-[520px] md:max-h-[88vh] max-h-[88vh] overflow-y-auto pointer-events-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between z-10">
            <h2 className="text-base font-bold text-gray-900">編輯餐廳</h2>
            <button
              type="button" onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
              aria-label="關閉"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              ⚠️ 此為展示用編輯介面，儲存後不會實際更動資料
            </div>

            {/* 餐廳名稱 */}
            <Field label="餐廳名稱">
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
              />
            </Field>

            {/* 代表品項 + 價格 */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="代表品項">
                <input
                  type="text" value={priceItemName} onChange={(e) => setPriceItemName(e.target.value)}
                  placeholder="例：排骨便當"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
                />
              </Field>
              <Field label="價格 (TWD)">
                <input
                  type="number" value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)}
                  placeholder="100" min={1} max={10000}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
                />
              </Field>
            </div>

            <Field label="地址">
              <input
                type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
              />
            </Field>

            <Field label="電話">
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
              />
            </Field>

            {/* 用餐時段 */}
            <ChipGroup
              label="用餐時段"
              options={MEAL_TYPES}
              selected={mealTypes}
              onToggle={(v) => toggle('meal', v)}
              variant="solid"
            />

            {/* 料理類型 */}
            <ChipGroup
              label="料理類型"
              options={CUISINE_TYPES}
              selected={cuisineTypes}
              onToggle={(v) => toggle('cuisine', v)}
              variant="solid"
            />

            {/* 乞丐加碼 */}
            <ChipGroup
              label="乞丐加碼"
              options={BEGGAR_PERKS}
              selected={beggarPerks}
              onToggle={(v) => toggle('perk', v)}
              variant="outline"
            />

            {/* 營業時間 */}
            <div>
              <span className="block text-xs font-medium text-gray-600 mb-1.5">營業時間</span>
              {!hoursExpanded ? (
                <div className="space-y-2">
                  <HoursRow label="平日（週一-週五）" preset={hoursPreset.weekday} onChange={(p) => setHoursPresetField('weekday', p)} />
                  <HoursRow label="週六" preset={hoursPreset.saturday} onChange={(p) => setHoursPresetField('saturday', p)} />
                  <HoursRow label="週日" preset={hoursPreset.sunday} onChange={(p) => setHoursPresetField('sunday', p)} />
                  <button type="button" onClick={() => setHoursExpanded(true)} className="text-xs text-[#003580] hover:underline">
                    + 每日設定不同時間
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((k) => (
                    <HoursDayRow
                      key={k}
                      label={({ mon: '週一', tue: '週二', wed: '週三', thu: '週四', fri: '週五', sat: '週六', sun: '週日' })[k]}
                      value={hoursPerDay[k] ?? ''}
                      onChange={(v) => setHoursPerDay((prev) => ({ ...prev, [k]: v }))}
                    />
                  ))}
                  <button type="button" onClick={() => setHoursExpanded(false)} className="text-xs text-[#003580] hover:underline">
                    ← 收回簡易設定
                  </button>
                </div>
              )}
            </div>

            {/* 圖片：菜單 + 餐點（並排） */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImageEditSection
                label="菜單照片"
                type="menu"
                existingKeys={existingMenu}
                newPreviews={newMenuPreviews}
                uploading={uploading === 'menu'}
                anyUploading={uploading !== null}
                onAdd={handleImageChange}
                onRemoveNew={removeNewImage}
              />
              <ImageEditSection
                label="餐點照片"
                type="food"
                existingKeys={existingFood}
                newPreviews={newFoodPreviews}
                uploading={uploading === 'food'}
                anyUploading={uploading !== null}
                onAdd={handleImageChange}
                onRemoveNew={removeNewImage}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex gap-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#003580] hover:bg-[#002860] text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              儲存（測試）
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ──────────────── 小元件 ────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function ChipGroup({
  label, options, selected, onToggle, variant,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  variant: 'solid' | 'outline';
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}{selected.length > 0 && <span className="text-[#003580] ml-1">{selected.length}</span>}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((t) => {
          const active = selected.includes(t);
          const cls = variant === 'solid'
            ? active ? 'bg-[#003580] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            : active ? 'bg-[#003580] text-white' : 'bg-blue-50 text-[#003580] border border-blue-200 hover:bg-blue-100';
          return (
            <button
              key={t} type="button" onClick={() => onToggle(t)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${cls}`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
          <input type="time" value={preset.from} onChange={(e) => onChange({ from: e.target.value })}
            className="border border-gray-200 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
          />
          <span className="text-gray-400">-</span>
          <input type="time" value={preset.to} onChange={(e) => onChange({ to: e.target.value })}
            className="border border-gray-200 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
          />
        </>
      )}
      <button type="button" onClick={() => onChange({ closed: !preset.closed, from: '', to: '' })}
        className={`text-xs px-2 py-1 rounded-full ml-auto ${preset.closed ? 'bg-gray-200 text-gray-700' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
      >
        {preset.closed ? '取消公休' : '公休'}
      </button>
    </div>
  );
}

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
          <input type="time" value={from} onChange={(e) => onChange(`${e.target.value}-${to}`)}
            className="border border-gray-200 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
          />
          <span className="text-gray-400">-</span>
          <input type="time" value={to} onChange={(e) => onChange(`${from}-${e.target.value}`)}
            className="border border-gray-200 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
          />
        </>
      )}
      <button type="button" onClick={() => onChange(closed ? '' : 'closed')}
        className={`text-xs px-2 py-1 rounded-full ml-auto ${closed ? 'bg-gray-200 text-gray-700' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
      >
        {closed ? '取消公休' : '公休'}
      </button>
    </div>
  );
}

/** 圖片區塊（編輯模式）：舊圖唯讀，新圖可移除 */
function ImageEditSection({
  label, type, existingKeys, newPreviews, uploading, anyUploading, onAdd, onRemoveNew,
}: {
  label: string;
  type: 'menu' | 'food';
  existingKeys: string[];
  newPreviews: string[];
  uploading: boolean;
  anyUploading: boolean;
  onAdd: (e: React.ChangeEvent<HTMLInputElement>, t: 'menu' | 'food') => void;
  onRemoveNew: (t: 'menu' | 'food', idx: number) => void;
}) {
  const totalSlots = 5;
  const usedSlots = existingKeys.length + newPreviews.length;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-[10px] text-gray-400">{usedSlots} / {totalSlots}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {/* 舊圖：唯讀 */}
        {existingKeys.map((k, i) => {
          const url = imgUrl(k);
          return (
            <div key={`old-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="w-full h-full object-cover opacity-90" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" />
                  </svg>
                </div>
              )}
              <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">原有</span>
            </div>
          );
        })}

        {/* 新增的圖：可移除 */}
        {newPreviews.map((src, i) => (
          <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 ring-2 ring-[#003580]/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button
              type="button" onClick={() => onRemoveNew(type, i)}
              className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 rounded-full p-1 text-white"
              aria-label="移除"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="absolute bottom-1 left-1 bg-[#003580] text-white text-[10px] px-1.5 py-0.5 rounded">新</span>
          </div>
        ))}

        {/* 新增 button */}
        {usedSlots < totalSlots && (
          <label className={`aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#003580]/50 transition-colors text-gray-400 ${anyUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onAdd(e, type)} disabled={anyUploading} className="hidden"
            />
            {uploading ? (
              <span className="text-xs">上傳中…</span>
            ) : (
              <>
                <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-[10px]">新增</span>
              </>
            )}
          </label>
        )}
      </div>
      {existingKeys.length > 0 && (
        <p className="text-[10px] text-gray-400 mt-1">原有照片不可移除</p>
      )}
    </div>
  );
}
