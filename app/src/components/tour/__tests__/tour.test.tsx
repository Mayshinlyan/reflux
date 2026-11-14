import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { useTourAutoStart } from '@/hooks/useTourAutoStart';

import { TourProvider, useTour, useTourTarget } from '../TourContext';

const mockNavigate = jest.fn();

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
  router: { navigate: (href: string) => mockNavigate(href) },
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));

const measureAt = (done: (x: number, y: number, width: number, height: number) => void) =>
  done(60, 240, 280, 270);

/** Starts the tour from a button, as Today does once it is on screen. */
function Screen() {
  const { begin, replay } = useTour();
  // The views the screens let the tour spotlight.
  const bellie = useTourTarget('bellie');
  const aiIdeas = useTourTarget('aiIdeas');
  const fridge = useTourTarget('fridge');
  const aboutYou = useTourTarget('aboutYou');
  const customize = useTourTarget('customize');
  const giftRow = useTourTarget('giftRow');
  return (
    <>
      <View ref={bellie} />
      <View ref={aiIdeas} />
      <View ref={fridge} />
      <View ref={aboutYou} />
      <View ref={customize} />
      <View ref={giftRow} />
      <Pressable accessibilityRole="button" accessibilityLabel="Start tour" onPress={() => begin()} />
      <Pressable accessibilityRole="button" accessibilityLabel="Replay tour" onPress={() => replay()} />
    </>
  );
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

async function start() {
  await render(
    <TourProvider>
      <Screen />
    </TourProvider>,
  );
  await fireEvent.press(screen.getByLabelText('Start tour'));
  await layOut();
  // Bellie is measured a moment after the step opens.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
  await screen.findByText('Tap Bellie to log', {}, { timeout: 2000 });
}

beforeAll(() => {
  // Jest has no layout: every view reports the same place when measured.
  jest
    .spyOn(View.prototype as never as { measureInWindow: typeof measureAt }, 'measureInWindow')
    .mockImplementation(measureAt);
});

beforeEach(() => {
  mockTourDone = false;
  mockUpdate.mockReset();
  mockNavigate.mockClear();
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

  it('opens on the first step, Bellie, with no Back', async () => {
    await start();

    expect(screen.getByText('Tap Bellie to log')).toBeTruthy();
    expect(screen.getByText('Tap Bellie to log food, how you feel, or a medication.')).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 11')).toBeTruthy();
    // Sentence case, not capitals.
    expect(screen.getByText('1 of 11')).toBeTruthy();
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('opens the screen behind each step, and ends back on Today', async () => {
    await start();
    expect(mockNavigate).toHaveBeenLastCalledWith('/');

    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Log anything')).toBeTruthy();
    expect(mockNavigate).toHaveBeenLastCalledWith('/');
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('History')).toBeTruthy();
    expect(mockNavigate).toHaveBeenLastCalledWith('/history');
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Kitchen')).toBeTruthy();
    expect(mockNavigate).toHaveBeenLastCalledWith('/kitchen');
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByText('History')).toBeTruthy();
    expect(mockNavigate).toHaveBeenLastCalledWith('/history');
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(await screen.findByText('AI Ideas')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(await screen.findByText('My fridge')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next'));

    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('7 of 11')).toBeTruthy();
    expect(mockNavigate).toHaveBeenLastCalledWith('/profile');
    expect(mockUpdate).not.toHaveBeenCalled();

    // Profile goes on to its two pages: the About you row and the page, the Customize Bellie row and the page.
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(await screen.findByText('About you')).toBeTruthy();
    expect(mockNavigate).toHaveBeenLastCalledWith('/profile');
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Tell Bellie about you')).toBeTruthy();
    expect(screen.getByText('9 of 11')).toBeTruthy();
    expect(mockNavigate).toHaveBeenLastCalledWith('/about-you');
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(await screen.findByText('Customize Bellie')).toBeTruthy();
    expect(mockNavigate).toHaveBeenLastCalledWith('/profile');
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(await screen.findByText('Make Bellie yours')).toBeTruthy();
    expect(screen.getByText('11 of 11')).toBeTruthy();
    expect(mockNavigate).toHaveBeenLastCalledWith('/bellies-things');
    expect(screen.queryByLabelText('Next')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Done'));

    expect(mockUpdate).toHaveBeenCalledWith('tourDone', true);
    expect(mockNavigate).toHaveBeenLastCalledWith('/');
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

  it('leaves out the Bellie step when Today has no Bellie on screen', async () => {
    function NoBellie() {
      const { begin } = useTour();
      return <Pressable accessibilityRole="button" accessibilityLabel="Start tour" onPress={() => begin()} />;
    }
    await render(
      <TourProvider>
        <NoBellie />
      </TourProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Start tour'));
    await layOut();

    expect(screen.getByText('Log anything')).toBeTruthy();
    expect(screen.getByText('1 of 10')).toBeTruthy();
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
