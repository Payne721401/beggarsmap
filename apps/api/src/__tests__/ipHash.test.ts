import { describe, it, expect } from 'vitest';
import { hashIp, getClientIp } from '../lib/ipHash';

describe('hashIp', () => {
  it('returns a 64-char hex string (SHA-256)', async () => {
    const hash = await hashIp('1.2.3.4', 'test-salt');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('same IP + salt always produces same hash', async () => {
    const hash1 = await hashIp('1.2.3.4', 'salt');
    const hash2 = await hashIp('1.2.3.4', 'salt');
    expect(hash1).toBe(hash2);
  });

  it('different IPs produce different hashes', async () => {
    const hash1 = await hashIp('1.2.3.4', 'salt');
    const hash2 = await hashIp('5.6.7.8', 'salt');
    expect(hash1).not.toBe(hash2);
  });

  it('same IP but different salt produces different hash', async () => {
    const hash1 = await hashIp('1.2.3.4', 'salt1');
    const hash2 = await hashIp('1.2.3.4', 'salt2');
    expect(hash1).not.toBe(hash2);
  });

  it('handles unusual IP formats', async () => {
    const hash = await hashIp('::1', 'salt');
    expect(hash).toHaveLength(64);
  });
});

describe('getClientIp', () => {
  it('returns CF-Connecting-IP header value', () => {
    const req = new Request('https://example.com', {
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('returns "unknown" when header is missing', () => {
    const req = new Request('https://example.com');
    expect(getClientIp(req)).toBe('unknown');
  });
});
