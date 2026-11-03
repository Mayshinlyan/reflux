import { Directory, File, Paths } from 'expo-file-system';

const PHOTOS = 'photos';
const photosDir = () => new Directory(Paths.document, PHOTOS);

/**
 * The full address of a stored photo. The database keeps only `photos/<name>.jpg`: iOS can change the app's
 * container folder on an update or a restore to a new phone, which would break a saved absolute address.
 * An older absolute address is cut back to the part after `/Documents/` so it still works.
 */
export function photoUri(stored: string): string {
  const marker = '/Documents/';
  const at = stored.indexOf(marker);
  const relative = at >= 0 ? stored.slice(at + marker.length) : stored;
  return new File(Paths.document, relative).uri;
}

/** Copies a prepared photo into permanent app storage (never the cache) and returns its stored path. */
export function savePhoto(sourceUri: string): string {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const destination = new File(dir, name);
  new File(sourceUri).copy(destination);
  return `${PHOTOS}/${name}`;
}

/** Removes a stored photo. Missing files are fine. */
export function deletePhoto(stored: string): void {
  const file = new File(photoUri(stored));
  if (file.exists) file.delete();
}

/** Removes every stored photo (the whole folder). A missing folder is fine. */
export function deleteAllPhotos(): void {
  const dir = photosDir();
  if (dir.exists) dir.delete();
}
