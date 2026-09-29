import { Directory, File, Paths } from 'expo-file-system';

const photosDir = () => new Directory(Paths.document, 'photos');

/** Copies a prepared photo into permanent app storage (never the cache) and returns its URI. */
export function savePhoto(sourceUri: string): string {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const destination = new File(dir, name);
  new File(sourceUri).copy(destination);
  return destination.uri;
}

/** Removes a stored photo. Missing files are fine. */
export function deletePhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}
