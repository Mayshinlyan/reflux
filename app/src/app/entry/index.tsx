import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, Ellipsis, Heart, Pencil, Trash2 } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/ActionMenu';
import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { BackHeader } from '@/components/BackHeader';
import { VerdictHero, VerdictMore } from '@/components/food/FoodVerdict';
import { useToast } from '@/components/Toast';
import { TopBarButton } from '@/components/TopBar';
import { CheckingBadge, VerdictBadge } from '@/components/VerdictBadge';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { getFoodLog, listMealTags } from '@/db/repositories/food';
import { removeSavedFood, saveFoodFromLog, savedFoodIdByName } from '@/db/repositories/savedFoods';
import { listSymptomLogsForMeal } from '@/db/repositories/symptoms';
import { useDeleteEntry } from '@/hooks/useDeleteEntry';
import { onEntriesChanged } from '@/lib/entriesChanged';
import { type LoadedEntry, loadEntry } from '@/lib/entry';
import { logger } from '@/lib/logger';
import { formatWhen } from '@/lib/localDay';
import { isLateMeal } from '@/lib/mealTiming';
import { possibleCauses } from '@/lib/possibleCauses';
import { medicationTypeLabel, symptomLabel, tagLabel } from '@/lib/timeline';
import { matchedTriggerLabels } from '@/lib/verdictReasons';
import { isChecking } from '@/services/pendingChecks';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';

/**
 * One diary entry in full (Figma 04b meal, 04f dose, 04h symptoms): a back arrow and a `…` menu on top, then the
 * entry's cards. It pushes in from the side like any drill-down, and swipes back from the edge. Edit and Delete live in the menu, so nothing else competes with what was logged.
 */
export default function EntryScreen() {
  const db = useDb();
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const load = useCallback((): LoadedEntry | undefined => {
    try {
      return loadEntry(db, params.kind, params.id);
    } catch (error) {
      // Treated like a missing entry: the screen explains it instead of crashing.
      logger.error('loadEntry', error);
      return undefined;
    }
  }, [db, params.kind, params.id]);
  const [entry, setEntry] = useState<LoadedEntry | undefined>(load);
  const [menuOpen, setMenuOpen] = useState(false);

  // Back from the editor lands here, so show what was just saved.
  useFocusEffect(
    useCallback(() => {
      setEntry(load());
    }, [load]),
  );

  const deleteEntry = useDeleteEntry(() => router.back());

  // A meal can be a favorite food: the heart saves it, and a second tap takes it out again. The heart is kept in
  // state rather than read from the database while drawing, so it flips the moment it is tapped.
  const toast = useToast();
  const [savedId, setSavedId] = useState<number | null>(() =>
    entry?.kind === 'food' ? savedFoodIdByName(db, entry.log.mealName) : null,
  );
  // Back from the editor the name may have changed, or the food was removed from Favorite foods elsewhere.
  useFocusEffect(
    useCallback(() => {
      const loaded = load();
      setSavedId(loaded?.kind === 'food' ? savedFoodIdByName(db, loaded.log.mealName) : null);
    }, [db, load]),
  );
  // A meal's verdict can land while this page is open (the check runs in the background): fill it in at once.
  // Keeping what is shown when it can't be loaded stops a delete (which also notifies) flashing "isn't here".
  // The heart is worked out again too, since a photo meal's name arrives with its verdict.
  useEffect(
    () =>
      onEntriesChanged(() => {
        const loaded = load();
        if (!loaded) return;
        setEntry(loaded);
        setSavedId(loaded.kind === 'food' ? savedFoodIdByName(db, loaded.log.mealName) : null);
      }),
    [db, load],
  );
  const toggleSaved = () => {
    if (entry?.kind !== 'food') return;
    try {
      if (savedId !== null) {
        removeSavedFood(db, savedId);
        setSavedId(null);
        toast('Removed from favorite foods');
      } else {
        setSavedId(saveFoodFromLog(db, entry.log.id).id);
        toast('Added to favorite foods');
      }
    } catch (error) {
      logger.error('toggleSavedFood', error);
      toast("We couldn't save that. Please try again.");
    }
  };

  const edit = () => {
    setMenuOpen(false);
    if (!entry) return;
    router.push(
      entry.kind === 'symptom'
        ? { pathname: '/log/symptoms', params: { id: String(entry.log.id) } }
        : { pathname: '/entry/edit', params: { kind: entry.kind, id: String(entry.log.id) } },
    );
  };
  const remove = () => {
    setMenuOpen(false);
    if (entry) deleteEntry({ kind: entry.kind, id: entry.log.id });
  };

  // A photo-only meal is called "Meal" until the check names it, so it can't be saved as a favorite yet.
  const awaitingName = entry?.kind === 'food' && !entry.log.inputText && isChecking(entry.log);

  if (!entry) {
    return (
      <Screen>
        <BackHeader />
        <View style={styles.missing}>
          <AppText variant="section" style={styles.missingTitle}>
            This entry isn&apos;t here any more
          </AppText>
          <AppText color="inkSoft" style={styles.missingBody}>
            It may have been deleted.
          </AppText>
          <Button label="Go back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader
        right={
          <View style={styles.topRight}>
            {entry.kind === 'food' && !awaitingName && (
              <TopBarButton
                icon={Heart}
                active={savedId !== null}
                label={savedId !== null ? 'Remove from favorite foods' : 'Add to favorite foods'}
                onPress={toggleSaved}
              />
            )}
            <TopBarButton icon={Ellipsis} label="More" onPress={() => setMenuOpen(true)} />
          </View>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {entry.kind === 'food' && <MealView log={entry.log} />}
        {entry.kind === 'symptom' && <SymptomView log={entry.log} />}
        {entry.kind === 'medication' && <DoseView log={entry.log} />}
      </ScrollView>

      <EntryMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: 'Edit entry', icon: Pencil, onPress: edit },
          { label: 'Delete entry', icon: Trash2, onPress: remove, destructive: true },
        ]}
      />
    </Screen>
  );
}

/** Figma 04c: the action menu floating under the `…` button, over a dimmed page. */
function EntryMenu({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: Parameters<typeof ActionMenu>[0]['items'];
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={styles.scrim}
      />
      {/* Just under the top bar: safe area, the screen's top padding, the 44pt bar and a small gap. */}
      <View pointerEvents="box-none" style={[styles.menuPos, { top: insets.top + space.s2 + 44 + space.s1 }]}>
        <ActionMenu items={items} />
      </View>
    </Modal>
  );
}

/** A titled block with no card of its own, for sections that sit together on one sheet. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="section" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

/** The one sheet that holds what was logged (symptoms, note). Nothing else sits on a card of its own. */
function Sheet({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <View style={[styles.sheet, { backgroundColor: colors.surface }]}>{children}</View>;
}

function NoteSheet({ notes }: { notes: string | null }) {
  return notes ? (
    <Sheet>
      <Section title="Note">
        <AppText variant="small">{notes}</AppText>
      </Section>
    </Sheet>
  ) : null;
}

/** Figma row 40: every entry opens the same way, with the name, when it happened and any tags, all centred. */
function EntryHeader({ title, when, tags = [] }: { title: string; when: string; tags?: string[] }) {
  return (
    <View style={styles.meal}>
      <AppText variant="display" accessibilityRole="header" style={styles.centered}>
        {title}
      </AppText>
      <AppText variant="small" color="inkSoft" style={styles.centered}>
        {when}
      </AppText>
      {tags.length > 0 && (
        <View style={[styles.chips, styles.centeredChips]}>
          {tags.map((label) => (
            <TagChip key={label} label={label} selected={false} readOnly />
          ))}
        </View>
      )}
    </View>
  );
}

/** A closed one-line card that opens to show more, the same as "Why?" on a meal. */
function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={[styles.disclosure, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.disclosureRow}>
        <AppText variant="sectionSm" style={styles.disclosureLabel}>
          {label}
        </AppText>
        <Chevron size={20} color={colors.inkSoft} strokeWidth={2} />
      </Pressable>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

function SymptomsSection({ keys }: { keys: string[] }) {
  return (
    <Section title="Symptoms">
      <View style={styles.chips}>
        {keys.map((key) => (
          <SymptomChip key={key} label={symptomLabel(key)} selected readOnly />
        ))}
      </View>
    </Section>
  );
}

function MealView({ log }: { log: Extract<LoadedEntry, { kind: 'food' }>['log'] }) {
  const db = useDb();
  const { settings } = useSettings();
  const late = isLateMeal(log.loggedAt, log.tz, settings.bedtime, settings.lateMealWindowMinutes);
  const lifestyle = listMealTags(db, log.id).map(tagLabel);
  const triggers = log.analysis ? matchedTriggerLabels(log.analysis, { late }) : late ? ['Late meal'] : [];
  const tags = [...new Set([...lifestyle, ...triggers])];
  const after = listSymptomLogsForMeal(db, log.id);
  const keys = [...new Set(after.flatMap((symptoms) => symptoms.items.map((item) => item.key)))];
  const { analysis } = log;
  const when = formatWhen(log.loggedAt, log.tz);
  const hasAfter = keys.length > 0 || Boolean(log.notes);
  const sheet = hasAfter ? (
    <Sheet>
      {keys.length > 0 && <SymptomsSection keys={keys} />}
      {log.notes ? (
        <Section title="Note">
          <AppText variant="small">{log.notes}</AppText>
        </Section>
      ) : null}
    </Sheet>
  ) : null;
  // Logged with "Just log it" and still being checked (Figma row 44): the real header, then skeleton blocks where
  // Bellie, the verdict, the reason and "Why?" will be. A typed meal already has its name; a photo's is on its way.
  if (!analysis && isChecking(log)) {
    return (
      <>
        {log.inputText ? (
          <EntryHeader title={log.mealName} when={when} tags={lifestyle} />
        ) : (
          <View style={styles.meal}>
            <Skeleton width={240} height={44} radius={12} />
            <AppText variant="small" color="inkSoft" style={styles.centered}>
              {when}
            </AppText>
          </View>
        )}
        <View style={styles.checkingBlock}>
          <Skeleton width={114} height={114} radius={57} />
          <CheckingBadge />
          <View style={styles.reasonLines}>
            <Skeleton width={300} height={16} />
            <Skeleton width={220} height={16} />
          </View>
        </View>
        {sheet}
        <WhySkeleton />
      </>
    );
  }
  // A meal with a stored verdict (Figma row 24, 24a, 40): the header, Bellie with the badge and the one-line
  // reason, what happened after the meal, and a closed "Why?" holding the tip and the reasons. Only what the user
  // picked themselves shows as tags; the reasons behind the verdict are under "Why?".
  if (analysis) {
    return (
      <>
        <EntryHeader title={log.mealName} when={when} tags={lifestyle} />
        <VerdictHero analysis={analysis} late={late} showTriggers={false} showBubble={false} />
        {sheet}
        <VerdictMore analysis={analysis} late={late} />
      </>
    );
  }
  // No stored verdict: the same header, then the same sheet.
  return (
    <>
      <EntryHeader title={log.mealName} when={when} tags={tags} />
      {log.overallVerdict ? (
        <View style={styles.centeredBlock}>
          <VerdictBadge verdict={log.overallVerdict} />
        </View>
      ) : null}
      {sheet}
    </>
  );
}

/** The open "Why?" card with skeleton lines where the tip and the reasons will be (Figma 44a). */
function WhySkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.whySkeleton, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <AppText variant="sectionSm">Why?</AppText>
      <View style={styles.whyLines}>
        <Skeleton width={96} height={16} />
        <Skeleton width="94%" height={16} />
        <Skeleton width="80%" height={16} />
        <Skeleton width="88%" height={16} />
        <Skeleton width="62%" height={16} />
      </View>
    </View>
  );
}

/** Figma 40a: the symptoms are the title, so they are not listed again; Bellie shows the meal they followed. */
function SymptomView({ log }: { log: Extract<LoadedEntry, { kind: 'symptom' }>['log'] }) {
  const db = useDb();
  const { settings } = useSettings();
  const meal = log.foodLogId !== null ? getFoodLog(db, log.foodLogId) : undefined;
  const tags = log.tags.map(tagLabel);
  // A check-in with no symptoms is named by its lifestyle factors, which then are not repeated as tags.
  const lifestyleOnly = log.items.length === 0;
  const causes = lifestyleOnly
    ? []
    : possibleCauses({
        symptomAt: log.loggedAt,
        meal,
        bedtime: settings.bedtime,
        lateMealWindowMinutes: settings.lateMealWindowMinutes,
      });
  return (
    <>
      <EntryHeader
        title={lifestyleOnly ? tags.join(', ') : log.items.map((item) => symptomLabel(item.key)).join(', ')}
        when={formatWhen(log.loggedAt, log.tz)}
        tags={lifestyleOnly ? [] : tags}
      />
      <View style={styles.centeredBlock}>
        <Belly mood={lifestyleOnly ? 'happy' : 'caution'} size={120} />
        {meal && (
          <AppText variant="small" color="inkSoft" style={styles.centered}>
            {`After ${meal.mealName}`}
          </AppText>
        )}
      </View>
      <NoteSheet notes={log.notes} />
      {causes.length > 0 && (
        <Disclosure label="Possibly related">
          {causes.map((cause) => (
            <AppText key={cause} variant="small">
              {cause}
            </AppText>
          ))}
        </Disclosure>
      )}
    </>
  );
}

/** Figma 40b: the type is one tag under the date, like a meal's tags. */
function DoseView({ log }: { log: Extract<LoadedEntry, { kind: 'medication' }>['log'] }) {
  return (
    <>
      <EntryHeader
        title={log.doseText ? `${log.name} ${log.doseText}` : log.name}
        when={formatWhen(log.takenAt, log.tz)}
        tags={[medicationTypeLabel(log.type)]}
      />
      <NoteSheet notes={log.notes} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.s3, paddingBottom: space.s4 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: space.s1 },
  // The logged-meal page: the name, when and tags sit open on the page, the rest on one sheet.
  meal: { gap: 8, alignItems: 'center' },
  centered: { textAlign: 'center' },
  centeredChips: { justifyContent: 'center' },
  centeredBlock: { alignItems: 'center', gap: space.s1 },
  checkingBlock: { alignItems: 'center', gap: space.s1_5 },
  reasonLines: { alignItems: 'center', gap: space.s1_5 },
  whySkeleton: { borderRadius: radius.lg, padding: space.s2, gap: space.s1_5 },
  whyLines: { gap: space.s1_5 },
  sheet: { borderRadius: 24, padding: space.s2 + 4, gap: space.s3 },
  section: { gap: space.s1_5 },
  disclosure: { borderRadius: radius.lg, paddingHorizontal: space.s2 },
  // The whole row is the tap target, so the vertical padding lives here and not on the card.
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    minHeight: minTouchTarget,
    paddingVertical: space.s1_5,
  },
  disclosureLabel: { flex: 1 },
  disclosureBody: { gap: space.s1, paddingBottom: space.s2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(58,47,37,0.45)' },
  menuPos: { position: 'absolute', right: space.s3 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s3 },
  missingTitle: { marginBottom: space.s1, textAlign: 'center' },
  missingBody: { marginBottom: space.s3, textAlign: 'center' },
});
