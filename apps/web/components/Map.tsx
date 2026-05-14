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

/** 畫對話框氣泡 marker（圓角矩形 + 底部尖角指向座標，Booking.com 風格），回傳 ImageData */
function makeTagImage(color: string, pixelRatio: number): ImageData {
  const W = 40 * pixelRatio;
  const bodyH = 18 * pixelRatio;
  const tailH = 6 * pixelRatio;
  const tailW = 8 * pixelRatio;
  const r = 4 * pixelRatio;
  const totalH = bodyH + tailH;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d')!;

  // 組合路徑：圓角矩形 body + 底部尖角 tail
  const drawBubblePath = () => {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(W - r, 0);
    ctx.quadraticCurveTo(W, 0, W, r);
    ctx.lineTo(W, bodyH - r);
    ctx.quadraticCurveTo(W, bodyH, W - r, bodyH);
    // 右側到尖角
    ctx.lineTo(W / 2 + tailW / 2, bodyH);
    ctx.lineTo(W / 2, totalH);                 // 尖角頂點 = 整張圖最底
    ctx.lineTo(W / 2 - tailW / 2, bodyH);
    // 回到左側
    ctx.lineTo(r, bodyH);
    ctx.quadraticCurveTo(0, bodyH, 0, bodyH - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
  };

  // 主體（含 canvas 內建 drop shadow）
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 3 * pixelRatio;
  ctx.shadowOffsetY = 1 * pixelRatio;
  ctx.fillStyle = color;
  drawBubblePath();
  ctx.fill();

  // 白色描邊（取消陰影避免邊也有陰影）
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.25 * pixelRatio;
  drawBubblePath();
  ctx.stroke();

  return ctx.getImageData(0, 0, W, totalH);
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
    const showSelectedFilter = (selectedId
      ? ['==', ['get', 'id'], selectedId]
      : ['==', ['get', 'id'], '__none__']) as Parameters<typeof map.setFilter>[1];
    if (map.getLayer('restaurant-points-selected')) {
      map.setFilter('restaurant-points-selected', showSelectedFilter);
    }
    if (map.getLayer('restaurant-selected-label')) {
      map.setFilter('restaurant-selected-label', showSelectedFilter);
    }
    // 普通 label：選中時排除該店，避免跟「品項 | 店名」label 文字重疊
    if (map.getLayer('restaurant-labels')) {
      const normalLabelFilter = (selectedId
        ? ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'id'], selectedId]]
        : ['!', ['has', 'point_count']]) as Parameters<typeof map.setFilter>[1];
      map.setFilter('restaurant-labels', normalLabelFilter);
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

        // ── 圖示：正常 (深藍) + 選中 (亮藍)，含底部尖角 ──
        const tagNormal = makeTagImage(BRAND, pr);
        const tagSelected = makeTagImage(BRAND_SELECTED, pr);
        // 9-patch stretch：只允許 body 區域拉伸，尖角保持原始大小
        const W = 40 * pr, bodyH = 18 * pr, sx = 6 * pr, sy = 4 * pr;
        const stretchOpts = {
          stretchX: [[sx, W - sx] as [number, number]],
          stretchY: [[sy, bodyH - sy] as [number, number]],
          content: [sx, sy, W - sx, bodyH - sy] as [number, number, number, number],
          pixelRatio: pr,
        };

        map.addImage('price-tag', tagNormal, stretchOpts);
        map.addImage('price-tag-selected', tagSelected, stretchOpts);

        // ── GeoJSON Source ──
        map.addSource('restaurants', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 17,    // 高縮放層級也保留聚合（避免重疊）
          clusterRadius: 60,     // 60px 內視為重疊→自動合併
          clusterProperties: {
            min_price: ['min', ['coalesce', ['get', 'price_amount'], ['get', 'price_min'], 9999]],
          },
        });

        // ── Cluster：與一般 marker 同形狀（圓角矩形），顯示「最低價+」 ──
        map.addLayer({
          id: 'clusters',
          type: 'symbol',
          source: 'restaurants',
          filter: ['has', 'point_count'],
          layout: {
            'icon-image': 'price-tag',
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [1, 8, 1, 8],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'text-allow-overlap': true,
            'text-field': ['case',
              ['<', ['get', 'min_price'], 9000],
              ['concat', '$', ['to-string', ['get', 'min_price']], '+'],
              ['concat', ['to-string', ['get', 'point_count']], ' 家'],
            ],
            'text-size': 13,
            'text-font': ['Noto Sans Bold'],
            'text-letter-spacing': 0.02,
          },
          paint: { 'text-color': '#ffffff' },
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
            'icon-text-fit-padding': [1, 8, 1, 8],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'text-allow-overlap': true,
            'text-field': tf(['case',
              ['>', ['coalesce', ['get', 'price_amount'], ['get', 'price_min'], 0], 0],
              ['concat', '$', ['to-string', ['coalesce', ['get', 'price_amount'], ['get', 'price_min']]]],
              '未定價',
            ]),
            'text-size': 13,
            'text-font': ['Noto Sans Bold'],
            'text-letter-spacing': 0.02,
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
            'icon-text-fit-padding': [1, 8, 1, 8],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'text-allow-overlap': true,
            'text-field': tf(['case',
              ['>', ['coalesce', ['get', 'price_amount'], ['get', 'price_min'], 0], 0],
              ['concat', '$', ['to-string', ['coalesce', ['get', 'price_amount'], ['get', 'price_min']]]],
              '未定價',
            ]),
            'text-size': 13,
            'text-font': ['Noto Sans Bold'],
            'text-letter-spacing': 0.02,
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

        // ── 餐廳名稱（zoom 15+，放在 marker 上方） ──
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
            'text-offset': [0, -2.8],     // 向上推：marker 約 24px，再多留間距
            'text-anchor': 'bottom',      // 文字底部對齊到 feature point
            'text-allow-overlap': false,
            'text-optional': true,
          },
          paint: { 'text-color': '#1e293b', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
        });

        // ── Hover Popup ──
        // offset = -30：氣泡底部尖角在座標上，整個氣泡（含尖角）高度約 24px，再加 6px 間距
        hoverPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: [0, -30],
          maxWidth: '340px',
        });

        const showHoverPopup = (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          if (pinSelectModeRef.current) return;
          map.getCanvas().style.cursor = 'pointer';
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, unknown>;
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          const price = p.price_amount ?? p.price_min;

          // 主視覺：價格（大、黑色）+ 品項（中、綠色）
          const priceHtml = price
            ? `<span style="color:#1a1a1a;font-weight:800;font-size:28px;line-height:1;letter-spacing:-0.01em">$${price}</span>`
            : `<span style="color:#999;font-weight:600;font-size:18px">未定價</span>`;
          const itemHtml = p.price_item_name
            ? `<div style="color:#008009;font-weight:600;font-size:16px;margin-top:8px;line-height:1.3">${esc(p.price_item_name)}</div>`
            : '';
          // 店名 + 乞丐指數：稍微強調（次主要資訊）
          const nameHtml = `<div style="color:#1a1a1a;font-size:14px;margin-top:12px;font-weight:700">${esc(p.name)}</div>`;
          const ratingHtml = `<div style="color:#555;font-size:12px;margin-top:3px;font-weight:500">乞丐指數 <span style="color:#003580;font-weight:700">${Number(p.beggar_index ?? 0).toFixed(1)}</span>/5 · ${p.review_count ?? 0} 則評論</div>`;

          hoverPopupRef.current!
            .setLngLat(coords)
            .setHTML(`<div style="padding:16px 20px;font-family:inherit;background:#fff;min-width:220px">
              ${priceHtml}${itemHtml}${nameHtml}${ratingHtml}
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
            created_at: (p.created_at as string) || new Date().toISOString(),
            report_count: Number(p.report_count ?? 0),
            cp_high_votes: Number(p.cp_high_votes ?? 0),
            cp_low_votes: Number(p.cp_low_votes ?? 0),
            price_correct_votes: Number(p.price_correct_votes ?? 0),
            price_wrong_votes: Number(p.price_wrong_votes ?? 0),
            favorite_count: Number(p.favorite_count ?? 0),
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
