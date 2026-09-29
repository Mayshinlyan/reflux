import * as ImagePicker from 'expo-image-picker';

import { type PreparedPhoto, prepareFoodPhoto } from './imagePrep';

export type PhotoSource = 'camera' | 'library';
export type PickResult =
  { status: 'ok'; photo: PreparedPhoto } | { status: 'canceled' } | { status: 'denied' };

/**
 * Opens the system camera or photo library and returns a photo already shrunk and re-encoded
 * for the relay. Camera permission is requested on the first camera tap, not up front. EXIF is
 * not requested from the picker, so location never enters the app.
 */
export async function pickFoodPhoto(source: PhotoSource): Promise<PickResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'canceled' };
  return { status: 'ok', photo: await prepareFoodPhoto(asset.uri, asset.width, asset.height) };
}
