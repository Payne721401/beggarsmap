/**
 * Parse a Google Maps URL on the client.
 *
 * Long URLs (google.com/maps/place/...) → parsed locally, instant.
 * Short URLs (maps.app.goo.gl/...) → defers to /api/resolve-gmaps server route
 * because the redirect can't be followed cross-origin from the browser.
 */

export type ParsedGmapsUrl = {
  url: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  googleShortId?: string;
};

const SHORT_HOSTS = ['maps.app.goo.gl', 'goo.gl'];

function parseLong(url: string): ParsedGmapsUrl {
  const result: ParsedGmapsUrl = { url };

  // 從 @lat,lng,zoom
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      result.latitude = lat;
      result.longitude = lng;
    }
  }

  // 從 !3d / !4d（更精確）
  const dMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dMatch) {
    result.latitude = parseFloat(dMatch[1]);
    result.longitude = parseFloat(dMatch[2]);
  }

  // 店名
  const placeNameMatch = url.match(/\/maps\/place\/([^/@]+)/);
  if (placeNameMatch) {
    try {
      result.name = decodeURIComponent(placeNameMatch[1]).replace(/\+/g, ' ');
    } catch { /* ignore */ }
  }

  // /g/xxx
  const shortIdMatch = url.match(/\/g\/([a-zA-Z0-9_]+)/);
  if (shortIdMatch) {
    result.googleShortId = `/g/${shortIdMatch[1]}`;
  }

  return result;
}

/**
 * 解析 Google Maps URL（長/短皆可）。
 * 至少要拿到 lat/lng 才算有用。
 */
export async function parseGmapsUrl(rawUrl: string): Promise<ParsedGmapsUrl> {
  const trimmed = rawUrl.trim();

  // 純座標格式 "25.04,121.5" 或 "@25.04,121.5"
  const coordMatch = trimmed.match(/^@?(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return {
      url: trimmed,
      latitude: parseFloat(coordMatch[1]),
      longitude: parseFloat(coordMatch[2]),
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('連結格式錯誤');
  }

  // 短網址 → 走 API route 解析
  if (SHORT_HOSTS.includes(parsed.hostname)) {
    const res = await fetch(`/api/resolve-gmaps?url=${encodeURIComponent(trimmed)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? '短網址解析失敗');
    }
    return (await res.json()) as ParsedGmapsUrl;
  }

  // 長網址 → 本地 parse
  if (parsed.hostname.includes('google.com')) {
    return parseLong(trimmed);
  }

  throw new Error('不支援的網址（請使用 Google Maps 連結）');
}
