'use client';

import { useState } from 'react';

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  price_min: number | null;
  categories: string[];
  address: string | null;
  cover_image_key: string | null;
  status: string;
  report_count: number;
  review_count: number;
  created_at: string;
};

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ pending_restaurants: number; active_restaurants: number; total_reviews: number } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

  async function login() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert('Token 錯誤'); return; }
      const data = await res.json();
      setStats(data);
      setAuthed(true);
      await loadPending();
    } finally {
      setLoading(false);
    }
  }

  async function loadPending() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/restaurants?status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRestaurants(data);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`${API_URL}/api/admin/restaurants/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    setRestaurants(prev => prev.filter(r => r.id !== id));
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">
          <h1 className="text-xl font-bold mb-6 text-center">管理員登入</h1>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Admin Secret"
            className="w-full border px-3 py-2.5 rounded-lg mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            onKeyDown={e => e.key === 'Enter' && login()}
          />
          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-orange-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? '驗證中...' : '登入'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">乞丐地圖管理後台</h1>
          <button onClick={() => setAuthed(false)} className="text-sm text-gray-500 hover:text-gray-700">
            登出
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: '待審核', value: stats.pending_restaurants, color: 'bg-yellow-100 text-yellow-700' },
              { label: '已上線', value: stats.active_restaurants, color: 'bg-green-100 text-green-700' },
              { label: '總評論', value: stats.total_reviews, color: 'bg-blue-100 text-blue-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color} px-2 py-0.5 rounded inline-block`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 待審核餐廳 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">待審核餐廳</h2>
            <button
              onClick={loadPending}
              disabled={loading}
              className="text-sm text-orange-600 hover:text-orange-700"
            >
              重新載入
            </button>
          </div>

          {loading && <p className="text-sm text-gray-400 text-center py-4">載入中...</p>}

          {!loading && restaurants.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">目前沒有待審核的餐廳</p>
          )}

          <div className="space-y-4">
            {restaurants.map(r => (
              <div key={r.id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{r.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                      {r.address && ` | ${r.address}`}
                    </p>
                    {r.price_min && (
                      <p className="text-xs text-green-700 mt-0.5">最低 ${r.price_min} TWD</p>
                    )}
                    {r.categories.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">{r.categories.join('、')}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(r.created_at).toLocaleString('zh-TW')}
                      {' | '}
                      <a
                        href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        Google Maps
                      </a>
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus(r.id, 'active')}
                      className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-600"
                    >
                      通過
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, 'rejected')}
                      className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-600"
                    >
                      拒絕
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, 'shadow_banned')}
                      className="bg-gray-400 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-500"
                    >
                      靜默
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
