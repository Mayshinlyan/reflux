import { router, useFocusEffect } from 'expo-router';
import { Infinity as InfinityIcon } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { DateRangePicker } from '@/components/DateRangePicker';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { HistorySummary } from '@/components/HistorySummary';
import { RangeStepper } from '@/components/RangeStepper';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Select } from '@/components/Select';
import { TimelineItem } from '@/components/TimelineItem';
import { VerdictBadge } from '@/components/VerdictBadge';
import { useDb } from '@/db/DatabaseProvider';
import { earliestEntryDayKey } from '@/db/repositories/data';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import { listMedicationLogs } from '@/db/repositories/medications';
import { listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import { useDeleteEntry } from '@/hooks/useDeleteEntry';
import { friendlyMessages } from '@/lib/errors';
import { summarize } from '@/lib/historySummary';
import { localDayKey } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import {
  inPeriod,
  isCurrent,
  loadWindow,
  type Period,
  periodLabel,
  periodOf,
  shiftPeriod,
  spanLabel,
} from '@/lib/range';
import { currentTimeZone } from '@/lib/time';
import { buildTimeline, type TimelineEntry, type TimelineFilter, type TimelineSection } from '@/lib/timeline';
import { space } from '@/theme';

/** What History is showing: a week or month you can step through, everything so far, or dates picked by hand. */
type Kind = 'week' | 'month' | 'all' | 'custom';

/** The segments; a custom range has none selected. */
const SEGMENTS = [
  { value: 'week', label: 'W', accessibilityLabel: 'Week' },
  { value: 'month', label: 'M', accessibilityLabel: 'Month' },
  { value: 'all', label: 'All time', icon: InfinityIcon },
] as const;

const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'symptom', label: 'Symptoms' },
  { value: 'food', label: 'Food' },
  { value: 'medication', label: 'Medications' },
];

const todayKeyNow = () => localDayKey(new Date().toISOString(), currentTimeZone());

/** Everything logged in the period, by day. Loads a day either side so other zones aren't clipped, then trims. */
function loadPeriod(db: AppDb, period: Period): TimelineSection[] {
  const range = loadWindow(period);
  return buildTimeline(
    {
      symptoms: listSymptomLogs(db, range),
      food: listDiaryFoodLogs(db, range),
      medications: listMedicationLogs(db, range),
    },
    'all',
    new Date(),
  ).filter((section) => inPeriod(period, section.dayKey));
}

export default function HistoryScreen() {
  const db = useDb();
  const [kind, setKind] = useState<Kind>('week');
  /** The week, month or hand-picked dates shown; for all time it is worked out from the first entry. */
  const [span, setSpan] = useState<Period>(() => periodOf('week', todayKeyNow()));
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [picking, setPicking] = useState(false);
  const [dayCounts, setDayCounts] = useState<ReadonlyMap<string, number>>(new Map());
  const [sections, setSections] = useState<TimelineSection[]>([]);
  const [todayKey, setTodayKey] = useState(todayKeyNow);
  const [firstDayKey, setFirstDayKey] = useState<string | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);

  const firstDay = firstDayKey ?? todayKey;
  const period = useMemo<Period>(
    () => (kind === 'all' ? { startKey: firstDay, endKey: todayKey } : span),
    [kind, span, firstDay, todayKey],
  );

  const reload = useCallback(() => {
    try {
      setSections(loadPeriod(db, period));
      setTodayKey(todayKeyNow());
      setFirstDayKey(earliestEntryDayKey(db));
      setLoadFailed(false);
    } catch (error) {
      logger.error('loadHistory', error);
      // Say so, rather than showing "Nothing here yet" and making it look like data is gone.
      setLoadFailed(true);
    }
  }, [db, period]);

  // Reload whenever History comes back into view (e.g. after editing an entry).
  useFocusEffect(reload);

  const confirmDelete = useDeleteEntry(reload);

  const summary = useMemo(
    () =>
      summarize(
        sections.flatMap((section) => section.entries),
        (entry) => localDayKey(entry.at, entry.tz),
      ),
    [sections],
  );
  const shown = useMemo(
    () =>
      filter === 'all'
        ? sections
        : sections
            .map((section) => ({
              ...section,
              entries: section.entries.filter((entry) => entry.kind === filter),
            }))
            .filter((section) => section.entries.length > 0),
    [sections, filter],
  );

  const stepping = kind === 'week' || kind === 'month';
  const label =
    kind === 'week' || kind === 'month' ? periodLabel(kind, period, todayKey) : spanLabel(period, todayKey);

  const choose = (next: 'week' | 'month' | 'all') => {
    setKind(next);
    if (next !== 'all') setSpan(periodOf(next, todayKey));
  };

  // The calendar marks days with entries and counts them, so it needs every day, not just the shown ones.
  const openCalendar = () => {
    try {
      const everything = loadPeriod(db, { startKey: firstDay, endKey: todayKey });
      setDayCounts(new Map(everything.map((section) => [section.dayKey, section.entries.length])));
    } catch (error) {
      logger.error('loadCalendar', error);
      setDayCounts(new Map());
    }
    setPicking(true);
  };

  const open = (entry: TimelineEntry) =>
    router.push({ pathname: '/entry', params: { kind: entry.kind, id: String(entry.id) } });

  const where =
    kind === 'week' || kind === 'month' ? `this ${kind}` : kind === 'custom' ? 'in these dates' : 'yet';

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <SectionList
        sections={shown.map((section) => ({ ...section, data: section.entries }))}
        keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
        ListHeaderComponent={
          <View>
            <AppText variant="display" accessibilityRole="header" style={styles.title}>
              History
            </AppText>
            <View style={styles.controls}>
              <SegmentedControl
                options={SEGMENTS}
                value={kind === 'custom' ? null : kind}
                onChange={choose}
              />
              <RangeStepper
                label={label}
                // A week or month moves only with the arrows; the calendar opens from all time or a picked range.
                onPressLabel={stepping ? undefined : openCalendar}
                arrows={stepping}
                unit={kind === 'month' ? 'month' : 'week'}
                canBack={period.startKey > firstDay}
                canForward={!isCurrent(period, todayKey)}
                onBack={() => stepping && setSpan(shiftPeriod(kind, span, -1))}
                onForward={() => stepping && setSpan(shiftPeriod(kind, span, 1))}
              />
            </View>
            <HistorySummary summary={summary} />
            <View style={styles.entriesHead}>
              <AppText variant="section" accessibilityRole="header">
                Entries
              </AppText>
              <Select options={FILTERS} value={filter} onChange={setFilter} label="Show" />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="section" accessibilityRole="header" style={styles.dayLabel}>
            {section.label}
          </AppText>
        )}
        renderItem={({ item }) => (
          <TimelineItem
            kind={item.kind}
            title={item.title}
            time={item.meta}
            side={
              item.kind === 'food' && item.log.overallVerdict ? (
                <VerdictBadge verdict={item.log.overallVerdict} />
              ) : undefined
            }
            onPress={() => open(item)}
            onDelete={() => confirmDelete(item)}
          />
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="title" style={styles.emptyTitle}>
              {loadFailed ? "Couldn't load your logs" : 'Nothing here yet'}
            </AppText>
            <AppText color="inkSoft" style={styles.emptyBody}>
              {loadFailed
                ? `${friendlyMessages.INTERNAL} Your entries are still on this phone.`
                : filter === 'all'
                  ? `Nothing logged ${where}. Tap Log below to add an entry.`
                  : `Nothing of this kind ${where}.`}
            </AppText>
          </View>
        }
      />

      <DateRangePicker
        visible={picking}
        firstDayKey={firstDay}
        todayKey={todayKey}
        counts={dayCounts}
        initial={kind === 'custom' ? span : null}
        onApply={(picked) => {
          setKind('custom');
          setSpan(picked);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  title: { marginBottom: space.s2 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.s2,
  },
  entriesHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: space.s3,
  },
  dayLabel: { marginTop: space.s2, marginBottom: 10 },
  list: { paddingBottom: TAB_BAR_CLEARANCE, flexGrow: 1 },
  empty: { alignItems: 'center', paddingHorizontal: space.s3, paddingTop: space.s4 },
  emptyTitle: { marginBottom: space.s1 },
  emptyBody: { textAlign: 'center' },
});
