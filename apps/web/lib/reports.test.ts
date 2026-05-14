import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasReported, addReport, getPriceVote, setPriceVote, getCpVote, setCpVote } from './reports';

// reports.ts 讀取 localStorage，需要 jsdom 環境（vitest.config.ts 已設定 environment: 'jsdom'）

const REPORTS_KEY = 'beggarsmap_reports';
const PRICE_VOTES_KEY = 'beggarsmap_price_votes';
const CP_VOTES_KEY = 'beggarsmap_cp_votes';

beforeEach(() => {
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────
// SSR 環境（window 不存在）
// ─────────────────────────────────────────────────────────────────
describe('SSR 環境（window undefined）', () => {
  it('hasReported 在 SSR 環境回傳 null', () => {
    vi.stubGlobal('window', undefined);
    expect(hasReported('rest-1')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('getPriceVote 在 SSR 環境回傳 null', () => {
    vi.stubGlobal('window', undefined);
    expect(getPriceVote('rest-1')).toBeNull();
    vi.unstubAllGlobals();
  });
});

// ─────────────────────────────────────────────────────────────────
// hasReported / addReport
// ─────────────────────────────────────────────────────────────────
describe('hasReported', () => {
  it('未舉報時回傳 null', () => {
    expect(hasReported('rest-1')).toBeNull();
  });

  it('舉報後回傳對應原因', () => {
    addReport('rest-1', 'not_beggar');
    expect(hasReported('rest-1')).toBe('not_beggar');
  });

  it('不同 ID 互不影響', () => {
    addReport('rest-1', 'chain_restaurant');
    expect(hasReported('rest-2')).toBeNull();
  });
});

describe('addReport', () => {
  it('首次舉報回傳 true', () => {
    expect(addReport('rest-1', 'not_beggar')).toBe(true);
  });

  it('重複舉報同一 ID 回傳 false', () => {
    addReport('rest-1', 'not_beggar');
    expect(addReport('rest-1', 'wrong_info')).toBe(false);
  });

  it('重複舉報不覆蓋原因', () => {
    addReport('rest-1', 'not_beggar');
    addReport('rest-1', 'chain_restaurant');
    expect(hasReported('rest-1')).toBe('not_beggar');
  });

  it('可以對不同 ID 各自舉報', () => {
    expect(addReport('rest-1', 'not_beggar')).toBe(true);
    expect(addReport('rest-2', 'chain_restaurant')).toBe(true);
    expect(hasReported('rest-1')).toBe('not_beggar');
    expect(hasReported('rest-2')).toBe('chain_restaurant');
  });

  it('支援所有三種舉報原因', () => {
    addReport('r1', 'not_beggar');
    addReport('r2', 'chain_restaurant');
    addReport('r3', 'wrong_info');
    expect(hasReported('r1')).toBe('not_beggar');
    expect(hasReported('r2')).toBe('chain_restaurant');
    expect(hasReported('r3')).toBe('wrong_info');
  });

  it('localStorage 損壞（非 JSON）時，addReport 仍成功', () => {
    localStorage.setItem(REPORTS_KEY, 'NOT_VALID_JSON');
    expect(addReport('rest-1', 'wrong_info')).toBe(true);
    expect(hasReported('rest-1')).toBe('wrong_info');
  });

  it('localStorage.setItem 拋出例外時，addReport 回傳 false', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(addReport('rest-x', 'not_beggar')).toBe(false);
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────
// getPriceVote / setPriceVote
// ─────────────────────────────────────────────────────────────────
describe('getPriceVote', () => {
  it('未投票時回傳 null', () => {
    expect(getPriceVote('rest-1')).toBeNull();
  });

  it('投票後回傳對應值', () => {
    setPriceVote('rest-1', 'yes');
    expect(getPriceVote('rest-1')).toBe('yes');
  });

  it('不同 ID 互不影響', () => {
    setPriceVote('rest-1', 'yes');
    expect(getPriceVote('rest-2')).toBeNull();
  });
});

describe('setPriceVote', () => {
  it('設定 yes', () => {
    setPriceVote('rest-1', 'yes');
    expect(getPriceVote('rest-1')).toBe('yes');
  });

  it('設定 no', () => {
    setPriceVote('rest-1', 'no');
    expect(getPriceVote('rest-1')).toBe('no');
  });

  it('可以覆蓋先前的投票（yes → no）', () => {
    setPriceVote('rest-1', 'yes');
    setPriceVote('rest-1', 'no');
    expect(getPriceVote('rest-1')).toBe('no');
  });

  it('可以覆蓋先前的投票（no → yes）', () => {
    setPriceVote('rest-1', 'no');
    setPriceVote('rest-1', 'yes');
    expect(getPriceVote('rest-1')).toBe('yes');
  });

  it('多個 ID 各自儲存', () => {
    setPriceVote('rest-1', 'yes');
    setPriceVote('rest-2', 'no');
    expect(getPriceVote('rest-1')).toBe('yes');
    expect(getPriceVote('rest-2')).toBe('no');
  });

  it('localStorage 損壞（非 JSON）時，setPriceVote 仍正常儲存', () => {
    localStorage.setItem(PRICE_VOTES_KEY, 'NOT_VALID_JSON');
    setPriceVote('rest-1', 'yes');
    expect(getPriceVote('rest-1')).toBe('yes');
  });

  it('localStorage.setItem 拋出例外時，setPriceVote 靜默忽略不崩潰', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => setPriceVote('rest-x', 'no')).not.toThrow();
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────
// getCpVote / setCpVote
// ─────────────────────────────────────────────────────────────────
describe('getCpVote (SSR)', () => {
  it('在 SSR 環境回傳 null', () => {
    vi.stubGlobal('window', undefined);
    expect(getCpVote('rest-1')).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('getCpVote', () => {
  it('未投票時回傳 null', () => {
    expect(getCpVote('rest-1')).toBeNull();
  });

  it('投票後回傳對應值（high）', () => {
    setCpVote('rest-1', 'high');
    expect(getCpVote('rest-1')).toBe('high');
  });

  it('投票後回傳對應值（low）', () => {
    setCpVote('rest-1', 'low');
    expect(getCpVote('rest-1')).toBe('low');
  });

  it('不同 ID 互不影響', () => {
    setCpVote('rest-1', 'high');
    expect(getCpVote('rest-2')).toBeNull();
  });

  it('localStorage 損壞（非 JSON）時，getCpVote 回傳 null', () => {
    localStorage.setItem(CP_VOTES_KEY, 'NOT_VALID_JSON');
    expect(getCpVote('rest-1')).toBeNull();
  });
});

describe('setCpVote', () => {
  it('設定 high', () => {
    setCpVote('rest-1', 'high');
    expect(getCpVote('rest-1')).toBe('high');
  });

  it('設定 low', () => {
    setCpVote('rest-1', 'low');
    expect(getCpVote('rest-1')).toBe('low');
  });

  it('可以覆蓋先前的投票（high → low）', () => {
    setCpVote('rest-1', 'high');
    setCpVote('rest-1', 'low');
    expect(getCpVote('rest-1')).toBe('low');
  });

  it('可以覆蓋先前的投票（low → high）', () => {
    setCpVote('rest-1', 'low');
    setCpVote('rest-1', 'high');
    expect(getCpVote('rest-1')).toBe('high');
  });

  it('多個 ID 各自儲存', () => {
    setCpVote('rest-1', 'high');
    setCpVote('rest-2', 'low');
    expect(getCpVote('rest-1')).toBe('high');
    expect(getCpVote('rest-2')).toBe('low');
  });

  it('localStorage 損壞（非 JSON）時，setCpVote 仍正常儲存', () => {
    localStorage.setItem(CP_VOTES_KEY, 'NOT_VALID_JSON');
    setCpVote('rest-1', 'high');
    expect(getCpVote('rest-1')).toBe('high');
  });

  it('localStorage.setItem 拋出例外時，setCpVote 靜默忽略不崩潰', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => setCpVote('rest-x', 'high')).not.toThrow();
    vi.restoreAllMocks();
  });
});
