import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { HomeBellie } from '@/components/HomeBellie';
import { InsightCards } from '@/components/InsightCards';
import { LateMealBadge } from '@/components/LateMealBadge';
import { ReminderPromptSheet } from '@/components/ReminderPromptSheet';
import { Screen } from '@/components/Screen';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { TimelineItem } from '@/components/TimelineItem';
import { VerdictBadge } from '@/components/VerdictBadge';
import { WeekStrip } from '@/components/WeekStrip';
import { useSettings } from '@/db/DatabaseProvider';
import { useDeleteEntry } from '@/hooks/useDeleteEntry';
import { useInsight } from '@/hooks/useInsight';
import { useReminderPrompt } from '@/hooks/useReminderPrompt';
import { useTodayData } from '@/hooks/useTodayData';
import { useTourAutoStart } from '@/hooks/useTourAutoStart';
import { bellyMoodFor } from '@/lib/belly';
import { notifyEntriesChanged } from '@/lib/entriesChanged';
import { buildInsightRequest } from '@/lib/insight';
import { isLateMeal } from '@/lib/mealTiming';
import { space } from '@/theme';

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Today: a greeting, this week, and a big Bellie under a speech bubble with her line about the day. Tapping
 * Bellie opens the Food screen. Under her, swipeable cards (Today so far, Tips, This week) from Bellie's
 * summaries, then today's entries. The round button beside the greeting opens Profile. First launch redirects
 * to Welcome.
 */
export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { todayKey, week, loggedDays, entries, weekEntries, meals } = useTodayData();
  // Bellie's words: made on the phone at once, then the AI's once they arrive (and only asked for again when
  // what was logged changes).
  const dayRequest = useMemo(() => buildInsightRequest('day', entries), [entries]);
  const weekRequest = useMemo(() => buildInsightRequest('week', weekEntries), [weekEntries]);
  const dayInsight = useInsight('day', todayKey, dayRequest);
  const weekInsight = useInsight('week', week[0]?.key ?? todayKey, weekRequest);
  const reminder = useReminderPrompt();
  // Today reloads on this signal, so a delete (and its Undo) shows at once.
  const deleteEntry = useDeleteEntry(notifyEntriesChanged);
  const now = new Date();
  const [picked, setPicked] = useState<string | null>(null);
  /** The Log page is opening from Bellie: a second tap before Today leaves would open it twice. */
  const opening = useRef(false);

  // Short phones (iPhone SE) can't spare the roomier top gap.
  const { height } = useWindowDimensions();

  // The first visit (and Settings' "Replay app tour") dims Today and points things out; the spotlights need the top in view.
  const scroll = useRef<ScrollViewInstance>(null);
  const showTop = useCallback(() => scroll.current?.scrollTo({ y: 0, animated: false }), []);
  useTourAutoStart(settings.onboardingDone, showTop);

  // Back from Log, the strip is plain again and Bellie can be tapped again.
  useFocusEffect(
    useCallback(() => {
      setPicked(null);
      opening.current = false;
    }, []),
  );

  // Log opens on the tap. A past day stays highlighted while it opens, and a second tap is ignored.
  const pickDay = (date: string, today: string) => {
    if (picked) return;
    if (date !== today) setPicked(date);
    router.push({ pathname: '/log', params: { date } });
  };

  if (!settings.onboardingDone) return <Redirect href="/welcome" />;

  const empty = entries.length === 0;
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

        <WeekStrip
          days={week}
          loggedDays={loggedDays}
          pickedKey={picked}
          onPressDay={(date) => pickDay(date, week.find((day) => day.isToday)?.key ?? '')}
        />

        <View style={[styles.bellie, empty && styles.bellieEmpty]}>
          <HomeBellie
            line={dayInsight?.bellieLine ?? 'Tap me to log'}
            mood={mood}
            onPress={() => {
              if (opening.current) return;
              opening.current = true;
              router.push({ pathname: '/log', params: { date: week.find((day) => day.isToday)?.key ?? '' } });
            }}
          />
        </View>

        <InsightCards today={dayInsight} week={weekInsight} />

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
  bellie: { alignItems: 'center' },
  // On an empty day Bellie sits in the middle of the room left under the week.
  bellieEmpty: { flex: 1, justifyContent: 'center' },
  today: { gap: space.s1_5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badges: { gap: 4, alignItems: 'flex-end' },
});
