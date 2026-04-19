import type { MetadataRoute } from 'next';

export const revalidate = 86400; // 每天更新

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://beggarsmap.tw';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    // 取得 review_count > 0 的熱門餐廳
    const res = await fetch(`${apiUrl}/api/restaurants/search?sort=rating&cursor=0`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return staticRoutes;

    const { data } = await res.json() as { data: Array<{ slug: string }> };
    const restaurantRoutes: MetadataRoute.Sitemap = data.map((r) => ({
      url: `${baseUrl}/r/${r.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...restaurantRoutes];
  } catch {
    return staticRoutes;
  }
}
