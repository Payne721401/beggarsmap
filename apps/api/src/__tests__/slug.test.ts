import { describe, it, expect } from 'vitest';
import { toBaseSlug } from '../lib/slug';

describe('toBaseSlug', () => {
  it('converts Chinese to pinyin slug', () => {
    expect(toBaseSlug('牛肉麵大王')).toBe('niu-rou-mian-da-wang');
  });

  it('converts mixed Chinese-English', () => {
    const result = toBaseSlug('ABC早餐店');
    expect(result).toContain('abc');
    expect(result).toContain('zao-can-dian');
  });

  it('handles pure English', () => {
    expect(toBaseSlug('McDonald')).toBe('mcdonald');
  });

  it('replaces multiple dashes with single', () => {
    const result = toBaseSlug('牛  肉麵');
    expect(result).not.toContain('--');
  });

  it('strips leading and trailing dashes', () => {
    const result = toBaseSlug(' 牛肉麵 ');
    expect(result).not.toMatch(/^-|-$/);
  });

  it('truncates to 60 characters', () => {
    const longName = '牛'.repeat(40); // 很長的名字
    const result = toBaseSlug(longName);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('returns fallback for empty/non-Chinese input', () => {
    expect(toBaseSlug('')).toBe('restaurant');
    expect(toBaseSlug('!!!')).toBe('restaurant');
  });

  it('lowercases all characters', () => {
    const result = toBaseSlug('ABC店');
    expect(result).toBe(result.toLowerCase());
  });

  it('removes special characters', () => {
    const result = toBaseSlug('牛肉麵 & 豆漿!');
    expect(result).not.toMatch(/[&!]/);
  });
});
