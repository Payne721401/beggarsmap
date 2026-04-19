import { describe, it, expect } from 'vitest';
import { isChainRestaurant } from './chains';

describe('isChainRestaurant', () => {
  // ── 已知連鎖 → true ──────────────────────────────────────────────
  it.each([
    ['麥當勞'],
    ['肯德基'],
    ['KFC'],
    ['漢堡王'],
    ['摩斯漢堡'],
    ['溫蒂漢堡'],
    ['星巴克'],
    ['Starbucks'],
    ['路易莎'],
    ['路易沙'],
    ['麥咖啡'],
    ['85度C'],
    ['85°C'],
    ['CAMA'],
    ['50嵐'],
    ['一芳'],
    ['貢茶'],
    ['清心福全'],
    ['大苑子'],
    ['鮮茶道'],
    ['迷客夏'],
    ['麻古茶坊'],
    ['珍煮丹'],
    ['CoCo'],
    ['天仁茗茶'],
    ['7-ELEVEN'],
    ['7-11'],
    ['全家'],
    ['萊爾富'],
    ['OK便利'],
    ['拿坡里'],
    ['必勝客'],
    ['Pizza Hut'],
    ['達美樂'],
    ['橘焱胡同'],
    ['爭鮮'],
    ['壽司郎'],
    ['迴轉壽司'],
    ['鼎泰豐'],
    ['海底撈'],
    ['王品'],
    ['西堤'],
    ['陶板屋'],
    ['夏慕尼'],
  ])('"%s" 是連鎖餐飲', (name) => {
    expect(isChainRestaurant(name)).toBe(true);
  });

  // ── 獨立店家 → false ─────────────────────────────────────────────
  it.each([
    ['阿輝牛肉麵'],
    ['阿財豬腳飯'],
    ['老張排骨便當'],
    ['美珍香雞排'],
    ['小李子快炒'],
    ['海鮮粥'],
    ['素食自助餐'],
  ])('"%s" 不是連鎖餐飲', (name) => {
    expect(isChainRestaurant(name)).toBe(false);
  });

  // ── 大小寫不敏感 ─────────────────────────────────────────────────
  it('大小寫不影響結果（KFC → kfc）', () => {
    expect(isChainRestaurant('kfc')).toBe(true);
  });

  it('大小寫不影響結果（starbucks）', () => {
    expect(isChainRestaurant('starbucks')).toBe(true);
  });

  it('大小寫不影響結果（STARBUCKS）', () => {
    expect(isChainRestaurant('STARBUCKS')).toBe(true);
  });

  it('大小寫不影響結果（pizza hut）', () => {
    expect(isChainRestaurant('pizza hut')).toBe(true);
  });

  // ── 部分比對：名稱內含連鎖關鍵字 ────────────────────────────────
  it('名稱包含連鎖關鍵字仍判定為連鎖（台北星巴克正對面便當）', () => {
    expect(isChainRestaurant('台北星巴克正對面便當')).toBe(true);
  });

  it('名稱包含連鎖關鍵字仍判定為連鎖（麥當勞旁小吃）', () => {
    expect(isChainRestaurant('麥當勞旁小吃')).toBe(true);
  });

  // ── 邊界情況 ─────────────────────────────────────────────────────
  it('空字串 → false', () => {
    expect(isChainRestaurant('')).toBe(false);
  });

  it('單一字元 → false', () => {
    expect(isChainRestaurant('麵')).toBe(false);
  });

  it('特殊符號字串 → false', () => {
    expect(isChainRestaurant('!!!')).toBe(false);
  });

  it('空白字串 → false', () => {
    expect(isChainRestaurant('   ')).toBe(false);
  });
});
