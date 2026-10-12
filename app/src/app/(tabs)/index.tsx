import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { HomeRing } from '@/components/HomeRing';
import { LateMealBadge } from '@/components/LateMealBadge';
import { Screen } from '@/components/Screen';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { TimelineItem } from '@/components/TimelineItem';
import { VerdictBadge } from '@/components/VerdictBadge';
import { WeekStrip } from '@/components/WeekStrip';
import { useSettings } from '@/db/DatabaseProvider';
import { useTodayData } from '@/hooks/useTodayData';
import { bellyMoodFor } from '@/lib/belly';
import { isLateMeal } from '@/lib/mealTiming';
import { space } from '@/theme';

/** How long the tapped day stays highlighted before Log opens (Figma 02c). */
const PICK_HOLD_MS = 600;

/** Today's entries sit faded under the ring and reach full strength once the ring has scrolled away. */
const FADED = 0.4;

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Today: a greeting, this week, and a ring with one arc per meal logged today, the belly in the middle.
 * Tapping the belly opens the Log page; after logging, today's entries list below the ring.
 * First launch redirects to Welcome.
 */
export default function TodayScreen() {
  const { settings } = useSettings();
  const { week, loggedDays, entries, meals } = useTodayData();
  const now = new Date();
  const [picked, setPicked] = useState<string | null>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The entries fade in as the page scrolls. A page too short to scroll that far is never faded.
  const [scrollY] = useState(() => new Animated.Value(0));
  const [room, setRoom] = useState({ content: 0, view: 0 });
  const [entriesY, setEntriesY] = useState(0);
  const scrollable = room.content - room.view;
  const fade = useMemo(
    () =>
      scrollable <= 0 || entriesY <= 0
        ? 1
        : scrollY.interpolate({
            inputRange: [0, Math.min(entriesY, scrollable)],
            outputRange: [FADED, 1],
            extrapolate: 'clamp',
          }),
    [scrollY, scrollable, entriesY],
  );

  // Back from Log, the strip is plain again; leaving Today (another tab) drops a pending pick.
  useFocusEffect(
    useCallback(() => {
      setPicked(null);
      return () => clearTimeout(pickTimer.current);
    }, []),
  );

  const pickDay = (date: string, today: string) => {
    if (picked) return;
    if (date === today) {
      router.push({ pathname: '/log', params: { date } });
      return;
    }
    setPicked(date);
    pickTimer.current = setTimeout(() => router.push({ pathname: '/log', params: { date } }), PICK_HOLD_MS);
  };

  if (!settings.onboardingDone) return <Redirect href="/welcome" />;

  const empty = entries.length === 0;
  // The belly feels the latest meal; with no meal yet it is happy.
  const mood = bellyMoodFor(meals[meals.length - 1]?.verdict);

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <Animated.ScrollView
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
        contentContainerStyle={[styles.content, empty && styles.grow]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.greeting}>
          <AppText variant="display" accessibilityRole="header">
            {settings.userName ? `${greeting(now)}, ${settings.userName}` : greeting(now)}
          </AppText>
          <AppText variant="voiceSmall" color="inkSoft">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </AppText>
        </View>

        <WeekStrip
          days={week}
          loggedDays={loggedDays}
          pickedKey={picked}
          onPressDay={(date) => pickDay(date, week.find((day) => day.isToday)?.key ?? '')}
        />

        <View style={[styles.ring, empty && styles.ringEmpty]}>
          <HomeRing meals={meals} mood={mood} onPress={() => router.push('/log')} />
        </View>

        {!empty && (
          <View
            style={styles.today}
            onLayout={(event) => {
              const { y } = event.nativeEvent.layout;
              setEntriesY(y);
            }}>
            <View style={styles.sectionHeader}>
              <AppText variant="title" accessibilityRole="header">
                Today
              </AppText>
              <AppText variant="caption" color="inkSoft">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </AppText>
            </View>
            <Animated.View style={{ opacity: fade }}>
              {entries.map((entry) => (
                <TimelineItem
                  key={`${entry.kind}-${entry.id}`}
                  kind={entry.kind}
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
                  onPress={() => router.push('/history')}
                />
              ))}
            </Animated.View>
          </View>
        )}
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 58 - space.s2 },
  content: { gap: space.s3, paddingBottom: TAB_BAR_CLEARANCE },
  grow: { flexGrow: 1 },
  greeting: { gap: space.s1 },
  ring: { alignItems: 'center' },
  // On an empty day the ring sits in the middle of the room left under the week.
  ringEmpty: { flex: 1, justifyContent: 'center' },
  today: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badges: { gap: 4, alignItems: 'flex-end' },
});
