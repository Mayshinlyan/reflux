import { router, useFocusEffect } from 'expo-router';
import { Infinity as InfinityIcon } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Animated, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { DateRangePicker } from '@/components/DateRangePicker';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { HistorySummary, statsCardHeight, statsScrollDistance } from '@/components/HistorySummary';
import { ProfileButton } from '@/components/ProfileButton';
import { RangeStepper } from '@/components/RangeStepper';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Select } from '@/components/Select';
import { TimelineItem } from '@/components/TimelineItem';
import { VerdictBadge } from '@/components/VerdictBadge';
import { useDb } from '@/db/DatabaseProvider';
import { earliestEntryDayKey } from '@/db/repositories/data';
import { listDiaryFoodLogs, listMealTagsFor } from '@/db/repositories/food';
import { listMedicationLogs } from '@/db/repositories/medications';
import { listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import type { LoggedTagKey } from '@/constants/lifestyleTags';
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

/** The entries sit faded under the stats card and reach full strength once it has scrolled away (Figma 04a). */
const FADED = 0.4;
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as unknown as typeof SectionList;

const todayKeyNow = () => localDayKey(new Date().toISOString(), currentTimeZone());

/** The warm line under "History" (Figma 04a), like the date under Today's greeting. */
function subtitleFor(kind: Kind, current: boolean): string {
  if (kind === 'all') return 'Everything so far';
  if (kind === 'custom') return 'The dates you picked';
  const unit = kind === 'month' ? 'month' : 'week';
  return current ? `Here's how your ${unit} went` : `Here's how that ${unit} went`;
}

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
  const [mealTags, setMealTags] = useState<ReadonlyMap<number, readonly LoggedTagKey[]>>(new Map());
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
      const loaded = loadPeriod(db, period);
      setSections(loaded);
      setMealTags(
        listMealTagsFor(
          db,
          loaded.flatMap((section) =>
            section.entries.filter((entry) => entry.kind === 'food').map((entry) => entry.id),
          ),
        ),
      );
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
        mealTags,
      ),
    [sections, mealTags],
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

  // The entries fade in as the list scrolls. A list too short to scroll that far is never faded.
  const [scrollY] = useState(() => new Animated.Value(0));
  const [room, setRoom] = useState({ content: 0, view: 0 });
  const scrollable = room.content - room.view;
  // The card fills the list from below the title and controls down to just above the floating tab bar.
  const [above, setAbove] = useState(0);
  const insets = useSafeAreaInsets();
  const cardHeight = statsCardHeight(room.view, above, insets.bottom);
  const statsScroll = statsScrollDistance(cardHeight);
  const fade = useMemo(
    () =>
      scrollable <= 0
        ? 1
        : scrollY.interpolate({
            inputRange: [0, Math.min(statsScroll, scrollable)],
            outputRange: [FADED, 1],
            extrapolate: 'clamp',
          }),
    [scrollY, scrollable, statsScroll],
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
      <AnimatedSectionList
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onLayout={(event) => {
          // Read it now: the event is cleared before a state updater runs.
          const { height } = event.nativeEvent.layout;
          setRoom((r) => ({ ...r, view: height }));
        }}
        onContentSizeChange={(_, height) => setRoom((r) => ({ ...r, content: height }))}
        sections={shown.map((section) => ({ ...section, data: section.entries }))}
        keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
        ListHeaderComponent={
          <View>
            <View
              onLayout={(event) => {
                // Read it now: the event is cleared before a state updater runs.
                const { height } = event.nativeEvent.layout;
                setAbove(height);
              }}>
              <View style={styles.header}>
                <View style={styles.heading}>
                  <AppText variant="display" accessibilityRole="header">
                    History
                  </AppText>
                  <AppText variant="voiceSmall" color="inkSoft">
                    {subtitleFor(kind, isCurrent(period, todayKey))}
                  </AppText>
                </View>
                <ProfileButton />
              </View>
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
            </View>
            <HistorySummary summary={summary} height={cardHeight} />
            <View style={styles.entriesHead}>
              <AppText variant="section" accessibilityRole="header">
                Entries
              </AppText>
              <Select options={FILTERS} value={filter} onChange={setFilter} label="Show" />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Animated.View style={{ opacity: fade }}>
            <AppText variant="section" accessibilityRole="header" style={styles.dayLabel}>
              {section.label}
            </AppText>
          </Animated.View>
        )}
        renderItem={({ item }) => (
          <Animated.View style={{ opacity: fade }}>
            <TimelineItem
              kind={item.kind}
              lifestyle={item.kind === 'symptom' && item.lifestyleOnly}
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
          </Animated.View>
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance(insets.bottom) }]}
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2, marginBottom: space.s4 },
  heading: { flex: 1, gap: space.s1 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Wraps under the switcher on a narrow phone instead of squashing.
    flexWrap: 'wrap',
    gap: space.s2,
    marginBottom: space.s4,
  },
  entriesHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: space.s4,
    marginBottom: 12,
  },
  // The row above a label already leaves 12, so the label adds 20 to make the 32 between days.
  dayLabel: { marginTop: space.s4 - 12, marginBottom: 12 },
  list: { flexGrow: 1 },
  empty: { alignItems: 'center', paddingHorizontal: space.s3, paddingTop: space.s4 },
  emptyTitle: { marginBottom: space.s1 },
  emptyBody: { textAlign: 'center' },
});
