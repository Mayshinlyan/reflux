import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useDb, useSettings } from '@/db/DatabaseProvider';
import { localDayKey } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { type Period, periodOf } from '@/lib/range';
import { currentTimeZone } from '@/lib/time';
import type { TimelineEntry } from '@/lib/timeline';
import { buildWeeklyReport, lastFullWeek, type WeeklyReport } from '@/lib/weeklyReport';
import { entriesIn, entriesUpTo, loadHistoryUpTo } from '@/lib/weeklyReportData';

const todayKeyNow = () => localDayKey(new Date().toISOString(), currentTimeZone());

export type LoadedReport = { period: Period; report: WeeklyReport; weekEntries: TimelineEntry[] };

/**
 * The report for one week: the Sunday in `weekStart`, or the newest week that has ended. Loads again each time the
 * page comes into focus.
 */
export function useWeeklyReport(weekStart?: string) {
  const db = useDb();
  const [loaded, setLoaded] = useState<LoadedReport | null>(null);
  const [failed, setFailed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      try {
        const now = new Date();
        const period = weekStart ? periodOf('week', weekStart) : lastFullWeek(todayKeyNow());
        const sections = loadHistoryUpTo(db, period.endKey, now);
        const weekEntries = entriesIn(sections, period);
        const report = buildWeeklyReport({ entries: entriesUpTo(sections, period.endKey), weekEntries, now });
        setLoaded({ period, report, weekEntries });
        setFailed(false);
      } catch (error) {
        logger.error('loadWeeklyReport', error);
        setFailed(true);
      }
    }, [db, weekStart]),
  );
  return { loaded, failed };
}

export type ReportStatus = {
  /** The Sunday of a finished week whose report is ready and not opened yet; null when there is none. */
  readyWeek: string | null;
  /** How many more meals it takes before there is anything to say; 0 once there are enough. */
  mealsNeeded: number;
};

/** What Today needs: whether to offer "Your week with Bellie", and how far along the first report is. */
export function useReportStatus(): ReportStatus {
  const db = useDb();
  const { settings } = useSettings();
  const [status, setStatus] = useState<ReportStatus>({ readyWeek: null, mealsNeeded: 0 });
  const seen = settings.reportSeenWeek;
  useFocusEffect(
    useCallback(() => {
      try {
        const now = new Date();
        const todayKey = todayKeyNow();
        const week = lastFullWeek(todayKey);
        const sections = loadHistoryUpTo(db, todayKey, now);
        const upToNow = buildWeeklyReport({
          entries: entriesUpTo(sections, todayKey),
          weekEntries: [],
          now,
        });
        const last = buildWeeklyReport({
          entries: entriesUpTo(sections, week.endKey),
          weekEntries: entriesIn(sections, week),
          now,
        });
        setStatus({
          readyWeek: last.hasContent && seen !== week.startKey ? week.startKey : null,
          mealsNeeded: upToNow.mealsNeeded,
        });
      } catch (error) {
        logger.error('loadReportStatus', error);
      }
    }, [db, seen]),
  );
  return status;
}
