const CHAIN_KEYWORDS = [
  // 速食
  '麥當勞', '肯德基', 'KFC', '漢堡王', '摩斯漢堡', '溫蒂漢堡',
  // 咖啡連鎖
  '星巴克', 'Starbucks', '路易莎', '路易沙', '麥咖啡',
  '85度C', '85°C', 'CAMA',
  // 飲料連鎖
  '50嵐', '一芳', '貢茶', '清心福全', '大苑子', '鮮茶道',
  '迷客夏', '麻古茶坊', '珍煮丹', 'CoCo', '天仁茗茶',
  // 便利商店
  '7-ELEVEN', '7-11', '全家', '萊爾富', 'OK便利',
  // 其他連鎖
  '拿坡里', '必勝客', 'Pizza Hut', '達美樂', '橘焱胡同',
  '爭鮮', '壽司郎', '迴轉壽司', '鼎泰豐', '海底撈',
  '王品', '西堤', '陶板屋', '夏慕尼',
];

export function isChainRestaurant(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}
