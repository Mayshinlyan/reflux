import { ImageManipulator } from 'expo-image-manipulator';

import { MAX_PHOTO_EDGE, prepareFoodPhoto, resizeTarget } from '../imagePrep';

const mockResize = jest.fn();
const mockSave = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

beforeEach(() => {
  mockResize.mockReset();
  mockSave.mockReset().mockResolvedValue({ uri: 'file:///cache/out.jpg', width: 1024, height: 768 });
  const context = { resize: mockResize, renderAsync: async () => ({ saveAsync: mockSave }) };
  mockResize.mockReturnValue(context);
  (ImageManipulator.manipulate as jest.Mock).mockReturnValue(context);
});

describe('resizeTarget', () => {
  it('limits the longest edge and keeps the aspect ratio', () => {
    expect(resizeTarget(4000, 3000)).toEqual({ width: MAX_PHOTO_EDGE });
    expect(resizeTarget(3000, 4000)).toEqual({ height: MAX_PHOTO_EDGE });
    expect(resizeTarget(3000, 3000)).toEqual({ width: MAX_PHOTO_EDGE });
  });

  it('leaves small images alone', () => {
    expect(resizeTarget(1024, 800)).toBeNull();
    expect(resizeTarget(640, 480)).toBeNull();
  });
});

describe('prepareFoodPhoto', () => {
  it('resizes big photos and re-encodes as JPEG', async () => {
    const result = await prepareFoodPhoto('file:///in.heic', 4000, 3000);

    expect(mockResize).toHaveBeenCalledWith({ width: 1024 });
    expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 });
    expect(result).toEqual({ uri: 'file:///cache/out.jpg', width: 1024, height: 768 });
  });

  it('still re-encodes a small photo without resizing', async () => {
    await prepareFoodPhoto('file:///in.png', 800, 600);

    expect(mockResize).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 });
  });
});
