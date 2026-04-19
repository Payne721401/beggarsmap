import { describe, it, expect } from 'vitest';
import { validateMagicBytes, MAX_IMAGE_SIZE } from '../middleware/validateImage';

// Helper: build ArrayBuffer from byte array
function makeBuffer(bytes: number[]): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

describe('validateMagicBytes', () => {
  it('accepts valid JPEG', () => {
    const buf = makeBuffer([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(validateMagicBytes(buf)).toBe(true);
  });

  it('accepts valid PNG', () => {
    const buf = makeBuffer([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
    expect(validateMagicBytes(buf)).toBe(true);
  });

  it('accepts valid WebP', () => {
    // RIFF....WEBP
    const buf = makeBuffer([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // file size (doesn't matter)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(validateMagicBytes(buf)).toBe(true);
  });

  it('rejects EXE file (MZ header)', () => {
    const buf = makeBuffer([0x4D, 0x5A, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(validateMagicBytes(buf)).toBe(false);
  });

  it('rejects PDF file', () => {
    const buf = makeBuffer([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(validateMagicBytes(buf)).toBe(false);
  });

  it('rejects buffer shorter than 12 bytes', () => {
    const buf = makeBuffer([0xFF, 0xD8, 0xFF]);
    expect(validateMagicBytes(buf)).toBe(false);
  });

  it('rejects RIFF buffer that is not WebP', () => {
    // RIFF....AVI (not WEBP)
    const buf = makeBuffer([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00,
      0x41, 0x56, 0x49, 0x20, // AVI (not WEBP)
    ]);
    expect(validateMagicBytes(buf)).toBe(false);
  });
});

describe('MAX_IMAGE_SIZE', () => {
  it('is 1MB', () => {
    expect(MAX_IMAGE_SIZE).toBe(1024 * 1024);
  });
});
