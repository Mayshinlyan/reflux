import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ellipsis, Heart, Pencil, Trash2 } from 'lucide-react-native';
import { type ReactNode, useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/ActionMenu';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { BackHeader } from '@/components/BackHeader';
import { VerdictHero, VerdictMore } from '@/components/food/FoodVerdict';
import { useToast } from '@/components/Toast';
import { TopBarButton } from '@/components/TopBar';
import { VerdictBadge } from '@/components/VerdictBadge';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { getFoodLog, listMealTags } from '@/db/repositories/food';
import { removeSavedFood, saveFoodFromLog, savedFoodIdByName } from '@/db/repositories/savedFoods';
import { listSymptomLogsForMeal } from '@/db/repositories/symptoms';
import { useDeleteEntry } from '@/hooks/useDeleteEntry';
import { type LoadedEntry, loadEntry } from '@/lib/entry';
import { logger } from '@/lib/logger';
import { formatTime, formatWhen } from '@/lib/localDay';
import { isLateMeal } from '@/lib/mealTiming';
import { possibleCauses } from '@/lib/possibleCauses';
import { medicationTypeLabel, symptomLabel, tagLabel } from '@/lib/timeline';
import { matchedTriggerLabels } from '@/lib/verdictReasons';
import { cardEdge, radius, space, useColors } from '@/theme';

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
            {entry.kind === 'food' && (
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

function Card({ title, children }: { title?: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      {title ? (
        <AppText variant="section" accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      {children}
    </View>
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

/** "Label ... value" inside a Details card. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText variant="small">{label}</AppText>
      <AppText variant="small" color="inkSoft">
        {value}
      </AppText>
    </View>
  );
}

function Heading({ children, badge }: { children: string; badge?: ReactNode }) {
  return (
    <View style={styles.heading}>
      {badge}
      <AppText variant="hero" accessibilityRole="header">
        {children}
      </AppText>
    </View>
  );
}

function Tags({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <View style={styles.chips}>
      {labels.map((label) => (
        <TagChip key={label} label={label} selected={false} readOnly onCard />
      ))}
    </View>
  );
}

function NoteCard({ notes }: { notes: string | null }) {
  return notes ? (
    <Card title="Note">
      <AppText variant="small">{notes}</AppText>
    </Card>
  ) : null;
}

function MealView({ log }: { log: Extract<LoadedEntry, { kind: 'food' }>['log'] }) {
  const db = useDb();
  const colors = useColors();
  const { settings } = useSettings();
  const late = isLateMeal(log.loggedAt, log.tz, settings.bedtime, settings.lateMealWindowMinutes);
  const lifestyle = listMealTags(db, log.id).map(tagLabel);
  const triggers = log.analysis ? matchedTriggerLabels(log.analysis, { late }) : late ? ['Late meal'] : [];
  const tags = [...new Set([...lifestyle, ...triggers])];
  const after = listSymptomLogsForMeal(db, log.id);
  const keys = [...new Set(after.flatMap((symptoms) => symptoms.items.map((item) => item.key)))];
  const first = after[0];
  const { analysis } = log;
  // A meal with a stored verdict (Figma row 24, 24a): the name and when first, then Bellie with the badge and the
  // one-line reason, what happened after the meal, and a closed "Why?" holding the tip and the reasons.
  if (analysis) {
    const hasAfter = (keys.length > 0 && first !== undefined) || Boolean(log.notes);
    return (
      <>
        <View style={styles.meal}>
          <AppText variant="display" accessibilityRole="header" style={styles.centered}>
            {log.mealName}
          </AppText>
          <AppText variant="small" color="inkSoft" style={styles.centered}>
            {formatWhen(log.loggedAt, log.tz)}
          </AppText>
          {/* Only what the user picked themselves; the reasons behind the verdict are under "Why?". */}
          {lifestyle.length > 0 && (
            <View style={[styles.chips, styles.centeredChips]}>
              {lifestyle.map((label) => (
                <TagChip key={label} label={label} selected={false} readOnly />
              ))}
            </View>
          )}
        </View>
        <VerdictHero analysis={analysis} late={late} showTriggers={false} showBubble={false} />
        {hasAfter && (
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            {keys.length > 0 && first && (
              <Section title="Symptoms">
                <View style={styles.chips}>
                  {keys.map((key) => (
                    <SymptomChip key={key} label={symptomLabel(key)} selected readOnly />
                  ))}
                </View>
                <AppText variant="caption" color="inkSoft">
                  {`Logged at ${formatTime(first.loggedAt, first.tz)}`}
                </AppText>
              </Section>
            )}
            {log.notes ? (
              <Section title="Note">
                <AppText variant="small">{log.notes}</AppText>
              </Section>
            ) : null}
          </View>
        )}
        <VerdictMore analysis={analysis} late={late} />
      </>
    );
  }
  return (
    <>
      <Heading badge={log.overallVerdict ? <VerdictBadge verdict={log.overallVerdict} /> : undefined}>
        {log.mealName}
      </Heading>
      <Card>
        <AppText variant="bodyEm">{formatWhen(log.loggedAt, log.tz)}</AppText>
        <Tags labels={tags} />
      </Card>
      {keys.length > 0 && first && (
        <Card title="Symptoms">
          <View style={styles.chips}>
            {keys.map((key) => (
              <SymptomChip key={key} label={symptomLabel(key)} selected readOnly />
            ))}
          </View>
          <AppText variant="caption" color="inkSoft">
            {`Logged at ${formatTime(first.loggedAt, first.tz)}`}
          </AppText>
        </Card>
      )}
      <NoteCard notes={log.notes} />
    </>
  );
}

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
      <Heading>
        {lifestyleOnly ? tags.join(', ') : log.items.map((item) => symptomLabel(item.key)).join(', ')}
      </Heading>
      <Card>
        <AppText variant="bodyEm">{formatWhen(log.loggedAt, log.tz)}</AppText>
        {!lifestyleOnly && <Tags labels={tags} />}
      </Card>
      {!lifestyleOnly && (
        <Card title="Symptoms">
          <View style={styles.chips}>
            {log.items.map((item) => (
              <SymptomChip key={item.key} label={symptomLabel(item.key)} selected readOnly />
            ))}
          </View>
          {meal && (
            <AppText variant="caption" color="inkSoft">
              {`After ${meal.mealName}`}
            </AppText>
          )}
        </Card>
      )}
      {causes.length > 0 && (
        <Card title="Possibly related">
          {causes.map((cause) => (
            <AppText key={cause} variant="small">
              {cause}
            </AppText>
          ))}
          <AppText variant="caption" color="inkSoft">
            Worked out on your phone from what you logged. Not a diagnosis.
          </AppText>
        </Card>
      )}
      <NoteCard notes={log.notes} />
    </>
  );
}

function DoseView({ log }: { log: Extract<LoadedEntry, { kind: 'medication' }>['log'] }) {
  return (
    <>
      <Heading>{log.doseText ? `${log.name} ${log.doseText}` : log.name}</Heading>
      <Card>
        <AppText variant="bodyEm">{formatWhen(log.takenAt, log.tz)}</AppText>
      </Card>
      <Card title="Details">
        <DetailRow label="Type" value={medicationTypeLabel(log.type)} />
      </Card>
      <NoteCard notes={log.notes} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.s3, paddingBottom: space.s4 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: space.s1 },
  heading: { gap: space.s2 },
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1_5 },
  // The logged-meal page: the name, when and tags sit open on the page, the rest on one sheet.
  meal: { gap: 8, alignItems: 'center' },
  centered: { textAlign: 'center' },
  centeredChips: { justifyContent: 'center' },
  sheet: { borderRadius: 24, padding: space.s2 + 4, gap: space.s3 },
  section: { gap: space.s1_5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(58,47,37,0.45)' },
  menuPos: { position: 'absolute', right: space.s3 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s3 },
  missingTitle: { marginBottom: space.s1, textAlign: 'center' },
  missingBody: { marginBottom: space.s3, textAlign: 'center' },
});
