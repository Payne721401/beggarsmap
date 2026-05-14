import type { StyleSpecification } from 'maplibre-gl';
import { layers, namedFlavor } from '@protomaps/basemaps';

// 台灣地理範圍（含離島：金門/馬祖/澎湖/蘭嶼/綠島）
export const TAIWAN_BOUNDS: [[number, number], [number, number]] = [
  [117.9, 21.5],  // SW（金門最西 ~118.2E，多留緩衝）
  [124.0, 26.5],  // NE（馬祖最北 ~26.4N）
];

export const TAIWAN_CENTER: [number, number] = [121.0, 23.8];
export const TAIPEI_CENTER: [number, number] = [121.5645, 25.0375]; // 台北市中心（定位失敗預設）
export const TAIWAN_INITIAL_ZOOM = 7;
export const MAP_PIN_MIN_ZOOM = 15; // 新增餐廳時強制最小縮放

// PMTiles URL
// 優先用 NEXT_PUBLIC_TILES_URL（本機開發指向 CDN 或 localhost）
// 生產環境用 NEXT_PUBLIC_R2_HOST/tiles/taiwan.pmtiles
export function getTilesUrl(): string {
  if (process.env.NEXT_PUBLIC_TILES_URL) {
    return process.env.NEXT_PUBLIC_TILES_URL;
  }
  const imgHost = process.env.NEXT_PUBLIC_IMG_HOST ?? '';
  const r2Host = process.env.NEXT_PUBLIC_R2_HOST ?? imgHost;
  return `${r2Host}/tiles/taiwan.pmtiles`;
}

// MapLibre 地圖樣式（使用 Protomaps 官方 basemap 套件）
export function getMapStyle(tilesUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${tilesUrl}`,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', namedFlavor('light'), { lang: 'zh-Hant' }),
  } as StyleSpecification;
}

// 乞丐指數顏色分級（0-5 星）
export function getBeggingColor(index: number): string {
  if (index >= 4.5) return '#22c55e';  // 綠：超值
  if (index >= 3.5) return '#84cc16';  // 黃綠
  if (index >= 2.5) return '#f59e0b';  // 橙：普通
  if (index >= 1.5) return '#f97316';  // 橙紅
  return '#ef4444';                     // 紅：不推
}
