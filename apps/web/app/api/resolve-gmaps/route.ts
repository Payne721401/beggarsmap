/**
 * Resolve Google Maps short URLs (maps.app.goo.gl, goo.gl/maps) to their final
 * long form so we can parse out lat/lng / place names client-side.
 *
 * Cannot be done from the browser due to CORS — Google does not allow
 * cross-origin fetches to maps.app.goo.gl. This route runs server-side
 * (Node runtime on Vercel / Cloudflare Pages) and is the only required hop.
 *
 * Returns:
 *   { url, latitude?, longitude?, name?, address?, googleShortId? }
 *
 * Failure modes:
 *   - Invalid input            → 400 { error }
 *   - Upstream returned non-2xx → 502 { error }
 *   - Final URL not parseable  → 200 { url } with no extracted fields
 */

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'www.google.com',
  'google.com',
  'maps.google.com',
]);

type ParsedPlace = {
  url: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  googleShortId?: string;
};

function parseGoogleMapsUrl(url: string): Omit<ParsedPlace, 'url'> {
  const result: Omit<ParsedPlace, 'url'> = {};

  // 1) 從 /@lat,lng,zoom 抓座標
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      result.latitude = lat;
      result.longitude = lng;
    }
  }

  // 2) 從 !3d / !4d 抓座標（更精確的目標點，覆寫上面的 @）
  const dMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dMatch) {
    result.latitude = parseFloat(dMatch[1]);
    result.longitude = parseFloat(dMatch[2]);
  }

  // 3) /maps/place/{name}/ 抓店名
  const placeNameMatch = url.match(/\/maps\/place\/([^/@]+)/);
  if (placeNameMatch) {
    try {
      result.name = decodeURIComponent(placeNameMatch[1]).replace(/\+/g, ' ');
    } catch { /* ignore */ }
  }

  // 4) /g/xxx → google_short_id
  const shortIdMatch = url.match(/\/g\/([a-zA-Z0-9_]+)/);
  if (shortIdMatch) {
    result.googleShortId = `/g/${shortIdMatch[1]}`;
  }

  return result;
}

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get('url');
  if (!input) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: 'Unsupported host. Allowed: ' + Array.from(ALLOWED_HOSTS).join(', ') }, { status: 400 });
  }

  // 長網址（已是 www.google.com/maps/place）→ 直接 parse，不用打網
  if (parsed.hostname.includes('google.com')) {
    const data = parseGoogleMapsUrl(input);
    return NextResponse.json({ url: input, ...data } satisfies ParsedPlace);
  }

  // 短網址 → 跟 redirect 取最終 URL
  try {
    // Node 18+ fetch 預設會自動 follow redirect。我們手動 follow 為了取每一跳的 URL，
    // 但這裡用自動 follow 也行 — 拿 response.url 就是最終 URL。
    const res = await fetch(input, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // 模擬一般瀏覽器，避免 Google 回 bot 頁
        'User-Agent': 'Mozilla/5.0 (compatible; BeggarsMap/1.0; +https://beggarsmap.tw)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok && res.status !== 302 && res.status !== 301) {
      return NextResponse.json({ error: `Upstream returned ${res.status}` }, { status: 502 });
    }

    const finalUrl = res.url;
    const data = parseGoogleMapsUrl(finalUrl);

    return NextResponse.json({ url: finalUrl, ...data } satisfies ParsedPlace);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to resolve: ${msg}` }, { status: 502 });
  }
}
