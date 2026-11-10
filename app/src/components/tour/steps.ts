import type { TabKey } from '@/components/FloatingTabBar';

/** Views that register themselves as a spotlight target (see `useTourTarget`): Bellie on Today, two on Kitchen. */
export type TourViewId = 'bellie' | 'aiIdeas' | 'fridge';

export type TourTarget = { kind: 'view'; id: TourViewId } | { kind: 'tab'; key: TabKey };

/** The tab screen shown behind a step. */
export type TourScreen = Exclude<TabKey, 'log'>;

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** The screen behind the dimmed layer; the tour opens it as the step comes up. */
  screen: TourScreen;
  /** What the spotlight shows; none centres the card on the dimmed screen. */
  target: TourTarget | null;
  /** Room (pt) the cut-out leaves around the target, and its corner radius. */
  pad: number;
  radius: number;
};

/**
 * Figma row 43 "App tour": seven steps, each with its own screen behind it. Bellie and the + button on Today, then
 * History, Kitchen (the tab, the AI Ideas pill, My fridge) and Profile. It ends back on Today.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'bellie',
    title: 'Tap Bellie to log',
    body: 'Tap Bellie to log food, how you feel, or a medication.',
    screen: 'today',
    target: { kind: 'view', id: 'bellie' },
    pad: 0,
    radius: 32,
  },
  {
    id: 'log',
    title: 'Log anything',
    body: 'You can also log by tapping this + button',
    screen: 'today',
    target: { kind: 'tab', key: 'log' },
    pad: 3,
    radius: 36,
  },
  {
    id: 'history',
    title: 'History',
    body: 'Your week, what sat well, and your weekly report show up here.',
    screen: 'history',
    target: { kind: 'tab', key: 'history' },
    pad: 6,
    radius: 22,
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    body: 'Recipe ideas that go easy on your belly, made from what you like and what is in your fridge.',
    screen: 'kitchen',
    target: { kind: 'tab', key: 'kitchen' },
    pad: 6,
    radius: 22,
  },
  {
    id: 'aiIdeas',
    title: 'AI Ideas',
    body: 'Tap for new recipe ideas when you are not sure what to eat.',
    screen: 'kitchen',
    target: { kind: 'view', id: 'aiIdeas' },
    pad: 0,
    radius: 28,
  },
  {
    id: 'fridge',
    title: 'My fridge',
    body: 'Snap your fridge and recipes use what you have.',
    screen: 'kitchen',
    target: { kind: 'view', id: 'fridge' },
    pad: 6,
    radius: 20,
  },
  {
    id: 'profile',
    title: 'Profile',
    body: 'Your favorite foods, symptoms and medications live here. The gear opens Settings, reminders, privacy and this tour.',
    screen: 'profile',
    target: { kind: 'tab', key: 'profile' },
    pad: 6,
    radius: 22,
  },
];
