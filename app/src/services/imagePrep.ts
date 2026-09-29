import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** The relay downsizes to this too; sending less saves upload time and cost. */
export const MAX_PHOTO_EDGE = 1024;
const JPEG_QUALITY = 0.8;

/** Which single dimension to set so the longest edge is at most `max` (aspect ratio kept), or null if it already fits. */
export function resizeTarget(
  width: number,
  height: number,
  max: number = MAX_PHOTO_EDGE,
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

export type PreparedPhoto = { uri: string; width: number; height: number };

/**
 * Shrinks a photo and re-encodes it as JPEG in the cache directory. Re-encoding also turns
 * HEIC into JPEG. The relay strips EXIF/GPS again server-side; the picker is asked not to
 * return EXIF in the first place.
 */
export async function prepareFoodPhoto(uri: string, width: number, height: number): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  const target = resizeTarget(width, height);
  if (target) context.resize(target);
  const rendered = await context.renderAsync();
  const {
    uri: outUri,
    width: outWidth,
    height: outHeight,
  } = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });
  return { uri: outUri, width: outWidth, height: outHeight };
}
