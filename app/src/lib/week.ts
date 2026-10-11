import { addDays } from './localDay';

export type WeekDay = { key: string; name: string; letter: string; date: number; isToday: boolean };

const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 0 (Sunday) to 6 (Saturday) for a "YYYY-MM-DD" day key. */
function weekday(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** The Sunday-to-Saturday week containing `todayKey`. */
export function weekOf(todayKey: string): WeekDay[] {
  const sunday = addDays(todayKey, -weekday(todayKey));
  return NAMES.map((name, i) => {
    const key = addDays(sunday, i);
    return { key, name, letter: name.slice(0, 1), date: Number(key.slice(8, 10)), isToday: key === todayKey };
  });
}
