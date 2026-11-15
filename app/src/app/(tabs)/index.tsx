import { Redirect, router } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { HomeBellie } from '@/components/HomeBellie';
import { LateMealBadge } from '@/components/LateMealBadge';
import { PlannedMealCard } from '@/components/kitchen/PlannedMealCard';
import { SwapOfferSheet } from '@/components/kitchen/SwapOfferSheet';
import { ReminderPromptSheet } from '@/components/ReminderPromptSheet';
import { ReportRow } from '@/components/ReportRow';
import { Screen } from '@/components/Screen';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { TimelineItem } from '@/components/TimelineItem';
import { CheckingBadge, VerdictBadge } from '@/components/VerdictBadge';
import { WeekStrip } from '@/components/WeekStrip';
import { useSettings } from '@/db/DatabaseProvider';
import { useDeleteEntry } from '@/hooks/useDeleteEntry';
import { useInsight } from '@/hooks/useInsight';
import { usePlanToday } from '@/hooks/usePlanToday';
import { useReminderPrompt } from '@/hooks/useReminderPrompt';
import { useTodayData } from '@/hooks/useTodayData';
import { useReportStatus } from '@/hooks/useWeeklyReport';
import { useTourAutoStart } from '@/hooks/useTourAutoStart';
import { bellyMoodFor } from '@/lib/belly';
import { notifyEntriesChanged } from '@/lib/entriesChanged';
import { buildInsightRequest } from '@/lib/insight';
import { openLogArch, useLogArch } from '@/lib/logArch';
import { isLateMeal } from '@/lib/mealTiming';
import { triggerName } from '@/lib/planToday';
import { isChecking } from '@/services/pendingChecks';
import { space } from '@/theme';

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Today: a greeting, this week, and a big Bellie under a speech bubble with her line about the day (Figma row
 * 22), then today's entries. Bellie and a day in the week strip open the quick log arch, the same one the +
 * button opens; a tapped day stays highlighted while it is open and the flow logs for that day. The week's own
 * summary lives in History. First launch redirects to Welcome.
 */
export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { todayKey, week, loggedDays, entries, meals } = useTodayData();
  // Bellie's words: made on the phone at once, then the AI's once they arrive (and only asked for again when
  // what was logged changes).
  const dayRequest = useMemo(() => buildInsightRequest('day', entries), [entries]);
  const dayInsight = useInsight('day', todayKey, dayRequest);
  const reminder = useReminderPrompt();
  // Whether a finished week's report is waiting, and how many meals the first one still needs.
  const report = useReportStatus();
  // The next meal of the week plan, when they chose to be offered it, and the "felt off" swap offer.
  const planned = usePlanToday();
  // Today reloads on this signal, so a delete (and its Undo) shows at once.
  const deleteEntry = useDeleteEntry(notifyEntriesChanged);
  const now = new Date();
  // A past day stays highlighted while the arch is open for it.
  const arch = useLogArch();
  const picked = arch.open && arch.date && arch.date !== todayKey ? arch.date : null;

  // Short phones (iPhone SE) can't spare the roomier top gap.
  const { height } = useWindowDimensions();

  // The first visit (and Settings' "Replay app tour") dims Today and points things out; the spotlights need the top in view.
  const scroll = useRef<ScrollViewInstance>(null);
  const showTop = useCallback(() => scroll.current?.scrollTo({ y: 0, animated: false }), []);
  useTourAutoStart(settings.onboardingDone, showTop);

  if (!settings.onboardingDone) return <Redirect href="/welcome" />;

  const empty = entries.length === 0;
  // Until there are enough meals for a first report, Bellie says how many more it takes (Figma 42e), in place of her
  // line about the day.
  const bellieLine =
    report.mealsNeeded > 0
      ? `${report.mealsNeeded} more ${report.mealsNeeded === 1 ? 'meal' : 'meals'} and I can start spotting patterns.`
      : (dayInsight?.bellieLine ?? 'Tap me to log');
  // The belly feels the latest meal; with no meal yet it is happy.
  const mood = bellyMoodFor(meals[meals.length - 1]?.verdict);

  return (
    <Screen edges={['top', 'left', 'right']} style={height < 700 ? styles.screenShort : styles.screen}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarClearance(insets.bottom) },
          empty && styles.grow,
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.greeting}>
            <AppText variant="display" accessibilityRole="header">
              {settings.userName ? `${greeting(now)}, ${settings.userName}` : greeting(now)}
            </AppText>
            <AppText variant="voiceSmall" color="inkSoft">
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </AppText>
          </View>
        </View>

        <WeekStrip days={week} loggedDays={loggedDays} pickedKey={picked} onPressDay={openLogArch} />

        <View style={[styles.bellie, empty && styles.bellieEmpty]}>
          <HomeBellie line={bellieLine} mood={mood} onPress={() => openLogArch(todayKey)} />
        </View>

        {report.readyWeek && (
          <ReportRow
            onPress={() => router.push({ pathname: '/weekly-report', params: { week: report.readyWeek } })}
          />
        )}

        {planned.card && (
          <PlannedMealCard
            meal={planned.card}
            onLog={() => planned.logIt(planned.card!)}
            onNotToday={() => planned.notToday(planned.card!)}
          />
        )}

        {!empty && (
          <View style={styles.today}>
            <View style={styles.sectionHeader}>
              <AppText variant="section" accessibilityRole="header">
                Today
              </AppText>
              <AppText variant="caption" color="inkSoft">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </AppText>
            </View>
            <View>
              {entries.map((entry) => (
                <TimelineItem
                  key={`${entry.kind}-${entry.id}`}
                  kind={entry.kind}
                  lifestyle={entry.kind === 'symptom' && entry.lifestyleOnly}
                  title={entry.title}
                  time={entry.meta}
                  side={
                    entry.kind === 'food' ? (
                      <View style={styles.badges}>
                        {entry.log.overallVerdict && <VerdictBadge verdict={entry.log.overallVerdict} />}
                        {isChecking(entry.log) && <CheckingBadge />}
                        {isLateMeal(entry.at, entry.tz, settings.bedtime, settings.lateMealWindowMinutes) && (
                          <LateMealBadge />
                        )}
                      </View>
                    ) : undefined
                  }
                  onPress={() =>
                    router.push({ pathname: '/entry', params: { kind: entry.kind, id: String(entry.id) } })
                  }
                  onDelete={() => deleteEntry(entry)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      <SwapOfferSheet
        key={planned.offer?.meal.id ?? 'none'}
        offer={planned.offer}
        trigger={planned.offer ? triggerName(planned.offer.meal) : ''}
        onSwap={(note) => planned.offer && planned.swapNext(planned.offer, note)}
        onNotNow={() => planned.offer && planned.closeOffer(planned.offer)}
      />
      <ReminderPromptSheet
        visible={reminder.visible}
        onHide={reminder.hide}
        onYes={reminder.accept}
        onNotNow={reminder.decline}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 58 - space.s2 },
  screenShort: { paddingTop: space.s2 },
  content: { gap: space.s3 },
  grow: { flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  greeting: { flex: 1, gap: space.s1 },
  // Room under the week strip (24 on top of the content gap), so the days, the bubble and Bellie each have space.
  bellie: { alignItems: 'center', marginTop: space.s3 },
  // On an empty day Bellie sits in the middle of the room left under the week.
  bellieEmpty: { flex: 1, justifyContent: 'center', marginTop: 0 },
  today: { gap: space.s1_5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badges: { gap: 4, alignItems: 'flex-end' },
});
