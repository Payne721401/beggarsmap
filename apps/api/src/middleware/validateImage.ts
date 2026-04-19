// Magic bytes 驗證（JPEG / PNG / WebP）
// 防止偽造 MIME type 的惡意上傳

const MAGIC = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  webp: {
    riff: [0x52, 0x49, 0x46, 0x46],   // "RIFF"
    webp: [0x57, 0x45, 0x42, 0x50],   // "WEBP"（bytes 8-11）
  },
};

export function validateMagicBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const bytes = new Uint8Array(buffer.slice(0, 12));

  const isJpeg = MAGIC.jpeg.every((b, i) => bytes[i] === b);
  if (isJpeg) return true;

  const isPng = MAGIC.png.every((b, i) => bytes[i] === b);
  if (isPng) return true;

  const isWebp =
    MAGIC.webp.riff.every((b, i) => bytes[i] === b) &&
    MAGIC.webp.webp.every((b, i) => bytes[8 + i] === b);
  return isWebp;
}

export const MAX_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB
