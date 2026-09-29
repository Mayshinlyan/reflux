import sharp from 'sharp';

import { HttpError } from '../errors.js';

/** ~40 megapixels: bigger than any phone camera, far below a decompression bomb. */
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_EDGE = 1024;

/** Magic-byte sniffing; the client-declared MIME type is never trusted. */
function detectType(buffer: Buffer): 'jpeg' | 'png' | 'webp' | 'heic' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 4, 8) === 'ftyp' &&
    /^(heic|heix|mif1|msf1)$/.test(buffer.toString('ascii', 8, 12))
  ) {
    return 'heic';
  }
  return null;
}

/**
 * Re-encodes an upload as a JPEG of at most 1024 px on the long edge with all metadata
 * (EXIF, GPS, ICC, XMP) dropped. Anything that isn't a decodable image is INPUT_REJECTED.
 */
export async function sanitizeImage(input: Buffer): Promise<Buffer> {
  const type = detectType(input);
  // HEIC is accepted by magic bytes only if the bundled libvips can decode it; otherwise it fails below.
  if (!type) throw new HttpError('INPUT_REJECTED');
  try {
    // sharp strips metadata by default on output; withMetadata() is deliberately never called.
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      .rotate() // apply EXIF orientation before the tag is dropped
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new HttpError('INPUT_REJECTED');
  }
}
