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
    id: 'bellie',
    title: 'Bellie',
    body: 'Bellie sums up your day in her bubble. Tap her to log food, how you feel, or a medication.',
    target: { kind: 'view', id: 'bellie' },
    pad: 8,
    radius: 28,
  },
  {
    id: 'log',
    title: 'Log anything',
    body: 'Tap + to log food, how you feel, or a medication.',
    target: { kind: 'tab', key: 'log' },
    pad: 3,
    radius: 36,
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
    id: 'profile',
    title: 'Profile',
    body: 'Your favorite foods, symptoms and medications live here.',
    target: { kind: 'tab', key: 'profile' },
    pad: 6,
    radius: 22,
  },
  {
    id: 'settings',
    title: 'Settings',
    body: 'Reminders, privacy, and this tour whenever you want it again.',
    target: { kind: 'tab', key: 'settings' },
    pad: 6,
    radius: 22,
  },
];
