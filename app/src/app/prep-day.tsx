import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChevronLeft, Snowflake } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FoodLoading } from '@/components/FoodLoading';
import { TickRow } from '@/components/kitchen/TickRow';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { TopBarButton } from '@/components/TopBar';
import { useDb } from '@/db/DatabaseProvider';
import { getCurrentPlan } from '@/db/repositories/mealPlans';
import { getPlanChecks, setChecked } from '@/db/repositories/planChecks';
import { getPrepPlan, savePrepPlan } from '@/db/repositories/planPrep';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { AppError } from '@/lib/errors';
import { todayKey } from '@/lib/kitchen';
import { logger } from '@/lib/logger';
import { prepDay, prepDayName, prepDishes, prepSummary, storingLines } from '@/lib/prep';
import { buildPrepRequest, prepAliases, prepFitsDishes, prepSections, prepSignature } from '@/lib/prepPlan';
import { fetchPrepPlan } from '@/services/relayClient';
import { cancelPrepReminder, schedulePrepReminder } from '@/services/reminders';
import { cardEdge, radius, space, useColors } from '@/theme';
import type { PrepPlanResult } from '@/types/prepPlan';

type Status = 'loading' | 'ready' | 'failed';

/**
 * The prep day of a cook-once plan (Figma "meal planning flow" E2b and E2c). The relay sees every dish at once and
 * puts them into one efficient session: "Start together" (what the dishes share), each dish's own steps under its
 * title, and "Finish together". The first time it is opened, the pot loader shows while that is worked out; it is
 * kept, and made again only if the dishes change. If it cannot be made, each dish is listed on its own. Steps tick
 * off as they are done, and a switch asks for a reminder on the cooking day.
 */
export default function PrepDayScreen() {
  const db = useDb();
  const colors = useColors();
  const today = todayKey();
  const plan = useMemo(() => getCurrentPlan(db), [db]);
  const dishes = useMemo(() => (plan ? prepDishes(plan.meals, today) : []), [plan, today]);
  const aliases = useMemo(() => prepAliases(dishes), [dishes]);
  const signature = useMemo(() => prepSignature(dishes), [dishes]);

  const [result, setResult] = useState<PrepPlanResult | null>(() =>
    plan && dishes.length > 0 ? getPrepPlan(db, plan.id, signature) : null,
  );
  // One dish has nothing to share, so it never asks the relay.
  const [status, setStatus] = useState<Status>(() =>
    result || dishes.length < 2 || !plan ? 'ready' : 'loading',
  );
  const [ticked, setTicked] = useState<Set<string>>(() =>
    plan ? getPlanChecks(db, plan.id).prep : new Set(),
  );
  const [remind, setRemind] = useState(() => !!plan && getSetting(db, 'prepReminderPlan') === plan.id);
  const [note, setNote] = useState('');
  const running = useRef<AbortController | null>(null);
  const started = useRef(false);

  const planId = plan?.id;
  const prepMinutes = plan?.choices.prepMinutes ?? 120;

  const load = useCallback(async () => {
    if (planId === undefined) return;
    const controller = new AbortController();
    running.current = controller;
    setStatus('loading');
    try {
      const answer = await fetchPrepPlan(buildPrepRequest(dishes, prepMinutes), controller.signal);
      if (controller.signal.aborted) return;
      if (!prepFitsDishes(answer, aliases)) throw new AppError('AI_INVALID_OUTPUT');
      savePrepPlan(db, planId, signature, answer);
      setResult(answer);
      setStatus('ready');
    } catch (error) {
      if (controller.signal.aborted) return;
      logger.error('prepPlan', error);
      setStatus('failed');
    }
  }, [aliases, db, dishes, planId, prepMinutes, signature]);

  useEffect(() => {
    if (status === 'loading' && !started.current) {
      started.current = true;
      void load();
    }
    return () => {
      running.current?.abort();
      // So a remount (strict mode) asks again instead of waiting on an answer that was cancelled.
      started.current = false;
    };
    // Only the first ask: later ones come from "Try again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

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
  const summary = prepSummary(dishes, plan.choices.prepMinutes);

  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <TopBarButton icon={ChevronLeft} label="Back" onPress={goBack} />
          <View style={styles.titleBlock}>
            <AppText variant="display" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
              Prep day
            </AppText>
            <AppText variant="voiceSmall" color="inkSoft">
              {summary}
            </AppText>
          </View>
        </View>
        <View style={styles.loading}>
          <FoodLoading
            source="prep"
            note="Planning the quickest order for all your dishes. About 15 seconds, and only the first time."
          />
        </View>
      </Screen>
    );
  }

  const sections = prepSections(dishes, signature, status === 'ready' ? result : null, aliases);
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
      const outcome = await schedulePrepReminder(cookDay);
      if (outcome === 'scheduled') {
        setSetting(db, 'prepReminderPlan', plan.id);
        setRemind(true);
      } else {
        setNote(
          outcome === 'denied'
            ? 'Allow notifications for this app in your phone settings to get a reminder.'
            : outcome === 'past'
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
              Prep day
            </AppText>
            <AppText variant="voiceSmall" color="inkSoft">
              {summary}
            </AppText>
          </View>
        </View>

        {status === 'failed' && (
          <View style={[styles.notice, { backgroundColor: colors.honeyTint }]}>
            <AppText color="inkSoft">
              The steps could not be lined up, so each dish is listed on its own.
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try lining up the steps again"
              onPress={() => void load()}
              hitSlop={8}
              style={styles.link}>
              <AppText variant="bodyEm" style={styles.underline}>
                Try again
              </AppText>
            </Pressable>
          </View>
        )}

        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHead}>
              <AppText variant="displaySmall" accessibilityRole="header">
                {section.title}
              </AppText>
              {section.meta ? (
                <AppText variant="caption" color="inkMuted">
                  {section.meta}
                </AppText>
              ) : null}
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
              {section.steps.map((step, index) => (
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
          </View>
        ))}

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
  loading: { flex: 1, justifyContent: 'center', paddingBottom: 72 },
  empty: { marginTop: space.s1 },
  notice: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  link: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  section: { gap: space.s1_5 },
  sectionHead: { gap: 2 },
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
