'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  TAIWAN_BOUNDS, TAIPEI_CENTER,
  getTilesUrl, getMapStyle,
} from '@/lib/maplibre';
import type { MarkerData } from '@/lib/api';
import type { Map as MapLibreMap, MapMouseEvent, GeoJSONSource, Popup } from 'maplibre-gl';

const SESSION_KEY = 'beggarsmap_map_pos';

type Props = {
  markers: MarkerData[];
  selectedId?: string | null;
  onRestaurantClick: (restaurant: MarkerData) => void;
  onRequestSearch: (bbox: [number, number, number, number]) => void;
  pinSelectMode?: boolean;
  onPinSelect?: (lat: number, lng: number) => void;
  sidePanelOpen?: boolean;
  onMapReady?: (flyTo: (lng: number, lat: number, zoom?: number) => void) => void;
  onBoundsChange?: (bbox: [number, number, number, number], center: { lng: number; lat: number }) => void;
  onInitialBounds?: (bbox: [number, number, number, number]) => void;
};

const BRAND = '#003580';
const BRAND_SELECTED = '#006CE4';

/** 畫 Booking.com 風格圓角矩形，回傳 ImageData */
function makeTagImage(color: string, pixelRatio: number): ImageData {
  const W = 28 * pixelRatio;
  const H = 18 * pixelRatio;
  const r = 3 * pixelRatio;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(W - r, 0); ctx.quadraticCurveTo(W, 0, W, r);
  ctx.lineTo(W, H - r); ctx.quadraticCurveTo(W, H, W - r, H);
  ctx.lineTo(r, H); ctx.quadraticCurveTo(0, H, 0, H - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  return ctx.getImageData(0, 0, W, H);
}

/** HTML escape for popup content */
function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function Map({
  markers, selectedId,
  onRestaurantClick, onRequestSearch,
  pinSelectMode = false, onPinSelect,
  sidePanelOpen = false, onMapReady,
  onBoundsChange, onInitialBounds,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoverPopupRef = useRef<Popup | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showSearchBtn, setShowSearchBtn] = useState(false);
  const pinSelectModeRef = useRef(pinSelectMode);
  const initialBoundsFiredRef = useRef(false);

  useEffect(() => { pinSelectModeRef.current = pinSelectMode; }, [pinSelectMode]);

  // Side panel → resize map canvas
  useEffect(() => {
    if (!mapRef.current) return;
    const t = setTimeout(() => mapRef.current?.resize(), 320);
    return () => clearTimeout(t);
  }, [sidePanelOpen]);

  // selectedId 變更 → 更新 selected 圖層 filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    const filter = (selectedId
      ? ['==', ['get', 'id'], selectedId]
      : ['==', ['get', 'id'], '__none__']) as Parameters<typeof map.setFilter>[1];
    if (map.getLayer('restaurant-points-selected')) {
      map.setFilter('restaurant-points-selected', filter);
    }
    if (map.getLayer('restaurant-selected-label')) {
      map.setFilter('restaurant-selected-label', filter);
    }
  }, [selectedId, isReady]);

  // 初始化地圖
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: MapLibreMap;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      const { Protocol } = await import('pmtiles');

      const protocol = new Protocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);

      type SavedPos = { lng: number; lat: number; zoom: number };
      let savedPos: SavedPos | null = null;
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) savedPos = JSON.parse(raw) as SavedPos;
      } catch { /* ignore */ }

      map = new maplibregl.Map({
        container: containerRef.current!,
        style: getMapStyle(getTilesUrl()),
        center: savedPos ? [savedPos.lng, savedPos.lat] : TAIPEI_CENTER,
        zoom: savedPos ? savedPos.zoom : 14,
        maxBounds: TAIWAN_BOUNDS,
        minZoom: 5,
        maxZoom: 18,
      });

      mapRef.current = map;
      onMapReady?.((lng, lat, zoom = 15) => map.flyTo({ center: [lng, lat], zoom }));

      const fireBounds = () => {
        const b = map.getBounds();
        const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
        const { lng, lat } = map.getCenter();
        onBoundsChange?.(bbox, { lng, lat });
        return bbox;
      };

      map.on('moveend', () => {
        setShowSearchBtn(true);
        try {
          const { lng, lat } = map.getCenter();
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ lng, lat, zoom: map.getZoom() }));
        } catch { /* ignore */ }
        fireBounds();
      });

      map.on('load', () => {
        const pr = window.devicePixelRatio || 1;

        // ── 圖示：正常 (深藍) + 選中 (亮藍) ──
        const tagNormal = makeTagImage(BRAND, pr);
        const tagSelected = makeTagImage(BRAND_SELECTED, pr);
        const W = 28 * pr, H = 18 * pr, s = 4 * pr;

        map.addImage('price-tag', tagNormal, {
          stretchX: [[s, W - s]], stretchY: [[s, H - s]],
          content: [s, s, W - s, H - s], pixelRatio: pr,
        });
        map.addImage('price-tag-selected', tagSelected, {
          stretchX: [[s, W - s]], stretchY: [[s, H - s]],
          content: [s, s, W - s, H - s], pixelRatio: pr,
        });

        // ── GeoJSON Source ──
        map.addSource('restaurants', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 50,
          clusterProperties: {
            min_price: ['min', ['coalesce', ['get', 'price_amount'], ['get', 'price_min'], 9999]],
          },
        });

        // ── Cluster 圓圈 ──
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'restaurants',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': BRAND,
            'circle-radius': ['step', ['get', 'point_count'], 20, 10, 26, 30, 34],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.92,
          },
        });

        // ── Cluster 文字 ──
        map.addLayer({
          id: 'cluster-label',
          type: 'symbol',
          source: 'restaurants',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['case',
              ['<', ['get', 'min_price'], 9000],
              ['concat', 'TWD ', ['to-string', ['get', 'min_price']], '+'],
              ['to-string', ['get', 'point_count']],
            ],
            'text-size': 11,
            'text-font': ['Noto Sans Regular'],
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#fff' },
        });

        // ── 個別 Pin：正常 ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tf = (expr: unknown) => expr as any;

        map.addLayer({
          id: 'restaurant-points',
          type: 'symbol',
          source: 'restaurants',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': 'price-tag',
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [5, 9, 5, 9],
            'icon-allow-overlap': true,
            'text-allow-overlap': true,
            'text-field': tf(['case',
              ['>', ['coalesce', ['get', 'price_amount'], ['get', 'price_min'], 0], 0],
              ['concat', 'TWD ', ['to-string', ['coalesce', ['get', 'price_amount'], ['get', 'price_min']]]],
              '未定價',
            ]),
            'text-size': 12,
            'text-font': ['Noto Sans Regular'],
          },
          paint: { 'text-color': '#ffffff' },
        });

        // ── 個別 Pin：選中狀態（疊加層，亮藍） ──
        map.addLayer({
          id: 'restaurant-points-selected',
          type: 'symbol',
          source: 'restaurants',
          filter: ['==', ['get', 'id'], '__none__'],
          layout: {
            'icon-image': 'price-tag-selected',
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [5, 9, 5, 9],
            'icon-allow-overlap': true,
            'text-allow-overlap': true,
            'text-field': tf(['case',
              ['>', ['coalesce', ['get', 'price_amount'], ['get', 'price_min'], 0], 0],
              ['concat', 'TWD ', ['to-string', ['coalesce', ['get', 'price_amount'], ['get', 'price_min']]]],
              '未定價',
            ]),
            'text-size': 12,
            'text-font': ['Noto Sans Regular'],
          },
          paint: { 'text-color': '#ffffff' },
        });

        // ── 選中標籤（品項名稱 | 店名，顯示在 pin 上方）──
        map.addLayer({
          id: 'restaurant-selected-label',
          type: 'symbol',
          source: 'restaurants',
          filter: ['==', ['get', 'id'], '__none__'],
          layout: {
            'text-field': tf(['case',
              ['!=', ['coalesce', ['get', 'price_item_name'], ''], ''],
              ['concat', ['get', 'price_item_name'], '  |  ', ['get', 'name']],
              ['get', 'name'],
            ]),
            'text-size': 11,
            'text-font': ['Noto Sans Regular'],
            'text-offset': [0, -2.2],
            'text-anchor': 'bottom',
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#003580',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        });

        // ── 餐廳名稱（zoom 15+） ──
        map.addLayer({
          id: 'restaurant-labels',
          type: 'symbol',
          source: 'restaurants',
          filter: ['!', ['has', 'point_count']],
          minzoom: 15,
          layout: {
            'text-field': tf(['get', 'name']),
            'text-size': 11,
            'text-font': ['Noto Sans Regular'],
            'text-offset': [0, 1.6],
            'text-anchor': 'top',
            'text-allow-overlap': false,
            'text-optional': true,
          },
          paint: { 'text-color': '#1e293b', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
        });

        // ── Hover Popup ──
        hoverPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: [0, -4],
          maxWidth: '220px',
        });

        const showHoverPopup = (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          if (pinSelectModeRef.current) return;
          map.getCanvas().style.cursor = 'pointer';
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, unknown>;
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          const price = p.price_amount ?? p.price_min;
          const priceHtml = price
            ? `<span style="color:#003580;font-weight:700;font-size:14px">TWD ${price}</span>`
            : `<span style="color:#999;font-size:13px">未定價</span>`;
          const itemHtml = p.price_item_name
            ? `<div style="color:#008009;font-size:12px;margin-top:1px">${esc(p.price_item_name)}</div>`
            : '';
          const ratingHtml = `<div style="color:#888;font-size:11px;margin-top:3px">乞丐指數 ${Number(p.beggar_index ?? 0).toFixed(1)}/5 · ${p.review_count ?? 0} 則評論</div>`;
          hoverPopupRef.current!
            .setLngLat(coords)
            .setHTML(`<div style="padding:10px 14px;font-family:system-ui,sans-serif;background:#fff">
              <div style="font-weight:700;font-size:13px;color:#1a1a1a;margin-bottom:3px">${esc(p.name)}</div>
              ${priceHtml}${itemHtml}${ratingHtml}
            </div>`)
            .addTo(map);
        };

        map.on('mouseenter', 'restaurant-points', showHoverPopup);
        map.on('mouseenter', 'restaurant-labels', showHoverPopup);
        map.on('mouseleave', 'restaurant-points', () => {
          map.getCanvas().style.cursor = '';
          hoverPopupRef.current?.remove();
        });
        map.on('mouseleave', 'restaurant-labels', () => {
          map.getCanvas().style.cursor = '';
          hoverPopupRef.current?.remove();
        });

        // ── 點擊 cluster ──
        map.on('click', 'clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          if (!features[0]) return;
          const clusterId = features[0].properties.cluster_id as number;
          (map.getSource('restaurants') as GeoJSONSource)
            .getClusterExpansionZoom(clusterId)
            .then((zoom) => {
              const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
              map.easeTo({ center: coords, zoom: zoom ?? 15 });
            })
            .catch(() => {});
        });

        // ── 點擊餐廳 ──
        const handleRestaurantClick = (e: MapMouseEvent) => {
          if (pinSelectModeRef.current) return;
          hoverPopupRef.current?.remove();
          const feature = (
            map.queryRenderedFeatures(e.point, { layers: ['restaurant-points'] })[0] ??
            map.queryRenderedFeatures(e.point, { layers: ['restaurant-labels'] })[0]
          );
          if (!feature) return;
          const p = feature.properties as Record<string, unknown>;
          const parseArr = (v: unknown): string[] => {
            if (Array.isArray(v)) return v as string[];
            if (typeof v === 'string') { try { return JSON.parse(v) as string[]; } catch { return []; } }
            return [];
          };
          const marker: MarkerData = {
            id: p.id as string,
            name: p.name as string,
            slug: p.slug as string,
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
            price_min: p.price_min != null ? Number(p.price_min) : null,
            price_max: p.price_max != null ? Number(p.price_max) : null,
            price_item_name: (p.price_item_name as string) || null,
            price_amount: p.price_amount != null ? Number(p.price_amount) : null,
            price_reported_at: (p.price_reported_at as string) || null,
            beggar_index: Number(p.beggar_index ?? 0),
            beggar_perks: parseArr(p.beggar_perks),
            categories: parseArr(p.categories),
            meal_types: parseArr(p.meal_types),
            cuisine_types: parseArr(p.cuisine_types),
            cover_image_key: (p.cover_image_key as string) || null,
            avg_rating: Number(p.avg_rating ?? 0),
            review_count: Number(p.review_count ?? 0),
          };
          onRestaurantClick(marker);
        };
        map.on('click', 'restaurant-points', handleRestaurantClick);
        map.on('click', 'restaurant-labels', handleRestaurantClick);

        // ── 選點模式 ──
        map.on('click', (e: MapMouseEvent) => {
          if (!pinSelectModeRef.current) return;
          onPinSelect?.(e.lngLat.lat, e.lngLat.lng);
        });

        // 游標（cluster）
        map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });

        setIsReady(true);

        // ── 定位（zoom 15 初始），若失敗維持當前位置 ──
        if (!savedPos) {
          navigator.geolocation?.getCurrentPosition(
            (pos) => {
              map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15 });
            },
            () => {
              // 定位失敗：在當前位置觸發初始搜尋
              if (!initialBoundsFiredRef.current) {
                initialBoundsFiredRef.current = true;
                const b = map.getBounds();
                onInitialBounds?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
              }
            },
            { timeout: 5000 },
          );
        } else {
          // 從 sessionStorage 恢復 → 直接觸發初始搜尋
          setTimeout(() => {
            if (!initialBoundsFiredRef.current) {
              initialBoundsFiredRef.current = true;
              const b = map.getBounds();
              onInitialBounds?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
            }
          }, 500);
        }
      });

      // flyTo 完成後觸發初始搜尋（geolocation 成功的情況）
      map.on('moveend', () => {
        if (!initialBoundsFiredRef.current) {
          initialBoundsFiredRef.current = true;
          const b = map.getBounds();
          onInitialBounds?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
        }
      });
    })();

    return () => {
      hoverPopupRef.current?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 更新 markers
  useEffect(() => {
    if (!isReady || !mapRef.current) return;
    const source = mapRef.current.getSource('restaurants') as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: markers.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
        properties: r,
      })),
    });
  }, [markers, isReady]);

  // 游標（選點模式）
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = pinSelectMode ? 'crosshair' : '';
  }, [pinSelectMode]);

  const handleSearchHere = useCallback(() => {
    if (!mapRef.current) return;
    const b = mapRef.current.getBounds();
    onRequestSearch([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    setShowSearchBtn(false);
  }, [onRequestSearch]);

  const handleGeolocate = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15 }),
      () => { /* ignore */ },
      { timeout: 8000 },
    );
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* 搜尋此區域 */}
      {showSearchBtn && !pinSelectMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={handleSearchHere}
            className="bg-white text-sm font-medium px-4 py-2 rounded-full shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            搜尋此區域
          </button>
        </div>
      )}

      {/* 選點模式提示 */}
      {pinSelectMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-[#003580] text-white text-sm font-medium px-4 py-2 rounded-full shadow-md">
            點擊地圖選擇餐廳位置
          </div>
        </div>
      )}

      {/* 右側控制按鈕 */}
      <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-2">
        <button onClick={() => mapRef.current?.zoomIn()}
          className="bg-white rounded-lg w-9 h-9 shadow-md flex items-center justify-center border border-gray-200 text-gray-700 text-lg font-light hover:bg-gray-50 transition-colors"
          aria-label="放大">+</button>
        <button onClick={() => mapRef.current?.zoomOut()}
          className="bg-white rounded-lg w-9 h-9 shadow-md flex items-center justify-center border border-gray-200 text-gray-700 text-lg font-light hover:bg-gray-50 transition-colors"
          aria-label="縮小">−</button>
        <button onClick={handleGeolocate}
          className="bg-white rounded-lg w-9 h-9 shadow-md flex items-center justify-center border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label="定位">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
