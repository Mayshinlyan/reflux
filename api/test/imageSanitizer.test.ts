import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { HttpError } from '../src/errors.js';
import { sanitizeImage } from '../src/services/imageSanitizer.js';

async function photoWithMetadata(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#a52' } })
    .jpeg()
    .withMetadata({
      exif: {
        IFD0: { Copyright: 'secret-owner', Software: 'secret-camera-app' },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '37/1 46/1 30/1',
          GPSLongitudeRef: 'W',
          GPSLongitude: '122/1 25/1 10/1',
        },
      },
    })
    .toBuffer();
}

describe('sanitizeImage', () => {
  it('shrinks to at most 1024 px and strips all EXIF/GPS metadata', async () => {
    const input = await photoWithMetadata(3000, 2000);
    // Sanity check: the fixture really carries EXIF, or the assertion below proves nothing.
    expect((await sharp(input).metadata()).exif).toBeDefined();
    expect(input.includes(Buffer.from('secret-owner'))).toBe(true);

    const output = await sanitizeImage(input);
    const meta = await sharp(output).metadata();

    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(1024);
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(683);
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(output.includes(Buffer.from('secret-owner'))).toBe(false);
    expect(output.includes(Buffer.from('Exif'))).toBe(false);
    expect(output.includes(Buffer.from('GPS'))).toBe(false);
  });

  it('does not enlarge small images', async () => {
    const output = await sanitizeImage(await photoWithMetadata(200, 100));
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height]).toEqual([200, 100]);
  });

  it('converts PNG and WebP input to JPEG', async () => {
    const base = sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } });
    for (const input of [await base.clone().png().toBuffer(), await base.clone().webp().toBuffer()]) {
      const meta = await sharp(await sanitizeImage(input)).metadata();
      expect(meta.format).toBe('jpeg');
    }
  });

  it('applies EXIF orientation before dropping it', async () => {
    const input = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#fff' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const meta = await sharp(await sanitizeImage(input)).metadata();
    expect([meta.width, meta.height]).toEqual([100, 200]);
    expect(meta.orientation).toBeUndefined();
  });

  it('rejects a decompression bomb (pixel count over the limit)', async () => {
    const bomb = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: '#000' } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(5 * 1024 * 1024); // small on the wire, huge when decoded

    await expect(sanitizeImage(bomb)).rejects.toMatchObject({ code: 'INPUT_REJECTED' });
  }, 30_000);

  it.each([
    ['garbage bytes', Buffer.from('definitely not an image')],
    ['an empty buffer', Buffer.alloc(0)],
    ['a PDF', Buffer.from('%PDF-1.7\n1 0 obj\n')],
    ['a GIF', Buffer.from('GIF89a\u0001\u0000\u0001\u0000')],
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['a truncated JPEG header', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])],
  ])('rejects %s as INPUT_REJECTED', async (_name, input) => {
    const error = await sanitizeImage(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).code).toBe('INPUT_REJECTED');
  });
});
