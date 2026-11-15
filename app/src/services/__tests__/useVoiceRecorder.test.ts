import { act, renderHook } from '@testing-library/react-native';

import { useVoiceRecorder } from '../useVoiceRecorder';

const mockRecorder = {
  prepareToRecordAsync: jest.fn(),
  record: jest.fn(),
  stop: jest.fn(),
  getStatus: jest.fn(),
  uri: 'file:///voice.m4a' as string | null,
};
const mockSetAudioMode = jest.fn();

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockRecorder,
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioMode(...args),
}));

/** A promise settled by hand, so a step can be held open. */
function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockRecorder.prepareToRecordAsync.mockReset().mockResolvedValue(undefined);
  mockRecorder.record.mockReset();
  mockRecorder.stop.mockReset().mockResolvedValue(undefined);
  mockRecorder.getStatus.mockReset().mockReturnValue({ metering: -10 });
  mockRecorder.uri = 'file:///voice.m4a';
  mockSetAudioMode.mockReset().mockResolvedValue(undefined);
});

afterEach(() => jest.useRealTimers());

describe('useVoiceRecorder', () => {
  it('records, reports the loudness and gives the file on stop', async () => {
    const { result } = await renderHook(() => useVoiceRecorder());
    const levels: number[] = [];

    await act(async () => result.current.start((level) => levels.push(level)));
    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
    expect(levels.length).toBeGreaterThan(0);
    expect(levels[0]).toBeGreaterThan(0.5);

    let uri: string | null = null;
    await act(async () => {
      uri = await result.current.stop();
    });
    expect(uri).toBe('file:///voice.m4a');
    expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
    // Playback only again, and the loudness timer is gone.
    expect(mockSetAudioMode).toHaveBeenLastCalledWith({ allowsRecording: false });
    const seen = levels.length;
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(levels).toHaveLength(seen);
  });

  it('does not record when stopped while the microphone is still opening', async () => {
    const opening = deferred();
    mockRecorder.prepareToRecordAsync.mockReturnValue(opening.promise);
    const { result } = await renderHook(() => useVoiceRecorder());

    let started: Promise<void> = Promise.resolve();
    await act(async () => {
      started = result.current.start(() => {});
    });
    let uri: string | null = 'unset';
    const stopping = act(async () => {
      uri = await result.current.stop();
    });
    opening.resolve();
    await stopping;
    await started;

    expect(mockRecorder.record).not.toHaveBeenCalled();
    expect(uri).toBeNull();
  });

  it('a second start while the first is opening leaves one recording', async () => {
    const opening = deferred();
    mockRecorder.prepareToRecordAsync.mockReturnValueOnce(opening.promise);
    const { result } = await renderHook(() => useVoiceRecorder());

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.start(() => {});
      second = result.current.start(() => {});
    });
    opening.resolve();
    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
  });

  it('stops by itself when the screen closes', async () => {
    const { result, unmount } = await renderHook(() => useVoiceRecorder());
    await act(async () => result.current.start(() => {}));

    await unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  });
});
