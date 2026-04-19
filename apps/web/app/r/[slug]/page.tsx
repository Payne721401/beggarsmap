import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { imgUrl } from '@/lib/image';

export const revalidate = 3600; // ISR：1 小時更新一次
export const dynamicParams = true; // 未預先 SSG 的 slug，首次請求動態生成後快取

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  price_min: number | null;
  price_max: number | null;
  beggar_index: number;
  categories: string[];
  cover_image_key: string | null;
  address: string | null;
  avg_rating: number;
  review_count: number;
  reviews: Array<{
    id: string;
    rating: number;
    price_paid: number | null;
    comment: string | null;
    created_at: string;
  }>;
};

async function getRestaurant(slug: string): Promise<Restaurant | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  try {
    const res = await fetch(`${apiUrl}/api/restaurants/by-slug/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// 預先 SSG review_count > 10 的熱門餐廳
export async function generateStaticParams() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  try {
    const res = await fetch(`${apiUrl}/api/restaurants/search?sort=rating&cursor=0`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const { data } = await res.json();
    return (data as Array<{ slug: string; review_count: number }>)
      .filter(r => r.review_count > 10)
      .slice(0, 1000)
      .map(r => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurant(slug);
  if (!restaurant) return { title: '餐廳不存在 | 乞丐地圖' };

  const cover = imgUrl(restaurant.cover_image_key);
  const priceStr = restaurant.price_min ? `最低 $${restaurant.price_min} TWD` : '';
  const description = `${priceStr ? priceStr + ' | ' : ''}乞丐指數 ${restaurant.beggar_index}/5 | ${restaurant.review_count} 則評論`;

  return {
    title: `${restaurant.name} | 乞丐地圖`,
    description,
    openGraph: {
      title: restaurant.name,
      description,
      images: cover ? [{ url: cover, width: 1200, height: 630 }] : [],
      locale: 'zh_TW',
    },
  };
}

export default async function RestaurantPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const restaurant = await getRestaurant(slug);
  if (!restaurant) notFound();

  const cover = imgUrl(restaurant.cover_image_key);

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    address: restaurant.address ? {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address,
      addressCountry: 'TW',
    } : undefined,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    },
    image: cover ?? undefined,
    aggregateRating: restaurant.review_count > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: restaurant.avg_rating,
      reviewCount: restaurant.review_count,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    priceRange: restaurant.price_min ? `$${restaurant.price_min}${restaurant.price_max ? `~$${restaurant.price_max}` : ''}` : undefined,
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 封面圖 */}
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt={restaurant.name}
          className="w-full h-56 object-cover rounded-2xl mb-5"
        />
      )}

      {/* 標題 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{restaurant.name}</h1>

      {/* 評分 + 乞丐指數 */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-amber-400 text-lg">
          {'★'.repeat(Math.round(restaurant.avg_rating))}
          {'☆'.repeat(5 - Math.round(restaurant.avg_rating))}
        </span>
        <span className="text-gray-500 text-sm">{restaurant.avg_rating.toFixed(1)} ({restaurant.review_count} 則評論)</span>
        <span className="text-xs font-medium bg-blue-50 text-[#003580] px-2 py-0.5 rounded-full">
          乞丐指數 {restaurant.beggar_index}/5
        </span>
      </div>

      {/* 價格 */}
      {restaurant.price_min && (
        <p className="text-green-700 font-semibold text-lg mb-3">
          ${restaurant.price_min}
          {restaurant.price_max && restaurant.price_max !== restaurant.price_min
            ? ` ~ $${restaurant.price_max}` : ''} TWD
        </p>
      )}

      {/* 分類 */}
      {restaurant.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {restaurant.categories.map(cat => (
            <span key={cat} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* 地址 */}
      {restaurant.address && (
        <p className="text-sm text-gray-500 mb-5 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {restaurant.address}
        </p>
      )}

      {/* 地圖連結 */}
      <a
        href={`https://beggarsmap.tw/?focus=${restaurant.slug}`}
        className="inline-block bg-[#003580] hover:bg-[#002860] text-white px-5 py-2.5 rounded-xl text-sm font-medium mb-8 transition-colors"
      >
        在地圖上查看
      </a>

      {/* 評論 */}
      {restaurant.reviews.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">評論</h2>
          <div className="space-y-4">
            {restaurant.reviews.map(review => (
              <div key={review.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-amber-400">
                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                  </span>
                  {review.price_paid && (
                    <span className="text-xs text-green-700">實際消費 ${review.price_paid}</span>
                  )}
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(review.created_at).toLocaleDateString('zh-TW')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
