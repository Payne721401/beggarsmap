import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '隱私權政策 | 乞丐地圖',
  description: '乞丐地圖的隱私權政策，說明我們如何收集、使用與保護您的個人資料',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">隱私權政策</h1>
      <p className="text-sm text-gray-500 mb-8">最後更新：2026 年 4 月</p>

      <section className="space-y-6 text-sm text-gray-700 leading-7">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">1. 我們收集的資料</h2>
          <p>
            <strong>使用者提交的資料：</strong>當您新增餐廳或提交評論時，我們會收集您填寫的資訊（餐廳名稱、地址、評分、評論內文、上傳的照片）。
          </p>
          <p className="mt-2">
            <strong>自動收集的資料：</strong>我們會收集您的 IP 位址，但僅以不可逆的雜湊（SHA-256）方式儲存，無法從雜湊值還原原始 IP。此資料用於防止濫用行為。
          </p>
          <p className="mt-2">
            <strong>帳號資料（Phase 2）：</strong>若您選擇建立帳號，我們會收集您的電子郵件（選填）、顯示名稱、以及第三方登入資訊（Google / LINE）。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">2. 資料的使用方式</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>顯示餐廳資訊與評論給其他使用者</li>
            <li>防止垃圾內容與濫用行為</li>
            <li>改善服務品質與使用體驗</li>
            <li>網站流量分析（使用 Cloudflare Web Analytics，不使用 Cookie）</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">3. 資料的分享</h2>
          <p>
            我們不會出售、出租或以任何方式販賣您的個人資料給第三方。以下情況除外：
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>法律要求（如法院命令）</li>
            <li>為保護本平台或其他使用者的安全</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">4. Cookie 與追蹤技術</h2>
          <p>
            本網站使用 Cloudflare Web Analytics 進行流量統計，此工具<strong>不使用 Cookie</strong>，也不追蹤個人行為。
          </p>
          <p className="mt-2">
            若您使用 Google AdSense（廣告），Google 可能使用 Cookie 提供個人化廣告。您可透過 Google 廣告設定頁面選擇退出個人化廣告。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">5. 您的權利</h2>
          <p>依據中華民國個人資料保護法，您有以下權利：</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>查閱權：</strong>您可要求查閱我們持有的您的個人資料</li>
            <li><strong>更正權：</strong>您可要求更正不正確的個人資料</li>
            <li><strong>刪除權：</strong>您可要求刪除您的帳號及相關個人資料（需登入後操作）</li>
            <li><strong>可攜權：</strong>您可要求匯出您的個人資料</li>
          </ul>
          <p className="mt-2">
            如需行使上述權利，請透過以下聯絡方式與我們聯繫。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">6. 資料保留</h2>
          <p>
            餐廳資訊與評論將持續保存，以維護服務完整性。IP 雜湊值最長保留 90 天後清空。
            帳號刪除後，個人識別資料（電子郵件、顯示名稱）將立即清空，但匿名的評論內容可能仍保留。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">7. 聯絡我們</h2>
          <p>
            如有任何隱私相關問題或行使個資權利，請來信至：
            <a href="mailto:privacy@beggarsmap.tw" className="text-orange-600 hover:underline ml-1">
              privacy@beggarsmap.tw
            </a>
          </p>
        </div>
      </section>

      <div className="mt-10 pt-6 border-t">
        <a href="/" className="text-sm text-orange-600 hover:text-orange-700">← 回到地圖</a>
      </div>
    </main>
  );
}
