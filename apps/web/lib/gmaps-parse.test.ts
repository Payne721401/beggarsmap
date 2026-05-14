import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseGmapsUrl } from './gmaps-parse';

// gmaps-parse.ts 在短網址路徑會呼叫 fetch（會打到 /api/resolve-gmaps）。
// 測試中用 vi.stubGlobal('fetch', ...) mock 掉。

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────
// 純座標格式
// ─────────────────────────────────────────────────────────────────
describe('純座標格式', () => {
  it('支援 "lat,lng" 格式', async () => {
    const result = await parseGmapsUrl('25.0478,121.5170');
    expect(result.latitude).toBe(25.0478);
    expect(result.longitude).toBe(121.5170);
  });

  it('支援 "@lat,lng" 格式', async () => {
    const result = await parseGmapsUrl('@25.0478,121.5170');
    expect(result.latitude).toBe(25.0478);
    expect(result.longitude).toBe(121.5170);
  });

  it('支援負數座標', async () => {
    const result = await parseGmapsUrl('-25.04,-121.5');
    expect(result.latitude).toBe(-25.04);
    expect(result.longitude).toBe(-121.5);
  });

  it('容忍逗號後空白', async () => {
    const result = await parseGmapsUrl('25.04, 121.5');
    expect(result.latitude).toBe(25.04);
    expect(result.longitude).toBe(121.5);
  });

  it('trim 前後空白', async () => {
    const result = await parseGmapsUrl('  25.04,121.5  ');
    expect(result.latitude).toBe(25.04);
    expect(result.longitude).toBe(121.5);
  });
});

// ─────────────────────────────────────────────────────────────────
// 長網址（google.com/maps/place/...）
// ─────────────────────────────────────────────────────────────────
describe('長網址解析', () => {
  it('從 @lat,lng 抓座標', async () => {
    const url = 'https://www.google.com/maps/place/some-place/@25.0478,121.5170,17z/data=...';
    const result = await parseGmapsUrl(url);
    expect(result.latitude).toBe(25.0478);
    expect(result.longitude).toBe(121.5170);
  });

  it('!3d!4d 比 @ 優先（更精確）', async () => {
    // @ 與 !3d!4d 不同時，應該以 !3d!4d 為準
    const url = 'https://www.google.com/maps/place/X/@25.05,121.51,17z/data=!4m6!3m5!1s0x:0x!8m2!3d25.1234!4d121.5678';
    const result = await parseGmapsUrl(url);
    expect(result.latitude).toBe(25.1234);
    expect(result.longitude).toBe(121.5678);
  });

  it('!3d!4d 即使沒有 @ 也能抓', async () => {
    const url = 'https://www.google.com/maps/place/X/data=!3m1!4b1!8m2!3d25.04!4d121.5';
    const result = await parseGmapsUrl(url);
    expect(result.latitude).toBe(25.04);
    expect(result.longitude).toBe(121.5);
  });

  it('解析店名（URL 解碼 + 加號轉空白）', async () => {
    const url = 'https://www.google.com/maps/place/%E9%98%BF%E8%BC%9D%E7%89%9B%E8%82%89%E9%BA%B5/@25.04,121.5,17z';
    const result = await parseGmapsUrl(url);
    expect(result.name).toBe('阿輝牛肉麵');
  });

  it('店名含 + 號會轉為空白', async () => {
    const url = 'https://www.google.com/maps/place/My+Place/@25.04,121.5,17z';
    const result = await parseGmapsUrl(url);
    expect(result.name).toBe('My Place');
  });

  it('解碼失敗時靜默忽略 name', async () => {
    // 故意給個壞 URL encoding（%E9 後接非法 byte）
    const url = 'https://www.google.com/maps/place/%E9%XX/@25.04,121.5,17z';
    const result = await parseGmapsUrl(url);
    expect(result.name).toBeUndefined();
    expect(result.latitude).toBe(25.04);   // 但座標仍要正確
  });

  it('解析 /g/xxx 短 ID', async () => {
    const url = 'https://www.google.com/maps/place/X/@25.04,121.5,17z/data=!4m...!1s/g/1tg76rm7';
    const result = await parseGmapsUrl(url);
    expect(result.googleShortId).toBe('/g/1tg76rm7');
  });

  it('沒有座標也不會拋錯（只是回傳 url）', async () => {
    const url = 'https://www.google.com/maps';
    const result = await parseGmapsUrl(url);
    expect(result.url).toBe(url);
    expect(result.latitude).toBeUndefined();
    expect(result.longitude).toBeUndefined();
  });

  it('支援 maps.google.com host', async () => {
    const url = 'https://maps.google.com/maps/place/X/@25.04,121.5,17z';
    const result = await parseGmapsUrl(url);
    expect(result.latitude).toBe(25.04);
  });
});

// ─────────────────────────────────────────────────────────────────
// 短網址（maps.app.goo.gl）→ 走 /api/resolve-gmaps
// ─────────────────────────────────────────────────────────────────
describe('短網址解析', () => {
  it('呼叫 /api/resolve-gmaps 並回傳解析結果', async () => {
    const mockResponse = {
      url: 'https://www.google.com/maps/place/X/@25.04,121.5,17z',
      latitude: 25.04, longitude: 121.5, name: 'X',
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => mockResponse,
    })));

    const result = await parseGmapsUrl('https://maps.app.goo.gl/abc123');
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      '/api/resolve-gmaps?url=https%3A%2F%2Fmaps.app.goo.gl%2Fabc123',
    );
  });

  it('支援 goo.gl 主機', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: 'final', latitude: 25, longitude: 121 }),
    })));
    const result = await parseGmapsUrl('https://goo.gl/maps/xyz');
    expect(result.latitude).toBe(25);
  });

  it('API 回 non-ok 且有 error 訊息 → 拋出該訊息', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'Upstream returned 502' }),
    })));
    await expect(parseGmapsUrl('https://maps.app.goo.gl/abc'))
      .rejects.toThrow('Upstream returned 502');
  });

  it('API 回 non-ok 且 body 不是 JSON → 拋出預設訊息', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => { throw new Error('not json'); },
    })));
    await expect(parseGmapsUrl('https://maps.app.goo.gl/abc'))
      .rejects.toThrow('短網址解析失敗');
  });
});

// ─────────────────────────────────────────────────────────────────
// 例外情況
// ─────────────────────────────────────────────────────────────────
describe('例外情況', () => {
  it('連結格式錯誤拋 "連結格式錯誤"', async () => {
    await expect(parseGmapsUrl('not-a-url-at-all'))
      .rejects.toThrow('連結格式錯誤');
  });

  it('不支援的 host 拋出錯誤', async () => {
    await expect(parseGmapsUrl('https://yahoo.com/maps?q=foo'))
      .rejects.toThrow('不支援的網址');
  });
});
