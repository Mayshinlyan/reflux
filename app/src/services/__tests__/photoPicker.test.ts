import * as ImagePicker from 'expo-image-picker';

import { prepareFoodPhoto } from '../imagePrep';
import { pickFoodPhoto } from '../photoPicker';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../imagePrep', () => ({ prepareFoodPhoto: jest.fn() }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const prepare = prepareFoodPhoto as jest.Mock;
const asset = { uri: 'file:///raw.heic', width: 4000, height: 3000 };
const prepared = { uri: 'file:///cache/out.jpg', width: 1024, height: 768 };

beforeEach(() => {
  jest.resetAllMocks();
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
  picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset] } as never);
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] } as never);
  prepare.mockResolvedValue(prepared);
});

describe('pickFoodPhoto', () => {
  it('asks for camera permission first and does not open the camera when it is denied', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
    const onPicked = jest.fn();

    await expect(pickFoodPhoto('camera', onPicked)).resolves.toEqual({ status: 'denied' });

    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(onPicked).not.toHaveBeenCalled();
  });

  it('never asks for EXIF and prepares the chosen photo', async () => {
    await expect(pickFoodPhoto('camera')).resolves.toEqual({ status: 'ok', photo: prepared });

    expect(picker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ exif: false }));
    expect(prepare).toHaveBeenCalledWith(asset.uri, asset.width, asset.height);
  });

  it('opens the library without asking for camera permission', async () => {
    await pickFoodPhoto('library');

    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.launchImageLibraryAsync).toHaveBeenCalled();
  });

  it('tells the caller a photo was chosen before the slower preparation starts', async () => {
    const order: string[] = [];
    prepare.mockImplementation(async () => {
      order.push('prepare');
      return prepared;
    });

    await pickFoodPhoto('library', () => order.push('picked'));

    expect(order).toEqual(['picked', 'prepare']);
  });

  it('does not report a photo when the picker is cancelled', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    const onPicked = jest.fn();

    await expect(pickFoodPhoto('library', onPicked)).resolves.toEqual({ status: 'canceled' });

    expect(onPicked).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });
});
