const IMG_HOST = process.env.NEXT_PUBLIC_IMG_HOST ?? '';

export function imgUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  // mock 模式下 key 以 "picsum/" 開頭 → 直接轉為 picsum.photos URL
  if (key.startsWith('picsum/')) {
    const parts = key.replace('picsum/', '');
    return `https://picsum.photos/seed/${parts}`;
  }
  return `${IMG_HOST}/${key}`;
}
