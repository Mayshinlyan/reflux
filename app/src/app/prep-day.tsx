import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChevronLeft, Snowflake } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TickRow } from '@/components/kitchen/TickRow';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { TopBarButton } from '@/components/TopBar';
import { useDb } from '@/db/DatabaseProvider';
import { getCurrentPlan } from '@/db/repositories/mealPlans';
import { getPlanChecks, setChecked } from '@/db/repositories/planChecks';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { todayKey } from '@/lib/kitchen';
import { logger } from '@/lib/logger';
import { prepDay, prepDayName, prepDishes, prepSteps, prepSummary, storingLines } from '@/lib/prep';
import { cancelPrepReminder, schedulePrepReminder } from '@/services/reminders';
import { cardEdge, radius, space, useColors } from '@/theme';

/**
 * The prep day of a cook-once plan (Figma "meal planning flow" E2): every dish's steps in the order to do them, each
 * ticked off as it is done, where to store the dishes, and a switch to be reminded that morning. Opened from the plan.
 */
export default function PrepDayScreen() {
  const db = useDb();
  const colors = useColors();
  const plan = useMemo(() => getCurrentPlan(db), [db]);
  const [ticked, setTicked] = useState<Set<string>>(() =>
    plan ? getPlanChecks(db, plan.id).prep : new Set(),
  );
  const [remind, setRemind] = useState(() => !!plan && getSetting(db, 'prepReminderPlan') === plan.id);
  const [note, setNote] = useState('');

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const today = todayKey();
  const dishes = plan ? prepDishes(plan.meals, today) : [];

  if (!plan || plan.mode !== 'once' || dishes.length === 0) {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <TopBarButton icon={ChevronLeft} label="Back" onPress={goBack} />
        </View>
        <AppText variant="display" accessibilityRole="header">
          Prep day
        </AppText>
        <AppText color="inkSoft" style={styles.empty}>
          A plan where you cook once has a prep day. Yours cooks every day, so there is nothing to prep.
        </AppText>
      </Screen>
    );
  }

  const cookDay = prepDay(plan.meals, plan.weekStart, today);
  const dayName = prepDayName(cookDay);
  const steps = prepSteps(dishes);
  const storing = storingLines(dishes, cookDay);

  const toggle = (key: string) => {
    const next = !ticked.has(key);
    try {
      setChecked(db, plan.id, 'prep', key, next);
      setTicked((was) => {
        const copy = new Set(was);
        if (next) copy.add(key);
        else copy.delete(key);
        return copy;
      });
      Haptics.selectionAsync().catch(() => {});
    } catch (error) {
      logger.error('tickPrepStep', error);
    }
  };

  const toggleReminder = async (on: boolean) => {
    setNote('');
    try {
      if (!on) {
        await cancelPrepReminder();
        setSetting(db, 'prepReminderPlan', null);
        setRemind(false);
        return;
      }
      const result = await schedulePrepReminder(cookDay);
      if (result === 'scheduled') {
        setSetting(db, 'prepReminderPlan', plan.id);
        setRemind(true);
      } else {
        setNote(
          result === 'denied'
            ? 'Allow notifications for this app in your phone settings to get a reminder.'
            : result === 'past'
              ? 'That time has already passed.'
              : 'The reminder could not be set. Try again.',
        );
      }
    } catch (error) {
      logger.error('prepReminder', error);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TopBarButton icon={ChevronLeft} label="Back" onPress={goBack} />
          <View style={styles.titleBlock}>
            <AppText variant="display" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
              {dayName} prep
            </AppText>
            <AppText variant="voiceSmall" color="inkSoft">
              {prepSummary(dishes, plan.choices.prepMinutes)}
            </AppText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          {steps.map((step, index) => (
            <TickRow
              key={step.key}
              label={step.text}
              caption={step.caption}
              checked={ticked.has(step.key)}
              shape="circle"
              divider={index > 0}
              onToggle={() => toggle(step.key)}
            />
          ))}
        </View>

        {storing.length > 0 && (
          <View style={[styles.storing, { backgroundColor: colors.honeyTint }]}>
            <View style={styles.storingTitle}>
              <Snowflake size={20} color={colors.honeyInk} strokeWidth={2} />
              <AppText variant="bodyEm" accessibilityRole="header" style={{ color: colors.honeyInk }}>
                Storing it
              </AppText>
            </View>
            {storing.map((line) => (
              <AppText key={line} color="inkSoft">
                {line}
              </AppText>
            ))}
          </View>
        )}

        <View style={[styles.remind, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <View style={styles.remindText}>
            <AppText>Remind me on {dayName}</AppText>
            <AppText variant="caption" color="inkMuted">
              At 10:00 am
            </AppText>
          </View>
          <Toggle
            value={remind}
            onValueChange={(on) => void toggleReminder(on)}
            accessibilityLabel={`Remind me on ${dayName}`}
          />
        </View>
        {note ? (
          <AppText variant="caption" color="inkSoft" accessibilityRole="alert">
            {note}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.bg }]}>
        <Button label="Done cooking" onPress={goBack} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginBottom: space.s1 },
  titleBlock: { flex: 1, gap: 4 },
  content: { gap: space.s3, paddingBottom: space.s3 },
  empty: { marginTop: space.s1 },
  card: { borderRadius: radius.lg, paddingHorizontal: space.s2, paddingVertical: space.s1 },
  storing: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  storingTitle: { flexDirection: 'row', alignItems: 'center', gap: space.s1 },
  remind: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    borderRadius: radius.md,
    paddingHorizontal: space.s2,
    paddingVertical: space.s1,
  },
  remindText: { flex: 1 },
  footer: { paddingTop: space.s1, paddingBottom: space.s3 },
});
