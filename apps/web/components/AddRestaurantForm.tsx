'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { apiFetch } from '@/lib/api';
import { isChainRestaurant } from '@/lib/chains';

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

type FormState = {
  name: string;
  latitude: string;
  longitude: string;
  price_item_name: string;
  price_amount: string;
  meal_types: string[];
  cuisine_types: string[];
  beggar_perks: string[];
  address: string;
  cover_image_key: string | null;
  _hp: string;
};

export default function AddRestaurantForm({ initialLat, initialLng, onClose, onSuccess, onRequestPinSelect }: Props) {
  const [form, setForm] = useState<FormState>({
    name: '',
    latitude: initialLat?.toFixed(6) ?? '',
    longitude: initialLng?.toFixed(6) ?? '',
    price_item_name: '',
    price_amount: '',
    meal_types: [],
    cuisine_types: [],
    beggar_perks: [],
    address: '',
    cover_image_key: null,
    _hp: '',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const isChain = form.name.trim().length > 1 && isChainRestaurant(form.name);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleArray(field: 'meal_types' | 'cuisine_types' | 'beggar_perks', val: string) {
    const arr = form[field] as string[];
    setField(field, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('只支援 JPG、PNG、WebP 格式');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        fileType: 'image/webp',
        useWebWorker: true,
      });
      const { presignedPutUrl, tempKey } = await apiFetch<{ presignedPutUrl: string; tempKey: string }>(
        '/api/upload/presign',
        { method: 'POST', body: JSON.stringify({ contentType: 'image/webp', sizeBytes: compressed.size }) }
      );
      const uploadRes = await fetch(presignedPutUrl, {
        method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/webp' },
      });
      if (!uploadRes.ok) throw new Error('圖片上傳失敗');
      setField('cover_image_key', tempKey);
      setImagePreview(URL.createObjectURL(compressed));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '圖片上傳失敗');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form._hp) return;
    if (!form.name.trim()) { setError('請輸入餐廳名稱'); return; }
    if (!form.latitude || !form.longitude) { setError('請在地圖上選擇位置'); return; }
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (lat < 21 || lat > 26.5 || lng < 119 || lng > 123) {
      setError('位置必須在台灣範圍內'); return;
    }
    if (form.price_amount && (parseInt(form.price_amount) < 1 || parseInt(form.price_amount) > 10000)) {
      setError('價格請填 1~10000 元'); return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/restaurants', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          latitude: lat,
          longitude: lng,
          price_item_name: form.price_item_name.trim() || undefined,
          price_amount: form.price_amount ? parseInt(form.price_amount) : undefined,
          meal_types: form.meal_types,
          cuisine_types: form.cuisine_types,
          beggar_perks: form.beggar_perks,
          address: form.address.trim() || undefined,
          cover_image_key: form.cover_image_key ?? undefined,
        }),
      });
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
            name="_hp" value={form._hp} onChange={e => setField('_hp', e.target.value)}
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
              type="text"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="例：阿輝牛肉麵"
              maxLength={50}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
            />
            {/* 連鎖餐飲警告 */}
            {isChain && (
              <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <span>「{form.name}」看起來像連鎖餐飲，乞丐地圖以獨立小吃店為主。如確認為獨立店家請繼續送出。</span>
              </div>
            )}
          </div>

          {/* 地圖選點 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              位置 <span className="text-red-500">*</span>
            </label>
            {form.latitude && form.longitude ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1">
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
          </div>

          {/* 代表品項 + 價格 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">代表品項與價格（選填）</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.price_item_name}
                onChange={e => setField('price_item_name', e.target.value)}
                placeholder="例：排骨便當"
                maxLength={30}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
              />
              <div className="relative w-28">
                <input
                  type="number"
                  value={form.price_amount}
                  onChange={e => setField('price_amount', e.target.value)}
                  placeholder="金額"
                  min={1} max={10000}
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
              {MEAL_TYPES.map(t => (
                <button
                  key={t} type="button" onClick={() => toggleArray('meal_types', t)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    form.meal_types.includes(t)
                      ? 'bg-[#003580] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              {CUISINE_TYPES.map(t => (
                <button
                  key={t} type="button" onClick={() => toggleArray('cuisine_types', t)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    form.cuisine_types.includes(t)
                      ? 'bg-[#003580] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 乞丐加碼 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">乞丐加碼（有提供才選）</label>
            <div className="flex flex-wrap gap-2">
              {BEGGAR_PERKS.map(perk => (
                <button
                  key={perk} type="button" onClick={() => toggleArray('beggar_perks', perk)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    form.beggar_perks.includes(perk)
                      ? 'bg-[#003580] text-white'
                      : 'bg-blue-50 text-[#003580] border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  {perk}
                </button>
              ))}
            </div>
          </div>

          {/* 地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">地址（選填）</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setField('address', e.target.value)}
              placeholder="例：台北市大安區和平東路二段"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30"
            />
          </div>

          {/* 圖片上傳 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">封面照片（選填）</label>
            {imagePreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="預覽" className="w-full h-40 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => { setField('cover_image_key', null); setImagePreview(null); }}
                  className="absolute top-2 right-2 bg-white/80 rounded-full p-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className={`block w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-[#D4380D]/50 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange} disabled={uploading} className="hidden"
                />
                <p className="text-sm text-gray-500">{uploading ? '上傳中...' : '點擊選擇照片'}</p>
                <p className="text-xs text-gray-400 mt-1">JPG、PNG、WebP，最大 5MB</p>
              </label>
            )}
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
              type="submit" disabled={submitting || uploading}
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
