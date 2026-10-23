import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useDb } from '@/db/DatabaseProvider';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { listMedicationLogs } from '@/db/repositories/medications';
import { listSymptomLogs } from '@/db/repositories/symptoms';
import { localDayKey } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { currentTimeZone } from '@/lib/time';
import { buildTimeline, type TimelineEntry } from '@/lib/timeline';
import { type WeekDay, weekOf } from '@/lib/week';
import type { AppVerdict } from '@/types/analysis';

export type TodayData = {
  /** Today's local day, "YYYY-MM-DD". */
  todayKey: string;
  week: WeekDay[];
  /** Day keys this week with at least one entry. */
  loggedDays: ReadonlySet<string>;
  /** Today's entries, newest first. */
  entries: TimelineEntry[];
  /** This week's entries (Sunday to Saturday, today's included), newest first: what Bellie's week summary is made from. */
  weekEntries: TimelineEntry[];
  /** Today's meals, oldest first (the order of the ring's arcs). */
  meals: { verdict: AppVerdict | null }[];
};

const emptyDay = (): TodayData => {
  const todayKey = localDayKey(new Date().toISOString(), currentTimeZone());
  return { todayKey, week: weekOf(todayKey), loggedDays: new Set(), entries: [], weekEntries: [], meals: [] };
};

/** A week and a day of padding, so entries logged in far-off zones aren't clipped. */
const LOOKBACK_DAYS = 8;

/** Loads this week's entries each time Today comes into view. */
export function useTodayData(): TodayData {
  const db = useDb();
  const [data, setData] = useState<TodayData>(emptyDay);

  const reload = useCallback(() => {
    try {
      const now = new Date();
      const todayKey = localDayKey(now.toISOString(), currentTimeZone());
      const range = {
        from: new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString(),
        to: new Date(now.getTime() + 86_400_000).toISOString(),
      };
      const sections = buildTimeline(
        {
          symptoms: listSymptomLogs(db, range),
          food: listDiaryFoodLogs(db, range),
          medications: listMedicationLogs(db, range),
        },
        'all',
        now,
      );
      const entries = sections.find((section) => section.dayKey === todayKey)?.entries ?? [];
      const meals = entries
        .flatMap((entry) => (entry.kind === 'food' ? [{ verdict: entry.log.overallVerdict ?? null }] : []))
        .reverse();
      const week = weekOf(todayKey);
      const weekKeys = new Set(week.map((day) => day.key));
      setData({
        todayKey,
        week,
        loggedDays: new Set(sections.map((section) => section.dayKey)),
        entries,
        weekEntries: sections.filter((section) => weekKeys.has(section.dayKey)).flatMap((s) => s.entries),
        meals,
      });
    } catch (error) {
      // Show an empty day rather than crash the home screen; the entries are still on the phone.
      logger.error('loadToday', error);
      setData(emptyDay());
    }
  }, [db]);

  useFocusEffect(reload);

  return data;
}
