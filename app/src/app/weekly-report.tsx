import { useLocalSearchParams } from 'expo-router';
import { Lightbulb, Moon } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Belly } from '@/components/Belly';
import { Screen } from '@/components/Screen';
import { MealSection } from '@/components/stats/MealSection';
import { ReportNote } from '@/components/stats/ReportNote';
import { useSettings } from '@/db/DatabaseProvider';
import { useInsight } from '@/hooks/useInsight';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { friendlyMessages } from '@/lib/errors';
import { buildInsightRequest } from '@/lib/insight';
import { localDayKey } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { spanLabel } from '@/lib/range';
import { currentTimeZone } from '@/lib/time';
import { satCount, watchCount } from '@/lib/weeklyReport';
import { cardEdge, radius, space, useColors } from '@/theme';

/**
 * "Your week with Bellie" (Figma row 42): the foods symptoms often followed, the foods that sat well, when the
 * symptoms came and one thing to try. Opened from Today, from History's week card and from the Sunday notification;
 * `?week=<Sunday>` picks the week, otherwise it is the newest one that has ended. What it says is what was noticed,
 * never what caused it. The tip is the week's AI summary, so it is left out when that is off or has nothing to say.
 */
export default function WeeklyReportScreen() {
  const colors = useColors();
  const { week } = useLocalSearchParams<{ week?: string }>();
  const { loaded, failed } = useWeeklyReport(week);
  const { settings, update } = useSettings();
  const request = useMemo(() => (loaded ? buildInsightRequest('week', loaded.weekEntries) : null), [loaded]);
  const insight = useInsight('week', loaded?.period.startKey ?? '', request);

  const todayKey = localDayKey(new Date().toISOString(), currentTimeZone());

  // Opening the report of a finished week, with something in it, is what clears the row on Today. A week still
  // going (opened from History) is left alone, or its own report would never be offered when it ends.
  const startKey = loaded?.period.startKey;
  const ended = loaded ? loaded.period.endKey < todayKey : false;
  const hasContent = loaded?.report.hasContent ?? false;
  useEffect(() => {
    if (!startKey || !ended || !hasContent || startKey <= settings.reportSeenWeek) return;
    try {
      update('reportSeenWeek', startKey);
    } catch (error) {
      logger.error('saveReportSeen', error);
    }
  }, [startKey, ended, hasContent, settings.reportSeenWeek, update]);

  const tip = insight?.tips[0];

  return (
    <Screen style={styles.screen}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <AppText variant="display" accessibilityRole="header">
            Your week with Bellie
          </AppText>
          {loaded && (
            <AppText variant="voice" color="inkSoft">
              {spanLabel(loaded.period, todayKey)}
            </AppText>
          )}
        </View>

        {failed && !loaded ? (
          <AppText color="inkSoft">{`${friendlyMessages.INTERNAL} Your log is still on this phone.`}</AppText>
        ) : loaded && !loaded.report.hasContent ? (
          <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <AppText variant="displaySmall" accessibilityRole="header">
              {loaded.report.mealsNeeded > 0 ? 'Not enough yet' : 'Nothing stands out yet'}
            </AppText>
            <AppText variant="caption" color="inkSoft">
              {loaded.report.mealsNeeded > 0
                ? `${loaded.report.mealsNeeded} more ${loaded.report.mealsNeeded === 1 ? 'meal' : 'meals'} with a check-in`
                : 'Keep logging'}
            </AppText>
            <View style={styles.empty}>
              <Belly mood="happy" size={96} />
              <AppText variant="voiceSmall" style={styles.centered}>
                {loaded.report.mealsNeeded > 0
                  ? 'Then Bellie can start spotting what to watch.'
                  : 'Bellie will tell you when something does.'}
              </AppText>
            </View>
          </View>
        ) : loaded ? (
          <>
            {(loaded.report.watch.length > 0 || loaded.report.sat.length > 0) && (
              <View
                style={[styles.card, styles.foods, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
                {loaded.report.sat.length > 0 && (
                  <MealSection
                    label="Foods that sat well"
                    state="calm"
                    rows={loaded.report.sat}
                    count={satCount}
                    spoken={(meal) =>
                      `${meal.name}, eaten ${meal.times === 1 ? 'once' : `${meal.times} times`}, no symptoms after`
                    }
                  />
                )}
                {loaded.report.watch.length > 0 && (
                  <MealSection
                    label="Foods that didn't sit well"
                    state="some"
                    rows={loaded.report.watch}
                    count={watchCount}
                    spoken={(meal) =>
                      `${meal.name}, symptoms after ${meal.withSymptoms} of ${meal.times} ${meal.times === 1 ? 'time' : 'times'}`
                    }
                  />
                )}
              </View>
            )}
            {loaded.report.whenText && (
              <ReportNote
                icon={Moon}
                tint="sageTint"
                ink="sageInk"
                title="When it shows up"
                body={loaded.report.whenText}
              />
            )}
            {tip ? (
              <ReportNote
                icon={Lightbulb}
                tint="honeyTint"
                ink="honeyInk"
                title="One thing to try"
                body={tip}
              />
            ) : null}
          </>
        ) : null}

        <AppText variant="caption" color="inkMuted" style={styles.note}>
          Ideas, not medical advice.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  content: { paddingTop: space.s2, paddingBottom: space.s5, gap: space.s3 },
  heading: { gap: space.s1 },
  card: { borderRadius: radius.lg, padding: space.s2 + 4, gap: space.s1 },
  foods: { gap: space.s2 + 4 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.s1_5, paddingVertical: space.s3 },
  centered: { textAlign: 'center' },
  note: { textAlign: 'center' },
});
