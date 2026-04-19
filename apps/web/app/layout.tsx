import type { Metadata } from "next";
import { Noto_Sans_TC } from 'next/font/google';
import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-tc',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "乞丐地圖 — 台灣最便宜餐廳",
  description: "用地圖找台灣便宜好吃的餐廳，依照乞丐指數（CP 值）評分，讓你吃得省又吃得好",
  keywords: ["台灣", "便宜餐廳", "乞丐地圖", "CP值", "平價美食"],
  openGraph: {
    title: "乞丐地圖 — 台灣最便宜餐廳",
    description: "用地圖找台灣便宜好吃的餐廳",
    locale: "zh_TW",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#D4380D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`h-full ${notoSansTC.variable}`}>
      <head>
        {/* Cloudflare Web Analytics — 填入實際 token */}
        {process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN}"}`}
          />
        )}
      </head>
      <body className={`h-full antialiased font-sans ${notoSansTC.className}`}>{children}</body>
    </html>
  );
}
