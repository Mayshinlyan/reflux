import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { HistorySummary } from '@/components/HistorySummary';
import { RangeSheet } from '@/components/RangeSheet';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Select } from '@/components/Select';
import { TimePill } from '@/components/TimePill';
import { TimelineItem } from '@/components/TimelineItem';
import { VerdictBadge } from '@/components/VerdictBadge';
import { useDb } from '@/db/DatabaseProvider';
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
  loadWindow,
  type Period,
  periodLabel,
  periodOf,
  recentPeriods,
  type RangeMode,
} from '@/lib/range';
import { currentTimeZone } from '@/lib/time';
import { buildTimeline, type TimelineEntry, type TimelineFilter, type TimelineSection } from '@/lib/timeline';
import { space } from '@/theme';

const MODES: { value: RangeMode; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'symptom', label: 'Symptoms' },
  { value: 'food', label: 'Food' },
  { value: 'medication', label: 'Medications' },
];

/** How many weeks or months the range sheet offers. */
const CHOICE_COUNT: Record<RangeMode, number> = { week: 26, month: 12 };

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
  const [mode, setMode] = useState<RangeMode>('week');
  const [period, setPeriod] = useState<Period>(() => periodOf('week', todayKeyNow()));
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [choosing, setChoosing] = useState(false);
  const [sections, setSections] = useState<TimelineSection[]>([]);
  const [todayKey, setTodayKey] = useState(todayKeyNow);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(() => {
    try {
      setSections(loadPeriod(db, period));
      setTodayKey(todayKeyNow());
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

  const changeMode = (next: RangeMode) => {
    setMode(next);
    setPeriod(periodOf(next, todayKey));
  };

  const open = (entry: TimelineEntry) =>
    router.push({ pathname: '/entry', params: { kind: entry.kind, id: String(entry.id) } });

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
              <SegmentedControl options={MODES} value={mode} onChange={changeMode} />
              <TimePill label={periodLabel(mode, period, todayKey)} onPress={() => setChoosing(true)} />
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
          <AppText accessibilityRole="header" style={styles.dayLabel}>
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
                  ? `Nothing logged this ${mode}. Tap Log below to add an entry.`
                  : `Nothing of this kind this ${mode}.`}
            </AppText>
          </View>
        }
      />

      <RangeSheet
        visible={choosing}
        title={`Choose a ${mode}`}
        choices={recentPeriods(mode, todayKey, CHOICE_COUNT[mode])}
        current={period}
        onPick={(next) => {
          setPeriod(next);
          setChoosing(false);
        }}
        onClose={() => setChoosing(false)}
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
