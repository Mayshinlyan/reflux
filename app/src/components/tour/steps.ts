import type { TabKey } from '@/components/FloatingTabBar';

/** Views on Today that register themselves as a spotlight target (see `useTourTarget`). */
export type TourViewId = 'bellie';

export type TourTarget = { kind: 'view'; id: TourViewId } | { kind: 'tab'; key: TabKey };

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** What the spotlight shows; none centres the card on the dimmed screen. */
  target: TourTarget | null;
  /** Room (pt) the cut-out leaves around the target, and its corner radius. */
  pad: number;
  radius: number;
};

/** Figma row 18 "App tour". The tour stays on Today and only spotlights the tabs. */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'A quick look around',
    body: 'Bellie helps you spot what upsets your belly. This takes about a minute.',
    target: null,
    pad: 0,
    radius: 0,
  },
  {
    id: 'log',
    title: 'Log anything',
    body: 'You can also log by tapping this + button',
    target: { kind: 'tab', key: 'log' },
    pad: 3,
    radius: 36,
  },
  {
    id: 'today',
    title: 'Today: Bellie and your day',
    body: 'Bellie sums up your day in her bubble. Your meals and how you feel are listed below.',
    target: { kind: 'tab', key: 'today' },
    pad: 6,
    radius: 22,
  },
  {
    id: 'history',
    title: 'History',
    body: 'See your week, what went well, and what to try next.',
    target: { kind: 'tab', key: 'history' },
    pad: 6,
    radius: 22,
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    body: 'Recipe ideas that go easy on your belly, made from what you like and what is in your fridge.',
    target: { kind: 'tab', key: 'kitchen' },
    pad: 6,
    radius: 22,
  },
  {
    id: 'profile',
    title: 'Profile',
    body: 'Your favorite foods, symptoms and medications live here. The gear opens Settings, reminders, privacy and this tour.',
    target: { kind: 'tab', key: 'profile' },
    pad: 6,
    radius: 22,
  },
];
