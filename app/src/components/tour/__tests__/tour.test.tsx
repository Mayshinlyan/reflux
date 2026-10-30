import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { useTourAutoStart } from '@/hooks/useTourAutoStart';

import { TourProvider, useTour, useTourTarget } from '../TourContext';

let mockTourDone = false;
const mockUpdate = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useSettings: () => ({ settings: { tourDone: mockTourDone }, update: mockUpdate }),
}));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));

/** Starts the tour from a button, as Today does once it is on screen. */
function Screen({ withBellie = false }: { withBellie?: boolean }) {
  const { begin, replay } = useTour();
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Start tour" onPress={() => begin()} />
      <Pressable accessibilityRole="button" accessibilityLabel="Replay tour" onPress={() => replay()} />
      {withBellie && <Bellie />}
    </>
  );
}

function Bellie() {
  const ref = useTourTarget('bellie');
  return <View ref={ref} />;
}

/** What Today does: start the tour once it is on screen. */
function AutoStart() {
  useTourAutoStart(true);
  return null;
}

/** The overlay only draws once it has its size, which the native layout would report. */
async function layOut() {
  await fireEvent(screen.getByTestId('tour-overlay'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } },
  });
}

async function start(props?: { withBellie?: boolean }) {
  await render(
    <TourProvider>
      <Screen {...props} />
    </TourProvider>,
  );
  await fireEvent.press(screen.getByLabelText('Start tour'));
  await layOut();
}

beforeEach(() => {
  mockTourDone = false;
  mockUpdate.mockReset();
});

describe('App tour', () => {
  it('is not on screen until it starts', async () => {
    await render(
      <TourProvider>
        <Screen />
      </TourProvider>,
    );
    expect(screen.queryByTestId('tour-overlay')).toBeNull();
  });

  it('opens on the first step, with no Back', async () => {
    await start();

    expect(screen.getByText('A quick look around')).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 5')).toBeTruthy();
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('leaves out a step whose spotlight is not on Today, so the count matches what is shown', async () => {
    await start();
    // No Bellie or insight cards are registered here: Log, History, Profile and Settings remain.
    expect(screen.getByLabelText('Step 1 of 5')).toBeTruthy();
  });

  it('keeps the Bellie step when she is on screen', async () => {
    await start({ withBellie: true });
    expect(screen.getByLabelText('Step 1 of 6')).toBeTruthy();
  });

  it('walks through the tabs with Next and Back, and ends on Done', async () => {
    await start();

    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Log anything')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('History')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByText('Log anything')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Next'));

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.queryByLabelText('Next')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Done'));

    expect(mockUpdate).toHaveBeenCalledWith('tourDone', true);
    expect(screen.queryByTestId('tour-overlay')).toBeNull();
  });

  it('is remembered when it is closed with the X', async () => {
    await start();

    await fireEvent.press(screen.getByLabelText('Close tour'));

    expect(mockUpdate).toHaveBeenCalledWith('tourDone', true);
    expect(screen.queryByTestId('tour-overlay')).toBeNull();
  });

  it('is remembered when it is closed with the Android back button', async () => {
    let onBack: Parameters<typeof BackHandler.addEventListener>[1] = () => false;
    const add = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
      onBack = handler;
      return { remove: jest.fn() };
    });
    await start();

    const handled = await act(async () => onBack(undefined as never));

    expect(handled).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith('tourDone', true);
    expect(screen.queryByTestId('tour-overlay')).toBeNull();
    add.mockRestore();
  });

  it('gives the close button at least the minimum touch target', async () => {
    await start();
    const style = StyleSheet.flatten(screen.getByLabelText('Close tour').props.style);
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
  });

  it('does not start a second tour while one is running', async () => {
    await start();
    await fireEvent.press(screen.getByLabelText('Next'));

    // The screen under the tour is hidden from a screen reader (and from queries) while it runs.
    expect(screen.queryByLabelText('Start tour')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Start tour', { includeHiddenElements: true }));

    expect(screen.getByText('Log anything')).toBeTruthy();
  });
});

describe('useTourAutoStart', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const renderToday = async () =>
    render(
      <TourProvider>
        <AutoStart />
        <Screen />
      </TourProvider>,
    );

  it('starts the tour a moment after Today opens, the first time', async () => {
    await renderToday();
    expect(screen.queryByTestId('tour-overlay')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    expect(screen.getByTestId('tour-overlay')).toBeTruthy();
  });

  it('does not start once the tour has been done', async () => {
    mockTourDone = true;
    await renderToday();

    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    expect(screen.queryByTestId('tour-overlay')).toBeNull();
  });

  it('starts again when Replay app tour asks, even after it was done', async () => {
    mockTourDone = true;
    await renderToday();

    await fireEvent.press(screen.getByLabelText('Replay tour'));
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    expect(screen.getByTestId('tour-overlay')).toBeTruthy();
  });
});
