import type { TabKey } from '@/components/FloatingTabBar';

/** Views that register themselves as a spotlight target (see `useTourTarget`): Bellie on Today, two on Kitchen, two rows on Profile and the row of gifts on Customize Bellie. */
export type TourViewId = 'bellie' | 'aiIdeas' | 'fridge' | 'aboutYou' | 'customize' | 'giftRow';

export type TourTarget = { kind: 'view'; id: TourViewId } | { kind: 'tab'; key: TabKey };

/** The screen shown behind a step: a tab, or a page opened from Profile (About you, Customize Bellie). */
export type TourScreen = Exclude<TabKey, 'log'> | 'aboutYou' | 'customize';

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
  /** Pins the card to the top or bottom of the screen instead of beside the cut-out (a whole page behind it). */
  card?: 'top' | 'bottom';
};

/**
 * Figma row 43 "App tour" (G18 for the last five): eleven steps, each with its own screen behind it. Bellie and the +
 * button on Today, then History, Kitchen (the tab, the AI Ideas pill, My fridge) and Profile. Profile goes on to its
 * two pages: the About you row and then the page itself, the Customize Bellie row and then the page. It ends back on Today.
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
    body: 'Your own space. Tell Bellie about you and customize her with the gifts you earn. The gear has reminders and settings.',
    screen: 'profile',
    target: { kind: 'tab', key: 'profile' },
    pad: 6,
    radius: 22,
  },
  {
    id: 'aboutYouRow',
    title: 'About you',
    body: 'Tell Bellie about you, like your condition, symptoms, foods and medications, so her tips fit you.',
    screen: 'profile',
    target: { kind: 'view', id: 'aboutYou' },
    pad: 0,
    radius: 24,
  },
  {
    id: 'aboutYouPage',
    title: 'Tell Bellie about you',
    body: 'Tap a tile to add your condition, usual symptoms, favorite foods, foods to avoid, medications or lifestyle. You can change them any time.',
    screen: 'aboutYou',
    target: null,
    pad: 0,
    radius: 0,
    card: 'bottom',
  },
  {
    id: 'customizeRow',
    title: 'Customize Bellie',
    body: 'Keep checking in and you will get gifts to customize Bellie. They wait for you here.',
    screen: 'profile',
    target: { kind: 'view', id: 'customize' },
    pad: 0,
    radius: 24,
  },
  {
    id: 'customizePage',
    title: 'Make Bellie yours',
    body: 'Tap a gift to open it, then tap an item to put it on her. Locked ones say how many more days of check-in they need.',
    screen: 'customize',
    target: { kind: 'view', id: 'giftRow' },
    pad: 8,
    radius: 20,
    card: 'top',
  },
];
